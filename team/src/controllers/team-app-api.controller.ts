import { Hono, type Context, type Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { existsCompanySlug } from "../models/company.model";
import {
  clearExpiredTeamAppAdminSessions,
  createCompanyForTeamAdminOwner,
  createTeamAppAdminSession,
  createTeamAppAdminUser,
  deleteTeamAppAdminSession,
  getTeamAppAdminCredentialByEmail,
  getTeamAppAdminUserByEmail,
  getTeamAppAdminUserBySessionToken,
  listOwnedCompaniesByTeamAdminUserId,
  TeamAppAuthModelError,
} from "../models/team-app-auth.model";
import type { AppEnv, TeamAppAdminUserRow } from "../types";
import { normalizeCompanyName, normalizeCompanySlug } from "../utils/validators";

const TEAM_ADMIN_SESSION_COOKIE = "clawos_team_admin_session";
const TEAM_ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

function normalizePassword(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  return raw;
}

async function readJsonObject(c: Context<AppEnv>): Promise<Record<string, unknown> | null> {
  try {
    const body = await c.req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clearTeamAdminSession(c: Context<AppEnv>): void {
  const token = getCookie(c, TEAM_ADMIN_SESSION_COOKIE) || "";
  if (token) {
    deleteTeamAppAdminSession(token);
  }
  deleteCookie(c, TEAM_ADMIN_SESSION_COOKIE, { path: "/" });
}

function setTeamAdminSession(c: Context<AppEnv>, userId: number): void {
  const expiresAt = Date.now() + TEAM_ADMIN_SESSION_TTL_MS;
  const token = createTeamAppAdminSession(userId, expiresAt);
  setCookie(c, TEAM_ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(TEAM_ADMIN_SESSION_TTL_MS / 1000),
  });
}

function toSessionSummary(user: TeamAppAdminUserRow) {
  return {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
    },
    companies: listOwnedCompaniesByTeamAdminUserId(user.id).map((company) => ({
      id: company.id,
      name: company.name,
      slug: company.slug,
      mode: company.mode,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    })),
  };
}

function unauthenticatedSummary() {
  return {
    authenticated: false,
    user: null,
    companies: [],
  };
}

async function readTeamAdminUserByCookie(c: Context<AppEnv>): Promise<TeamAppAdminUserRow | null> {
  clearExpiredTeamAppAdminSessions();
  const token = getCookie(c, TEAM_ADMIN_SESSION_COOKIE) || "";
  if (!token) {
    return null;
  }
  return getTeamAppAdminUserBySessionToken(token);
}

async function requireTeamAdminAuth(c: Context<AppEnv>, next: Next) {
  const user = await readTeamAdminUserByCookie(c);
  if (!user) {
    return c.json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }
  c.set("teamAdminUser", user);
  await next();
}

export function createTeamAppApiController(): Hono<AppEnv> {
  const controller = new Hono<AppEnv>();

  controller.use("/api/team/app/companies", requireTeamAdminAuth);
  controller.use("/api/team/app/companies/*", requireTeamAdminAuth);

  controller.post("/api/team/app/register", async (c) => {
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ ok: false, error: "INVALID_BODY" }, 400);
    }

    const email = normalizeEmail(body.email);
    const password = normalizePassword(body.password);
    const confirmPassword = normalizePassword(body.confirmPassword);
    if (!email) {
      return c.json({ ok: false, error: "INVALID_EMAIL" }, 400);
    }
    if (!password || !password.trim() || password.length < 8) {
      return c.json({ ok: false, error: "INVALID_PASSWORD" }, 400);
    }
    if (password !== confirmPassword) {
      return c.json({ ok: false, error: "PASSWORD_MISMATCH" }, 400);
    }
    if (getTeamAppAdminUserByEmail(email)) {
      return c.json({ ok: false, error: "EMAIL_EXISTS" }, 409);
    }

    const passwordHash = await Bun.password.hash(password);
    let user: TeamAppAdminUserRow;
    try {
      user = createTeamAppAdminUser(email, passwordHash);
    } catch (error) {
      if (error instanceof TeamAppAuthModelError && error.code === "EMAIL_EXISTS") {
        return c.json({ ok: false, error: "EMAIL_EXISTS" }, 409);
      }
      throw error;
    }
    setTeamAdminSession(c, user.id);
    return c.json(toSessionSummary(user), 201);
  });

  controller.post("/api/team/app/login", async (c) => {
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ ok: false, error: "INVALID_BODY" }, 400);
    }

    const email = normalizeEmail(body.email);
    const password = normalizePassword(body.password);
    if (!email || !password) {
      return c.json({ ok: false, error: "INVALID_CREDENTIALS" }, 400);
    }

    const credential = getTeamAppAdminCredentialByEmail(email);
    if (!credential) {
      return c.json({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
    }
    const ok = await Bun.password.verify(password, credential.passwordHash);
    if (!ok) {
      return c.json({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
    }

    const user = getTeamAppAdminUserByEmail(email);
    if (!user) {
      return c.json({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
    }

    setTeamAdminSession(c, user.id);
    return c.json(toSessionSummary(user));
  });

  controller.post("/api/team/app/logout", async (c) => {
    clearTeamAdminSession(c);
    return c.json({ ok: true });
  });

  controller.get("/api/team/app/session", async (c) => {
    const user = await readTeamAdminUserByCookie(c);
    if (!user) {
      return c.json(unauthenticatedSummary());
    }
    return c.json(toSessionSummary(user));
  });

  controller.post("/api/team/app/companies", async (c) => {
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ ok: false, error: "INVALID_BODY" }, 400);
    }

    const name = normalizeCompanyName(body.name);
    const slug = normalizeCompanySlug(body.slug);
    const mode = body.mode === "standard" ? "standard" : "unmanned";
    if (!name || !slug) {
      return c.json({ ok: false, error: "INVALID_COMPANY" }, 400);
    }
    if (existsCompanySlug(slug)) {
      return c.json({ ok: false, error: "SLUG_EXISTS" }, 409);
    }

    const user = c.get("teamAdminUser");
    let company;
    try {
      company = createCompanyForTeamAdminOwner({
        teamAdminUserId: user.id,
        name,
        slug,
        mode,
      });
    } catch (error) {
      if (error instanceof TeamAppAuthModelError && error.code === "SLUG_EXISTS") {
        return c.json({ ok: false, error: "SLUG_EXISTS" }, 409);
      }
      throw error;
    }

    return c.json(
      {
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
          mode: company.mode,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
        },
      },
      201
    );
  });

  controller.get("/api/team/app/companies/me", (c) => {
    const user = c.get("teamAdminUser");
    const companies = listOwnedCompaniesByTeamAdminUserId(user.id).map((company) => ({
      id: company.id,
      name: company.name,
      slug: company.slug,
      mode: company.mode,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    }));
    return c.json({ companies });
  });

  return controller;
}
