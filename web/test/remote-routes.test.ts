import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetEnvCacheForTests } from "../src/lib/env";
import { app } from "../src/index";

let tempStorageDir = "";

beforeEach(async () => {
  tempStorageDir = await mkdtemp(join(tmpdir(), "clawos-web-remote-"));
  process.env.STORAGE_DIR = tempStorageDir;
  resetEnvCacheForTests();
});

afterEach(async () => {
  delete process.env.STORAGE_DIR;
  resetEnvCacheForTests();
  if (tempStorageDir) {
    await rm(tempStorageDir, { recursive: true, force: true });
  }
});

describe("remote routes", () => {
  it("returns remote catalog with fixed executors", async () => {
    const response = await app.request("http://localhost/api/remote/catalog");
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.executors).toEqual(["shell", "powershell", "wsl"]);
    expect(Array.isArray(payload.actions)).toBe(true);
  });

  it("supports dry-run plan generation", async () => {
    const response = await app.request("http://localhost/api/remote/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionIntent: "mcp.list", payload: { channel: "stable" }, dryRun: true }),
    });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.mode).toBe("dry-run");
    expect((payload.plan as Record<string, unknown>).actionIntent).toBe("mcp.list");
  });

  it("executes products.list plan", async () => {
    const response = await app.request("http://localhost/api/remote/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionIntent: "products.list", payload: {}, dryRun: false }),
    });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.mode).toBe("execute");
    const results = payload.results as Array<Record<string, unknown>>;
    expect(Array.isArray(results)).toBe(true);
    expect(results[0]?.ok).toBe(true);
  });
});
