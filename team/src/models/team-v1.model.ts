import { db, ensureTeamV1Schema, newId, nowMs } from "../db";
import type {
  TeamAttachmentRow,
  TeamBrandProfileRow,
  TeamConversationDetail,
  TeamConversationRow,
  TeamGatewayConfigRow,
  TeamGatewayAgentRow,
  TeamInviteRow,
  TeamMemberSessionRow,
  TeamMessageRow,
  TeamProfileRow,
} from "../types";

export type CreateMemberSessionErrorCode = "INVITE_NOT_FOUND" | "INVITE_INACTIVE" | "INVITE_EXPIRED" | "INVITE_EXHAUSTED";

export class CreateMemberSessionError extends Error {
  readonly code: CreateMemberSessionErrorCode;

  constructor(code: CreateMemberSessionErrorCode) {
    super(code);
    this.name = "CreateMemberSessionError";
    this.code = code;
  }
}

export function ensureTeamV1Tables(): void {
  ensureTeamV1Schema();
}

export function saveBrandProfile(input: {
  companyId: string;
  brandName: string;
  logoUrl: string | null;
  themeColor: string;
  welcomeText: string;
}): void {
  const now = nowMs();
  db.query(
    `
      INSERT INTO team_brand_profiles (company_id, brand_name, logo_url, theme_color, welcome_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(company_id) DO UPDATE SET
        brand_name = excluded.brand_name,
        logo_url = excluded.logo_url,
        theme_color = excluded.theme_color,
        welcome_text = excluded.welcome_text,
        updated_at = excluded.updated_at
    `
  ).run(input.companyId, input.brandName, input.logoUrl, input.themeColor, input.welcomeText, now, now);
}

