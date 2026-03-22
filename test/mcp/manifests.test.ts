import { describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const MCP_ROOT = resolve(process.cwd(), "mcp");
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

interface McpManifest {
  schemaVersion?: unknown;
  id?: unknown;
  name?: unknown;
  displayName?: unknown;
  description?: unknown;
  publisher?: unknown;
  platforms?: unknown;
  version?: unknown;
}

async function listMcpDirs(): Promise<string[]> {
  const entries = await readdir(MCP_ROOT, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

describe("mcp manifests", () => {
  it("ensures every MCP directory includes a complete manifest", async () => {
    const mcpDirs = await listMcpDirs();
    expect(mcpDirs.length).toBeGreaterThan(0);

    for (const dirName of mcpDirs) {
      const manifestPath = join(MCP_ROOT, dirName, "manifest.json");
      const raw = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(raw) as McpManifest;

      expect(manifest.schemaVersion).toBe("1.0");
      expect(manifest.id).toBe(dirName);
      expect(typeof manifest.name).toBe("string");
      expect(String(manifest.name || "").trim().length).toBeGreaterThan(0);
      expect(typeof manifest.displayName).toBe("string");
      expect(String(manifest.displayName || "").trim().length).toBeGreaterThan(0);
      expect(typeof manifest.description).toBe("string");
      expect(String(manifest.description || "").trim().length).toBeGreaterThan(0);
      expect(typeof manifest.publisher).toBe("string");
      expect(String(manifest.publisher || "").trim().length).toBeGreaterThan(0);
      expect(Array.isArray(manifest.platforms)).toBeTrue();
      expect((manifest.platforms as unknown[]).length).toBeGreaterThan(0);
      expect(typeof manifest.version).toBe("string");
      expect(SEMVER_PATTERN.test(String(manifest.version))).toBeTrue();
    }
  });
});
