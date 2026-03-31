import { db, newId, nowMs } from "../db";
import type {
  CompanyRow,
  TeamAppAdminCredentialRow,
  TeamAppAdminUserRow,
} from "../types";
import { createCompanyForOwner } from "./company.model";

const TEAM_APP_OWNER_ROLE = "owner";

type TeamAppAdminUserInternalRow = TeamAppAdminUserRow & {
  passwordHash: string;
};

export class TeamAppAuthModelError extends Error {
  readonly code: "EMAIL_EXISTS" | "SLUG_EXISTS" | "TEAM_APP_ADMIN_NOT_FOUND";

  constructor(code: "EMAIL_EXISTS" | "SLUG_EXISTS" | "TEAM_APP_ADMIN_NOT_FOUND") {
    super(code);
    this.name = "TeamAppAuthModelError";
    this.code = code;
  }
}

function isSqliteUniqueConstraintError(error: unknown, constraint: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes(`UNIQUE constraint failed: ${constraint}`);
}

function isTeamAdminEmailDuplicateError(error: unknown): boolean {
  return (
    isSqliteUniqueConstraintError(error, "team_app_admin_users.email") ||
    isSqliteUniqueConstraintError(error, "console_users.mobile") ||
    isSqliteUniqueConstraintError(error, "console_users.wallet_address")
  );
}

export function clearExpiredTeamAppAdminSessions(): void {
  db.prepare("DELETE FROM team_app_admin_sessions WHERE expires_at < ?").run(nowMs());
}

export function getTeamAppAdminUserByEmail(email: string): TeamAppAdminUserRow | null {
  return db
    .query(
      `SELECT
         id,
         email,
         legacy_console_user_id AS legacyConsoleUserId,
         created_at AS createdAt
       FROM team_app_admin_users
       WHERE email = ?`
    )
    .get(email) as TeamAppAdminUserRow | null;
}

export function createTeamAppAdminUser(email: string, passwordHash: string): TeamAppAdminUserRow {
  const now = nowMs();

  const tx = db.transaction((normalizedEmail: string, hash: string) => {
    const legacyMobile = `team-admin:${normalizedEmail}`;
    const legacyWalletAddress = `team-admin:${normalizedEmail}`;

    db.prepare(
      `INSERT INTO console_users (mobile, password_hash, wallet_address, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(legacyMobile, hash, legacyWalletAddress, now);

    const legacyUser = db
      .query(
        `SELECT id
         FROM console_users
         WHERE mobile = ?`
      )
      .get(legacyMobile) as { id: number } | null;
    if (!legacyUser) {
      throw new Error("LEGACY_CONSOLE_USER_CREATE_FAILED");
    }

    db.prepare(
      `INSERT INTO team_app_admin_users (email, password_hash, legacy_console_user_id, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(normalizedEmail, hash, legacyUser.id, now);
  });

  try {
    tx(email, passwordHash);
  } catch (error) {
    if (isTeamAdminEmailDuplicateError(error)) {
      throw new TeamAppAuthModelError("EMAIL_EXISTS");
    }
    throw error;
  }

  const created = getTeamAppAdminUserByEmail(email);
  if (!created) {
    throw new Error("TEAM_APP_ADMIN_CREATE_FAILED");
  }
  return created;
}

export function getTeamAppAdminCredentialByEmail(email: string): TeamAppAdminCredentialRow | null {
  return db
    .query(
      `SELECT
         id,
         email,
         password_hash AS passwordHash,
         legacy_console_user_id AS legacyConsoleUserId
       FROM team_app_admin_users
       WHERE email = ?`
    )
    .get(email) as TeamAppAdminCredentialRow | null;
}

export function createTeamAppAdminSession(userId: number, expiresAt: number): string {
  const token = newId("tas");
  db.prepare(
    `INSERT INTO team_app_admin_sessions (token, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(token, userId, expiresAt, nowMs());
  return token;
}

export function getTeamAppAdminUserBySessionToken(token: string): TeamAppAdminUserRow | null {
  return db
    .query(
      `SELECT
         u.id AS id,
         u.email AS email,
         u.legacy_console_user_id AS legacyConsoleUserId,
         u.created_at AS createdAt
       FROM team_app_admin_sessions s
       JOIN team_app_admin_users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, nowMs()) as TeamAppAdminUserRow | null;
}

export function deleteTeamAppAdminSession(token: string): void {
  db.prepare("DELETE FROM team_app_admin_sessions WHERE token = ?").run(token);
}

function getTeamAppAdminUserInternalById(userId: number): TeamAppAdminUserInternalRow | null {
  return db
    .query(
      `SELECT
         id,
         email,
         password_hash AS passwordHash,
         legacy_console_user_id AS legacyConsoleUserId,
         created_at AS createdAt
       FROM team_app_admin_users
       WHERE id = ?`
    )
    .get(userId) as TeamAppAdminUserInternalRow | null;
}

export function listOwnedCompaniesByTeamAdminUserId(teamAdminUserId: number): CompanyRow[] {
  return db
    .query(
      `SELECT
         c.id AS id,
         c.owner_user_id AS ownerUserId,
         c.name AS name,
         c.slug AS slug,
         c.mode AS mode,
         c.created_at AS createdAt,
         c.updated_at AS updatedAt
       FROM team_app_company_memberships m
       JOIN companies c ON c.id = m.company_id
       WHERE m.team_admin_user_id = ?
         AND m.role = ?
       ORDER BY c.updated_at DESC`
    )
    .all(teamAdminUserId, TEAM_APP_OWNER_ROLE) as CompanyRow[];
}

function getCompanyById(companyId: string): CompanyRow | null {
  return db
    .query(
      `SELECT
         id,
         owner_user_id AS ownerUserId,
         name,
         slug,
         mode,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM companies
       WHERE id = ?`
    )
    .get(companyId) as CompanyRow | null;
}

export function createCompanyForTeamAdminOwner(args: {
  teamAdminUserId: number;
  name: string;
  slug: string;
  mode: string;
  now?: number;
}): CompanyRow {
  const admin = getTeamAppAdminUserInternalById(args.teamAdminUserId);
  if (!admin) {
    throw new TeamAppAuthModelError("TEAM_APP_ADMIN_NOT_FOUND");
  }
  const timestamp = args.now ?? nowMs();

  const tx = db.transaction((legacyOwnerUserId: number) => {
    const companyId = createCompanyForOwner({
      ownerUserId: legacyOwnerUserId,
      name: args.name,
      slug: args.slug,
      mode: args.mode,
      now: timestamp,
    });

    db.prepare(
      `INSERT INTO team_app_company_memberships (company_id, team_admin_user_id, role, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(companyId, args.teamAdminUserId, TEAM_APP_OWNER_ROLE, timestamp);

    return companyId;
  });

  let companyId: string;
  try {
    companyId = tx(admin.legacyConsoleUserId);
  } catch (error) {
    if (isSqliteUniqueConstraintError(error, "companies.slug")) {
      throw new TeamAppAuthModelError("SLUG_EXISTS");
    }
    throw error;
  }
  const company = getCompanyById(companyId);
  if (!company) {
    throw new Error("TEAM_APP_COMPANY_CREATE_FAILED");
  }
  return company;
}
