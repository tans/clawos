import { Hono } from "hono";
import { readLatestRelease } from "../lib/storage";
import { renderAgentPage } from "../views/agent";
import { renderHomePage } from "../views/home";

export const pageRoutes = new Hono();

pageRoutes.get("/", async (c) => {
  const [stableLatest, betaLatest, alphaLatest] = await Promise.all([
    readLatestRelease("stable"),
    readLatestRelease("beta"),
    readLatestRelease("alpha"),
  ]);
  const hasInstaller = Boolean(stableLatest?.installer);
  const latestVersion = stableLatest?.version ?? null;
  const hasBetaInstaller = Boolean(betaLatest?.installer);
  const betaVersion = betaLatest?.version ?? null;
  const hasAlphaInstaller = Boolean(alphaLatest?.installer);
  const alphaVersion = alphaLatest?.version ?? null;

  return c.html(renderHomePage(hasInstaller, latestVersion, hasBetaInstaller, betaVersion, hasAlphaInstaller, alphaVersion));
});

pageRoutes.get("/downloads", async (c) => {
  const channelQuery = c.req.query("channel");
  const channel = channelQuery === "alpha" ? "alpha" : channelQuery === "beta" ? "beta" : "stable";
  const latest = await readLatestRelease(channel);
  if (!latest?.installer) {
    return c.redirect("/", 302);
  }

  const target = channel === "beta" ? "/downloads/beta" : channel === "alpha" ? "/downloads/alpha" : "/downloads/latest";
  return c.redirect(target, 302);
});

pageRoutes.get("/install-guide", (c) => {
  return c.redirect("/", 302);
});

pageRoutes.get("/to-agent", (c) => {
  return c.html(renderAgentPage());
});
