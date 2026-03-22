import { resolve } from "node:path";

export interface AppEnv {
  port: number;
  uploadToken: string | null;
  maxInstallerSizeBytes: number;
  maxConfigSizeBytes: number;
  maxMcpPackageSizeBytes: number;
  storageDir: string;
}

export interface StartupEnvCheck {
  level: "warn" | "error";
  message: string;
}

let cachedEnv: AppEnv | null = null;

function readInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function mbToBytes(sizeMb: number): number {
  return sizeMb * 1024 * 1024;
}

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const port = readInt(process.env.PORT, 26222);
  const maxInstallerSizeMb = readInt(process.env.MAX_INSTALLER_SIZE_MB, 300);
  const maxConfigSizeMb = readInt(process.env.MAX_CONFIG_SIZE_MB, 2);
  const maxMcpPackageSizeMb = readInt(process.env.MAX_MCP_PACKAGE_SIZE_MB, maxInstallerSizeMb);

  cachedEnv = {
    port,
    uploadToken: process.env.UPLOAD_TOKEN?.trim() || "clawos",
    maxInstallerSizeBytes: mbToBytes(maxInstallerSizeMb),
    maxConfigSizeBytes: mbToBytes(maxConfigSizeMb),
    maxMcpPackageSizeBytes: mbToBytes(maxMcpPackageSizeMb),
    storageDir: resolve(process.env.STORAGE_DIR || resolve(process.cwd(), "storage")),
  };

  return cachedEnv;
}

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}

export function validateStartupEnv(env: AppEnv): StartupEnvCheck[] {
  const checks: StartupEnvCheck[] = [];

  if (!env.uploadToken) {
    checks.push({
      level: "warn",
      message: "未配置 UPLOAD_TOKEN，上传接口将不可用（会返回 503）。",
    });
  }

  if (env.uploadToken === "clawos") {
    checks.push({
      level: "warn",
      message: "当前使用默认 UPLOAD_TOKEN=clawos，建议在生产环境改为自定义高强度 Token。",
    });
  }

  if (env.port < 1 || env.port > 65535) {
    checks.push({
      level: "error",
      message: `PORT 不合法：${env.port}，必须在 1-65535 之间。`,
    });
  }

  return checks;
}
