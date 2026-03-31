import { Hono, type Context, type Next } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import { db } from "../db";
import { getCompanyById } from "../models/company.model";
import { clearExpiredTeamAppAdminSessions, getTeamAppAdminUserBySessionToken } from "../models/team-app-auth.model";
import {
  createInviteLink,
  createTeamProfile,
  getGatewayAgentByExternalId,
  listGatewayAgents,
  replaceGatewayAgents,
  saveBrandProfile,
  saveGatewayConfig,
} from "../models/team-v1.model";
import { syncGatewayAgents, testGatewayConnection } from "../services/team-runtime.service";

const TEAM_ADMIN_SESSION_COOKIE = "clawos_team_admin_session";

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

function requireNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function requireCompanyAdmin(c: Context<AppEnv>, next: Next) {
  clearExpiredTeamAppAdminSessions();
  const token = getCookie(c, TEAM_ADMIN_SESSION_COOKIE) || "";
  if (!token) {
    return c.json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }
  const user = getTeamAppAdminUserBySessionToken(token);
  if (!user) {
    return c.json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  const companyId = c.req.param("companyId");
  const company = getCompanyById(companyId);
  if (!company) {
    return c.json({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);
  }
  const membership = db
    .query(
      `SELECT role
       FROM team_app_company_memberships
       WHERE company_id = ? AND team_admin_user_id = ?
       LIMIT 1`
    )
    .get(companyId, user.id) as { role: string } | null;
  if (!membership || membership.role !== "owner") {
    return c.json({ ok: false, error: "FORBIDDEN" }, 403);
  }

  c.set("teamAdminUser", user);
  await next();
}

export function createTeamAdminApiController(): Hono<AppEnv> {
  const controller = new Hono<AppEnv>();

  controller.use("/api/team/admin/companies/:companyId/*", requireCompanyAdmin);

  controller.put("/api/team/admin/companies/:companyId/brand", async (c) => {
    const companyId = c.req.param("companyId");
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ ok: false, error: "INVALID_BODY" }, 400);
    }
    const brandName = requireNonEmptyString(body.brandName);
    const themeColor = requireNonEmptyString(body.themeColor);
    const welcomeText = requireNonEmptyString(body.welcomeText);
    if (!brandName || !themeColor || !welcomeText) {
      return c.json({ ok: false, error: "INVALID_BRAND" }, 400);
    }
    let logoUrl: string | null = null;
    if (body.logoUrl !== undefined && body.logoUrl !== null) {
      if (typeof body.logoUrl !== "string") {
        return c.json({ ok: false, error: "INVALID_BRAND" }, 400);
      }
      const trimmed = body.logoUrl.trim();
      logoUrl = trimmed.length ? trimmed : null;
    }
    saveBrandProfile({
      companyId,
      brandName,
      logoUrl,
      themeColor,
      welcomeText,
    });
    return c.json({ ok: true });
  });

  controller.post("/api/team/admin/companies/:companyId/gateway/test", async (c) => {
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ ok: false, error: "INVALID_BODY" }, 400);
    }
    const baseUrl = requireNonEmptyString(body.baseUrl);
    if (!baseUrl) {
      return c.json({ ok: false, error: "INVALID_BASE_URL" }, 400);
    }
    if (body.apiKey !== undefined && body.apiKey !== null && typeof body.apiKey !== "string") {
      return c.json({ ok: false, error: "INVALID_API_KEY" }, 400);
    }
    const result = await testGatewayConnection({
      baseUrl,
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
    });
    return c.json(result, result.ok ? 200 : 400);
  });

  controller.put("/api/team/admin/companies/:companyId/gateway/config", async (c) => {
    const companyId = c.req.param("companyId");
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ ok: false, error: "INVALID_BODY" }, 400);
    }
    const baseUrl = requireNonEmptyString(body.baseUrl);
    if (!baseUrl || !baseUrl.startsWith("http")) {
      return c.json({ ok: false, error: "INVALID_BASE_URL" }, 400);
    }
    if (body.apiKey !== undefined && body.apiKey !== null && typeof body.apiKey !== "string") {
      return c.json({ ok: false, error: "INVALID_API_KEY" }, 400);
    }
    saveGatewayConfig({
      companyId,
      baseUrl,
      apiKey: typeof body.apiKey === "string" ? body.apiKey : null,
    });
    return c.json({ ok: true });
  });

  controller.post("/api/team/admin/companies/:companyId/gateway/agents/sync", async (c) => {
    const companyId = c.req.param("companyId");
    const agents = await syncGatewayAgents(companyId);
    replaceGatewayAgents(companyId, agents);
    const currentIds = new Set(agents.map((agent) => agent.externalAgentId));
    const persisted = listGatewayAgents(companyId)
      .filter((agent) => currentIds.has(agent.externalAgentId))
      .map((agent) => ({
        id: agent.id,
        companyId: agent.companyId,
        externalAgentId: agent.externalAgentId,
        name: agent.name,
        description: agent.description,
        status: agent.status,
        isEnabled: agent.isEnabled === 1,
      }));
    return c.json({ agents: persisted });
  });

  controller.post("/api/team/admin/companies/:companyId/teams", async (c) => {
    const companyId = c.req.param("companyId");
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ ok: false, error: "INVALID_BODY" }, 400);
    }
    const name = requireNonEmptyString(body.name);
    if (!name) {
      return c.json({ ok: false, error: "INVALID_TEAM_NAME" }, 400);
    }
    const primaryAgentId = requireNonEmptyString(body.primaryAgentId);
    if (!primaryAgentId) {
      return c.json({ ok: false, error: "INVALID_PRIMARY_AGENT" }, 400);
    }
    if (
      body.description !== undefined &&
      body.description !== null &&
      typeof body.description !== "string"
    ) {
      return c.json({ ok: false, error: "INVALID_DESCRIPTION" }, 400);
    }
    const agent = getGatewayAgentByExternalId(companyId, primaryAgentId);
    if (!agent || agent.isEnabled !== 1) {
      return c.json({ ok: false, error: "PRIMARY_AGENT_NOT_FOUND" }, 400);
    }
    const team = createTeamProfile({
      companyId,
      name,
      description: body.description ?? null,
      primaryAgentId,
    });
    return c.json({ team }, 201);
  });

  controller.post("/api/team/admin/companies/:companyId/invites", async (c) => {
    const companyId = c.req.param("companyId");
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ ok: false, error: "INVALID_BODY" }, 400);
    }
    const usageLimitRaw = body.usageLimit;
    let usageLimit: number | null = null;
    if (usageLimitRaw !== undefined && usageLimitRaw !== null && usageLimitRaw !== "") {
      const parsed = Number(usageLimitRaw);
      if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
        return c.json({ ok: false, error: "INVALID_USAGE_LIMIT" }, 400);
      }
      usageLimit = Math.floor(parsed);
    }

    const expiresRaw = body.expiresInHours;
    let expiresInHours = 24;
    if (expiresRaw !== undefined && expiresRaw !== null && expiresRaw !== "") {
      const parsed = Number(expiresRaw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return c.json({ ok: false, error: "INVALID_EXPIRY" }, 400);
      }
      expiresInHours = parsed;
    }

    const user = c.get("teamAdminUser");
    const invite = createInviteLink({
      companyId,
      createdBy: `team-admin:${user.email}`,
      usageLimit,
      expiresAt: Date.now() + expiresInHours * 60 * 60 * 1000,
    });
    return c.json({ invite }, 201);
  });

  return controller;
}
