import { homedir } from "node:os";
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
  const cwd = process.cwd();
  const envStateDir = process.env.BOM_MCP_STATE_DIR?.trim();
  const devStateDir = resolve(cwd, "artifacts", "mcp", "bom-mcp");
  const homeDir = homedir().trim();

  let stateDir: string;
  let source: BomRuntimeEnv["source"];

  if (envStateDir) {
    stateDir = isAbsolute(envStateDir) ? envStateDir : resolve(cwd, envStateDir);
    source = "env";
  } else if (homeDir) {
    stateDir = join(homeDir, ".openclaw", "state", "bom-mcp");
    source = "user_home";
  } else {
    stateDir = devStateDir;
    source = "dev_fallback";
  }

  const resolveEnvPath = (value: string | undefined, fallback: string): string => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return fallback;
    }
    return isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed);
  };

  return {
    stateDir,
    dbPath: resolveEnvPath(process.env.BOM_MCP_DB_PATH, join(stateDir, "bom-mcp.sqlite")),
    exportDir: resolveEnvPath(process.env.BOM_MCP_EXPORT_DIR, join(stateDir, "exports")),
    cacheDir: resolveEnvPath(process.env.BOM_MCP_CACHE_DIR, join(stateDir, "cache")),
    publicBaseUrl: normalizeOptionalUrl(process.env.BOM_MCP_PUBLIC_BASE_URL),
    source,
  };
}
