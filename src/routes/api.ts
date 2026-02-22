import { VERSION } from "../app.constants";
import {
  readLocalGatewayConnectionConfig,
  updateLocalGatewayConnectionConfig,
  type LocalGatewayConnectionConfig,
} from "../config/local";
import { readConfigSectionSchema } from "../config/schema";
import { ALLOWED_CONFIG_SECTIONS, applyOpenclawConfig, readOpenclawConfig } from "../gateway/config";
import { invalidateGatewayConnectionSettingsCache } from "../gateway/settings";
import { listGatewaySessionHistory, listGatewaySessions } from "../gateway/sessions";
import { HttpError, jsonResponse } from "../lib/http";
import { getClawosAutoStartState, setClawosAutoStartEnabled } from "../system/autostart";
import { getSelfUpdateStatus } from "../system/self-update";
import { checkBrowserConnectivity } from "../system/browser-connectivity";
import { checkEnvironment } from "../system/environment";
import {
  startGatewayControlTask,
  startGatewayStatusTask,
  startGatewayUpdateTask,
  startQwGatewayRestartTask,
} from "../tasks/gateway";
import { startWslRepairTask } from "../tasks/system";
import { startSelfUpdateTask } from "../tasks/self-update";
import { getTaskById, listRecentTasks } from "../tasks/store";

function sanitizeIdentifier(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_.-]{1,64}$/.test(value)) {
    throw new HttpError(400, `${field} 格式不合法，仅允许字母数字、下划线、中划线和点。`);
  }
  return value;
}

function readLimit(raw: string | null, fallback: number, field: string): number {
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1 || value > 1000) {
    throw new HttpError(400, `${field} 必须在 1-1000 之间。`);
  }
  return Math.floor(value);
}

function assertAllowedSection(section: string): string {
  if (!ALLOWED_CONFIG_SECTIONS.has(section)) {
    throw new HttpError(400, `不支持的配置区：${section}`);
  }
  return section;
}

function ensureObjectData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "配置内容必须是对象。");
  }
  return value as Record<string, unknown>;
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => {
    throw new HttpError(400, "请求体必须是 JSON。");
  });
  return ensureObjectData(body);
}

function readRequiredBoolean(body: Record<string, unknown>, field: string): boolean {
  const value = body[field];
  if (typeof value !== "boolean") {
    throw new HttpError(400, `${field} 必须是 boolean。`);
  }
  return value;
}

function parseLocalGatewayBody(body: Record<string, unknown>): Partial<LocalGatewayConnectionConfig> {
  const fields = ["url", "token", "password", "origin"] as const;
  const patch: Partial<LocalGatewayConnectionConfig> = {};

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) {
      continue;
    }

    const raw = body[field];
    if (typeof raw !== "string") {
      throw new HttpError(400, `${field} 必须是字符串。`);
    }
    patch[field] = raw.trim();
  }

  return patch;
}

async function saveConfigSection(section: string, data: Record<string, unknown>): Promise<void> {
  const config = await readOpenclawConfig();
  config[section] = data;
  await applyOpenclawConfig(config, `ClawOS 保存 ${section} 配置`);
}

async function handleConfigSectionSave(req: Request): Promise<Response> {
  const body = await parseJsonBody(req);
  const section = assertAllowedSection(sanitizeIdentifier(body.section, "section"));
  const data = ensureObjectData(body.data);
  await saveConfigSection(section, data);

  return jsonResponse({
    ok: true,
    section,
    data,
  });
}

async function handleGatewayAction(req: Request): Promise<Response> {
  const body = await req.json().catch(() => {
    throw new HttpError(400, "请求体必须是 JSON。");
  });

  const action = sanitizeIdentifier((body as Record<string, unknown>).action, "action") as
    | "restart"
    | "restart-qw-gateway"
    | "status"
    | "install"
    | "uninstall"
    | "start"
    | "stop";

  if (!["restart", "restart-qw-gateway", "status", "install", "uninstall", "start", "stop"].includes(action)) {
    throw new HttpError(400, `不支持的 action：${action}`);
  }

  if (action === "status") {
    const task = startGatewayStatusTask();
    return jsonResponse({ ok: true, taskId: task.id, task });
  }

  if (action === "restart-qw-gateway") {
    const { task, reused } = startQwGatewayRestartTask();
    return jsonResponse({ ok: true, taskId: task.id, task, reused });
  }

  const task = startGatewayControlTask(action);
  return jsonResponse({ ok: true, taskId: task.id, task });
}

