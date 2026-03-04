import type { Context } from "hono";

export function jsonError(c: Context, status: number, code: string, message: string, hint?: string) {
  return c.json(
    {
      ok: false,
      error: {
        code,
        message,
        hint: hint || null,
      },
    },
    status as 400
  );
}

export async function readJsonBody(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const body = (await c.req.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readFormText(data: Record<string, string | File | (string | File)[]>, key: string): string {
  const raw = data[key];
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    return raw[0].trim();
  }
  return "";
}

export function readBearerToken(c: Context): string {
  const auth = c.req.header("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return "";
  }
  return auth.slice("Bearer ".length).trim();
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
