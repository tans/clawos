import { chmodSync, copyFileSync, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

type HostOs = "macos" | "win" | "linux";
type ReleasePlatform = "darwin" | "win" | "linux";
type Arch = "x64" | "arm64";

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

function resolveLocalDownloadAsset(assetName: string): string {
  return join(process.cwd(), "download", assetName);
}

function copyAssetFromLocalDownload(assetName: string, targetPath: string, logPrefix: string): void {
  const localAssetPath = resolveLocalDownloadAsset(assetName);
  if (!existsSync(localAssetPath)) {
    throw new Error(
      [
        `未找到离线包：${localAssetPath}`,
        "当前模式已禁用镜像和 GitHub 下载。",
        `请先把 ${assetName} 放到项目 download 目录。`,
      ].join("\n")
    );
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

  const ensureBinPath = (): void => {
    mkdirSync(dirname(binCliPath), { recursive: true });
    copyFileSync(cachedCliPath, binCliPath);
    if (releasePlatform !== "win") {
      chmodSync(cachedCliPath, 0o755);
      chmodSync(binCliPath, 0o755);
    }
  };

  if (existsSync(cachedCliPath)) {
    ensureBinPath();
    return binCliPath;
  }

  const cliAsset = `electrobun-cli-${releasePlatform}-${arch}.tar.gz`;
  const tempTarPath = join(cacheDir, `clawos-cli-${versionTag}-${releasePlatform}-${arch}.tar.gz`);

  try {
    copyAssetFromLocalDownload(cliAsset, tempTarPath, "electrobun-cli");
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

  ensureBinPath();
  return binCliPath;
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
    copyAssetFromLocalDownload(coreAsset, tempTarPath, "electrobun-core");
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { hostOs, releasePlatform, arch } = resolvePlatform();
  const electrobunDir = join(process.cwd(), "node_modules", "electrobun");

  if (!existsSync(electrobunDir)) {
    throw new Error("未检测到 node_modules/electrobun，请先执行 bun install。");
  }

  const version = await readElectrobunVersion(electrobunDir);
  const cliPath = await ensureElectrobunCliFromLocalPackage(electrobunDir, releasePlatform, arch, version);

  if (args.length > 0 && !["--help", "-h", "help"].includes(args[0])) {
    await ensureElectrobunCoreFromLocalPackage(electrobunDir, hostOs, releasePlatform, arch, version);
  }

  const code = await runElectrobunCliBinary(cliPath, args);
  process.exit(code);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[electrobun-wrapper] ${message}`);
  process.exit(1);
});
