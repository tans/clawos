import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { applyOpenclawConfig, readOpenclawConfig } from "../gateway/config";
import { asObject, readNonEmptyString, toFiniteNumber } from "../lib/value";
import { normalizeOutput, runProcess, runWslScript, type CommandResult } from "./shell";
import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";

const IS_WINDOWS = process.platform === "win32";

export const BROWSER_CDP_PORT = 9222;
export const BROWSER_BOOT_URL = process.env.CLAWOS_BROWSER_BOOT_URL?.trim() || "about:blank";
export const BROWSER_USER_DATA_DIR = process.env.CLAWOS_CHROME_USER_DATA_DIR?.trim() || "C:\\chrome-openclaw";

const BROWSER_CDP_PORT_SEARCH_LIMIT = 20;
const BROWSER_CDP_PROBE_TIMEOUT_MS = 20_000;
const BROWSER_CDP_PROBE_INTERVAL_MS = 800;
const WINDOWS_ELEVATION_CANCEL_EXIT_CODE = 1223;
const BROWSER_CDP_FIREWALL_RULE_NAME = "ClawOS Browser CDP";
const BROWSER_CDP_PORTPROXY_LEGACY_LISTEN_ADDRESS = "0.0.0.0";
const BROWSER_CDP_PORTPROXY_CONNECT_ADDRESS = "127.0.0.1";
const WSL_HOST_PROBE_TIMEOUT_MS = 30_000;
const WSL_HOST_PROBE_INTERVAL_MS = 1_000;
const WSL_HOST_PROBE_INITIAL_DELAY_MS = 2_000;

export const DEFAULT_CHROME_EXE_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

type BrowserTaskConfig = {
  cdpPort: number;
};

type WslWindowsHostHints = {
  candidates: string[];
  preferredHost: string | null;
};

function isValidPortNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

export function normalizeBrowserCdpPort(value: unknown, fallback = BROWSER_CDP_PORT): number {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined) {
    return fallback;
  }

  const normalized = Math.floor(parsed);
  return isValidPortNumber(normalized) ? normalized : fallback;
}

function inferBrowserCdpPortFromUrl(value: unknown): number | undefined {
  const text = readNonEmptyString(value);
  if (!text) {
    return undefined;
  }

  try {
    const parsed = new URL(text);
    if (!parsed.port) {
      return undefined;
    }
    return normalizeBrowserCdpPort(parsed.port, NaN);
  } catch {
    return undefined;
  }
}

export function resolveBrowserCdpPort(config: Record<string, unknown> | null, fallback = BROWSER_CDP_PORT): number {
  if (!config) {
    return fallback;
  }

  const inferred = inferBrowserCdpPortFromUrl(config.cdpUrl);
  if (inferred !== undefined && isValidPortNumber(inferred)) {
    return inferred;
  }

  return fallback;
}

export function buildConfiguredBrowserCdpUrl(currentCdpUrl: unknown, cdpPort = BROWSER_CDP_PORT): string {
  const rawUrl = readNonEmptyString(currentCdpUrl);
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      parsed.protocol = parsed.protocol === "https:" || parsed.protocol === "wss:" ? "https:" : "http:";
      parsed.port = String(cdpPort);
      parsed.pathname = "/";
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    } catch {
      // Fall through to the default local endpoint when the saved URL is malformed.
    }
  }

  return `http://127.0.0.1:${cdpPort}/`;
}

function buildCdpVersionUrl(cdpPort: number): string {
  return `http://127.0.0.1:${cdpPort}/json/version`;
}

async function readBrowserTaskConfig(): Promise<BrowserTaskConfig> {
  const config = await readOpenclawConfig();
  const browserConfig = asObject(config.browser);
  return {
    cdpPort: resolveBrowserCdpPort(browserConfig),
  };
}

