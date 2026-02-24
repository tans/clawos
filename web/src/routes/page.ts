import { Hono } from "hono";
import { readLatestRelease } from "../lib/storage";
import { renderHomePage } from "../views/home";

export const pageRoutes = new Hono();

pageRoutes.get("/", async (c) => {
  const latest = await readLatestRelease();
  const hasInstaller = Boolean(latest?.installer);

  return c.html(renderHomePage(hasInstaller));
});

pageRoutes.get("/downloads", async (c) => {
  const latest = await readLatestRelease();
  if (!latest?.installer) {
    return c.redirect("/", 302);
  }

  return c.redirect("/downloads/latest", 302);
});
