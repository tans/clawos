import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function loadResolveRuntimeEnv() {
  const moduleUrl = new URL(`../../../mcp/bom-mcp/src/runtime-env.ts?ts=${Date.now()}`, import.meta.url);
  const runtimeEnvModule = await import(moduleUrl.href);
  return runtimeEnvModule.resolveRuntimeEnv as typeof import("../../../mcp/bom-mcp/src/runtime-env").resolveRuntimeEnv;
}

describe("bom-mcp runtime env", () => {
  afterEach(() => {
    delete process.env.BOM_MCP_STATE_DIR;
    delete process.env.BOM_MCP_DB_PATH;
    delete process.env.BOM_MCP_EXPORT_DIR;
    delete process.env.BOM_MCP_CACHE_DIR;
    delete process.env.BOM_MCP_PUBLIC_BASE_URL;
    mock.restore();
  });

  it("prefers explicit environment overrides", async () => {
    const root = await mkdtemp(join(tmpdir(), "bom-mcp-env-"));
    process.env.BOM_MCP_STATE_DIR = root;

    const resolveRuntimeEnv = await loadResolveRuntimeEnv();
    const env = resolveRuntimeEnv();

    expect(env.stateDir).toBe(root);
    expect(env.dbPath).toContain("bom-mcp.sqlite");
    expect(env.exportDir).toContain("exports");
    expect(env.cacheDir).toContain("cache");
    expect(env.source).toBe("env");

    await rm(root, { recursive: true, force: true });
  });

  it("uses the user-home default before the dev fallback", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "bom-mcp-home-"));
    mock.module("node:os", () => ({ homedir: () => homeDir }));

    const resolveRuntimeEnv = await loadResolveRuntimeEnv();
    const env = resolveRuntimeEnv();

    expect(env.source).toBe("user_home");
    expect(env.stateDir).toBe(join(homeDir, ".openclaw", "state", "bom-mcp"));
    expect(env.dbPath).toBe(join(homeDir, ".openclaw", "state", "bom-mcp", "bom-mcp.sqlite"));

    await rm(homeDir, { recursive: true, force: true });
  });

  it("falls back to the cwd artifacts path when no home directory is available", async () => {
    mock.module("node:os", () => ({ homedir: () => "" }));

    const resolveRuntimeEnv = await loadResolveRuntimeEnv();
    const env = resolveRuntimeEnv();

    expect(env.source).toBe("dev_fallback");
    expect(env.stateDir).toBe(join(process.cwd(), "artifacts", "mcp", "bom-mcp"));
  });

  it("honors export dir overrides without a state override", async () => {
    const customExportDir = await mkdtemp(join(tmpdir(), "bom-mcp-export-"));
    process.env.BOM_MCP_EXPORT_DIR = customExportDir;
    mock.module("node:os", () => ({ homedir: () => "" }));

    const resolveRuntimeEnv = await loadResolveRuntimeEnv();
    const env = resolveRuntimeEnv();

    expect(env.exportDir).toBe(customExportDir);
    await rm(customExportDir, { recursive: true, force: true });
  });
});
