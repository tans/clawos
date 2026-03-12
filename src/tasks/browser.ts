import { existsSync } from "node:fs";
import path from "node:path";
import { applyOpenclawConfig, readOpenclawConfig } from "../gateway/config";
import { asObject, readNonEmptyString } from "../lib/value";
import { normalizeOutput, runProcess, runWslScript, type CommandResult } from "./shell";
import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";

const IS_WINDOWS = process.platform === "win32";

export const BROWSER_CDP_PORT = 9222;
export const BROWSER_REMOTE_CDP_PORT = 9223;
export const BROWSER_BOOT_URL = process.env.CLAWOS_BROWSER_BOOT_URL?.trim() || "about:blank";
export const BROWSER_USER_DATA_DIR = process.env.CLAWOS_CHROME_USER_DATA_DIR?.trim() || "C:\\chrome-openclaw";

const BROWSER_CDP_VERSION_URL = `http://127.0.0.1:${BROWSER_CDP_PORT}/json/version`;
const BROWSER_REMOTE_CDP_VERSION_URL = `http://127.0.0.1:${BROWSER_REMOTE_CDP_PORT}/json/version`;
const BROWSER_CDP_PROBE_TIMEOUT_MS = 20_000;
const BROWSER_CDP_PROBE_INTERVAL_MS = 800;

export const DEFAULT_CHROME_EXE_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function appendProcessLogs(task: Task, result: CommandResult, treatAsSuccess: boolean): void {
  for (const line of normalizeOutput(result.stdout)) {
    appendTaskLog(task, line, "info");
  }
  for (const line of normalizeOutput(result.stderr)) {
    appendTaskLog(task, line, treatAsSuccess ? "info" : "error");
  }
}

async function runProcessStep(
  task: Task,
  params: {
    step: number;
    totalSteps: number;
    name: string;
    command: string;
    args: string[];
    allowExitCodes?: number[];
    allowFailureResult?: (result: CommandResult) => boolean;
  }
): Promise<void> {
  task.step = params.step;
  appendTaskLog(task, `Step ${params.step}/${params.totalSteps}: ${params.name}`);
  appendTaskLog(task, `Run: ${params.command}`);

  const result = await runProcess(params.args);
  const allowedExitCodes = new Set(params.allowExitCodes || []);
  const allowedFailure = params.allowFailureResult ? params.allowFailureResult(result) : false;
  const treatedAsSuccess = result.ok || allowedExitCodes.has(result.code) || allowedFailure;
  appendProcessLogs(task, result, treatedAsSuccess);
  if (!treatedAsSuccess) {
    throw new Error(`${params.name} failed (exit code ${result.code})`);
  }
}

function isPortProxyDeleteMissing(result: CommandResult): boolean {
  const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return text.includes("element not found") || text.includes("cannot find") || text.includes("not found");
}

function isElevationError(result: CommandResult): boolean {
  const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return text.includes("requires elevation");
}

async function ensureBrowserFirewallRule(task: Task, step: number, totalSteps: number): Promise<void> {
  task.step = step;
  appendTaskLog(task, `Step ${step}/${totalSteps}: configure Windows Firewall for TCP ${BROWSER_REMOTE_CDP_PORT}`);

  const deleteArgs = [
    "netsh",
    "advfirewall",
    "firewall",
    "delete",
    "rule",
    `name=ClawOS CDP ${BROWSER_REMOTE_CDP_PORT}`,
  ];
  appendTaskLog(task, `Run: ${deleteArgs.join(" ")}`);
  const deleteResult = await runProcess(deleteArgs);
  appendProcessLogs(task, deleteResult, true);

  const addArgs = [
    "netsh",
    "advfirewall",
    "firewall",
    "add",
    "rule",
    `name=ClawOS CDP ${BROWSER_REMOTE_CDP_PORT}`,
    "dir=in",
    "action=allow",
    "protocol=TCP",
    `localport=${BROWSER_REMOTE_CDP_PORT}`,
  ];
  appendTaskLog(task, `Run: ${addArgs.join(" ")}`);
  const addResult = await runProcess(addArgs);
  appendProcessLogs(task, addResult, addResult.ok);
  if (!addResult.ok) {
    if (isElevationError(addResult)) {
      throw new Error("Failed to configure Windows Firewall: admin privileges are required for netsh.");
    }
    throw new Error(`Failed to configure Windows Firewall rule (exit code ${addResult.code})`);
  }

  appendTaskLog(task, `Windows Firewall rule ready: ClawOS CDP ${BROWSER_REMOTE_CDP_PORT}`);
}

