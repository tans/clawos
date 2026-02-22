import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetEnvCacheForTests } from "../src/lib/env";
import {
  readLatestRelease,
  resolveLatestInstaller,
  resolveLatestXiakeConfig,
  storeInstaller,
  storeXiakeConfig,
} from "../src/lib/storage";

let tempStorageDir = "";

beforeEach(async () => {
  tempStorageDir = await mkdtemp(join(tmpdir(), "clawos-web-test-"));
  process.env.STORAGE_DIR = tempStorageDir;
  process.env.MAX_INSTALLER_SIZE_MB = "5";
  process.env.MAX_CONFIG_SIZE_MB = "1";
  resetEnvCacheForTests();
});

afterEach(async () => {
  delete process.env.STORAGE_DIR;
  delete process.env.MAX_INSTALLER_SIZE_MB;
  delete process.env.MAX_CONFIG_SIZE_MB;
  resetEnvCacheForTests();
  if (tempStorageDir) {
    await rm(tempStorageDir, { recursive: true, force: true });
  }
});

describe("release storage", () => {
  it("stores installer and updates latest metadata", async () => {
    const installerBytes = new TextEncoder().encode("installer-binary");
    const result = await storeInstaller({
      fileName: "clawos-setup-1.2.3.exe",
      bytes: installerBytes,
    });

    expect(result.release.version).toBe("1.2.3");
    const latest = await readLatestRelease();
    expect(latest?.installer?.name).toBe("clawos-setup-1.2.3.exe");

    const download = await resolveLatestInstaller();
    expect(download.asset.size).toBe(installerBytes.byteLength);
  });

  it("stores xiake config and resolves downloadable file", async () => {
    await storeInstaller({
      fileName: "clawos-setup-2.0.0.exe",
      bytes: new TextEncoder().encode("installer-binary"),
    });

    const configBytes = new TextEncoder().encode('{"name":"xiake"}');
    await storeXiakeConfig({
      fileName: "clawos_xiake.json",
      bytes: configBytes,
    });

    const download = await resolveLatestXiakeConfig();
    const fileContent = await readFile(download.absolutePath, "utf-8");

    expect(download.asset.name).toBe("clawos_xiake.json");
    expect(fileContent).toBe('{"name":"xiake"}');
  });

  it("rejects unsupported installer extension", async () => {
    await expect(
      storeInstaller({
        fileName: "clawos.pkg",
        bytes: new TextEncoder().encode("x"),
      }),
    ).rejects.toThrow("安装包仅支持");
  });
});
