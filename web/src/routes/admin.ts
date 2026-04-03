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
  deleteProduct,
  deleteTask,
  normalizeInstallerPlatform,
  normalizeReleaseChannel,
  readLatestRelease,
  readProducts,
  readSiteSettings,
  readTasks,
  storeInstaller,
  toggleTask,
  upsertProduct,
  upsertTask,
  writeLatestRelease,
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

type AdminSection = "settings" | "versions" | "products" | "tasks";

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
  const [products, tasks, settings, stableRelease, betaRelease, alphaRelease] = await Promise.all([
    readProducts(),
    readTasks(),
    readSiteSettings(),
    readLatestRelease("stable"),
    readLatestRelease("beta"),
    readLatestRelease("alpha"),
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
        brandUrl: fallback.brandUrl,
        seoTitle: fallback.seoTitle,
        seoDescription: fallback.seoDescription,
        seoKeywords: fallback.seoKeywords,
        updatedAt: new Date().toISOString(),
      },
      releases: {
        stable: stableRelease,
        beta: betaRelease,
        alpha: alphaRelease,
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

adminRoutes.get("/admin/versions", requireAdminAuth, async (c) => {
  return renderAdminSection(c, "versions");
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
    brandUrl: firstValue(body.brandUrl)?.trim() || "https://clawos.cc",
    seoTitle: firstValue(body.seoTitle)?.trim() || "ClawOS",
    seoDescription: firstValue(body.seoDescription)?.trim() || "",
    seoKeywords: firstValue(body.seoKeywords)?.trim() || "",
  });
  resetBrandConfigCache();
  return noticeRedirect(c, "品牌与 SEO 设置已保存", "settings");
});

adminRoutes.post("/admin/releases/save", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  const channel = normalizeReleaseChannel(firstValue(body.channel)) || "stable";
  const current = await readLatestRelease(channel);
  const version = firstValue(body.version)?.trim() || "dev";
  const changelog = firstValue(body.changelog)?.trim() || "";
  const thumbnailUrl = firstValue(body.thumbnailUrl)?.trim() || "";
  await writeLatestRelease({
    version,
    changelog,
    thumbnailUrl,
    publishedAt: new Date().toISOString(),
    installer: current?.installer || null,
    installers: current?.installers || {},
    xiakeConfig: current?.xiakeConfig || null,
    updaterAssets: current?.updaterAssets || [],
  }, channel);
  return noticeRedirect(c, `已更新 ${channel} 版本为 ${version}`, "versions");
});

adminRoutes.post("/admin/upload/installer", requireAdminAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = firstFile(body.file) || firstFile(body.upload);
    if (!file) {
      return c.json({ ok: false, error: "缺少安装包文件" }, 400);
    }
    const channel = normalizeReleaseChannel(firstValue(body.channel)) || "stable";
    const version = firstValue(body.version)?.trim() || undefined;
    const platform = normalizeInstallerPlatform(firstValue(body.platform)) || undefined;
    const result = await storeInstaller({
      fileName: file.name || "clawos-setup.zip",
      bytes: new Uint8Array(await file.arrayBuffer()),
      channel,
      version,
      platform,
    });
    return c.json({
      ok: true,
      channel,
      version: result.release.version,
      fileName: result.asset.name,
      platform: platform || null,
      size: result.asset.size,
      downloadUrl: `/downloads/${channel === "stable" ? "latest" : channel}`,
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 400);
  }
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
