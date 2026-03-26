import { readLocalClawosConfig } from "../config/local";
import { readOpenclawConfigFromWsl, writeOpenclawConfigToWsl } from "../config/openclaw-wsl";
import { ensureChannelPluginsForEnabledChannels } from "../gateway/config";
import { asObject } from "../lib/value";
import { buildWslProcessArgs, decodeProcessOutput } from "../tasks/shell";
import { resolveOpenclawCliMode } from "./cli";

const WEIXIN_CHANNEL_KEY = "openclaw-weixin";
const WEIXIN_STATE_TTL_MS = 30 * 60_000;
const WEIXIN_START_TIMEOUT_MS = 30_000;
const WEIXIN_OUTPUT_TEXT_LIMIT = 20_000;
const WEIXIN_OUTPUT_BYTE_LIMIT = 64_000;
const ANSI_ESCAPE_REGEX = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000b-\u001f\u007f]/g;
const URL_REGEX = /https?:\/\/\S+/gi;

export type WeixinLoginState = {
  sessionKey: string;
  loginUrl: string | null;
  qrDataUrl: string | null;
  phase: "waiting" | "connected" | "failed";
  message: string;
  accountId: string | null;
  startedAt: string;
  updatedAt: string;
};

type LoginProcessRecord = {
  sessionKey: string;
  proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
  cancelRequested: boolean;
  output: string;
  outputBytes: Uint8Array;
};

const loginStates = new Map<string, WeixinLoginState>();
const loginProcesses = new Map<string, LoginProcessRecord>();
let latestSessionKey = "";

function nowIso(): string {
  return new Date().toISOString();
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function buildWslRelayScript(): string {
  const loginCommand = `openclaw channels login --channel ${WEIXIN_CHANNEL_KEY}`;
  const pythonCommand = JSON.stringify(loginCommand);
  return [
    "python3 -u - <<'PY'",
    "import subprocess, sys",
    `cmd = [\"script\", \"-qefc\", ${pythonCommand}, \"/dev/null\"]`,
    "proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=0)",
    "try:",
    "    while True:",
    "        chunk = proc.stdout.read(1024) if proc.stdout is not None else b''",
    "        if not chunk:",
    "            break",
    "        sys.stdout.buffer.write(chunk)",
    "        sys.stdout.buffer.flush()",
    "finally:",
    "    if proc.stdout is not None:",
    "        proc.stdout.close()",
    "    raise SystemExit(proc.wait())",
    "PY",
  ].join("\n");
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_REGEX, "");
}

function normalizeOutputText(value: string): string {
  return stripAnsi(value).replace(CONTROL_CHAR_REGEX, "").replace(/\r/g, "\n");
}

function trimStoredOutput(value: string): string {
  if (value.length <= WEIXIN_OUTPUT_TEXT_LIMIT) {
    return value;
  }
  return value.slice(value.length - WEIXIN_OUTPUT_TEXT_LIMIT);
}

function appendStoredOutputBytes(previous: Uint8Array, chunk: Uint8Array): Uint8Array {
  if (chunk.length === 0) {
    return previous;
  }
  if (previous.length === 0) {
    if (chunk.length <= WEIXIN_OUTPUT_BYTE_LIMIT) {
      return chunk;
    }
    return chunk.slice(chunk.length - WEIXIN_OUTPUT_BYTE_LIMIT);
  }

  const merged = new Uint8Array(previous.length + chunk.length);
  merged.set(previous, 0);
  merged.set(chunk, previous.length);
  if (merged.length <= WEIXIN_OUTPUT_BYTE_LIMIT) {
    return merged;
  }
  return merged.slice(merged.length - WEIXIN_OUTPUT_BYTE_LIMIT);
}

function refreshRecordOutput(record: LoginProcessRecord, chunk: Uint8Array): void {
  record.outputBytes = appendStoredOutputBytes(record.outputBytes, chunk);
  record.output = trimStoredOutput(normalizeOutputText(decodeProcessOutput(record.outputBytes)));
}

function sanitizeMatchedUrl(value: string): string {
  return value.replace(/[)\]>",']+$/g, "").trim();
}

function extractLoginUrl(value: string): string | null {
  const matches = Array.from(normalizeOutputText(value).matchAll(URL_REGEX));
  if (matches.length === 0) {
    return null;
  }
  const candidate = sanitizeMatchedUrl(matches[matches.length - 1]?.[0] || "");
  return candidate || null;
}

function readLastMeaningfulLine(value: string): string {
  const lines = normalizeOutputText(value)
    .split(/\n+/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^[.\u00b7]+$/.test(line))
    .filter((line) => !/^[\u2580\u2584\u2588\u258c\u2590\s]+$/.test(line));

  return lines[lines.length - 1] || "";
}

function readChannelEnabled(value: unknown): boolean {
  const channel = asObject(value);
  if (!channel) {
    return false;
  }
  return readBoolean(channel.enabled) || readBoolean(channel.enable);
}

