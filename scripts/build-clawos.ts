import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, resolve } from "node:path";

interface BuildOptions {
  outfile: string;
  skipCss: boolean;
  target: string;
  bumpPatch: boolean;
  fixedVersion: string | null;
}

function printUsage(): void {
  console.log(
    `ClawOS 打包脚本\n\n用法:\n  bun run scripts/build-clawos.ts [options]\n\n选项:\n  --outfile <path>     输出路径，默认 ./dist/clawos.exe\n  --skip-css           跳过 Tailwind CSS 构建\n  --target <target>    编译目标，默认 bun-windows-x64-modern\n  --no-bump-patch      不自动递增 patch 版本号\n  --version <version>  指定构建版本（会覆盖自动递增）\n  -h, --help           显示帮助\n`
  );
}

function parseArgs(argv: string[]): BuildOptions {
  const options: BuildOptions = {
    outfile: resolve(process.cwd(), "dist/clawos.exe"),
    skipCss: false,
    target: "bun-windows-x64-modern",
    bumpPatch: true,
    fixedVersion: null,
  };

  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--skip-css") {
      options.skipCss = true;
      continue;
    }

    if (arg === "--no-bump-patch") {
      options.bumpPatch = false;
      continue;
    }

    if (arg === "--outfile") {
      const value = args.shift();
      if (!value) {
        throw new Error("--outfile 缺少路径参数");
      }
      options.outfile = resolve(process.cwd(), value);
      continue;
    }

    if (arg === "--target") {
      const value = args.shift();
      if (!value) {
        throw new Error("--target 缺少参数");
      }
      options.target = value.trim();
      continue;
    }

    if (arg === "--version") {
      const value = args.shift();
      if (!value) {
        throw new Error("--version 缺少参数");
      }
      options.fixedVersion = value.trim();
      continue;
    }

    throw new Error(`未知参数: ${arg}`);
  }

  return options;
}

async function runStep(title: string, cmd: string[]): Promise<void> {
  console.log(`[build] ${title}`);
  const proc = Bun.spawn({
    cmd,
    cwd: process.cwd(),
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`${title} 失败，退出码 ${code}`);
  }
}

async function assertOutputFile(path: string): Promise<number> {
  await access(path, fsConstants.R_OK);
  const info = await stat(path);
  return info.size;
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  const kb = size / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

const PACKAGE_JSON_PATH = resolve(process.cwd(), "package.json");
const XIAKE_CONFIG_PATH = resolve(process.cwd(), "clawos_xiake.json");
const APP_CONSTANTS_PATH = resolve(process.cwd(), "src/app.constants.ts");
const DEFAULT_WINDOWS_ICON_PATH = resolve(process.cwd(), "web/public/logo.png");
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function normalizeSemver(value: string): string {
  const normalized = value.trim().replace(/^v/i, "");
  if (!SEMVER_PATTERN.test(normalized)) {
    throw new Error(`版本号格式不合法：${value}（期望 x.y.z）`);
  }
  return normalized;
}

function bumpPatchVersion(version: string): string {
  const normalized = normalizeSemver(version);
  const [majorRaw, minorRaw, patchRaw] = normalized.split(".");
  const major = Number.parseInt(majorRaw, 10);
  const minor = Number.parseInt(minorRaw, 10);
  const patch = Number.parseInt(patchRaw, 10);
  return `${major}.${minor}.${patch + 1}`;
}

function compareSemver(a: string, b: string): number {
  const aParts = normalizeSemver(a).split(".").map((part) => Number.parseInt(part, 10));
  const bParts = normalizeSemver(b).split(".").map((part) => Number.parseInt(part, 10));
  for (let i = 0; i < 3; i += 1) {
    if (aParts[i] > bParts[i]) {
      return 1;
    }
    if (aParts[i] < bParts[i]) {
      return -1;
    }
  }
  return 0;
}

function maxSemver(versions: string[]): string {
  if (versions.length === 0) {
    throw new Error("未提供可比较的版本号。");
  }
  return versions.reduce((max, current) => (compareSemver(current, max) > 0 ? current : max));
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function replaceAppConstantsVersion(source: string, version: string): string {
  const next = source.replace(
    /export const VERSION = "([^"]+)";/,
    `export const VERSION = "${version}";`
  );

  if (next === source) {
    throw new Error("未找到 src/app.constants.ts 中的 VERSION 常量。");
  }
  return next;
}

