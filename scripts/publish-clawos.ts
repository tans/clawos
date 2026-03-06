import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, resolve } from "node:path";

type PublishPlatform = "windows" | "macos" | "linux";
const VERSION_PATTERN = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/;

interface Options {
  baseUrl: string;
  token: string;
  installerPath: string;
  installerPathExplicit: boolean;
  installerPlatform: PublishPlatform | null;
  installerPathsByPlatform: Partial<Record<PublishPlatform, string>>;
  configPath: string;
  version?: string;
  skipInstaller: boolean;
  skipConfig: boolean;
  timeoutMs: number;
  heartbeatMs: number;
}

function printUsage(): void {
  console.log(`ClawOS 发布脚本

用法:
  bun run scripts/publish-clawos.ts [options]

选项:
  --base-url <url>      发布站点，默认 https://clawos.minapp.xin
  --token <token>       上传 Token，默认读取 UPLOAD_TOKEN，未设置则使用 clawos
  --installer <path>    安装包路径，默认 ./dist/clawos.exe
  --installer-platform <platform>
                        --installer 对应平台：windows/macos/linux（默认自动识别，识别失败回退 windows）
  --installer-win <p>   Windows 安装包路径（可与其它平台一起上传）
  --installer-macos <p> macOS 安装包路径（可与其它平台一起上传）
  --installer-linux <p> Linux 安装包路径（可与其它平台一起上传）
  --config <path>       配置文件路径，默认 ./clawos_xiake.json
  --version <version>   安装包版本（可选）
  --skip-installer      跳过安装包上传
  --skip-config         跳过配置文件上传
  --timeout-ms <ms>     单次上传超时，默认 600000（10 分钟）
  --heartbeat-ms <ms>   上传心跳日志间隔，默认 15000（15 秒）
  -h, --help            显示帮助

环境变量（可替代部分参数）:
  CLAWOS_PUBLISH_BASE_URL
  CLAWOS_UPLOAD_TOKEN（或 UPLOAD_TOKEN）
  CLAWOS_INSTALLER_PATH
  CLAWOS_INSTALLER_WIN / CLAWOS_INSTALLER_MACOS / CLAWOS_INSTALLER_LINUX
  CLAWOS_CONFIG_PATH
  CLAWOS_VERSION
`);
}

function resolvePathFromEnv(raw: string | undefined, fallbackPath: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return fallbackPath;
  }
  return resolve(process.cwd(), trimmed);
}

