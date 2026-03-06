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
import {
  ALLOWED_CONFIG_SECTIONS,
  readOpenclawConfig,
  readOpenclawConfigForSection,
  saveOpenclawConfigSection,
} from "../gateway/config";
import { listGatewaySessionHistory, listGatewaySessions } from "../gateway/sessions";
import { HttpError, jsonResponse } from "../lib/http";
import { asObject } from "../lib/value";
import { getClawosAutoStartState, setClawosAutoStartEnabled } from "../system/autostart";
import { checkBrowserConnectivity } from "../system/browser-connectivity";
import { checkEnvironment } from "../system/environment";
import { getSelfUpdateStatus } from "../system/self-update";
import { readWalletBalances } from "../system/wallet-balance";
import { startBrowserConfigResetTask, startBrowserRestartTask } from "../tasks/browser";
import {
  getQwGatewayStartupStatus,
  listOpenclawConfigBackups,
  startOpenclawConfigRollbackTask,
  startGatewayControlTask,
  startGatewayStatusTask,
  startGatewayUpdateTask,
  startQwGatewayRestartTask,
} from "../tasks/gateway";
import { startSelfUpdateTask } from "../tasks/self-update";
import { startWslRepairTask } from "../tasks/system";
import { getTaskById, listRecentTasks } from "../tasks/store";

const CHANNEL_PATCH_KEYS = new Set(["feishu", "wework"]);
const OPENCLAW_REDACTED = "__OPENCLAW_REDACTED__";
const IS_MACOS = process.platform === "darwin";

const FEISHU_CHANNEL_DEFAULTS: Record<string, unknown> = {
  enabled: false,
  domain: "feishu",
  dmPolicy: "open",
  groupPolicy: "open",
  allowFrom: ["*"],
  groupAllowFrom: ["*"],
  streaming: false,
  blockStreaming: false,
};

const WEWORK_CHANNEL_DEFAULTS: Record<string, unknown> = {
  enabled: false,
  accounts: {},
  allowFrom: ["*"],
  dmPolicy: "open",
  groupPolicy: "open",
};

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === OPENCLAW_REDACTED) {
    return undefined;
  }
  return trimmed;
}

function buildFeishuChannelData(input: Record<string, unknown>, existing: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...FEISHU_CHANNEL_DEFAULTS,
    ...existing,
  };

  const existingEnabled = readOptionalBoolean(existing.enabled) ?? readOptionalBoolean(existing.enable);
  const inputEnabled = readOptionalBoolean(input.enabled) ?? readOptionalBoolean(input.enable);
  next.enabled = inputEnabled ?? existingEnabled ?? FEISHU_CHANNEL_DEFAULTS.enabled;

  const existingAppId = readOptionalText(existing.appId);
  const inputAppId = readOptionalText(input.appId);
  if (inputAppId !== undefined) {
    next.appId = inputAppId;
  } else if (existingAppId !== undefined) {
    next.appId = existingAppId;
  }

  const existingSecret = readOptionalText(existing.appSecret) ?? readOptionalText(existing.secret);
  const inputSecret = readOptionalText(input.appSecret) ?? readOptionalText(input.secret);
  if (inputSecret !== undefined) {
    next.appSecret = inputSecret;
  } else if (existingSecret !== undefined) {
    next.appSecret = existingSecret;
  }

  delete next.enable;
  delete next.secret;
  return next;
}

function buildWeworkChannelData(input: Record<string, unknown>, existing: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...WEWORK_CHANNEL_DEFAULTS,
    ...existing,
  };

  const existingEnabled = readOptionalBoolean(existing.enabled) ?? readOptionalBoolean(existing.enable);
  const inputEnabled = readOptionalBoolean(input.enabled) ?? readOptionalBoolean(input.enable);
  next.enabled = inputEnabled ?? existingEnabled ?? WEWORK_CHANNEL_DEFAULTS.enabled;

  delete next.enable;
  return next;
}

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