async function saveBrowserCdpUrlPort(task: Task, cdpPort: number): Promise<void> {
  const config = await readOpenclawConfig();
  const currentBrowser = asObject(config.browser) || {};
  const previousPort = resolveBrowserCdpPort(currentBrowser);
  const nextCdpUrl = buildConfiguredBrowserCdpUrl(currentBrowser.cdpUrl, cdpPort);
  const previousCdpUrl = readNonEmptyString(currentBrowser.cdpUrl) ?? "";
  const hasLegacyCdpPort = Object.prototype.hasOwnProperty.call(currentBrowser, "cdpPort");

  if (previousPort === cdpPort && previousCdpUrl === nextCdpUrl && !hasLegacyCdpPort) {
    return;
  }

  const nextBrowser = {
    ...currentBrowser,
    cdpUrl: nextCdpUrl,
  };
  delete nextBrowser.cdpPort;
  config.browser = nextBrowser;
  await applyOpenclawConfig(config, "ClawOS browser port update");
  appendTaskLog(task, `browser.cdpUrl => ${nextCdpUrl}`);
}

async function canBindLoopbackPort(cdpPort: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = createServer();
    let settled = false;

    const finish = (available: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(available);
    };

    server.once("error", () => finish(false));
    server.once("listening", () => {
      server.close(() => finish(true));
    });

    server.listen({
      host: "127.0.0.1",
      port: cdpPort,
      exclusive: true,
    });
  });
}

async function resolveAvailableBrowserCdpPort(task: Task, preferredPort: number): Promise<number> {
  const maxPort = Math.min(65535, preferredPort + BROWSER_CDP_PORT_SEARCH_LIMIT - 1);
  for (let candidate = preferredPort; candidate <= maxPort; candidate += 1) {
    if (await canBindLoopbackPort(candidate)) {
      if (candidate !== preferredPort) {
        appendTaskLog(task, `CDP port ${preferredPort} is occupied; using ${candidate} instead.`);
      }
      return candidate;
    }
    appendTaskLog(task, `CDP port ${candidate} is occupied; try next port.`);
  }

  throw new Error(`No available CDP port found between ${preferredPort} and ${maxPort}.`);
}

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

async function runNetshReadCommand(task: Task, args: string[]): Promise<CommandResult> {
  appendTaskLog(task, `Run: ${args.join(" ")}`);
  let result = await runProcess(args);
  if (!result.ok && (isElevationCancelled(result) || isElevationError(result))) {
    result = await runNetshCommand(task, args);
  }
  appendProcessLogs(task, result, result.ok || isElevationCancelled(result) || isElevationError(result));
  return result;
}

async function runNetshStep(task: Task, args: string[], options?: { allowFailure?: boolean }): Promise<void> {
  appendTaskLog(task, `Run: ${args.join(" ")}`);
  const result = await runNetshCommand(task, args);
  const treatedAsSuccess = result.ok || options?.allowFailure === true;
  appendProcessLogs(task, result, treatedAsSuccess);
  if (!treatedAsSuccess) {
    if (isElevationCancelled(result)) {
      throw new Error("Windows administrator approval was cancelled.");
    }
    if (isElevationError(result)) {
      throw new Error("Windows administrator permission is required.");
    }
    throw new Error(`netsh failed (exit code ${result.code})`);
  }
}

type CdpVersionProbeResult = {
  payload: Record<string, unknown>;
  webSocketDebuggerUrl: string;
};

