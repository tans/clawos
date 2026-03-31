import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createTeamProfile,
  createInviteLink,
  createMemberSession,
  createTeamConversation,
  createTeamMessage,
  ensureTeamV1Tables,
  getInviteById,
  getConversationDetail,
  getMemberSessionById,
  saveBrandProfile,
  upsertGatewayAgents,
} from "../../src/models/team-v1.model";
import { db, nowMs } from "../../src/db";

function newCompanyId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function ensureCompanyFixture(companyId: string): void {
  const now = nowMs();
  const walletAddress = `wallet_${companyId}`;
  const mobile = `+1${Array.from(crypto.randomUUID().replaceAll("-", "").slice(0, 10), (char) =>
    (Number.parseInt(char, 16) % 10).toString()
  ).join("")}`;

  db.prepare(
    `INSERT OR IGNORE INTO console_users (mobile, password_hash, wallet_address, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(mobile, "test_hash", walletAddress, now);

  const user = db.query(`SELECT id FROM console_users WHERE wallet_address = ?`).get(walletAddress) as
    | { id: number }
    | null;

  if (!user) {
    throw new Error("Failed to seed console user");
  }

  db.prepare(
    `INSERT OR IGNORE INTO companies (id, owner_user_id, name, slug, mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(companyId, user.id, "Alpha Ops", companyId, "unmanned", now, now);
}

function ensureTeamFixture(companyId: string): { teamId: string } {
  upsertGatewayAgents(companyId, [
    {
      externalAgentId: "agent_sales_1",
      name: "Sales Agent",
      description: "Sales copilot",
      status: "ready",
      isEnabled: true,
    },
  ]);
  const team = createTeamProfile({
    companyId,
    name: "Sales Team",
    description: "Sales copilot",
    primaryAgentId: "agent_sales_1",
  });
  return { teamId: team.id };
}

describe("team v1 model", () => {
  beforeEach(() => {
    ensureTeamV1Tables();
  });

  test("persists brand, invite, member session, conversation, and message records per company", () => {
    const companyId = newCompanyId("company_alpha");
    const otherCompanyId = "company_beta";
    ensureCompanyFixture(companyId);
    ensureCompanyFixture(otherCompanyId);
    const { teamId } = ensureTeamFixture(companyId);
    saveBrandProfile({
      companyId,
      brandName: "Alpha Ops",
      logoUrl: "/uploads/alpha/logo.png",
      themeColor: "#1d4ed8",
      welcomeText: "Welcome to Alpha Ops",
    });

    const invite = createInviteLink({
      companyId,
      createdBy: "console:admin",
      usageLimit: 5,
      expiresAt: Date.now() + 60_000,
    });

    const member = createMemberSession({
      companyId,
      inviteId: invite.id,
      displayName: "Iris",
    });

    const conversationId = createTeamConversation({
      companyId,
      teamId,
      memberId: member.id,
      title: "New lead follow-up",
    });

    createTeamMessage({
      companyId,
      conversationId,
      senderType: "member",
      senderId: member.id,
      messageType: "text",
      body: "Draft a follow-up for this lead",
    });

    const persistedInvite = getInviteById(companyId, invite.id);
    const persistedMember = getMemberSessionById(companyId, member.id);
    const detail = getConversationDetail(companyId, conversationId);

    expect(persistedInvite?.createdBy).toBe("console:admin");
    expect(persistedInvite?.usageLimit).toBe(5);
    expect(persistedInvite?.companyId).toBe(companyId);
    expect(persistedMember?.displayName).toBe("Iris");
    expect(persistedMember?.inviteId).toBe(invite.id);
    expect(persistedMember?.companyId).toBe(companyId);
    expect(detail?.brand?.brandName).toBe("Alpha Ops");
    expect(detail?.conversation.teamId).toBe(teamId);
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.messages[0]?.body).toContain("follow-up");

    expect(getInviteById(otherCompanyId, invite.id)).toBeNull();
    expect(getConversationDetail(otherCompanyId, conversationId)).toBeNull();
  });

  test("rejects cross-company invite redemption", () => {
    const companyId = newCompanyId("company_alpha");
    const otherCompanyId = newCompanyId("company_beta");
    ensureCompanyFixture(companyId);
    ensureCompanyFixture(otherCompanyId);

    const invite = createInviteLink({
      companyId,
      createdBy: "console:admin",
      usageLimit: 1,
      expiresAt: Date.now() + 60_000,
    });

    expect(() =>
      createMemberSession({
        companyId: otherCompanyId,
        inviteId: invite.id,
        displayName: "Eli",
      })
    ).toThrow();
  });

  test("rejects inactive invites", () => {
    const companyId = newCompanyId("company_alpha");
    ensureCompanyFixture(companyId);

    const invite = createInviteLink({
      companyId,
      createdBy: "console:admin",
      usageLimit: 1,
      expiresAt: Date.now() + 60_000,
    });

    db.prepare(`UPDATE team_invites SET status = 'inactive' WHERE id = ?`).run(invite.id);

    expect(() =>
      createMemberSession({
        companyId,
        inviteId: invite.id,
        displayName: "Iris",
      })
    ).toThrow();
  });

  test("rejects expired invites", () => {
    const companyId = newCompanyId("company_alpha");
    ensureCompanyFixture(companyId);

    const invite = createInviteLink({
      companyId,
      createdBy: "console:admin",
      usageLimit: 1,
      expiresAt: Date.now() - 1_000,
    });

    expect(() =>
      createMemberSession({
        companyId,
        inviteId: invite.id,
        displayName: "Iris",
      })
    ).toThrow();
  });

  test("rejects used-up invites and increments usage count", () => {
    const companyId = newCompanyId("company_alpha");
    ensureCompanyFixture(companyId);

    const invite = createInviteLink({
      companyId,
      createdBy: "console:admin",
      usageLimit: 1,
      expiresAt: Date.now() + 60_000,
    });

    const member = createMemberSession({
      companyId,
      inviteId: invite.id,
      displayName: "Iris",
    });

    const persistedInvite = getInviteById(companyId, invite.id);
    expect(persistedInvite?.usageCount).toBe(1);
    expect(persistedInvite?.id).toBe(invite.id);
    expect(member.inviteId).toBe(invite.id);

    expect(() =>
      createMemberSession({
        companyId,
        inviteId: invite.id,
        displayName: "Noah",
      })
    ).toThrow();
  });

  test("rejects orphan conversations", () => {
    const companyId = newCompanyId("company_alpha");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);

    expect(() =>
      createTeamConversation({
        companyId,
        teamId,
        memberId: "member_missing",
        title: "Orphan conversation",
      })
    ).toThrow();
  });

  test("rejects cross-company messages", () => {
    const companyId = newCompanyId("company_alpha");
    const otherCompanyId = newCompanyId("company_beta");
    ensureCompanyFixture(companyId);
    ensureCompanyFixture(otherCompanyId);
    const { teamId } = ensureTeamFixture(companyId);

    const invite = createInviteLink({
      companyId,
      createdBy: "console:admin",
      usageLimit: 1,
      expiresAt: Date.now() + 60_000,
    });

    const member = createMemberSession({
      companyId,
      inviteId: invite.id,
      displayName: "Iris",
    });

    const conversationId = createTeamConversation({
      companyId,
      teamId,
      memberId: member.id,
      title: "Scoped conversation",
    });

    expect(() =>
      createTeamMessage({
        companyId: otherCompanyId,
        conversationId,
        senderType: "member",
        senderId: member.id,
        messageType: "text",
        body: "Cross-company message",
      })
    ).toThrow();
  });

  test("deleting a company cascades through team records", () => {
    const companyId = newCompanyId("company_alpha");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);

    saveBrandProfile({
      companyId,
      brandName: "Alpha Ops",
      logoUrl: "/uploads/alpha/logo.png",
      themeColor: "#1d4ed8",
      welcomeText: "Welcome to Alpha Ops",
    });

    const invite = createInviteLink({
      companyId,
      createdBy: "console:admin",
      usageLimit: 2,
      expiresAt: Date.now() + 60_000,
    });

    const member = createMemberSession({
      companyId,
      inviteId: invite.id,
      displayName: "Iris",
    });

    const conversationId = createTeamConversation({
      companyId,
      teamId,
      memberId: member.id,
      title: "Cascade conversation",
    });

    createTeamMessage({
      companyId,
      conversationId,
      senderType: "member",
      senderId: member.id,
      messageType: "text",
      body: "Cascade message",
    });

    db.prepare("DELETE FROM companies WHERE id = ?").run(companyId);

    const brandCount = db.query(`SELECT COUNT(*) as count FROM team_brand_profiles WHERE company_id = ?`).get(
      companyId
    ) as { count: number };
    const inviteCount = db.query(`SELECT COUNT(*) as count FROM team_invites WHERE company_id = ?`).get(companyId) as {
      count: number;
    };
    const sessionCount = db
      .query(`SELECT COUNT(*) as count FROM team_member_sessions WHERE company_id = ?`)
      .get(companyId) as { count: number };
    const conversationCount = db
      .query(`SELECT COUNT(*) as count FROM team_conversations WHERE company_id = ?`)
      .get(companyId) as { count: number };
    const messageCount = db.query(`SELECT COUNT(*) as count FROM team_messages WHERE company_id = ?`).get(
      companyId
    ) as { count: number };

    expect(brandCount.count).toBe(0);
    expect(inviteCount.count).toBe(0);
    expect(sessionCount.count).toBe(0);
    expect(conversationCount.count).toBe(0);
    expect(messageCount.count).toBe(0);
  });

  test("repairs polluted team v1 rows during ensure", () => {
    const companyId = newCompanyId("company_alpha");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);

    const invite = createInviteLink({
      companyId,
      createdBy: "console:admin",
      usageLimit: 2,
      expiresAt: Date.now() + 60_000,
    });

    const member = createMemberSession({
      companyId,
      inviteId: invite.id,
      displayName: "Iris",
    });

    const conversationId = createTeamConversation({
      companyId,
      teamId,
      memberId: member.id,
      title: "Valid conversation",
    });

    createTeamMessage({
      companyId,
      conversationId,
      senderType: "member",
      senderId: member.id,
      messageType: "text",
      body: "Valid message",
    });

    db.exec("PRAGMA foreign_keys = OFF;");
    const badCompanyId = newCompanyId("company_bad");
    const now = nowMs();
    const badInviteId = `tinv_${crypto.randomUUID().replaceAll("-", "")}`;
    const badSessionId = `tmem_${crypto.randomUUID().replaceAll("-", "")}`;
    const badConversationId = `tconv_${crypto.randomUUID().replaceAll("-", "")}`;
    const badMessageId = `tmsg_${crypto.randomUUID().replaceAll("-", "")}`;
    const badBrandId = badCompanyId;

    db.prepare(
      `INSERT INTO team_brand_profiles (company_id, brand_name, logo_url, theme_color, welcome_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(badBrandId, "Bad Brand", null, "#000000", "Bad", now, now);

    db.prepare(
      `INSERT INTO team_invites (id, company_id, token, status, expires_at, usage_limit, usage_count, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(badInviteId, badCompanyId, `token_${badInviteId}`, "active", now + 60_000, 1, 0, "console:admin", now, now);

    db.prepare(
      `INSERT INTO team_member_sessions (id, company_id, invite_id, display_name, session_token, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(badSessionId, badCompanyId, badInviteId, "Bad Member", `tok_${badSessionId}`, now, now);

    db.prepare(
      `INSERT INTO team_conversations (id, company_id, team_id, member_id, title, status, last_message_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      badConversationId,
      badCompanyId,
      "team_bad",
      "missing_member",
      "Bad Conversation",
      "open",
      now,
      now,
      now
    );

    db.prepare(
      `INSERT INTO team_messages (id, company_id, conversation_id, sender_type, sender_id, message_type, body, stream_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      badMessageId,
      badCompanyId,
      "missing_conversation",
      "member",
      "missing_sender",
      "text",
      "Bad message",
      "done",
      now
    );
    db.exec("PRAGMA foreign_keys = ON;");

    ensureTeamV1Tables();

    const badBrandCount = db.query(`SELECT COUNT(*) as count FROM team_brand_profiles WHERE company_id = ?`).get(
      badCompanyId
    ) as { count: number };
    const badInviteCount = db.query(`SELECT COUNT(*) as count FROM team_invites WHERE id = ?`).get(badInviteId) as {
      count: number;
    };
    const badSessionCount = db
      .query(`SELECT COUNT(*) as count FROM team_member_sessions WHERE id = ?`)
      .get(badSessionId) as { count: number };
    const badConversationCount = db
      .query(`SELECT COUNT(*) as count FROM team_conversations WHERE id = ?`)
      .get(badConversationId) as { count: number };
    const badMessageCount = db.query(`SELECT COUNT(*) as count FROM team_messages WHERE id = ?`).get(
      badMessageId
    ) as { count: number };

    expect(badBrandCount.count).toBe(0);
    expect(badInviteCount.count).toBe(0);
    expect(badSessionCount.count).toBe(0);
    expect(badConversationCount.count).toBe(0);
    expect(badMessageCount.count).toBe(0);

    const goodInviteCount = db.query(`SELECT COUNT(*) as count FROM team_invites WHERE id = ?`).get(invite.id) as {
      count: number;
    };
    const goodMessageCount = db.query(`SELECT COUNT(*) as count FROM team_messages WHERE conversation_id = ?`).get(
      conversationId
    ) as { count: number };
    expect(goodInviteCount.count).toBe(1);
    expect(goodMessageCount.count).toBe(1);
  });

  test("creates read indexes for member conversation and message queries", () => {
    const conversationIndexes = db.query(`PRAGMA index_list('team_conversations')`).all() as Array<{ name: string }>;
    const messageIndexes = db.query(`PRAGMA index_list('team_messages')`).all() as Array<{ name: string }>;

    expect(conversationIndexes.some((idx) => idx.name === "idx_team_conversations_company_member_updated")).toBe(true);
    expect(messageIndexes.some((idx) => idx.name === "idx_team_messages_conversation_company_created")).toBe(true);
  });

  test("repair removes conversation with valid member but invalid team reference", () => {
    const companyId = newCompanyId("company_repair_team_fk");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);

    const invite = createInviteLink({
      companyId,
      createdBy: "console:admin",
      usageLimit: 2,
      expiresAt: Date.now() + 60_000,
    });
    const member = createMemberSession({
      companyId,
      inviteId: invite.id,
      displayName: "Iris",
    });
    const validConversationId = createTeamConversation({
      companyId,
      teamId,
      memberId: member.id,
      title: "Valid conversation",
    });

    db.exec("PRAGMA foreign_keys = OFF;");
    const now = nowMs();
    const invalidTeamConversationId = `tconv_${crypto.randomUUID().replaceAll("-", "")}`;
    db.prepare(
      `INSERT INTO team_conversations (id, company_id, team_id, member_id, title, status, last_message_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      invalidTeamConversationId,
      companyId,
      "team_missing",
      member.id,
      "Broken team reference",
      "open",
      now,
      now,
      now
    );
    db.exec("PRAGMA foreign_keys = ON;");

    ensureTeamV1Tables();

    const invalidConversationCount = db
      .query(`SELECT COUNT(*) AS count FROM team_conversations WHERE id = ?`)
      .get(invalidTeamConversationId) as { count: number };
    const validConversationCount = db
      .query(`SELECT COUNT(*) AS count FROM team_conversations WHERE id = ?`)
      .get(validConversationId) as { count: number };
    const memberCount = db.query(`SELECT COUNT(*) AS count FROM team_member_sessions WHERE id = ?`).get(member.id) as {
      count: number;
    };

    expect(invalidConversationCount.count).toBe(0);
    expect(validConversationCount.count).toBe(1);
    expect(memberCount.count).toBe(1);
  });

  test("upgrades legacy attachment rows to message-linked attachments with enforced integrity", () => {
    const companyId = newCompanyId("company_attachment_upgrade");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);

    const invite = createInviteLink({
      companyId,
      createdBy: "console:admin",
      usageLimit: 2,
      expiresAt: Date.now() + 60_000,
    });
    const member = createMemberSession({
      companyId,
      inviteId: invite.id,
      displayName: "Iris",
    });
    const conversationId = createTeamConversation({
      companyId,
      teamId,
      memberId: member.id,
      title: "Legacy attachment migration",
    });
    const wrongLinkedMessage = createTeamMessage({
      companyId,
      conversationId,
      senderType: "member",
      senderId: member.id,
      messageType: "text",
      body: "Wrong linked message",
    });

    db.exec("PRAGMA foreign_keys = OFF;");
    db.exec("DROP TABLE team_attachments;");
    db.exec(`
      CREATE TABLE team_attachments (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        message_id TEXT,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        storage_path TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    const attachmentId = `tatt_${crypto.randomUUID().replaceAll("-", "")}`;
    const secondAttachmentId = `tatt_${crypto.randomUUID().replaceAll("-", "")}`;
    const createdAt = nowMs();
    db.prepare(
      `INSERT INTO team_attachments
        (id, company_id, conversation_id, member_id, message_id, original_name, stored_name, mime_type, size_bytes, storage_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      attachmentId,
      companyId,
      conversationId,
      member.id,
      wrongLinkedMessage.id,
      "legacy-file.txt",
      "1712000000_legacy-file.txt",
      "text/plain",
      128,
      `${companyId}/1712000000_legacy-file.txt`,
      createdAt
    );
    db.prepare(
      `INSERT INTO team_attachments
        (id, company_id, conversation_id, member_id, message_id, original_name, stored_name, mime_type, size_bytes, storage_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      secondAttachmentId,
      companyId,
      conversationId,
      member.id,
      wrongLinkedMessage.id,
      "legacy-image.png",
      "1712000000_legacy-image.png",
      "image/png",
      256,
      `${companyId}/1712000000_legacy-image.png`,
      createdAt
    );
    db.exec("PRAGMA foreign_keys = ON;");

    ensureTeamV1Tables();

    const attachmentColumns = db.query(`PRAGMA table_info('team_attachments')`).all() as Array<{
      name: string;
      notnull: number;
    }>;
    const attachmentFks = db.query(`PRAGMA foreign_key_list(team_attachments)`).all() as Array<{
      table: string;
      from: string;
      to: string;
    }>;

    expect(attachmentColumns.some((column) => column.name === "message_id" && column.notnull === 1)).toBe(true);
    expect(attachmentColumns.some((column) => column.name === "kind" && column.notnull === 1)).toBe(true);
    expect(
      attachmentFks.some((fk) => fk.table === "team_messages" && fk.from === "message_id" && fk.to === "id")
    ).toBe(true);

    const migratedAttachment = db
      .query(
        `SELECT
           message_id AS messageId,
           kind
         FROM team_attachments
         WHERE id = ?`
      )
      .get(attachmentId) as { messageId: string; kind: string } | null;
    expect(migratedAttachment?.kind).toBe("file");
    expect(typeof migratedAttachment?.messageId).toBe("string");
    expect(migratedAttachment?.messageId).not.toBe(wrongLinkedMessage.id);

    const secondMigratedAttachment = db
      .query(
        `SELECT
           message_id AS messageId,
           kind
         FROM team_attachments
         WHERE id = ?`
      )
      .get(secondAttachmentId) as { messageId: string; kind: string } | null;
    expect(secondMigratedAttachment?.kind).toBe("image");
    expect(typeof secondMigratedAttachment?.messageId).toBe("string");
    expect(secondMigratedAttachment?.messageId).not.toBe(wrongLinkedMessage.id);
    expect(secondMigratedAttachment?.messageId).not.toBe(migratedAttachment?.messageId);

    const migratedMessage = db
      .query(
        `SELECT
           id,
           conversation_id AS conversationId,
           sender_type AS senderType,
           sender_id AS senderId,
           message_type AS messageType,
           body
         FROM team_messages
         WHERE id = ?`
      )
      .get(migratedAttachment?.messageId ?? "") as
      | {
          id: string;
          conversationId: string;
          senderType: string;
          senderId: string | null;
          messageType: string;
          body: string;
        }
      | null;
    expect(migratedMessage?.conversationId).toBe(conversationId);
    expect(migratedMessage?.senderType).toBe("member");
    expect(migratedMessage?.senderId).toBe(member.id);
    expect(migratedMessage?.messageType).toBe("file");
    expect(migratedMessage?.body).toBe("legacy-file.txt");
  });

  test("repairs current-schema attachment rows linked to the wrong same-conversation message", () => {
    const companyId = newCompanyId("company_attachment_current_schema");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);

    const invite = createInviteLink({
      companyId,
      createdBy: "console:admin",
      usageLimit: 2,
      expiresAt: Date.now() + 60_000,
    });
    const member = createMemberSession({
      companyId,
      inviteId: invite.id,
      displayName: "Iris",
    });
    const conversationId = createTeamConversation({
      companyId,
      teamId,
      memberId: member.id,
      title: "Attachment semantic repair",
    });
    const wrongMessage = createTeamMessage({
      companyId,
      conversationId,
      senderType: "member",
      senderId: member.id,
      messageType: "file",
      body: "Wrong same-conversation file message",
    });

    const attachmentId = `tatt_${crypto.randomUUID().replaceAll("-", "")}`;
    db.prepare(
      `INSERT INTO team_attachments
        (id, company_id, conversation_id, member_id, message_id, kind, original_name, stored_name, mime_type, size_bytes, storage_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      attachmentId,
      companyId,
      conversationId,
      member.id,
      wrongMessage.id,
      "file",
      "current-schema.txt",
      "1712000000_current-schema.txt",
      "text/plain",
      512,
      `${companyId}/1712000000_current-schema.txt`,
      nowMs()
    );

    ensureTeamV1Tables();

    const repairedAttachment = db
      .query(
        `SELECT
           message_id AS messageId,
           kind
         FROM team_attachments
         WHERE id = ?`
      )
      .get(attachmentId) as { messageId: string; kind: string } | null;
    expect(repairedAttachment?.kind).toBe("file");
    expect(repairedAttachment?.messageId).not.toBe(wrongMessage.id);

    const repairedMessage = db
      .query(
        `SELECT
           conversation_id AS conversationId,
           message_type AS messageType,
           body
         FROM team_messages
         WHERE id = ?`
      )
      .get(repairedAttachment?.messageId ?? "") as
      | {
          conversationId: string;
          messageType: string;
          body: string;
        }
      | null;
    expect(repairedMessage?.conversationId).toBe(conversationId);
    expect(repairedMessage?.messageType).toBe("file");
    expect(repairedMessage?.body).toBe("current-schema.txt");
  });

  test("cold-start module initialization upgrades legacy attachment schema without crashing", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "clawos-team-db-"));
    const dbPath = path.join(tempDir, "team.db");
    const legacyDb = new Database(dbPath, { create: true, strict: true });

    try {
      legacyDb.exec(`
        CREATE TABLE team_attachments (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          member_id TEXT NOT NULL,
          original_name TEXT NOT NULL,
          stored_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          storage_path TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
      legacyDb.close();

      const child = Bun.spawnSync({
        cmd: [
          "bun",
          "-e",
          `const mod = await import("./src/db.ts");
           const cols = mod.db.query("PRAGMA table_info(team_attachments)").all().map((row) => row.name);
           console.log(JSON.stringify(cols));`,
        ],
        cwd: "/Users/ke/code/clawos/team",
        env: {
          ...process.env,
          TEAM_DB_PATH: dbPath,
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(child.exitCode).toBe(0);
      const output = new TextDecoder().decode(child.stdout).trim();
      const columns = JSON.parse(output) as string[];
      expect(columns).toContain("message_id");
      expect(columns).toContain("kind");
    } finally {
      try {
        legacyDb.close();
      } catch {}
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
