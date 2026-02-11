import { asObject, readNonEmptyString } from "../lib/value";
import { readLocalClawosConfig } from "../config/local";

const IS_WINDOWS = process.platform === "win32";
let cachedAutoDetectedWslDistro: string | null | undefined;

export type CommandResult = {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  command: string;
};

export function buildWslProcessArgs(
  script: string,
  options: { isWindows: boolean; distro?: string; wslBin?: string }
): string[] {
  if (!options.isWindows) {
    return ["bash", "-lc", script];
  }

  const wslBin = options.wslBin?.trim() || "wsl.exe";
  const distro = options.distro?.trim();
  return [wslBin, ...(distro ? ["-d", distro] : []), "--", "bash", "-lic", script];
}

export function parseWslDistroList(stdout: string): string[] {
  return stdout
    .split(/\r?\n/g)
    .map((line) => line.replace(/\u0000/g, "").trim())
    .filter((line) => line.length > 0);
}

export function selectPreferredWslDistro(distros: string[]): string | undefined {
  if (distros.length === 0) {
    return undefined;
  }

  const exactUbuntu = distros.find((item) => item.toLowerCase() === "ubuntu");
  if (exactUbuntu) {
    return exactUbuntu;
  }

  const ubuntuFamily = distros.find((item) => item.toLowerCase().startsWith("ubuntu"));
  if (ubuntuFamily) {
    return ubuntuFamily;
  }

  if (distros.length === 1) {
    return distros[0];
  }

  return undefined;
}

async function autoDetectWslDistro(wslBin: string): Promise<string | undefined> {
  if (cachedAutoDetectedWslDistro !== undefined) {
    return cachedAutoDetectedWslDistro || undefined;
  }

  try {
    const result = await runProcess([wslBin, "-l", "-q"]);
    if (!result.ok) {
      cachedAutoDetectedWslDistro = null;
      return undefined;
    }

    const distros = parseWslDistroList(result.stdout);
    const selected = selectPreferredWslDistro(distros);
    cachedAutoDetectedWslDistro = selected || null;
    return selected;
  } catch {
    cachedAutoDetectedWslDistro = null;
    return undefined;
  }
}

export async function runProcess(args: string[]): Promise<CommandResult> {
  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return {
    ok: code === 0,
    code,
    stdout,
    stderr,
    command: args.join(" "),
  };
}

export async function runWslScript(script: string): Promise<CommandResult> {
  const localConfig = readLocalClawosConfig();
  const wslConfig = asObject(localConfig?.wsl);

  const configuredDistro =
    process.env.CLAWOS_WSL_DISTRO?.trim() || readNonEmptyString(wslConfig?.distro);
  const wslBin =
    process.env.CLAWOS_WSL_BIN?.trim() || readNonEmptyString(wslConfig?.wslBin) || "wsl.exe";
  const distro = configuredDistro || (IS_WINDOWS ? await autoDetectWslDistro(wslBin) : undefined);

  const args = buildWslProcessArgs(script, {
    isWindows: IS_WINDOWS,
    distro,
    wslBin,
  });

  try {
    return await runProcess(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      code: -1,
      stdout: "",
      stderr: message,
      command: args.join(" "),
    };
  }
}

export function normalizeOutput(text: string): string[] {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

export function troubleshootingTips(stderr: string): string[] {
  const text = stderr.toLowerCase();
  const tips: string[] = [];

  if (text.includes("0x8007019e") || (text.includes("wsl") && text.includes("not"))) {
    tips.push("检测到 WSL 异常：请在 Windows 功能中启用 WSL 并重启系统。");
  }
  if (text.includes("permission denied")) {
    tips.push("检测到权限不足：请使用管理员权限启动 ClawOS，或检查 WSL 内文件权限。");
  }
  if (text.includes("command not found")) {
    tips.push("检测到命令不存在：请确认 openclaw、pnpm、nrm 已在 WSL 内安装并可执行。");
    tips.push("若命令仅在 shell 初始化脚本中加载，请确保通过 `wsl -d <distro> -- bash -lic \"<command>\"` 执行。");
    tips.push("若手工 `wsl -d Ubuntu` 可用但 ClawOS 不可用，请在 clawos.json 中设置 wsl.distro 为 Ubuntu。");
  }

  return tips;
}
