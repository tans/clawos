import JSON5 from "json5";
import { asObject } from "../lib/value";
import { runWslScript } from "../tasks/shell";
import { resolveOpenclawConfigPath } from "./local";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

function parseOpenclawConfigText(text: string): Record<string, unknown> {
  const normalized = text.trim() || "{}";

  const tryParse = (raw: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON5.parse(raw);
      const object = asObject(parsed);
      return object || null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(normalized);
  if (direct) {
    return direct;
  }

  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = normalized.slice(firstBrace, lastBrace + 1);
    const recovered = tryParse(sliced);
    if (recovered) {
      return recovered;
    }
  }

  throw new Error("openclaw 配置解析失败：输出包含非 JSON 内容。");
}

export async function readOpenclawConfigFromWsl(): Promise<Record<string, unknown>> {
  const openclawConfigPath = resolveOpenclawConfigPath();
  const script = `set -euo pipefail
if [ -f ${shellQuote(openclawConfigPath)} ]; then
  cat ${shellQuote(openclawConfigPath)}
else
  printf '{}'\\n
fi`;

  const result = await runWslScript(script, { shellMode: "clean" });
  if (!result.ok) {
    throw new Error(`读取 openclaw 配置失败：${result.stderr || `退出码 ${result.code}`}`);
  }

  try {
    return parseOpenclawConfigText(result.stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message);
  }
}

export async function tryReadOpenclawConfigFromWsl(): Promise<Record<string, unknown> | null> {
  try {
    return await readOpenclawConfigFromWsl();
  } catch {
    return null;
  }
}

function buildBackupTimestamp(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}

export type WriteOpenclawConfigFromWslResult = {
  targetPath: string;
  backupPath: string | null;
};

export async function writeOpenclawConfigToWsl(
  config: Record<string, unknown>
): Promise<WriteOpenclawConfigFromWslResult> {
  const openclawConfigPath = resolveOpenclawConfigPath();
  const raw = `${JSON.stringify(config, null, 2)}\n`;
  const encoded = Buffer.from(raw, "utf-8").toString("base64");
  const backupSuffix = buildBackupTimestamp();

  const script = [
    "set -euo pipefail",
    `target_path=${shellQuote(openclawConfigPath)}`,
    `backup_suffix=${shellQuote(backupSuffix)}`,
    `payload_b64=${shellQuote(encoded)}`,
    'target_dir="$(dirname "$target_path")"',
    'mkdir -p "$target_dir"',
    'backup_path=""',
    'if [ -f "$target_path" ]; then',
    '  backup_path="$target_path.$backup_suffix.bak"',
    '  cp "$target_path" "$backup_path"',
    "fi",
    'tmp_path="$target_path.clawos-tmp.$$"',
    'printf "%s" "$payload_b64" | base64 -d > "$tmp_path"',
    'mv "$tmp_path" "$target_path"',
    'printf "__CLAWOS_TARGET__=%s\\n" "$target_path"',
    'printf "__CLAWOS_BACKUP__=%s\\n" "$backup_path"',
  ].join("\n");

  const result = await runWslScript(script, { shellMode: "clean" });
  if (!result.ok) {
    throw new Error(`写入 openclaw 配置失败：${result.stderr || `退出码 ${result.code}`}`);
  }

  let targetPath = openclawConfigPath;
  let backupPath: string | null = null;
  const lines = result.stdout.split(/\r?\n/g).map((line) => line.trim());
  for (const line of lines) {
    if (line.startsWith("__CLAWOS_TARGET__=")) {
      const value = line.slice("__CLAWOS_TARGET__=".length).trim();
      if (value) {
        targetPath = value;
      }
      continue;
    }
    if (line.startsWith("__CLAWOS_BACKUP__=")) {
      const value = line.slice("__CLAWOS_BACKUP__=".length).trim();
      backupPath = value || null;
    }
  }

  return { targetPath, backupPath };
}
