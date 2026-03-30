import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveRuntimeEnv } from "../../../mcp/bom-mcp/src/runtime-env";

describe("bom-mcp runtime env", () => {
  afterEach(() => {
    delete process.env.BOM_MCP_STATE_DIR;
    delete process.env.BOM_MCP_DB_PATH;
    delete process.env.BOM_MCP_EXPORT_DIR;
    delete process.env.BOM_MCP_CACHE_DIR;
    delete process.env.BOM_MCP_PUBLIC_BASE_URL;
  });

  it("prefers explicit environment overrides", async () => {
    const root = await mkdtemp(join(tmpdir(), "bom-mcp-env-"));
    process.env.BOM_MCP_STATE_DIR = root;

    const env = resolveRuntimeEnv();

    expect(env.stateDir).toBe(root);
    expect(env.dbPath).toContain("bom-mcp.sqlite");
    expect(env.exportDir).toContain("exports");
    expect(env.cacheDir).toContain("cache");

    await rm(root, { recursive: true, force: true });
  });
});
