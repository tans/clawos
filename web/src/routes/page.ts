import { Hono } from "hono";
import { readLatestRelease } from "../lib/storage";
import { renderAgentPage } from "../views/agent";
import { renderCeoLetterPage } from "../views/ceo-letter";
import { renderContactPage } from "../views/contact";
import { buildDownloadCards, renderDownloadsPage } from "../views/downloads";
import { renderHomePage } from "../views/home";

export const pageRoutes = new Hono();

pageRoutes.get("/", (c) => {
  return c.html(renderHomePage());
});

pageRoutes.get("/downloads", async (c) => {
  const [stableLatest, betaLatest, alphaLatest] = await Promise.all([
    readLatestRelease("stable"),
    readLatestRelease("beta"),
    readLatestRelease("alpha"),
  ]);

  const cards = buildDownloadCards({
    stableVersion: stableLatest?.version ?? null,
    stablePublishedAt: stableLatest?.publishedAt ?? null,
    hasStableInstaller: Boolean(stableLatest?.installer),
    betaVersion: betaLatest?.version ?? null,
    betaPublishedAt: betaLatest?.publishedAt ?? null,
    hasBetaInstaller: Boolean(betaLatest?.installer),
    alphaVersion: alphaLatest?.version ?? null,
    alphaPublishedAt: alphaLatest?.publishedAt ?? null,
    hasAlphaInstaller: Boolean(alphaLatest?.installer),
  });

  return c.html(renderDownloadsPage(cards));
});

pageRoutes.get("/install-guide", (c) => {
  return c.redirect("/", 302);
});

pageRoutes.get("/to-agent", (c) => {
  return c.html(renderAgentPage());
});

pageRoutes.get("/ceo-letter", (c) => {
  return c.html(renderCeoLetterPage());
});

pageRoutes.get("/contact", (c) => {
  return c.html(renderContactPage());
});
