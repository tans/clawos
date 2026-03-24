import { Hono, type Context } from "hono";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { requireUploadAuth } from "../lib/auth";
import { getEnv } from "../lib/env";
import {
  normalizeInstallerPlatform,
  normalizeReleaseChannel,
  storeInstaller,
  storeMcpPackage,
  storeUpdaterArtifact,
  storeXiakeConfig,
} from "../lib/storage";
import type { InstallerPlatform, ReleaseChannel } from "../lib/types";

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

function channelSuffix(channel: ReleaseChannel | undefined): string {
  return channel && channel !== "stable" ? `?channel=${channel}` : "";
}

type ChunkTarget = "installer" | "xiake-config" | "electrobun-artifact";

interface ChunkUploadSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  target: ChunkTarget;
  fileName: string;
  totalSize: number;
  totalChunks: number;
  version?: string;
  platform?: InstallerPlatform;
  channel?: ReleaseChannel;
  received: number[];
}

function getChunkBaseDir(): string {
  return resolve(getEnv().storageDir, "chunk-uploads");
}

function getChunkSessionPath(uploadId: string): string {
  return resolve(getChunkBaseDir(), `${uploadId}.json`);
}

function getChunkPartDir(uploadId: string): string {
  return resolve(getChunkBaseDir(), uploadId);
}

async function ensureChunkStorage(): Promise<void> {
  await mkdir(getChunkBaseDir(), { recursive: true });
}

function normalizeChunkTarget(raw: unknown): ChunkTarget {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "installer" || value === "/api/upload/installer") {
    return "installer";
  }
  if (value === "xiake-config" || value === "config" || value === "/api/upload/xiake-config") {
    return "xiake-config";
  }
  if (value === "electrobun-artifact" || value === "updater" || value === "/api/upload/electrobun-artifact") {
    return "electrobun-artifact";
  }
  throw new Error("chunk target 不支持");
}

async function saveChunkSession(session: ChunkUploadSession): Promise<void> {
  await ensureChunkStorage();
  await writeFile(getChunkSessionPath(session.id), `${JSON.stringify(session, null, 2)}\n`, "utf-8");
}

async function loadChunkSession(uploadId: string): Promise<ChunkUploadSession> {
  await ensureChunkStorage();
  const raw = await readFile(getChunkSessionPath(uploadId), "utf-8");
  return JSON.parse(raw) as ChunkUploadSession;
}

async function cleanupChunkSession(uploadId: string): Promise<void> {
  await rm(getChunkSessionPath(uploadId), { force: true }).catch(() => undefined);
  await rm(getChunkPartDir(uploadId), { recursive: true, force: true }).catch(() => undefined);
}

async function parseUploadRequest(c: Context, defaultFileName: string): Promise<{
  fileName: string;
  bytes: Uint8Array;
  version?: string;
  platform?: InstallerPlatform;
  channel?: ReleaseChannel;
  mcpId?: string;
  manifest?: string;
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
    const channelField = firstValue(body.channel);
    const channel = normalizeReleaseChannel(channelField);
    const mcpIdField = firstValue(body.mcpId);
    const manifestField = firstValue(body.manifest);

    return {
      fileName: fileField.name || defaultFileName,
      bytes: toUint8Array(await fileField.arrayBuffer()),
      version: version || undefined,
      platform: platform || undefined,
      channel: channel || undefined,
      mcpId: typeof mcpIdField === "string" ? mcpIdField.trim() : undefined,
      manifest: typeof manifestField === "string" ? manifestField.trim() : undefined,
    };
  }

  const fileName =
    c.req.header("x-file-name") ||
    c.req.query("fileName") ||
    defaultFileName;
  const version = c.req.header("x-version") || c.req.query("version") || undefined;
  const platform = normalizeInstallerPlatform(c.req.header("x-platform") || c.req.query("platform") || undefined);
  const channel = normalizeReleaseChannel(c.req.header("x-channel") || c.req.query("channel") || undefined);
  const mcpId = c.req.header("x-mcp-id") || c.req.query("mcpId") || undefined;
  const manifest = c.req.header("x-mcp-manifest") || undefined;
  const bytes = toUint8Array(await c.req.arrayBuffer());

  return {
    fileName,
    bytes,
    version,
    platform: platform || undefined,
    channel: channel || undefined,
    mcpId,
    manifest,
  };
}