async function fetchCdpVersion(timeoutMs: number, cdpPort = BROWSER_CDP_PORT): Promise<CdpVersionProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const versionUrl = buildCdpVersionUrl(cdpPort);
  try {
    const response = await fetch(versionUrl, {
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

async function waitForCdpVersion(task: Task, cdpPort = BROWSER_CDP_PORT): Promise<CdpVersionProbeResult> {
  const deadline = Date.now() + BROWSER_CDP_PROBE_TIMEOUT_MS;
  let lastError = "unknown error";
  let attempt = 0;
  const versionUrl = buildCdpVersionUrl(cdpPort);

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const result = await fetchCdpVersion(3_000, cdpPort);
      appendTaskLog(task, `CDP ready: ${versionUrl}`);
      appendTaskLog(task, `CDP WebSocket: ${result.webSocketDebuggerUrl}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = message;
      appendTaskLog(task, `CDP probe attempt ${attempt} failed: ${message}`);
      await Bun.sleep(BROWSER_CDP_PROBE_INTERVAL_MS);
    }
  }

  throw new Error(`CDP port ${cdpPort} timed out: ${lastError}`);
}

async function probeWslWindowsHost(host: string, cdpPort: number): Promise<CommandResult> {
  const probeScript = [
    "set -euo pipefail",
    `HOST='${host.replace(/'/g, `'\"'\"'`)}'`,
    `URL="http://$HOST:${cdpPort}/json/version"`,
    'if command -v curl >/dev/null 2>&1; then',
    '  curl -fsS --globoff --max-time 4 "$URL" >/dev/null',
    'elif command -v wget >/dev/null 2>&1; then',
    '  wget -q -T 4 -O - "$URL" >/dev/null',
    "else",
    '  echo "curl/wget not found in WSL" >&2',
    "  exit 127",
    "fi",
  ].join("\n");

  return await runWslScript(probeScript, { shellMode: "clean", loginShell: false });
}

function summarizeProbeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || "unknown error";
  }
  return String(error);
}

function hasPortProxyMapping(output: string, cdpPort = BROWSER_CDP_PORT, listenAddress?: string): boolean {
  const normalized = output.toLowerCase().replace(/\s+/g, " ");
  const expectedListenAddress = (listenAddress || BROWSER_CDP_PORTPROXY_LEGACY_LISTEN_ADDRESS).toLowerCase();
  return (
    normalized.includes(`${expectedListenAddress} ${cdpPort}`) &&
    normalized.includes(`${BROWSER_CDP_PORTPROXY_CONNECT_ADDRESS} ${cdpPort}`)
  );
}

async function ensureWindowsCdpFirewallRule(task: Task, cdpPort = BROWSER_CDP_PORT): Promise<void> {
  appendTaskLog(task, `Prepare Windows firewall rule for TCP ${cdpPort}`);
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
    `localport=${cdpPort}`,
  ]);
}

export function buildWindowsCdpPortProxyDeleteArgs(
  cdpPort = BROWSER_CDP_PORT,
  listenAddress = BROWSER_CDP_PORTPROXY_LEGACY_LISTEN_ADDRESS
): string[] {
  return [
    "netsh.exe",
    "interface",
    "portproxy",
    "delete",
    "v4tov4",
    `listenport=${cdpPort}`,
    `listenaddress=${listenAddress}`,
  ];
}

export function buildWindowsCdpPortProxyAddArgs(cdpPort = BROWSER_CDP_PORT, listenAddress: string): string[] {
  return [
    "netsh.exe",
    "interface",
    "portproxy",
    "add",
    "v4tov4",
    `listenport=${cdpPort}`,
    `listenaddress=${listenAddress}`,
    `connectport=${cdpPort}`,
    `connectaddress=${BROWSER_CDP_PORTPROXY_CONNECT_ADDRESS}`,
  ];
}

async function ensureWindowsCdpPortProxy(task: Task, cdpPort = BROWSER_CDP_PORT, listenAddress: string): Promise<void> {
  const deleteAddresses = dedupeStrings([BROWSER_CDP_PORTPROXY_LEGACY_LISTEN_ADDRESS, listenAddress]);
  appendTaskLog(
    task,
    `Prepare Windows portproxy ${listenAddress}:${cdpPort} -> ${BROWSER_CDP_PORTPROXY_CONNECT_ADDRESS}:${cdpPort}`
  );
  for (const address of deleteAddresses) {
    await runNetshStep(task, buildWindowsCdpPortProxyDeleteArgs(cdpPort, address), { allowFailure: true });
  }
  await runNetshStep(task, buildWindowsCdpPortProxyAddArgs(cdpPort, listenAddress));
}

type FirewallRuleProbeItem = {
  displayName?: string;
  enabled?: boolean;
  direction?: number | string;
  action?: number | string;
  protocol?: string;
  localPort?: string;
};

function normalizeFirewallRuleItems(value: unknown): FirewallRuleProbeItem[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is FirewallRuleProbeItem => Boolean(asObject(item)));
  }
  const objectValue = asObject(value);
  return objectValue ? [objectValue as FirewallRuleProbeItem] : [];
}

