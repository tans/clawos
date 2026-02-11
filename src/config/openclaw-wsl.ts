import JSON5 from "json5";
import { asObject } from "../lib/value";
import { runWslScript } from "../tasks/shell";
import { resolveOpenclawConfigPath } from "./local";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

export async function readOpenclawConfigFromWsl(): Promise<Record<string, unknown>> {
  const openclawConfigPath = resolveOpenclawConfigPath();
  const script = `set -euo pipefail
if [ -f ${shellQuote(openclawConfigPath)} ]; then
  cat ${shellQuote(openclawConfigPath)}
else
  printf '{}'\\n
fi`;

  const result = await runWslScript(script);
  if (!result.ok) {
    throw new Error(`读取 openclaw 配置失败：${result.stderr || `退出码 ${result.code}`}`);
  }

  const text = result.stdout.trim() || "{}";

  let parsed: unknown;
  try {
    parsed = JSON5.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`openclaw 配置解析失败：${message}`);
  }

  const object = asObject(parsed);
  if (!object) {
    throw new Error("openclaw 配置格式无效，必须是对象。");
  }

  return object;
}

export async function tryReadOpenclawConfigFromWsl(): Promise<Record<string, unknown> | null> {
  try {
    return await readOpenclawConfigFromWsl();
  } catch {
    return null;
  }
}