uploadRoutes.post("/api/upload/installer", async (c) => {
  try {
    const upload = await parseUploadRequest(c, "clawos-setup.zip");
    const result = await storeInstaller(upload);

    return c.json({
      ok: true,
      fileName: result.asset.name,
      size: result.asset.size,
      sha256: result.asset.sha256,
      version: result.release.version,
      platform: upload.platform || null,
      channel: upload.channel || "stable",
      url:
        upload.channel && upload.channel !== "stable"
          ? upload.platform
            ? `/downloads/${upload.channel}/${upload.platform}`
            : `/downloads/${upload.channel}`
          : upload.platform
            ? `/downloads/latest/${upload.platform}`
            : "/downloads/latest",
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 400);
  }
});

uploadRoutes.post("/api/upload/chunk/init", async (c) => {
  try {
    const body = await c.req.json();
    const target = normalizeChunkTarget((body as Record<string, unknown>).target);
    const fileName = String((body as Record<string, unknown>).fileName || "").trim();
    const totalSize = Number((body as Record<string, unknown>).totalSize || 0);
    const totalChunks = Number((body as Record<string, unknown>).totalChunks || 0);
    const versionRaw = (body as Record<string, unknown>).version;
    const platformRaw = (body as Record<string, unknown>).platform;
    const channelRaw = (body as Record<string, unknown>).channel;

    if (!fileName) {
      throw new Error("fileName 不能为空");
    }
    if (!Number.isFinite(totalSize) || totalSize <= 0) {
      throw new Error("totalSize 非法");
    }
    if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
      throw new Error("totalChunks 非法");
    }

    const uploadId = randomUUID();
    const now = new Date().toISOString();
    const session: ChunkUploadSession = {
      id: uploadId,
      createdAt: now,
      updatedAt: now,
      target,
      fileName,
      totalSize,
      totalChunks,
      version: typeof versionRaw === "string" && versionRaw.trim() ? versionRaw.trim() : undefined,
      platform: normalizeInstallerPlatform(platformRaw) || undefined,
      channel: normalizeReleaseChannel(channelRaw) || undefined,
      received: [],
    };
    await mkdir(getChunkPartDir(uploadId), { recursive: true });
    await saveChunkSession(session);
    return c.json({ ok: true, uploadId, chunkSizeMb: Number(process.env.UPLOAD_CHUNK_SIZE_MB || 16) });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 400);
  }
});

uploadRoutes.post("/api/upload/chunk/:uploadId/part/:index", async (c) => {
  try {
    const uploadId = c.req.param("uploadId");
    const index = Number(c.req.param("index"));
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("chunk index 非法");
    }
    const session = await loadChunkSession(uploadId);
    if (index >= session.totalChunks) {
      throw new Error("chunk index 越界");
    }
    const bytes = toUint8Array(await c.req.arrayBuffer());
    if (bytes.byteLength <= 0) {
      throw new Error("chunk 不能为空");
    }
    const partPath = join(getChunkPartDir(uploadId), `${index}.part`);
    await writeFile(partPath, bytes);
    if (!session.received.includes(index)) {
      session.received.push(index);
      session.received.sort((a, b) => a - b);
    }
    session.updatedAt = new Date().toISOString();
    await saveChunkSession(session);
    return c.json({
      ok: true,
      uploadId,
      index,
      receivedChunks: session.received.length,
      totalChunks: session.totalChunks,
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 400);
  }
});