function readAppConstantsVersion(source: string): string {
  const match = source.match(/export const VERSION = "([^"]+)";/);
  if (!match) {
    throw new Error("未找到 src/app.constants.ts 中的 VERSION 常量。");
  }
  return normalizeSemver(match[1]);
}

async function syncBuildVersion(options: BuildOptions): Promise<string> {
  const packageRaw = await readFile(PACKAGE_JSON_PATH, "utf-8");
  const packageJson = JSON.parse(packageRaw) as Record<string, unknown>;
  const packageVersion =
    typeof packageJson.version === "string" && packageJson.version.trim()
      ? normalizeSemver(packageJson.version.trim())
      : "";
  if (!packageVersion) {
    throw new Error("package.json 缺少 version 字段。");
  }

  const xiakeRaw = await readFile(XIAKE_CONFIG_PATH, "utf-8");
  const xiakeJson = JSON.parse(xiakeRaw) as Record<string, unknown>;
  const appConstantsRaw = await readFile(APP_CONSTANTS_PATH, "utf-8");
  const xiakeVersion =
    typeof xiakeJson.version === "string" && xiakeJson.version.trim()
      ? normalizeSemver(xiakeJson.version.trim())
      : "";
  if (!xiakeVersion) {
    throw new Error("clawos_xiake.json 缺少 version 字段。");
  }
  const appConstantsVersion = readAppConstantsVersion(appConstantsRaw);
  const baseVersion = maxSemver([packageVersion, xiakeVersion, appConstantsVersion]);

  const targetVersion = options.fixedVersion
    ? normalizeSemver(options.fixedVersion)
    : options.bumpPatch
      ? bumpPatchVersion(baseVersion)
      : baseVersion;

  packageJson.version = targetVersion;
  xiakeJson.version = targetVersion;
  const nextAppConstants = replaceAppConstantsVersion(appConstantsRaw, targetVersion);

  await Promise.all([
    writeJsonFile(PACKAGE_JSON_PATH, packageJson),
    writeJsonFile(XIAKE_CONFIG_PATH, xiakeJson),
    writeFile(APP_CONSTANTS_PATH, nextAppConstants, "utf-8"),
  ]);

  console.log(
    `[build] 版本基准: package.json=${packageVersion}, clawos_xiake.json=${xiakeVersion}, app.constants=${appConstantsVersion}`
  );
  console.log(`[build] 版本同步: ${baseVersion} -> ${targetVersion}`);
  return targetVersion;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(dirname(options.outfile), { recursive: true });
  const syncedVersion = await syncBuildVersion(options);

  console.log(`[build] 输出文件: ${options.outfile}`);
  console.log(`[build] 编译目标: ${options.target}`);
  console.log(`[build] 当前构建版本: ${syncedVersion}`);

  if (!options.skipCss) {
    await runStep("构建 UI 样式", ["bun", "run", "tailwind:build"]);
  } else {
    console.log("[build] 跳过 UI 样式构建 (--skip-css)");
  }

  const compileCmd = [
    "bun",
    "build",
    "src/server.ts",
    "--compile",
    "--target",
    options.target,
    "--outfile",
    options.outfile,
  ];

  if (options.target.toLowerCase().includes("windows")) {
    try {
      await access(DEFAULT_WINDOWS_ICON_PATH, fsConstants.R_OK);
      compileCmd.push("--windows-icon", DEFAULT_WINDOWS_ICON_PATH);
      console.log(`[build] 程序图标: ${DEFAULT_WINDOWS_ICON_PATH}`);
    } catch {
      console.warn(`[build] 未找到图标文件，跳过 --windows-icon: ${DEFAULT_WINDOWS_ICON_PATH}`);
    }
  }

  await runStep("编译 ClawOS 可执行文件", compileCmd);

  const size = await assertOutputFile(options.outfile);
  console.log(`[build] 打包完成: ${options.outfile}`);
  console.log(`[build] 文件大小: ${formatBytes(size)}`);
}

main().catch((error) => {
  console.error(`[build] 失败: ${(error as Error).message}`);
  process.exit(1);
});
