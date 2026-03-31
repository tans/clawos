import { Hono } from "hono";
import { extname, join, normalize } from "node:path";
import type { AppEnv } from "../types";

const FRONTEND_DIST_DIR = join(import.meta.dir, "../../frontend/dist");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function getContentType(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream";
}

function sanitizeRelativePath(input: string): string {
  return normalize(input).replace(/^([.][.][/\\])+/, "").replace(/^[/\\]+/, "");
}

async function fileExists(filePath: string): Promise<boolean> {
  return await Bun.file(filePath).exists();
}

export function createFrontendController(): Hono<AppEnv> {
  const controller = new Hono<AppEnv>();

  controller.get("/", (c) => c.redirect("/app"));

  controller.get("/app", async (c) => {
    const indexFilePath = join(FRONTEND_DIST_DIR, "index.html");
    if (!(await fileExists(indexFilePath))) {
      return c.html(
        `<h1>Team Frontend 尚未构建</h1><p>请先执行：<code>cd team/frontend && bun install && bun run build</code></p>`,
        503,
      );
    }
    return new Response(Bun.file(indexFilePath), { headers: { "content-type": "text/html; charset=utf-8" } });
  });

  controller.get("/app/*", async (c) => {
    const requested = sanitizeRelativePath(c.req.path.replace(/^\/app\/?/, ""));
    const candidate = requested ? join(FRONTEND_DIST_DIR, requested) : join(FRONTEND_DIST_DIR, "index.html");

    if (requested.startsWith("assets/") && (await fileExists(candidate))) {
      return new Response(Bun.file(candidate), { headers: { "content-type": getContentType(candidate) } });
    }

    const indexFilePath = join(FRONTEND_DIST_DIR, "index.html");
    if (await fileExists(indexFilePath)) {
      return new Response(Bun.file(indexFilePath), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    return c.html(
      `<h1>Team Frontend 尚未构建</h1><p>请先执行：<code>cd team/frontend && bun install && bun run build</code></p>`,
      503,
    );
  });

  return controller;
}
