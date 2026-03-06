import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

type PublishPlatform = "windows" | "macos" | "linux";
const VERSION_PATTERN = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/;

interface Options {
  baseUrl: string;
  token: string;
  installerPath: string;
  configPath: string;
  version?: string;
  skipInstaller: boolean;
  skipConfig: boolean;
  timeoutMs: number;
  heartbeatMs: number;
}

function resolveHostPublishPlatform(): PublishPlatform {
  if (process.platform === "win32") {
    return "windows";
  }
  if (process.platform === "darwin") {
    return "macos";
  }
  return "linux";
}

function defaultInstallerFileName(platform: PublishPlatform): string {
  if (platform === "windows") {
    return "clawos.exe";
  }
  if (platform === "macos") {
    return "clawos.dmg";
  }
  return "clawos.AppImage";
}

function allowedInstallerExt(platform: PublishPlatform): string[] {
  if (platform === "windows") {
    return [".exe", ".msi", ".zip"];
  }
  if (platform === "macos") {
    return [".dmg", ".pkg", ".zip"];
  }
  return [".appimage", ".deb", ".rpm", ".tar.gz", ".zip"];
}

function defaultInstallerPath(platform: PublishPlatform): string {
  return resolve(process.cwd(), "dist", defaultInstallerFileName(platform));
}

function printUsage(): void {
  const platform = resolveHostPublishPlatform();
  console.log(`ClawOS 发布脚本

用法:
  bun run scripts/publish-clawos.ts [options]

当前平台:
  ${platform}（自动判定，不需要手动指定平台参数）

选项:
  --base-url <url>      发布站点，默认 https://clawos.minapp.xin
  --token <token>       上传 Token，默认读取 UPLOAD_TOKEN，未设置则使用 clawos
  --installer <path>    安装包路径，默认 ./dist/${defaultInstallerFileName(platform)}
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
  const hostPlatform = resolveHostPublishPlatform();
  const args = [...argv];
  const opts: Options = {
    baseUrl: process.env.CLAWOS_PUBLISH_BASE_URL?.trim().replace(/\/+$/, "") || "https://clawos.minapp.xin",
    token: process.env.CLAWOS_UPLOAD_TOKEN?.trim() || process.env.UPLOAD_TOKEN?.trim() || "clawos",
    installerPath: resolvePathFromEnv(process.env.CLAWOS_INSTALLER_PATH, defaultInstallerPath(hostPlatform)),
    configPath: resolvePathFromEnv(process.env.CLAWOS_CONFIG_PATH, resolve(process.cwd(), "clawos_xiake.json")),
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

    if (arg === "--installer-platform" || arg === "--installer-win" || arg === "--installer-macos" || arg === "--installer-linux") {
      throw new Error(`参数已废弃: ${arg}。发布平台会根据当前运行环境自动决定。`);
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

function detectVersionFromInstallerPath(filePath: string): string | null {
  const name = basename(filePath);
  const match = name.match(VERSION_PATTERN);
  return match?.[1] ?? null;
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

function ensureInstallerMatchesPlatform(filePath: string, platform: PublishPlatform): void {
  const lower = basename(filePath).toLowerCase();
  const allowed = allowedInstallerExt(platform);
  const matched = allowed.some((ext) => lower.endsWith(ext));
  if (!matched) {
    throw new Error(`安装包扩展名不匹配当前平台 ${platform}，仅支持: ${allowed.join(" / ")}`);
  }
}

async function resolvePublishVersion(opts: Options): Promise<string | undefined> {
  if (opts.version?.trim()) {
    return opts.version.trim().replace(/^v/i, "");
  }
  const fromName = detectVersionFromInstallerPath(opts.installerPath);
  if (fromName) {
    return fromName.replace(/^v/i, "");
  }
  return await detectVersionFromPackageJson();
}

async function assertFileReadable(filePath: string, label: string): Promise<void> {
  try {
    await access(filePath, fsConstants.R_OK);
  } catch {
    throw new Error(`${label}文件不可读或不存在: ${filePath}`);
  }
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
  const hostPlatform = resolveHostPublishPlatform();
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.skipInstaller) {
    ensureInstallerMatchesPlatform(opts.installerPath, hostPlatform);
    opts.version = await resolvePublishVersion(opts);
  }

  console.log(`[publish] host platform: ${hostPlatform}`);
  console.log(`[publish] base url: ${opts.baseUrl}`);
  console.log(`[publish] token: ${opts.token === "clawos" ? "clawos (default)" : "***"}`);
  console.log(`[publish] timeout: ${formatDuration(opts.timeoutMs)}`);
  console.log(`[publish] heartbeat: ${formatDuration(opts.heartbeatMs)}`);
  if (opts.version) {
    console.log(`[publish] version: ${opts.version}`);
  }

  const uploadedSummaries: Array<{ kind: "installer" | "config"; fileName: string; url: string }> = [];

  if (!opts.skipInstaller) {
    await assertFileReadable(opts.installerPath, `${hostPlatform} 安装包`);
    console.log(`[publish] 上传安装包(${hostPlatform}): ${opts.installerPath}`);
    const result = await uploadFile({
      endpoint: "/api/upload/installer",
      filePath: opts.installerPath,
      token: opts.token,
      baseUrl: opts.baseUrl,
      version: opts.version,
      platform: hostPlatform,
      timeoutMs: opts.timeoutMs,
      heartbeatMs: opts.heartbeatMs,
    });
    console.log(
      `[publish] 安装包上传成功(${hostPlatform}): ${String(result.fileName || "unknown")} -> ${String(result.url || "")}`
    );
    uploadedSummaries.push({
      kind: "installer",
      fileName: String(result.fileName || "unknown"),
      url: String(result.url || ""),
    });
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
      console.log(`[publish]   ${item.kind}: ${item.fileName} -> ${item.url}`);
    }
  }

  console.log("[publish] 发布完成。");
}

main().catch((error) => {
  console.error(`[publish] 失败: ${(error as Error).message}`);
  process.exit(1);
});
