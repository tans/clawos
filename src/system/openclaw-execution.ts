import {
  readLocalClawosConfig,
  updateLocalOpenclawExecutionEnvironment,
  type LocalOpenclawExecutionEnvironment,
} from "../config/local";
import { asObject, readNonEmptyString } from "../lib/value";
import { runProcess } from "../tasks/shell";

const IS_WINDOWS = process.platform === "win32";

function resolveWslBin(): string {
  const localConfig = readLocalClawosConfig();
  const wslConfig = asObject(localConfig?.wsl);
  return process.env.CLAWOS_WSL_BIN?.trim() || readNonEmptyString(wslConfig?.wslBin) || "wsl.exe";
}

function looksLikeWslMissing(stderr: string): boolean {
  const text = stderr.toLowerCase();
  return (
    text.includes("not recognized as an internal or external command") ||
    text.includes("is not recognized") ||
    text.includes("not found") ||
    text.includes("no such file or directory") ||
    text.includes("0x8007019e") ||
    text.includes("wsl is not installed")
  );
}

export async function detectAndPersistOpenclawExecutionEnvironment(): Promise<LocalOpenclawExecutionEnvironment> {
  if (!IS_WINDOWS) {
    return updateLocalOpenclawExecutionEnvironment({
      available: false,
      execMode: "direct",
      checkedAt: new Date().toISOString(),
    });
  }

  const wslBin = resolveWslBin();
  const probe = await runProcess([wslBin, "-l", "-q"]);
  const hasWsl = probe.ok || !looksLikeWslMissing(probe.stderr);

  return updateLocalOpenclawExecutionEnvironment({
    available: hasWsl,
    execMode: hasWsl ? "wsl" : "direct",
    checkedAt: new Date().toISOString(),
  });
}