export function saveGatewayConfig(input: {
  companyId: string;
  baseUrl: string;
  apiKey?: string | null;
}): TeamGatewayConfigRow {
  const now = nowMs();
  const apiKey = input.apiKey ?? null;
  db.prepare(
    `INSERT INTO team_gateway_configs (company_id, base_url, api_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(company_id) DO UPDATE SET
       base_url = excluded.base_url,
       api_key = excluded.api_key,
       updated_at = excluded.updated_at`
  ).run(input.companyId, input.baseUrl, apiKey, now, now);

  return {
    companyId: input.companyId,
    baseUrl: input.baseUrl,
    apiKey,
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertGatewayAgents(
  companyId: string,
  agents: Array<{
    externalAgentId: string;
    name: string;
    description?: string | null;
    status: string;
    isEnabled: boolean;
  }>
): void {
  const now = nowMs();
  const stmt = db.prepare(
    `INSERT INTO team_gateway_agents
      (id, company_id, external_agent_id, name, description, status, is_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(company_id, external_agent_id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       is_enabled = excluded.is_enabled,
       updated_at = excluded.updated_at`
  );

  const tx = db.transaction(
    (rows: Array<{ externalAgentId: string; name: string; description?: string | null; status: string; isEnabled: boolean }>) => {
      for (const agent of rows) {
        stmt.run(
          newId("tga"),
          companyId,
          agent.externalAgentId,
          agent.name,
          agent.description ?? null,
          agent.status,
          agent.isEnabled ? 1 : 0,
          now,
          now
        );
      }
    }
  );

  tx(agents);
}

export function replaceGatewayAgents(
  companyId: string,
  agents: Array<{
    externalAgentId: string;
    name: string;
    description?: string | null;
    status: string;
    isEnabled: boolean;
  }>
): void {
  const now = nowMs();
  const stmt = db.prepare(
    `INSERT INTO team_gateway_agents
      (id, company_id, external_agent_id, name, description, status, is_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(company_id, external_agent_id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       is_enabled = excluded.is_enabled,
       updated_at = excluded.updated_at`
  );

  const tx = db.transaction(
    (rows: Array<{ externalAgentId: string; name: string; description?: string | null; status: string; isEnabled: boolean }>) => {
      for (const agent of rows) {
        stmt.run(
          newId("tga"),
          companyId,
          agent.externalAgentId,
          agent.name,
          agent.description ?? null,
          agent.status,
          agent.isEnabled ? 1 : 0,
          now,
          now
        );
      }

      if (rows.length === 0) {
        db.prepare(
          `UPDATE team_gateway_agents
           SET is_enabled = 0, updated_at = ?
           WHERE company_id = ?`
        ).run(now, companyId);
        return;
      }

      const placeholders = rows.map(() => "?").join(", ");
      db.prepare(
        `UPDATE team_gateway_agents
         SET is_enabled = 0, updated_at = ?
         WHERE company_id = ?
           AND external_agent_id NOT IN (${placeholders})`
      ).run(now, companyId, ...rows.map((row) => row.externalAgentId));
    }
  );

  tx(agents);
}

export function listGatewayAgents(companyId: string): TeamGatewayAgentRow[] {
  return db
    .query(
      `SELECT
         id,
         company_id AS companyId,
         external_agent_id AS externalAgentId,
         name,
         description,
         status,
         is_enabled AS isEnabled,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM team_gateway_agents
       WHERE company_id = ?
       ORDER BY created_at ASC`
    )
    .all(companyId) as TeamGatewayAgentRow[];
}

export function getGatewayAgentByExternalId(companyId: string, externalAgentId: string): TeamGatewayAgentRow | null {
  return db
    .query(
      `SELECT
         id,
         company_id AS companyId,
         external_agent_id AS externalAgentId,
         name,
         description,
         status,
         is_enabled AS isEnabled,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM team_gateway_agents
       WHERE company_id = ? AND external_agent_id = ?`
    )
    .get(companyId, externalAgentId) as TeamGatewayAgentRow | null;
}

export function createTeamProfile(input: {
  companyId: string;
  name: string;
  description?: string | null;
  primaryAgentId: string;
}): TeamProfileRow {
  const now = nowMs();
  const id = newId("team");
  const description = input.description ?? null;

  db.prepare(
    `INSERT INTO team_profiles
      (id, company_id, name, description, primary_agent_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.companyId, input.name, description, input.primaryAgentId, now, now);

  return {
    id,
    companyId: input.companyId,
    name: input.name,
    description,
    primaryAgentId: input.primaryAgentId,
    createdAt: now,
    updatedAt: now,
  };
}

export function createInviteLink(input: {
  companyId: string;
  createdBy: string;
  usageLimit?: number | null;
  expiresAt?: number | null;
}): TeamInviteRow {
  const now = nowMs();
  const id = newId("tinv");
  const token = newId("invite");
  const usageLimit = input.usageLimit ?? null;
  const expiresAt = input.expiresAt ?? null;

  db.prepare(
    `INSERT INTO team_invites (id, company_id, token, status, expires_at, usage_limit, usage_count, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.companyId, token, "active", expiresAt, usageLimit, 0, input.createdBy, now, now);

  return {
    id,
    companyId: input.companyId,
    token,
    status: "active",
    expiresAt,
    usageLimit,
    usageCount: 0,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

export function getInviteById(companyId: string, inviteId: string): TeamInviteRow | null {
  return db
    .query(
      `SELECT
         id,
         company_id AS companyId,
         token,
         status,
         expires_at AS expiresAt,
         usage_limit AS usageLimit,
         usage_count AS usageCount,
         created_by AS createdBy,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM team_invites
       WHERE id = ? AND company_id = ?`
    )
    .get(inviteId, companyId) as TeamInviteRow | null;
}

export function getInviteByToken(token: string): TeamInviteRow | null {
  return db
    .query(
      `SELECT
         id,
         company_id AS companyId,
         token,
         status,
         expires_at AS expiresAt,
         usage_limit AS usageLimit,
         usage_count AS usageCount,
         created_by AS createdBy,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM team_invites
       WHERE token = ?`
    )
    .get(token) as TeamInviteRow | null;
}

export function createMemberSession(input: {
  companyId: string;
  inviteId: string;
  displayName: string;
}): TeamMemberSessionRow {
  const now = nowMs();
  const id = newId("tmem");
  const sessionToken = newId("tsess");

  const tx = db.transaction(() => {
    const invite = db
      .query(
        `SELECT status, expires_at AS expiresAt, usage_limit AS usageLimit, usage_count AS usageCount
         FROM team_invites
         WHERE id = ? AND company_id = ?`
      )
      .get(input.inviteId, input.companyId) as
      | { status: string; expiresAt: number | null; usageLimit: number | null; usageCount: number }
      | null;

    if (!invite) {
      throw new CreateMemberSessionError("INVITE_NOT_FOUND");
    }
    if (invite.status !== "active") {
      throw new CreateMemberSessionError("INVITE_INACTIVE");
    }
    if (invite.expiresAt !== null && invite.expiresAt <= now) {
      throw new CreateMemberSessionError("INVITE_EXPIRED");
    }
    if (invite.usageLimit !== null && invite.usageCount >= invite.usageLimit) {
      throw new CreateMemberSessionError("INVITE_EXHAUSTED");
    }

    db.prepare(
      `UPDATE team_invites
       SET usage_count = usage_count + 1, updated_at = ?
       WHERE id = ? AND company_id = ?`
    ).run(now, input.inviteId, input.companyId);

    db.prepare(
      `INSERT INTO team_member_sessions (id, company_id, invite_id, display_name, session_token, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.companyId, input.inviteId, input.displayName, sessionToken, now, now);
  });

  tx();

  return {
    id,
    companyId: input.companyId,
    inviteId: input.inviteId,
    displayName: input.displayName,
    sessionToken,
    lastSeenAt: now,
    createdAt: now,
  };
}

export function getMemberSessionById(companyId: string, memberId: string): TeamMemberSessionRow | null {
  return db
    .query(
      `SELECT
         id,
         company_id AS companyId,
         invite_id AS inviteId,
         display_name AS displayName,
         session_token AS sessionToken,
         last_seen_at AS lastSeenAt,
         created_at AS createdAt
       FROM team_member_sessions
       WHERE id = ? AND company_id = ?`
    )
    .get(memberId, companyId) as TeamMemberSessionRow | null;
}

export function getMemberSessionByToken(sessionToken: string): TeamMemberSessionRow | null {
  const now = nowMs();
  const row = db
    .query(
      `SELECT
         s.id,
         s.company_id AS companyId,
         s.invite_id AS inviteId,
         s.display_name AS displayName,
         s.session_token AS sessionToken,
         s.last_seen_at AS lastSeenAt,
         s.revoked_at AS revokedAt,
         s.created_at AS createdAt,
         i.status AS inviteStatus,
         i.expires_at AS inviteExpiresAt
       FROM team_member_sessions s
       JOIN team_invites i
         ON i.id = s.invite_id
        AND i.company_id = s.company_id
       WHERE s.session_token = ?`
    )
    .get(sessionToken) as
    | (TeamMemberSessionRow & {
        revokedAt: number | null;
        inviteStatus: string;
        inviteExpiresAt: number | null;
      })
    | null;

  if (!row) {
    return null;
  }

  if (row.revokedAt !== null) {
    return null;
  }

  if (row.inviteStatus !== "active" || (row.inviteExpiresAt !== null && row.inviteExpiresAt <= now)) {
    db.prepare(
      `UPDATE team_member_sessions
       SET revoked_at = ?
       WHERE id = ? AND company_id = ? AND revoked_at IS NULL`
    ).run(now, row.id, row.companyId);
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    inviteId: row.inviteId,
    displayName: row.displayName,
    sessionToken: row.sessionToken,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
  };
}

export function touchMemberSession(companyId: string, memberId: string): void {
  db.prepare(
    `UPDATE team_member_sessions
     SET last_seen_at = ?
     WHERE id = ? AND company_id = ? AND revoked_at IS NULL`
  ).run(nowMs(), memberId, companyId);
}

export function getTeamProfileById(companyId: string, teamId: string): TeamProfileRow | null {
  return db
    .query(
      `SELECT
         id,
         company_id AS companyId,
         name,
         description,
         primary_agent_id AS primaryAgentId,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM team_profiles
       WHERE id = ? AND company_id = ?`
    )
    .get(teamId, companyId) as TeamProfileRow | null;
}

export function createTeamConversation(input: {
  companyId: string;
  teamId: string;
  memberId: string;
  title: string;
}): string {
  const now = nowMs();
  const id = newId("tconv");

  db.prepare(
    `INSERT INTO team_conversations (id, company_id, team_id, member_id, title, status, last_message_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.companyId, input.teamId, input.memberId, input.title, "open", now, now, now);

  return id;
}

export function listConversationsByMember(companyId: string, memberId: string): TeamConversationRow[] {
  return db
    .query(
      `SELECT
         id,
         company_id AS companyId,
         team_id AS teamId,
         member_id AS memberId,
         title,
         status,
         last_message_at AS lastMessageAt,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM team_conversations
       WHERE company_id = ? AND member_id = ?
       ORDER BY updated_at DESC`
    )
    .all(companyId, memberId) as TeamConversationRow[];
}

export function getConversationById(companyId: string, conversationId: string): TeamConversationRow | null {
  return db
    .query(
      `SELECT
         id,
         company_id AS companyId,
         team_id AS teamId,
         member_id AS memberId,
         title,
         status,
         last_message_at AS lastMessageAt,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM team_conversations
       WHERE id = ? AND company_id = ?`
    )
    .get(conversationId, companyId) as TeamConversationRow | null;
}

export function createTeamMessage(input: {
  companyId: string;
  conversationId: string;
  senderType: string;
  senderId: string | null;
  messageType: string;
  body: string;
  streamStatus?: string;
}): TeamMessageRow {
  const now = nowMs();
  const id = newId("tmsg");
  const streamStatus = input.streamStatus ?? "done";

  db.prepare(
    `INSERT INTO team_messages (id, company_id, conversation_id, sender_type, sender_id, message_type, body, stream_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.companyId,
    input.conversationId,
    input.senderType,
    input.senderId,
    input.messageType,
    input.body,
    streamStatus,
    now
  );

  db.prepare(
    `UPDATE team_conversations
     SET last_message_at = ?, updated_at = ?
     WHERE id = ? AND company_id = ?`
  ).run(now, now, input.conversationId, input.companyId);

  return {
    id,
    companyId: input.companyId,
    conversationId: input.conversationId,
    senderType: input.senderType,
    senderId: input.senderId,
    messageType: input.messageType,
    body: input.body,
    streamStatus,
    createdAt: now,
  };
}

export function createTeamAttachment(input: {
  companyId: string;
  conversationId: string;
  memberId: string;
  messageId: string;
  kind: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}): TeamAttachmentRow {
  const now = nowMs();
  const id = newId("tatt");

  db.prepare(
    `INSERT INTO team_attachments
      (id, company_id, conversation_id, member_id, message_id, kind, original_name, stored_name, mime_type, size_bytes, storage_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.companyId,
    input.conversationId,
    input.memberId,
    input.messageId,
    input.kind,
    input.originalName,
    input.storedName,
    input.mimeType,
    input.sizeBytes,
    input.storagePath,
    now
  );

  return {
    id,
    companyId: input.companyId,
    conversationId: input.conversationId,
    memberId: input.memberId,
    messageId: input.messageId,
    kind: input.kind,
    originalName: input.originalName,
    storedName: input.storedName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storagePath: input.storagePath,
    createdAt: now,
  };
}

export function createAttachmentMessageAndRecord(input: {
  companyId: string;
  conversationId: string;
  memberId: string;
  kind: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}): { message: TeamMessageRow; attachment: TeamAttachmentRow } {
  const tx = db.transaction(() => {
    const message = createTeamMessage({
      companyId: input.companyId,
      conversationId: input.conversationId,
      senderType: "member",
      senderId: input.memberId,
      messageType: input.kind,
      body: input.originalName,
    });

    const attachment = createTeamAttachment({
      companyId: input.companyId,
      conversationId: input.conversationId,
      memberId: input.memberId,
      messageId: message.id,
      kind: input.kind,
      originalName: input.originalName,
      storedName: input.storedName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storagePath: input.storagePath,
    });

    return { message, attachment };
  });

  return tx();
}

export function getConversationDetail(companyId: string, conversationId: string): TeamConversationDetail | null {
  const conversation = db
    .query(
      `SELECT
         id,
         company_id AS companyId,
         team_id AS teamId,
         member_id AS memberId,
         title,
         status,
         last_message_at AS lastMessageAt,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM team_conversations
       WHERE id = ? AND company_id = ?`
    )
    .get(conversationId, companyId) as TeamConversationRow | null;

  if (!conversation) {
    return null;
  }

  const brand = db
    .query(
      `SELECT
         company_id AS companyId,
         brand_name AS brandName,
         logo_url AS logoUrl,
         theme_color AS themeColor,
         welcome_text AS welcomeText,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM team_brand_profiles
       WHERE company_id = ?`
    )
    .get(companyId) as TeamBrandProfileRow | null;

  const messages = db
    .query(
      `SELECT
         id,
         company_id AS companyId,
         conversation_id AS conversationId,
         sender_type AS senderType,
         sender_id AS senderId,
         message_type AS messageType,
         body,
         stream_status AS streamStatus,
         created_at AS createdAt
       FROM team_messages
       WHERE conversation_id = ? AND company_id = ?
       ORDER BY created_at ASC`
    )
    .all(conversationId, companyId) as TeamMessageRow[];

  const attachments = db
    .query(
      `SELECT
         id,
         company_id AS companyId,
         conversation_id AS conversationId,
         member_id AS memberId,
         message_id AS messageId,
         kind,
         original_name AS originalName,
         stored_name AS storedName,
         mime_type AS mimeType,
         size_bytes AS sizeBytes,
         storage_path AS storagePath,
         created_at AS createdAt
       FROM team_attachments
       WHERE conversation_id = ? AND company_id = ?
       ORDER BY created_at ASC`
    )
    .all(conversationId, companyId) as TeamAttachmentRow[];

  return {
    brand,
    conversation,
    messages,
    attachments,
  };
}
