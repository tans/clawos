import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetEnvCacheForTests } from "../src/lib/env";
import { storeMcpPackage } from "../src/lib/storage";
import { app } from "../src/index";

let tempStorageDir = "";

beforeEach(async () => {
  tempStorageDir = await mkdtemp(join(tmpdir(), "clawos-web-admin-"));
  process.env.STORAGE_DIR = tempStorageDir;
  process.env.UPLOAD_TOKEN = "test-token";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD = "secret";
  process.env.MAX_MCP_PACKAGE_SIZE_MB = "2";
  resetEnvCacheForTests();
});

afterEach(async () => {
  delete process.env.STORAGE_DIR;
  delete process.env.UPLOAD_TOKEN;
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.MAX_MCP_PACKAGE_SIZE_MB;
  resetEnvCacheForTests();
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

  it("can publish MCP to shelf", async () => {
    await storeMcpPackage({
      mcpId: "wechat-mcp",
      version: "0.1.0",
      fileName: "wechat-mcp-0.1.0.zip",
      bytes: new TextEncoder().encode("fake-mcp"),
      channel: "stable",
      manifest: {
        schemaVersion: "1.0",
        id: "wechat-mcp",
        name: "WeChat MCP",
        version: "0.1.0",
      },
    });

    const loginForm = new FormData();
    loginForm.set("username", "admin");
    loginForm.set("password", "secret");

    const loginResponse = await app.request("http://localhost/admin/login", {
      method: "POST",
      body: loginForm,
    });
    const cookie = loginResponse.headers.get("set-cookie") || "";

    const shelfForm = new FormData();
    shelfForm.set("mcpId", "wechat-mcp");
    shelfForm.set("version", "0.1.0");
    shelfForm.set("channel", "stable");
    shelfForm.set("published", "true");

    const shelfResponse = await app.request("http://localhost/admin/mcp/shelf", {
      method: "POST",
      headers: { cookie },
      body: shelfForm,
    });
    expect(shelfResponse.status).toBe(302);

    const publicResponse = await app.request("http://localhost/api/mcps/shelf?channel=stable");
    const payload = (await publicResponse.json()) as Record<string, unknown>;
    const items = payload.items as Array<Record<string, unknown>>;

    expect(publicResponse.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("wechat-mcp");
    expect(items[0]?.version).toBe("0.1.0");
  });
});
