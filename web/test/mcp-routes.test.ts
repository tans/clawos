import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetEnvCacheForTests } from "../src/lib/env";
import { app } from "../src/index";

const UPLOAD_TOKEN = "test-token";

let tempStorageDir = "";

function makeMcpUploadForm(overrides?: {
  mcpId?: string;
  version?: string;
  channel?: "stable" | "beta";
  fileName?: string;
  bytes?: string;
  manifest?: Record<string, unknown>;
}): FormData {
  const mcpId = overrides?.mcpId ?? "windows-mcp";
  const version = overrides?.version ?? "0.1.0";
  const fileName = overrides?.fileName ?? `${mcpId}-${version}.zip`;
  const payload = overrides?.bytes ?? "fake-mcp-package";
  const manifest =
    overrides?.manifest ??
    ({
      schemaVersion: "1.0",
      id: mcpId,
      name: "Windows MCP",
      version,
    } satisfies Record<string, unknown>);

  const form = new FormData();
  form.set("mcpId", mcpId);
  form.set("version", version);
  form.set("manifest", JSON.stringify(manifest));
  form.set("file", new File([new TextEncoder().encode(payload)], fileName, { type: "application/zip" }));
  if (overrides?.channel) {
    form.set("channel", overrides.channel);
  }
  return form;
}

beforeEach(async () => {
  tempStorageDir = await mkdtemp(join(tmpdir(), "clawos-web-routes-"));
  process.env.STORAGE_DIR = tempStorageDir;
  process.env.UPLOAD_TOKEN = UPLOAD_TOKEN;
  process.env.MAX_INSTALLER_SIZE_MB = "5";
  process.env.MAX_CONFIG_SIZE_MB = "1";
  process.env.MAX_MCP_PACKAGE_SIZE_MB = "1";
  resetEnvCacheForTests();
});

afterEach(async () => {
  delete process.env.STORAGE_DIR;
  delete process.env.UPLOAD_TOKEN;
  delete process.env.MAX_INSTALLER_SIZE_MB;
  delete process.env.MAX_CONFIG_SIZE_MB;
  delete process.env.MAX_MCP_PACKAGE_SIZE_MB;
  resetEnvCacheForTests();
  if (tempStorageDir) {
    await rm(tempStorageDir, { recursive: true, force: true });
  }
});

