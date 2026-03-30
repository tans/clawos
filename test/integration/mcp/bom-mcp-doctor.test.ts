import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { access, chmod, mkdir, mkdtemp, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

async function loadRunTool() {
  const moduleUrl = new URL(`../../../mcp/bom-mcp/src/index.ts?ts=${Date.now()}`, import.meta.url);
  const indexModule = await import(moduleUrl.href);
  return indexModule.runTool as typeof import("../../../mcp/bom-mcp/src/index").runTool;
}

describe("bom-mcp doctor", () => {
  it("reports missing sqlite state without creating new runtime artifacts", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "bom-mcp-doctor-"));
    const stateDir = resolve(rootDir, "state");
    const exportDir = resolve(rootDir, "exports");
    const cacheDir = resolve(rootDir, "cache");
    const dbPath = resolve(stateDir, "bom-mcp.sqlite");
    const previousStateDir = process.env.BOM_MCP_STATE_DIR;
    const previousExportDir = process.env.BOM_MCP_EXPORT_DIR;
    const previousCacheDir = process.env.BOM_MCP_CACHE_DIR;
    const previousDbPath = process.env.BOM_MCP_DB_PATH;
    const previousPublicBaseUrl = process.env.BOM_MCP_PUBLIC_BASE_URL;
    process.env.BOM_MCP_STATE_DIR = stateDir;
    process.env.BOM_MCP_EXPORT_DIR = exportDir;
    process.env.BOM_MCP_CACHE_DIR = cacheDir;
    process.env.BOM_MCP_DB_PATH = dbPath;
    delete process.env.BOM_MCP_PUBLIC_BASE_URL;
    await mkdir(stateDir, { recursive: true });
    await mkdir(exportDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });

    try {
      const runTool = await loadRunTool();
      const result = (await runTool({
        tool: "doctor" as never,
        args: {},
      })) as {
        ok: boolean;
        runtime: { stateDir: string; exportDir: string; cacheDir: string; dbPath: string };
        checks: Array<{ name: string; ok: boolean; detail?: string }>;
        warnings: string[];
      };

      expect(result.ok).toBe(false);
      expect(result.runtime.stateDir).toBe(stateDir);
      expect(result.runtime.exportDir).toBe(exportDir);
      expect(result.runtime.cacheDir).toBe(cacheDir);
      expect(result.runtime.dbPath).toBe(dbPath);
      expect(result.checks).toContainEqual({
        name: "stateDirWritable",
        ok: true,
      });
      expect(result.checks).toContainEqual({
        name: "exportDirWritable",
        ok: true,
      });
      expect(result.checks).toContainEqual({
        name: "cacheDirWritable",
        ok: true,
      });
      expect(result.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "sqliteWritable",
            ok: false,
          }),
        ]),
      );
      expect(result.warnings.some((item) => item.includes("publicBaseUrl"))).toBe(true);
      await expect(access(dbPath, constants.F_OK)).rejects.toThrow();
    } finally {
      if (previousStateDir === undefined) {
        delete process.env.BOM_MCP_STATE_DIR;
      } else {
        process.env.BOM_MCP_STATE_DIR = previousStateDir;
      }
      if (previousExportDir === undefined) {
        delete process.env.BOM_MCP_EXPORT_DIR;
      } else {
        process.env.BOM_MCP_EXPORT_DIR = previousExportDir;
      }
      if (previousCacheDir === undefined) {
        delete process.env.BOM_MCP_CACHE_DIR;
      } else {
        process.env.BOM_MCP_CACHE_DIR = previousCacheDir;
      }
      if (previousDbPath === undefined) {
        delete process.env.BOM_MCP_DB_PATH;
      } else {
        process.env.BOM_MCP_DB_PATH = previousDbPath;
      }
      if (previousPublicBaseUrl === undefined) {
        delete process.env.BOM_MCP_PUBLIC_BASE_URL;
      } else {
        process.env.BOM_MCP_PUBLIC_BASE_URL = previousPublicBaseUrl;
      }
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails when the configured sqlite file is not writable", async () => {
    if (process.platform === "win32") {
      return;
    }

    const rootDir = await mkdtemp(join(tmpdir(), "bom-mcp-doctor-readonly-"));
    const stateDir = resolve(rootDir, "state");
    const exportDir = resolve(rootDir, "exports");
    const cacheDir = resolve(rootDir, "cache");
    const dbPath = resolve(stateDir, "bom-mcp.sqlite");
    const previousStateDir = process.env.BOM_MCP_STATE_DIR;
    const previousExportDir = process.env.BOM_MCP_EXPORT_DIR;
    const previousCacheDir = process.env.BOM_MCP_CACHE_DIR;
    const previousDbPath = process.env.BOM_MCP_DB_PATH;
    const previousPublicBaseUrl = process.env.BOM_MCP_PUBLIC_BASE_URL;

    process.env.BOM_MCP_STATE_DIR = stateDir;
    process.env.BOM_MCP_EXPORT_DIR = exportDir;
    process.env.BOM_MCP_CACHE_DIR = cacheDir;
    process.env.BOM_MCP_DB_PATH = dbPath;
    delete process.env.BOM_MCP_PUBLIC_BASE_URL;

    await mkdir(stateDir, { recursive: true });
    await mkdir(exportDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });
    const db = new Database(dbPath, { create: true });
    db.exec("CREATE TABLE IF NOT EXISTS doctor_probe (id INTEGER PRIMARY KEY);");
    db.close();
    await chmod(dbPath, 0o444);

    try {
      const runTool = await loadRunTool();
      const result = (await runTool({
        tool: "doctor" as never,
        args: {},
      })) as {
        ok: boolean;
        checks: Array<{ name: string; ok: boolean; detail?: string }>;
      };

      expect(result.ok).toBe(false);
      expect(result.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "sqliteWritable",
            ok: false,
          }),
        ]),
      );
    } finally {
      await chmod(dbPath, 0o644).catch(() => undefined);
      if (previousStateDir === undefined) {
        delete process.env.BOM_MCP_STATE_DIR;
      } else {
        process.env.BOM_MCP_STATE_DIR = previousStateDir;
      }
      if (previousExportDir === undefined) {
        delete process.env.BOM_MCP_EXPORT_DIR;
      } else {
        process.env.BOM_MCP_EXPORT_DIR = previousExportDir;
      }
      if (previousCacheDir === undefined) {
        delete process.env.BOM_MCP_CACHE_DIR;
      } else {
        process.env.BOM_MCP_CACHE_DIR = previousCacheDir;
      }
      if (previousDbPath === undefined) {
        delete process.env.BOM_MCP_DB_PATH;
      } else {
        process.env.BOM_MCP_DB_PATH = previousDbPath;
      }
      if (previousPublicBaseUrl === undefined) {
        delete process.env.BOM_MCP_PUBLIC_BASE_URL;
      } else {
        process.env.BOM_MCP_PUBLIC_BASE_URL = previousPublicBaseUrl;
      }
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("supports the doctor CLI entrypoint", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "bom-mcp-doctor-cli-"));
    const stateDir = resolve(rootDir, "state");
    const exportDir = resolve(rootDir, "exports");
    const cacheDir = resolve(rootDir, "cache");
    const dbPath = resolve(stateDir, "bom-mcp.sqlite");
    const previousPublicBaseUrl = process.env.BOM_MCP_PUBLIC_BASE_URL;

    await mkdir(stateDir, { recursive: true });
    await mkdir(exportDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });
    const db = new Database(dbPath, { create: true });
    db.exec("CREATE TABLE IF NOT EXISTS doctor_probe (id INTEGER PRIMARY KEY);");
    db.close();

    delete process.env.BOM_MCP_PUBLIC_BASE_URL;

    try {
      const proc = spawn("bun", ["mcp/bom-mcp/src/index.ts", "doctor", "{}"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          BOM_MCP_STATE_DIR: stateDir,
          BOM_MCP_EXPORT_DIR: exportDir,
          BOM_MCP_CACHE_DIR: cacheDir,
          BOM_MCP_DB_PATH: dbPath,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      proc.stdout.setEncoding("utf8");
      proc.stderr.setEncoding("utf8");
      proc.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      proc.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });

      const exitCode = await new Promise<number>((resolveExit, rejectExit) => {
        proc.on("error", rejectExit);
        proc.on("close", (code) => resolveExit(code ?? -1));
      });

      expect(exitCode).toBe(0);
      expect(stderr.trim()).toBe("");

      const payload = JSON.parse(stdout) as {
        ok: boolean;
        result: {
          ok: boolean;
          warnings: string[];
          runtime: { stateDir: string; exportDir: string; cacheDir: string; dbPath: string };
        };
      };

      expect(payload.ok).toBe(true);
      expect(payload.result.ok).toBe(true);
      expect(payload.result.runtime.stateDir).toBe(stateDir);
      expect(payload.result.runtime.exportDir).toBe(exportDir);
      expect(payload.result.runtime.cacheDir).toBe(cacheDir);
      expect(payload.result.runtime.dbPath).toBe(dbPath);
      expect(payload.result.warnings.some((item) => item.includes("publicBaseUrl"))).toBe(true);
    } finally {
      if (previousPublicBaseUrl === undefined) {
        delete process.env.BOM_MCP_PUBLIC_BASE_URL;
      } else {
        process.env.BOM_MCP_PUBLIC_BASE_URL = previousPublicBaseUrl;
      }
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
