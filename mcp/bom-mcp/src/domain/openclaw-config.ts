import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import JSON5 from "json5";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

export function resolveOpenclawConfigPath(): string {
  const configured = process.env.BOM_MCP_OPENCLAW_CONFIG_PATH?.trim();
  return configured || join(homedir(), ".openclaw", "openclaw.json");
}

export async function readOpenclawConfig(): Promise<JsonObject | null> {
  try {
    const raw = await readFile(resolveOpenclawConfigPath(), "utf-8");
    return asObject(JSON5.parse(raw));
  } catch {
    return null;
  }
}

export function readOpenclawConfigSync(): JsonObject | null {
  try {
    const raw = readFileSync(resolveOpenclawConfigPath(), "utf-8");
    return asObject(JSON5.parse(raw));
  } catch {
    return null;
  }
}

export function getOpenclawBomQuoteSkillEntrySync(): JsonObject | null {
  const config = readOpenclawConfigSync();
  const skills = asObject(config?.skills);
  const entries = asObject(skills?.entries);
  return asObject(entries?.["bom-quote"]);
}

export function getOpenclawBomQuoteSkillEnvValueSync(key: string): string | undefined {
  const skillEntry = getOpenclawBomQuoteSkillEntrySync();
  const env = asObject(skillEntry?.env);
  const value = typeof env?.[key] === "string" ? env[key].trim() : "";
  return value || undefined;
}

export function getOpenclawBomQuoteSkillConfigSync(): JsonObject | null {
  return asObject(getOpenclawBomQuoteSkillEntrySync()?.config);
}
