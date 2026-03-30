import { describe, expect, it } from "bun:test";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

describe("publish-mcp script", () => {
  it("supports dry-run packaging without uploading", async () => {
    const version = `9.9.${Date.now() % 1000}`;
    const proc = Bun.spawn({
      cmd: [
        "bun",
        "run",
        "scripts/publish-mcp.ts",
        "--mcp",
        "bom-mcp",
        "--version",
        version,
        "--dry-run",
        "--no-write-manifest",
      ],
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
    expect(stdout).toContain("[publish:mcp] dry run complete bom-mcp@");
    expect(stdout).toContain(`bom-mcp-${version}.tgz`);

    await access(resolve(process.cwd(), "artifacts", "mcp", "bom-mcp", `bom-mcp-${version}.tgz`));
  });
});