async function ensureBrowserPortProxy(task: Task, step: number, totalSteps: number): Promise<void> {
  task.step = step;
  const listenAddress = "0.0.0.0";
  appendTaskLog(task, `Step ${step}/${totalSteps}: configure system portproxy (${listenAddress}:${BROWSER_REMOTE_CDP_PORT} -> 127.0.0.1:${BROWSER_CDP_PORT})`);

  const deleteArgs = [
    "netsh",
    "interface",
    "portproxy",
    "delete",
    "v4tov4",
    `listenport=${BROWSER_REMOTE_CDP_PORT}`,
    `listenaddress=${listenAddress}`,
  ];
  appendTaskLog(task, `Run: ${deleteArgs.join(" ")}`);
  const deleteResult = await runProcess(deleteArgs);
  appendProcessLogs(task, deleteResult, deleteResult.ok || isPortProxyDeleteMissing(deleteResult));

  const addArgs = [
    "netsh",
    "interface",
    "portproxy",
    "add",
    "v4tov4",
    `listenport=${BROWSER_REMOTE_CDP_PORT}`,
    `listenaddress=${listenAddress}`,
    `connectport=${BROWSER_CDP_PORT}`,
    "connectaddress=127.0.0.1",
  ];
  appendTaskLog(task, `Run: ${addArgs.join(" ")}`);
  const addResult = await runProcess(addArgs);
  appendProcessLogs(task, addResult, addResult.ok);
  if (!addResult.ok) {
    if (isElevationError(addResult)) {
      throw new Error("Failed to configure system portproxy: admin privileges are required for netsh.");
    }
    throw new Error(`Failed to configure system portproxy (exit code ${addResult.code})`);
  }

  appendTaskLog(task, `System portproxy ready: ${listenAddress}:${BROWSER_REMOTE_CDP_PORT} -> 127.0.0.1:${BROWSER_CDP_PORT}`);
}

async function runWslStep(
  task: Task,
  params: {
    step: number;
    totalSteps: number;
    name: string;
    script: string;
    displayCommand: string;
  }
): Promise<CommandResult> {
  task.step = params.step;
  appendTaskLog(task, `Step ${params.step}/${params.totalSteps}: ${params.name}`);
  appendTaskLog(task, `Run: ${params.displayCommand}`);
  const result = await runWslScript(params.script, { shellMode: "clean", loginShell: false });
  appendProcessLogs(task, result, result.ok);
  if (!result.ok) {
    throw new Error(`${params.name} failed (exit code ${result.code})`);
  }
  return result;
}

type CdpVersionProbeResult = {
  payload: Record<string, unknown>;
  webSocketDebuggerUrl: string;
};

