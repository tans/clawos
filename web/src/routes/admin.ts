import { Hono, type Context } from "hono";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import {
  canUseAdminLogin,
  clearAdminSession,
  hasAdminSession,
  requireAdminAuth,
  setAdminSession,
  verifyAdminCredentials,
} from "../lib/auth";
import {
  deleteDownloadItem,
  deleteProduct,
  deleteTask,
  expireOldPendingOrders,
  fetchExternalUrlAndSave,
  readDownloadItems,
  readOrders,
  readProducts,
  readSiteSettings,
  readTasks,
  reorderDownloadItems,
  storeDownloadFile,
  toggleTask,
  updateOrderStatus,
  upsertDownloadItem,
  upsertProduct,
  upsertTask,
  writeSiteSettings,
} from "../lib/storage";
import { getEnv } from "../lib/env";
import { getBrandConfig, resetBrandConfigCache } from "../lib/branding";
import { renderAdminLoginPage, renderAdminPage } from "../views/admin";

export const adminRoutes = new Hono();

function firstValue(value: string | File | (string | File)[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function firstFile(value: unknown): (Blob & { name?: string }) | undefined {
  if (Array.isArray(value)) {
    return firstFile(value[0]);
  }
  if (value instanceof File) {
    return value;
  }
  if (value instanceof Blob) {
    return value;
  }
  return undefined;
}

function toPublished(raw: string | undefined): boolean {
  return raw === "true" || raw === "on" || raw === "1";
}

function toRequiresLogistics(raw: string | undefined): boolean {
  return raw === "true" || raw === "on" || raw === "1";
}

type AdminSection = "settings" | "products" | "tasks" | "downloads";

function sectionPath(section: AdminSection): string {
  if (section === "settings") {
    return "/admin";
  }
  return `/admin/${section}`;
}

function noticeRedirect(c: Context, message: string, section: AdminSection = "settings"): Response {
  return c.redirect(`${sectionPath(section)}?notice=${encodeURIComponent(message)}`, 302);
}

async function renderAdminSection(c: Context, activeSection: AdminSection): Promise<Response> {
  const [products, tasks, settings] = await Promise.all([
    readProducts(),
    readTasks(),
    readSiteSettings(),
  ]);
  const fallback = getBrandConfig();
  return c.html(
    renderAdminPage({
      activeSection,
      products,
      tasks,
      notice: c.req.query("notice") || undefined,
      settings: settings || {
        brandName: fallback.brandName,
        siteName: fallback.siteName,
        brandLogoUrl: fallback.brandLogoUrl,
        heroBannerUrl: fallback.heroBannerUrl,
        brandUrl: fallback.brandUrl,
        seoTitle: fallback.seoTitle,
        seoDescription: fallback.seoDescription,
        seoKeywords: fallback.seoKeywords,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
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
  return renderAdminSection(c, "settings");
});

adminRoutes.get("/admin/products", requireAdminAuth, async (c) => {
  return renderAdminSection(c, "products");
});

adminRoutes.get("/admin/tasks", requireAdminAuth, async (c) => {
  return renderAdminSection(c, "tasks");
});

adminRoutes.post("/admin/products/save", requireAdminAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    await upsertProduct({
      id: firstValue(body.id)?.trim() || "",
      name: firstValue(body.name)?.trim() || "",
      description: firstValue(body.description)?.trim() || "",
      imageUrl: firstValue(body.imageUrl)?.trim() || "",
      priceCny: firstValue(body.priceCny)?.trim() || "",
      link: firstValue(body.link)?.trim() || "",
      published: toPublished(firstValue(body.published)),
      requiresLogistics: toRequiresLogistics(firstValue(body.requiresLogistics)),
    });
    return noticeRedirect(c, "商品已保存", "products");
  } catch (error) {
    return noticeRedirect(c, `保存失败: ${(error as Error).message}`, "products");
  }
});

adminRoutes.post("/admin/products/delete", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  const id = firstValue(body.id)?.trim() || "";
  await deleteProduct(id);
  return noticeRedirect(c, "商品已删除", "products");
});

adminRoutes.post("/admin/settings/save", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  await writeSiteSettings({
    brandName: firstValue(body.brandName)?.trim() || "ClawOS",
    siteName: firstValue(body.siteName)?.trim() || "ClawOS",
    brandLogoUrl: firstValue(body.brandLogoUrl)?.trim() || "/public/logo.png",
    heroBannerUrl: firstValue(body.heroBannerUrl)?.trim() || "",
    brandUrl: firstValue(body.brandUrl)?.trim() || "https://clawos.cc",
    seoTitle: firstValue(body.seoTitle)?.trim() || "ClawOS",
    seoDescription: firstValue(body.seoDescription)?.trim() || "",
    seoKeywords: firstValue(body.seoKeywords)?.trim() || "",
  });
  resetBrandConfigCache();
  return noticeRedirect(c, "品牌与 SEO 设置已保存", "settings");
});

adminRoutes.post("/admin/tasks/save", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  try {
    await upsertTask({
      id: firstValue(body.id)?.trim() || "",
      title: firstValue(body.title)?.trim() || "",
      description: firstValue(body.description)?.trim() || "",
      imageUrl: firstValue(body.imageUrl)?.trim() || "",
      dueDate: firstValue(body.dueDate)?.trim() || "",
      priority: (firstValue(body.priority) as "low" | "medium" | "high") || "medium",
      done: toPublished(firstValue(body.done)),
    });
    return noticeRedirect(c, "任务已保存", "tasks");
  } catch (error) {
    return noticeRedirect(c, `任务保存失败: ${(error as Error).message}`, "tasks");
  }
});