function parseArgs(argv: string[]): Options {
  const installerPathFromEnv = resolvePathFromEnv(process.env.CLAWOS_INSTALLER_PATH, resolve(process.cwd(), "dist/clawos.exe"));
  const configPathFromEnv = resolvePathFromEnv(process.env.CLAWOS_CONFIG_PATH, resolve(process.cwd(), "clawos_xiake.json"));
  const args = [...argv];
  const opts: Options = {
    baseUrl: process.env.CLAWOS_PUBLISH_BASE_URL?.trim().replace(/\/+$/, "") || "https://clawos.minapp.xin",
    token: process.env.CLAWOS_UPLOAD_TOKEN?.trim() || process.env.UPLOAD_TOKEN?.trim() || "clawos",
    installerPath: installerPathFromEnv,
    installerPathExplicit: false,
    installerPlatform: null,
    installerPathsByPlatform: {
      windows: process.env.CLAWOS_INSTALLER_WIN?.trim() ? resolve(process.cwd(), process.env.CLAWOS_INSTALLER_WIN.trim()) : undefined,
      macos: process.env.CLAWOS_INSTALLER_MACOS?.trim() ? resolve(process.cwd(), process.env.CLAWOS_INSTALLER_MACOS.trim()) : undefined,
      linux: process.env.CLAWOS_INSTALLER_LINUX?.trim() ? resolve(process.cwd(), process.env.CLAWOS_INSTALLER_LINUX.trim()) : undefined,
    },
    configPath: configPathFromEnv,
    version: process.env.CLAWOS_VERSION?.trim() || undefined,
    skipInstaller: false,
    skipConfig: false,
    timeoutMs: Number.parseInt(process.env.UPLOAD_TIMEOUT_MS || "", 10) || 10 * 60 * 1000,
    heartbeatMs: Number.parseInt(process.env.UPLOAD_HEARTBEAT_MS || "", 10) || 15 * 1000,
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--skip-installer") {
      opts.skipInstaller = true;
      continue;
    }

    if (arg === "--skip-config") {
      opts.skipConfig = true;
      continue;
    }

    const value = args.shift();
    if (!value) {
      throw new Error(`参数缺少值: ${arg}`);
    }

    switch (arg) {
      case "--base-url":
        opts.baseUrl = value.trim().replace(/\/+$/, "");
        break;
      case "--token":
        opts.token = value.trim();
        break;
      case "--installer":
        opts.installerPath = resolve(process.cwd(), value);
        opts.installerPathExplicit = true;
        break;
      case "--installer-platform":
        opts.installerPlatform = parsePublishPlatform(value, "--installer-platform");
        break;
      case "--installer-win":
        opts.installerPathsByPlatform.windows = resolve(process.cwd(), value);
        break;
      case "--installer-macos":
        opts.installerPathsByPlatform.macos = resolve(process.cwd(), value);
        break;
      case "--installer-linux":
        opts.installerPathsByPlatform.linux = resolve(process.cwd(), value);
        break;
      case "--config":
        opts.configPath = resolve(process.cwd(), value);
        break;
      case "--version":
        opts.version = value.trim();
        break;
      case "--timeout-ms":
        opts.timeoutMs = Number.parseInt(value, 10);
        break;
      case "--heartbeat-ms":
        opts.heartbeatMs = Number.parseInt(value, 10);
        break;
      default:
        throw new Error(`未知参数: ${arg}`);
    }
  }

  if (!opts.token) {
    throw new Error("UPLOAD_TOKEN 为空，请通过 --token 或环境变量设置。");
  }

  if (opts.skipInstaller && opts.skipConfig) {
    throw new Error("不能同时跳过 installer 和 config。");
  }

  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
    throw new Error(`--timeout-ms 非法: ${opts.timeoutMs}`);
  }
  if (!Number.isFinite(opts.heartbeatMs) || opts.heartbeatMs <= 0) {
    throw new Error(`--heartbeat-ms 非法: ${opts.heartbeatMs}`);
  }

  return opts;
}

function parsePublishPlatform(raw: string, flagName: string): PublishPlatform {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "windows" || normalized === "win" || normalized === "win32") {
    return "windows";
  }
  if (normalized === "macos" || normalized === "darwin" || normalized === "mac" || normalized === "osx") {
    return "macos";
  }
  if (normalized === "linux") {
    return "linux";
  }
  throw new Error(`${flagName} 非法值：${raw}（仅支持 windows/macos/linux）`);
}

function inferPublishPlatformFromInstallerPath(filePath: string): PublishPlatform | null {
  const lower = basename(filePath).toLowerCase();
  if (lower.endsWith(".exe") || lower.endsWith(".msi")) {
    return "windows";
  }
  if (lower.endsWith(".dmg") || lower.endsWith(".pkg")) {
    return "macos";
  }
  if (lower.endsWith(".appimage") || lower.endsWith(".deb") || lower.endsWith(".rpm") || lower.endsWith(".tar.gz")) {
    return "linux";
  }
  return null;
}

type InstallerUploadSpec = {
  platform: PublishPlatform;
  filePath: string;
};

function setInstallerSpec(merged: Map<PublishPlatform, string>, platform: PublishPlatform, filePath: string, source: string): void {
  const existing = merged.get(platform);
  if (existing && existing !== filePath) {
    throw new Error(`安装包参数冲突：平台 ${platform} 同时指向两个文件\n已设置: ${existing}\n冲突来源(${source}): ${filePath}`);
  }
  merged.set(platform, filePath);
}

