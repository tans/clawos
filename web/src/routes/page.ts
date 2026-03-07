import { Hono } from "hono";
import { readLatestRelease } from "../lib/storage";
import { renderAgentPage } from "../views/agent";
import { renderHomePage } from "../views/home";
import { renderInstallGuidePage } from "../views/install-guide";

export const pageRoutes = new Hono();

pageRoutes.get("/", async (c) => {
  const latest = await readLatestRelease();
  const hasInstaller = Boolean(latest?.installer);
  const latestVersion = latest?.version ?? null;

  return c.html(renderHomePage(hasInstaller, latestVersion));
});

pageRoutes.get("/downloads", async (c) => {
  const latest = await readLatestRelease();
  if (!latest?.installer) {
    return c.redirect("/", 302);
  }

  return c.redirect("/downloads/latest", 302);
});

pageRoutes.get("/install-guide", (c) => {
  return c.html(renderInstallGuidePage());
});

pageRoutes.get("/to-agent", (c) => {
  return c.html(renderAgentPage());
});
