import JSON5 from "json5";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  deobfuscateSecret,
  obfuscateSecret,
  WALLET_OBFUSCATION_ALGORITHM,
} from "../lib/secret-obfuscation";
import { DEFAULT_OPENCLAW_TOKEN, DEFAULT_PORT } from "../app.constants";
import { asObject } from "../lib/value";

const IS_WINDOWS = process.platform === "win32";
const OPENCLAW_CONFIG_DIR =
  process.env.CLAWOS_OPENCLAW_CONFIG_DIR?.trim() ||
  (IS_WINDOWS ? "/root/.openclaw" : "/tmp/clawos-openclaw/.openclaw");
const OPENCLAW_CONFIG_PATH = `${OPENCLAW_CONFIG_DIR}/openclaw.json`;
const CLAWOS_LOCAL_CONFIG_PATH = path.join(process.cwd(), "clawos.json");

export type LocalWalletConfig = {
  address?: string;
  privateKeyObfuscated?: string;
  algorithm?: string;
  createdAt?: string;
};

export type LocalAppConfig = {
  port?: number;
  openclawToken?: string;
  autoOpenBrowser?: boolean;
};

export type LocalClawosConfig = {
  controllerAddress?: string;
  app?: LocalAppConfig;
  gateway?: {
    url?: string;
    token?: string;
    password?: string;
    origin?: string;
  };
  wsl?: {
    distro?: string;
    wslBin?: string;
    available?: boolean;
    checkedAt?: string;
    execMode?: "wsl" | "direct";
  };
  openclaw?: {
    configPath?: string;
    sourceVersionHash?: string;
  };
  wallet?: LocalWalletConfig;
};

export type LocalGatewayConnectionConfig = {
  url: string;
  token: string;
  password: string;
  origin: string;
};

export type LocalWalletSummary = {
  exists: boolean;
  address: string;
  privateKeyObfuscatedPreview: string;
  algorithm: string;
  createdAt: string;
};

export type GeneratedLocalWallet = {
  address: string;
  privateKey: string;
  wallet: LocalWalletSummary;
};

export type LocalAppSettings = {
  port: number;
  openclawToken: string;
  autoOpenBrowser: boolean;
  controllerAddress: string;
};

export type LocalOpenclawExecutionEnvironment = {
  available: boolean;
  checkedAt: string;
  execMode: "wsl" | "direct";
};

export function getDefaultOpenclawConfigPath(): string {
  return OPENCLAW_CONFIG_PATH;
}

export function getLocalConfigPath(): string {
  return CLAWOS_LOCAL_CONFIG_PATH;
}

export function localConfigTemplate(): LocalClawosConfig {
  return {
    controllerAddress: "",
    app: {
      port: DEFAULT_PORT,
      openclawToken: DEFAULT_OPENCLAW_TOKEN,
      autoOpenBrowser: true,
    },
    gateway: {
      url: "ws://127.0.0.1:18789",
      token: "",
      password: "",
      origin: "",
    },
    wsl: {
      distro: "",
      wslBin: "wsl.exe",
      available: false,
      checkedAt: "",
      execMode: IS_WINDOWS ? "wsl" : "direct",
    },
    openclaw: {
      configPath: OPENCLAW_CONFIG_PATH,
      sourceVersionHash: "",
    },
    wallet: {
      address: "",
      privateKeyObfuscated: "",
      algorithm: WALLET_OBFUSCATION_ALGORITHM,
      createdAt: "",
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

function pickString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function pickPort(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = Math.floor(value);
    if (parsed >= 1 && parsed <= 65535) {
      return parsed;
    }
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      const intValue = Math.floor(parsed);
      if (intValue >= 1 && intValue <= 65535) {
        return intValue;
      }
    }
  }

  return fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function pickExecMode(value: unknown, fallback: "wsl" | "direct"): "wsl" | "direct" {
  if (value === "wsl" || value === "direct") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "wsl" || normalized === "direct") {
      return normalized;
    }
  }
  return fallback;
}

