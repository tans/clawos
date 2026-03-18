import { existsSync } from "node:fs";
import path from "node:path";
import { applyOpenclawConfig, readOpenclawConfig } from "../gateway/config";
import { asObject, readNonEmptyString } from "../lib/value";
import { normalizeOutput, runProcess, runWslScript, type CommandResult } from "./shell";
import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";

const IS_WINDOWS = process.platform === "win32";

export const BROWSER_CDP_PORT = 9222;
export const BROWSER_BOOT_URL = process.env.CLAWOS_BROWSER_BOOT_URL?.trim() || "about:blank";
export const BROWSER_USER_DATA_DIR = process.env.CLAWOS_CHROME_USER_DATA_DIR?.trim() || "C:\\chrome-openclaw";

const BROWSER_CDP_VERSION_URL = `http://127.0.0.1:${BROWSER_CDP_PORT}/json/version`;
const BROWSER_CDP_PROBE_TIMEOUT_MS = 20_000;
const BROWSER_CDP_PROBE_INTERVAL_MS = 800;
const WINDOWS_ELEVATION_CANCEL_EXIT_CODE = 1223;

export const DEFAULT_CHROME_EXE_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function quoteWindowsCommandArg(value: string): string {
  if (value.length === 0) {
    return '""';
  }
  if (!/[\s"]/u.test(value) && !value.endsWith("\\")) {
    return value;
  }

  let quoted = '"';
  let backslashCount = 0;
  for (const char of value) {
    if (char === "\\") {
      backslashCount += 1;
      continue;
    }
    if (char === '"') {
      quoted += "\\".repeat(backslashCount * 2 + 1);
      quoted += '"';
      backslashCount = 0;
      continue;
    }
    if (backslashCount > 0) {
      quoted += "\\".repeat(backslashCount);
      backslashCount = 0;
    }
    quoted += char;
  }
  if (backslashCount > 0) {
    quoted += "\\".repeat(backslashCount * 2);
  }
  quoted += '"';
  return quoted;
}

export function buildWindowsElevationCheckArgs(): string[] {
  return [
    "powershell.exe",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    [
      "$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())",
      "if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { exit 0 }",
      "exit 1",
    ].join("\n"),
  ];
}

export function buildElevatedProcessCommand(filePath: string, argumentList: string[]): string {
  const argumentLine = argumentList.map((arg) => quoteWindowsCommandArg(arg)).join(" ");
  return [
    "$ErrorActionPreference = 'Stop'",
    "try {",
    `  $proc = Start-Process -FilePath '${escapePowerShellSingleQuoted(filePath)}' -ArgumentList '${escapePowerShellSingleQuoted(argumentLine)}' -Verb RunAs -WindowStyle Hidden -Wait -PassThru`,
    "  exit $proc.ExitCode",
    "} catch {",
    "  $message = $_.Exception.Message",
    "  if ($message) { [Console]::Error.WriteLine($message) }",
    "  if ($message -match 'cancelled by the user|canceled by the user') { exit 1223 }",
    "  exit 1",
    "}",
  ].join("\n");
}

export function buildElevatedProcessArgs(filePath: string, argumentList: string[]): string[] {
  return [
    "powershell.exe",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    buildElevatedProcessCommand(filePath, argumentList),
  ];
}

let cachedWindowsElevationState: boolean | null = null;

async function isCurrentProcessElevated(): Promise<boolean> {
  if (!IS_WINDOWS) {
    return false;
  }
  if (cachedWindowsElevationState !== null) {
    return cachedWindowsElevationState;
  }

  const result = await runProcess(buildWindowsElevationCheckArgs());
  cachedWindowsElevationState = result.ok;
  return cachedWindowsElevationState;
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

function isElevationError(result: CommandResult): boolean {
  const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return text.includes("requires elevation");
}

function isElevationCancelled(result: CommandResult): boolean {
  const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return (
    result.code === WINDOWS_ELEVATION_CANCEL_EXIT_CODE ||
    text.includes("operation was canceled by the user") ||
    text.includes("operation was cancelled by the user")
  );
}

async function runNetshCommand(task: Task, args: string[]): Promise<CommandResult> {
  const elevated = await isCurrentProcessElevated();
  if (elevated) {
    return await runProcess(args);
  }

  appendTaskLog(task, "Current process is not elevated. Requesting Windows administrator approval (UAC).");
  return await runProcess(buildElevatedProcessArgs("netsh.exe", args.slice(1)));
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
  task.step = step;
  appendTaskLog(task, `Step ${step}/${totalSteps}: read WSL nameserver`);
  appendTaskLog(task, "Run: cat /etc/resolv.conf");

  const script = [
    "set -euo pipefail",
    "if [ ! -f /etc/resolv.conf ]; then",
    '  echo "/etc/resolv.conf not found" >&2',
    "  exit 1",
    "fi",
    "cat /etc/resolv.conf",
  ].join("\n");
  const result = await runWslScript(script, { shellMode: "clean", loginShell: false });
  appendProcessLogs(task, result, result.ok);
  if (!result.ok) {
    throw new Error(`read WSL nameserver failed (exit code ${result.code})`);
  }

  const nameserver = parseFirstNameserver(result.stdout);
  if (!nameserver) {
    throw new Error("Could not parse nameserver from /etc/resolv.conf.");
  }

  appendTaskLog(task, `WSL nameserver: ${nameserver}`);
  return nameserver;
}

export function buildRemoteCdpUrl(localWebSocketDebuggerUrl: string, nameserver: string): string {
  const parsed = new URL(localWebSocketDebuggerUrl);
  parsed.hostname = nameserver;
  parsed.port = String(BROWSER_CDP_PORT);
  parsed.protocol = parsed.protocol === "wss:" ? "wss:" : "ws:";
  return parsed.toString();
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
  await applyOpenclawConfig(config, "ClawOS open browser CDP");
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

export function startBrowserRestartTask(): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("browser-cdp-restart");
  if (runningTask) {
    appendTaskLog(runningTask, "Reusing existing browser restart task.");
    return { task: runningTask, reused: true };
  }

  const totalSteps = 3;
  const task = createTask("browser-cdp-restart", "打开浏览器 CDP", totalSteps);
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
      const remoteCdpUrl = buildRemoteCdpUrl(version.webSocketDebuggerUrl, nameserver);

      task.step = 3;
      appendTaskLog(task, `Step 3/${totalSteps}: update openclaw browser config`);
      appendTaskLog(task, `Local WebSocket endpoint: ${version.webSocketDebuggerUrl}`);
      appendTaskLog(task, `WSL WebSocket endpoint: ${remoteCdpUrl}`);
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
  return startBrowserRestartTask();
}