function isAllowedInboundTcpRule(item: FirewallRuleProbeItem, cdpPort = BROWSER_CDP_PORT): boolean {
  const direction = String(item.direction ?? "").toLowerCase();
  const action = String(item.action ?? "").toLowerCase();
  const protocol = String(item.protocol ?? "").toLowerCase();
  const localPort = String(item.localPort ?? "").trim();
  return (
    item.enabled === true &&
    (direction === "inbound" || direction === "1") &&
    (action === "allow" || action === "2") &&
    (protocol === "tcp" || protocol === "6") &&
    localPort === String(cdpPort)
  );
}

async function probeFirewallRules(task: Task, cdpPort = BROWSER_CDP_PORT): Promise<FirewallRuleProbeItem[]> {
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `$port = '${cdpPort}'`,
    "$rules = Get-NetFirewallRule -PolicyStore ActiveStore -ErrorAction Stop |",
    "  Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' -and $_.Action -eq 'Allow' } |",
    "  Get-NetFirewallPortFilter -ErrorAction Stop |",
    "  Where-Object { ($_.Protocol -eq 'TCP' -or $_.Protocol -eq 6) -and ($_.LocalPort -eq $port) } |",
    "  Select-Object @{Name='displayName';Expression={$_.AssociatedNetFirewallRule.DisplayName}},",
    "                @{Name='enabled';Expression={$_.AssociatedNetFirewallRule.Enabled -eq 'True'}},",
    "                @{Name='direction';Expression={$_.AssociatedNetFirewallRule.Direction}},",
    "                @{Name='action';Expression={$_.AssociatedNetFirewallRule.Action}},",
    "                @{Name='protocol';Expression={$_.Protocol}},",
    "                @{Name='localPort';Expression={$_.LocalPort}}",
    "$result = @($rules)",
    "if ($result.Count -eq 0) { '[]'; exit 0 }",
    "$result | ConvertTo-Json -Compress",
  ].join("\n");

  appendTaskLog(task, "Run: powershell.exe Get-NetFirewallRule/Get-NetFirewallPortFilter");
  const result = await runProcess(
    ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
    { timeoutMs: 10_000 }
  );
  appendProcessLogs(task, result, result.ok);
  if (!result.ok) {
    return [];
  }

  try {
    return normalizeFirewallRuleItems(JSON.parse(result.stdout.trim() || "[]"));
  } catch (error) {
    appendTaskLog(task, `Firewall result parse failed: ${summarizeProbeError(error)}`, "error");
    return [];
  }
}

async function detectLocalCdp(task: Task, cdpPort = BROWSER_CDP_PORT): Promise<boolean> {
  const versionUrl = buildCdpVersionUrl(cdpPort);
  appendTaskLog(task, `Probe local CDP: ${versionUrl}`);
  try {
    const result = await fetchCdpVersion(3_000, cdpPort);
    const browserText = readNonEmptyString(result.payload.Browser) || "unknown browser";
    appendTaskLog(task, `PASS 127.0.0.1:${cdpPort} CDP is open`);
    appendTaskLog(task, `Browser: ${browserText}`);
    appendTaskLog(task, `WebSocket: ${result.webSocketDebuggerUrl}`);
    return true;
  } catch (error) {
    appendTaskLog(task, `FAIL 127.0.0.1:${cdpPort} CDP is not reachable: ${summarizeProbeError(error)}`, "error");
    return false;
  }
}

