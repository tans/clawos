import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export interface BomRuntimeEnv {
  stateDir: string;
  dbPath: string;
  exportDir: string;
  cacheDir: string;
  publicBaseUrl?: string;
  source: "env" | "user_home" | "dev_fallback";
}

function normalizeOptionalUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/\/+$/, "");
}

export function resolveRuntimeEnv(): BomRuntimeEnv {
  const envStateDir = process.env.BOM_MCP_STATE_DIR?.trim();
  const devStateDir = resolve(process.cwd(), "artifacts", "mcp", "bom-mcp");
  const devStateDbPath = join(devStateDir, "bom-mcp.sqlite");
  const hasSeededDevState = existsSync(devStateDbPath);
  if (envStateDir) {
    const cwd = process.cwd();
    const stateDir = isAbsolute(envStateDir) ? envStateDir : resolve(cwd, envStateDir);

    const sanitizePath = (value: string | undefined, fallback: string): string => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return fallback;
      }
      return isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed);
    };

    return {
      stateDir,
      dbPath: sanitizePath(process.env.BOM_MCP_DB_PATH, join(stateDir, "bom-mcp.sqlite")),
      exportDir: sanitizePath(process.env.BOM_MCP_EXPORT_DIR, join(stateDir, "exports")),
      cacheDir: sanitizePath(process.env.BOM_MCP_CACHE_DIR, join(stateDir, "cache")),
      publicBaseUrl: normalizeOptionalUrl(process.env.BOM_MCP_PUBLIC_BASE_URL),
      source: "env",
    };
  }

  if (hasSeededDevState) {
    return buildDevFallback(devStateDir);
  }

  const homeDir = homedir().trim();
  if (homeDir) {
    const stateDir = join(homeDir, ".openclaw", "state", "bom-mcp");
    return {
      stateDir,
      dbPath: join(stateDir, "bom-mcp.sqlite"),
      exportDir: join(stateDir, "exports"),
      cacheDir: join(stateDir, "cache"),
      publicBaseUrl: normalizeOptionalUrl(process.env.BOM_MCP_PUBLIC_BASE_URL),
      source: "user_home",
    };
  }

  return buildDevFallback(devStateDir);
}

function buildDevFallback(stateDir: string): BomRuntimeEnv {
  return {
    stateDir,
    dbPath: join(stateDir, "bom-mcp.sqlite"),
    exportDir: join(stateDir, "exports"),
    cacheDir: join(stateDir, "cache"),
    publicBaseUrl: normalizeOptionalUrl(process.env.BOM_MCP_PUBLIC_BASE_URL),
    source: "dev_fallback",
  };
}
