import { Hono, type Context } from "hono";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { requireUploadAuth } from "../lib/auth";
import { getEnv } from "../lib/env";
import {
  normalizeReleaseChannel,
  storeMcpPackage,
} from "../lib/storage";
import type { ReleaseChannel } from "../lib/types";

export const uploadRoutes = new Hono();

uploadRoutes.use("/api/upload/*", requireUploadAuth);

function firstValue<T>(value: T | T[] | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function channelSuffix(channel: ReleaseChannel | undefined): string {
  return channel && channel !== "stable" ? `?channel=${channel}` : "";
}

// ---------------------------------------------------------------------------
// MCP Package Upload (kept)
// ---------------------------------------------------------------------------

uploadRoutes.post("/api/upload/mcp", async (c) => {
  try {
    const contentType = c.req.header("content-type") || "";
    let mcpId: string | undefined;
    let version: string | undefined;
    let manifest: string | undefined;
    let bytes: Uint8Array;

    if (contentType.includes("multipart/form-data")) {
      const body = await c.req.parseBody();
      const fileField = firstValue(body.file);
      if (!(fileField instanceof File)) throw new Error("缺少 file 文件字段");
      mcpId = typeof firstValue(body.mcpId) === "string" ? (firstValue(body.mcpId) as string).trim() : undefined;
      version = typeof firstValue(body.version) === "string" ? (firstValue(body.version) as string).trim() : undefined;
      manifest = typeof firstValue(body.manifest) === "string" ? (firstValue(body.manifest) as string).trim() : undefined;
      bytes = new Uint8Array(await fileField.arrayBuffer());
    } else {
      mcpId = c.req.header("x-mcp-id") || c.req.query("mcpId") || undefined;
      version = c.req.header("x-version") || c.req.query("version") || undefined;
      manifest = c.req.header("x-mcp-manifest") || undefined;
      bytes = new Uint8Array(await c.req.arrayBuffer());
    }

    if (!mcpId) throw new Error("缺少 mcpId");
    if (!version) throw new Error("缺少 version");
    if (!manifest) throw new Error("缺少 manifest");

    const channel = normalizeReleaseChannel(c.req.header("x-channel") || c.req.query("channel") || undefined) || "stable";
    const manifestParsed = JSON.parse(manifest) as Record<string, unknown>;
    const result = await storeMcpPackage({
      mcpId,
      fileName: mcpId,
      bytes,
      version,
      manifest: manifestParsed,
      channel,
    });

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
      url: `/downloads/mcp/${encodeURIComponent(result.release.id)}/latest${channelSuffix(channel)}`,
    });
  } catch (error) {
    const message = (error as Error).message;
    console.warn("[clawos-web] mcp.upload.failed", { error: message });
    return c.json({ ok: false, code: "MCP_UPLOAD_INVALID", error: message }, 400);
  }
});
