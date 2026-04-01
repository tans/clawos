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
  deleteTask,
  normalizeReleaseChannel,
  readLatestRelease,
  readProducts,
  readSiteSettings,
  readTasks,
  toggleTask,
  upsertProduct,
  upsertTask,
  writeLatestRelease,
  writeSiteSettings,
} from "../lib/storage";
import { getBrandConfig } from "../lib/branding";
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
      products,
      tasks,
      notice: c.req.query("notice") || undefined,
      settings: settings || {
        brandName: fallback.brandName,
        siteName: fallback.siteName,
        brandLogoUrl: fallback.brandLogoUrl,
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

adminRoutes.post("/admin/settings/save", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  await writeSiteSettings({
    brandName: firstValue(body.brandName)?.trim() || "ClawOS",
    siteName: firstValue(body.siteName)?.trim() || "ClawOS",
    brandLogoUrl: firstValue(body.brandLogoUrl)?.trim() || "/public/logo.png",
    seoTitle: firstValue(body.seoTitle)?.trim() || "ClawOS",
    seoDescription: firstValue(body.seoDescription)?.trim() || "",
    seoKeywords: firstValue(body.seoKeywords)?.trim() || "",
  });
  return noticeRedirect(c, "品牌与 SEO 设置已保存");
});

adminRoutes.post("/admin/releases/save", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  const channel = normalizeReleaseChannel(firstValue(body.channel)) || "stable";
  const current = await readLatestRelease(channel);
  const version = firstValue(body.version)?.trim() || "dev";
  await writeLatestRelease({
    version,
    publishedAt: new Date().toISOString(),
    installer: current?.installer || null,
    installers: current?.installers || {},
    xiakeConfig: current?.xiakeConfig || null,
    updaterAssets: current?.updaterAssets || [],
  }, channel);
  return noticeRedirect(c, `已更新 ${channel} 版本为 ${version}`);
});

adminRoutes.post("/admin/tasks/save", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  try {
    await upsertTask({
      id: firstValue(body.id)?.trim() || "",
      title: firstValue(body.title)?.trim() || "",
      description: firstValue(body.description)?.trim() || "",
      dueDate: firstValue(body.dueDate)?.trim() || "",
      priority: (firstValue(body.priority) as "low" | "medium" | "high") || "medium",
      done: toPublished(firstValue(body.done)),
    });
    return noticeRedirect(c, "任务已保存");
  } catch (error) {
    return noticeRedirect(c, `任务保存失败: ${(error as Error).message}`);
  }
});

adminRoutes.post("/admin/tasks/toggle", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  await toggleTask(firstValue(body.id)?.trim() || "");
  return noticeRedirect(c, "任务状态已更新");
});

adminRoutes.post("/admin/tasks/delete", requireAdminAuth, async (c) => {
  const body = await c.req.parseBody();
  await deleteTask(firstValue(body.id)?.trim() || "");
  return noticeRedirect(c, "任务已删除");
});
