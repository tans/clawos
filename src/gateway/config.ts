import { HttpError } from "../lib/http";
import { asObject, readNonEmptyString } from "../lib/value";
import { callGatewayMethod } from "./sock";
import type { GatewayConfigSnapshot } from "./schema";
import JSON5 from "json5";
import {
  readOpenclawConfigFromWsl,
  writeOpenclawConfigToWsl,
  type WriteOpenclawConfigFromWslResult,
} from "../config/openclaw-wsl";

export const ALLOWED_CONFIG_SECTIONS = new Set(["channels", "agents", "skills", "browser", "gateway", "models"]);
const FILE_BACKED_CONFIG_SECTIONS = new Set(["agents", "models"]);
const REDACTED_SENTINEL = "__OPENCLAW_REDACTED__";

export function configTemplate(): Record<string, unknown> {
  return {
    channels: {},
    agents: {},
    skills: {},
    browser: {},
    gateway: {},
  };
}

function normalizeConfigSnapshot(snapshot: GatewayConfigSnapshot): Record<string, unknown> {
  const config = asObject(snapshot.config);
  return {
    ...configTemplate(),
    ...(config || {}),
  };
}

function parseConfigRaw(raw: string): Record<string, unknown> | null {
  const text = raw.trim();
  if (!text) {
    return {};
  }
  try {
    const parsed = JSON5.parse(text);
    return asObject(parsed) || null;
  } catch {
    return null;
  }
}

function normalizeWritableConfigSnapshot(snapshot: GatewayConfigSnapshot): Record<string, unknown> {
  const raw = typeof snapshot.raw === "string" ? snapshot.raw : "";
  const parsedRaw = raw ? parseConfigRaw(raw) : null;
  const config = parsedRaw || asObject(snapshot.config);
  return {
    ...configTemplate(),
    ...(config || {}),
  };
}

function restoreRedactedValues(previous: unknown, next: unknown): unknown {
  if (typeof next === "string" && next.trim() === REDACTED_SENTINEL) {
    return previous;
  }

  if (Array.isArray(next)) {
    const prevArray = Array.isArray(previous) ? previous : [];
    return next.map((item, index) => restoreRedactedValues(prevArray[index], item));
  }

  const nextObject = asObject(next);
  if (nextObject) {
    const prevObject = asObject(previous) || {};
    const merged: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(nextObject)) {
      const resolved = restoreRedactedValues(prevObject[key], value);
      if (resolved !== undefined) {
        merged[key] = resolved;
      }
    }
    return merged;
  }

  return next;
}

function resolveConfigSnapshotHash(snapshot: GatewayConfigSnapshot): string {
  const hash = readNonEmptyString(snapshot.hash);
  if (!hash) {
    throw new HttpError(500, "Gateway 未返回 config hash，无法安全保存配置。");
  }
  return hash;
}

export async function readGatewayConfigSnapshot(): Promise<GatewayConfigSnapshot> {
  const result = await callGatewayMethod<GatewayConfigSnapshot>("config.get", {}, { timeoutMs: 10000 });
  const snapshot = asObject(result.payload);
  if (!snapshot) {
    throw new HttpError(500, "config.get 返回格式无效。");
  }
  return snapshot as GatewayConfigSnapshot;
}

export async function readOpenclawConfig(): Promise<Record<string, unknown>> {
  const snapshot = await readGatewayConfigSnapshot();
  return normalizeConfigSnapshot(snapshot);
}

export async function applyOpenclawConfig(config: Record<string, unknown>, note: string): Promise<void> {
  const raw = `${JSON.stringify(config, null, 2)}\n`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const snapshot = await readGatewayConfigSnapshot();
    const baseHash = resolveConfigSnapshotHash(snapshot);

    try {
      await callGatewayMethod("config.apply", {
        raw,
        baseHash,
        note,
        restartDelayMs: 0,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldRetry =
        attempt === 0 &&
        (message.includes("base hash") ||
          message.includes("changed since last load") ||
          message.includes("re-run config.get"));
      if (shouldRetry) {
        continue;
      }
      throw new HttpError(500, `写入 openclaw 配置失败：${message}`);
    }
  }

  throw new HttpError(500, "写入 openclaw 配置失败：配置冲突，请重试。");
}

export function shouldUseFileBackedSection(section: string): boolean {
  return FILE_BACKED_CONFIG_SECTIONS.has(section);
}

export async function readOpenclawConfigForSection(section: string): Promise<Record<string, unknown>> {
  if (shouldUseFileBackedSection(section)) {
    return await readOpenclawConfigFromWsl();
  }
  return await readOpenclawConfig();
}

export async function saveOpenclawConfigSection(
  section: string,
  data: Record<string, unknown>
): Promise<{ mode: "file-overwrite" | "gateway-apply"; fileWrite?: WriteOpenclawConfigFromWslResult }> {
  if (shouldUseFileBackedSection(section)) {
    const config = await readOpenclawConfigFromWsl();
    config[section] = data;
    const fileWrite = await writeOpenclawConfigToWsl(config);
    return {
      mode: "file-overwrite",
      fileWrite,
    };
  }

  const snapshot = await readGatewayConfigSnapshot();
  const config = normalizeWritableConfigSnapshot(snapshot);
  const currentSection = asObject(config[section]) || {};
  config[section] = (restoreRedactedValues(currentSection, data) as Record<string, unknown>) || {};
  await applyOpenclawConfig(config, `ClawOS 保存 ${section} 配置`);
  return { mode: "gateway-apply" };
}
