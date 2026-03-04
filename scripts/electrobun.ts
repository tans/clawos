import { chmodSync, copyFileSync, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { basename, dirname, join } from "node:path";

type HostOs = "macos" | "win" | "linux";
type ReleasePlatform = "darwin" | "win" | "linux";
type Arch = "x64" | "arm64";

const MIRROR_DEFAULTS = [
  "https://gh.llkk.cc/{url}",
  "https://ghproxy.net/{url}",
];

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

function releaseAssetUrl(version: string, assetName: string): string {
  return `https://github.com/blackboardsh/electrobun/releases/download/v${version}/${assetName}`;
}

function resolveMirrorTemplates(): string[] {
  const fromEnv = process.env.CLAWOS_ELECTROBUN_MIRRORS?.trim();
  const templates = fromEnv
    ? fromEnv
        .split(/[\n,]/g)
        .map((v) => v.trim())
        .filter(Boolean)
    : MIRROR_DEFAULTS;
  return [...new Set(templates)];
}

function buildCandidateUrls(sourceUrl: string): string[] {
  const mirrorTemplates = resolveMirrorTemplates();
  const expanded: string[] = [];

  for (const template of mirrorTemplates) {
    if (template.includes("{url}")) {
      expanded.push(template.replaceAll("{url}", sourceUrl));
      continue;
    }
    const prefix = template.endsWith("/") ? template : `${template}/`;
    expanded.push(`${prefix}${sourceUrl}`);
  }

  expanded.push(sourceUrl);
  return [...new Set(expanded)];
}

function resolveLocalDownloadAsset(sourceUrl: string): string {
  const fileName = basename(new URL(sourceUrl).pathname);
  return join(process.cwd(), "download", fileName);
}

async function downloadToFile(url: string, filePath: string, timeoutMs = 12_000): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!response.body) {
      throw new Error("response body empty");
    }

    mkdirSync(dirname(filePath), { recursive: true });
    const output = createWriteStream(filePath, { flags: "w" });
    const reader = response.body.getReader();
    let bytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value || value.byteLength === 0) {
        continue;
      }
      output.write(Buffer.from(value));
      bytes += value.byteLength;
    }

    await new Promise<void>((resolve, reject) => {
      output.end((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    return bytes;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadAssetWithMirror(
  sourceUrl: string,
  targetPath: string,
  logPrefix: string
): Promise<void> {
  const localAssetPath = resolveLocalDownloadAsset(sourceUrl);
  if (existsSync(localAssetPath)) {
    try {
      const size = statSync(localAssetPath).size;
      if (size <= 0) {
        throw new Error("local file is empty");
      }
      mkdirSync(dirname(targetPath), { recursive: true });
      copyFileSync(localAssetPath, targetPath);
      console.log(`[${logPrefix}] 使用本地离线包: ${localAssetPath}`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${logPrefix}] 本地离线包不可用，改为网络下载: ${localAssetPath} -> ${message}`);
    }
  }

  const candidates = buildCandidateUrls(sourceUrl);
  const errors: string[] = [];

  for (const candidateUrl of candidates) {
    try {
      console.log(`[${logPrefix}] 下载中: ${candidateUrl}`);
      const bytes = await downloadToFile(candidateUrl, targetPath);
      if (!existsSync(targetPath) || bytes <= 0 || statSync(targetPath).size <= 0) {
        throw new Error("downloaded file is empty");
      }
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidateUrl} -> ${message}`);
    }
  }

  throw new Error(
    [
      "下载失败（已尝试镜像与 GitHub）",
      ...errors.map((item) => `- ${item}`),
      "可通过 CLAWOS_ELECTROBUN_MIRRORS 覆盖镜像列表（逗号分隔，支持 {url} 模板）。",
    ].join("\n")
  );
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

async function ensureElectrobunCliFromMirror(
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
  const sourceUrl = releaseAssetUrl(version, cliAsset);
  const tempTarPath = join(cacheDir, `clawos-cli-${versionTag}-${releasePlatform}-${arch}.tar.gz`);

  try {
    await downloadAssetWithMirror(sourceUrl, tempTarPath, "electrobun-cli");
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

async function ensureElectrobunCoreFromMirror(
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
  const sourceUrl = releaseAssetUrl(version, coreAsset);
  const tempTarPath = join(electrobunDir, `.clawos-core-${releasePlatform}-${arch}.tar.gz`);

  try {
    await downloadAssetWithMirror(sourceUrl, tempTarPath, "electrobun-core");
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
    throw new Error("镜像包已下载并解压，但 electrobun core 依赖仍不完整。");
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
  const cliPath = await ensureElectrobunCliFromMirror(electrobunDir, releasePlatform, arch, version);

  if (args.length > 0 && !["--help", "-h", "help"].includes(args[0])) {
    await ensureElectrobunCoreFromMirror(electrobunDir, hostOs, releasePlatform, arch, version);
  }

  const code = await runElectrobunCliBinary(cliPath, args);
  process.exit(code);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[electrobun-wrapper] ${message}`);
  process.exit(1);
});