function normalizeLocalConfig(input: LocalClawosConfig | null | undefined): LocalClawosConfig {
  const defaults = localConfigTemplate();
  const cfg = input || {};

  return {
    controllerAddress: pickString(cfg.controllerAddress, defaults.controllerAddress || ""),
    app: {
      port: pickPort(cfg.app?.port, defaults.app?.port || DEFAULT_PORT),
      openclawToken: pickString(cfg.app?.openclawToken, defaults.app?.openclawToken || DEFAULT_OPENCLAW_TOKEN),
      autoOpenBrowser: pickBoolean(cfg.app?.autoOpenBrowser, defaults.app?.autoOpenBrowser ?? true),
    },
    gateway: {
      url: pickString(cfg.gateway?.url, defaults.gateway?.url || ""),
      token: pickString(cfg.gateway?.token, defaults.gateway?.token || ""),
      password: pickString(cfg.gateway?.password, defaults.gateway?.password || ""),
      origin: pickString(cfg.gateway?.origin, defaults.gateway?.origin || ""),
    },
    wsl: {
      distro: pickString(cfg.wsl?.distro, defaults.wsl?.distro || ""),
      wslBin: pickString(cfg.wsl?.wslBin, defaults.wsl?.wslBin || "wsl.exe"),
      available: pickBoolean(cfg.wsl?.available, defaults.wsl?.available ?? false),
      checkedAt: pickString(cfg.wsl?.checkedAt, defaults.wsl?.checkedAt || ""),
      execMode: pickExecMode(cfg.wsl?.execMode, defaults.wsl?.execMode || (IS_WINDOWS ? "wsl" : "direct")),
    },
    openclaw: {
      configPath: pickString(cfg.openclaw?.configPath, defaults.openclaw?.configPath || OPENCLAW_CONFIG_PATH),
      sourceVersionHash: pickString(cfg.openclaw?.sourceVersionHash, defaults.openclaw?.sourceVersionHash || ""),
    },
    wallet: {
      address: pickString(cfg.wallet?.address, defaults.wallet?.address || ""),
      privateKeyObfuscated: pickString(cfg.wallet?.privateKeyObfuscated, defaults.wallet?.privateKeyObfuscated || ""),
      algorithm: pickString(cfg.wallet?.algorithm, defaults.wallet?.algorithm || WALLET_OBFUSCATION_ALGORITHM),
      createdAt: pickString(cfg.wallet?.createdAt, defaults.wallet?.createdAt || ""),
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

function readNormalizedLocalConfig(): LocalClawosConfig {
  return normalizeLocalConfig(readConfigFileOrNull(CLAWOS_LOCAL_CONFIG_PATH));
}

function hasWallet(wallet: LocalWalletConfig | null | undefined): boolean {
  const address = typeof wallet?.address === "string" ? wallet.address.trim() : "";
  const privateKeyObfuscated =
    typeof wallet?.privateKeyObfuscated === "string" ? wallet.privateKeyObfuscated.trim() : "";
  return address.length > 0 && privateKeyObfuscated.length > 0;
}

function maskSecret(value: string): string {
  if (value.length <= 16) {
    return value;
  }
  return `${value.slice(0, 10)}...${value.slice(-10)}`;
}

function toWalletSummary(wallet: LocalWalletConfig | null | undefined): LocalWalletSummary {
  const exists = hasWallet(wallet);
  return {
    exists,
    address: exists ? (wallet?.address || "") : "",
    privateKeyObfuscatedPreview: exists ? maskSecret(wallet?.privateKeyObfuscated || "") : "",
    algorithm: exists ? (wallet?.algorithm || WALLET_OBFUSCATION_ALGORITHM) : "",
    createdAt: exists ? (wallet?.createdAt || "") : "",
  };
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
  const localConfig = readNormalizedLocalConfig();
  return {
    url: localConfig.gateway?.url || "",
    token: localConfig.gateway?.token || "",
    password: localConfig.gateway?.password || "",
    origin: localConfig.gateway?.origin || "",
  };
}

export function readLocalAppSettings(): LocalAppSettings {
  const localConfig = readNormalizedLocalConfig();
  return {
    port: pickPort(localConfig.app?.port, DEFAULT_PORT),
    openclawToken: pickString(localConfig.app?.openclawToken, DEFAULT_OPENCLAW_TOKEN),
    autoOpenBrowser: pickBoolean(localConfig.app?.autoOpenBrowser, true),
    controllerAddress: pickString(localConfig.controllerAddress, ""),
  };
}

export function updateLocalAppSettings(patch: Partial<LocalAppSettings>): LocalAppSettings {
  const current = readNormalizedLocalConfig();
  const currentSettings = readLocalAppSettings();

  const nextApp: LocalAppConfig = {
    port: typeof patch.port === "number" ? pickPort(patch.port, currentSettings.port) : currentSettings.port,
    openclawToken:
      typeof patch.openclawToken === "string"
        ? pickString(patch.openclawToken, currentSettings.openclawToken)
        : currentSettings.openclawToken,
    autoOpenBrowser:
      typeof patch.autoOpenBrowser === "boolean"
        ? patch.autoOpenBrowser
        : currentSettings.autoOpenBrowser,
  };

  const next = normalizeLocalConfig({
    ...current,
    controllerAddress:
      typeof patch.controllerAddress === "string"
        ? patch.controllerAddress.trim()
        : currentSettings.controllerAddress,
    app: {
      ...current.app,
      ...nextApp,
    },
  });

  if (!writeLocalConfig(CLAWOS_LOCAL_CONFIG_PATH, next)) {
    throw new Error(`保存本地设置失败：${CLAWOS_LOCAL_CONFIG_PATH}`);
  }

  return {
    port: pickPort(next.app?.port, DEFAULT_PORT),
    openclawToken: pickString(next.app?.openclawToken, DEFAULT_OPENCLAW_TOKEN),
    autoOpenBrowser: pickBoolean(next.app?.autoOpenBrowser, true),
    controllerAddress: pickString(next.controllerAddress, ""),
  };
}

export function updateLocalGatewayConnectionConfig(patch: Partial<LocalGatewayConnectionConfig>): LocalGatewayConnectionConfig {
  const current = readNormalizedLocalConfig();
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

export function readLocalWalletSummary(): LocalWalletSummary {
  const localConfig = readNormalizedLocalConfig();
  return toWalletSummary(localConfig.wallet);
}

export function generateAndSaveLocalWallet(): GeneratedLocalWallet {
  const current = readNormalizedLocalConfig();
  if (hasWallet(current.wallet)) {
    throw new Error("已存在钱包，无需重复生成。");
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const privateKeyObfuscated = obfuscateSecret(privateKey);

  if (deobfuscateSecret(privateKeyObfuscated) !== privateKey) {
    throw new Error("钱包私钥混淆校验失败，请重试。");
  }

  const createdAt = new Date().toISOString();
  const nextWallet: LocalWalletConfig = {
    address: account.address,
    privateKeyObfuscated,
    algorithm: WALLET_OBFUSCATION_ALGORITHM,
    createdAt,
  };

  const next = normalizeLocalConfig({
    ...current,
    wallet: nextWallet,
  });

  if (!writeLocalConfig(CLAWOS_LOCAL_CONFIG_PATH, next)) {
    throw new Error(`保存钱包失败：${CLAWOS_LOCAL_CONFIG_PATH}`);
  }

  return {
    address: account.address,
    privateKey,
    wallet: toWalletSummary(next.wallet),
  };
}

export function resolveOpenclawConfigPath(): string {
  const localConfig = readLocalClawosConfig();
  const pathValue = localConfig?.openclaw?.configPath;
  const trimmed = typeof pathValue === "string" ? pathValue.trim() : "";
  return trimmed || OPENCLAW_CONFIG_PATH;
}

export function readLocalOpenclawSourceVersionHash(): string {
  const localConfig = readNormalizedLocalConfig();
  return pickString(localConfig.openclaw?.sourceVersionHash, "");
}

export function readLocalOpenclawExecutionEnvironment(): LocalOpenclawExecutionEnvironment {
  const localConfig = readNormalizedLocalConfig();
  return {
    available: pickBoolean(localConfig.wsl?.available, false),
    checkedAt: pickString(localConfig.wsl?.checkedAt, ""),
    execMode: pickExecMode(localConfig.wsl?.execMode, IS_WINDOWS ? "wsl" : "direct"),
  };
}

export function updateLocalOpenclawExecutionEnvironment(
  patch: Partial<LocalOpenclawExecutionEnvironment>
): LocalOpenclawExecutionEnvironment {
  const current = readNormalizedLocalConfig();
  const currentState = readLocalOpenclawExecutionEnvironment();

  const next = normalizeLocalConfig({
    ...current,
    wsl: {
      ...current.wsl,
      available:
        typeof patch.available === "boolean" ? patch.available : currentState.available,
      checkedAt:
        typeof patch.checkedAt === "string" ? patch.checkedAt.trim() : currentState.checkedAt,
      execMode:
        patch.execMode === "wsl" || patch.execMode === "direct"
          ? patch.execMode
          : currentState.execMode,
    },
  });

  if (!writeLocalConfig(CLAWOS_LOCAL_CONFIG_PATH, next)) {
    throw new Error(`保存 openclaw 执行环境失败：${CLAWOS_LOCAL_CONFIG_PATH}`);
  }

  return {
    available: pickBoolean(next.wsl?.available, false),
    checkedAt: pickString(next.wsl?.checkedAt, ""),
    execMode: pickExecMode(next.wsl?.execMode, IS_WINDOWS ? "wsl" : "direct"),
  };
}

export function updateLocalOpenclawSourceVersionHash(hash: string): string {
  const normalizedHash = pickString(hash, "");
  const current = readNormalizedLocalConfig();
  const next = normalizeLocalConfig({
    ...current,
    openclaw: {
      ...current.openclaw,
      sourceVersionHash: normalizedHash,
    },
  });

  if (!writeLocalConfig(CLAWOS_LOCAL_CONFIG_PATH, next)) {
    throw new Error(`保存 openclaw 源码版本 hash 失败：${CLAWOS_LOCAL_CONFIG_PATH}`);
  }

  return pickString(next.openclaw?.sourceVersionHash, "");
}
