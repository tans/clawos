import { Hono } from "hono";
import { getEnv } from "./lib/env";
import { pageRoutes } from "./routes/page";
import { releaseRoutes } from "./routes/release";
import { downloadRoutes } from "./routes/download";
import { uploadRoutes } from "./routes/upload";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "clawos-web",
    now: new Date().toISOString(),
  });
});

app.route("/", pageRoutes);
app.route("/", releaseRoutes);
app.route("/", downloadRoutes);
app.route("/", uploadRoutes);

app.notFound((c) => c.json({ ok: false, error: "Not Found" }, 404));

app.onError((error, c) => {
  console.error("[clawos-web] unhandled error", error);
  return c.json({ ok: false, error: "服务端异常" }, 500);
});

if (import.meta.main) {
  const { port } = getEnv();
  Bun.serve({
    port,
    fetch: app.fetch,
  });
  console.log(`[clawos-web] running on http://127.0.0.1:${port}`);
}

export default app;