uploadRoutes.post("/api/upload/chunk/:uploadId/complete", async (c) => {
  try {
    const uploadId = c.req.param("uploadId");
    const session = await loadChunkSession(uploadId);
    if (session.received.length !== session.totalChunks) {
      throw new Error(`分片未上传完整: ${session.received.length}/${session.totalChunks}`);
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    for (let index = 0; index < session.totalChunks; index += 1) {
      const partPath = join(getChunkPartDir(uploadId), `${index}.part`);
      const partStat = await stat(partPath);
      if (!partStat.isFile() || partStat.size <= 0) {
        throw new Error(`分片缺失或无效: ${index}`);
      }
      const data = toUint8Array(await readFile(partPath));
      totalSize += data.byteLength;
      chunks.push(data);
    }
    if (totalSize !== session.totalSize) {
      throw new Error(`分片大小不匹配: 期望 ${session.totalSize}，实际 ${totalSize}`);
    }

    const bytes = toUint8Array(Buffer.concat(chunks.map((item) => Buffer.from(item))));
    if (session.target === "installer") {
      const result = await storeInstaller({
        fileName: session.fileName,
        bytes,
        version: session.version,
        platform: session.platform,
        channel: session.channel,
      });
      await cleanupChunkSession(uploadId);
      return c.json({
        ok: true,
        fileName: result.asset.name,
        size: result.asset.size,
        sha256: result.asset.sha256,
        version: result.release.version,
        platform: session.platform || null,
        channel: session.channel || "stable",
        url:
          session.channel && session.channel !== "stable"
            ? session.platform
              ? `/downloads/${session.channel}/${session.platform}`
              : `/downloads/${session.channel}`
            : session.platform
              ? `/downloads/latest/${session.platform}`
              : "/downloads/latest",
      });
    }

    if (session.target === "xiake-config") {
      const result = await storeXiakeConfig({
        fileName: session.fileName,
        bytes,
        channel: session.channel,
      });
      await cleanupChunkSession(uploadId);
      return c.json({
        ok: true,
        fileName: result.asset.name,
        size: result.asset.size,
        sha256: result.asset.sha256,
        version: result.release.version,
        channel: session.channel || "stable",
        url: `/downloads/clawos_xiake.json${channelSuffix(session.channel)}`,
      });
    }

    const result = await storeUpdaterArtifact({
      fileName: session.fileName,
      bytes,
      channel: session.channel,
    });
    await cleanupChunkSession(uploadId);
    return c.json({
      ok: true,
      fileName: result.asset.name,
      size: result.asset.size,
      sha256: result.asset.sha256,
      version: result.release.version || null,
      channel: session.channel || "stable",
      url: `/updates/${encodeURIComponent(result.asset.name)}`,
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
      channel: upload.channel || "stable",
      url: `/downloads/clawos_xiake.json${channelSuffix(upload.channel)}`,
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 400);
  }
});

uploadRoutes.post("/api/upload/electrobun-artifact", async (c) => {
  try {
    const upload = await parseUploadRequest(c, "artifact.bin");
    const result = await storeUpdaterArtifact({
      fileName: upload.fileName,
      bytes: upload.bytes,
      channel: upload.channel,
    });

    return c.json({
      ok: true,
      fileName: result.asset.name,
      size: result.asset.size,
      sha256: result.asset.sha256,
      version: result.release.version || null,
      channel: upload.channel || "stable",
      url: `/updates/${encodeURIComponent(result.asset.name)}`,
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 400);
  }
});

uploadRoutes.post("/api/upload/mcp", async (c) => {
  try {
    const upload = await parseUploadRequest(c, "mcp-package.zip");
    if (!upload.mcpId) {
      throw new Error("缺少 mcpId");
    }
    if (!upload.version) {
      throw new Error("缺少 version");
    }
    if (!upload.manifest) {
      throw new Error("缺少 manifest");
    }

    const manifest = JSON.parse(upload.manifest) as Record<string, unknown>;
    const result = await storeMcpPackage({
      mcpId: upload.mcpId,
      fileName: upload.fileName,
      bytes: upload.bytes,
      version: upload.version,
      manifest,
      channel: upload.channel,
    });

    const channel = upload.channel || "stable";
    console.info("[clawos-web] mcp.upload.ok", {
      mcpId: result.release.id,
      version: result.release.version,
      channel,
      sha256: result.asset.sha256,
      size: result.asset.size,
      fileName: result.asset.name,
    });

    return c.json({
      ok: true,
      mcpId: result.release.id,
      version: result.release.version,
      fileName: result.asset.name,
      size: result.asset.size,
      sha256: result.asset.sha256,
      channel,
      url: `/downloads/mcp/${encodeURIComponent(result.release.id)}/latest${channelSuffix(upload.channel)}`,
    });
  } catch (error) {
    const message = (error as Error).message;
    console.warn("[clawos-web] mcp.upload.failed", { error: message });
    return c.json({ ok: false, code: "MCP_UPLOAD_INVALID", error: message }, 400);
  }
});
