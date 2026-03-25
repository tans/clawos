import { asObject, readNonEmptyString } from "../lib/value";
import { readLocalClawosConfig } from "../config/local";
import { buildKillProcessArgs, buildUnixBashArgs, buildWindowsWslArgs, isWindowsPlatform } from "../system/platform-adapter";

const IS_WINDOWS = isWindowsPlatform();
let cachedAutoDetectedWslDistro: string | null | undefined;

function isTruthyEnv(value: string | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

export type CommandResult = {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  command: string;
};
type RunProcessOptions = {
  stdinText?: string;
  timeoutMs?: number;
};

export type WslShellMode = "login" | "interactive" | "non-login" | "clean";

function decodeWithEncoding(bytes: Uint8Array, encoding: string, fatal = false): string | null {
  try {
    const decoder = new TextDecoder(encoding, fatal ? { fatal: true } : undefined);
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

function isLikelyUtf16LE(bytes: Uint8Array): boolean {
  if (bytes.length < 4) {
    return false;
  }

  const pairs = Math.floor(bytes.length / 2);
  let evenZeroCount = 0;
  let oddZeroCount = 0;

  for (let i = 0; i < pairs; i += 1) {
    const even = bytes[i * 2];
    const odd = bytes[i * 2 + 1];
    if (even === 0) {
      evenZeroCount += 1;
    }
    if (odd === 0) {
      oddZeroCount += 1;
    }
  }

  const evenZeroRatio = evenZeroCount / pairs;
  const oddZeroRatio = oddZeroCount / pairs;
  return oddZeroRatio > 0.35 && evenZeroRatio < 0.1;
}

export function decodeProcessOutput(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return "";
  }

  // BOM detection
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    const text = decodeWithEncoding(bytes, "utf-16le");
    if (text !== null) {
      return text;
    }
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const text = decodeWithEncoding(bytes, "utf-16be");
    if (text !== null) {
      return text;
    }
  }

  // Some Windows CLI outputs are UTF-16LE without BOM.
  if (isLikelyUtf16LE(bytes)) {
    const text = decodeWithEncoding(bytes, "utf-16le");
    if (text !== null) {
      return text;
    }
  }

  const strictUtf8 = decodeWithEncoding(bytes, "utf-8", true);
  if (strictUtf8 !== null) {
    return strictUtf8;
  }

  if (IS_WINDOWS) {
    const windowsEncodings = ["gb18030", "gbk", "gb2312"];
    for (const encoding of windowsEncodings) {
      const decoded = decodeWithEncoding(bytes, encoding);
      if (decoded !== null) {
        return decoded;
      }
    }
  }

  // Last resort: replacement-character UTF-8 decode.
  const fallback = decodeWithEncoding(bytes, "utf-8");
  if (fallback !== null) {
    return fallback;
  }

  return String.fromCharCode(...bytes);
}

function formatProcessCommand(args: string[]): string {
  return args
    .map((arg) => {
      if (arg.length === 0) {
        return '""';
      }
      if (/[\s"'\\]/.test(arg)) {
        return JSON.stringify(arg);
      }
      return arg;
    })
    .join(" ");
}

export function buildWslProcessArgs(
  script: string,
  options: {
    isWindows: boolean;
    distro?: string;
    wslBin?: string;
    loginShell?: boolean;
    shellMode?: WslShellMode;
    preferStdin?: boolean;
  }
): string[] {
  const shellMode = options.shellMode || (options.loginShell === false ? "non-login" : "login");
  const preferStdin = options.preferStdin === true;

  if (!options.isWindows) {
    return buildUnixBashArgs(script, shellMode);
  }

  return buildWindowsWslArgs({
    script,
    shellMode,
    preferStdin,
    distro: options.distro,
    wslBin: options.wslBin,
  });
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

export async function runProcess(args: string[], options: RunProcessOptions = {}): Promise<CommandResult> {
  const spawnOptions: Bun.SpawnOptions.OptionsObject<string> = {
    stdout: "pipe",
    stderr: "pipe",
  };
  if (typeof options.stdinText === "string") {
    spawnOptions.stdin = new TextEncoder().encode(options.stdinText);
  }

  const proc = Bun.spawn(args, spawnOptions);
  let timedOut = false;

  const waitForExit = async (): Promise<number> => {
    const timeoutMs = options.timeoutMs;
    if (!(typeof timeoutMs === "number" && timeoutMs > 0)) {
      return await proc.exited;
    }

    const exitOrTimeout = await Promise.race<number | "timeout">([
      proc.exited,
      Bun.sleep(timeoutMs).then(() => "timeout" as const),
    ]);
    if (exitOrTimeout !== "timeout") {
      return exitOrTimeout;
    }

    timedOut = true;
    try {
      if (IS_WINDOWS && typeof proc.pid === "number" && proc.pid > 0) {
        Bun.spawnSync({
          cmd: buildKillProcessArgs(proc.pid),
          stdin: "ignore",
          stdout: "ignore",
          stderr: "ignore",
        });
      } else {
        proc.kill();
      }
    } catch {
      // Ignore kill failures and wait for the process to settle.
    }

    return await proc.exited;
  };

  const [stdoutBuffer, stderrBuffer, code] = await Promise.all([
    new Response(proc.stdout).arrayBuffer(),
    new Response(proc.stderr).arrayBuffer(),
    waitForExit(),
  ]);
  const stdout = decodeProcessOutput(new Uint8Array(stdoutBuffer));
  const stderrText = decodeProcessOutput(new Uint8Array(stderrBuffer));
  const stderr =
    timedOut && typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? `${stderrText}${stderrText ? "\n" : ""}Process timed out after ${options.timeoutMs}ms`
      : stderrText;

  return {
    ok: !timedOut && code === 0,
    code: timedOut ? -1 : code,
    stdout,
    stderr,
    command: formatProcessCommand(args),
  };
}

export async function runWslScript(
  script: string,
  options: { loginShell?: boolean; shellMode?: WslShellMode } = {}
): Promise<CommandResult> {
  const localConfig = readLocalClawosConfig();
  const wslConfig = asObject(localConfig?.wsl);

  const configuredDistro =
    process.env.CLAWOS_WSL_DISTRO?.trim() || readNonEmptyString(wslConfig?.distro);
  const wslBin =
    process.env.CLAWOS_WSL_BIN?.trim() || readNonEmptyString(wslConfig?.wslBin) || "wsl.exe";
  const distro = configuredDistro || (IS_WINDOWS ? await autoDetectWslDistro(wslBin) : undefined);

  const useStdinScript = IS_WINDOWS;
  const args = buildWslProcessArgs(script, {
    isWindows: IS_WINDOWS,
    distro,
    wslBin,
    loginShell: options.loginShell,
    shellMode: options.shellMode,
    preferStdin: useStdinScript,
  });
  const commandText = formatProcessCommand(args);
  if (
    isTruthyEnv(process.env.CLAWOS_DESKTOP_DEV) ||
    isTruthyEnv(process.env.CLAWOS_DEBUG_WSL_CMD) ||
    isTruthyEnv(process.env.CLAWOS_DEBUG_PROCESS_CMD)
  ) {
    console.log(`[wsl-debug] ${commandText}`);
  }

  try {
    return await runProcess(args, {
      stdinText: useStdinScript ? script : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      code: -1,
      stdout: "",
      stderr: message,
      command: commandText,
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
