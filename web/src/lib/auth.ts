import type { Context, Next } from "hono";
import { getEnv } from "./env";

export function parseBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const trimmed = authorization.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = trimmed.slice(7).trim();
  return token || null;
}

export async function requireUploadAuth(c: Context, next: Next): Promise<Response | void> {
  const env = getEnv();
  if (!env.uploadToken) {
    return c.json({ ok: false, error: "服务端未配置 UPLOAD_TOKEN" }, 503);
  }

  const token = parseBearerToken(c.req.header("authorization"));
  if (!token || token !== env.uploadToken) {
    return c.json({ ok: false, error: "上传鉴权失败" }, 401);
  }

  await next();
}
