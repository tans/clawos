import { Hono } from "hono";
import { normalizeReleaseChannel, readLatestRelease } from "../lib/storage";

export const releaseRoutes = new Hono();

releaseRoutes.get("/api/releases/latest", async (c) => {
  const channel = normalizeReleaseChannel(c.req.query("channel") || undefined) || "stable";
  const latest = await readLatestRelease(channel);
  if (!latest) {
    return c.json({ ok: false, error: "暂无发布记录" }, 404);
  }

  const links: Record<string, unknown> = {
    installerLatest: channel === "beta" ? "/downloads/beta" : "/downloads/latest",
    xiakeConfig: channel === "beta" ? "/downloads/clawos_xiake.json?channel=beta" : "/downloads/clawos_xiake.json",
    updaterBaseUrl: "/updates",
  };
  const installers: Record<string, string> = {};
  if (latest.installers?.windows) {
    links.installerWindows = channel === "beta" ? "/downloads/beta/windows" : "/downloads/latest/windows";
    installers.windows = channel === "beta" ? "/downloads/beta/windows" : "/downloads/latest/windows";
  }
  if (latest.installers?.macos) {
    links.installerMacos = channel === "beta" ? "/downloads/beta/macos" : "/downloads/latest/macos";
    installers.macos = channel === "beta" ? "/downloads/beta/macos" : "/downloads/latest/macos";
  }
  if (latest.installers?.linux) {
    links.installerLinux = channel === "beta" ? "/downloads/beta/linux" : "/downloads/latest/linux";
    installers.linux = channel === "beta" ? "/downloads/beta/linux" : "/downloads/latest/linux";
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
