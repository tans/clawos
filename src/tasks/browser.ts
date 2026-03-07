import { existsSync } from "node:fs";
import path from "node:path";
import { applyOpenclawConfig, readOpenclawConfig } from "../gateway/config";
import { asObject, readNonEmptyString } from "../lib/value";
import { normalizeOutput, runProcess, runWslScript, type CommandResult } from "./shell";
import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";

const IS_WINDOWS = process.platform === "win32";

export const BROWSER_CDP_PORT = 9222;
export const BROWSER_CDP_PROXY_PORT = 9223;
export const BROWSER_BOOT_URL = process.env.CLAWOS_BROWSER_BOOT_URL?.trim() || "http://localhost:8080";
const BROWSER_CDP_VERSION_URL = `http://127.0.0.1:${BROWSER_CDP_PORT}/json/version`;
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

function isPortProxyDeleteNotFoundResult(result: CommandResult): boolean {
  const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return (
    text.includes("cannot find") ||
    text.includes("not found") ||
    text.includes("找不到") ||
    text.includes("没有找到")
  );
}

function isElevationRequiredResult(result: CommandResult): boolean {
  const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return (
    text.includes("requires elevation") ||
    text.includes("run as administrator") ||
    text.includes("需要提升") ||
    text.includes("管理员权限")
  );
}

function isElevationCanceledResult(result: CommandResult): boolean {
  const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return (
    result.code === 1223 ||
    text.includes("canceled by the user") ||
    text.includes("operation was canceled") ||
    text.includes("已取消") ||
    text.includes("拒绝")
  );
}

function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

async function runElevatedProcess(args: string[]): Promise<CommandResult> {
  if (!IS_WINDOWS) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "elevation is only supported on Windows",
      command: args.join(" "),
    };
  }
  if (args.length === 0) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "empty command",
      command: "",
    };
  }

  const filePath = args[0];
  const argList = args.slice(1);
  const quotedArgList = argList.map((item) => `'${escapePowerShellLiteral(item)}'`).join(", ");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$exe = '${escapePowerShellLiteral(filePath)}'`,
    `$argList = @(${quotedArgList})`,
    "try {",
    "  $proc = Start-Process -FilePath $exe -ArgumentList $argList -Verb RunAs -Wait -PassThru",
    "  if ($null -eq $proc) {",
    "    [Console]::Error.WriteLine('Start-Process returned null process handle')",
    "    exit 1",
    "  }",
    "  exit [int]$proc.ExitCode",
    "} catch {",
    "  $msg = $_.Exception.Message",
    "  if ($msg) { [Console]::Error.WriteLine($msg) }",
    "  if ($msg -match 'canceled by the user|operation was canceled|已取消|拒绝') {",
    "    exit 1223",
    "  }",
    "  exit 1",
    "}",
  ].join("\n");

  return await runProcess([
    "powershell.exe",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script,
  ]);
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
    allowElevation?: boolean;
  }
): Promise<void> {
  task.step = params.step;
  appendTaskLog(task, `步骤 ${params.step}/${params.totalSteps}：${params.name}`);
  appendTaskLog(task, `执行命令：${params.command}`);

  const result = await runProcess(params.args);
  const allowedExitCodes = new Set(params.allowExitCodes || []);
  const allowedFailure = params.allowFailureResult ? params.allowFailureResult(result) : false;
  const treatedAsSuccess = result.ok || allowedExitCodes.has(result.code) || allowedFailure;
  appendProcessLogs(task, result, treatedAsSuccess);
  if (!treatedAsSuccess) {
    if (params.allowElevation && isElevationRequiredResult(result)) {
      appendTaskLog(task, "检测到需要管理员权限，正在请求 UAC 授权后重试。");
      const elevated = await runElevatedProcess(params.args);
      appendProcessLogs(task, elevated, elevated.ok);
      if (elevated.ok) {
        appendTaskLog(task, "管理员提权执行成功。");
        return;
      }
      if (isElevationCanceledResult(elevated)) {
        throw new Error(`${params.name} 执行失败：你已取消 UAC 授权。请允许管理员权限后重试。`);
      }
      throw new Error(`${params.name} 执行失败：管理员提权后仍失败（退出码 ${elevated.code}）。`);
    }
    if (isElevationRequiredResult(result)) {
      throw new Error(`${params.name} 执行失败：需要管理员权限。请以管理员身份运行 ClawOS 后重试。`);
    }
    throw new Error(`${params.name} 执行失败（退出码 ${result.code}）`);
  }
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
  appendTaskLog(task, `步骤 ${params.step}/${params.totalSteps}：${params.name}`);
  appendTaskLog(task, `执行命令：${params.displayCommand}`);
  const result = await runWslScript(params.script, { shellMode: "clean", loginShell: false });
  appendProcessLogs(task, result, result.ok);
  if (!result.ok) {
    throw new Error(`${params.name} 执行失败（退出码 ${result.code}）`);
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
      throw new Error("返回格式无效，预期 JSON 对象。");
    }
    const webSocketDebuggerUrl = readNonEmptyString(payload.webSocketDebuggerUrl);
    if (!webSocketDebuggerUrl) {
      throw new Error("未返回 webSocketDebuggerUrl，CDP 可能尚未准备好。");
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
  let lastError = "未知错误";
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const result = await fetchCdpVersion(3_000);
      appendTaskLog(task, `CDP 就绪：${BROWSER_CDP_VERSION_URL}`);
      appendTaskLog(task, `CDP WebSocket: ${result.webSocketDebuggerUrl}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = message;
      appendTaskLog(task, `CDP 探测第 ${attempt} 次失败：${message}`);
      await Bun.sleep(BROWSER_CDP_PROBE_INTERVAL_MS);
    }
  }

  throw new Error(`CDP 端口 ${BROWSER_CDP_PORT} 启动超时：${lastError}`);
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
    '  echo "/etc/resolv.conf 不存在" >&2',
    "  exit 1",
    "fi",
    "cat /etc/resolv.conf",
  ].join("\n");
  const result = await runWslStep(task, {
    step,
    totalSteps,
    name: "读取 WSL nameserver",
    script,
    displayCommand: "cat /etc/resolv.conf",
  });

  const nameserver = parseFirstNameserver(result.stdout);
  if (!nameserver) {
    throw new Error("未在 /etc/resolv.conf 中解析到 nameserver。");
  }

  appendTaskLog(task, `WSL nameserver：${nameserver}`);
  return nameserver;
}

