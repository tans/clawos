import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { createApp } from "../../src/app";
import { db, nowMs } from "../../src/db";
import {
  createInviteLink,
  createTeamProfile,
  ensureTeamV1Tables,
  upsertGatewayAgents,
} from "../../src/models/team-v1.model";
import { companyUploadDir, MAX_UPLOAD_BYTES } from "../../src/utils/storage";

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

function teamSessionHeaders(sessionToken: string): HeadersInit {
  return {
    "content-type": "application/json",
    "x-team-session": sessionToken,
  };
}

describe("team chat api", () => {
  beforeEach(() => {
    ensureTeamV1Tables();
  });

  test("joins by invite token and persists conversation + member and primary-agent messages", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_chat");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);
    const invite = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });

    const joinRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invite.token, displayName: "Alice" }),
    });
    expect(joinRes.status).toBe(201);
    const joinBody = await joinRes.json();
    expect(joinBody.companyId).toBe(companyId);
    expect(typeof joinBody.sessionToken).toBe("string");
    expect(joinBody.sessionToken.length).toBeGreaterThan(10);

    const createConversationRes = await app.request("/api/team/chat/conversations", {
      method: "POST",
      headers: teamSessionHeaders(joinBody.sessionToken),
      body: JSON.stringify({
        teamId,
        title: "Need pricing details",
      }),
    });
    expect(createConversationRes.status).toBe(201);
    const createdConversation = await createConversationRes.json();
    expect(createdConversation.conversation?.companyId).toBe(companyId);
    expect(createdConversation.conversation?.teamId).toBe(teamId);
    const conversationId = createdConversation.conversation?.id;
    expect(typeof conversationId).toBe("string");

    const listRes = await app.request("/api/team/chat/conversations", {
      method: "GET",
      headers: teamSessionHeaders(joinBody.sessionToken),
    });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(Array.isArray(listBody.conversations)).toBe(true);
    expect(listBody.conversations).toHaveLength(1);
    expect(listBody.conversations[0]?.id).toBe(conversationId);

    const detailRes = await app.request(`/api/team/chat/conversations/${conversationId}`, {
      method: "GET",
      headers: teamSessionHeaders(joinBody.sessionToken),
    });
    expect(detailRes.status).toBe(200);
    const detailBody = await detailRes.json();
    expect(detailBody.conversation?.id).toBe(conversationId);
    expect(Array.isArray(detailBody.messages)).toBe(true);
    expect(detailBody.messages).toHaveLength(0);

    const messageRes = await app.request(`/api/team/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: teamSessionHeaders(joinBody.sessionToken),
      body: JSON.stringify({ body: "Hello team, can I get pricing?" }),
    });
    expect(messageRes.status).toBe(201);
    const messageBody = await messageRes.json();
    expect(messageBody.memberMessage?.senderType).toBe("member");
    expect(messageBody.memberMessage?.body).toBe("Hello team, can I get pricing?");
    expect(messageBody.agentMessage?.senderType).toBe("agent");
    expect(messageBody.agentMessage?.senderId).toBe("agent_sales_1");
    expect(messageBody.agentMessage?.streamStatus).toBe("done");

    const updatedDetailRes = await app.request(`/api/team/chat/conversations/${conversationId}`, {
      method: "GET",
      headers: teamSessionHeaders(joinBody.sessionToken),
    });
    expect(updatedDetailRes.status).toBe(200);
    const updatedDetailBody = await updatedDetailRes.json();
    expect(updatedDetailBody.messages).toHaveLength(2);
    expect(updatedDetailBody.messages[0]?.body).toBe("Hello team, can I get pricing?");
    expect(updatedDetailBody.messages[1]?.senderType).toBe("agent");
    expect(updatedDetailBody.messages[1]?.senderId).toBe("agent_sales_1");
    expect(updatedDetailBody.messages[1]?.streamStatus).toBe("done");
    expect(updatedDetailBody.messages[1]?.body).toContain("Hello team, can I get pricing?");
  });

  test("uploads a conversation attachment, persists metadata, and exposes it on conversation detail reload", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_attachments");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);
    const invite = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });

    const joinRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invite.token, displayName: "Alice" }),
    });
    expect(joinRes.status).toBe(201);
    const joinBody = await joinRes.json();

    const createConversationRes = await app.request("/api/team/chat/conversations", {
      method: "POST",
      headers: teamSessionHeaders(joinBody.sessionToken),
      body: JSON.stringify({
        teamId,
        title: "Need pricing details",
      }),
    });
    expect(createConversationRes.status).toBe(201);
    const createdConversation = await createConversationRes.json();
    const conversationId = createdConversation.conversation?.id;
    expect(typeof conversationId).toBe("string");

    const formData = new FormData();
    formData.set("file", new File(["tier-1: 99 usd"], "pricing-sheet.txt", { type: "text/plain" }));

    const uploadRes = await app.request(`/api/team/chat/conversations/${conversationId}/attachments`, {
      method: "POST",
      headers: {
        "x-team-session": joinBody.sessionToken,
      },
      body: formData,
    });
    expect(uploadRes.status).toBe(201);
    const uploadBody = await uploadRes.json();
    expect(uploadBody.attachment?.companyId).toBe(companyId);
    expect(uploadBody.attachment?.conversationId).toBe(conversationId);
    expect(uploadBody.attachment?.memberId).toBe(joinBody.memberId);
    expect(uploadBody.attachment?.messageId).toBe(uploadBody.message?.id);
    expect(uploadBody.attachment?.kind).toBe("file");
    expect(uploadBody.attachment?.originalName).toBe("pricing-sheet.txt");
    expect(uploadBody.attachment?.mimeType).toBe("text/plain");
    expect(uploadBody.attachment?.sizeBytes).toBeGreaterThan(0);
    expect(uploadBody.attachment?.storagePath).toContain(companyId);
    expect(uploadBody.message?.senderType).toBe("member");
    expect(uploadBody.message?.messageType).toBe("file");
    expect(uploadBody.message?.body).toBe("pricing-sheet.txt");

    const persistedAttachment = db
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
           storage_path AS storagePath
         FROM team_attachments
         WHERE id = ?`
      )
      .get(uploadBody.attachment?.id) as
      | {
          id: string;
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
        }
      | null;

    expect(persistedAttachment).not.toBeNull();
    expect(persistedAttachment?.companyId).toBe(companyId);
    expect(persistedAttachment?.conversationId).toBe(conversationId);
    expect(persistedAttachment?.memberId).toBe(joinBody.memberId);
    expect(persistedAttachment?.messageId).toBe(uploadBody.message?.id);
    expect(persistedAttachment?.kind).toBe("file");
    expect(persistedAttachment?.originalName).toBe("pricing-sheet.txt");

    const detailRes = await app.request(`/api/team/chat/conversations/${conversationId}`, {
      method: "GET",
      headers: teamSessionHeaders(joinBody.sessionToken),
    });
    expect(detailRes.status).toBe(200);
    const detailBody = await detailRes.json();
    expect(detailBody.messages).toHaveLength(1);
    expect(detailBody.messages[0]?.id).toBe(uploadBody.message?.id);
    expect(detailBody.messages[0]?.messageType).toBe("file");
    expect(detailBody.messages[0]?.body).toBe("pricing-sheet.txt");
    expect(detailBody.attachments).toHaveLength(1);
    expect(detailBody.attachments[0]?.id).toBe(uploadBody.attachment?.id);
    expect(detailBody.attachments[0]?.messageId).toBe(uploadBody.message?.id);
    expect(detailBody.attachments[0]?.kind).toBe("file");
    expect(detailBody.attachments[0]?.originalName).toBe("pricing-sheet.txt");
  });

  test("uploads image attachments as image timeline messages", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_image_attachments");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);
    const invite = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });

    const joinRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invite.token, displayName: "Alice" }),
    });
    expect(joinRes.status).toBe(201);
    const joinBody = await joinRes.json();

    const createConversationRes = await app.request("/api/team/chat/conversations", {
      method: "POST",
      headers: teamSessionHeaders(joinBody.sessionToken),
      body: JSON.stringify({ teamId, title: "Need image review" }),
    });
    expect(createConversationRes.status).toBe(201);
    const conversationId = (await createConversationRes.json()).conversation?.id;

    const formData = new FormData();
    formData.set("file", new File(["fake-image-bytes"], "diagram.png", { type: "image/png" }));

    const uploadRes = await app.request(`/api/team/chat/conversations/${conversationId}/attachments`, {
      method: "POST",
      headers: { "x-team-session": joinBody.sessionToken },
      body: formData,
    });
    expect(uploadRes.status).toBe(201);
    const uploadBody = await uploadRes.json();
    expect(uploadBody.message?.messageType).toBe("image");
    expect(uploadBody.attachment?.kind).toBe("image");

    const detailRes = await app.request(`/api/team/chat/conversations/${conversationId}`, {
      method: "GET",
      headers: teamSessionHeaders(joinBody.sessionToken),
    });
    expect(detailRes.status).toBe(200);
    const detailBody = await detailRes.json();
    expect(detailBody.messages).toHaveLength(1);
    expect(detailBody.messages[0]?.messageType).toBe("image");
    expect(detailBody.attachments).toHaveLength(1);
    expect(detailBody.attachments[0]?.kind).toBe("image");
  });

  test("rolls back attachment message state and removes uploaded file when attachment persistence fails", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_attachment_atomicity");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);
    const invite = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });

    const joinRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invite.token, displayName: "Alice" }),
    });
    expect(joinRes.status).toBe(201);
    const joinBody = await joinRes.json();

    const createConversationRes = await app.request("/api/team/chat/conversations", {
      method: "POST",
      headers: teamSessionHeaders(joinBody.sessionToken),
      body: JSON.stringify({ teamId, title: "Attachment failure rollback" }),
    });
    expect(createConversationRes.status).toBe(201);
    const conversationId = (await createConversationRes.json()).conversation?.id;

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS team_attachments_fail_insert
      BEFORE INSERT ON team_attachments
      BEGIN
        SELECT RAISE(ABORT, 'forced team attachment insert failure');
      END;
    `);

    const formData = new FormData();
    formData.set("file", new File(["rollback-me"], "rollback.txt", { type: "text/plain" }));

    try {
      const uploadRes = await app.request(`/api/team/chat/conversations/${conversationId}/attachments`, {
        method: "POST",
        headers: { "x-team-session": joinBody.sessionToken },
        body: formData,
      });
      expect(uploadRes.status).toBe(500);
    } finally {
      db.exec("DROP TRIGGER IF EXISTS team_attachments_fail_insert;");
    }

    const messageCount = db
      .query(`SELECT COUNT(*) AS count FROM team_messages WHERE conversation_id = ?`)
      .get(conversationId) as { count: number };
    const attachmentCount = db
      .query(`SELECT COUNT(*) AS count FROM team_attachments WHERE conversation_id = ?`)
      .get(conversationId) as { count: number };
    expect(messageCount.count).toBe(0);
    expect(attachmentCount.count).toBe(0);

    const uploadDir = companyUploadDir(companyId);
    const fileCount = existsSync(uploadDir) ? readdirSync(uploadDir).length : 0;
    expect(fileCount).toBe(0);
  });

  test("rejects oversized attachment uploads before writing to disk", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_attachment_too_large");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);
    const invite = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });

    const joinRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invite.token, displayName: "Alice" }),
    });
    expect(joinRes.status).toBe(201);
    const joinBody = await joinRes.json();

    const createConversationRes = await app.request("/api/team/chat/conversations", {
      method: "POST",
      headers: teamSessionHeaders(joinBody.sessionToken),
      body: JSON.stringify({ teamId, title: "Attachment too large" }),
    });
    expect(createConversationRes.status).toBe(201);
    const conversationId = (await createConversationRes.json()).conversation?.id;

    const formData = new FormData();
    formData.set(
      "file",
      new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "too-large.bin", { type: "application/octet-stream" })
    );

    const uploadRes = await app.request(`/api/team/chat/conversations/${conversationId}/attachments`, {
      method: "POST",
      headers: { "x-team-session": joinBody.sessionToken },
      body: formData,
    });
    expect(uploadRes.status).toBe(400);

    const uploadDir = companyUploadDir(companyId);
    const fileCount = existsSync(uploadDir) ? readdirSync(uploadDir).length : 0;
    expect(fileCount).toBe(0);
  });

  test("rejects requests whose declared multipart size exceeds the upload limit before parsing", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_attachment_content_length");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);
    const invite = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });

    const joinRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invite.token, displayName: "Alice" }),
    });
    expect(joinRes.status).toBe(201);
    const joinBody = await joinRes.json();

    const createConversationRes = await app.request("/api/team/chat/conversations", {
      method: "POST",
      headers: teamSessionHeaders(joinBody.sessionToken),
      body: JSON.stringify({ teamId, title: "Attachment content length guard" }),
    });
    expect(createConversationRes.status).toBe(201);
    const conversationId = (await createConversationRes.json()).conversation?.id;

    const formData = new FormData();
    formData.set("file", new File(["small"], "small.txt", { type: "text/plain" }));

    const uploadRes = await app.request(`/api/team/chat/conversations/${conversationId}/attachments`, {
      method: "POST",
      headers: {
        "x-team-session": joinBody.sessionToken,
        "content-length": String(MAX_UPLOAD_BYTES + 64 * 1024 + 1),
      },
      body: formData,
    });
    expect(uploadRes.status).toBe(400);
  });

  test("rejects malformed multipart attachment requests with a client error", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_attachment_bad_multipart");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);
    const invite = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });

    const joinRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invite.token, displayName: "Alice" }),
    });
    expect(joinRes.status).toBe(201);
    const joinBody = await joinRes.json();

    const createConversationRes = await app.request("/api/team/chat/conversations", {
      method: "POST",
      headers: teamSessionHeaders(joinBody.sessionToken),
      body: JSON.stringify({ teamId, title: "Malformed multipart" }),
    });
    expect(createConversationRes.status).toBe(201);
    const conversationId = (await createConversationRes.json()).conversation?.id;

    const uploadRes = await app.request(`/api/team/chat/conversations/${conversationId}/attachments`, {
      method: "POST",
      headers: {
        "x-team-session": joinBody.sessionToken,
        "content-type": "multipart/form-data; boundary=badboundary",
      },
      body: "--wrongboundary\r\ncontent\r\n",
    });
    expect(uploadRes.status).toBe(400);
  });

  test("rejects invalid, expired, inactive, and exhausted invites", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_invites");
    ensureCompanyFixture(companyId);
    ensureTeamFixture(companyId);

    const invalidTokenRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "invite_missing", displayName: "Alice" }),
    });
    expect(invalidTokenRes.status).toBe(404);

    const expiredInvite = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 2,
      expiresAt: nowMs() - 1000,
    });
    const expiredRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: expiredInvite.token, displayName: "Alice" }),
    });
    expect(expiredRes.status).toBe(400);

    const inactiveInvite = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 2,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });
    db.prepare(`UPDATE team_invites SET status = 'inactive', updated_at = ? WHERE id = ?`).run(nowMs(), inactiveInvite.id);
    const inactiveRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: inactiveInvite.token, displayName: "Alice" }),
    });
    expect(inactiveRes.status).toBe(400);

    const exhaustedInvite = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 1,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });
    const firstUseRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: exhaustedInvite.token, displayName: "Alice" }),
    });
    expect(firstUseRes.status).toBe(201);

    const exhaustedRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: exhaustedInvite.token, displayName: "Bob" }),
    });
    expect(exhaustedRes.status).toBe(400);
  });

  test("surfaces unexpected invite-join session creation failures as server errors", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_join_fault");
    ensureCompanyFixture(companyId);
    ensureTeamFixture(companyId);
    const invite = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS team_member_sessions_fail_insert
      BEFORE INSERT ON team_member_sessions
      BEGIN
        SELECT RAISE(ABORT, 'forced team member session insert failure');
      END;
    `);

    try {
      const joinRes = await app.request("/api/team/chat/invites/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: invite.token, displayName: "Alice" }),
      });

      expect(joinRes.status).toBe(500);
    } finally {
      db.exec("DROP TRIGGER IF EXISTS team_member_sessions_fail_insert;");
    }
  });

  test("requires team session header and enforces company scope on conversations", async () => {
    const app = createApp();
    const companyA = newCompanyId("company_scope_a");
    const companyB = newCompanyId("company_scope_b");
    ensureCompanyFixture(companyA);
    ensureCompanyFixture(companyB);
    const { teamId: teamIdA } = ensureTeamFixture(companyA);
    const { teamId: teamIdB } = ensureTeamFixture(companyB);

    const inviteA = createInviteLink({
      companyId: companyA,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });
    const inviteB = createInviteLink({
      companyId: companyB,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });

    const joinA = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: inviteA.token, displayName: "Alice" }),
    });
    const joinB = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: inviteB.token, displayName: "Bob" }),
    });
    expect(joinA.status).toBe(201);
    expect(joinB.status).toBe(201);
    const joinABody = await joinA.json();
    const joinBBody = await joinB.json();

    const unauthCreateRes = await app.request("/api/team/chat/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ teamId: teamIdA, title: "No session should fail" }),
    });
    expect(unauthCreateRes.status).toBe(401);

    const companyBConversationRes = await app.request("/api/team/chat/conversations", {
      method: "POST",
      headers: teamSessionHeaders(joinBBody.sessionToken),
      body: JSON.stringify({ teamId: teamIdB, title: "Company B only" }),
    });
    expect(companyBConversationRes.status).toBe(201);
    const companyBConversation = await companyBConversationRes.json();
    const conversationId = companyBConversation.conversation?.id;

    const crossCompanyDetailRes = await app.request(`/api/team/chat/conversations/${conversationId}`, {
      method: "GET",
      headers: teamSessionHeaders(joinABody.sessionToken),
    });
    expect(crossCompanyDetailRes.status).toBe(404);

    const crossCompanyMessageRes = await app.request(`/api/team/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: teamSessionHeaders(joinABody.sessionToken),
      body: JSON.stringify({ body: "Should be rejected" }),
    });
    expect(crossCompanyMessageRes.status).toBe(404);

    const crossCompanyUploadBody = new FormData();
    crossCompanyUploadBody.set("file", new File(["cross-company upload"], "cross-company.txt", { type: "text/plain" }));
    const crossCompanyUploadRes = await app.request(`/api/team/chat/conversations/${conversationId}/attachments`, {
      method: "POST",
      headers: {
        "x-team-session": joinABody.sessionToken,
      },
      body: crossCompanyUploadBody,
    });
    expect(crossCompanyUploadRes.status).toBe(404);
  });

  test("enforces member isolation within the same company", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_same_scope");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);

    const inviteA = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });
    const inviteB = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });

    const joinARes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: inviteA.token, displayName: "Alice" }),
    });
    const joinBRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: inviteB.token, displayName: "Bob" }),
    });
    expect(joinARes.status).toBe(201);
    expect(joinBRes.status).toBe(201);
    const joinABody = await joinARes.json();
    const joinBBody = await joinBRes.json();

    const conversationRes = await app.request("/api/team/chat/conversations", {
      method: "POST",
      headers: teamSessionHeaders(joinABody.sessionToken),
      body: JSON.stringify({ teamId, title: "Member A conversation" }),
    });
    expect(conversationRes.status).toBe(201);
    const conversationBody = await conversationRes.json();
    const conversationId = conversationBody.conversation?.id;
    expect(typeof conversationId).toBe("string");

    const memberBListRes = await app.request("/api/team/chat/conversations", {
      method: "GET",
      headers: teamSessionHeaders(joinBBody.sessionToken),
    });
    expect(memberBListRes.status).toBe(200);
    const memberBListBody = await memberBListRes.json();
    expect(memberBListBody.conversations).toHaveLength(0);

    const memberBDetailRes = await app.request(`/api/team/chat/conversations/${conversationId}`, {
      method: "GET",
      headers: teamSessionHeaders(joinBBody.sessionToken),
    });
    expect(memberBDetailRes.status).toBe(404);

    const memberBMessageRes = await app.request(`/api/team/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: teamSessionHeaders(joinBBody.sessionToken),
      body: JSON.stringify({ body: "Cross-member write should fail" }),
    });
    expect(memberBMessageRes.status).toBe(404);

    const memberBUploadBody = new FormData();
    memberBUploadBody.set("file", new File(["cross-member upload"], "cross-member.txt", { type: "text/plain" }));
    const memberBAttachmentRes = await app.request(`/api/team/chat/conversations/${conversationId}/attachments`, {
      method: "POST",
      headers: {
        "x-team-session": joinBBody.sessionToken,
      },
      body: memberBUploadBody,
    });
    expect(memberBAttachmentRes.status).toBe(404);
  });

  test("permanently revokes existing sessions after invite becomes inactive, even if invite is reactivated", async () => {
    const app = createApp();
    const companyId = newCompanyId("company_revoke");
    ensureCompanyFixture(companyId);
    const { teamId } = ensureTeamFixture(companyId);

    const invite = createInviteLink({
      companyId,
      createdBy: "console:+10000000000",
      usageLimit: 5,
      expiresAt: nowMs() + 60 * 60 * 1000,
    });

    const joinRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invite.token, displayName: "Alice" }),
    });
    expect(joinRes.status).toBe(201);
    const joinBody = await joinRes.json();

    const createConversationRes = await app.request("/api/team/chat/conversations", {
      method: "POST",
      headers: teamSessionHeaders(joinBody.sessionToken),
      body: JSON.stringify({ teamId, title: "Before revoke" }),
    });
    expect(createConversationRes.status).toBe(201);
    const createdConversation = await createConversationRes.json();
    const conversationId = createdConversation.conversation?.id;
    expect(typeof conversationId).toBe("string");

    db.prepare(`UPDATE team_invites SET status = 'inactive', updated_at = ? WHERE id = ?`).run(nowMs(), invite.id);

    const inactiveRes = await app.request("/api/team/chat/conversations", {
      method: "GET",
      headers: teamSessionHeaders(joinBody.sessionToken),
    });
    expect(inactiveRes.status).toBe(401);

    const revokedSessionRow = db
      .query(`SELECT revoked_at AS revokedAt FROM team_member_sessions WHERE id = ?`)
      .get(joinBody.memberId) as { revokedAt: number | null } | null;
    expect(revokedSessionRow?.revokedAt).not.toBeNull();

    const conversationCount = db
      .query(`SELECT COUNT(*) AS count FROM team_conversations WHERE id = ?`)
      .get(conversationId) as { count: number };
    expect(conversationCount.count).toBe(1);

    db.prepare(`UPDATE team_invites SET status = 'active', expires_at = ?, updated_at = ? WHERE id = ?`).run(
      nowMs() + 2 * 60 * 60 * 1000,
      nowMs(),
      invite.id
    );

    const rejoinRes = await app.request("/api/team/chat/invites/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invite.token, displayName: "Bob" }),
    });
    expect(rejoinRes.status).toBe(201);
    const rejoinBody = await rejoinRes.json();

    const oldSessionRes = await app.request("/api/team/chat/conversations", {
      method: "GET",
      headers: teamSessionHeaders(joinBody.sessionToken),
    });
    expect(oldSessionRes.status).toBe(401);

    const newSessionRes = await app.request("/api/team/chat/conversations", {
      method: "GET",
      headers: teamSessionHeaders(rejoinBody.sessionToken),
    });
    expect(newSessionRes.status).toBe(200);
  });
});
