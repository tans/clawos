import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { ensureTeamV1Tables } from "../../src/models/team-v1.model";

function uniqueValue(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function uniqueSlug(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function authHeaders(cookie: string): HeadersInit {
  return {
    "content-type": "application/json",
    cookie,
  };
}

function readSessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  expect(setCookie).toContain("clawos_team_admin_session=");
  return setCookie.split(";")[0] ?? "";
}

describe("team app api", () => {
  beforeEach(() => {
    ensureTeamV1Tables();
  });

  test("registers, resolves session, and logs out", async () => {
    const app = createApp();
    const email = `${uniqueValue("owner")}@example.com`;
    const password = "password123";

    const unauthSessionRes = await app.request("/api/team/app/session");
    expect(unauthSessionRes.status).toBe(200);
    expect(await unauthSessionRes.json()).toEqual({
      authenticated: false,
      user: null,
      companies: [],
    });

    const registerRes = await app.request("/api/team/app/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        confirmPassword: password,
      }),
    });
    expect(registerRes.status).toBe(201);
    const registerBody = await registerRes.json();
    expect(registerBody.authenticated).toBe(true);
    expect(registerBody.user?.email).toBe(email);
    expect(Array.isArray(registerBody.companies)).toBe(true);
    expect(registerBody.companies).toHaveLength(0);

    const cookie = readSessionCookie(registerRes);

    const authedSessionRes = await app.request("/api/team/app/session", {
      headers: { cookie },
    });
    expect(authedSessionRes.status).toBe(200);
    const authedSessionBody = await authedSessionRes.json();
    expect(authedSessionBody.authenticated).toBe(true);
    expect(authedSessionBody.user?.email).toBe(email);
    expect(authedSessionBody.companies).toHaveLength(0);

    const logoutRes = await app.request("/api/team/app/logout", {
      method: "POST",
      headers: { cookie },
    });
    expect(logoutRes.status).toBe(200);

    const afterLogoutSessionRes = await app.request("/api/team/app/session", {
      headers: { cookie },
    });
    expect(afterLogoutSessionRes.status).toBe(200);
    expect(await afterLogoutSessionRes.json()).toEqual({
      authenticated: false,
      user: null,
      companies: [],
    });
  });

  test("logs in and creates owned company with slug conflict validation", async () => {
    const app = createApp();
    const email = `${uniqueValue("owner")}@example.com`;
    const password = "password123";
    const companyName = "Alpha Ops";
    const companySlug = uniqueSlug("alpha");

    const registerRes = await app.request("/api/team/app/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        confirmPassword: password,
      }),
    });
    expect(registerRes.status).toBe(201);
    const cookie = readSessionCookie(registerRes);

    const createCompanyRes = await app.request("/api/team/app/companies", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        name: companyName,
        slug: companySlug,
      }),
    });
    expect(createCompanyRes.status).toBe(201);
    const createCompanyBody = await createCompanyRes.json();
    expect(createCompanyBody.company?.name).toBe(companyName);
    expect(createCompanyBody.company?.slug).toBe(companySlug);

    const adminRow = db
      .query(
        `SELECT id, legacy_console_user_id AS legacyConsoleUserId
         FROM team_app_admin_users
         WHERE email = ?`
      )
      .get(email) as { id: number; legacyConsoleUserId: number } | null;
    expect(adminRow).not.toBeNull();

    const createdCompanyRow = db
      .query(
        `SELECT owner_user_id AS ownerUserId
         FROM companies
         WHERE id = ?`
      )
      .get(createCompanyBody.company?.id ?? "") as { ownerUserId: number } | null;
    expect(createdCompanyRow).not.toBeNull();
    expect(createdCompanyRow?.ownerUserId).toBe(adminRow?.legacyConsoleUserId);

    const legacyOwner = db
      .query(
        `SELECT id
         FROM console_users
         WHERE id = ?`
      )
      .get(createdCompanyRow?.ownerUserId ?? -1) as { id: number } | null;
    expect(legacyOwner?.id).toBe(createdCompanyRow?.ownerUserId);

    const meRes = await app.request("/api/team/app/companies/me", {
      headers: { cookie },
    });
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(Array.isArray(meBody.companies)).toBe(true);
    expect(meBody.companies.length).toBeGreaterThanOrEqual(1);
    expect(meBody.companies.some((company: { slug: string }) => company.slug === companySlug)).toBe(true);

    const authedSessionRes = await app.request("/api/team/app/session", {
      headers: { cookie },
    });
    expect(authedSessionRes.status).toBe(200);
    const authedSessionBody = await authedSessionRes.json();
    expect(Array.isArray(authedSessionBody.companies)).toBe(true);
    expect(authedSessionBody.companies.some((company: { slug: string }) => company.slug === companySlug)).toBe(true);

    const secondEmail = `${uniqueValue("owner")}@example.com`;
    const secondRegisterRes = await app.request("/api/team/app/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: secondEmail,
        password,
        confirmPassword: password,
      }),
    });
    expect(secondRegisterRes.status).toBe(201);
    const secondCookie = readSessionCookie(secondRegisterRes);

    const slugConflictRes = await app.request("/api/team/app/companies", {
      method: "POST",
      headers: authHeaders(secondCookie),
      body: JSON.stringify({
        name: "Another Alpha",
        slug: companySlug,
      }),
    });
    expect(slugConflictRes.status).toBe(409);
  });

  test("rejects invalid login and supports login for existing account", async () => {
    const app = createApp();
    const email = `${uniqueValue("owner")}@example.com`;
    const password = "password123";

    const registerRes = await app.request("/api/team/app/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        confirmPassword: password,
      }),
    });
    expect(registerRes.status).toBe(201);

    const badLoginRes = await app.request("/api/team/app/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password: "wrong-password",
      }),
    });
    expect(badLoginRes.status).toBe(401);

    const loginRes = await app.request("/api/team/app/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.authenticated).toBe(true);
    expect(loginBody.user?.email).toBe(email);
  });

  test("validates registration input and login/logout/company creation request shapes", async () => {
    const app = createApp();
    const email = `${uniqueValue("owner")}@example.com`;
    const password = "password123";

    const invalidEmailRes = await app.request("/api/team/app/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password,
        confirmPassword: password,
      }),
    });
    expect(invalidEmailRes.status).toBe(400);
    expect(await invalidEmailRes.json()).toEqual({
      ok: false,
      error: "INVALID_EMAIL",
    });

    const whitespacePassword = "            ";
    const whitespacePasswordRes = await app.request("/api/team/app/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `${uniqueValue("owner")}@example.com`,
        password: whitespacePassword,
        confirmPassword: whitespacePassword,
      }),
    });
    expect(whitespacePasswordRes.status).toBe(400);
    expect(await whitespacePasswordRes.json()).toEqual({
      ok: false,
      error: "INVALID_PASSWORD",
    });

    const mismatchPasswordRes = await app.request("/api/team/app/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `${uniqueValue("owner")}@example.com`,
        password,
        confirmPassword: "password124",
      }),
    });
    expect(mismatchPasswordRes.status).toBe(400);
    expect(await mismatchPasswordRes.json()).toEqual({
      ok: false,
      error: "PASSWORD_MISMATCH",
    });

    const invalidRegisterBodyRes = await app.request("/api/team/app/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([]),
    });
    expect(invalidRegisterBodyRes.status).toBe(400);
    expect(await invalidRegisterBodyRes.json()).toEqual({
      ok: false,
      error: "INVALID_BODY",
    });

    const registerRes = await app.request("/api/team/app/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        confirmPassword: password,
      }),
    });
    expect(registerRes.status).toBe(201);
    readSessionCookie(registerRes);

    const invalidLoginBodyRes = await app.request("/api/team/app/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([]),
    });
    expect(invalidLoginBodyRes.status).toBe(400);
    expect(await invalidLoginBodyRes.json()).toEqual({
      ok: false,
      error: "INVALID_BODY",
    });

    const invalidLoginCredentialsRes = await app.request("/api/team/app/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
      }),
    });
    expect(invalidLoginCredentialsRes.status).toBe(400);
    expect(await invalidLoginCredentialsRes.json()).toEqual({
      ok: false,
      error: "INVALID_CREDENTIALS",
    });

    const whitespaceLoginRes = await app.request("/api/team/app/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password: "     ",
      }),
    });
    expect(whitespaceLoginRes.status).toBe(401);
    expect(await whitespaceLoginRes.json()).toEqual({
      ok: false,
      error: "INVALID_CREDENTIALS",
    });

    const loginRes = await app.request("/api/team/app/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginCookie = readSessionCookie(loginRes);

    const unauthCompanyCreateRes = await app.request("/api/team/app/companies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "No Auth Co",
        slug: uniqueSlug("no-auth"),
      }),
    });
    expect(unauthCompanyCreateRes.status).toBe(401);
    expect(await unauthCompanyCreateRes.json()).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });

    const invalidCompanyRes = await app.request("/api/team/app/companies", {
      method: "POST",
      headers: authHeaders(loginCookie),
      body: JSON.stringify({
        name: "Valid Name",
        slug: "x",
      }),
    });
    expect(invalidCompanyRes.status).toBe(400);
    expect(await invalidCompanyRes.json()).toEqual({
      ok: false,
      error: "INVALID_COMPANY",
    });

    const companyRes = await app.request("/api/team/app/companies", {
      method: "POST",
      headers: authHeaders(loginCookie),
      body: JSON.stringify({
        name: "Valid Name",
        slug: uniqueSlug("valid"),
      }),
    });
    expect(companyRes.status).toBe(201);

    const logoutRes = await app.request("/api/team/app/logout", {
      method: "POST",
      headers: { cookie: loginCookie },
    });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.headers.get("set-cookie") ?? "").toContain("clawos_team_admin_session=");

    const sessionAfterLogoutRes = await app.request("/api/team/app/session", {
      headers: { cookie: loginCookie },
    });
    expect(sessionAfterLogoutRes.status).toBe(200);
    expect(await sessionAfterLogoutRes.json()).toEqual({
      authenticated: false,
      user: null,
      companies: [],
    });
  });

  test("maps write-path duplicate email constraint failures to 409", async () => {
    const app = createApp();
    const email = `${uniqueValue("owner")}@example.com`;
    const password = "password123";

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS team_app_admin_users_force_email_unique
      BEFORE INSERT ON team_app_admin_users
      BEGIN
        SELECT RAISE(ABORT, 'UNIQUE constraint failed: team_app_admin_users.email');
      END;
    `);

    try {
      const registerRes = await app.request("/api/team/app/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          confirmPassword: password,
        }),
      });
      expect(registerRes.status).toBe(409);
      const registerBody = await registerRes.json();
      expect(registerBody.ok).toBe(false);
      expect(registerBody.error).toBe("EMAIL_EXISTS");
    } finally {
      db.exec("DROP TRIGGER IF EXISTS team_app_admin_users_force_email_unique;");
    }
  });

  test("maps legacy console shadow-user duplicate failures to 409", async () => {
    const app = createApp();
    const email = `${uniqueValue("owner")}@example.com`;
    const password = "password123";

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS console_users_force_mobile_unique
      BEFORE INSERT ON console_users
      BEGIN
        SELECT RAISE(ABORT, 'UNIQUE constraint failed: console_users.mobile');
      END;
    `);

    try {
      const registerRes = await app.request("/api/team/app/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          confirmPassword: password,
        }),
      });
      expect(registerRes.status).toBe(409);
      const registerBody = await registerRes.json();
      expect(registerBody.ok).toBe(false);
      expect(registerBody.error).toBe("EMAIL_EXISTS");
    } finally {
      db.exec("DROP TRIGGER IF EXISTS console_users_force_mobile_unique;");
    }
  });

  test("maps legacy console shadow-user wallet uniqueness failures to 409", async () => {
    const app = createApp();
    const email = `${uniqueValue("owner")}@example.com`;
    const password = "password123";

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS console_users_force_wallet_unique
      BEFORE INSERT ON console_users
      BEGIN
        SELECT RAISE(ABORT, 'UNIQUE constraint failed: console_users.wallet_address');
      END;
    `);

    try {
      const registerRes = await app.request("/api/team/app/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          confirmPassword: password,
        }),
      });
      expect(registerRes.status).toBe(409);
      const registerBody = await registerRes.json();
      expect(registerBody.ok).toBe(false);
      expect(registerBody.error).toBe("EMAIL_EXISTS");
    } finally {
      db.exec("DROP TRIGGER IF EXISTS console_users_force_wallet_unique;");
    }
  });

  test("maps write-path duplicate slug constraint failures to 409", async () => {
    const app = createApp();
    const email = `${uniqueValue("owner")}@example.com`;
    const password = "password123";
    const slug = uniqueSlug("race");

    const registerRes = await app.request("/api/team/app/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        confirmPassword: password,
      }),
    });
    expect(registerRes.status).toBe(201);
    const cookie = readSessionCookie(registerRes);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS companies_force_slug_unique
      BEFORE INSERT ON companies
      BEGIN
        SELECT RAISE(ABORT, 'UNIQUE constraint failed: companies.slug');
      END;
    `);

    try {
      const createCompanyRes = await app.request("/api/team/app/companies", {
        method: "POST",
        headers: authHeaders(cookie),
        body: JSON.stringify({
          name: "Race Company",
          slug,
        }),
      });
      expect(createCompanyRes.status).toBe(409);
      const createCompanyBody = await createCompanyRes.json();
      expect(createCompanyBody.ok).toBe(false);
      expect(createCompanyBody.error).toBe("SLUG_EXISTS");
    } finally {
      db.exec("DROP TRIGGER IF EXISTS companies_force_slug_unique;");
    }
  });
});
