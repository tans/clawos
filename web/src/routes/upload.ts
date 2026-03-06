import { Hono, type Context } from "hono";
import { requireUploadAuth } from "../lib/auth";
import { normalizeInstallerPlatform, storeInstaller, storeXiakeConfig } from "../lib/storage";
import type { InstallerPlatform } from "../lib/types";

export const uploadRoutes = new Hono();

uploadRoutes.use("/api/upload/*", requireUploadAuth);

function firstValue<T>(value: T | T[] | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function toUint8Array(arrayBuffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(arrayBuffer);
}

async function parseUploadRequest(c: Context, defaultFileName: string): Promise<{
  fileName: string;
  bytes: Uint8Array;
  version?: string;
  platform?: InstallerPlatform;
}> {
  const contentType = c.req.header("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody();
    const fileField = firstValue(body.file);
    if (!(fileField instanceof File)) {
      throw new Error("缺少 file 文件字段");
    }

    const versionField = firstValue(body.version);
    const version = typeof versionField === "string" ? versionField.trim() : undefined;
    const platformField = firstValue(body.platform);
    const platform = normalizeInstallerPlatform(platformField);

    return {
      fileName: fileField.name || defaultFileName,
      bytes: toUint8Array(await fileField.arrayBuffer()),
      version: version || undefined,
      platform: platform || undefined,
    };
  }

  const fileName =
    c.req.header("x-file-name") ||
    c.req.query("fileName") ||
    defaultFileName;
  const version = c.req.header("x-version") || c.req.query("version") || undefined;
  const platform = normalizeInstallerPlatform(c.req.header("x-platform") || c.req.query("platform") || undefined);
  const bytes = toUint8Array(await c.req.arrayBuffer());

  return {
    fileName,
    bytes,
    version,
    platform: platform || undefined,
  };
}

uploadRoutes.post("/api/upload/installer", async (c) => {
  try {
    const upload = await parseUploadRequest(c, "clawos.exe");
    const result = await storeInstaller(upload);

    return c.json({
      ok: true,
      fileName: result.asset.name,
      size: result.asset.size,
      sha256: result.asset.sha256,
      version: result.release.version,
      platform: upload.platform || null,
      url: upload.platform ? `/downloads/latest/${upload.platform}` : "/downloads/latest",
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 400);
  }
});

uploadRoutes.post("/api/upload/xiake-config", async (c) => {
  try {
    const upload = await parseUploadRequest(c, "clawos_xiake.json");
    const result = await storeXiakeConfig(upload);

    return c.json({
      ok: true,
      fileName: result.asset.name,
      size: result.asset.size,
      sha256: result.asset.sha256,
      version: result.release.version,
      url: "/downloads/clawos_xiake.json",
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 400);
  }
});