describe("mcp routes", () => {
  it("rejects unauthenticated MCP upload", async () => {
    const response = await app.request("http://localhost/api/upload/mcp", {
      method: "POST",
      body: makeMcpUploadForm(),
    });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("上传鉴权失败");
  });

  it("supports uploading MCP and querying via release/download APIs", async () => {
    const uploadResponse = await app.request("http://localhost/api/upload/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${UPLOAD_TOKEN}` },
      body: makeMcpUploadForm(),
    });
    const uploadPayload = (await uploadResponse.json()) as Record<string, unknown>;

    expect(uploadResponse.status).toBe(200);
    expect(uploadPayload.ok).toBe(true);
    expect(uploadPayload.mcpId).toBe("windows-mcp");
    expect(uploadPayload.version).toBe("0.1.0");

    const listResponse = await app.request("http://localhost/api/mcps");
    const listPayload = (await listResponse.json()) as Record<string, unknown>;
    const listItems = listPayload.items as Array<Record<string, unknown>>;

    expect(listResponse.status).toBe(200);
    expect(listPayload.ok).toBe(true);
    expect(listItems).toHaveLength(1);
    expect(listItems[0]?.id).toBe("windows-mcp");

    const detailResponse = await app.request("http://localhost/api/mcps/windows-mcp");
    const detailPayload = (await detailResponse.json()) as Record<string, unknown>;
    const detailItem = detailPayload.item as Record<string, unknown>;
    expect(detailResponse.status).toBe(200);
    expect(detailPayload.ok).toBe(true);
    expect(detailItem.version).toBe("0.1.0");

    const downloadListResponse = await app.request("http://localhost/downloads/mcp");
    const downloadListPayload = (await downloadListResponse.json()) as Record<string, unknown>;
    const downloadItems = downloadListPayload.items as Array<Record<string, unknown>>;
    expect(downloadListResponse.status).toBe(200);
    expect(downloadListPayload.ok).toBe(true);
    expect(downloadItems[0]?.downloadUrl).toBe("/downloads/mcp/windows-mcp/latest");

    const downloadResponse = await app.request("http://localhost/downloads/mcp/windows-mcp/latest");
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("x-mcp-id")).toBe("windows-mcp");
    expect(downloadResponse.headers.get("x-mcp-version")).toBe("0.1.0");
    expect(await downloadResponse.text()).toBe("fake-mcp-package");
  });

  it("separates stable and beta channels across release/download APIs", async () => {
    const stableUpload = await app.request("http://localhost/api/upload/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${UPLOAD_TOKEN}` },
      body: makeMcpUploadForm({
        mcpId: "wechat-mcp",
        version: "0.1.0",
        bytes: "stable-build",
        manifest: {
          schemaVersion: "1.0",
          id: "wechat-mcp",
          name: "WeChat MCP",
          version: "0.1.0",
        },
      }),
    });
    expect(stableUpload.status).toBe(200);

    const betaUpload = await app.request("http://localhost/api/upload/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${UPLOAD_TOKEN}` },
      body: makeMcpUploadForm({
        mcpId: "wechat-mcp",
        version: "0.2.0-beta.1",
        channel: "beta",
        bytes: "beta-build",
        manifest: {
          schemaVersion: "1.0",
          id: "wechat-mcp",
          name: "WeChat MCP",
          version: "0.2.0-beta.1",
        },
      }),
    });
    expect(betaUpload.status).toBe(200);

    const stableList = await app.request("http://localhost/api/mcps?channel=stable");
    const stablePayload = (await stableList.json()) as Record<string, unknown>;
    const stableItems = stablePayload.items as Array<Record<string, unknown>>;
    expect(stableItems[0]?.version).toBe("0.1.0");

    const betaList = await app.request("http://localhost/api/mcps?channel=beta");
    const betaPayload = (await betaList.json()) as Record<string, unknown>;
    const betaItems = betaPayload.items as Array<Record<string, unknown>>;
    expect(betaItems[0]?.version).toBe("0.2.0-beta.1");

    const stableDownload = await app.request("http://localhost/downloads/mcp/wechat-mcp/latest");
    expect(stableDownload.headers.get("x-release-channel")).toBe("stable");
    expect(stableDownload.headers.get("x-mcp-version")).toBe("0.1.0");
    expect(await stableDownload.text()).toBe("stable-build");

    const betaDownload = await app.request("http://localhost/downloads/mcp/wechat-mcp/latest?channel=beta");
    expect(betaDownload.headers.get("x-release-channel")).toBe("beta");
    expect(betaDownload.headers.get("x-mcp-version")).toBe("0.2.0-beta.1");
    expect(await betaDownload.text()).toBe("beta-build");
  });

  it("lists MCP version history and supports downloading by version", async () => {
    const firstUpload = await app.request("http://localhost/api/upload/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${UPLOAD_TOKEN}` },
      body: makeMcpUploadForm({
        mcpId: "bom-mcp",
        version: "0.1.0",
        bytes: "bom-v010",
        manifest: {
          schemaVersion: "1.0",
          id: "bom-mcp",
          name: "BOM MCP",
          version: "0.1.0",
        },
      }),
    });
    expect(firstUpload.status).toBe(200);

    const secondUpload = await app.request("http://localhost/api/upload/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${UPLOAD_TOKEN}` },
      body: makeMcpUploadForm({
        mcpId: "bom-mcp",
        version: "0.1.1",
        bytes: "bom-v011",
        manifest: {
          schemaVersion: "1.0",
          id: "bom-mcp",
          name: "BOM MCP",
          version: "0.1.1",
        },
      }),
    });
    expect(secondUpload.status).toBe(200);

    const versionsResponse = await app.request("http://localhost/api/mcps/bom-mcp/versions");
    const versionsPayload = (await versionsResponse.json()) as Record<string, unknown>;
    const versions = versionsPayload.items as Array<Record<string, unknown>>;

    expect(versionsResponse.status).toBe(200);
    expect(versionsPayload.ok).toBe(true);
    expect(versions).toHaveLength(2);
    expect(versions[0]?.version).toBe("0.1.1");
    expect(versions[1]?.version).toBe("0.1.0");

    const firstDownload = await app.request("http://localhost/downloads/mcp/bom-mcp/0.1.0");
    expect(firstDownload.status).toBe(200);
    expect(firstDownload.headers.get("x-mcp-version")).toBe("0.1.0");
    expect(await firstDownload.text()).toBe("bom-v010");

    const secondDownload = await app.request("http://localhost/downloads/mcp/bom-mcp/0.1.1");
    expect(secondDownload.status).toBe(200);
    expect(secondDownload.headers.get("x-mcp-version")).toBe("0.1.1");
    expect(await secondDownload.text()).toBe("bom-v011");
  });

  it("returns validation error when manifest does not match mcpId", async () => {
    const response = await app.request("http://localhost/api/upload/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${UPLOAD_TOKEN}` },
      body: makeMcpUploadForm({
        mcpId: "windows-mcp",
        manifest: {
          schemaVersion: "1.0",
          id: "wechat-mcp",
          name: "Invalid MCP",
          version: "0.1.0",
        },
      }),
    });
    const payload = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toContain("manifest.id 不匹配");
    expect(payload.code).toBe("MCP_UPLOAD_INVALID");
  });

  it("returns not-found code for missing latest MCP package", async () => {
    const response = await app.request("http://localhost/downloads/mcp/not-exist/latest");
    const payload = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(404);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("MCP_LATEST_NOT_FOUND");
    expect(payload.mcpId).toBe("not-exist");
  });

  it("returns not-found code for missing MCP package version", async () => {
    const response = await app.request("http://localhost/downloads/mcp/not-exist/0.0.1");
    const payload = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(404);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("MCP_VERSION_NOT_FOUND");
    expect(payload.mcpId).toBe("not-exist");
    expect(payload.version).toBe("0.0.1");
  });

  it("returns 404 on MCP detail API when the release does not exist", async () => {
    const response = await app.request("http://localhost/api/mcps/unknown-mcp");
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("MCP 不存在");
  });

  it("rejects MCP package exceeding MAX_MCP_PACKAGE_SIZE_MB", async () => {
    process.env.MAX_MCP_PACKAGE_SIZE_MB = "1";
    resetEnvCacheForTests();
    const oversizePayload = "a".repeat(1024 * 1024 + 64);

    const response = await app.request("http://localhost/api/upload/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${UPLOAD_TOKEN}` },
      body: makeMcpUploadForm({ bytes: oversizePayload }),
    });
    const payload = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toContain("超过大小限制");
  });
});
