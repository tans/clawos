import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type BuildEnv = "dev" | "canary" | "stable";

type Options = {
  env: BuildEnv;
  skipBuild: boolean;
  skipPublish: boolean;
  bumpPatch: boolean;
  fixedVersion: string | null;
  publishArgs: string[];
};

const PACKAGE_JSON_PATH = resolve(process.cwd(), "package.json");
const APP_CONSTANTS_PATH = resolve(process.cwd(), "app/src/app.constants.ts");
const XIAKE_CONFIG_PATH = resolve(process.cwd(), "clawos_xiake.json");
const SHELL_HTML_PATH = resolve(process.cwd(), "app/src/desktop-ui/shell.html");
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function parseEnv(raw: string | undefined): BuildEnv {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "dev" || value === "canary" || value === "stable") {
    return value;
  }
  return "stable";
}

function printUsage(): void {
  console.log(`ClawOS Electrobun 一键构建发布

用法:
  bun run scripts/release-clawos.ts [options] [-- <publish args>]

选项:
  --env <env>        构建环境: dev/canary/stable，默认 stable
  --skip-build       跳过构建，仅执行发布
  --skip-publish     仅构建，不发布
  --no-bump-patch    不自动递增 patch 版本号
  --version <ver>    指定发布版本 (x.y.z)
  -h, --help         显示帮助

示例:
  bun run scripts/release-clawos.ts --env=stable
  bun run scripts/release-clawos.ts --version=0.3.2
  bun run scripts/release-clawos.ts --env=stable -- --skip-config
  bun run scripts/release-clawos.ts --env=canary -- --release-channel=beta
  bun run scripts/release-clawos.ts --skip-build -- --installer artifacts/stable-win-x64-ClawOS-Setup.zip
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    env: parseEnv(process.env.CLAWOS_BUILD_ENV),
    skipBuild: false,
    skipPublish: false,
    bumpPatch: true,
    fixedVersion: null,
    publishArgs: [],
  };

  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (arg === "--") {
      options.publishArgs.push(...args);
      break;
    }

    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--skip-build") {
      options.skipBuild = true;
      continue;
    }

    if (arg === "--skip-publish") {
      options.skipPublish = true;
      continue;
    }

    if (arg === "--no-bump-patch") {
      options.bumpPatch = false;
      continue;
    }

    if (arg.startsWith("--version=")) {
      options.fixedVersion = arg.slice("--version=".length).trim();
      continue;
    }

    if (arg.startsWith("--env=")) {
      options.env = parseEnv(arg.slice("--env=".length));
      continue;
    }

    if (arg === "--env") {
      const value = args.shift();
      if (!value) {
        throw new Error("--env 缺少参数");
      }
      options.env = parseEnv(value);
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

    options.publishArgs.push(arg);
  }

  return options;
}

function normalizeSemver(value: string): string {
  const normalized = value.trim().replace(/^v/i, "");
  if (!SEMVER_PATTERN.test(normalized)) {
    throw new Error(`版本号格式不合法: ${value}，期望 x.y.z`);
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

async function readCurrentVersion(): Promise<string> {
  const pkgRaw = await readFile(PACKAGE_JSON_PATH, "utf-8");
  const pkg = JSON.parse(pkgRaw) as { version?: unknown };
  if (typeof pkg.version !== "string" || !pkg.version.trim()) {
    throw new Error("package.json 缺少合法 version 字段");
  }
  return normalizeSemver(pkg.version);
}

async function readAppConstantsVersion(): Promise<string> {
  const source = await readFile(APP_CONSTANTS_PATH, "utf-8");
  const versionLinePattern = /^export const VERSION = "([^"]+)";$/m;
  const match = source.match(versionLinePattern);
  if (!match) {
    throw new Error(`未在 ${APP_CONSTANTS_PATH} 找到 VERSION 常量`);
  }
  return normalizeSemver(match[1]);
}

async function readXiakeConfigVersion(): Promise<string> {
  const source = await readFile(XIAKE_CONFIG_PATH, "utf-8");
  const parsed = JSON.parse(source) as { version?: unknown };
  if (typeof parsed.version !== "string" || !parsed.version.trim()) {
    throw new Error(`${XIAKE_CONFIG_PATH} 缺少合法 version 字段`);
  }
  return normalizeSemver(parsed.version);
}

async function readShellHtmlVersion(): Promise<string> {
  const source = await readFile(SHELL_HTML_PATH, "utf-8");
  const match = source.match(/<p class="version" data-boot-version>v([^<]+)<\/p>/);
  if (!match) {
    throw new Error(`未在 ${SHELL_HTML_PATH} 找到启动页版本号`);
  }
  return normalizeSemver(match[1]);
}

async function writePackageVersion(nextVersion: string): Promise<void> {
  const pkgRaw = await readFile(PACKAGE_JSON_PATH, "utf-8");
  const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
  pkg.version = nextVersion;
  await writeFile(PACKAGE_JSON_PATH, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
}

async function writeAppConstantsVersion(nextVersion: string): Promise<void> {
  const source = await readFile(APP_CONSTANTS_PATH, "utf-8");
  const versionLinePattern = /^export const VERSION = "([^"]+)";$/m;
  const match = source.match(versionLinePattern);
  if (!match) {
    throw new Error(`未在 ${APP_CONSTANTS_PATH} 找到 VERSION 常量`);
  }

  const replaced = source.replace(versionLinePattern, `export const VERSION = "${nextVersion}";`);
  await writeFile(APP_CONSTANTS_PATH, replaced, "utf-8");
}

async function writeXiakeConfigVersion(nextVersion: string): Promise<void> {
  const source = await readFile(XIAKE_CONFIG_PATH, "utf-8");
  const parsed = JSON.parse(source) as Record<string, unknown>;
  parsed.version = nextVersion;
  await writeFile(XIAKE_CONFIG_PATH, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");
}

async function writeShellHtmlVersion(nextVersion: string): Promise<void> {
  const source = await readFile(SHELL_HTML_PATH, "utf-8");
  const replaced = source.replace(
    /<p class="version" data-boot-version>v[^<]+<\/p>/,
    `<p class="version" data-boot-version>v${nextVersion}</p>`
  );
  if (replaced === source) {
    throw new Error(`未在 ${SHELL_HTML_PATH} 找到可替换的启动页版本号`);
  }
  await writeFile(SHELL_HTML_PATH, replaced, "utf-8");
}

async function hasVersionDrift(targetVersion: string): Promise<boolean> {
  const [pkgVersion, appVersion, xiakeVersion, shellVersion] = await Promise.all([
    readCurrentVersion(),
    readAppConstantsVersion(),
    readXiakeConfigVersion(),
    readShellHtmlVersion(),
  ]);

  return (
    pkgVersion !== targetVersion ||
    appVersion !== targetVersion ||
    xiakeVersion !== targetVersion ||
    shellVersion !== targetVersion
  );
}

async function syncVersionFiles(nextVersion: string): Promise<void> {
  await Promise.all([
    writePackageVersion(nextVersion),
    writeAppConstantsVersion(nextVersion),
    writeXiakeConfigVersion(nextVersion),
    writeShellHtmlVersion(nextVersion),
  ]);
}

async function resolveReleaseVersion(options: Options): Promise<{ version: string; changed: boolean }> {
  const currentVersion = await readCurrentVersion();

  if (options.skipBuild) {
    if (options.fixedVersion) {
      const fixed = normalizeSemver(options.fixedVersion);
      console.log(`[release] --skip-build 已启用，忽略 --version=${fixed}，使用现有版本 ${currentVersion}`);
    }
    if (options.bumpPatch) {
      console.log(`[release] --skip-build 已启用，不执行 patch 递增，使用现有版本 ${currentVersion}`);
    }
    return { version: currentVersion, changed: false };
  }

  if (options.fixedVersion) {
    const fixed = normalizeSemver(options.fixedVersion);
    if (fixed !== currentVersion || (await hasVersionDrift(fixed))) {
      await syncVersionFiles(fixed);
      return { version: fixed, changed: true };
    }
    return { version: fixed, changed: false };
  }

  if (!options.bumpPatch) {
    if (await hasVersionDrift(currentVersion)) {
      await syncVersionFiles(currentVersion);
      return { version: currentVersion, changed: true };
    }
    return { version: currentVersion, changed: false };
  }

  const bumped = bumpPatchVersion(currentVersion);
  await syncVersionFiles(bumped);
  return { version: bumped, changed: true };
}

async function runStep(name: string, cmd: string[]): Promise<void> {
  console.log(`[release] ${name}`);
  console.log(`[release] cmd: ${cmd.join(" ")}`);

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(cmd[0], cmd.slice(1), {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${name} 失败，退出码 ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const releaseVersion = await resolveReleaseVersion(options);

  console.log(`[release] build env: ${options.env}`);
  console.log(`[release] release version: ${releaseVersion.version}`);
  if (releaseVersion.changed) {
    console.log("[release] version files updated: package.json + app/src/app.constants.ts + clawos_xiake.json + app/src/desktop-ui/shell.html");
  }
  if (options.skipBuild) {
    console.log("[release] 跳过构建 (--skip-build)");
  }
  if (options.skipPublish) {
    console.log("[release] 跳过发布 (--skip-publish)");
  }

  if (!options.skipBuild) {
    await runStep("构建 UI 样式", ["bun", "run", "tailwind:build"]);
    await runStep("构建 Electrobun", ["bun", "run", "scripts/electrobun.ts", "build", `--env=${options.env}`]);
  }

  if (!options.skipPublish) {
    const publishCmd = [
      "bun",
      "run",
      "scripts/publish-clawos.ts",
      `--build-env=${options.env}`,
      `--version=${releaseVersion.version}`,
      ...options.publishArgs,
    ];
    await runStep("发布安装包、配置和更新产物", publishCmd);
  }

  console.log("[release] 完成");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release] 失败: ${message}`);
  process.exit(1);
});