adminRoutes.post("/admin/tasks/toggle", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  await toggleTask(firstValue(body.id)?.trim() || "");
  return noticeRedirect(c, "任务状态已更新", "tasks");
});

adminRoutes.post("/admin/tasks/delete", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  await deleteTask(firstValue(body.id)?.trim() || "");
  return noticeRedirect(c, "任务已删除", "tasks");
});

adminRoutes.post("/admin/upload/image", requireAdminAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = firstFile(body.file) || firstFile(body.image) || firstFile(body.upload);
    if (!file) {
      return c.json({ ok: false, error: "缺少文件" }, 400);
    }
    const kindRaw = firstValue(body.kind)?.trim().toLowerCase() || "misc";
    const kind = kindRaw === "logo" || kindRaw === "product" || kindRaw === "task" ? kindRaw : "misc";
    const ext = extname(file.name || "").toLowerCase() || ".png";
    if (![".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext)) {
      return c.json({ ok: false, error: "仅支持图片格式" }, 400);
    }
    const fileName = `${kind}-${Date.now()}-${randomUUID()}${ext}`;
    const dir = resolve(getEnv().storageDir, "assets", "admin-images");
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, fileName), new Uint8Array(await file.arrayBuffer()));
    return c.json({ ok: true, url: `/admin-assets/${fileName}` });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 400);
  }
});

adminRoutes.get("/admin-assets/:fileName", async (c) => {
  const fileName = c.req.param("fileName");
  if (!/^[A-Za-z0-9._-]+$/.test(fileName)) {
    return c.text("Not Found", 404);
  }
  const filePath = resolve(getEnv().storageDir, "assets", "admin-images", fileName);
  try {
    const content = await readFile(filePath);
    const ext = extname(fileName).toLowerCase();
    const contentType =
      ext === ".png" ? "image/png" :
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      ext === ".webp" ? "image/webp" :
      ext === ".gif" ? "image/gif" :
      ext === ".svg" ? "image/svg+xml" :
      "application/octet-stream";
    return new Response(content, { headers: { "content-type": contentType, "cache-control": "public, max-age=3600" } });
  } catch {
    return c.text("Not Found", 404);
  }
});

adminRoutes.get("/admin-assets/downloads-logos/:fileName", async (c) => {
  const fileName = c.req.param("fileName");
  if (!/^[A-Za-z0-9._-]+$/.test(fileName)) {
    return c.text("Not Found", 404);
  }
  const filePath = resolve(getEnv().storageDir, "assets", "downloads-logos", fileName);
  try {
    const content = await readFile(filePath);
    const ext = extname(fileName).toLowerCase();
    const contentType =
      ext === ".png" ? "image/png" :
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      ext === ".webp" ? "image/webp" :
      ext === ".gif" ? "image/gif" :
      ext === ".svg" ? "image/svg+xml" :
      "application/octet-stream";
    return new Response(content, { headers: { "content-type": contentType, "cache-control": "public, max-age=3600" } });
  } catch {
    return c.text("Not Found", 404);
  }
});

// Download Items Management

