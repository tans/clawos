import JSON5 from "json5";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { asObject } from "../lib/value";

const IS_WINDOWS = process.platform === "win32";
const OPENCLAW_CONFIG_DIR =
  process.env.CLAWOS_OPENCLAW_CONFIG_DIR?.trim() ||
  (IS_WINDOWS ? "/root/.openclaw" : "/tmp/clawos-openclaw/.openclaw");
const OPENCLAW_CONFIG_PATH = `${OPENCLAW_CONFIG_DIR}/openclaw.json`;
const CLAWOS_LOCAL_CONFIG_PATH = path.join(process.cwd(), "clawos.json");

export type LocalClawosConfig = {
  gateway?: {
    url?: string;
    token?: string;
    password?: string;
    origin?: string;
  };
  wsl?: {
    distro?: string;
    wslBin?: string;
  };
  openclaw?: {
    configPath?: string;
  };
};

export type LocalGatewayConnectionConfig = {
  url: string;
  token: string;
  password: string;
  origin: string;
};

export function getDefaultOpenclawConfigPath(): string {
  return OPENCLAW_CONFIG_PATH;
}

export function getLocalConfigPath(): string {
  return CLAWOS_LOCAL_CONFIG_PATH;
}

export function localConfigTemplate(): LocalClawosConfig {
  return {
    gateway: {
      url: "ws://127.0.0.1:18789",
      token: "",
      password: "",
      origin: "",
    },
    wsl: {
      distro: "",
      wslBin: "wsl.exe",
    },
    openclaw: {
      configPath: OPENCLAW_CONFIG_PATH,
    },
  };
}

function isRegularFile(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function parseLocalConfig(raw: string): LocalClawosConfig | null {
  try {
    const parsed = JSON5.parse(raw);
    const object = asObject(parsed);
    if (!object) {
      return null;
    }
    return object as LocalClawosConfig;
  } catch {
    return null;
  }
}

function normalizeLocalConfig(input: LocalClawosConfig | null | undefined): LocalClawosConfig {
  const defaults = localConfigTemplate();
  const cfg = input || {};

  const pickString = (value: unknown, fallback: string): string => {
    if (typeof value !== "string") {
      return fallback;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  };

  return {
    gateway: {
      url: pickString(cfg.gateway?.url, defaults.gateway?.url || ""),
      token: pickString(cfg.gateway?.token, defaults.gateway?.token || ""),
      password: pickString(cfg.gateway?.password, defaults.gateway?.password || ""),
      origin: pickString(cfg.gateway?.origin, defaults.gateway?.origin || ""),
    },
    wsl: {
      distro: pickString(cfg.wsl?.distro, defaults.wsl?.distro || ""),
      wslBin: pickString(cfg.wsl?.wslBin, defaults.wsl?.wslBin || "wsl.exe"),
    },
    openclaw: {
      configPath: pickString(cfg.openclaw?.configPath, defaults.openclaw?.configPath || OPENCLAW_CONFIG_PATH),
    },
  };
}

function writeLocalConfig(filePath: string, config: LocalClawosConfig): boolean {
  try {
    const content = `${JSON.stringify(config, null, 2)}\n`;
    writeFileSync(filePath, content, "utf-8");
    return true;
  } catch {
    return false;
  }
}

function readConfigFileOrNull(filePath: string): LocalClawosConfig | null {
  try {
    if (!isRegularFile(filePath)) {
      return null;
    }
    const raw = readFileSync(filePath, "utf-8");
    return parseLocalConfig(raw);
  } catch {
    return null;
  }
}

export function ensureLocalConfigTemplateFile(): void {
  const current = readConfigFileOrNull(CLAWOS_LOCAL_CONFIG_PATH);
  if (current) {
    const normalized = normalizeLocalConfig(current);
    writeLocalConfig(CLAWOS_LOCAL_CONFIG_PATH, normalized);
    return;
  }

  const normalized = normalizeLocalConfig(null);
  if (writeLocalConfig(CLAWOS_LOCAL_CONFIG_PATH, normalized)) {
    console.log(`已生成本地配置模板：${CLAWOS_LOCAL_CONFIG_PATH}`);
    return;
  }

  console.warn("创建本地配置模板失败：无法写入文件");
}

export function readLocalClawosConfig(): LocalClawosConfig | null {
  const current = readConfigFileOrNull(CLAWOS_LOCAL_CONFIG_PATH);
  if (current) {
    return normalizeLocalConfig(current);
  }

  return null;
}

export function readLocalGatewayConnectionConfig(): LocalGatewayConnectionConfig {
  const localConfig = normalizeLocalConfig(readConfigFileOrNull(CLAWOS_LOCAL_CONFIG_PATH));
  return {
    url: localConfig.gateway?.url || "",
    token: localConfig.gateway?.token || "",
    password: localConfig.gateway?.password || "",
    origin: localConfig.gateway?.origin || "",
  };
}

export function updateLocalGatewayConnectionConfig(patch: Partial<LocalGatewayConnectionConfig>): LocalGatewayConnectionConfig {
  const current = normalizeLocalConfig(readConfigFileOrNull(CLAWOS_LOCAL_CONFIG_PATH));
  const normalizedPatch = {
    url: typeof patch.url === "string" ? patch.url.trim() : current.gateway?.url || "",
    token: typeof patch.token === "string" ? patch.token.trim() : current.gateway?.token || "",
    password: typeof patch.password === "string" ? patch.password.trim() : current.gateway?.password || "",
    origin: typeof patch.origin === "string" ? patch.origin.trim() : current.gateway?.origin || "",
  };

  const next = normalizeLocalConfig({
    ...current,
    gateway: {
      ...current.gateway,
      ...normalizedPatch,
    },
  });

  if (!writeLocalConfig(CLAWOS_LOCAL_CONFIG_PATH, next)) {
    throw new Error(`保存本地配置失败：${CLAWOS_LOCAL_CONFIG_PATH}`);
  }

  return {
    url: next.gateway?.url || "",
    token: next.gateway?.token || "",
    password: next.gateway?.password || "",
    origin: next.gateway?.origin || "",
  };
}

export function resolveOpenclawConfigPath(): string {
  const localConfig = readLocalClawosConfig();
  const pathValue = localConfig?.openclaw?.configPath;
  const trimmed = typeof pathValue === "string" ? pathValue.trim() : "";
  return trimmed || OPENCLAW_CONFIG_PATH;
}