async function detectPortProxy(
  task: Task,
  cdpPort = BROWSER_CDP_PORT,
  listenAddress = BROWSER_CDP_PORTPROXY_LEGACY_LISTEN_ADDRESS
): Promise<boolean> {
  const result = await runNetshReadCommand(task, ["netsh.exe", "interface", "portproxy", "show", "v4tov4"]);
  if (!result.ok) {
    if (isElevationCancelled(result)) {
      appendTaskLog(task, "SKIP portproxy detection: Windows administrator approval was cancelled.", "error");
    } else if (isElevationError(result)) {
      appendTaskLog(task, "SKIP portproxy detection: Windows administrator permission is required.", "error");
    } else {
      appendTaskLog(task, `FAIL portproxy detection failed (exit code ${result.code})`, "error");
    }
    return false;
  }

  const mapped = hasPortProxyMapping(result.stdout, cdpPort, listenAddress);
  appendTaskLog(
    task,
    mapped
      ? `PASS ${listenAddress}:${cdpPort} forwards to ${BROWSER_CDP_PORTPROXY_CONNECT_ADDRESS}:${cdpPort}`
      : `FAIL missing portproxy ${listenAddress}:${cdpPort} -> ${BROWSER_CDP_PORTPROXY_CONNECT_ADDRESS}:${cdpPort}`,
    mapped ? "info" : "error"
  );
  return mapped;
}

