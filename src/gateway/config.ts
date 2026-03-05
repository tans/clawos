import { HttpError } from "../lib/http";
import { asObject, readNonEmptyString } from "../lib/value";
import { callGatewayMethod } from "./sock";
import type { GatewayConfigSnapshot } from "./schema";
import {
  readOpenclawConfigFromWsl,
  writeOpenclawConfigToWsl,
  type WriteOpenclawConfigFromWslResult,
} from "../config/openclaw-wsl";

export const ALLOWED_CONFIG_SECTIONS = new Set(["channels", "agents", "skills", "browser", "gateway", "models"]);
const FILE_BACKED_CONFIG_SECTIONS = new Set(["agents", "models"]);

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

  const config = await readOpenclawConfig();
  config[section] = data;
  await applyOpenclawConfig(config, `ClawOS 保存 ${section} 配置`);
  return { mode: "gateway-apply" };
}
