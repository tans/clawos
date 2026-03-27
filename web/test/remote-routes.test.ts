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

  it("returns orchestrated action array", async () => {
    const response = await app.request("http://localhost/api/remote/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionIntent: "browser.detect", payload: {}, envSnapshot: { autoRestart: true } }),
    });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.executeOn).toBe("app");
    expect(payload.actionIntent).toBe("browser.detect");
    expect(payload.purpose).toBe("return-actions-for-app");
    const actions = (payload.ACTIONS ?? []) as string[];
    expect(Array.isArray(actions)).toBe(true);
    expect(actions[0]).toBe('POST /api/browser/action {"action":"detect"}');
  });

  it("returns app-side instructions instead of cloud execution", async () => {
    const response = await app.request("http://localhost/api/remote/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionIntent: "app.log_center.open", payload: {} }),
    });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    const actions = (payload.ACTIONS ?? []) as string[];
    expect(Array.isArray(actions)).toBe(true);
    expect(actions[0]).toBe("UI open-log-center");
  });

  it("returns full gateway update command flow", async () => {
    const response = await app.request("http://localhost/api/remote/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionIntent: "gateway.update", payload: {} }),
    });
    const payload = (await response.json()) as Record<string, unknown>;
    const actions = (payload.ACTIONS ?? []) as string[];
    expect(actions).toEqual([
      "cd /data/openclaw",
      "cd /data/openclaw && git fetch origin main --prune && git reset --hard origin/main && git clean -fd",
      "cd /data/openclaw && npm i -g nrm",
      "cd /data/openclaw && nrm use tencent",
      "cd /data/openclaw && pnpm install",
      "cd /data/openclaw && pnpm run build",
      "cd /data/openclaw && pnpm run ui:build",
      "cd /data/openclaw && pnpm link --global",
      "cd /data/openclaw && openclaw gateway restart",
    ]);
  });
});
