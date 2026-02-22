import { Hono } from "hono";
import { readLatestRelease } from "../lib/storage";

export const releaseRoutes = new Hono();

releaseRoutes.get("/api/releases/latest", async (c) => {
  const latest = await readLatestRelease();
  if (!latest) {
    return c.json({ ok: false, error: "暂无发布记录" }, 404);
  }

  return c.json({
    ok: true,
    release: latest,
    links: {
      installerLatest: "/downloads/latest",
      xiakeConfig: "/downloads/clawos_xiake.json",
      downloadPage: "/downloads",
    },
  });
});
