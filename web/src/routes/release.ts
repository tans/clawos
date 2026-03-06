import { Hono } from "hono";
import { readLatestRelease } from "../lib/storage";

export const releaseRoutes = new Hono();

releaseRoutes.get("/api/releases/latest", async (c) => {
  const latest = await readLatestRelease();
  if (!latest) {
    return c.json({ ok: false, error: "暂无发布记录" }, 404);
  }

  const links: Record<string, unknown> = {
    installerLatest: "/downloads/latest",
    xiakeConfig: "/downloads/clawos_xiake.json",
    updaterBaseUrl: "/updates",
  };
  const installers: Record<string, string> = {};
  if (latest.installers?.windows) {
    links.installerWindows = "/downloads/latest/windows";
    installers.windows = "/downloads/latest/windows";
  }
  if (latest.installers?.macos) {
    links.installerMacos = "/downloads/latest/macos";
    installers.macos = "/downloads/latest/macos";
  }
  if (latest.installers?.linux) {
    links.installerLinux = "/downloads/latest/linux";
    installers.linux = "/downloads/latest/linux";
  }
  if (Object.keys(installers).length > 0) {
    links.installers = installers;
  }

  if (Array.isArray(latest.updaterAssets) && latest.updaterAssets.length > 0) {
    links.updaterAssets = latest.updaterAssets.map((asset) => `/updates/${encodeURIComponent(asset.name)}`);
  }

  return c.json({
    ok: true,
    release: latest,
    links,
  });
});
