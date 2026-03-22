import type { Context, Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createHash, timingSafeEqual } from "node:crypto";
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

export const ADMIN_SESSION_COOKIE = "clawos_admin_session";

function toSessionToken(username: string, password: string): string {
  return createHash("sha256").update(`${username}\n${password}`).digest("hex");
}

function safeEqualString(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function canUseAdminLogin(): boolean {
  const env = getEnv();
  return Boolean(env.adminUsername && env.adminPassword);
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const env = getEnv();
  if (!env.adminUsername || !env.adminPassword) {
    return false;
  }
  return safeEqualString(username, env.adminUsername) && safeEqualString(password, env.adminPassword);
}

export function hasAdminSession(c: Context): boolean {
  const env = getEnv();
  if (!env.adminUsername || !env.adminPassword) {
    return false;
  }
  const expected = toSessionToken(env.adminUsername, env.adminPassword);
  const actual = getCookie(c, ADMIN_SESSION_COOKIE) || "";
  return safeEqualString(actual, expected);
}

export function setAdminSession(c: Context): void {
  const env = getEnv();
  if (!env.adminUsername || !env.adminPassword) {
    return;
  }
  const token = toSessionToken(env.adminUsername, env.adminPassword);
  setCookie(c, ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
    path: "/admin",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAdminSession(c: Context): void {
  deleteCookie(c, ADMIN_SESSION_COOKIE, { path: "/admin" });
}

export async function requireAdminAuth(c: Context, next: Next): Promise<Response | void> {
  if (!hasAdminSession(c)) {
    return c.redirect("/admin/login", 302);
  }
  await next();
}
