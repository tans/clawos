import { Hono, type Context } from "hono";
import {
  canUseAdminLogin,
  clearAdminSession,
  hasAdminSession,
  requireAdminAuth,
  setAdminSession,
  verifyAdminCredentials,
} from "../lib/auth";
import {
  deleteProduct,
  listMcpReleases,
  normalizeReleaseChannel,
  readMcpShelf,
  readProducts,
  setMcpShelfStatus,
  upsertProduct,
} from "../lib/storage";
import { renderAdminLoginPage, renderAdminPage } from "../views/admin";

export const adminRoutes = new Hono();

function firstValue(value: string | File | (string | File)[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function toPublished(raw: string | undefined): boolean {
  return raw === "true" || raw === "on" || raw === "1";
}

function noticeRedirect(c: Context, message: string): Response {
  return c.redirect(`/admin?notice=${encodeURIComponent(message)}`, 302);
}

adminRoutes.get("/admin/login", (c) => {
  if (hasAdminSession(c)) {
    return c.redirect("/admin", 302);
  }
  if (!canUseAdminLogin()) {
    return c.html(renderAdminLoginPage("服务端未配置 ADMIN_USERNAME / ADMIN_PASSWORD"), 503);
  }
  return c.html(renderAdminLoginPage());
});

adminRoutes.post("/admin/login", async (c) => {
  if (!canUseAdminLogin()) {
    return c.html(renderAdminLoginPage("服务端未配置 ADMIN_USERNAME / ADMIN_PASSWORD"), 503);
  }
  const body = await c.req.parseBody();
  const username = firstValue(body.username)?.trim() || "";
  const password = firstValue(body.password) || "";

  if (!verifyAdminCredentials(username, password)) {
    return c.html(renderAdminLoginPage("账号或密码错误"), 401);
  }

  setAdminSession(c);
  return c.redirect("/admin", 302);
});

adminRoutes.post("/admin/logout", (c) => {
  clearAdminSession(c);
  return c.redirect("/admin/login", 302);
});

adminRoutes.get("/admin", requireAdminAuth, async (c) => {
  const [products, stableMcps, betaMcps, shelf] = await Promise.all([
    readProducts(),
    listMcpReleases("stable"),
    listMcpReleases("beta"),
    readMcpShelf(),
  ]);

  return c.html(
    renderAdminPage({
      products,
      stableMcps,
      betaMcps,
      shelf,
      notice: c.req.query("notice") || undefined,
    })
  );
});

adminRoutes.post("/admin/products/save", requireAdminAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    await upsertProduct({
      id: firstValue(body.id)?.trim() || "",
      name: firstValue(body.name)?.trim() || "",
      description: firstValue(body.description)?.trim() || "",
      priceCny: firstValue(body.priceCny)?.trim() || "",
      link: firstValue(body.link)?.trim() || "",
      published: toPublished(firstValue(body.published)),
    });
    return noticeRedirect(c, "商品已保存");
  } catch (error) {
    return noticeRedirect(c, `保存失败: ${(error as Error).message}`);
  }
});

adminRoutes.post("/admin/products/delete", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  const id = firstValue(body.id)?.trim() || "";
  await deleteProduct(id);
  return noticeRedirect(c, "商品已删除");
});

adminRoutes.post("/admin/mcp/shelf", requireAdminAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    const channel = normalizeReleaseChannel(firstValue(body.channel)) || "stable";
    const published = toPublished(firstValue(body.published));
    await setMcpShelfStatus({
      mcpId: firstValue(body.mcpId)?.trim() || "",
      version: firstValue(body.version)?.trim() || "",
      channel,
      published,
    });
    return noticeRedirect(c, published ? "MCP 已上架" : "MCP 已下架");
  } catch (error) {
    return noticeRedirect(c, `操作失败: ${(error as Error).message}`);
  }
});