async function fetchCdpVersion(timeoutMs: number): Promise<CdpVersionProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(BROWSER_CDP_VERSION_URL, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = asObject(await response.json().catch(() => null));
    if (!payload) {
      throw new Error("Invalid CDP version payload.");
    }
    const webSocketDebuggerUrl = readNonEmptyString(payload.webSocketDebuggerUrl);
    if (!webSocketDebuggerUrl) {
      throw new Error("Missing webSocketDebuggerUrl in CDP version payload.");
    }
    return {
      payload,
      webSocketDebuggerUrl,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForCdpVersion(task: Task): Promise<CdpVersionProbeResult> {
  const deadline = Date.now() + BROWSER_CDP_PROBE_TIMEOUT_MS;
  let lastError = "unknown error";
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const result = await fetchCdpVersion(3_000);
      appendTaskLog(task, `CDP ready: ${BROWSER_CDP_VERSION_URL}`);
      appendTaskLog(task, `CDP WebSocket: ${result.webSocketDebuggerUrl}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = message;
      appendTaskLog(task, `CDP probe attempt ${attempt} failed: ${message}`);
      await Bun.sleep(BROWSER_CDP_PROBE_INTERVAL_MS);
    }
  }

  throw new Error(`CDP port ${BROWSER_CDP_PORT} timed out: ${lastError}`);
}

export function parseFirstNameserver(content: string): string | null {
  const lines = content.split(/\r?\n/g);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^nameserver\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3})$/i);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

async function readWslNameserver(task: Task, step: number, totalSteps: number): Promise<string> {
  const script = [
    "set -euo pipefail",
    "if [ ! -f /etc/resolv.conf ]; then",
    '  echo "/etc/resolv.conf not found" >&2',
    "  exit 1",
    "fi",
    "cat /etc/resolv.conf",
  ].join("\n");
  const result = await runWslStep(task, {
    step,
    totalSteps,
    name: "read WSL nameserver",
    script,
    displayCommand: "cat /etc/resolv.conf",
  });

  const nameserver = parseFirstNameserver(result.stdout);
  if (!nameserver) {
    throw new Error("Could not parse nameserver from /etc/resolv.conf.");
  }

  appendTaskLog(task, `WSL nameserver: ${nameserver}`);
  return nameserver;
}

export function buildRemoteCdpUrl(localWebSocketDebuggerUrl: string, nameserver: string): string {
  const parsed = new URL(localWebSocketDebuggerUrl);
  const protocol = parsed.protocol === "wss:" || parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.protocol = protocol;
  parsed.hostname = nameserver;
  parsed.port = String(BROWSER_REMOTE_CDP_PORT);
  return parsed.toString();
}

function buildRemoteHttpVersionUrl(nameserver: string): string {
  return `http://${nameserver}:${BROWSER_REMOTE_CDP_PORT}/json/version`;
}

async function verifyRemoteHttpVersionFromWsl(
  task: Task,
  step: number,
  totalSteps: number,
  url: string
): Promise<void> {
  const script = [
    "set -euo pipefail",
    `URL='${url.replaceAll("'", "'\"'\"'")}'`,
    'if command -v curl >/dev/null 2>&1; then',
    '  curl -fsS --globoff --max-time 5 "$URL" >/tmp/clawos-browser-version.json',
    'elif command -v wget >/dev/null 2>&1; then',
    '  wget -q -T 5 -O /tmp/clawos-browser-version.json "$URL"',
    "else",
    '  echo "Missing curl/wget in WSL" >&2',
    "  exit 127",
    "fi",
    "cat /tmp/clawos-browser-version.json",
  ].join("\n");

  const result = await runWslStep(task, {
    step,
    totalSteps,
    name: "verify remote CDP from WSL",
    script,
    displayCommand: `curl ${url}`,
  });

  const payload = asObject(JSON.parse(result.stdout));
  const webSocketDebuggerUrl = readNonEmptyString(payload?.webSocketDebuggerUrl);
  if (!payload || !webSocketDebuggerUrl) {
    throw new Error("Remote CDP verification succeeded, but webSocketDebuggerUrl is missing.");
  }

  appendTaskLog(task, `WSL HTTP verified: ${url}`);
  appendTaskLog(task, `WSL WebSocket: ${webSocketDebuggerUrl}`);
}

async function resetOpenclawBrowserConfig(task: Task, remoteCdpUrl: string): Promise<void> {
  const config = await readOpenclawConfig();
  const currentBrowser = asObject(config.browser);
  const nextBrowser: Record<string, unknown> = {
    enabled: typeof currentBrowser?.enabled === "boolean" ? currentBrowser.enabled : true,
    evaluateEnabled: typeof currentBrowser?.evaluateEnabled === "boolean" ? currentBrowser.evaluateEnabled : true,
    attachOnly: true,
    cdpUrl: remoteCdpUrl,
  };

  if (typeof currentBrowser?.remoteCdpTimeoutMs === "number" && Number.isFinite(currentBrowser.remoteCdpTimeoutMs)) {
    nextBrowser.remoteCdpTimeoutMs = currentBrowser.remoteCdpTimeoutMs;
  }
  if (
    typeof currentBrowser?.remoteCdpHandshakeTimeoutMs === "number" &&
    Number.isFinite(currentBrowser.remoteCdpHandshakeTimeoutMs)
  ) {
    nextBrowser.remoteCdpHandshakeTimeoutMs = currentBrowser.remoteCdpHandshakeTimeoutMs;
  }

  config.browser = nextBrowser;
  await applyOpenclawConfig(config, "ClawOS reset browser config to Remote CDP");

  appendTaskLog(task, "openclaw.browser config updated.");
  appendTaskLog(task, `browser.cdpUrl => ${remoteCdpUrl}`);
  appendTaskLog(task, "browser.attachOnly => true");
}

export function resolveChromeExePath(): string {
  const envPath = process.env.CLAWOS_CHROME_EXE_PATH?.trim();
  if (envPath) {
    return envPath;
  }

  const candidates = [...DEFAULT_CHROME_EXE_PATHS];
  const localAppData = process.env.LOCALAPPDATA?.trim();
  if (localAppData) {
    candidates.push(path.win32.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"));
  }

  const found = candidates.find((item) => existsSync(item));
  if (found) {
    return found;
  }

  throw new Error(
    `Could not find chrome.exe. Install Chrome or set CLAWOS_CHROME_EXE_PATH. Candidates: ${candidates.join(", ")}`
  );
}

export function resolveChromeWorkingDirectory(exePath: string): string {
  return path.win32.dirname(exePath);
}

export function buildChromeStartCommand(exePath: string, workingDirectory: string): string {
  const args = [
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${BROWSER_CDP_PORT}`,
    `--user-data-dir=${BROWSER_USER_DATA_DIR}`,
    "--new-window",
    "--no-first-run",
    "--no-default-browser-check",
    BROWSER_BOOT_URL,
  ];
  const argumentList = args.map((arg) => `'${escapePowerShellSingleQuoted(arg)}'`).join(",");

  return `Start-Process -FilePath '${escapePowerShellSingleQuoted(exePath)}' -WorkingDirectory '${escapePowerShellSingleQuoted(workingDirectory)}' -ArgumentList ${argumentList} -WindowStyle Hidden`;
}

export function buildChromeStartArgs(exePath: string, workingDirectory: string): string[] {
  return [
    "powershell.exe",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    buildChromeStartCommand(exePath, workingDirectory),
  ];
}

type BrowserCdpPrepareResult = {
  remoteCdpUrl: string;
  localWebSocketDebuggerUrl: string;
  nameserver: string;
};

async function prepareRemoteCdp(task: Task, step: number, totalSteps: number): Promise<BrowserCdpPrepareResult> {
  task.step = step;
  appendTaskLog(task, `Step ${step}/${totalSteps}: probe CDP and build remote cdpUrl`);
  appendTaskLog(task, `Run: GET ${BROWSER_CDP_VERSION_URL}`);
  const version = await waitForCdpVersion(task);
  const nameserver = await readWslNameserver(task, step, totalSteps);
  const remoteCdpUrl = buildRemoteCdpUrl(version.webSocketDebuggerUrl, nameserver);

  appendTaskLog(task, `remote cdpUrl: ${remoteCdpUrl}`);
  return {
    remoteCdpUrl,
    localWebSocketDebuggerUrl: version.webSocketDebuggerUrl,
    nameserver,
  };
}

export function startBrowserRestartTask(): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("browser-cdp-restart");
  if (runningTask) {
    appendTaskLog(runningTask, "Reusing existing browser restart task.");
    return { task: runningTask, reused: true };
  }

  const totalSteps = 4;
  const task = createTask("browser-cdp-restart", "Repair browser CDP and openclaw config", totalSteps);
  task.status = "running";

  (async () => {
    try {
      if (!IS_WINDOWS) {
        throw new Error("Browser CDP restart is only supported on Windows.");
      }

      const chromeExePath = resolveChromeExePath();
      if (!existsSync(chromeExePath)) {
        throw new Error(`chrome.exe not found: ${chromeExePath}`);
      }
      const chromeWorkingDirectory = resolveChromeWorkingDirectory(chromeExePath);

      task.step = 1;
      appendTaskLog(task, `Step 1/${totalSteps}: start local CDP on 127.0.0.1:${BROWSER_CDP_PORT}`);
      appendTaskLog(task, "Run: taskkill /F /IM chrome.exe /T");
      const killResult = await runProcess(["taskkill", "/F", "/IM", "chrome.exe", "/T"]);
      appendProcessLogs(task, killResult, killResult.ok || killResult.code === 128);
      if (!killResult.ok && killResult.code !== 128) {
        throw new Error(`stop chrome.exe failed (exit code ${killResult.code})`);
      }

      await runProcessStep(task, {
        step: 1,
        totalSteps,
        name: `start Chrome with CDP on ${BROWSER_CDP_PORT}`,
        command: `powershell.exe ... ${buildChromeStartCommand(chromeExePath, chromeWorkingDirectory)}`,
        args: buildChromeStartArgs(chromeExePath, chromeWorkingDirectory),
      });

      appendTaskLog(task, `Run: GET ${BROWSER_CDP_VERSION_URL}`);
      const version = await waitForCdpVersion(task);

      const nameserver = await readWslNameserver(task, 2, totalSteps);
      await ensureBrowserPortProxy(task, 2, totalSteps);
      appendTaskLog(task, `Remote proxy endpoint: ${BROWSER_REMOTE_CDP_VERSION_URL}`);

      await ensureBrowserFirewallRule(task, 3, totalSteps);

      const remoteCdpUrl = buildRemoteCdpUrl(version.webSocketDebuggerUrl, nameserver);
      const remoteHttpVersionUrl = buildRemoteHttpVersionUrl(nameserver);
      appendTaskLog(task, `WSL HTTP endpoint: ${remoteHttpVersionUrl}`);
      appendTaskLog(task, `WSL WebSocket endpoint: ${remoteCdpUrl}`);

      task.step = 4;
      appendTaskLog(task, `Step 4/${totalSteps}: update openclaw browser config`);
      appendTaskLog(task, `Run: curl ${remoteHttpVersionUrl}`);
      await verifyRemoteHttpVersionFromWsl(task, 4, totalSteps, remoteHttpVersionUrl);
      appendTaskLog(task, "Run: openclaw gateway call config.apply (browser)");
      await resetOpenclawBrowserConfig(task, remoteCdpUrl);

      task.status = "success";
      task.endedAt = new Date().toISOString();
      appendTaskLog(task, "Task completed.");
    } catch (error) {
      task.status = "failed";
      task.endedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      task.error = message;
      appendTaskLog(task, message, "error");
    }
  })();

  return { task, reused: false };
}

export function startBrowserCdpRestartTask(): { task: Task; reused: boolean } {
  return startBrowserRestartTask();
}

export function startBrowserConfigResetTask(): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("browser-cdp-reset-config");
  if (runningTask) {
    appendTaskLog(runningTask, "Reusing existing browser config reset task.");
    return { task: runningTask, reused: true };
  }

  const totalSteps = 4;
  const task = createTask("browser-cdp-reset-config", "Reset browser config to Remote CDP", totalSteps);
  task.status = "running";

  (async () => {
    try {
      if (!IS_WINDOWS) {
        throw new Error("Browser config reset is only supported on Windows.");
      }

      const prepared = await prepareRemoteCdp(task, 1, totalSteps);
      await ensureBrowserPortProxy(task, 2, totalSteps);
      await ensureBrowserFirewallRule(task, 3, totalSteps);

      appendTaskLog(task, `Current nameserver: ${prepared.nameserver}`);
      appendTaskLog(task, `Local CDP: ${prepared.localWebSocketDebuggerUrl}`);

      task.step = 4;
      appendTaskLog(task, `Step 4/${totalSteps}: update openclaw browser config`);
      appendTaskLog(task, "Run: openclaw gateway call config.apply (browser)");
      await resetOpenclawBrowserConfig(task, prepared.remoteCdpUrl);

      task.status = "success";
      task.endedAt = new Date().toISOString();
      appendTaskLog(task, "Task completed.");
    } catch (error) {
      task.status = "failed";
      task.endedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      task.error = message;
      appendTaskLog(task, message, "error");
    }
  })();

  return { task, reused: false };
}
