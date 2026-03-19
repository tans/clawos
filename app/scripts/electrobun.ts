import { chmodSync, copyFileSync, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

type HostOs = "macos" | "win" | "linux";
type ReleasePlatform = "darwin" | "win" | "linux";
type Arch = "x64" | "arm64";

function resolveElectrobunDir(): string | null {
  const appLocal = join(process.cwd(), "node_modules", "electrobun");
  if (existsSync(appLocal)) {
    return appLocal;
  }
  const repoLocal = join(process.cwd(), "..", "node_modules", "electrobun");
  if (existsSync(repoLocal)) {
    return repoLocal;
  }
  return null;
}

function resolveLocalDownloadAsset(assetName: string): string {
  const appLocal = join(process.cwd(), "download", assetName);
  if (existsSync(appLocal)) {
    return appLocal;
  }
  return join(process.cwd(), "..", "download", assetName);
}

function resolvePlatform(): { hostOs: HostOs; releasePlatform: ReleasePlatform; arch: Arch } {
  const hostOs: HostOs =
    process.platform === "darwin" ? "macos" : process.platform === "win32" ? "win" : "linux";
  const releasePlatform: ReleasePlatform =
    hostOs === "macos" ? "darwin" : hostOs === "win" ? "win" : "linux";
  const arch: Arch = hostOs === "win" ? "x64" : process.arch === "arm64" ? "arm64" : "x64";
  return { hostOs, releasePlatform, arch };
}

async function readElectrobunVersion(electrobunDir: string): Promise<string> {
  const pkgText = await Bun.file(join(electrobunDir, "package.json")).text();
  const raw = JSON.parse(pkgText) as { version?: unknown };
  if (!raw.version || typeof raw.version !== "string") {
    throw new Error("无法读取 electrobun 版本。");
  }
  return raw.version.trim();
}

function buildMissingAssetHint(assetName: string, version: string, releasePlatform: ReleasePlatform, arch: Arch): string {
  const appDownloadDir = join(process.cwd(), "download");
  const repoDownloadDir = join(process.cwd(), "..", "download");
  const localAssetPath = resolveLocalDownloadAsset(assetName);
  return [
    `未找到离线包：${localAssetPath}`,
    "当前为纯离线模式，已禁用镜像和 GitHub 在线下载。",
    "请先手动下载后重试：",
    `1) 目标版本: electrobun v${version}`,
    `2) 目标平台: ${releasePlatform}-${arch}`,
    `3) 目标文件: ${assetName}`,
    `4) 放置目录: ${appDownloadDir}（优先） 或 ${repoDownloadDir}`,
    `5) 预期路径: ${localAssetPath}`,
  ].join("\n");
}

function copyAssetFromLocalDownload(
  assetName: string,
  targetPath: string,
  logPrefix: string,
  version: string,
  releasePlatform: ReleasePlatform,
  arch: Arch
): void {
  const localAssetPath = resolveLocalDownloadAsset(assetName);
  if (!existsSync(localAssetPath)) {
    throw new Error(buildMissingAssetHint(assetName, version, releasePlatform, arch));
  }

  const size = statSync(localAssetPath).size;
  if (size <= 0) {
    throw new Error(`离线包为空文件：${localAssetPath}`);
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(localAssetPath, targetPath);
  console.log(`[${logPrefix}] 使用本地离线包: ${localAssetPath}`);
}

function requiredCoreBinaryPaths(electrobunDir: string, hostOs: HostOs, arch: Arch): string[] {
  const binExt = hostOs === "win" ? ".exe" : "";
  const distDir = join(electrobunDir, `dist-${hostOs}-${arch}`);
  const required = [
    join(distDir, `bun${binExt}`),
    join(distDir, `bsdiff${binExt}`),
    join(distDir, `bspatch${binExt}`),
  ];

  if (hostOs === "macos") {
    required.push(join(distDir, `launcher${binExt}`), join(distDir, "libNativeWrapper.dylib"));
  } else if (hostOs === "win") {
    required.push(join(distDir, "libNativeWrapper.dll"));
  } else {
    required.push(join(distDir, "libNativeWrapper.so"));
  }

  return required;
}

function hasCoreDependencies(electrobunDir: string, hostOs: HostOs, arch: Arch): boolean {
  return requiredCoreBinaryPaths(electrobunDir, hostOs, arch).every((filePath) => existsSync(filePath));
}

async function ensureElectrobunCliFromLocalPackage(
  electrobunDir: string,
  releasePlatform: ReleasePlatform,
  arch: Arch,
  version: string
): Promise<string> {
  const cliBinExt = releasePlatform === "win" ? ".exe" : "";
  const cacheDir = join(electrobunDir, ".cache");
  const versionTag = `v${version}`;
  const cachedCliPath = join(cacheDir, `electrobun-${versionTag}${cliBinExt}`);
  const extractedCliPath = join(cacheDir, `electrobun${cliBinExt}`);
  const binCliPath = join(electrobunDir, "bin", `electrobun${cliBinExt}`);

  const syncBinPathBestEffort = async (): Promise<void> => {
    mkdirSync(dirname(binCliPath), { recursive: true });

    const cachedSize = statSync(cachedCliPath).size;
    if (existsSync(binCliPath)) {
      try {
        const binSize = statSync(binCliPath).size;
        if (binSize === cachedSize) {
          if (releasePlatform !== "win") {
            chmodSync(cachedCliPath, 0o755);
            chmodSync(binCliPath, 0o755);
          }
          return;
        }
      } catch {
        // Fall through to copy retry.
      }
    }

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        copyFileSync(cachedCliPath, binCliPath);
        if (releasePlatform !== "win") {
          chmodSync(cachedCliPath, 0o755);
          chmodSync(binCliPath, 0o755);
        }
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 4) {
          await Bun.sleep(150 * attempt);
        }
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    console.warn(`[electrobun-wrapper] bin CLI sync skipped: ${message}`);
  };

  if (existsSync(cachedCliPath)) {
    await syncBinPathBestEffort();
    return cachedCliPath;
  }

  const cliAsset = `electrobun-cli-${releasePlatform}-${arch}.tar.gz`;
  const tempTarPath = join(cacheDir, `clawos-cli-${versionTag}-${releasePlatform}-${arch}.tar.gz`);

  try {
    copyAssetFromLocalDownload(cliAsset, tempTarPath, "electrobun-cli", version, releasePlatform, arch);
    const archiveBytes = await Bun.file(tempTarPath).arrayBuffer();
    const archive = new Bun.Archive(archiveBytes);
    mkdirSync(cacheDir, { recursive: true });
    await archive.extract(cacheDir);
    if (existsSync(extractedCliPath) && !existsSync(cachedCliPath)) {
      copyFileSync(extractedCliPath, cachedCliPath);
    }
  } finally {
    try {
      unlinkSync(tempTarPath);
    } catch {
      // ignore temp cleanup failures
    }
  }

  if (!existsSync(cachedCliPath)) {
    throw new Error(`CLI 解压后未找到可执行文件：${cachedCliPath}`);
  }

  await syncBinPathBestEffort();
  return cachedCliPath;
}

async function ensureElectrobunCoreFromLocalPackage(
  electrobunDir: string,
  hostOs: HostOs,
  releasePlatform: ReleasePlatform,
  arch: Arch,
  version: string
): Promise<void> {
  if (hasCoreDependencies(electrobunDir, hostOs, arch)) {
    return;
  }

  const coreAsset = `electrobun-core-${releasePlatform}-${arch}.tar.gz`;
  const tempTarPath = join(electrobunDir, `.clawos-core-${releasePlatform}-${arch}.tar.gz`);

  try {
    copyAssetFromLocalDownload(coreAsset, tempTarPath, "electrobun-core", version, releasePlatform, arch);
    const archiveBytes = await Bun.file(tempTarPath).arrayBuffer();
    const archive = new Bun.Archive(archiveBytes);
    const targetDir = join(electrobunDir, `dist-${hostOs}-${arch}`);
    mkdirSync(targetDir, { recursive: true });
    await archive.extract(targetDir);
  } finally {
    try {
      unlinkSync(tempTarPath);
    } catch {
      // ignore temp cleanup failures
    }
  }

  if (!hasCoreDependencies(electrobunDir, hostOs, arch)) {
    throw new Error("离线包已解压，但 electrobun core 依赖仍不完整。");
  }
}

async function runElectrobunCliBinary(cliPath: string, args: string[]): Promise<number> {
  const proc = Bun.spawn({
    cmd: [cliPath, ...args],
    cwd: process.cwd(),
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return await proc.exited;
}

function resolveBuildEnvironmentArg(args: string[]): "dev" | "canary" | "stable" {
  const envArg = args.find((arg) => arg.startsWith("--env="));
  const env = envArg ? envArg.slice("--env=".length).trim().toLowerCase() : "dev";
  if (env === "canary" || env === "stable") {
    return env;
  }
  return "dev";
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { hostOs, releasePlatform, arch } = resolvePlatform();
  const electrobunDir = resolveElectrobunDir();
  console.log(`[electrobun-wrapper] 离线模式已启用（${releasePlatform}-${arch}），仅使用项目 download 目录中的离线包。`);

  if (!electrobunDir || !existsSync(electrobunDir)) {
    throw new Error("未检测到 node_modules/electrobun，请先执行 bun install。");
  }

  const version = await readElectrobunVersion(electrobunDir);
  const cliPath = await ensureElectrobunCliFromLocalPackage(electrobunDir, releasePlatform, arch, version);

  if (args.length > 0 && !["--help", "-h", "help"].includes(args[0])) {
    await ensureElectrobunCoreFromLocalPackage(electrobunDir, hostOs, releasePlatform, arch, version);
  }

  const code = await runElectrobunCliBinary(cliPath, args);
  if (code === 0 && args[0] === "build") {
    const buildEnv = resolveBuildEnvironmentArg(args);
    const buildDir = join(process.cwd(), "build", `${buildEnv}-${releasePlatform}-${arch}`);
    console.log(`[electrobun-wrapper] 构建目录: ${buildDir}`);
    if (releasePlatform === "win" && buildEnv === "dev") {
      console.log(`[electrobun-wrapper] Windows 可运行程序请在该目录内搜索 launcher.exe（位于 */bin/launcher.exe）。`);
    }
  }
  process.exit(code);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[electrobun-wrapper] ${message}`);
  process.exit(1);
});
