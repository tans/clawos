import { runProcess } from "../tasks/shell";

const IS_WINDOWS = process.platform === "win32";
const WINDOWS_RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const CLAWOS_RUN_VALUE_NAME = "ClawOS";

export type ClawosAutoStartState = {
  supported: boolean;
  enabled: boolean;
  valueName: string;
  desiredCommand: string | null;
  actualCommand: string | null;
};

function quoteWindowsExecutablePath(path: string): string {
  const normalized = path.trim().replace(/^"+|"+$/g, "");
  return `"${normalized}"`;
}

function resolveClawosStartupCommand(): string {
  const override = process.env.CLAWOS_STARTUP_COMMAND?.trim();
  if (override) {
    return override;
  }
  return quoteWindowsExecutablePath(process.execPath);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseRegQueryValue(raw: string, valueName: string): string | null {
  const matcher = new RegExp(`^${escapeRegExp(valueName)}\\s+REG_\\w+\\s+(.+)$`, "i");
  const lines = raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(matcher);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function buildUnsupportedState(): ClawosAutoStartState {
  return {
    supported: false,
    enabled: false,
    valueName: CLAWOS_RUN_VALUE_NAME,
    desiredCommand: null,
    actualCommand: null,
  };
}

export async function getClawosAutoStartState(): Promise<ClawosAutoStartState> {
  if (!IS_WINDOWS) {
    return buildUnsupportedState();
  }

  const desiredCommand = resolveClawosStartupCommand();
  const query = await runProcess(["reg", "query", WINDOWS_RUN_KEY, "/v", CLAWOS_RUN_VALUE_NAME]);
  const actualCommand = query.ok ? parseRegQueryValue(query.stdout, CLAWOS_RUN_VALUE_NAME) : null;

  return {
    supported: true,
    enabled: Boolean(actualCommand),
    valueName: CLAWOS_RUN_VALUE_NAME,
    desiredCommand,
    actualCommand,
  };
}

export async function setClawosAutoStartEnabled(enabled: boolean): Promise<ClawosAutoStartState> {
  if (!IS_WINDOWS) {
    throw new Error("当前系统不是 Windows，无法配置开机启动。");
  }

  if (enabled) {
    const command = resolveClawosStartupCommand();
    const result = await runProcess([
      "reg",
      "add",
      WINDOWS_RUN_KEY,
      "/v",
      CLAWOS_RUN_VALUE_NAME,
      "/t",
      "REG_SZ",
      "/d",
      command,
      "/f",
    ]);

    if (!result.ok) {
      const detail = (result.stderr || result.stdout || "").trim();
      throw new Error(detail || `写入开机启动项失败（退出码 ${result.code}）。`);
    }
  } else {
    const result = await runProcess(["reg", "delete", WINDOWS_RUN_KEY, "/v", CLAWOS_RUN_VALUE_NAME, "/f"]);
    if (!result.ok) {
      const merged = `${result.stdout}\n${result.stderr}`.toLowerCase();
      const notFound =
        merged.includes("unable to find") ||
        merged.includes("was unable to find") ||
        merged.includes("找不到指定的注册表项") ||
        merged.includes("系统找不到指定");

      if (!notFound) {
        const detail = (result.stderr || result.stdout || "").trim();
        throw new Error(detail || `删除开机启动项失败（退出码 ${result.code}）。`);
      }
    }
  }

  return await getClawosAutoStartState();
}
