import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetBrandConfigCacheForTests } from "../src/lib/branding";
import { resetEnvCacheForTests } from "../src/lib/env";
import { app } from "../src/index";

let tempStorageDir = "";

beforeEach(async () => {
  tempStorageDir = await mkdtemp(join(tmpdir(), "clawos-web-admin-"));
  process.env.STORAGE_DIR = tempStorageDir;
  process.env.UPLOAD_TOKEN = "test-token";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD = "secret";
  process.env.MAX_MCP_PACKAGE_SIZE_MB = "2";
  process.env.OEM_SITE_NAME = "ClawOS 控制台";
  process.env.OEM_BRAND_LOGO_URL = "/public/logo.png";
  process.env.OEM_SEO_DESCRIPTION = "后台站点描述";
  process.env.OEM_SEO_KEYWORDS = "后台,商品管理";
  resetEnvCacheForTests();
  resetBrandConfigCacheForTests();
});

afterEach(async () => {
  delete process.env.STORAGE_DIR;
  delete process.env.UPLOAD_TOKEN;
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.MAX_MCP_PACKAGE_SIZE_MB;
  delete process.env.OEM_SITE_NAME;
  delete process.env.OEM_BRAND_LOGO_URL;
  delete process.env.OEM_SEO_DESCRIPTION;
  delete process.env.OEM_SEO_KEYWORDS;
  resetEnvCacheForTests();
  resetBrandConfigCacheForTests();
  if (tempStorageDir) {
    await rm(tempStorageDir, { recursive: true, force: true });
  }
});

