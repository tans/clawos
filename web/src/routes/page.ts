import { Hono } from "hono";
import { listPublishedDownloadItems, listPublishedProducts, getProductById } from "../lib/storage";
import { renderAgentPage } from "../views/agent";
import { renderAgentMarketPage } from "../views/agent-market";
import { renderCeoLetterPage } from "../views/ceo-letter";
import { renderContactPage } from "../views/contact";
import { renderDownloadsPage } from "../views/downloads";
import { renderHomePage } from "../views/home";
import { renderMarketPage } from "../views/market";
import { renderOemPage } from "../views/oem";
import { renderHelpPage } from "../views/help";
import { renderOrdersPage } from "../views/orders";
import { renderPaySuccessPage } from "../views/pay-success";
import { renderProductPage } from "../views/product";
import { renderShopPage } from "../views/shop";

export const pageRoutes = new Hono();

pageRoutes.get("/", (c) => {
  return c.html(renderHomePage());
});

pageRoutes.get("/downloads", async (c) => {
  const items = await listPublishedDownloadItems();
  return c.html(renderDownloadsPage(items));
});

pageRoutes.get("/shop", async (c) => {
  const items = await listPublishedProducts();
  return c.html(renderShopPage(items));
});

pageRoutes.get("/install-guide", (c) => {
  return c.redirect("/", 302);
});

pageRoutes.get("/to-agent", (c) => {
  return c.html(renderAgentPage());
});

pageRoutes.get("/agent-market", (c) => {
  return c.html(renderAgentMarketPage());
});

pageRoutes.get("/market", (c) => {
  return c.html(renderMarketPage());
});

pageRoutes.get("/ceo-letter", (c) => {
  return c.html(renderCeoLetterPage());
});

pageRoutes.get("/contact", (c) => {
  return c.html(renderContactPage());
});

pageRoutes.get("/oem", (c) => {
  return c.html(renderOemPage());
});

pageRoutes.get("/help", (c) => {
  return c.html(renderHelpPage());
});

// Product detail page
pageRoutes.get("/shop/:id", async (c) => {
  const productId = c.req.param("id");
  const product = await getProductById(productId);
  if (!product) {
    return c.html(renderProductPage(null, "商品不存在"));
  }
  return c.html(renderProductPage(product));
});

// User orders page
pageRoutes.get("/orders", async (c) => {
  const { readOrders } = await import("../lib/storage");
  const orders = await readOrders();
  return c.html(renderOrdersPage(orders));
});

// Payment success page
pageRoutes.get("/pay-success", async (c) => {
  const orderId = c.req.query("orderId");
  if (!orderId) {
    return c.html(renderPaySuccessPage(null, "缺少订单号"));
  }
  const { getOrderById } = await import("../lib/storage");
  const order = await getOrderById(orderId);
  if (!order) {
    return c.html(renderPaySuccessPage(null, "订单不存在"));
  }
  return c.html(renderPaySuccessPage({
    id: order.id,
    productId: order.productId,
    productName: order.productName,
    productPriceCny: order.productPriceCny,
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  }));
});
