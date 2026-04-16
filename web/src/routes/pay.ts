import { Hono } from "hono";
import {
  createQrCodeOrder,
  isAlipayConfigured,
  queryOrderStatus,
  verifyNotification,
} from "../lib/alipay";
import {
  createOrder as createOrderStorage,
  getOrderById as getOrderByIdStorage,
  updateOrderStatus as updateOrderStatusStorage,
  listPublishedProducts,
} from "../lib/storage";
import { getBrandConfig } from "../lib/branding";

export const payRoutes = new Hono();

function parsePriceCny(priceCny: string): string {
  // Remove anything after "/" (e.g., "99/月" -> "99")
  // Remove currency symbols and spaces
  const cleaned = priceCny.replace(/\/.*$/, "").replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) {
    throw new Error("价格格式错误");
  }
  return num.toFixed(2);
}

// POST /api/pay/create - Create payment order and get Alipay QR code
payRoutes.post("/api/pay/create", async (c) => {
  try {
    const body = await c.req.json<{
      productId: string;
      shippingName?: string;
      shippingPhone?: string;
      shippingAddress?: string;
    }>();
    const { productId, shippingName, shippingPhone, shippingAddress } = body;

    if (!productId || typeof productId !== "string") {
      return c.json({ ok: false, error: "商品 ID 不能为空" }, 400);
    }

    // Check if Alipay is configured
    if (!isAlipayConfigured()) {
      return c.json({ ok: false, error: "支付未配置" }, 503);
    }

    // Find the product
    const products = await listPublishedProducts();
    const product = products.find((p) => p.id === productId);

    if (!product) {
      return c.json({ ok: false, error: "商品不存在" }, 404);
    }

    // Check if shipping info is required
    if (product.requiresLogistics) {
      if (!shippingName || !shippingPhone || !shippingAddress) {
        return c.json({ ok: false, error: "请填写完整的收货信息" }, 400);
      }
      if (!/^1[3-9]\d{9}$/.test(shippingPhone)) {
        return c.json({ ok: false, error: "手机号格式不正确" }, 400);
      }
    }

    // Parse price
    let priceAmount: string;
    try {
      priceAmount = parsePriceCny(product.priceCny);
    } catch {
      return c.json({ ok: false, error: "价格格式错误" }, 400);
    }

    // Generate order ID
    const outTradeNo = `order-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // Create Alipay QR code
    const qrResult = await createQrCodeOrder({
      outTradeNo,
      totalAmount: priceAmount,
      subject: product.name,
    });

    // Store order in database
    const order = await createOrderStorage({
      productId: product.id,
      productName: product.name,
      productPriceCny: product.priceCny,
      alipayQrCodeUrl: qrResult.qrCodeUrl,
      alipayOutTradeNo: qrResult.outTradeNo,
      shippingName: shippingName,
      shippingPhone: shippingPhone,
      shippingAddress: shippingAddress,
    });

    // Check if registered domain is configured
    const brandConfig = getBrandConfig();
    const hasRegisteredDomain = brandConfig.registeredDomain && brandConfig.registeredDomain.trim();

    if (hasRegisteredDomain) {
      // Return pay URL instead of QR code directly - user will be redirected to registered domain for payment
      const payUrl = `${brandConfig.registeredDomain.replace(/\/$/, "")}/pay/${order.id}`;
      return c.json({
        ok: true,
        orderId: order.id,
        payUrl,
        productName: product.name,
        priceCny: product.priceCny,
      });
    }

    // No registered domain configured, return QR code directly (original behavior)
    return c.json({
      ok: true,
      orderId: order.id,
      qrCodeUrl: qrResult.qrCodeUrl,
      productName: product.name,
      priceCny: product.priceCny,
    });
  } catch (err) {
    const error = err as Error;
    console.error("[pay] create order error:", error);
    // Check for Alipay permission errors
    const errorMsg = error.message || "支付初始化失败";
    if (errorMsg.includes("40006") || errorMsg.includes("Insufficient Permissions")) {
      console.error("[pay] Alipay permission error - 可能未开通当面付功能");
      return c.json({ ok: false, error: "支付宝权限不足，请联系管理员开通当面付功能" }, 500);
    }
    return c.json({ ok: false, error: errorMsg }, 500);
  }
});

// GET /api/pay/status/:orderId - Poll payment status
payRoutes.get("/api/pay/status/:orderId", async (c) => {
  try {
    const orderId = c.req.param("orderId");

    const order = await getOrderByIdStorage(orderId);

    if (!order) {
      return c.json({ ok: false, error: "订单不存在" }, 404);
    }

    // If already paid or failed, return current status
    if (order.status !== "pending") {
      return c.json({
        ok: true,
        status: order.status,
        order: {
          id: order.id,
          productId: order.productId,
          productName: order.productName,
          productPriceCny: order.productPriceCny,
          status: order.status,
          createdAt: order.createdAt,
          paidAt: order.paidAt,
        },
      });
    }

    // Query Alipay for current status
    if (order.alipayOutTradeNo && isAlipayConfigured()) {
      try {
        const result = await queryOrderStatus(order.alipayOutTradeNo);
        if (result.status === "paid") {
          await updateOrderStatusStorage(orderId, "paid", {
            alipayTradeNo: result.tradeNo,
          });
          return c.json({
            ok: true,
            status: "paid",
            order: {
              id: order.id,
              productId: order.productId,
              productName: order.productName,
              productPriceCny: order.productPriceCny,
              status: "paid",
              createdAt: order.createdAt,
              paidAt: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        console.error("[pay] query order status error:", err);
      }
    }

    return c.json({
      ok: true,
      status: order.status,
      order: {
        id: order.id,
        productId: order.productId,
        productName: order.productName,
        productPriceCny: order.productPriceCny,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    const error = err as Error;
    console.error("[pay] status check error:", error);
    return c.json({ ok: false, error: "查询失败" }, 500);
  }
});

// GET /api/pay/qr/:orderId - Get QR code URL for an order
payRoutes.get("/api/pay/qr/:orderId", async (c) => {
  try {
    const orderId = c.req.param("orderId");
    const order = await getOrderByIdStorage(orderId);

    if (!order) {
      return c.json({ ok: false, error: "订单不存在" }, 404);
    }

    if (!order.alipayQrCodeUrl) {
      return c.json({ ok: false, error: "支付二维码不可用" }, 400);
    }

    return c.json({
      ok: true,
      qrCodeUrl: order.alipayQrCodeUrl,
    });
  } catch (err) {
    const error = err as Error;
    console.error("[pay] get qr error:", error);
    return c.json({ ok: false, error: "查询失败" }, 500);
  }
});

// POST /api/pay/alipay/notify - Alipay async notification callback
payRoutes.post("/api/pay/alipay/notify", async (c) => {
  try {
    const postData = await c.req.parseBody<Record<string, string>>();

    console.log("[pay] Alipay notify received:", postData);

    // Verify signature
    if (!verifyNotification(postData)) {
      console.error("[pay] Alipay notify signature verification failed, postData:", postData);
      return c.text("fail", 400);
    }

    const outTradeNo = postData.out_trade_no;
    const tradeNo = postData.trade_no;
    const tradeStatus = postData.trade_status;

    if (!outTradeNo) {
      return c.text("fail");
    }

    // Find order by outTradeNo (which is stored as alipayOutTradeNo)
    const orders = await import("../lib/storage").then((m) => m.readOrders());
    const order = orders.find((o) => o.alipayOutTradeNo === outTradeNo);

    if (!order) {
      console.error("[pay] Order not found for outTradeNo:", outTradeNo);
      return c.text("fail");
    }

    // Check trade status
    if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
      await updateOrderStatusStorage(order.id, "paid", {
        alipayTradeNo: tradeNo,
        notifyData: postData,
      });
      console.log("[pay] Order paid:", order.id);
    }

    return c.text("success");
  } catch (err) {
    const error = err as Error;
    console.error("[pay] Alipay notify error:", error);
    return c.text("fail", 500);
  }
});
