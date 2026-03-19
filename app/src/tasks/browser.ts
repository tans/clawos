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
// Chrome listens on all interfaces so the WSL side can reach Windows via the host LAN/gateway address.
export const BROWSER_CDP_BIND_ADDRESS = process.env.CLAWOS_BROWSER_CDP_BIND_ADDRESS?.trim() || "0.0.0.0";
export const WSL_WINDOWS_HOST_OVERRIDE =
  process.env.CLAWOS_WSL_WINDOWS_HOST?.trim() || process.env.CLAWOS_WSL_CDP_HOST?.trim() || "";

// Probe locally from Windows first; the remote URL is derived later from the WSL-visible Windows host address.
const BROWSER_CDP_VERSION_URL = `http://localhost:${BROWSER_CDP_PORT}/json/version`;
const BROWSER_CDP_PROBE_TIMEOUT_MS = 20_000;
const BROWSER_CDP_PROBE_INTERVAL_MS = 800;
const WINDOWS_ELEVATION_CANCEL_EXIT_CODE = 1223;
const BROWSER_CDP_FIREWALL_RULE_NAME = "ClawOS Browser CDP";

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

async function runNetshStep(task: Task, args: string[], options?: { allowFailure?: boolean }): Promise<void> {
  appendTaskLog(task, `Run: ${args.join(" ")}`);
  const result = await runNetshCommand(task, args);
  const treatedAsSuccess = result.ok || options?.allowFailure === true;
  appendProcessLogs(task, result, treatedAsSuccess);
  if (!treatedAsSuccess) {
    if (isElevationCancelled(result)) {
      throw new Error("Windows 管理员授权已取消，无法配置 CDP 端口映射。");
    }
    if (isElevationError(result)) {
      throw new Error("配置 CDP 端口映射需要 Windows 管理员权限。");
    }
    throw new Error(`netsh failed (exit code ${result.code})`);
  }
}

async function ensureWindowsCdpFirewallRule(task: Task): Promise<void> {
  appendTaskLog(task, `Prepare Windows firewall rule for TCP ${BROWSER_CDP_PORT}`);
  await runNetshStep(
    task,
    ["netsh.exe", "advfirewall", "firewall", "delete", "rule", `name=${BROWSER_CDP_FIREWALL_RULE_NAME}`],
    { allowFailure: true }
  );
  await runNetshStep(task, [
    "netsh.exe",
    "advfirewall",
    "firewall",
    "add",
    "rule",
    `name=${BROWSER_CDP_FIREWALL_RULE_NAME}`,
    "dir=in",
    "action=allow",
    "protocol=TCP",
    `localport=${BROWSER_CDP_PORT}`,
  ]);
}

async function ensureWindowsCdpIngress(task: Task): Promise<void> {
  appendTaskLog(task, `Ensure Windows allows inbound CDP on ${BROWSER_CDP_BIND_ADDRESS}:${BROWSER_CDP_PORT}`);
  await ensureWindowsCdpFirewallRule(task);
}

type CdpVersionProbeResult = {
  payload: Record<string, unknown>;
  webSocketDebuggerUrl: string;
};

type WslHostProbeResult = {
  host: string;
  url: string;
  command: string;
};

function buildTrustedWslHostResult(host: string): WslHostProbeResult {
  return {
    host,
    url: `http://${host}:${BROWSER_CDP_PORT}/json/version`,
    command: `override:${host}`,
  };
}

function buildWindowsCdpProbeScript(timeoutSeconds: number): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    `$url = '${escapePowerShellSingleQuoted(BROWSER_CDP_VERSION_URL)}'`,
    // curl.exe is more reliable than Invoke-WebRequest against the local CDP endpoint on some Windows setups.
    "if (Get-Command curl.exe -ErrorAction SilentlyContinue) {",
    `  & curl.exe --silent --show-error --fail --max-time ${timeoutSeconds} $url`,
    "} else {",
    `  $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec ${timeoutSeconds}`,
    "  if (-not $response -or -not $response.Content) { throw 'Empty CDP version response.' }",
    "  $response.Content",
    "}",
  ].join("\n");
}

