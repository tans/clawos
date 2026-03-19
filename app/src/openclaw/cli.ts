import { readLocalOpenclawExecutionEnvironment } from "../config/local";
import { runProcess, runWslScript, type CommandResult, type WslShellMode } from "../tasks/shell";

const IS_WINDOWS = process.platform === "win32";

export type OpenclawCliExecutionMode = "wsl" | "direct";

export type OpenclawCliResult = CommandResult & {
  mode: OpenclawCliExecutionMode;
};

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function buildOpenclawCommand(args: string[]): string {
  return ["openclaw", ...args.map((arg) => shellQuote(String(arg)))].join(" ");
}

function withJsonFlag(args: string[]): string[] {
  if (args.includes("--json")) {
    return [...args];
  }
  return [...args, "--json"];
}

function extractExecModeFromEnv(): OpenclawCliExecutionMode | null {
  const raw = (process.env.CLAWOS_OPENCLAW_EXEC_MODE || "").trim().toLowerCase();
  if (raw === "wsl" || raw === "direct") {
    return raw;
  }
  return null;
}

function resolveOpenclawBinaryForDirectMode(): string {
  const fromEnv = process.env.CLAWOS_OPENCLAW_BIN?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return "openclaw";
}

export function resolveOpenclawCliMode(): OpenclawCliExecutionMode {
  const fromEnv = extractExecModeFromEnv();
  if (fromEnv) {
    return fromEnv;
  }
  if (!IS_WINDOWS) {
    return "direct";
  }

  const runtime = readLocalOpenclawExecutionEnvironment();
  if (runtime.execMode === "direct") {
    return "direct";
  }
  return runtime.available ? "wsl" : "direct";
}

function isCommandMissingText(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("command not found") ||
    normalized.includes("not recognized as an internal or external command") ||
    normalized.includes("no such file or directory") ||
    normalized.includes("executable file not found")
  );
}

function shouldFallbackMode(result: CommandResult): boolean {
  return result.code === -1 || isCommandMissingText(`${result.stderr}\n${result.stdout}`);
}

async function runOpenclawCliInMode(
  mode: OpenclawCliExecutionMode,
  args: string[],
  options: { cwd?: string; loginShell?: boolean; shellMode?: WslShellMode } = {}
): Promise<OpenclawCliResult> {
  if (mode === "direct") {
    const binary = resolveOpenclawBinaryForDirectMode();
    if (IS_WINDOWS && /\.(cmd|bat)$/i.test(binary)) {
      const directViaCmd = await runProcess(["cmd.exe", "/d", "/c", binary, ...args.map((arg) => String(arg))]);
      return { ...directViaCmd, mode };
    }
    const direct = await runProcess([binary, ...args]);
    return { ...direct, mode };
  }

  const command = buildOpenclawCommand(args);
  const scriptLines = ["set -euo pipefail"];
  if (typeof options.cwd === "string" && options.cwd.trim().length > 0) {
    scriptLines.push(`cd ${shellQuote(options.cwd.trim())}`);
  }
  scriptLines.push(command);

  const wsl = await runWslScript(scriptLines.join("\n"), {
    loginShell: options.loginShell,
    shellMode: options.shellMode,
  });
  return { ...wsl, mode };
}

export async function runOpenclawCli(
  args: string[],
  options: { cwd?: string; loginShell?: boolean; shellMode?: WslShellMode } = {}
): Promise<OpenclawCliResult> {
  const forcedMode = extractExecModeFromEnv();
  const preferredMode = forcedMode || resolveOpenclawCliMode();
  const first = await runOpenclawCliInMode(preferredMode, args, options);
  if (first.ok || !IS_WINDOWS || forcedMode || !shouldFallbackMode(first)) {
    return first;
  }

  const fallbackMode: OpenclawCliExecutionMode = preferredMode === "wsl" ? "direct" : "wsl";
  return await runOpenclawCliInMode(fallbackMode, args, options);
}

function parseJsonText(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const lines = trimmed
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (let start = 0; start < lines.length; start += 1) {
    const candidate = lines.slice(start).join("\n");
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    } catch {
      // continue
    }
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
    } catch {
      // continue
    }
  }

  return null;
}

export async function runOpenclawCliJson<T = unknown>(
  args: string[],
  options: { cwd?: string; loginShell?: boolean; shellMode?: WslShellMode } = {}
): Promise<{ result: OpenclawCliResult; data: T }> {
  const result = await runOpenclawCli(withJsonFlag(args), options);
  if (!result.ok) {
    const detail = result.stderr.trim() || result.stdout.trim() || `退出码 ${result.code}`;
    throw new Error(`openclaw CLI 执行失败（${result.mode}）：${detail}`);
  }

  const parsed = parseJsonText(result.stdout);
  if (parsed === null) {
    throw new Error(
      `openclaw CLI 输出不是 JSON（${result.mode}）：${result.stdout.trim() || "<empty>"}`
    );
  }

  return {
    result,
    data: parsed as T,
  };
}

export function openclawCliTroubleshootingTips(rawMessage: string): string[] {
  const text = rawMessage.toLowerCase();
  const tips: string[] = [];

  if (text.includes("wsl") && (text.includes("not found") || text.includes("0x8007019e"))) {
    tips.push("WSL 不可用：请先在 Windows 功能中启用 WSL，并安装 Ubuntu 发行版。");
  }
  if (text.includes("openclaw") && text.includes("not found")) {
    tips.push("未找到 openclaw 命令：请确认 openclaw 已安装，或在 clawos.json 中切换执行模式。");
  }
  if (text.includes("permission denied")) {
    tips.push("权限不足：请使用管理员权限运行，或检查 WSL/本地目录权限。");
  }
  if (text.includes("not paired") || text.includes("pair")) {
    tips.push("网关尚未配对：请先在 openclaw 控制台完成设备配对。");
  }

  return tips;
}
