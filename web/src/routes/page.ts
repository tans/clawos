import { Hono } from "hono";
import { readLatestRelease } from "../lib/storage";
import { renderAgentPage } from "../views/agent";
import { renderHomePage } from "../views/home";

export const pageRoutes = new Hono();

pageRoutes.get("/", async (c) => {
  const [stableLatest, betaLatest] = await Promise.all([readLatestRelease("stable"), readLatestRelease("beta")]);
  const hasInstaller = Boolean(stableLatest?.installer);
  const latestVersion = stableLatest?.version ?? null;
  const hasBetaInstaller = Boolean(betaLatest?.installer);
  const betaVersion = betaLatest?.version ?? null;

  return c.html(renderHomePage(hasInstaller, latestVersion, hasBetaInstaller, betaVersion));
});

pageRoutes.get("/downloads", async (c) => {
  const channel = c.req.query("channel") === "beta" ? "beta" : "stable";
  const latest = await readLatestRelease(channel);
  if (!latest?.installer) {
    return c.redirect("/", 302);
  }

  return c.redirect(channel === "beta" ? "/downloads/beta" : "/downloads/latest", 302);
});

pageRoutes.get("/install-guide", (c) => {
  return c.redirect("/", 302);
});

pageRoutes.get("/to-agent", (c) => {
  return c.html(renderAgentPage());
});