export function buildRemoteCdpUrl(localWebSocketDebuggerUrl: string, nameserver: string): string {
  const parsed = new URL(localWebSocketDebuggerUrl);
  const protocol = parsed.protocol === "wss:" || parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.protocol = protocol;
  parsed.hostname = nameserver;
  parsed.port = String(BROWSER_CDP_PROXY_PORT);
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
  await applyOpenclawConfig(config, "ClawOS 重置 browser 配置为 Remote CDP");

  appendTaskLog(task, "openclaw.browser 配置重置完成。");
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
    `未找到 chrome.exe。请先安装 Chrome，或通过 CLAWOS_CHROME_EXE_PATH 指定路径。候选路径：${candidates.join(", ")}`
  );
}

export function resolveChromeWorkingDirectory(exePath: string): string {
  return path.win32.dirname(exePath);
}

export function buildChromeStartCommand(exePath: string, workingDirectory: string): string {
  const args = [
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${BROWSER_CDP_PORT}`,
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
  appendTaskLog(task, `步骤 ${step}/${totalSteps}：探测 CDP 并生成 remote cdpUrl`);
  appendTaskLog(task, `执行命令：GET ${BROWSER_CDP_VERSION_URL}`);
  const version = await waitForCdpVersion(task);
  const nameserver = await readWslNameserver(task, step, totalSteps);
  const remoteCdpUrl = buildRemoteCdpUrl(version.webSocketDebuggerUrl, nameserver);

  appendTaskLog(task, `remote cdpUrl：${remoteCdpUrl}`);
  return {
    remoteCdpUrl,
    localWebSocketDebuggerUrl: version.webSocketDebuggerUrl,
    nameserver,
  };
}

export function startBrowserRestartTask(): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("browser-cdp-restart");
  if (runningTask) {
    appendTaskLog(runningTask, "检测到已有浏览器重启任务正在执行，已复用当前任务。");
    return { task: runningTask, reused: true };
  }

  const totalSteps = 5;
  const task = createTask("browser-cdp-restart", "重启浏览器（开启 CDP 与端口转发）", totalSteps);
  task.status = "running";

  (async () => {
    try {
      if (!IS_WINDOWS) {
        throw new Error("当前系统不是 Windows，无法执行浏览器 CDP 重启。");
      }

      const chromeExePath = resolveChromeExePath();
      if (!existsSync(chromeExePath)) {
        throw new Error(`chrome.exe 不存在：${chromeExePath}`);
      }
      const chromeWorkingDirectory = resolveChromeWorkingDirectory(chromeExePath);

      await runProcessStep(task, {
        step: 1,
        totalSteps,
        name: "停止 chrome.exe 进程",
        command: "taskkill /F /IM chrome.exe /T",
        args: ["taskkill", "/F", "/IM", "chrome.exe", "/T"],
        allowExitCodes: [128],
      });

      await runProcessStep(task, {
        step: 2,
        totalSteps,
        name: `启动 Chrome（CDP:9222，打开 ${BROWSER_BOOT_URL}）`,
        command: `powershell.exe ... ${buildChromeStartCommand(chromeExePath, chromeWorkingDirectory)}`,
        args: buildChromeStartArgs(chromeExePath, chromeWorkingDirectory),
      });

      await runProcessStep(task, {
        step: 3,
        totalSteps,
        name: "删除旧端口转发（9223）",
        command: "netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=9223",
        args: [
          "netsh",
          "interface",
          "portproxy",
          "delete",
          "v4tov4",
          "listenaddress=0.0.0.0",
          `listenport=${BROWSER_CDP_PROXY_PORT}`,
        ],
        allowFailureResult: isPortProxyDeleteNotFoundResult,
        allowElevation: true,
      });

      await runProcessStep(task, {
        step: 4,
        totalSteps,
        name: "创建端口转发（9223 -> 127.0.0.1:9222）",
        command: "netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=9223 connectaddress=127.0.0.1 connectport=9222",
        args: [
          "netsh",
          "interface",
          "portproxy",
          "add",
          "v4tov4",
          "listenaddress=0.0.0.0",
          `listenport=${BROWSER_CDP_PROXY_PORT}`,
          "connectaddress=127.0.0.1",
          `connectport=${BROWSER_CDP_PORT}`,
        ],
        allowElevation: true,
      });

      task.step = 5;
      appendTaskLog(task, `步骤 5/${totalSteps}：校验 CDP 端口就绪`);
      appendTaskLog(task, `执行命令：GET ${BROWSER_CDP_VERSION_URL}`);
      await waitForCdpVersion(task);

      task.status = "success";
      task.endedAt = new Date().toISOString();
      appendTaskLog(task, "任务完成");
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
    appendTaskLog(runningTask, "检测到已有浏览器配置重置任务正在执行，已复用当前任务。");
    return { task: runningTask, reused: true };
  }

  const totalSteps = 4;
  const task = createTask("browser-cdp-reset-config", "重置 browser 配置为 Remote CDP", totalSteps);
  task.status = "running";

  (async () => {
    try {
      if (!IS_WINDOWS) {
        throw new Error("当前系统不是 Windows，无法执行 browser 配置重置。");
      }

      const prepared = await prepareRemoteCdp(task, 1, totalSteps);

      await runProcessStep(task, {
        step: 2,
        totalSteps,
        name: "删除旧端口转发（9223）",
        command: "netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=9223",
        args: [
          "netsh",
          "interface",
          "portproxy",
          "delete",
          "v4tov4",
          "listenaddress=0.0.0.0",
          `listenport=${BROWSER_CDP_PROXY_PORT}`,
        ],
        allowFailureResult: isPortProxyDeleteNotFoundResult,
        allowElevation: true,
      });

      await runProcessStep(task, {
        step: 3,
        totalSteps,
        name: "创建端口转发（9223 -> 127.0.0.1:9222）",
        command: "netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=9223 connectaddress=127.0.0.1 connectport=9222",
        args: [
          "netsh",
          "interface",
          "portproxy",
          "add",
          "v4tov4",
          "listenaddress=0.0.0.0",
          `listenport=${BROWSER_CDP_PROXY_PORT}`,
          "connectaddress=127.0.0.1",
          `connectport=${BROWSER_CDP_PORT}`,
        ],
        allowElevation: true,
      });

      appendTaskLog(task, `当前 nameserver：${prepared.nameserver}`);
      appendTaskLog(task, `本机 CDP：${prepared.localWebSocketDebuggerUrl}`);

      task.step = 4;
      appendTaskLog(task, `步骤 4/${totalSteps}：写入 openclaw browser 配置`);
      appendTaskLog(task, "执行命令：openclaw gateway call config.apply (browser)");
      await resetOpenclawBrowserConfig(task, prepared.remoteCdpUrl);

      task.status = "success";
      task.endedAt = new Date().toISOString();
      appendTaskLog(task, "任务完成");
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
