import { Hono } from "hono";
import { constants as fsConstants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { getEnv, validateStartupEnv } from "./lib/env";
import { adminRoutes } from "./routes/admin";
import { downloadRoutes } from "./routes/download";
import { pageRoutes } from "./routes/page";
import { releaseRoutes } from "./routes/release";
import { remoteRoutes } from "./routes/remote";
import { uploadRoutes } from "./routes/upload";

export const app = new Hono();
const runtimeRoot = resolve(process.env.CLAWOS_WEB_ROOT ?? process.cwd());
const cssFilePath = resolve(runtimeRoot, "dist", "output.css");
const publicDirPath = resolve(runtimeRoot, "public");

function isPathInside(parentPath: string, childPath: string) {
  const relativePath = relative(parentPath, childPath);
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !relativePath.includes(":")
  );
}

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
  if (!isPathInside(publicDirPath, filePath)) {
    return c.text("Not Found", 404);
  }

  try {
    await access(filePath, fsConstants.R_OK);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return c.text("Not Found", 404);
    }
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
app.route("/", adminRoutes);
app.route("/", remoteRoutes);

app.use("/*", async (c, next) => {
  const normalized = c.req.path.slice(1).replaceAll("\\", "/").replace(/^\/+/, "");

  if (!normalized || normalized.includes("..")) {
    return next();
  }

  const filePath = resolve(publicDirPath, normalized);
  if (!isPathInside(publicDirPath, filePath)) {
    return next();
  }

  try {
    await access(filePath, fsConstants.R_OK);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return next();
    }
  } catch {
    return next();
  }

  const file = Bun.file(filePath);
  return new Response(file, {
    headers: {
      "content-type": file.type || "application/octet-stream",
      "cache-control": "public, max-age=3600",
    },
  });
});

app.notFound((c) => c.json({ ok: false, error: "Not Found" }, 404));

app.onError((error, c) => {
  console.error("[clawos-web] unhandled error", error);
  return c.json({ ok: false, error: "服务器异常" }, 500);
});

if (import.meta.main) {
  const env = getEnv();
  const checks = validateStartupEnv(env);

  if (checks.length === 0) {
    console.log("[clawos-web] 鐜鍙橀噺妫€鏌ラ€氳繃銆?");
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
        `[clawos-web] [ERROR] 绔彛 ${env.port} 宸茶鍗犵敤锛岃淇敼 PORT 鎴栧厛閲婃斁璇ョ鍙ｃ€俙`,
      );
    } else {
      console.error(
        `[clawos-web] [ERROR] 鏈嶅姟鍚姩澶辫触锛?${err.message ?? "鏈煡閿欒"}`,
      );
    }
    process.exit(1);
  }
}
