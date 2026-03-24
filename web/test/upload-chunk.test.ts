import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetEnvCacheForTests } from "../src/lib/env";
import { app } from "../src/index";

const UPLOAD_TOKEN = "test-token";
let tempStorageDir = "";

beforeEach(async () => {
  tempStorageDir = await mkdtemp(join(tmpdir(), "clawos-web-chunk-"));
  process.env.STORAGE_DIR = tempStorageDir;
  process.env.UPLOAD_TOKEN = UPLOAD_TOKEN;
  process.env.MAX_INSTALLER_SIZE_MB = "5";
  process.env.MAX_CONFIG_SIZE_MB = "1";
  resetEnvCacheForTests();
});

afterEach(async () => {
  delete process.env.STORAGE_DIR;
  delete process.env.UPLOAD_TOKEN;
  delete process.env.MAX_INSTALLER_SIZE_MB;
  delete process.env.MAX_CONFIG_SIZE_MB;
  resetEnvCacheForTests();
  if (tempStorageDir) {
    await rm(tempStorageDir, { recursive: true, force: true });
  }
});

describe("chunk upload routes", () => {
  it("uploads installer with chunks and completes canary release", async () => {
    const payload = new TextEncoder().encode("fake-installer-binary-data");
    const totalChunks = 2;

    const initResponse = await app.request("http://localhost/api/upload/chunk/init", {
      method: "POST",
      headers: {
        authorization: `Bearer ${UPLOAD_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        target: "installer",
        fileName: "clawos-canary-4.0.0.exe",
        totalSize: payload.byteLength,
        totalChunks,
        platform: "windows",
        channel: "canary",
        version: "4.0.0",
      }),
    });
    const initPayload = (await initResponse.json()) as Record<string, unknown>;
    expect(initResponse.status).toBe(200);
    expect(initPayload.ok).toBe(true);
    const uploadId = String(initPayload.uploadId);

    const partA = payload.slice(0, Math.floor(payload.byteLength / 2));
    const partB = payload.slice(Math.floor(payload.byteLength / 2));

    const part0 = await app.request(`http://localhost/api/upload/chunk/${uploadId}/part/0`, {
      method: "POST",
      headers: { authorization: `Bearer ${UPLOAD_TOKEN}` },
      body: partA,
    });
    expect(part0.status).toBe(200);

    const part1 = await app.request(`http://localhost/api/upload/chunk/${uploadId}/part/1`, {
      method: "POST",
      headers: { authorization: `Bearer ${UPLOAD_TOKEN}` },
      body: partB,
    });
    expect(part1.status).toBe(200);

    const complete = await app.request(`http://localhost/api/upload/chunk/${uploadId}/complete`, {
      method: "POST",
      headers: { authorization: `Bearer ${UPLOAD_TOKEN}` },
    });
    const completePayload = (await complete.json()) as Record<string, unknown>;
    expect(complete.status).toBe(200);
    expect(completePayload.ok).toBe(true);
    expect(completePayload.channel).toBe("canary");
    expect(completePayload.url).toBe("/downloads/canary/windows");

    const download = await app.request("http://localhost/downloads/canary/windows");
    expect(download.status).toBe(200);
    expect(download.headers.get("x-release-channel")).toBe("canary");
    expect(await download.text()).toBe("fake-installer-binary-data");
  });
});
