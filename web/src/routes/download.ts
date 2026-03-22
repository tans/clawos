import { Hono } from "hono";
import {
  listMcpReleases,
  normalizeInstallerPlatform,
  normalizeReleaseChannel,
  resolveLatestInstaller,
  resolveLatestMcpPackage,
  resolveLatestXiakeConfig,
  resolveUpdaterArtifact,
} from "../lib/storage";
import type { ReleaseChannel } from "../lib/types";

export const downloadRoutes = new Hono();

function resolveChannelFromRequest(raw: string | undefined, fallback: ReleaseChannel = "stable"): ReleaseChannel {
  return normalizeReleaseChannel(raw) || fallback;
}

function contentDisposition(fileName: string): string {
  return `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function resolveUpdaterContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  if (lower.endsWith(".patch")) {
    return "application/octet-stream";
  }
  if (lower.endsWith(".zst")) {
    return "application/zstd";
  }
  return "application/octet-stream";
}

downloadRoutes.get("/downloads/latest", async (c) => {
  try {
    const channel = resolveChannelFromRequest(c.req.query("channel"));
    const platform = normalizeInstallerPlatform(c.req.query("platform") || undefined) || undefined;
    const { absolutePath, asset } = await resolveLatestInstaller(platform, channel);
    return new Response(Bun.file(absolutePath), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": contentDisposition(asset.name),
        "x-file-sha256": asset.sha256,
        "x-release-channel": channel,
      },
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 404);
  }
});

downloadRoutes.get("/downloads/latest/:platform", async (c) => {
  try {
    const channel = resolveChannelFromRequest(c.req.query("channel"));
    const platform = normalizeInstallerPlatform(c.req.param("platform"));
    if (!platform) {
      return c.json({ ok: false, error: "不支持的平台" }, 400);
    }
    const { absolutePath, asset } = await resolveLatestInstaller(platform, channel);
    return new Response(Bun.file(absolutePath), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": contentDisposition(asset.name),
        "x-file-sha256": asset.sha256,
        "x-installer-platform": platform,
        "x-release-channel": channel,
      },
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 404);
  }
});

downloadRoutes.get("/downloads/clawos_xiake.json", async (c) => {
  try {
    const channel = resolveChannelFromRequest(c.req.query("channel"));
    const { absolutePath, asset } = await resolveLatestXiakeConfig(channel);
    return new Response(Bun.file(absolutePath), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": contentDisposition("clawos_xiake.json"),
        "x-file-sha256": asset.sha256,
        "x-release-channel": channel,
      },
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 404);
  }
});

downloadRoutes.get("/downloads/beta", async (c) => {
  try {
    const platform = normalizeInstallerPlatform(c.req.query("platform") || undefined) || undefined;
    const { absolutePath, asset } = await resolveLatestInstaller(platform, "beta");
    return new Response(Bun.file(absolutePath), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": contentDisposition(asset.name),
        "x-file-sha256": asset.sha256,
        "x-release-channel": "beta",
      },
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 404);
  }
});

downloadRoutes.get("/downloads/beta/:platform", async (c) => {
  try {
    const platform = normalizeInstallerPlatform(c.req.param("platform"));
    if (!platform) {
      return c.json({ ok: false, error: "不支持的平台" }, 400);
    }
    const { absolutePath, asset } = await resolveLatestInstaller(platform, "beta");
    return new Response(Bun.file(absolutePath), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": contentDisposition(asset.name),
        "x-file-sha256": asset.sha256,
        "x-installer-platform": platform,
        "x-release-channel": "beta",
      },
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 404);
  }
});

downloadRoutes.get("/updates/:fileName", async (c) => {
  try {
    const fileName = c.req.param("fileName");
    const { absolutePath, asset } = await resolveUpdaterArtifact(fileName);
    return new Response(Bun.file(absolutePath), {
      headers: {
        "content-type": resolveUpdaterContentType(asset.name),
        "cache-control": "public, max-age=60",
      },
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 404);
  }
});

downloadRoutes.get("/downloads/mcp", async (c) => {
  const channel = resolveChannelFromRequest(c.req.query("channel"));
  const items = await listMcpReleases(channel);
  return c.json({
    ok: true,
    channel,
    items: items.map((item) => ({
      id: item.id,
      version: item.version,
      publishedAt: item.publishedAt,
      package: item.package,
      manifest: item.manifest,
      downloadUrl: `/downloads/mcp/${encodeURIComponent(item.id)}/latest${channel === "beta" ? "?channel=beta" : ""}`,
    })),
  });
});

downloadRoutes.get("/downloads/mcp/:mcpId/latest", async (c) => {
  try {
    const channel = resolveChannelFromRequest(c.req.query("channel"));
    const { release, asset, absolutePath } = await resolveLatestMcpPackage(c.req.param("mcpId"), channel);
    return new Response(Bun.file(absolutePath), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": contentDisposition(asset.name),
        "x-file-sha256": asset.sha256,
        "x-release-channel": channel,
        "x-mcp-id": release.id,
        "x-mcp-version": release.version,
      },
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 404);
  }
});