function cloneLoginState(state: WeixinLoginState | null): WeixinLoginState | null {
  return state ? { ...state } : null;
}

function setLoginState(state: WeixinLoginState): WeixinLoginState {
  const normalized: WeixinLoginState = {
    ...state,
    updatedAt: state.updatedAt || nowIso(),
  };
  loginStates.set(normalized.sessionKey, normalized);
  latestSessionKey = normalized.sessionKey;
  return normalized;
}

function updateLoginState(
  sessionKey: string,
  patch: Partial<Omit<WeixinLoginState, "sessionKey" | "startedAt">>
): WeixinLoginState | null {
  const current = loginStates.get(sessionKey);
  if (!current) {
    return null;
  }

  const next: WeixinLoginState = {
    ...current,
    ...patch,
    sessionKey,
    startedAt: current.startedAt,
    updatedAt: nowIso(),
  };
  loginStates.set(sessionKey, next);
  latestSessionKey = sessionKey;
  return next;
}

async function terminateProcess(record: LoginProcessRecord): Promise<void> {
  record.cancelRequested = true;

  try {
    if (process.platform === "win32" && typeof record.proc.pid === "number" && record.proc.pid > 0) {
      Bun.spawnSync({
        cmd: ["cmd.exe", "/d", "/c", `taskkill /PID ${record.proc.pid} /T /F`],
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      });
    } else {
      record.proc.kill();
    }
  } catch {
    // Best-effort cancellation only.
  }

  try {
    await record.proc.exited;
  } catch {
    // Ignore exit wait failures during cancellation.
  }
}

async function purgeExpiredLoginStates(): Promise<void> {
  const now = Date.now();
  for (const [sessionKey, state] of loginStates) {
    if (now - new Date(state.updatedAt).getTime() <= WEIXIN_STATE_TTL_MS) {
      continue;
    }

    const record = loginProcesses.get(sessionKey);
    if (record) {
      loginProcesses.delete(sessionKey);
      await terminateProcess(record);
    }
    loginStates.delete(sessionKey);
    if (latestSessionKey === sessionKey) {
      latestSessionKey = "";
    }
  }
}

async function ensureWeixinChannelEnabled(): Promise<void> {
  const config = await readOpenclawConfigFromWsl();
  const before = JSON.stringify({
    channels: config.channels,
    plugins: config.plugins,
  });

  const channels = { ...(asObject(config.channels) || {}) };
  const existingChannel = asObject(channels[WEIXIN_CHANNEL_KEY]) || {};
  const nextChannel: Record<string, unknown> = {
    ...existingChannel,
    enabled: true,
  };
  delete nextChannel.enable;
  channels[WEIXIN_CHANNEL_KEY] = nextChannel;
  config.channels = channels;

  ensureChannelPluginsForEnabledChannels(config);

  const after = JSON.stringify({
    channels: config.channels,
    plugins: config.plugins,
  });

  if (before !== after) {
    await writeOpenclawConfigToWsl(config);
  }
}

function buildWeixinLoginSpawnArgs(): string[] {
  const mode = resolveOpenclawCliMode();
  const command = `script -qefc ${shellQuote(`openclaw channels login --channel ${WEIXIN_CHANNEL_KEY}`)} /dev/null 2>&1`;

  if (mode === "wsl") {
    const localConfig = readLocalClawosConfig();
    const distro = readOptionalString(localConfig?.wsl?.distro);
    const wslBin = readOptionalString(localConfig?.wsl?.wslBin) || "wsl.exe";
    return buildWslProcessArgs(buildWslRelayScript(), {
      isWindows: process.platform === "win32",
      distro,
      wslBin,
      loginShell: true,
      shellMode: "login",
      preferStdin: false,
    });
  }

  if (process.platform === "win32") {
    const binary = process.env.CLAWOS_OPENCLAW_BIN?.trim() || "openclaw";
    if (/\.(cmd|bat)$/i.test(binary)) {
      return ["cmd.exe", "/d", "/c", binary, "channels", "login", "--channel", WEIXIN_CHANNEL_KEY];
    }
    return [binary, "channels", "login", "--channel", WEIXIN_CHANNEL_KEY];
  }

  return ["bash", "-lc", command];
}

function updateLoginUrlIfPresent(record: LoginProcessRecord): void {
  const loginUrl = extractLoginUrl(record.output);
  if (!loginUrl) {
    return;
  }
  updateLoginState(record.sessionKey, {
    loginUrl,
    qrDataUrl: loginUrl,
    message: "已获取微信登录链接，请在浏览器完成扫码确认。",
  });
}

async function consumeProcessStream(record: LoginProcessRecord, stream: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!stream) {
    return;
  }

  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value || value.length === 0) {
        continue;
      }

      refreshRecordOutput(record, value);
      updateLoginUrlIfPresent(record);
    }
  } finally {
    updateLoginUrlIfPresent(record);
    reader.releaseLock();
  }
}