export async function handleApiRequest(req: Request, path: string): Promise<Response | null> {
  if (path === "/api/health") {
    return jsonResponse({ ok: true, version: VERSION });
  }

  if (path === "/api/system/check" && req.method === "GET") {
    const info = await checkEnvironment();
    return jsonResponse({ ok: true, info });
  }

  if (path === "/api/system/browser/check" && req.method === "GET") {
    const info = await checkBrowserConnectivity();
    return jsonResponse({ ok: true, info });
  }

  if (path === "/api/system/repair" && req.method === "POST") {
    const { task, reused } = startWslRepairTask();
    return jsonResponse({ ok: true, taskId: task.id, task, reused });
  }

  if (path === "/api/system/autostart/clawos" && req.method === "GET") {
    const state = await getClawosAutoStartState();
    return jsonResponse({ ok: true, state });
  }

  if (path === "/api/system/autostart/clawos" && req.method === "PUT") {
    const body = await parseJsonBody(req);
    const enabled = readRequiredBoolean(body, "enabled");
    const state = await setClawosAutoStartEnabled(enabled);
    return jsonResponse({ ok: true, state });
  }

  if (path === "/api/app/update/status" && req.method === "GET") {
    const status = await getSelfUpdateStatus(false);
    return jsonResponse({ ok: true, status });
  }

  if (path === "/api/app/update/run" && req.method === "POST") {
    const body = await parseJsonBody(req);
    const force = body.force === true;
    const { task, reused } = startSelfUpdateTask(force ? "force" : "manual");
    return jsonResponse({ ok: true, taskId: task.id, task, reused });
  }

  if (path === "/api/config" && req.method === "GET") {
    const config = await readOpenclawConfig();
    return jsonResponse({ ok: true, config });
  }

  if (path === "/api/local/gateway" && req.method === "GET") {
    const gateway = readLocalGatewayConnectionConfig();
    return jsonResponse({ ok: true, gateway });
  }

  if (path === "/api/local/gateway" && req.method === "PUT") {
    const body = await parseJsonBody(req);
    const patch = parseLocalGatewayBody(body);
    const gateway = updateLocalGatewayConnectionConfig(patch);
    invalidateGatewayConnectionSettingsCache();
    return jsonResponse({ ok: true, gateway });
  }

  if (path === "/api/config/section" && req.method === "PUT") {
    return await handleConfigSectionSave(req);
  }

  const schemaMatch = path.match(/^\/api\/config\/schema\/([a-zA-Z0-9_.-]{1,64})\/?$/);
  if (schemaMatch && req.method === "GET") {
    const section = assertAllowedSection(schemaMatch[1]);
    const schema = readConfigSectionSchema(section);
    return jsonResponse({ ok: true, section, schema });
  }

  const sectionMatch = path.match(/^\/api\/config\/([a-zA-Z0-9_.-]{1,64})\/?$/);
  if (sectionMatch) {
    const section = assertAllowedSection(sectionMatch[1]);

    if (req.method === "GET") {
      const config = await readOpenclawConfig();
      const sectionData = config[section];
      return jsonResponse({
        ok: true,
        section,
        data:
          sectionData && typeof sectionData === "object" && !Array.isArray(sectionData)
            ? (sectionData as Record<string, unknown>)
            : {},
      });
    }

    if (req.method === "PUT") {
      const body = await parseJsonBody(req);
      const data = Object.prototype.hasOwnProperty.call(body, "data")
        ? ensureObjectData(body.data)
        : body;
      await saveConfigSection(section, data);
      return jsonResponse({ ok: true, section, data });
    }
  }

  if (path === "/api/sessions" && req.method === "GET") {
    const url = new URL(req.url);
    const limit = readLimit(url.searchParams.get("limit"), 200, "limit");
    const sessions = await listGatewaySessions(limit);
    return jsonResponse({ ok: true, sessions });
  }

  if (path.startsWith("/api/sessions/") && req.method === "GET") {
    const prefix = "/api/sessions/";
    const suffix = "/history";
    if (path.endsWith(suffix) && path.length > prefix.length + suffix.length) {
      const encodedKey = path.slice(prefix.length, -suffix.length);
      let sessionKey = "";
      try {
        sessionKey = decodeURIComponent(encodedKey).trim();
      } catch {
        throw new HttpError(400, "sessionKey 编码不合法。");
      }
      if (!sessionKey) {
        throw new HttpError(400, "sessionKey 不能为空。");
      }

      const url = new URL(req.url);
      const limit = readLimit(url.searchParams.get("limit"), 200, "limit");
      const history = await listGatewaySessionHistory(sessionKey, limit);
      return jsonResponse({ ok: true, sessionKey, history });
    }
  }

  if (path === "/api/gateway/update" && req.method === "POST") {
    const { task, reused } = startGatewayUpdateTask();
    return jsonResponse({ ok: true, taskId: task.id, task, reused });
  }

  if (path === "/api/gateway/action" && req.method === "POST") {
    return await handleGatewayAction(req);
  }

  if (path.startsWith("/api/tasks/") && req.method === "GET") {
    const id = path.slice("/api/tasks/".length);
    const task = getTaskById(id);
    if (!task) {
      throw new HttpError(404, "任务不存在。");
    }
    return jsonResponse({ ok: true, task });
  }

  if (path === "/api/tasks" && req.method === "GET") {
    return jsonResponse({ ok: true, tasks: listRecentTasks(20) });
  }

  return null;
}
