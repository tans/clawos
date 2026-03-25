import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type BuildEnv = "dev" | "canary" | "stable";
type ReleaseChannel = "stable" | "beta" | "canary";

type Options = {
  env: BuildEnv;
  releaseChannel: ReleaseChannel;
  skipBuild: boolean;
  skipPublish: boolean;
  bumpPatch: boolean;
  fixedVersion: string | null;
  publishArgs: string[];
};

type StepOptions = {
  cwd?: string;
};

const PACKAGE_JSON_PATH = resolve(process.cwd(), "app/package.json");
const APP_CONSTANTS_PATH = resolve(process.cwd(), "app/shared/constants/app.ts");
const XIAKE_CONFIG_PATH = resolve(process.cwd(), "app/clawos_xiake.json");
const SHELL_HTML_PATH = resolve(process.cwd(), "app/webview/shell.html");
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:\.\d+)?$/;

function parseEnv(raw: string | undefined): BuildEnv {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "dev" || value === "canary" || value === "stable") {
    return value;
  }
  return "stable";
}

function parseReleaseChannel(raw: string | undefined): ReleaseChannel {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "canary" || value === "beta" || value === "stable") {
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
  --release-channel <channel> 发布通道 stable/beta/canary，默认 stable
  --no-bump-patch    不自动递增版本号
  --version <ver>    指定发布版本 (x.y.z 或 x.y.z.w)
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
    releaseChannel: parseReleaseChannel(process.env.CLAWOS_RELEASE_CHANNEL),
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

    if (arg.startsWith("--release-channel=")) {
      options.releaseChannel = parseReleaseChannel(arg.slice("--release-channel=".length));
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

    if (arg === "--release-channel") {
      const value = args.shift();
      if (!value) {
        throw new Error("--release-channel 缺少参数");
      }
      options.releaseChannel = parseReleaseChannel(value);
      continue;
    }

    options.publishArgs.push(arg);
  }

  return options;
}

function normalizeSemver(value: string): string {
  const normalized = value.trim().replace(/^v/i, "");
  if (!SEMVER_PATTERN.test(normalized)) {
    throw new Error(`版本号格式不合法: ${value}，期望 x.y.z 或 x.y.z.w`);
  }
  return normalized;
}

function parseVersionParts(version: string): [number, number, number, number] {
  const normalized = normalizeSemver(version);
  const [majorRaw, minorRaw, patchRaw, buildRaw] = normalized.split(".");
  const major = Number.parseInt(majorRaw, 10);
  const minor = Number.parseInt(minorRaw, 10);
  const patch = Number.parseInt(patchRaw, 10);
  const build = Number.parseInt(buildRaw || "0", 10);
  return [major, minor, patch, build];
}

function bumpVersion(version: string, channel: ReleaseChannel): string {
  const [major, minor, patch, build] = parseVersionParts(version);
  if (channel === "canary") {
    return `${major}.${minor}.${patch}.${build + 1}`;
  }
  if (channel === "beta") {
    return `${major}.${minor}.${patch + 1}.0`;
  }
  return `${major}.${minor + 1}.0.0`;
}

function resolveReleaseChannel(options: Options): ReleaseChannel {
  let channel = options.releaseChannel;
  const args = options.publishArgs;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--release-channel=")) {
      channel = parseReleaseChannel(arg.slice("--release-channel=".length));
      continue;
    }
    if (arg === "--release-channel" && args[i + 1]) {
      channel = parseReleaseChannel(args[i + 1]);
      i += 1;
    }
  }
  return channel;
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
  const channel = resolveReleaseChannel(options);

  if (options.skipBuild) {
    if (options.fixedVersion) {
      const fixed = normalizeSemver(options.fixedVersion);
      console.log(`[release] --skip-build 已启用，忽略 --version=${fixed}，使用现有版本 ${currentVersion}`);
    }
    if (options.bumpPatch) {
      console.log(`[release] --skip-build 已启用，不执行自动版本递增，使用现有版本 ${currentVersion}`);
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

  const bumped = bumpVersion(currentVersion, channel);
  await syncVersionFiles(bumped);
  return { version: bumped, changed: true };
}

async function runStep(name: string, cmd: string[], stepOptions?: StepOptions): Promise<void> {
  console.log(`[release] ${name}`);
  console.log(`[release] cmd: ${cmd.join(" ")}`);
  if (stepOptions?.cwd) {
    console.log(`[release] cwd: ${stepOptions.cwd}`);
  }

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(cmd[0], cmd.slice(1), {
      cwd: stepOptions?.cwd || process.cwd(),
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
  options.releaseChannel = resolveReleaseChannel(options);
  const releaseVersion = await resolveReleaseVersion(options);

  console.log(`[release] build env: ${options.env}`);
  console.log(`[release] release channel: ${options.releaseChannel}`);
  console.log(`[release] release version: ${releaseVersion.version}`);
  if (releaseVersion.changed) {
    console.log("[release] version files updated: app/package.json + app/shared/constants/app.ts + app/clawos_xiake.json + app/webview/shell.html");
  }
  if (options.skipBuild) {
    console.log("[release] 跳过构建 (--skip-build)");
  }
  if (options.skipPublish) {
    console.log("[release] 跳过发布 (--skip-publish)");
  }

  if (!options.skipBuild) {
    const appDir = resolve(process.cwd(), "app");
    await runStep("Build Webview", ["bun", "run", "webview:build"], { cwd: appDir });
    await runStep("Build Electrobun", ["bun", "run", "scripts/electrobun.ts", "build", `--env=${options.env}`], {
      cwd: appDir,
    });
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