async function fetchCdpVersion(timeoutMs: number): Promise<CdpVersionProbeResult> {
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const result = await runProcess(
    [
      "powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      buildWindowsCdpProbeScript(timeoutSeconds),
    ],
    { timeoutMs: timeoutMs + 1000 }
  );

  if (!result.ok) {
    const message = result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`;
    throw new Error(message);
  }

  const payload = asObject(JSON.parse(result.stdout));
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

export function parseAllNameservers(content: string): string[] {
  const values: string[] = [];
  for (const line of content.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^nameserver\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3})$/i);
    if (match?.[1]) {
      values.push(match[1]);
    }
  }
  return Array.from(new Set(values));
}

export function parseDefaultGateway(content: string): string | null {
  for (const line of content.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const match = trimmed.match(/^default\s+via\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3})\b/i);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

async function readWslNetworkHints(
  task: Task,
  step: number,
  totalSteps: number
): Promise<{ gateway: string | null; nameservers: string[] }> {
  task.step = step;
  appendTaskLog(task, `Step ${step}/${totalSteps}: detect WSL -> Windows host route`);
  appendTaskLog(task, "Run: ip route + cat /etc/resolv.conf");

  const script = [
    "set -euo pipefail",
    // WSL usually exposes the Windows host through the default gateway and resolv.conf nameserver entries.
    'echo "__CLAWOS_IP_ROUTE_BEGIN__"',
    "if command -v ip >/dev/null 2>&1; then",
    "  ip route show default 2>/dev/null || true",
    "fi",
    'echo "__CLAWOS_IP_ROUTE_END__"',
    'echo "__CLAWOS_RESOLV_BEGIN__"',
    "if [ -f /etc/resolv.conf ]; then",
    "  cat /etc/resolv.conf",
    "fi",
    'echo "__CLAWOS_RESOLV_END__"',
  ].join("\n");
  const result = await runWslScript(script, { shellMode: "clean", loginShell: false });
  appendProcessLogs(task, result, result.ok);
  if (!result.ok) {
    throw new Error(`read WSL network hints failed (exit code ${result.code})`);
  }

  const stdout = result.stdout;
  const routeMatch = stdout.match(/__CLAWOS_IP_ROUTE_BEGIN__\r?\n([\s\S]*?)\r?\n__CLAWOS_IP_ROUTE_END__/);
  const resolvMatch = stdout.match(/__CLAWOS_RESOLV_BEGIN__\r?\n([\s\S]*?)\r?\n__CLAWOS_RESOLV_END__/);
  const routeText = routeMatch?.[1] || "";
  const resolvText = resolvMatch?.[1] || "";
  const gateway = parseDefaultGateway(routeText);
  const nameservers = parseAllNameservers(resolvText);

  if (gateway) {
    appendTaskLog(task, `WSL default gateway: ${gateway}`);
  }
  if (nameservers.length > 0) {
    appendTaskLog(task, `WSL nameservers: ${nameservers.join(", ")}`);
  }

  return {
    gateway,
    nameservers,
  };
}

async function probeWslHostCdp(host: string): Promise<WslHostProbeResult> {
  const script = [
    "set -euo pipefail",
    `HOST='${host.replaceAll("'", "'\"'\"'")}'`,
    `URL="http://$HOST:${BROWSER_CDP_PORT}/json/version"`,
    'if command -v curl >/dev/null 2>&1; then',
    '  curl -fsS --globoff --max-time 4 "$URL" >/dev/null',
    'elif command -v wget >/dev/null 2>&1; then',
    '  wget -q -T 4 -O - "$URL" >/dev/null',
    "else",
    '  echo "curl/wget not found in WSL" >&2',
    "  exit 127",
    "fi",
  ].join("\n");
  const result = await runWslScript(script, { shellMode: "clean", loginShell: false });
  if (!result.ok) {
    const errorText = result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`;
    throw new Error(`${host} => ${errorText}`);
  }

  return {
    host,
    url: `http://${host}:${BROWSER_CDP_PORT}/json/version`,
    command: result.command,
  };
}

async function resolveReachableWslWindowsHost(
  task: Task,
  step: number,
  totalSteps: number
): Promise<WslHostProbeResult> {
  // When the host IP is already known, skip WSL introspection so transient WSL service issues do not block CDP setup.
  if (WSL_WINDOWS_HOST_OVERRIDE) {
    const trusted = buildTrustedWslHostResult(WSL_WINDOWS_HOST_OVERRIDE);
    task.step = step;
    appendTaskLog(task, `Step ${step}/${totalSteps}: use configured Windows host for WSL`);
    appendTaskLog(task, `Using CLAWOS_WSL_WINDOWS_HOST override: ${trusted.host}`);
    appendTaskLog(task, `Skip WSL route detection. Trusted URL: ${trusted.url}`);
    return trusted;
  }

  let hints: { gateway: string | null; nameservers: string[] };
  try {
    hints = await readWslNetworkHints(task, step, totalSteps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `WSL route detection failed: ${message}. If WSL is not available, start the WSL service first or set CLAWOS_WSL_WINDOWS_HOST to your Windows host IP.`
    );
  }

  const candidates = dedupeStrings([
    hints.gateway || "",
    ...hints.nameservers,
  ]);

  if (candidates.length === 0) {
    throw new Error(
      "Could not determine a Windows host address from WSL. Set CLAWOS_WSL_WINDOWS_HOST to override."
    );
  }

  const errors: string[] = [];
  for (const host of candidates) {
    appendTaskLog(task, `Probe WSL host candidate: ${host}`);
    try {
      const result = await probeWslHostCdp(host);
      appendTaskLog(task, `WSL can reach Windows CDP via ${result.url}`);
      appendTaskLog(task, `Run: ${result.command}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      appendTaskLog(task, `WSL host candidate failed: ${message}`, "error");
    }
  }

  throw new Error(
    `WSL could not reach Windows CDP on port ${BROWSER_CDP_PORT}. Tried: ${candidates.join(", ")}. Details: ${errors.join(" | ")}`
  );
}

export function buildRemoteCdpUrl(localWebSocketDebuggerUrl: string, host: string): string {
  const parsed = new URL(localWebSocketDebuggerUrl);
  // Chrome reports a loopback websocket URL locally; rewrite it to the Windows host address that WSL can actually dial.
  parsed.hostname = host;
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

  // Preserve any existing timeout tuning while forcing attach-only mode to the externally managed browser instance.
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
    `--remote-debugging-address=${BROWSER_CDP_BIND_ADDRESS}`,
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

  const totalSteps = 4;
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
      appendTaskLog(task, `Step 1/${totalSteps}: start Chrome CDP on ${BROWSER_CDP_BIND_ADDRESS}:${BROWSER_CDP_PORT}`);
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

      task.step = 2;
      appendTaskLog(task, `Step 2/${totalSteps}: allow Windows CDP access from WSL`);
      await ensureWindowsCdpIngress(task);

      const reachableHost = await resolveReachableWslWindowsHost(task, 3, totalSteps);
      const remoteCdpUrl = buildRemoteCdpUrl(version.webSocketDebuggerUrl, reachableHost.host);

      task.step = 4;
      appendTaskLog(task, `Step 4/${totalSteps}: update openclaw browser config`);
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
