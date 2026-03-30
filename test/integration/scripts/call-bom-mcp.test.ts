import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

describe("call-bom-mcp script", () => {
  it("runs a bom-mcp tool from a json file", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "bom-mcp-call-script-"));
    const stateDir = resolve(rootDir, "state");
    const exportDir = resolve(rootDir, "exports");
    const cacheDir = resolve(rootDir, "cache");
    const dbPath = resolve(stateDir, "bom-mcp.sqlite");
    const envFile = resolve(rootDir, "bom-mcp.env");
    const argsFile = resolve(rootDir, "doctor.json");

    await mkdir(stateDir, { recursive: true });
    await mkdir(exportDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });

    const db = new Database(dbPath, { create: true });
    db.exec("CREATE TABLE IF NOT EXISTS doctor_probe (id INTEGER PRIMARY KEY);");
    db.close();

    await writeFile(
      envFile,
      [
        `BOM_MCP_STATE_DIR=${stateDir}`,
        `BOM_MCP_DB_PATH=${dbPath}`,
        `BOM_MCP_EXPORT_DIR=${exportDir}`,
        `BOM_MCP_CACHE_DIR=${cacheDir}`,
        "",
      ].join("\n"),
      "utf-8",
    );
    await writeFile(argsFile, "{}\n", "utf-8");

    try {
      const proc = Bun.spawn({
        cmd: ["bash", "scripts/call-bom-mcp.sh", "doctor", argsFile, envFile],
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(stderr.trim()).toBe("");

      const payload = JSON.parse(stdout) as {
        ok: boolean;
        result: {
          ok: boolean;
          runtime: {
            stateDir: string;
            exportDir: string;
            cacheDir: string;
            dbPath: string;
          };
        };
      };

      expect(payload.ok).toBe(true);
      expect(payload.result.ok).toBe(true);
      expect(payload.result.runtime.stateDir).toBe(stateDir);
      expect(payload.result.runtime.exportDir).toBe(exportDir);
      expect(payload.result.runtime.cacheDir).toBe(cacheDir);
      expect(payload.result.runtime.dbPath).toBe(dbPath);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
