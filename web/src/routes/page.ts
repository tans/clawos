import { Hono } from "hono";
import { listPublishedDownloadItems, listPublishedProducts } from "../lib/storage";
import { renderAgentPage } from "../views/agent";
import { renderAgentMarketPage } from "../views/agent-market";
import { renderCeoLetterPage } from "../views/ceo-letter";
import { renderContactPage } from "../views/contact";
import { renderDownloadsPage } from "../views/downloads";
import { renderHomePage } from "../views/home";
import { renderMarketPage } from "../views/market";
import { renderOemPage } from "../views/oem";
import { renderShopPage } from "../views/shop";

export const pageRoutes = new Hono();

pageRoutes.get("/", (c) => {
  return c.html(renderHomePage());
});

pageRoutes.get("/downloads", async (c) => {
  const items = await listPublishedDownloadItems();
  return c.html(renderDownloadsPage(
    items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      version: item.version,
      fileCount: item.files.length,
      firstFile: item.files[0]
        ? { name: item.files[0].name, size: item.files[0].size, sha256: item.files[0].sha256 }
        : null,
      downloadUrl: item.files[0]
        ? `/downloads/${item.id}/${encodeURIComponent(item.files[0].name)}`
        : null,
      updatedAt: item.updatedAt,
    })),
  ));
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
