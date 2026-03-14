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
    expect(latest?.installers?.windows?.name).toBe("clawos-setup-1.2.3.exe");

    const download = await resolveLatestInstaller();
    expect(download.asset.size).toBe(installerBytes.byteLength);
  });

  it("stores platform installer and resolves by platform", async () => {
    const macBytes = new TextEncoder().encode("clawos-macos-installer");
    await storeInstaller({
      fileName: "clawos-1.2.3.dmg",
      bytes: macBytes,
      platform: "macos",
    });

    const latest = await readLatestRelease();
    expect(latest?.installers?.macos?.name).toBe("clawos-1.2.3.dmg");

    const download = await resolveLatestInstaller("macos");
    expect(download.asset.name).toBe("clawos-1.2.3.dmg");
    expect(download.asset.size).toBe(macBytes.byteLength);
  });

  it("separates stable and beta installer channels", async () => {
    await storeInstaller({
      fileName: "clawos-stable-3.0.0.exe",
      bytes: new TextEncoder().encode("stable-installer"),
      channel: "stable",
    });
    await storeInstaller({
      fileName: "clawos-beta-3.1.0.exe",
      bytes: new TextEncoder().encode("beta-installer"),
      channel: "beta",
    });

    const stable = await readLatestRelease("stable");
    const beta = await readLatestRelease("beta");
    expect(stable?.installer?.name).toBe("clawos-stable-3.0.0.exe");
    expect(beta?.installer?.name).toBe("clawos-beta-3.1.0.exe");

    const stableDownload = await resolveLatestInstaller(undefined, "stable");
    const betaDownload = await resolveLatestInstaller(undefined, "beta");
    expect(stableDownload.asset.name).toBe("clawos-stable-3.0.0.exe");
    expect(betaDownload.asset.name).toBe("clawos-beta-3.1.0.exe");
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
        fileName: "clawos.txt",
        bytes: new TextEncoder().encode("x"),
      }),
    ).rejects.toThrow("安装包扩展名与平台不匹配");
  });
});