function buildInstallerUploads(opts: Options): InstallerUploadSpec[] {
  const merged = new Map<PublishPlatform, string>();
  for (const platform of Object.keys(opts.installerPathsByPlatform) as PublishPlatform[]) {
    const filePath = opts.installerPathsByPlatform[platform];
    if (filePath) {
      setInstallerSpec(merged, platform, filePath, `--installer-${platform}`);
    }
  }

  if (opts.installerPathExplicit || merged.size === 0) {
    const platform = opts.installerPlatform || inferPublishPlatformFromInstallerPath(opts.installerPath) || "windows";
    setInstallerSpec(merged, platform, opts.installerPath, "--installer");
  }

  return Array.from(merged.entries()).map(([platform, filePath]) => ({ platform, filePath }));
}

async function assertFileReadable(filePath: string, label: string): Promise<void> {
  try {
    await access(filePath, fsConstants.R_OK);
  } catch {
    throw new Error(`${label}文件不可读或不存在: ${filePath}`);
  }
}

async function detectVersionFromPackageJson(): Promise<string | undefined> {
  try {
    const pkgRaw = await readFile(resolve(process.cwd(), "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw) as { version?: unknown };
    return typeof pkg.version === "string" && pkg.version.trim() ? pkg.version.trim() : undefined;
  } catch {
    return undefined;
  }
}

function detectVersionFromInstallerPath(filePath: string): string | null {
  const name = basename(filePath);
  const match = name.match(VERSION_PATTERN);
  return match?.[1] ?? null;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

async function resolvePublishVersion(opts: Options, installers: InstallerUploadSpec[]): Promise<string | undefined> {
  if (opts.version) {
    const target = opts.version.trim().replace(/^v/i, "");
    if (!target) {
      return undefined;
    }
    const versionsInNames = unique(
      installers
        .map((item) => detectVersionFromInstallerPath(item.filePath))
        .filter((value): value is string => Boolean(value))
        .map((value) => value.replace(/^v/i, ""))
    );
    const mismatch = versionsInNames.find((value) => value !== target);
    if (mismatch) {
      throw new Error(`版本冲突：参数 --version=${target}，但安装包文件名中检测到版本 ${mismatch}。请统一后再发布。`);
    }
    return target;
  }

  const versionsInNames = unique(
    installers
      .map((item) => detectVersionFromInstallerPath(item.filePath))
      .filter((value): value is string => Boolean(value))
      .map((value) => value.replace(/^v/i, ""))
  );
  if (versionsInNames.length > 1) {
    throw new Error(`安装包文件名包含多个版本：${versionsInNames.join(", ")}。请用 --version 指定唯一版本。`);
  }
  if (versionsInNames.length === 1) {
    return versionsInNames[0];
  }

  return await detectVersionFromPackageJson();
}

async function uploadFile(params: {
  endpoint: string;
  filePath: string;
  token: string;
  baseUrl: string;
  version?: string;
  platform?: PublishPlatform;
  timeoutMs: number;
  heartbeatMs: number;
}): Promise<Record<string, unknown>> {
  const file = Bun.file(params.filePath);
  const fileSize = file.size;
  const form = new FormData();
  form.append("file", file, basename(params.filePath));
  if (params.version) {
    form.append("version", params.version);
  }
  if (params.platform) {
    form.append("platform", params.platform);
  }

  const endpointUrl = new URL(`${params.baseUrl}${params.endpoint}`);
  if (params.platform) {
    endpointUrl.searchParams.set("platform", params.platform);
  }
  const url = endpointUrl.toString();
  console.log(`[publish] 开始上传: ${basename(params.filePath)} (${formatBytes(fileSize)}) -> ${url}`);

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, params.timeoutMs);
  const heartbeatHandle = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    console.log(`[publish] 上传中: ${basename(params.filePath)}，已耗时 ${formatDuration(elapsed)}...`);
  }, params.heartbeatMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.token}`,
        ...(params.platform ? { "x-platform": params.platform } : {}),
      },
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    if (controller.signal.aborted) {
      throw new Error(
        `上传超时: ${url}\n文件: ${basename(params.filePath)} (${formatBytes(fileSize)})\n已耗时: ${formatDuration(elapsed)}\n超时阈值: ${formatDuration(params.timeoutMs)}`
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`请求失败: ${url}\n${message}`);
  } finally {
    clearTimeout(timeoutHandle);
    clearInterval(heartbeatHandle);
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`上传接口返回非 JSON: ${url}\n${text}`);
  }

  if (!res.ok || data.ok !== true) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    throw new Error(`上传失败: ${url}\n${err}`);
  }

  const elapsed = Date.now() - startedAt;
  console.log(
    `[publish] 上传完成: ${basename(params.filePath)} (${formatBytes(fileSize)}), HTTP ${res.status}, 耗时 ${formatDuration(elapsed)}`
  );

  return data;
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
  if (mb < 1024) {
    return `${mb.toFixed(2)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m${seconds}s`;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const installerUploads = opts.skipInstaller ? [] : buildInstallerUploads(opts);
  if (!opts.skipInstaller) {
    opts.version = await resolvePublishVersion(opts, installerUploads);
  }

  console.log(`[publish] base url: ${opts.baseUrl}`);
  console.log(`[publish] token: ${opts.token === "clawos" ? "clawos (default)" : "***"}`);
  console.log(`[publish] timeout: ${formatDuration(opts.timeoutMs)}`);
  console.log(`[publish] heartbeat: ${formatDuration(opts.heartbeatMs)}`);
  if (opts.version) {
    console.log(`[publish] version: ${opts.version}`);
  }
  const uploadedSummaries: Array<{ kind: "installer" | "config"; platform?: PublishPlatform; fileName: string; url: string }> = [];

  if (!opts.skipInstaller) {
    if (installerUploads.length === 0) {
      throw new Error("未找到可上传的安装包，请提供 --installer 或 --installer-<platform> 参数。");
    }

    for (const item of installerUploads) {
      await assertFileReadable(item.filePath, `${item.platform} 安装包`);
      console.log(`[publish] 上传安装包(${item.platform}): ${item.filePath}`);
      const result = await uploadFile({
        endpoint: "/api/upload/installer",
        filePath: item.filePath,
        token: opts.token,
        baseUrl: opts.baseUrl,
        version: opts.version,
        platform: item.platform,
        timeoutMs: opts.timeoutMs,
        heartbeatMs: opts.heartbeatMs,
      });
      console.log(
        `[publish] 安装包上传成功(${item.platform}): ${String(result.fileName || "unknown")} -> ${String(result.url || "")}`
      );
      uploadedSummaries.push({
        kind: "installer",
        platform: item.platform,
        fileName: String(result.fileName || "unknown"),
        url: String(result.url || ""),
      });
    }
  }

  if (!opts.skipConfig) {
    await assertFileReadable(opts.configPath, "配置");
    console.log(`[publish] 上传配置文件: ${opts.configPath}`);
    const result = await uploadFile({
      endpoint: "/api/upload/xiake-config",
      filePath: opts.configPath,
      token: opts.token,
      baseUrl: opts.baseUrl,
      timeoutMs: opts.timeoutMs,
      heartbeatMs: opts.heartbeatMs,
    });
    console.log(`[publish] 配置文件上传成功: ${String(result.fileName || "unknown")}`);
    uploadedSummaries.push({
      kind: "config",
      fileName: String(result.fileName || "unknown"),
      url: String(result.url || ""),
    });
  }

  if (uploadedSummaries.length > 0) {
    console.log("[publish] 上传汇总:");
    for (const item of uploadedSummaries) {
      if (item.kind === "installer") {
        console.log(`[publish]   installer(${item.platform}): ${item.fileName} -> ${item.url}`);
      } else {
        console.log(`[publish]   config: ${item.fileName} -> ${item.url}`);
      }
    }
  }

  console.log("[publish] 发布完成。");
}

main().catch((error) => {
  console.error(`[publish] 失败: ${(error as Error).message}`);
  process.exit(1);
});