describe("admin routes", () => {
  it("requires login for admin page", async () => {
    const response = await app.request("http://localhost/admin");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin/login");
  });

  it("renders admin login SEO/site header with logo", async () => {
    const response = await app.request("http://localhost/admin/login");
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("ClawOS 控制台 管理后台登录");
    expect(html).toContain("后台站点描述");
    expect(html).toContain('name="keywords" content="后台,商品管理"');
    expect(html).toContain('name="robots" content="noindex,nofollow"');
    expect(html).toContain('src="/public/logo.png"');
  });

  it("supports login and managing products", async () => {
    const loginForm = new FormData();
    loginForm.set("username", "admin");
    loginForm.set("password", "secret");

    const loginResponse = await app.request("http://localhost/admin/login", {
      method: "POST",
      body: loginForm,
    });
    expect(loginResponse.status).toBe(302);

    const cookie = loginResponse.headers.get("set-cookie") || "";
    expect(cookie).toContain("clawos_admin_session=");

    const saveForm = new FormData();
    saveForm.set("id", "pro-plan");
    saveForm.set("name", "Pro 套餐");
    saveForm.set("description", "适用于团队部署");
    saveForm.set("priceCny", "199/月");
    saveForm.set("link", "https://example.com/pro");
    saveForm.set("published", "true");

    const saveResponse = await app.request("http://localhost/admin/products/save", {
      method: "POST",
      headers: { cookie },
      body: saveForm,
    });
    expect(saveResponse.status).toBe(302);

    const productsResponse = await app.request("http://localhost/api/products");
    const productsPayload = (await productsResponse.json()) as Record<string, unknown>;
    const items = productsPayload.items as Array<Record<string, unknown>>;

    expect(productsResponse.status).toBe(200);
    expect(productsPayload.ok).toBe(true);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("pro-plan");
    expect(items[0]?.name).toBe("Pro 套餐");
  });

  it("supports branding settings and task management", async () => {
    const loginForm = new FormData();
    loginForm.set("username", "admin");
    loginForm.set("password", "secret");
    const loginResponse = await app.request("http://localhost/admin/login", {
      method: "POST",
      body: loginForm,
    });
    const cookie = loginResponse.headers.get("set-cookie") || "";

    const settingsForm = new FormData();
    settingsForm.set("brandName", "新品牌");
    settingsForm.set("siteName", "新站点");
    settingsForm.set("brandLogoUrl", "/public/new-logo.png");
    settingsForm.set("seoTitle", "新标题");
    settingsForm.set("seoDescription", "新描述");
    settingsForm.set("seoKeywords", "a,b");

    const settingsResp = await app.request("http://localhost/admin/settings/save", {
      method: "POST",
      headers: { cookie },
      body: settingsForm,
    });
    expect(settingsResp.status).toBe(302);

    const taskForm = new FormData();
    taskForm.set("title", "上线商品页");
    taskForm.set("priority", "high");
    const taskResp = await app.request("http://localhost/admin/tasks/save", {
      method: "POST",
      headers: { cookie },
      body: taskForm,
    });
    expect(taskResp.status).toBe(302);

    const settingsRaw = await readFile(join(tempStorageDir, "releases", "site-settings.json"), "utf-8");
    expect(settingsRaw).toContain("新品牌");

    const loginPageResp = await app.request("http://localhost/admin/login");
    const loginHtml = await loginPageResp.text();
    expect(loginPageResp.status).toBe(200);
    expect(loginHtml).toContain("新品牌 后台登录");

    const tasksRaw = await readFile(join(tempStorageDir, "releases", "tasks.json"), "utf-8");
    expect(tasksRaw).toContain("上线商品页");
  });

  it("supports admin image upload with multipart file", async () => {
    const loginForm = new FormData();
    loginForm.set("username", "admin");
    loginForm.set("password", "secret");
    const loginResponse = await app.request("http://localhost/admin/login", {
      method: "POST",
      body: loginForm,
    });
    const cookie = loginResponse.headers.get("set-cookie") || "";

    const body = new FormData();
    body.set("kind", "product");
    body.set("file", new File([new TextEncoder().encode("fake-image-bytes")], "sample.png", { type: "image/png" }));

    const uploadResponse = await app.request("http://localhost/admin/upload/image", {
      method: "POST",
      headers: { cookie },
      body,
    });
    const payload = (await uploadResponse.json()) as Record<string, unknown>;
    expect(uploadResponse.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(typeof payload.url).toBe("string");
    expect(String(payload.url)).toMatch(/^\/admin-assets\/product-\d+-[0-9a-f-]+\.png$/);

    const fileName = String(payload.url).replace("/admin-assets/", "");
    const stored = await readFile(join(tempStorageDir, "assets", "admin-images", fileName), "utf-8");
    expect(stored).toBe("fake-image-bytes");
  });

  it("supports saving release changelog/thumbnail in versions management", async () => {
    const loginForm = new FormData();
    loginForm.set("username", "admin");
    loginForm.set("password", "secret");
    const loginResponse = await app.request("http://localhost/admin/login", {
      method: "POST",
      body: loginForm,
    });
    const cookie = loginResponse.headers.get("set-cookie") || "";

    const releaseForm = new FormData();
    releaseForm.set("channel", "stable");
    releaseForm.set("version", "9.9.9");
    releaseForm.set("changelog", "修复关键问题\n优化下载体验");
    releaseForm.set("thumbnailUrl", "/admin-assets/logo-1.png");
    const saveResponse = await app.request("http://localhost/admin/releases/save", {
      method: "POST",
      headers: { cookie },
      body: releaseForm,
    });
    expect(saveResponse.status).toBe(302);

    const raw = await readFile(join(tempStorageDir, "releases", "latest.json"), "utf-8");
    expect(raw).toContain('"version": "9.9.9"');
    expect(raw).toContain('"changelog": "修复关键问题\\n优化下载体验"');
    expect(raw).toContain('"thumbnailUrl": "/admin-assets/logo-1.png"');
  });

  it("supports installer upload from versions management", async () => {
    const loginForm = new FormData();
    loginForm.set("username", "admin");
    loginForm.set("password", "secret");
    const loginResponse = await app.request("http://localhost/admin/login", {
      method: "POST",
      body: loginForm,
    });
    const cookie = loginResponse.headers.get("set-cookie") || "";

    const body = new FormData();
    body.set("channel", "stable");
    body.set("version", "4.0.0");
    body.set("file", new File([new TextEncoder().encode("fake-installer")], "clawos-4.0.0.exe", { type: "application/octet-stream" }));

    const uploadResponse = await app.request("http://localhost/admin/upload/installer", {
      method: "POST",
      headers: { cookie },
      body,
    });
    const payload = (await uploadResponse.json()) as Record<string, unknown>;
    expect(uploadResponse.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.version).toBe("4.0.0");
    expect(payload.fileName).toBe("clawos-4.0.0.exe");
    expect(payload.channel).toBe("stable");

    const latestRaw = await readFile(join(tempStorageDir, "releases", "latest.json"), "utf-8");
    expect(latestRaw).toContain('"version": "4.0.0"');
    expect(latestRaw).toContain('"name": "clawos-4.0.0.exe"');
  });
});
