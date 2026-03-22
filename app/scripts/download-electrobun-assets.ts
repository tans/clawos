import { existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type ReleasePlatform = "darwin" | "win" | "linux";
type Arch = "x64" | "arm64";
type Target = { platform: ReleasePlatform; arch: Arch };

const KNOWN_TARGETS: Target[] = [
  { platform: "darwin", arch: "arm64" },
  { platform: "darwin", arch: "x64" },
  { platform: "win", arch: "x64" },
  { platform: "linux", arch: "x64" },
  { platform: "linux", arch: "arm64" },
];

function usage(): string {
  return [
    "用法:",
    "  bun run scripts/download-electrobun-assets.ts [--all] [--targets=darwin-arm64,win-x64] [--force]",
    "",
    "参数:",
    "  --all       下载所有预定义平台包",
    "  --targets   指定平台列表（逗号分隔）",
    "  --force     覆盖已存在文件",
    "",
    "示例:",
    "  bun run scripts/download-electrobun-assets.ts",
    "  bun run scripts/download-electrobun-assets.ts --all",
    "  bun run scripts/download-electrobun-assets.ts --targets=darwin-arm64,win-x64",
  ].join("\n");
}

function parseArgs(argv: string[]): { all: boolean; force: boolean; targetsArg: string | null } {
  let all = false;
  let force = false;
  let targetsArg: string | null = null;

  for (const arg of argv) {
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg.startsWith("--targets=")) {
      targetsArg = arg.slice("--targets=".length).trim();
      continue;
    }
    throw new Error(`未知参数: ${arg}\n\n${usage()}`);
  }

  return { all, force, targetsArg };
}

function currentTarget(): Target {
  const platform: ReleasePlatform =
    process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "win" : "linux";
  // Electrobun Windows artifacts use x64.
  const arch: Arch = platform === "win" ? "x64" : process.arch === "arm64" ? "arm64" : "x64";
  return { platform, arch };
}

function parseTargets(raw: string): Target[] {
  const targets: Target[] = [];
  const invalid: string[] = [];

  for (const token of raw.split(",").map((v) => v.trim()).filter(Boolean)) {
    const [platformRaw, archRaw] = token.split("-", 2);
    const platform = platformRaw as ReleasePlatform;
    const arch = archRaw as Arch;
    if (!platform || !arch) {
      invalid.push(token);
      continue;
    }
    const known = KNOWN_TARGETS.some((t) => t.platform === platform && t.arch === arch);
    if (!known) {
      invalid.push(token);
      continue;
    }
    targets.push({ platform, arch });
  }

  if (invalid.length > 0) {
    throw new Error(`无效 targets: ${invalid.join(", ")}`);
  }
  if (targets.length === 0) {
    throw new Error("targets 为空，请至少提供一个平台。");
  }

  return dedupeTargets(targets);
}

function dedupeTargets(targets: Target[]): Target[] {
  const seen = new Set<string>();
  const out: Target[] = [];
  for (const target of targets) {
    const key = `${target.platform}-${target.arch}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(target);
  }
  return out;
}

function resolveTargets(all: boolean, targetsArg: string | null): Target[] {
  if (all) {
    return KNOWN_TARGETS;
  }
  if (targetsArg && targetsArg.length > 0) {
    return parseTargets(targetsArg);
  }
  return [currentTarget()];
}

async function resolveElectrobunVersion(): Promise<string> {
  const installedPath = join(process.cwd(), "node_modules", "electrobun", "package.json");
  if (existsSync(installedPath)) {
    const text = await readFile(installedPath, "utf8");
    const parsed = JSON.parse(text) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.trim()) {
      return parsed.version.trim();
    }
  }

  const rootPkgPath = join(process.cwd(), "package.json");
  const rootText = await readFile(rootPkgPath, "utf8");
  const root = JSON.parse(rootText) as {
    devDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
  };

  const range = root.devDependencies?.electrobun || root.dependencies?.electrobun || "";
  if (!range) {
    throw new Error("无法确定 electrobun 版本，请先 bun install 或在 package.json 中声明 electrobun。");
  }
  const cleaned = range.trim().replace(/^[~^<>=\s]*/, "");
  if (!cleaned) {
    throw new Error(`无法从版本范围解析 electrobun 版本: ${range}`);
  }
  return cleaned;
}

function releaseAssetUrl(version: string, assetName: string): string {
  return `https://github.com/blackboardsh/electrobun/releases/download/v${version}/${assetName}`;
}

async function downloadWithRetry(url: string, outPath: string, retries = 3): Promise<void> {
  let lastError: string = "unknown";
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), 30_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buf = await response.arrayBuffer();
      if (buf.byteLength <= 0) {
        throw new Error("empty body");
      }
      await Bun.write(outPath, new Uint8Array(buf));
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < retries) {
        await Bun.sleep(700 * attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`下载失败: ${url} (${lastError})`);
}

async function downloadAsset(version: string, fileName: string, force: boolean): Promise<void> {
  const downloadDir = join(process.cwd(), "download");
  const finalPath = join(downloadDir, fileName);
  if (existsSync(finalPath) && !force) {
    console.log(`[skip] ${fileName} 已存在`);
    return;
  }

  mkdirSync(downloadDir, { recursive: true });
  const tempPath = `${finalPath}.tmp`;
  const url = releaseAssetUrl(version, fileName);
  console.log(`[download] ${url}`);
  try {
    await downloadWithRetry(url, tempPath);
    if (existsSync(finalPath)) {
      unlinkSync(finalPath);
    }
    renameSync(tempPath, finalPath);
    console.log(`[ok] ${finalPath}`);
  } finally {
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }
  }
}

async function main(): Promise<void> {
  const { all, force, targetsArg } = parseArgs(process.argv.slice(2));
  const targets = resolveTargets(all, targetsArg);
  const version = await resolveElectrobunVersion();
  console.log(`[electrobun-download] version=v${version}`);
  console.log(`[electrobun-download] targets=${targets.map((t) => `${t.platform}-${t.arch}`).join(", ")}`);

  for (const target of targets) {
    const suffix = `${target.platform}-${target.arch}.tar.gz`;
    await downloadAsset(version, `electrobun-cli-${suffix}`, force);
    await downloadAsset(version, `electrobun-core-${suffix}`, force);
  }

  console.log(`[electrobun-download] 完成，文件已写入: ${join(process.cwd(), "download")}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[electrobun-download] ${message}`);
  process.exit(1);
});
