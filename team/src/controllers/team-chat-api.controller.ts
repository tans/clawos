import { Hono, type Context, type Next } from "hono";
import type { AppEnv } from "../types";
import {
  CreateMemberSessionError,
  createAttachmentMessageAndRecord,
  createMemberSession,
  createTeamConversation,
  createTeamMessage,
  getConversationById,
  getConversationDetail,
  getInviteByToken,
  getMemberSessionByToken,
  getTeamProfileById,
  listConversationsByMember,
  touchMemberSession,
} from "../models/team-v1.model";
import { streamPrimaryAgentReply } from "../services/team-runtime.service";
import { deleteUpload, MAX_UPLOAD_BYTES, persistUpload } from "../utils/storage";

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

function readFormFile(
  body: Record<string, string | File | (string | File)[]>,
  key: string
): File | null {
  const value = body[key];
  if (value instanceof File) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item instanceof File) {
        return item;
      }
    }
  }
  return null;
}

async function requireTeamSession(c: Context<AppEnv>, next: Next) {
  const sessionToken = requireNonEmptyString(c.req.header("x-team-session"));
  if (!sessionToken) {
    return c.json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }
  const session = getMemberSessionByToken(sessionToken);
  if (!session) {
    return c.json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  touchMemberSession(session.companyId, session.id);
  c.set("teamMemberSession", session);
  await next();
}

export function createTeamChatApiController(): Hono<AppEnv> {
  const controller = new Hono<AppEnv>();

  controller.use("/api/team/chat/conversations", requireTeamSession);
  controller.use("/api/team/chat/conversations/*", requireTeamSession);

  controller.post("/api/team/chat/invites/join", async (c) => {
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ ok: false, error: "INVALID_BODY" }, 400);
    }
    const token = requireNonEmptyString(body.token);
    const displayName = requireNonEmptyString(body.displayName);
    if (!token || !displayName) {
      return c.json({ ok: false, error: "INVALID_INVITE_JOIN" }, 400);
    }

    const invite = getInviteByToken(token);
    if (!invite) {
      return c.json({ ok: false, error: "INVITE_NOT_FOUND" }, 404);
    }

    try {
      const session = createMemberSession({
        companyId: invite.companyId,
        inviteId: invite.id,
        displayName,
      });
      return c.json(
        {
          companyId: session.companyId,
          sessionToken: session.sessionToken,
          memberId: session.id,
          displayName: session.displayName,
        },
        201
      );
    } catch (error) {
      if (error instanceof CreateMemberSessionError) {
        if (error.code === "INVITE_NOT_FOUND") {
          return c.json({ ok: false, error: "INVITE_NOT_FOUND" }, 404);
        }
        if (error.code === "INVITE_INACTIVE") {
          return c.json({ ok: false, error: "INVITE_INACTIVE" }, 400);
        }
        if (error.code === "INVITE_EXPIRED") {
          return c.json({ ok: false, error: "INVITE_EXPIRED" }, 400);
        }
        if (error.code === "INVITE_EXHAUSTED") {
          return c.json({ ok: false, error: "INVITE_EXHAUSTED" }, 400);
        }
      }
      return c.json({ ok: false, error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  });

  controller.post("/api/team/chat/conversations", async (c) => {
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ ok: false, error: "INVALID_BODY" }, 400);
    }
    const teamId = requireNonEmptyString(body.teamId);
    const title = requireNonEmptyString(body.title);
    if (!teamId || !title) {
      return c.json({ ok: false, error: "INVALID_CONVERSATION" }, 400);
    }

    const session = c.get("teamMemberSession");
    const team = getTeamProfileById(session.companyId, teamId);
    if (!team) {
      return c.json({ ok: false, error: "TEAM_NOT_FOUND" }, 404);
    }

    const conversationId = createTeamConversation({
      companyId: session.companyId,
      teamId,
      memberId: session.id,
      title,
    });
    const conversation = getConversationById(session.companyId, conversationId);
    return c.json({ conversation }, 201);
  });

  controller.get("/api/team/chat/conversations", (c) => {
    const session = c.get("teamMemberSession");
    const conversations = listConversationsByMember(session.companyId, session.id);
    return c.json({ conversations });
  });

  controller.get("/api/team/chat/conversations/:conversationId", (c) => {
    const session = c.get("teamMemberSession");
    const conversationId = c.req.param("conversationId");
    const detail = getConversationDetail(session.companyId, conversationId);
    if (!detail || detail.conversation.memberId !== session.id) {
      return c.json({ ok: false, error: "CONVERSATION_NOT_FOUND" }, 404);
    }
    return c.json({
      brand: detail.brand,
      conversation: detail.conversation,
      messages: detail.messages,
      attachments: detail.attachments,
    });
  });

  controller.post("/api/team/chat/conversations/:conversationId/messages", async (c) => {
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ ok: false, error: "INVALID_BODY" }, 400);
    }
    const messageBody = requireNonEmptyString(body.body);
    if (!messageBody) {
      return c.json({ ok: false, error: "INVALID_MESSAGE_BODY" }, 400);
    }

    const session = c.get("teamMemberSession");
    const conversationId = c.req.param("conversationId");
    const conversation = getConversationById(session.companyId, conversationId);
    if (!conversation || conversation.memberId !== session.id) {
      return c.json({ ok: false, error: "CONVERSATION_NOT_FOUND" }, 404);
    }

    const memberMessage = createTeamMessage({
      companyId: session.companyId,
      conversationId,
      senderType: "member",
      senderId: session.id,
      messageType: "text",
      body: messageBody,
    });

    const team = getTeamProfileById(session.companyId, conversation.teamId);
    if (!team) {
      return c.json({ ok: false, error: "TEAM_NOT_FOUND" }, 404);
    }

    const detail = getConversationDetail(session.companyId, conversationId);
    const deltas: string[] = [];
    for await (const delta of streamPrimaryAgentReply({
      companyId: session.companyId,
      teamId: conversation.teamId,
      conversationId,
      primaryAgentId: team.primaryAgentId,
      messageBody,
      attachments: detail?.attachments ?? [],
    })) {
      deltas.push(delta);
    }

    const agentMessage = createTeamMessage({
      companyId: session.companyId,
      conversationId,
      senderType: "agent",
      senderId: team.primaryAgentId,
      messageType: "text",
      body: deltas.join(""),
      streamStatus: "done",
    });

    return c.json({ memberMessage, agentMessage, deltas }, 201);
  });

  controller.post("/api/team/chat/conversations/:conversationId/attachments", async (c) => {
    const session = c.get("teamMemberSession");
    const conversationId = c.req.param("conversationId");
    const conversation = getConversationById(session.companyId, conversationId);
    if (!conversation || conversation.memberId !== session.id) {
      return c.json({ ok: false, error: "CONVERSATION_NOT_FOUND" }, 404);
    }

    const contentLength = Number(c.req.header("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + 64 * 1024) {
      return c.json({ ok: false, error: "INVALID_ATTACHMENT_FILE" }, 400);
    }

    let body: Record<string, string | File | (string | File)[]>;
    try {
      body = (await c.req.parseBody()) as Record<string, string | File | (string | File)[]>;
    } catch {
      return c.json({ ok: false, error: "INVALID_ATTACHMENT_FILE" }, 400);
    }
    const file = readFormFile(body, "file");
    if (!(file instanceof File) || file.size <= 0) {
      return c.json({ ok: false, error: "INVALID_ATTACHMENT_FILE" }, 400);
    }

    let upload;
    try {
      upload = await persistUpload(session.companyId, file);
    } catch {
      return c.json({ ok: false, error: "INVALID_ATTACHMENT_FILE" }, 400);
    }

    const attachmentKind = upload.mimeType.startsWith("image/") ? "image" : "file";

    try {
      const { attachment, message } = createAttachmentMessageAndRecord({
        companyId: session.companyId,
        conversationId,
        memberId: session.id,
        kind: attachmentKind,
        originalName: upload.originalName,
        storedName: upload.storedName,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        storagePath: upload.storagePath,
      });

      return c.json({ attachment, message }, 201);
    } catch {
      await deleteUpload(upload.storagePath).catch(() => undefined);
      return c.json({ ok: false, error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  });

  return controller;
}