adminRoutes.get("/admin/downloads", requireAdminAuth, async (c) => {
  const downloads = await readDownloadItems();
  return c.html(
    renderAdminPage({
      activeSection: "downloads",
      downloads,
      products: [],
      tasks: [],
      notice: c.req.query("notice") || undefined,
      settings: {
        brandName: getBrandConfig().brandName,
        siteName: getBrandConfig().siteName,
        brandLogoUrl: getBrandConfig().brandLogoUrl,
        brandUrl: getBrandConfig().brandUrl,
        seoTitle: getBrandConfig().seoTitle,
        seoDescription: getBrandConfig().seoDescription,
        seoKeywords: getBrandConfig().seoKeywords,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
});

adminRoutes.post("/admin/downloads/save", requireAdminAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    await upsertDownloadItem({
      id: firstValue(body.id)?.trim() || "",
      name: firstValue(body.name)?.trim() || "",
      description: firstValue(body.description)?.trim() || "",
      logo: firstValue(body.logo)?.trim() || "",
      version: firstValue(body.version)?.trim() || "",
      files: [],
      published: toPublished(firstValue(body.published)),
      sortOrder: parseInt(firstValue(body.sortOrder) || "0", 10) || 0,
    });
    return noticeRedirect(c, "下载项已保存", "downloads");
  } catch (error) {
    return noticeRedirect(c, `保存失败: ${(error as Error).message}`, "downloads");
  }
});

adminRoutes.post("/admin/downloads/delete", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  await deleteDownloadItem(firstValue(body.id)?.trim() || "");
  return noticeRedirect(c, "下载项已删除", "downloads");
});

adminRoutes.post("/admin/downloads/upload-file", requireAdminAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    const itemId = firstValue(body.itemId)?.trim() || "";
    if (!itemId) {
      return noticeRedirect(c, "缺少下载项 ID", "downloads");
    }
    const file = firstFile(body.file);
    if (!file) {
      return noticeRedirect(c, "请选择要上传的文件", "downloads");
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    await storeDownloadFile(itemId, safeName, new Uint8Array(await file.arrayBuffer()));
    return noticeRedirect(c, `文件 ${safeName} 上传成功`, "downloads");
  } catch (error) {
    return noticeRedirect(c, `上传失败: ${(error as Error).message}`, "downloads");
  }
});

adminRoutes.post("/admin/downloads/fetch-external", requireAdminAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    const url = firstValue(body.url)?.trim() || "";
    if (!url) {
      return c.json({ ok: false, error: "缺少 URL" }, 400);
    }
    const result = await fetchExternalUrlAndSave(url);
    if ("error" in result) {
      return c.json({ ok: false, error: result.error }, 400);
    }
    return c.json({ ok: true, url: result.localPath });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 400);
  }
});

adminRoutes.post("/admin/downloads/reorder", requireAdminAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    const ids = firstValue(body.ids)?.trim() || "";
    if (!ids) {
      return noticeRedirect(c, "缺少排序数据", "downloads");
    }
    await reorderDownloadItems(ids.split(",").map((s) => s.trim()).filter(Boolean));
    return noticeRedirect(c, "排序已更新", "downloads");
  } catch (error) {
    return noticeRedirect(c, `排序失败: ${(error as Error).message}`, "downloads");
  }
});

// Orders Management

adminRoutes.get("/admin/orders", requireAdminAuth, async (c) => {
  // Expire old pending orders first
  await expireOldPendingOrders(24);
  const orders = await readOrders();
  return c.html(
    renderAdminPage({
      activeSection: "orders",
      orders,
      products: [],
      tasks: [],
      notice: c.req.query("notice") || undefined,
      settings: {
        brandName: getBrandConfig().brandName,
        siteName: getBrandConfig().siteName,
        brandLogoUrl: getBrandConfig().brandLogoUrl,
        brandUrl: getBrandConfig().brandUrl,
        seoTitle: getBrandConfig().seoTitle,
        seoDescription: getBrandConfig().seoDescription,
        seoKeywords: getBrandConfig().seoKeywords,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
});

adminRoutes.post("/admin/orders/cancel", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  const id = firstValue(body.id)?.trim() || "";
  if (!id) {
    return noticeRedirect(c, "缺少订单号", "orders");
  }
  try {
    await updateOrderStatus(id, "cancelled");
    return noticeRedirect(c, "订单已取消", "orders");
  } catch (error) {
    return noticeRedirect(c, `操作失败: ${(error as Error).message}`, "orders");
  }
});

adminRoutes.post("/admin/orders/refund", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  const id = firstValue(body.id)?.trim() || "";
  if (!id) {
    return noticeRedirect(c, "缺少订单号", "orders");
  }
  try {
    await updateOrderStatus(id, "refunded");
    return noticeRedirect(c, "订单已退款", "orders");
  } catch (error) {
    return noticeRedirect(c, `操作失败: ${(error as Error).message}`, "orders");
  }
});
