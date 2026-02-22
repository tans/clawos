import { resolve } from "node:path";

export interface AppEnv {
  port: number;
  uploadToken: string | null;
  maxInstallerSizeBytes: number;
  maxConfigSizeBytes: number;
  storageDir: string;
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

  cachedEnv = {
    port,
    uploadToken: process.env.UPLOAD_TOKEN?.trim() || null,
    maxInstallerSizeBytes: mbToBytes(maxInstallerSizeMb),
    maxConfigSizeBytes: mbToBytes(maxConfigSizeMb),
    storageDir: resolve(process.env.STORAGE_DIR || resolve(process.cwd(), "storage")),
  };

  return cachedEnv;
}

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}
