import { Hono } from "hono";
import {
  listPublishedMcpShelf,
  listPublishedProducts,
  listMcpReleaseVersions,
  listMcpReleases,
  normalizeReleaseChannel,
  readLatestRelease,
  readMcpRelease,
} from "../lib/storage";
import type { InstallerPlatform, ReleaseChannel } from "../lib/types";

export const releaseRoutes = new Hono();

function channelDownloadPath(channel: ReleaseChannel, platform?: InstallerPlatform): string {
  if (channel === "stable") {
    return platform ? `/downloads/latest/${platform}` : "/downloads/latest";
  }
  return platform ? `/downloads/${channel}/${platform}` : `/downloads/${channel}`;
}

function channelSuffix(channel: ReleaseChannel): string {
  return channel === "stable" ? "" : `?channel=${channel}`;
}

releaseRoutes.get("/api/releases/latest", async (c) => {
  const channel = normalizeReleaseChannel(c.req.query("channel") || undefined) || "stable";
  const latest = await readLatestRelease(channel);
  if (!latest) {
    return c.json({ ok: false, error: "暂无发布记录" }, 404);
  }

  const links: Record<string, unknown> = {
    installerLatest: channelDownloadPath(channel),
    xiakeConfig: `/downloads/clawos_xiake.json${channelSuffix(channel)}`,
    updaterBaseUrl: "/updates",
  };
  const installers: Record<string, string> = {};
  if (latest.installers?.windows) {
    links.installerWindows = channelDownloadPath(channel, "windows");
    installers.windows = channelDownloadPath(channel, "windows");
  }
  if (latest.installers?.macos) {
    links.installerMacos = channelDownloadPath(channel, "macos");
    installers.macos = channelDownloadPath(channel, "macos");
  }
  if (latest.installers?.linux) {
    links.installerLinux = channelDownloadPath(channel, "linux");
    installers.linux = channelDownloadPath(channel, "linux");
  }
  if (Object.keys(installers).length > 0) {
    links.installers = installers;
  }

  if (Array.isArray(latest.updaterAssets) && latest.updaterAssets.length > 0) {
    links.updaterAssets = latest.updaterAssets.map((asset) => `/updates/${encodeURIComponent(asset.name)}`);
  }

  return c.json({
    ok: true,
    channel,
    release: latest,
    links,
  });
});

releaseRoutes.get("/api/releases/:channel", async (c) => {
  const channel = normalizeReleaseChannel(c.req.param("channel"));
  if (!channel) {
    return c.json({ ok: false, error: "不支持的发布通道" }, 400);
  }
  return c.redirect(`/api/releases/latest?channel=${encodeURIComponent(channel)}`, 302);
});

releaseRoutes.get("/api/mcps", async (c) => {
  const channel = normalizeReleaseChannel(c.req.query("channel") || undefined) || "stable";
  const items = await listMcpReleases(channel);
  return c.json({
    ok: true,
    channel,
    items,
  });
});

releaseRoutes.get("/api/mcps/shelf", async (c) => {
  const channel = normalizeReleaseChannel(c.req.query("channel") || undefined) || "stable";
  const items = await listPublishedMcpShelf(channel);
  return c.json({
    ok: true,
    channel,
    items,
  });
});

releaseRoutes.get("/api/mcps/:mcpId", async (c) => {
  const channel = normalizeReleaseChannel(c.req.query("channel") || undefined) || "stable";
  const item = await readMcpRelease(c.req.param("mcpId"), channel);
  if (!item) {
    return c.json({ ok: false, error: "MCP 不存在" }, 404);
  }
  return c.json({
    ok: true,
    channel,
    item,
  });
});

releaseRoutes.get("/api/mcps/:mcpId/versions", async (c) => {
  const channel = normalizeReleaseChannel(c.req.query("channel") || undefined) || "stable";
  const mcpId = c.req.param("mcpId");
  const versions = await listMcpReleaseVersions(mcpId, channel);
  if (versions.length === 0) {
    return c.json({ ok: false, error: "MCP 不存在" }, 404);
  }

  return c.json({
    ok: true,
    channel,
    mcpId,
    items: versions.map((item) => ({
      ...item,
      downloadUrl: `/downloads/mcp/${encodeURIComponent(item.id)}/${encodeURIComponent(item.version)}${channelSuffix(channel)}`,
    })),
  });
});

releaseRoutes.get("/api/products", async (c) => {
  const items = await listPublishedProducts();
  return c.json({
    ok: true,
    items,
  });
});