async function detectFirewallRule(task: Task, cdpPort = BROWSER_CDP_PORT): Promise<boolean> {
  const rules = await probeFirewallRules(task, cdpPort);
  const allowed = rules.some((item) => isAllowedInboundTcpRule(item, cdpPort));
  const namedRule = rules.find((item) => item.displayName === BROWSER_CDP_FIREWALL_RULE_NAME);
  if (namedRule) {
    appendTaskLog(task, `Matched firewall rule: ${namedRule.displayName}`);
  } else if (rules.length > 0) {
    appendTaskLog(task, `Matched ${rules.length} inbound allow rule(s) for TCP ${cdpPort}`);
  }
  appendTaskLog(
    task,
    allowed
      ? `PASS Windows firewall allows inbound TCP ${cdpPort}`
      : `FAIL Windows firewall does not have an enabled inbound allow rule for TCP ${cdpPort}`,
    allowed ? "info" : "error"
  );
  return allowed;
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
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function buildRemoteCdpUrl(localWebSocketDebuggerUrl: string, host: string, cdpPort = BROWSER_CDP_PORT): string {
  const parsed = new URL(localWebSocketDebuggerUrl);
  // OpenClaw/Codex expects an HTTP(S) CDP base URL here, not the raw DevTools WebSocket endpoint.
  parsed.hostname = host;
  parsed.port = String(cdpPort);
  parsed.protocol = parsed.protocol === "wss:" ? "https:" : "http:";
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

async function readWslWindowsHostHints(task: Task): Promise<WslWindowsHostHints> {
  appendTaskLog(task, "Run: read WSL default route and nameservers");
  const script = [
    "set -euo pipefail",
    'echo "__CLAWOS_IP_ROUTE_BEGIN__"',
    "if command -v ip >/dev/null 2>&1; then ip route show default 2>/dev/null || true; fi",
    'echo "__CLAWOS_IP_ROUTE_END__"',
    'echo "__CLAWOS_RESOLV_BEGIN__"',
    "if [ -f /etc/resolv.conf ]; then cat /etc/resolv.conf; fi",
    'echo "__CLAWOS_RESOLV_END__"',
  ].join("\n");
  const hintsResult = await runWslScript(script, { shellMode: "clean", loginShell: false });
  appendProcessLogs(task, hintsResult, hintsResult.ok);
  if (!hintsResult.ok) {
    throw new Error(`read WSL network hints failed (exit code ${hintsResult.code})`);
  }

  const routeMatch = hintsResult.stdout.match(/__CLAWOS_IP_ROUTE_BEGIN__\r?\n([\s\S]*?)\r?\n__CLAWOS_IP_ROUTE_END__/);
  const resolvMatch = hintsResult.stdout.match(/__CLAWOS_RESOLV_BEGIN__\r?\n([\s\S]*?)\r?\n__CLAWOS_RESOLV_END__/);
  const gateway = parseDefaultGateway(routeMatch?.[1] || "");
  const nameservers = parseAllNameservers(resolvMatch?.[1] || "");
  const candidates = dedupeStrings([gateway || "", ...nameservers]);
  if (candidates.length === 0) {
    throw new Error("Could not determine Windows host IP from WSL.");
  }

  appendTaskLog(task, `WSL Windows host candidates: ${candidates.join(", ")}`);
  return {
    candidates,
    preferredHost: candidates[0] || null,
  };
}

async function ensureWslReachablePortProxy(
  task: Task,
  cdpPort: number,
  hints: WslWindowsHostHints
): Promise<string> {
  if (hints.candidates.length === 0) {
    throw new Error("Could not determine Windows host IP from WSL.");
  }

  appendTaskLog(task, `Wait ${WSL_HOST_PROBE_INITIAL_DELAY_MS}ms before probing WSL connectivity.`);
  await Bun.sleep(WSL_HOST_PROBE_INITIAL_DELAY_MS);

  const deadline = Date.now() + WSL_HOST_PROBE_TIMEOUT_MS;
  let lastError = "unknown error";
  while (Date.now() < deadline) {
    for (const host of hints.candidates) {
      await ensureWindowsCdpPortProxy(task, cdpPort, host);
      const probeResult = await probeWslWindowsHost(host, cdpPort);
      if (probeResult.ok) {
        appendTaskLog(task, `WSL can reach Windows CDP via ${host}:${cdpPort}`);
        return host;
      }
      lastError = probeResult.stderr.trim() || probeResult.stdout.trim() || `exit code ${probeResult.code}`;
      appendTaskLog(task, `WSL probe failed for ${host}: ${lastError}`, "error");
    }
    await Bun.sleep(WSL_HOST_PROBE_INTERVAL_MS);
  }

  throw new Error(`WSL could not reach Windows CDP on port ${cdpPort}: ${lastError}`);
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
  await applyOpenclawConfig(config, "ClawOS browser repair");
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

export function buildChromeStartCommand(exePath: string, workingDirectory: string, cdpPort = BROWSER_CDP_PORT): string {
  const args = [
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${BROWSER_USER_DATA_DIR}`,
    "--new-window",
    "--no-first-run",
    "--no-default-browser-check",
    BROWSER_BOOT_URL,
  ];
  const argumentList = args.map((arg) => `'${escapePowerShellSingleQuoted(arg)}'`).join(",");

  return `Start-Process -FilePath '${escapePowerShellSingleQuoted(exePath)}' -WorkingDirectory '${escapePowerShellSingleQuoted(workingDirectory)}' -ArgumentList ${argumentList} -WindowStyle Hidden`;
}

export function buildChromeStartArgs(exePath: string, workingDirectory: string, cdpPort = BROWSER_CDP_PORT): string[] {
  return [
    "powershell.exe",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    buildChromeStartCommand(exePath, workingDirectory, cdpPort),
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

      const browserConfig = await readBrowserTaskConfig();
      const hostHints = await readWslWindowsHostHints(task);
      const chromeExePath = resolveChromeExePath();
      if (!existsSync(chromeExePath)) {
        throw new Error(`chrome.exe not found: ${chromeExePath}`);
      }
      const chromeWorkingDirectory = resolveChromeWorkingDirectory(chromeExePath);

      task.step = 1;
      appendTaskLog(task, `Step 1/${totalSteps}: start local CDP`);
      appendTaskLog(task, `Preferred CDP port: ${browserConfig.cdpPort}`);
      appendTaskLog(task, "Run: taskkill /F /IM chrome.exe /T");
      const killResult = await runProcess(["taskkill", "/F", "/IM", "chrome.exe", "/T"]);
      appendProcessLogs(task, killResult, killResult.ok || killResult.code === 128);
      if (!killResult.ok && killResult.code !== 128) {
        throw new Error(`stop chrome.exe failed (exit code ${killResult.code})`);
      }

      const cdpPort = await resolveAvailableBrowserCdpPort(task, browserConfig.cdpPort);
      appendTaskLog(task, `Selected CDP port: ${cdpPort}`);

      await runProcessStep(task, {
        step: 1,
        totalSteps,
        name: `start Chrome with CDP on ${cdpPort}`,
        command: `powershell.exe ... ${buildChromeStartCommand(chromeExePath, chromeWorkingDirectory, cdpPort)}`,
        args: buildChromeStartArgs(chromeExePath, chromeWorkingDirectory, cdpPort),
      });

      appendTaskLog(task, `Run: GET ${buildCdpVersionUrl(cdpPort)}`);
      const version = await waitForCdpVersion(task, cdpPort);
      await saveBrowserCdpUrlPort(task, cdpPort);

      task.step = 2;
      appendTaskLog(task, `Step 2/${totalSteps}: ensure Windows firewall rule`);
      await ensureWindowsCdpFirewallRule(task, cdpPort);

      task.step = 3;
      appendTaskLog(task, `Step 3/${totalSteps}: ensure WSL portproxy access`);
      const windowsHost = await ensureWslReachablePortProxy(task, cdpPort, hostHints);
      const remoteCdpUrl = buildRemoteCdpUrl(version.webSocketDebuggerUrl, windowsHost, cdpPort);
      await resetOpenclawBrowserConfig(task, remoteCdpUrl);

      task.step = 4;
      appendTaskLog(task, `Step 4/${totalSteps}: record local CDP endpoint`);
      appendTaskLog(task, `CDP port: ${cdpPort}`);
      appendTaskLog(task, `WSL Windows host: ${windowsHost}`);
      appendTaskLog(task, `Local WebSocket endpoint: ${version.webSocketDebuggerUrl}`);

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

export function startBrowserRepairTask(): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("browser-cdp-repair");
  if (runningTask) {
    appendTaskLog(runningTask, "Reusing existing browser repair task.");
    return { task: runningTask, reused: true };
  }

  const totalSteps = 4;
  const task = createTask("browser-cdp-repair", "Browser Repair", totalSteps);
  task.status = "running";

  (async () => {
    try {
      if (!IS_WINDOWS) {
        throw new Error("Browser repair is only supported on Windows.");
      }

      const browserConfig = await readBrowserTaskConfig();
      const hostHints = await readWslWindowsHostHints(task);
      const cdpPort = browserConfig.cdpPort;

      task.step = 1;
      appendTaskLog(task, `Step 1/${totalSteps}: ensure Windows firewall rule`);
      appendTaskLog(task, `CDP port: ${cdpPort}`);
      await ensureWindowsCdpFirewallRule(task, cdpPort);

      task.step = 2;
      appendTaskLog(task, `Step 2/${totalSteps}: ensure WSL portproxy access`);
      const windowsHost = await ensureWslReachablePortProxy(task, cdpPort, hostHints);

      task.step = 3;
      appendTaskLog(task, `Step 3/${totalSteps}: read local CDP endpoint`);
      const version = await waitForCdpVersion(task, cdpPort);

      task.step = 4;
      appendTaskLog(task, `Step 4/${totalSteps}: update openclaw browser config`);
      const remoteCdpUrl = buildRemoteCdpUrl(version.webSocketDebuggerUrl, windowsHost, cdpPort);
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

export function startBrowserDetectTask(): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("browser-cdp-detect");
  if (runningTask) {
    appendTaskLog(runningTask, "Reusing existing browser detect task.");
    return { task: runningTask, reused: true };
  }

  const totalSteps = 1;
  const task = createTask("browser-cdp-detect", "Browser Detect", totalSteps);
  task.status = "running";

  (async () => {
    try {
      if (!IS_WINDOWS) {
        throw new Error("Browser detection is only supported on Windows.");
      }

      const browserConfig = await readBrowserTaskConfig();
      const cdpPort = browserConfig.cdpPort;

      task.step = 1;
      appendTaskLog(task, `Step 1/${totalSteps}: detect local CDP port`);
      appendTaskLog(task, `CDP port: ${cdpPort}`);
      const localCdpOk = await detectLocalCdp(task, cdpPort);

      if (localCdpOk) {
        task.status = "success";
        appendTaskLog(task, `CDP port check passed: 127.0.0.1:${cdpPort}`);
      } else {
        task.status = "failed";
        task.error = `CDP port check failed: 127.0.0.1:${cdpPort} is not reachable.`;
        appendTaskLog(task, task.error, "error");
      }
      task.endedAt = new Date().toISOString();
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
  return startBrowserRepairTask();
}
