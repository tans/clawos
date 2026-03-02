import { VERSION } from "../app.constants";
import {
  generateAndSaveLocalWallet,
  readLocalAppSettings,
  readLocalGatewayConnectionConfig,
  readLocalWalletSummary,
  updateLocalAppSettings,
  updateLocalGatewayConnectionConfig,
  type LocalAppSettings,
  type LocalGatewayConnectionConfig,
} from "../config/local";
import { readConfigSectionSchema } from "../config/schema";
import { ALLOWED_CONFIG_SECTIONS, applyOpenclawConfig, readOpenclawConfig } from "../gateway/config";
import { invalidateGatewayConnectionSettingsCache } from "../gateway/settings";
import { listGatewaySessionHistory, listGatewaySessions } from "../gateway/sessions";
import { HttpError, jsonResponse } from "../lib/http";
import { getClawosAutoStartState, setClawosAutoStartEnabled } from "../system/autostart";
import { getPendingReplacementPlan, getSelfUpdateStatus, restartClawosProcess } from "../system/self-update";
import { checkBrowserConnectivity } from "../system/browser-connectivity";
import { checkEnvironment } from "../system/environment";
import { readWalletBalances } from "../system/wallet-balance";
import { startBrowserConfigResetTask, startBrowserRestartTask } from "../tasks/browser";
import {
  getQwGatewayStartupStatus,
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

function parseLocalSettingsBody(body: Record<string, unknown>): Partial<LocalAppSettings> {
  const patch: Partial<LocalAppSettings> = {};

  if (Object.prototype.hasOwnProperty.call(body, "port")) {
    const rawPort = body.port;
    if (typeof rawPort !== "number" || !Number.isFinite(rawPort)) {
      throw new HttpError(400, "port 必须是数字。");
    }
    const parsed = Math.floor(rawPort);
    if (parsed < 1 || parsed > 65535) {
      throw new HttpError(400, "port 必须在 1-65535 之间。");
    }
    patch.port = parsed;
  }

  if (Object.prototype.hasOwnProperty.call(body, "openclawToken")) {
    const rawToken = body.openclawToken;
    if (typeof rawToken !== "string") {
      throw new HttpError(400, "openclawToken 必须是字符串。");
    }
    const trimmed = rawToken.trim();
    if (!trimmed) {
      throw new HttpError(400, "openclawToken 不能为空。");
    }
    patch.openclawToken = trimmed;
  }

  if (Object.prototype.hasOwnProperty.call(body, "autoOpenBrowser")) {
    const raw = body.autoOpenBrowser;
    if (typeof raw !== "boolean") {
      throw new HttpError(400, "autoOpenBrowser 必须是 boolean。");
    }
    patch.autoOpenBrowser = raw;
  }

  if (Object.prototype.hasOwnProperty.call(body, "controllerAddress")) {
    const rawControllerAddress = body.controllerAddress;
    if (typeof rawControllerAddress !== "string") {
      throw new HttpError(400, "controllerAddress 必须是字符串。");
    }
    const trimmed = rawControllerAddress.trim();
    if (trimmed && !/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      throw new HttpError(400, "controllerAddress 格式不合法，必须是 0x 开头的 40 位十六进制地址。");
    }
    patch.controllerAddress = trimmed;
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

async function handleBrowserAction(req: Request): Promise<Response> {
  const body = await req.json().catch(() => {
    throw new HttpError(400, "请求体必须是 JSON。");
  });

  const action = sanitizeIdentifier((body as Record<string, unknown>).action, "action") as
    | "restart-browser"
    | "restart-cdp"
    | "reset-config";

  if (!["restart-browser", "restart-cdp", "reset-config"].includes(action)) {
    throw new HttpError(400, `不支持的 action：${action}`);
  }

  if (action === "restart-browser" || action === "restart-cdp") {
    const { task, reused } = startBrowserRestartTask();
    return jsonResponse({ ok: true, taskId: task.id, task, reused });
  }

  const { task, reused } = startBrowserConfigResetTask();
  return jsonResponse({ ok: true, taskId: task.id, task, reused });
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

  if (path === "/api/qw-gateway/status" && req.method === "GET") {
    return jsonResponse({ ok: true, status: getQwGatewayStartupStatus() });
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

  if (path === "/api/app/restart" && req.method === "POST") {
    const pendingReplacement = getPendingReplacementPlan();
    if (pendingReplacement) {
      setTimeout(() => process.exit(0), 300);
      return jsonResponse({
        ok: true,
        restarting: true,
        mode: "apply-update",
        pendingReplacement: {
          targetPath: pendingReplacement.targetPath,
          tempPath: pendingReplacement.tempPath,
          logPath: pendingReplacement.logPath,
        },
      });
    }

    restartClawosProcess();
    setTimeout(() => process.exit(0), 300);
    return jsonResponse({ ok: true, restarting: true, mode: "normal" });
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

  if (path === "/api/local/settings" && req.method === "GET") {
    const settings = readLocalAppSettings();
    return jsonResponse({ ok: true, settings });
  }

  if (path === "/api/local/settings" && req.method === "PUT") {
    const body = await parseJsonBody(req);
    const patch = parseLocalSettingsBody(body);
    const settings = updateLocalAppSettings(patch);
    return jsonResponse({ ok: true, settings });
  }

  if (path === "/api/local/wallet" && req.method === "GET") {
    const wallet = readLocalWalletSummary();
    return jsonResponse({ ok: true, wallet });
  }

  if (path === "/api/local/wallet/generate" && req.method === "POST") {
    const currentWallet = readLocalWalletSummary();
    if (currentWallet.exists) {
      throw new HttpError(409, "已存在钱包，无需重复生成。");
    }

    const generated = generateAndSaveLocalWallet();
    return jsonResponse({
      ok: true,
      address: generated.address,
      privateKey: generated.privateKey,
      wallet: generated.wallet,
    });
  }

  if (path === "/api/local/wallet/balances" && req.method === "GET") {
    const wallet = readLocalWalletSummary();
    if (!wallet.exists || !wallet.address) {
      return jsonResponse({ ok: true, wallet, balances: null });
    }

    const balances = await readWalletBalances(wallet.address);
    return jsonResponse({ ok: true, wallet, balances });
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

  if (path === "/api/browser/action" && req.method === "POST") {
    return await handleBrowserAction(req);
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
