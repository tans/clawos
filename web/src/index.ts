import { Hono } from "hono";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { resolve } from "node:path";
import { getEnv, validateStartupEnv } from "./lib/env";
import { pageRoutes } from "./routes/page";
import { releaseRoutes } from "./routes/release";
import { downloadRoutes } from "./routes/download";
import { uploadRoutes } from "./routes/upload";

export const app = new Hono();
const cssFilePath = resolve(process.cwd(), "dist", "output.css");
const publicDirPath = resolve(process.cwd(), "public");

app.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "clawos-web",
    now: new Date().toISOString(),
  });
});

app.get("/styles.css", async (c) => {
  try {
    await access(cssFilePath, fsConstants.R_OK);
  } catch {
    return c.text(
      "styles.css not found. Run `bun run tailwind:build` in web directory.",
      503,
    );
  }

  return new Response(Bun.file(cssFilePath), {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
});


app.get("/public/*", async (c) => {
  const rawPath = c.req.path.slice("/public/".length);
  const normalized = rawPath.replaceAll("\\", "/").replace(/^\/+/, "");

  if (!normalized || normalized.includes("..")) {
    return c.text("Not Found", 404);
  }

  const filePath = resolve(publicDirPath, normalized);
  if (!filePath.startsWith(publicDirPath + "/")) {
    return c.text("Not Found", 404);
  }

  try {
    await access(filePath, fsConstants.R_OK);
  } catch {
    return c.text("Not Found", 404);
  }

  const file = Bun.file(filePath);
  return new Response(file, {
    headers: {
      "content-type": file.type || "application/octet-stream",
      "cache-control": "public, max-age=3600",
    },
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
  const env = getEnv();
  const checks = validateStartupEnv(env);

  if (checks.length === 0) {
    console.log("[clawos-web] 环境变量检查通过。");
  } else {
    for (const check of checks) {
      const prefix = check.level === "error" ? "[ERROR]" : "[WARN]";
      console.log(`[clawos-web] ${prefix} ${check.message}`);
    }
  }

  try {
    Bun.serve({
      port: env.port,
      fetch: app.fetch,
    });
    console.log(`[clawos-web] running on http://127.0.0.1:${env.port}`);
    console.log(`[clawos-web] storage dir: ${env.storageDir}`);
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "EADDRINUSE") {
      console.error(
        `[clawos-web] [ERROR] 端口 ${env.port} 已被占用，请修改 PORT 或先释放该端口。`,
      );
    } else {
      console.error(
        `[clawos-web] [ERROR] 服务启动失败：${err.message ?? "未知错误"}`,
      );
    }
    process.exit(1);
  }
}