function finalizeLoginProcess(record: LoginProcessRecord, exitCode: number): void {
  loginProcesses.delete(record.sessionKey);

  const current = loginStates.get(record.sessionKey);
  if (!current) {
    return;
  }

  if (record.cancelRequested) {
    updateLoginState(record.sessionKey, {
      phase: "failed",
      message: "微信登录流程已取消。",
    });
    return;
  }

  const loginUrl = extractLoginUrl(record.output) || current.loginUrl || current.qrDataUrl || null;
  if (exitCode === 0) {
    updateLoginState(record.sessionKey, {
      loginUrl,
      qrDataUrl: loginUrl,
      phase: "connected",
      message: "微信登录成功。",
    });
    return;
  }

  const lastLine = readLastMeaningfulLine(record.output);
  updateLoginState(record.sessionKey, {
    loginUrl,
    qrDataUrl: loginUrl,
    phase: "failed",
    message: lastLine || "微信登录失败，请重新获取登录链接。",
  });
}

function spawnWeixinLoginProcess(sessionKey: string): void {
  const proc = Bun.spawn({
    cmd: buildWeixinLoginSpawnArgs(),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  const record: LoginProcessRecord = {
    sessionKey,
    proc,
    cancelRequested: false,
    output: "",
    outputBytes: new Uint8Array(),
  };
  loginProcesses.set(sessionKey, record);

  void (async () => {
    const exitCode = await Promise.all([
      proc.exited,
      consumeProcessStream(record, proc.stdout),
      consumeProcessStream(record, proc.stderr),
    ]).then(([code]) => code);

    finalizeLoginProcess(record, exitCode);
  })();
}

async function waitForLoginUrl(sessionKey: string, timeoutMs = WEIXIN_START_TIMEOUT_MS): Promise<WeixinLoginState> {
  const deadline = Date.now() + Math.max(timeoutMs, 1_000);
  while (Date.now() < deadline) {
    const state = loginStates.get(sessionKey);
    if (!state) {
      break;
    }
    if (state.loginUrl || state.qrDataUrl || state.phase !== "waiting" || !loginProcesses.has(sessionKey)) {
      return cloneLoginState(state)!;
    }
    await Bun.sleep(200);
  }

  return cloneLoginState(loginStates.get(sessionKey) || null) || {
    sessionKey,
    loginUrl: null,
    qrDataUrl: null,
    phase: "failed",
    message: "启动微信登录失败，请重试。",
    accountId: null,
    startedAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function findReusableWaitingState(): WeixinLoginState | null {
  const current = loginStates.get(latestSessionKey) || null;
  if (!current || current.phase !== "waiting" || !loginProcesses.has(current.sessionKey)) {
    return null;
  }
  return cloneLoginState(current);
}

export async function cancelWeixinLogin(sessionKey?: string | null): Promise<void> {
  await purgeExpiredLoginStates();

  if (typeof sessionKey === "string" && sessionKey.trim()) {
    const targetSessionKey = sessionKey.trim();
    const record = loginProcesses.get(targetSessionKey);
    if (!record) {
      return;
    }
    loginProcesses.delete(targetSessionKey);
    await terminateProcess(record);
    return;
  }

  for (const [key, record] of Array.from(loginProcesses.entries())) {
    loginProcesses.delete(key);
    await terminateProcess(record);
  }
}

export async function startWeixinLogin(force = false): Promise<WeixinLoginState> {
  await purgeExpiredLoginStates();
  await ensureWeixinChannelEnabled();

  if (!force) {
    const existing = findReusableWaitingState();
    if (existing) {
      return existing;
    }
  }

  if (force) {
    await cancelWeixinLogin();
  }

  const sessionKey = crypto.randomUUID();
  setLoginState({
    sessionKey,
    loginUrl: null,
    qrDataUrl: null,
    phase: "waiting",
    message: "正在启动微信扫码登录...",
    accountId: null,
    startedAt: nowIso(),
    updatedAt: nowIso(),
  });

  spawnWeixinLoginProcess(sessionKey);

  const state = await waitForLoginUrl(sessionKey);
  if (!state.loginUrl && !state.qrDataUrl && state.phase === "waiting") {
    throw new Error(state.message || "获取微信登录链接失败");
  }
  if (state.phase === "failed") {
    throw new Error(state.message || "获取微信登录链接失败");
  }
  return state;
}

export async function getWeixinLoginState(sessionKey?: string | null): Promise<WeixinLoginState | null> {
  await purgeExpiredLoginStates();
  const targetSessionKey = readOptionalString(sessionKey) || latestSessionKey;
  if (!targetSessionKey) {
    return null;
  }
  return cloneLoginState(loginStates.get(targetSessionKey) || null);
}

export async function clearWeixinLoginStateIfDisabled(): Promise<void> {
  const config = await readOpenclawConfigFromWsl();
  const channels = asObject(config.channels) || {};
  if (readChannelEnabled(channels[WEIXIN_CHANNEL_KEY])) {
    return;
  }

  await cancelWeixinLogin();
  loginStates.clear();
  latestSessionKey = "";
}