function readRequiredNonEmptyString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${field} 必须是非空字符串。`);
  }
  return value.trim();
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

async function saveConfigSection(
  section: string,
  data: Record<string, unknown>
): Promise<{ mode: "file-overwrite" | "cli-apply"; backupPath?: string | null; targetPath?: string }> {
  const result = await saveOpenclawConfigSection(section, data);
  if (result.mode === "file-overwrite") {
    return {
      mode: "file-overwrite",
      backupPath: result.fileWrite?.backupPath || null,
      targetPath: result.fileWrite?.targetPath,
    };
  }
  return { mode: "cli-apply" };
}

async function handleConfigSectionSave(req: Request): Promise<Response> {
  const body = await parseJsonBody(req);
  const section = assertAllowedSection(sanitizeIdentifier(body.section, "section"));
  const data = ensureObjectData(body.data);
  const saveResult = await saveConfigSection(section, data);

  return jsonResponse({
    ok: true,
    section,
    data,
    save: saveResult,
  });
}

async function handleSingleChannelPatch(req: Request, channelKeyRaw: string): Promise<Response> {
  const channelKey = sanitizeIdentifier(channelKeyRaw, "channel");
  if (!CHANNEL_PATCH_KEYS.has(channelKey)) {
    throw new HttpError(400, `不支持的渠道：${channelKey}`);
  }

  if (IS_MACOS && channelKey === "wework") {
    const config = await readOpenclawConfigForSection("channels");
    const sectionData = asObject(config.channels) || {};
    return jsonResponse({
      ok: true,
      section: "channels",
      channel: channelKey,
      ignored: true,
      reason: "当前系统为 macOS，已忽略企业微信渠道配置。",
      data: asObject(sectionData.wework) || {},
    });
  }

  const body = await parseJsonBody(req);
  const data = Object.prototype.hasOwnProperty.call(body, "data")
    ? ensureObjectData(body.data)
    : ensureObjectData(body);

  const config = await readOpenclawConfigForSection("channels");
  const sectionData = asObject(config.channels) || {};
  const nextChannels: Record<string, unknown> = { ...sectionData };

  if (channelKey === "wework") {
    const existing = asObject(sectionData.wework) || {};
    const normalized = buildWeworkChannelData(data, existing);
    nextChannels.wework = normalized;
  } else {
    const existing = asObject(sectionData.feishu) || {};
    nextChannels.feishu = buildFeishuChannelData(data, existing);
  }

  const saveResult = await saveConfigSection("channels", nextChannels);
  return jsonResponse({
    ok: true,
    section: "channels",
    channel: channelKey,
    data,
    save: saveResult,
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

async function handleOpenclawConfigRollback(req: Request): Promise<Response> {
  const body = await parseJsonBody(req);
  const backupPath = readRequiredNonEmptyString(body, "backupPath");
  if (/[\r\n\0]/.test(backupPath)) {
    throw new HttpError(400, "backupPath 包含非法字符。");
  }

  const { task, reused } = await startOpenclawConfigRollbackTask(backupPath);
  return jsonResponse({ ok: true, taskId: task.id, task, reused });
}

async function handleBrowserAction(req: Request): Promise<Response> {
  const body = await req.json().catch(() => {
    throw new HttpError(400, "请求体必须是 JSON。");
  });

  const rawAction = sanitizeIdentifier((body as Record<string, unknown>).action, "action");
  const action =
    rawAction === "restart"
      ? "restart-browser"
      : rawAction === "reset"
        ? "reset-config"
        : (rawAction as "restart-browser" | "restart-cdp" | "reset-config");

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
  try {
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
      const status = await getSelfUpdateStatus(true);
      return jsonResponse({ ok: true, status });
    }

    if (path === "/api/app/update/run" && req.method === "POST") {
      const rawBody = await req.json().catch(() => ({}));
      if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
        throw new HttpError(400, "请求体必须是 JSON 对象。");
      }

      const body = rawBody as Record<string, unknown>;
      const trigger = body.trigger === "force" ? "force" : "manual";
      const autoRestart = typeof body.autoRestart === "boolean" ? body.autoRestart : true;
      const { task, reused } = startSelfUpdateTask(trigger, { autoRestart });
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

    const channelPatchMatch = path.match(/^\/api\/config\/channels\/channel\/([a-zA-Z0-9_.-]{1,64})\/?$/);
    if (channelPatchMatch && req.method === "PATCH") {
      return await handleSingleChannelPatch(req, channelPatchMatch[1]);
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
        const config = await readOpenclawConfigForSection(section);
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
        const saveResult = await saveConfigSection(section, data);
        return jsonResponse({ ok: true, section, data, save: saveResult });
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

    if (path === "/api/gateway/config/backups" && req.method === "GET") {
      const backupList = await listOpenclawConfigBackups();
      return jsonResponse({ ok: true, backups: backupList.backups, command: backupList.command });
    }

    if (path === "/api/gateway/config/rollback" && req.method === "POST") {
      return await handleOpenclawConfigRollback(req);
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
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ ok: false, error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ ok: false, error: message || "服务器内部错误" }, 500);
  }
}
