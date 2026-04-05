/** @jsxImportSource hono/jsx */

import { Hono } from "hono";
import { listRedemptionCodes } from "./lib/newapi";
import { createOrder, queryOrder, checkPayment } from "./lib/onepay";
import { PRODUCTS, getProduct } from "./lib/products";

const app = new Hono();

const PORT = parseInt(process.env.PORT || "3003", 10);
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const ONEPAY_NOTIFY_URL = process.env.ONEPAY_NOTIFY_URL || `${BASE_URL}/api/notify`;

// ============================================================
// 页面渲染
// ============================================================

function renderShell({ title, children }: { title: string; children: any }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 40px; }
    .products { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
    .product { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .product-name { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .product-desc { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 16px; }
    .product-price { font-size: 24px; font-weight: 700; color: #e55a00; margin-bottom: 16px; }
    .product-price span { font-size: 14px; font-weight: 400; color: #999; }
    .btn { display: inline-block; background: #e55a00; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; cursor: pointer; border: none; width: 100%; text-align: center; }
    .btn:hover { background: #cc4e00; }
    .header { margin-bottom: 40px; }
    .tips { background: #fffbe6; border: 1px solid #ffe58f; border-radius: 8px; padding: 16px; margin-top: 32px; font-size: 14px; color: #8a6600; }
    .tips h3 { font-size: 15px; margin-bottom: 8px; }
    .tips li { margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎫 Token 充值码购买</h1>
      <p class="subtitle">购买充值码，充值到 ClawOS Token 账户，永久有效</p>
    </div>
    <div class="products">
      ${PRODUCTS.map((p) => `
        <div class="product">
          <div class="product-name">${p.name}</div>
          <div class="product-desc">${p.description}</div>
          <div class="product-price">¥${(p.priceCents / 100).toFixed(0)} <span>面值 ¥${p.redemptionValue}</span></div>
          <button class="btn" onclick="buy('${p.id}')">立即购买</button>
        </div>
      `).join("")}
    </div>
    <div class="tips">
      <h3>💡 使用说明</h3>
      <ul>
        <li>支付成功后，兑换码会自动显示在页面</li>
        <li>复制兑换码，前往 ClawOS Token 账户充值</li>
        <li>兑换码永久有效，不限次数使用</li>
        <li>如有疑问请联系客服</li>
      </ul>
    </div>
  </div>
  <script>
    async function buy(productId) {
      const btn = event.target;
      btn.textContent = '正在跳转支付...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        });
        const data = await res.json();
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
        } else {
          alert('创建订单失败: ' + (data.error || '未知错误'));
          btn.textContent = '立即购买';
          btn.disabled = false;
        }
      } catch (e) {
        alert('网络错误，请重试');
        btn.textContent = '立即购买';
        btn.disabled = false;
      }
    }

    // 轮询支付结果
    async function pollPayment(orderId) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch('/api/check/' + orderId);
          const data = await res.json();
          if (data.status === 'paid') {
            clearInterval(interval);
            showRedemptionCode(orderId);
          }
        } catch {}
      }, 2000);
    }

    async function showRedemptionCode(orderId) {
      const res = await fetch('/api/order/' + orderId);
      const data = await res.json();
      if (data.code) {
        document.getElementById('result').innerHTML = \`
          <div style="background:#d4edda;border:1px solid #c3e6cb;border-radius:8px;padding:24px;text-align:center;">
            <h2 style="color:#155724;margin-bottom:16px;">✅ 支付成功！</h2>
            <p style="margin-bottom:8px;">您的兑换码：</p>
            <div style="background:#fff;font-size:20px;font-weight:700;padding:16px;border-radius:8px;margin:16px 0;letter-spacing:2px;">\${data.code}</div>
            <p style="font-size:14px;color:#666;">面值：¥\${data.value}｜有效期：永久</p>
          </div>
        \`;
      }
    }
  </script>
</body>
</html>`;
}

function renderSuccessPage({ orderId, productName }: { orderId: string; productName: string }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>支付中...</title>
  <style>
    body { font-family: -apple-system, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#f5f5f5; }
    .box { background:white; border-radius:16px; padding:48px; text-align:center; box-shadow:0 4px 16px rgba(0,0,0,0.1); max-width:400px; }
    h2 { margin-bottom:16px; }
    p { color:#666; margin-bottom:24px; }
    .spinner { width:40px; height:40px; border:4px solid #e55a00; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto 24px; }
    @keyframes spin { to{transform:rotate(360deg)} }
    #result { display:none; margin-top:24px; }
    code { background:#f0f0f0; padding:8px 16px; border-radius:6px; font-size:18px; letter-spacing:2px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <h2>支付完成后自动显示兑换码</h2>
    <p>请在收银台完成支付，页面将自动更新</p>
    <div id="result"></div>
  </div>
  <script>
    const orderId = ${JSON.stringify(orderId)};
    const productName = ${JSON.stringify(productName)};
    async function check() {
      const res = await fetch('/api/check/' + orderId);
      const data = await res.json();
      if (data.status === 'paid') {
        const r = await fetch('/api/order/' + orderId);
        const order = await r.json();
        document.querySelector('.spinner').style.display = 'none';
        document.querySelector('h2').textContent = '✅ 支付成功！';
        document.querySelector('p').textContent = '您的兑换码：';
        document.getElementById('result').style.display = 'block';
        document.getElementById('result').innerHTML = \`<code>\${order.code}</code><p style="margin-top:16px;font-size:14px;">面值 ¥\${order.value}｜永久有效</p>\`;
      } else {
        setTimeout(check, 2000);
      }
    }
    check();
  </script>
</body>
</html>`;
}

// ============================================================
// API 路由
// ============================================================

// 健康检查
app.get("/health", (c) => c.json({ ok: true, service: "buytoken" }));

// 产品列表
app.get("/api/products", (c) => {
  return c.json({ ok: true, items: PRODUCTS });
});

// 创建订单
app.post("/api/create-order", async (c) => {
  const { productId, email } = await c.req.json().catch(() => ({}));

  const product = getProduct(productId);
  if (!product) {
    return c.json({ ok: false, error: "产品不存在" }, 400);
  }

  const outTradeNo = `bt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const redirectUrl = `${BASE_URL}/success?orderId=${outTradeNo}&productName=${encodeURIComponent(product.name)}`;

  const order = await createOrder({
    fee: product.priceCents,
    title: product.name,
    outTradeNo,
    redirectUrl,
    notifyUrl: ONEPAY_NOTIFY_URL,
    email,
  });

  if (!order) {
    return c.json({ ok: false, error: "创建订单失败，请重试" }, 500);
  }

  return c.json({ ok: true, orderId: outTradeNo, paymentUrl: order.paymentUrl });
});

// 轮询支付结果（前端轮询）
app.get("/api/check/:orderId", async (c) => {
  const { orderId } = c.req.param();

  // 先查本地记录（如果通知已处理）
  const order = await queryOrder(undefined, orderId);
  if (order?.status === "paid") {
    return c.json({ status: true, redirectUrl: `${BASE_URL}/success?orderId=${orderId}` });
  }

  return c.json({ status: false });
});

// 跳转成功页
app.get("/success", (c) => {
  const orderId = c.req.query("orderId") || "";
  const productName = c.req.query("productName") || "";
  return c.html(renderSuccessPage({ orderId, productName }));
});

// 查询订单的兑换码（支付成功后）
app.get("/api/order/:orderId", async (c) => {
  const { orderId } = c.req.param();

  // 确认订单已支付
  const order = await queryOrder(undefined, orderId);
  if (!order || order.status !== "paid") {
    return c.json({ ok: false, error: "订单未支付或不存在" }, 400);
  }

  // 从 NewAPI 获取一个未使用的兑换码
  const codes = await listRedemptionCodes();
  if (!codes || codes.length === 0) {
    return c.json({ ok: false, error: "暂无可用兑换码，请联系客服" }, 500);
  }

  // 找第一个未使用的（根据实际业务逻辑，这里简化处理）
  const unused = codes.find((c) => c.status === "unused");
  if (!unused) {
    return c.json({ ok: false, error: "暂无可用兑换码，请联系客服" }, 500);
  }

  return c.json({
    ok: true,
    code: unused.code,
    value: unused.value,
    name: unused.name,
  });
});

// OnePay 回调通知
app.post("/api/notify", async (c) => {
  try {
    const body = await c.req.json();
    console.log("[notify] OnePay callback:", JSON.stringify(body));

    // TODO: 验签（如果 OnePay 支持）
    // if (!verifyNotifySign(body, secret)) { return c.json({ok: false}, 400); }

    // 回调中可获取支付成功信息，更新本地订单状态
    // 目前通过 queryOrder 查，所以这里只需要记录日志
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false, error: "解析失败" }, 400);
  }
});

// 静态文件
app.get("/*", async (c) => {
  const path = c.req.path === "/" ? "/index.html" : c.req.path;
  const filePath = `./public${path}`;

  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      // 返回主页（SPA 模式）
      return c.html(renderShell({ title: "Token 充值码购买", children: null }));
    }
    return new Response(file);
  } catch {
    return c.html(renderShell({ title: "Token 充值码购买", children: null }));
  }
});

// ============================================================
// 启动
// ============================================================

if (import.meta.main) {
  console.log(`[buytoken] starting on http://127.0.0.1:${PORT}`);
  console.log(`[buytoken] base url: ${BASE_URL}`);
  console.log(`[buytoken] one-pay notify: ${ONEPAY_NOTIFY_URL}`);

  Bun.serve({ port: PORT, fetch: app.fetch });
}

export { app };
