import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetEnvCacheForTests } from "../src/lib/env";
import {
  listMcpReleases,
  listMcpReleaseVersions,
  readLatestRelease,
  readMcpReleaseByVersion,
  readMcpRelease,
  resolveLatestInstaller,
  resolveMcpPackageByVersion,
  resolveLatestMcpPackage,
  resolveLatestXiakeConfig,
  storeInstaller,
  storeMcpPackage,
  storeXiakeConfig,
} from "../src/lib/storage";

let tempStorageDir = "";

beforeEach(async () => {
  tempStorageDir = await mkdtemp(join(tmpdir(), "clawos-web-test-"));
  process.env.STORAGE_DIR = tempStorageDir;
  process.env.MAX_INSTALLER_SIZE_MB = "5";
  process.env.MAX_CONFIG_SIZE_MB = "1";
  process.env.MAX_MCP_PACKAGE_SIZE_MB = "5";
  resetEnvCacheForTests();
});

afterEach(async () => {
  delete process.env.STORAGE_DIR;
  delete process.env.MAX_INSTALLER_SIZE_MB;
  delete process.env.MAX_CONFIG_SIZE_MB;
  delete process.env.MAX_MCP_PACKAGE_SIZE_MB;
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

  it("supports canary channel and keeps alpha compatibility", async () => {
    await storeInstaller({
      fileName: "clawos-canary-3.2.0.exe",
      bytes: new TextEncoder().encode("canary-installer"),
      channel: "canary",
    });

    const canary = await readLatestRelease("canary");
    const alpha = await readLatestRelease("alpha");
    expect(canary?.installer?.name).toBe("clawos-canary-3.2.0.exe");
    expect(alpha?.installer?.name).toBe("clawos-canary-3.2.0.exe");
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
      })
    ).rejects.toThrow();
  });

  it("stores MCP package and resolves latest download", async () => {
    const packageBytes = new TextEncoder().encode("fake-mcp-zip");
    await storeMcpPackage({
      mcpId: "windows-mcp",
      fileName: "windows-mcp-0.1.0.zip",
      bytes: packageBytes,
      version: "0.1.0",
      manifest: {
        schemaVersion: "1.0",
        id: "windows-mcp",
        name: "Windows MCP",
        version: "0.1.0",
      },
    });

    const items = await listMcpReleases();
    const item = await readMcpRelease("windows-mcp");
    const download = await resolveLatestMcpPackage("windows-mcp");

    expect(items).toHaveLength(1);
    expect(item?.version).toBe("0.1.0");
    expect(download.asset.name).toBe("windows-mcp-0.1.0.zip");
    expect(download.release.manifest.name).toBe("Windows MCP");
  });

  it("keeps MCP version history and resolves package by version", async () => {
    const v1 = new TextEncoder().encode("bom-v1");
    const v2 = new TextEncoder().encode("bom-v2");
    await storeMcpPackage({
      mcpId: "bom-mcp",
      fileName: "bom-mcp-0.1.0.zip",
      bytes: v1,
      version: "0.1.0",
      manifest: {
        schemaVersion: "1.0",
        id: "bom-mcp",
        name: "BOM MCP",
        version: "0.1.0",
      },
    });
    await storeMcpPackage({
      mcpId: "bom-mcp",
      fileName: "bom-mcp-0.1.1.zip",
      bytes: v2,
      version: "0.1.1",
      manifest: {
        schemaVersion: "1.0",
        id: "bom-mcp",
        name: "BOM MCP",
        version: "0.1.1",
      },
    });

    const latest = await readMcpRelease("bom-mcp");
    const versions = await listMcpReleaseVersions("bom-mcp");
    const v010 = await readMcpReleaseByVersion("bom-mcp", "0.1.0");
    const v011Download = await resolveMcpPackageByVersion("bom-mcp", "0.1.1");

    expect(latest?.version).toBe("0.1.1");
    expect(versions).toHaveLength(2);
    expect(versions[0]?.version).toBe("0.1.1");
    expect(versions[1]?.version).toBe("0.1.0");
    expect(v010?.package.name).toBe("bom-mcp-0.1.0.zip");
    expect(v011Download.release.version).toBe("0.1.1");
    expect(v011Download.asset.size).toBe(v2.byteLength);
  });
});
