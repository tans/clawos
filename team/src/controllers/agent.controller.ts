import { Hono } from "hono";
import { auditLog, nowMs, newId } from "../db";
import {
  createTokenUsageSample,
  createAgentEvent,
  createHostFromHello,
  getHostById,
  listPendingCommands,
  listHostRecentEvents,
  markPendingCommandResult,
  updateHostFromHello,
  updateHostHeartbeat,
} from "../models/company.model";
import type { AppEnv } from "../types";
import { jsonError, readBearerToken, readJsonBody, safeJsonParse } from "../utils/request";
import { normalizeHostId, normalizeHostName, normalizeWalletAddress, parseLimit } from "../utils/validators";

const CLIENT_API_PREFIXES = ["/api/agent", "/api/gateway"] as const;

function parseEventSeverity(raw: unknown): "info" | "warning" | "error" {
  if (raw === "error") return "error";
  if (raw === "warning") return "warning";
  return "info";
}

export function createAgentController(): Hono<AppEnv> {
  const controller = new Hono<AppEnv>();

  const handleHello: Parameters<typeof controller.post>[1] = async (c) => {
    const body = await readJsonBody(c);
    if (!body) {
      return jsonError(c, 400, "INVALID_REQUEST", "请求体必须是 JSON。", "请检查 Content-Type。");
    }

    const hostId = normalizeHostId(body.hostId ?? body.deviceId);
    const name = normalizeHostName(body.name ?? body.deviceName);
    const controllerAddress = normalizeWalletAddress(body.controllerAddress);
    const providedTokenRaw = body.clientToken ?? body.agentToken;
    const providedToken = typeof providedTokenRaw === "string" ? providedTokenRaw.trim() : "";

    if (!hostId || !name || !controllerAddress) {
      return jsonError(c, 400, "INVALID_PARAMS", "hostId/name/controllerAddress 不合法。", "请检查上报字段。");
    }

    const platform = typeof body.platform === "string" ? body.platform.trim().slice(0, 32) : null;
    const wslDistro = typeof body.wslDistro === "string" ? body.wslDistro.trim().slice(0, 64) : null;
    const clawosVersion = typeof body.clawosVersion === "string" ? body.clawosVersion.trim().slice(0, 64) : null;

    const exists = getHostById(hostId);
    let agentToken = "";
    const now = nowMs();

    if (!exists) {
      agentToken = providedToken || newId("agt");
      createHostFromHello({
        hostId,
        name,
        agentToken,
        controllerAddress,
        platform,
        wslDistro,
        clawosVersion,
        now,
      });

      auditLog({
        actor: `agent:${hostId}`,
        action: "agent_hello_new",
        deviceId: hostId,
        controllerAddress,
        detail: { name },
      });
    } else {
      if (!providedToken || providedToken !== exists.agentToken) {
        return jsonError(
          c,
          401,
          "AGENT_AUTH_FAILED",
          "agentToken 无效。",
          "首次连接获取 token 后请持久化并在后续连接携带。"
        );
      }

      agentToken = exists.agentToken;
      updateHostFromHello({
        hostId,
        name,
        controllerAddress,
        platform,
        wslDistro,
        clawosVersion,
        now,
      });

      auditLog({
        actor: `agent:${hostId}`,
        action: "agent_hello_resume",
        deviceId: hostId,
        controllerAddress,
        detail: { name },
      });
    }

    const pendingCommands = listPendingCommands(hostId, 20);

      return c.json({
      ok: true,
      accepted: true,
      serverTimeMs: now,
      clientSessionToken: agentToken,
      host: {
        hostId,
        name,
        controllerAddress,
        agentToken,
      },
      client: {
        deviceId: hostId,
        deviceName: name,
        controllerAddress,
        clientToken: agentToken,
      },
      pendingCommands: pendingCommands.map((item) => ({
        id: item.id,
        kind: item.kind,
        payload: safeJsonParse<Record<string, unknown>>(item.payload, {}),
        createdAt: item.createdAt,
      })),
    });
  };

  const handleHeartbeat: Parameters<typeof controller.post>[1] = async (c) => {
    const body = await readJsonBody(c);
    if (!body) {
      return jsonError(c, 400, "INVALID_REQUEST", "请求体必须是 JSON。", undefined);
    }

    const hostId = normalizeHostId(body.hostId ?? body.deviceId);
    if (!hostId) {
      return jsonError(c, 400, "INVALID_HOST_ID", "hostId 不合法。", undefined);
    }

    const token = readBearerToken(c);
    const host = getHostById(hostId);
    if (!host || !token || token !== host.agentToken) {
      return jsonError(c, 401, "AGENT_AUTH_FAILED", "agentToken 校验失败。", undefined);
    }

    const wslReady = body.wslReady === true;
    const gatewayReady = body.gatewayReady === true;
    const clawosVersion = typeof body.clawosVersion === "string" ? body.clawosVersion.trim().slice(0, 64) : host.clawosVersion;
    const status = wslReady && gatewayReady ? "online" : "degraded";
    const now = nowMs();

    updateHostHeartbeat({
      hostId,
      wslReady,
      gatewayReady,
      clawosVersion,
      status,
      now,
    });

    if (host.status !== status || host.wslReady !== (wslReady ? 1 : 0) || host.gatewayReady !== (gatewayReady ? 1 : 0)) {
      createAgentEvent({
        hostId,
        eventType: "heartbeat.state_changed",
        severity: status === "degraded" ? "warning" : "info",
        title: status === "degraded" ? "主机进入降级状态" : "主机恢复在线",
        payload: {
          previous: {
            status: host.status,
            wslReady: Boolean(host.wslReady),
            gatewayReady: Boolean(host.gatewayReady),
          },
          current: { status, wslReady, gatewayReady },
        },
        now,
      });
    }

    const tokenUsageRaw = body.tokenUsage ?? body.tokens ?? null;
    if (tokenUsageRaw !== null && tokenUsageRaw !== undefined) {
      const tokensNum = typeof tokenUsageRaw === "number" ? Math.max(0, Math.floor(tokenUsageRaw)) : null;
      createTokenUsageSample(hostId, tokensNum, tokenUsageRaw, now);
    }

    return c.json({ ok: true, serverTimeMs: now, status, accepted: true });
  };

  for (const prefix of CLIENT_API_PREFIXES) {
    controller.post(`${prefix}/hello`, handleHello);
    controller.post(`${prefix}/heartbeat`, handleHeartbeat);
  }

  const handleEvents: Parameters<typeof controller.post>[1] = async (c) => {
    const body = await readJsonBody(c);
    if (!body) {
      return jsonError(c, 400, "INVALID_REQUEST", "请求体必须是 JSON。", undefined);
    }

    const hostId = normalizeHostId(body.hostId);
    if (!hostId) {
      return jsonError(c, 400, "INVALID_HOST_ID", "hostId 不合法。", undefined);
    }

    const token = readBearerToken(c);
    const host = getHostById(hostId);
    if (!host || !token || token !== host.agentToken) {
      return jsonError(c, 401, "AGENT_AUTH_FAILED", "agentToken 校验失败。", undefined);
    }

    const eventType = typeof body.eventType === "string" ? body.eventType.trim().slice(0, 64) : "";
    if (!eventType) {
      return jsonError(c, 400, "INVALID_EVENT_TYPE", "eventType 不能为空。", undefined);
    }

    const eventId = createAgentEvent({
      hostId,
      eventType,
      severity: parseEventSeverity(body.severity),
      title: typeof body.title === "string" ? body.title : null,
      payload: body.payload ?? null,
    });

    auditLog({
      actor: `agent:${hostId}`,
      action: "agent_event_reported",
      deviceId: hostId,
      controllerAddress: host.controllerAddress,
      detail: { eventId, eventType },
    });

    return c.json({ ok: true, eventId });
  };

  const handleInsights: Parameters<typeof controller.get>[1] = (c) => {
    const hostId = normalizeHostId(c.req.query("hostId"));
    if (!hostId) {
      return jsonError(c, 400, "INVALID_HOST_ID", "hostId 不合法。", undefined);
    }

    const token = readBearerToken(c);
    const host = getHostById(hostId);
    if (!host || !token || token !== host.agentToken) {
      return jsonError(c, 401, "AGENT_AUTH_FAILED", "agentToken 校验失败。", undefined);
    }

    const limit = parseLimit(c.req.query("limit"), 30);
    const events = listHostRecentEvents(hostId, limit);
    const summary = events.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.severity === "warning") acc.warning += 1;
        if (item.severity === "error") acc.error += 1;
        return acc;
      },
      { total: 0, warning: 0, error: 0 }
    );

    return c.json({
      ok: true,
      hostId,
      summary,
      events: events.map((item) => ({
        id: item.id,
        eventType: item.eventType,
        severity: item.severity,
        title: item.title,
        payload: safeJsonParse<Record<string, unknown>>(item.payload, {}),
        createdAt: item.createdAt,
      })),
    });
  };

  const handleCommands: Parameters<typeof controller.get>[1] = (c) => {
    const hostId = normalizeHostId(c.req.query("hostId"));
    if (!hostId) {
      return jsonError(c, 400, "INVALID_HOST_ID", "hostId 不合法。", undefined);
    }

    const token = readBearerToken(c);
    const host = getHostById(hostId);
    if (!host || !token || token !== host.agentToken) {
      return jsonError(c, 401, "AGENT_AUTH_FAILED", "agentToken 校验失败。", undefined);
    }

    const limit = parseLimit(c.req.query("limit"), 20);
    const commands = listPendingCommands(hostId, limit);

    return c.json({
      ok: true,
      hostId,
      commands: commands.map((item) => ({
        id: item.id,
        kind: item.kind,
        payload: safeJsonParse<Record<string, unknown>>(item.payload, {}),
        createdAt: item.createdAt,
      })),
    });
  };

  const handleCommandResult: Parameters<typeof controller.post>[1] = async (c) => {
    const commandId = c.req.param("id").trim();
    if (!commandId) {
      return jsonError(c, 400, "INVALID_COMMAND_ID", "命令 ID 不能为空。", undefined);
    }

    const body = await readJsonBody(c);
    if (!body) {
      return jsonError(c, 400, "INVALID_REQUEST", "请求体必须是 JSON。", undefined);
    }

    const hostId = normalizeHostId(body.hostId);
    if (!hostId) {
      return jsonError(c, 400, "INVALID_HOST_ID", "hostId 不合法。", undefined);
    }

    const token = readBearerToken(c);
    const host = getHostById(hostId);
    if (!host || !token || token !== host.agentToken) {
      return jsonError(c, 401, "AGENT_AUTH_FAILED", "agentToken 校验失败。", undefined);
    }

    const ok = body.ok === true || body.status === "success" || body.status === "succeeded";
    const status = ok ? "succeeded" : "failed";
    const result = body.result ?? null;
    const now = nowMs();

    const changes = markPendingCommandResult({
      commandId,
      hostId,
      status,
      result,
      now,
    });

    if (changes === 0) {
      return jsonError(c, 404, "COMMAND_NOT_FOUND", "命令不存在或已处理。", undefined);
    }

    auditLog({
      actor: `agent:${hostId}`,
      action: "command_result",
      deviceId: hostId,
      controllerAddress: host.controllerAddress,
      detail: { commandId, status },
    });

    return c.json({ ok: true, command: { id: commandId, status, updatedAt: now } });
  };

  for (const prefix of CLIENT_API_PREFIXES) {
    controller.post(`${prefix}/events`, handleEvents);
    controller.get(`${prefix}/insights`, handleInsights);
    controller.get(`${prefix}/commands`, handleCommands);
    controller.post(`${prefix}/commands/:id/result`, handleCommandResult);
  }

  return controller;
}
