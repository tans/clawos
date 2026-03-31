import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import { db, nowMs } from "../../src/db";
import { createTeamAppAdminSession, createTeamAppAdminUser } from "../../src/models/team-app-auth.model";
import { ensureTeamV1Tables, getInviteById, upsertGatewayAgents } from "../../src/models/team-v1.model";

function newCompanyId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function ensureLegacyConsoleUser(ownerKey: string): number {
  const now = nowMs();
  const mobile = `legacy:${ownerKey}:${crypto.randomUUID().toString()}`;
  const walletAddress = `legacy-wallet:${ownerKey}:${crypto.randomUUID().toString()}`;

  db.prepare(
    `INSERT INTO console_users (mobile, password_hash, wallet_address, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(mobile, "test_hash", walletAddress, now);

  const row = db
    .query(
      `SELECT id
       FROM console_users
       WHERE wallet_address = ?`
    )
    .get(walletAddress) as { id: number } | null;
  if (!row) {
    throw new Error("Failed to seed legacy console user");
  }
  return row.id;
}

function ensureCompanyFixture(
  companyId: string,
  options: {
    role?: string;
    ownerUserId?: number;
  } = {}
): { teamAdminUserId: number; email: string } {
  const now = nowMs();
  const email = `${companyId}_${crypto.randomUUID().replaceAll("-", "")}@example.com`;
  const teamAdmin = createTeamAppAdminUser(email, "test_hash");
  const role = options.role ?? "owner";
  const ownerUserId = options.ownerUserId ?? teamAdmin.legacyConsoleUserId;

  db.prepare(
    `INSERT OR IGNORE INTO companies (id, owner_user_id, name, slug, mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(companyId, ownerUserId, "Alpha Ops", companyId, "unmanned", now, now);
  db.prepare(
    `INSERT OR REPLACE INTO team_app_company_memberships (company_id, team_admin_user_id, role, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(companyId, teamAdmin.id, role, now);

  return { teamAdminUserId: teamAdmin.id, email: teamAdmin.email };
}

function createSessionForTeamAdmin(teamAdminUserId: number, email: string): { token: string; email: string } {
  const token = createTeamAppAdminSession(teamAdminUserId, Date.now() + 60 * 60 * 1000);
  return { token, email };
}

function authHeaders(token: string): HeadersInit {
  return { "content-type": "application/json", cookie: `clawos_team_admin_session=${token}` };
}

describe("team admin api", () => {
  beforeEach(() => {
    ensureTeamV1Tables();
  });

  test("rejects unauthenticated and cross-company admin access", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_alpha");
    const otherCompanyId = newCompanyId("company_beta");
    const viewerCompanyId = newCompanyId("company_viewer");
    const company = ensureCompanyFixture(companyId);
    ensureCompanyFixture(otherCompanyId);
    const viewerCompany = ensureCompanyFixture(viewerCompanyId, { role: "viewer" });
    const session = createSessionForTeamAdmin(company.teamAdminUserId, company.email);
    const viewerSession = createSessionForTeamAdmin(viewerCompany.teamAdminUserId, viewerCompany.email);

    const unauthRes = await app.request(`/api/team/admin/companies/${companyId}/brand`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        brandName: "Alpha Ops",
        logoUrl: "/uploads/alpha/logo.png",
        themeColor: "#1d4ed8",
        welcomeText: "Welcome",
      }),
    });
    expect(unauthRes.status).toBe(401);

    const wrongCompanyRes = await app.request(`/api/team/admin/companies/${otherCompanyId}/brand`, {
      method: "PUT",
      headers: authHeaders(session.token),
      body: JSON.stringify({
        brandName: "Other Ops",
        logoUrl: "/uploads/beta/logo.png",
        themeColor: "#0ea5e9",
        welcomeText: "Welcome",
      }),
    });
    expect(wrongCompanyRes.status).toBe(403);

    const viewerRoleRes = await app.request(`/api/team/admin/companies/${viewerCompanyId}/brand`, {
      method: "PUT",
      headers: authHeaders(viewerSession.token),
      body: JSON.stringify({
        brandName: "Viewer Ops",
        logoUrl: "/uploads/viewer/logo.png",
        themeColor: "#0284c7",
        welcomeText: "Welcome",
      }),
    });
    expect(viewerRoleRes.status).toBe(403);

    const missingCompanyRes = await app.request(`/api/team/admin/companies/missing_company/brand`, {
      method: "PUT",
      headers: authHeaders(session.token),
      body: JSON.stringify({
        brandName: "Missing",
        logoUrl: "/uploads/missing/logo.png",
        themeColor: "#0ea5e9",
        welcomeText: "Welcome",
      }),
    });
    expect(missingCompanyRes.status).toBe(404);
  });

  test("rejects null or empty bodies for brand and gateway test", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_alpha");
    const company = ensureCompanyFixture(companyId);
    const session = createSessionForTeamAdmin(company.teamAdminUserId, company.email);

    const nullBrandRes = await app.request(`/api/team/admin/companies/${companyId}/brand`, {
      method: "PUT",
      headers: authHeaders(session.token),
      body: JSON.stringify(null),
    });
    expect(nullBrandRes.status).toBe(400);

    const emptyBrandRes = await app.request(`/api/team/admin/companies/${companyId}/brand`, {
      method: "PUT",
      headers: authHeaders(session.token),
      body: JSON.stringify({}),
    });
    expect(emptyBrandRes.status).toBe(400);

    const nullGatewayRes = await app.request(`/api/team/admin/companies/${companyId}/gateway/test`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify(null),
    });
    expect(nullGatewayRes.status).toBe(400);
  });

  test("saves brand settings, validates gateway config, syncs agents, creates teams, and creates invites", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_alpha");
    const company = ensureCompanyFixture(companyId);
    const session = createSessionForTeamAdmin(company.teamAdminUserId, company.email);

    const brandRes = await app.request(`/api/team/admin/companies/${companyId}/brand`, {
      method: "PUT",
      headers: authHeaders(session.token),
      body: JSON.stringify({
        brandName: "Alpha Ops",
        logoUrl: "/uploads/alpha/logo.png",
        themeColor: "#1d4ed8",
        welcomeText: "Welcome",
      }),
    });
    expect(brandRes.status).toBe(200);

    const brandRow = db
      .query(
        `SELECT brand_name AS brandName, logo_url AS logoUrl, theme_color AS themeColor, welcome_text AS welcomeText
         FROM team_brand_profiles
         WHERE company_id = ?`
      )
      .get(companyId) as { brandName: string; logoUrl: string | null; themeColor: string; welcomeText: string } | null;
    expect(brandRow?.brandName).toBe("Alpha Ops");
    expect(brandRow?.logoUrl).toBe("/uploads/alpha/logo.png");
    expect(brandRow?.themeColor).toBe("#1d4ed8");

    const badGatewayRes = await app.request(`/api/team/admin/companies/${companyId}/gateway/test`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({ baseUrl: "gateway.local", apiKey: "token_123" }),
    });
    expect(badGatewayRes.status).toBe(400);
    const badGatewayBody = await badGatewayRes.json();
    expect(badGatewayBody.ok).toBe(false);

    const missingGatewayRes = await app.request(`/api/team/admin/companies/${companyId}/gateway/test`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({ apiKey: "token_123" }),
    });
    expect(missingGatewayRes.status).toBe(400);
    const missingGatewayBody = await missingGatewayRes.json();
    expect(missingGatewayBody.ok).toBe(false);

    const typeGatewayRes = await app.request(`/api/team/admin/companies/${companyId}/gateway/test`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({ baseUrl: 123, apiKey: "token_123" }),
    });
    expect(typeGatewayRes.status).toBe(400);
    const typeGatewayBody = await typeGatewayRes.json();
    expect(typeGatewayBody.ok).toBe(false);

    const badApiKeyGatewayRes = await app.request(`/api/team/admin/companies/${companyId}/gateway/test`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({ baseUrl: "https://gateway.example.com", apiKey: 123 }),
    });
    expect(badApiKeyGatewayRes.status).toBe(400);

    const gatewayRes = await app.request(`/api/team/admin/companies/${companyId}/gateway/test`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({ baseUrl: "https://gateway.example.com", apiKey: "token_123" }),
    });
    expect(gatewayRes.status).toBe(200);

    const syncRes = await app.request(`/api/team/admin/companies/${companyId}/gateway/agents/sync`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({}),
    });
    expect(syncRes.status).toBe(200);
    const syncBody = await syncRes.json();
    expect(Array.isArray(syncBody.agents)).toBe(true);
    expect(syncBody.agents).toHaveLength(1);
    expect(syncBody.agents[0]?.externalAgentId).toBe("agent_sales_1");
    expect(syncBody.agents[0]?.isEnabled).toBe(true);

    const agentRow = db
      .query(
        `SELECT external_agent_id AS externalAgentId, is_enabled AS isEnabled
         FROM team_gateway_agents
         WHERE company_id = ? AND external_agent_id = ?`
      )
      .get(companyId, "agent_sales_1") as { externalAgentId: string; isEnabled: number } | null;
    expect(agentRow?.externalAgentId).toBe("agent_sales_1");
    expect(agentRow?.isEnabled).toBe(1);

    const teamRes = await app.request(`/api/team/admin/companies/${companyId}/teams`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({ name: "Sales", description: "Sales copilot", primaryAgentId: "agent_sales_1" }),
    });
    expect(teamRes.status).toBe(201);
    const teamBody = await teamRes.json();
    expect(teamBody.team?.name).toBe("Sales");
    expect(teamBody.team?.primaryAgentId).toBe("agent_sales_1");

    const teamRow = db
      .query(
        `SELECT name, description, primary_agent_id AS primaryAgentId
         FROM team_profiles
         WHERE company_id = ? AND id = ?`
      )
      .get(companyId, teamBody.team?.id ?? "") as
      | { name: string; description: string | null; primaryAgentId: string }
      | null;
    expect(teamRow?.name).toBe("Sales");
    expect(teamRow?.primaryAgentId).toBe("agent_sales_1");

    const inviteRes = await app.request(`/api/team/admin/companies/${companyId}/invites`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({ expiresInHours: 24, usageLimit: 20 }),
    });
    expect(inviteRes.status).toBe(201);
    const inviteBody = await inviteRes.json();
    expect(inviteBody.invite?.companyId).toBe(companyId);
    expect(inviteBody.invite?.createdBy).toBe(`team-admin:${session.email}`);
    expect(getInviteById(companyId, inviteBody.invite?.id ?? "")?.id).toBe(inviteBody.invite?.id);
  });

  test("rejects unknown primary agents and invalid invite inputs", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_alpha");
    const company = ensureCompanyFixture(companyId);
    const session = createSessionForTeamAdmin(company.teamAdminUserId, company.email);

    const teamRes = await app.request(`/api/team/admin/companies/${companyId}/teams`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({ name: "Sales", description: "Sales copilot", primaryAgentId: "agent_missing" }),
    });
    expect(teamRes.status).toBe(400);

    const inviteUsageRes = await app.request(`/api/team/admin/companies/${companyId}/invites`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({ expiresInHours: 24, usageLimit: 0 }),
    });
    expect(inviteUsageRes.status).toBe(400);

    const inviteFractionRes = await app.request(`/api/team/admin/companies/${companyId}/invites`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({ expiresInHours: 24, usageLimit: 0.2 }),
    });
    expect(inviteFractionRes.status).toBe(400);

    const inviteExpiryRes = await app.request(`/api/team/admin/companies/${companyId}/invites`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({ expiresInHours: -1, usageLimit: 5 }),
    });
    expect(inviteExpiryRes.status).toBe(400);
  });

  test("persists gateway config for a company", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_alpha");
    const legacyOwnerUserId = ensureLegacyConsoleUser(companyId);
    const company = ensureCompanyFixture(companyId, {
      ownerUserId: legacyOwnerUserId,
    });
    const session = createSessionForTeamAdmin(company.teamAdminUserId, company.email);

    const configRes = await app.request(`/api/team/admin/companies/${companyId}/gateway/config`, {
      method: "PUT",
      headers: authHeaders(session.token),
      body: JSON.stringify({ baseUrl: "https://gateway.example.com", apiKey: "token_123" }),
    });
    expect(configRes.status).toBe(200);

    const configRow = db
      .query(
        `SELECT base_url AS baseUrl, api_key AS apiKey
         FROM team_gateway_configs
         WHERE company_id = ?`
      )
      .get(companyId) as { baseUrl: string; apiKey: string | null } | null;
    expect(configRow?.baseUrl).toBe("https://gateway.example.com");
    expect(configRow?.apiKey).toBe("token_123");

    const badConfigRes = await app.request(`/api/team/admin/companies/${companyId}/gateway/config`, {
      method: "PUT",
      headers: authHeaders(session.token),
      body: JSON.stringify({ baseUrl: "https://gateway.example.com", apiKey: 123 }),
    });
    expect(badConfigRes.status).toBe(400);
  });

  test("sync disables stale agents and returns only current sync results", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_alpha");
    const company = ensureCompanyFixture(companyId);
    const session = createSessionForTeamAdmin(company.teamAdminUserId, company.email);

    upsertGatewayAgents(companyId, [
      {
        externalAgentId: "agent_stale",
        name: "Stale Agent",
        description: "Old agent",
        status: "ready",
        isEnabled: true,
      },
    ]);

    const syncRes = await app.request(`/api/team/admin/companies/${companyId}/gateway/agents/sync`, {
      method: "POST",
      headers: authHeaders(session.token),
      body: JSON.stringify({}),
    });
    expect(syncRes.status).toBe(200);
    const syncBody = await syncRes.json();
    expect(syncBody.agents).toHaveLength(1);
    expect(syncBody.agents[0]?.externalAgentId).toBe("agent_sales_1");

    const staleRow = db
      .query(
        `SELECT is_enabled AS isEnabled
         FROM team_gateway_agents
         WHERE company_id = ? AND external_agent_id = ?`
      )
      .get(companyId, "agent_stale") as { isEnabled: number } | null;
    expect(staleRow?.isEnabled).toBe(0);
  });
});
