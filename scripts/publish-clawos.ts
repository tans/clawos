import { constants as fsConstants } from "node:fs";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

type PublishPlatform = "windows" | "macos" | "linux";
type BuildEnv = "dev" | "canary" | "stable";
type ReleaseChannel = "stable" | "beta" | "canary";

const VERSION_PATTERN = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/;
const PLATFORM_TOKEN: Record<PublishPlatform, string> = {
  windows: "win",
  macos: "macos",
  linux: "linux",
};

interface Options {
  baseUrl: string;
  token: string;
  installerPath?: string;
  updaterDir?: string;
  configPath: string;
  version?: string;
  skipInstaller: boolean;
  skipConfig: boolean;
  skipUpdater: boolean;
  timeoutMs: number;
  heartbeatMs: number;
  buildEnv: BuildEnv;
  releaseChannel: ReleaseChannel;
  artifactRoots: string[];
}

type InstallerResolution = {
  path: string;
  source: string;
};

function resolveHostPublishPlatform(): PublishPlatform {
  if (process.platform === "win32") {
    return "windows";
  }
  if (process.platform === "darwin") {
    return "macos";
  }
  return "linux";
}

function parseBuildEnv(raw: string | undefined): BuildEnv {
  const value = (raw || "").trim().toLowerCase();
  if (value === "dev" || value === "canary" || value === "stable") {
    return value;
  }
  return "stable";
}

function defaultInstallerFileName(platform: PublishPlatform): string {
  if (platform === "windows") {
    return "clawos-setup.zip";
  }
  if (platform === "macos") {
    return "clawos.dmg";
  }
  return "clawos.AppImage";
}

function allowedInstallerExt(platform: PublishPlatform): string[] {
  if (platform === "windows") {
    return [".zip", ".exe", ".msi"];
  }
  if (platform === "macos") {
    return [".dmg", ".pkg", ".zip"];
  }
  return [".appimage", ".deb", ".rpm", ".tar.gz", ".zip"];
}

function defaultInstallerPath(platform: PublishPlatform): string {
  return resolve(process.cwd(), "dist", defaultInstallerFileName(platform));
}

function parseReleaseChannel(raw: string | undefined): ReleaseChannel {
  const value = (raw || "").trim().toLowerCase();
  if (value === "beta") {
    return "beta";
  }
  if (value === "canary") {
    return "canary";
  }
  return "stable";
}

function printUsage(): void {
  const platform = resolveHostPublishPlatform();
  console.log(`ClawOS 发布脚本

用法:
  bun run scripts/publish-clawos.ts [options]

当前平台:
  ${platform}（自动判定）

选项:
  --installer <path>    安装包路径（可选，未传则自动探测）
  --build-env <env>     构建环境 dev/canary/stable，默认 stable
  --release-channel <channel>  发布通道 stable/beta/canary，默认 stable
  --updater-dir <path>  Electrobun 更新产物目录（可选，默认自动探测）
  --artifact-root <path>  额外产物搜索目录，可重复传参
  --artifact-roots <paths>  额外产物搜索目录，逗号分隔
  --base-url <url>      发布站点，默认 https://clawos.minapp.xin
  --token <token>       上传 Token，默认读取 UPLOAD_TOKEN，未设置则使用 clawos
  --config <path>       配置文件路径，默认 ./app/clawos_xiake.json
  --version <version>   安装包版本（可选）
  --skip-installer      跳过安装包上传
  --skip-config         跳过配置文件上传
  --skip-updater        跳过 Electrobun 更新产物上传
  --timeout-ms <ms>     单次上传超时，默认 600000（10 分钟）
  --heartbeat-ms <ms>   上传心跳日志间隔，默认 15000（15 秒）
  -h, --help            显示帮助

自动探测顺序:
  1) artifacts/（优先 Electrobun 产物）
  2) build/
  3) dist/
  4) app/artifacts、app/build、app/dist

环境变量（可替代部分参数）:
  CLAWOS_PUBLISH_BASE_URL
  CLAWOS_UPLOAD_TOKEN（或 UPLOAD_TOKEN）
  CLAWOS_INSTALLER_PATH
  CLAWOS_CONFIG_PATH
  CLAWOS_VERSION
  CLAWOS_BUILD_ENV
  CLAWOS_RELEASE_CHANNEL
  CLAWOS_UPDATER_DIR
  CLAWOS_ARTIFACT_ROOTS
  UPLOAD_CHUNK_SIZE_MB（分片上传每片大小，默认 16）
  UPLOAD_CHUNK_THRESHOLD_MB（超过该大小启用分片上传，默认 20）
`);
}

function parseArtifactRoots(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => resolve(process.cwd(), item));
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

  const installerFromEnv = process.env.CLAWOS_INSTALLER_PATH?.trim();

  const opts: Options = {
    baseUrl: process.env.CLAWOS_PUBLISH_BASE_URL?.trim().replace(/\/+$/, "") || "https://clawos.minapp.xin",
    token: process.env.CLAWOS_UPLOAD_TOKEN?.trim() || process.env.UPLOAD_TOKEN?.trim() || "clawos",
    installerPath: installerFromEnv ? resolve(process.cwd(), installerFromEnv) : undefined,
    updaterDir: process.env.CLAWOS_UPDATER_DIR?.trim()
      ? resolve(process.cwd(), process.env.CLAWOS_UPDATER_DIR.trim())
      : undefined,
    configPath: resolvePathFromEnv(process.env.CLAWOS_CONFIG_PATH, resolve(process.cwd(), "app/clawos_xiake.json")),
    version: process.env.CLAWOS_VERSION?.trim() || undefined,
    skipInstaller: false,
    skipConfig: false,
    skipUpdater: ["1", "true", "yes", "on"].includes((process.env.CLAWOS_SKIP_UPDATER || "").trim().toLowerCase()),
    timeoutMs: Number.parseInt(process.env.UPLOAD_TIMEOUT_MS || "", 10) || 10 * 60 * 1000,
    heartbeatMs: Number.parseInt(process.env.UPLOAD_HEARTBEAT_MS || "", 10) || 15 * 1000,
    buildEnv: parseBuildEnv(process.env.CLAWOS_BUILD_ENV),
    releaseChannel: parseReleaseChannel(process.env.CLAWOS_RELEASE_CHANNEL),
    artifactRoots: parseArtifactRoots(process.env.CLAWOS_ARTIFACT_ROOTS),
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

    if (arg === "--skip-updater") {
      opts.skipUpdater = true;
      continue;
    }

    if (arg === "--installer-platform" || arg === "--installer-win" || arg === "--installer-macos" || arg === "--installer-linux") {
      throw new Error(`参数已废弃: ${arg}。发布平台会根据当前运行环境自动决定。`);
    }

    if (arg.startsWith("--base-url=")) {
      opts.baseUrl = arg.slice("--base-url=".length).trim().replace(/\/+$/, "");
      continue;
    }
    if (arg.startsWith("--token=")) {
      opts.token = arg.slice("--token=".length).trim();
      continue;
    }
    if (arg.startsWith("--installer=")) {
      opts.installerPath = resolve(process.cwd(), arg.slice("--installer=".length));
      continue;
    }
    if (arg.startsWith("--config=")) {
      opts.configPath = resolve(process.cwd(), arg.slice("--config=".length));
      continue;
    }
    if (arg.startsWith("--updater-dir=")) {
      opts.updaterDir = resolve(process.cwd(), arg.slice("--updater-dir=".length));
      continue;
    }
    if (arg.startsWith("--artifact-root=")) {
      opts.artifactRoots.push(resolve(process.cwd(), arg.slice("--artifact-root=".length)));
      continue;
    }
    if (arg.startsWith("--artifact-roots=")) {
      opts.artifactRoots.push(...parseArtifactRoots(arg.slice("--artifact-roots=".length)));
      continue;
    }
    if (arg.startsWith("--version=")) {
      opts.version = arg.slice("--version=".length).trim();
      continue;
    }
    if (arg.startsWith("--timeout-ms=")) {
      opts.timeoutMs = Number.parseInt(arg.slice("--timeout-ms=".length), 10);
      continue;
    }
    if (arg.startsWith("--heartbeat-ms=")) {
      opts.heartbeatMs = Number.parseInt(arg.slice("--heartbeat-ms=".length), 10);
      continue;
    }
    if (arg.startsWith("--build-env=")) {
      opts.buildEnv = parseBuildEnv(arg.slice("--build-env=".length));
      continue;
    }
    if (arg.startsWith("--release-channel=")) {
      opts.releaseChannel = parseReleaseChannel(arg.slice("--release-channel=".length));
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
        break;
      case "--config":
        opts.configPath = resolve(process.cwd(), value);
        break;
      case "--updater-dir":
        opts.updaterDir = resolve(process.cwd(), value);
        break;
      case "--artifact-root":
        opts.artifactRoots.push(resolve(process.cwd(), value));
        break;
      case "--artifact-roots":
        opts.artifactRoots.push(...parseArtifactRoots(value));
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
      case "--build-env":
        opts.buildEnv = parseBuildEnv(value);
        break;
      case "--release-channel":
        opts.releaseChannel = parseReleaseChannel(value);
        break;
      default:
        throw new Error(`未知参数: ${arg}`);
    }
  }

  if (!opts.token) {
    throw new Error("UPLOAD_TOKEN 为空，请通过 --token 或环境变量设置。");
  }
  if (opts.skipInstaller && opts.skipConfig && opts.skipUpdater) {
    throw new Error("不能同时跳过 installer、config 和 updater。");
  }
  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
    throw new Error(`--timeout-ms 非法: ${opts.timeoutMs}`);
  }
  if (!Number.isFinite(opts.heartbeatMs) || opts.heartbeatMs <= 0) {
    throw new Error(`--heartbeat-ms 非法: ${opts.heartbeatMs}`);
  }
  opts.artifactRoots = Array.from(new Set(opts.artifactRoots.map((item) => resolve(process.cwd(), item))));

  return opts;
}

function detectVersionFromInstallerPath(filePath: string): string | null {
  const name = basename(filePath);
  const match = name.match(VERSION_PATTERN);
  return match?.[1] ?? null;
}

const UPDATER_ALLOWED_SUFFIXES = [
  ".update.json",
  "-update.json",
  ".metadata.json",
  ".tar.zst",
  ".patch",
  ".zip",
  ".exe",
  ".msi",
  ".dmg",
  ".pkg",
  ".appimage",
  ".deb",
  ".rpm",
  ".tar.gz",
  ".tar",
  ".json",
];

function looksLikeUpdaterArtifact(fileName: string, prefix: string): boolean {
  const lower = fileName.toLowerCase();
  if (!lower.startsWith(prefix)) {
    return false;
  }
  return UPDATER_ALLOWED_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function looksLikeUpdaterArtifactByPlatform(fileName: string, platform: PublishPlatform, version?: string): boolean {
  const lower = fileName.toLowerCase();
  const platformToken = `-${PLATFORM_TOKEN[platform]}-`;
  if (!lower.includes(platformToken)) {
    return false;
  }
  if (version?.trim() && !lower.includes(version.trim().toLowerCase())) {
    return false;
  }
  return UPDATER_ALLOWED_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function candidateArtifactRoots(): string[] {
  const cwd = process.cwd();
  const parent = dirname(cwd);
  const roots = [
    resolve(cwd, "artifacts"),
    resolve(cwd, "build"),
    resolve(cwd, "dist"),
    resolve(cwd, "app", "artifacts"),
    resolve(cwd, "app", "build"),
    resolve(cwd, "app", "dist"),
  ];

  // 支持在 repo 根目录或 app 目录内执行发布脚本。
  if (basename(cwd).toLowerCase() === "app") {
    roots.push(resolve(parent, "artifacts"), resolve(parent, "build"), resolve(parent, "dist"));
  }

  return Array.from(new Set(roots));
}

async function detectUpdaterArtifacts(
  platform: PublishPlatform,
  buildEnv: BuildEnv,
  updaterDir?: string,
  extraRoots: string[] = [],
  version?: string
): Promise<string[]> {
  const prefix = `${buildEnv}-${PLATFORM_TOKEN[platform]}-`;
  const roots = updaterDir ? [resolve(process.cwd(), updaterDir)] : [...candidateArtifactRoots(), ...extraRoots];

  const strictByName = new Map<string, { path: string; mtimeMs: number }>();
  const fallbackByName = new Map<string, { path: string; mtimeMs: number }>();

  for (const root of roots) {
    const files = await collectFilesRecursively(root, 10);
    for (const filePath of files) {
      const name = basename(filePath);
      const isStrict = looksLikeUpdaterArtifact(name, prefix);
      const isFallback = !isStrict && looksLikeUpdaterArtifactByPlatform(name, platform, version);
      if (!isStrict && !isFallback) {
        continue;
      }

      let mtimeMs = 0;
      try {
        const info = await stat(filePath);
        mtimeMs = info.mtimeMs;
      } catch {
        // ignore stat failures
      }

      const target = isStrict ? strictByName : fallbackByName;
      const existing = target.get(name);
      if (!existing || existing.mtimeMs < mtimeMs) {
        target.set(name, { path: filePath, mtimeMs });
      }
    }
  }

  const strictArtifacts = Array.from(strictByName.values())
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map((item) => item.path);
  const fallbackArtifacts = Array.from(fallbackByName.values())
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map((item) => item.path);

  const strictHasUpdateJson = strictArtifacts.some((filePath) => basename(filePath).toLowerCase().endsWith("-update.json"));
  if (strictHasUpdateJson) {
    return strictArtifacts;
  }

  const fallbackHasUpdateJson = fallbackArtifacts.some((filePath) =>
    basename(filePath).toLowerCase().endsWith("-update.json")
  );
  if (fallbackHasUpdateJson) {
    return fallbackArtifacts;
  }

  return [];
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

function matchesAllowedExt(fileName: string, allowed: string[]): boolean {
  const lower = fileName.toLowerCase();
  return allowed.some((item) => lower.endsWith(item));
}

function normalizeSlash(filePath: string): string {
  return filePath.replace(/\\/g, "/").toLowerCase();
}

const SCAN_SKIP_DIRS = new Set([".git", "node_modules"]);

async function collectFilesRecursively(rootDir: string, maxDepth: number): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string, depth: number): Promise<void> {
    if (depth > maxDepth) {
      return;
    }

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const next = join(current, entry.name);
      if (entry.isDirectory()) {
        if (SCAN_SKIP_DIRS.has(entry.name.toLowerCase())) {
          continue;
        }
        await walk(next, depth + 1);
      } else if (entry.isFile()) {
        files.push(next);
      }
    }
  }

  await walk(rootDir, 0);
  return files;
}

function candidateScore(filePath: string, platform: PublishPlatform, buildEnv: BuildEnv): number {
  const normalized = normalizeSlash(filePath);
  const name = basename(filePath).toLowerCase();
  const platformToken = PLATFORM_TOKEN[platform];
  let score = 0;

  if (normalized.includes("/artifacts/")) {
    score += 120;
  } else if (normalized.includes("/build/")) {
    score += 70;
  } else if (normalized.includes("/dist/")) {
    score += 40;
  }

  if (normalized.includes(`/${buildEnv}-${platformToken}-`)) {
    score += 90;
  } else if (name.startsWith(`${buildEnv}-${platformToken}-`)) {
    score += 70;
  } else if (name.startsWith(`${buildEnv}-`)) {
    score += 30;
  }

  if (name.includes("clawos")) {
    score += 15;
  }

  if (name.includes("setup")) {
    score += 25;
  }

  if (platform === "windows") {
    if (name.endsWith(".zip") && name.includes("setup")) {
      score += 80;
    }
    if (name.endsWith(".exe") && name.includes("setup")) {
      score += 30;
    }
    if (name.endsWith(".zip") && name.includes(`${buildEnv}-${platformToken}-`)) {
      score += 55;
    }
    if (name === "launcher.exe") {
      score += 35;
      if (normalized.includes("/bin/")) {
        score += 20;
      }
    }
    if (name.endsWith(".exe") && !name.includes("setup")) {
      score -= 40;
    }
  }

  if (name.includes("update") || name.includes("metadata") || name.includes("patch")) {
    score -= 180;
  }

  return score;
}

async function detectInstallerPath(
  platform: PublishPlatform,
  buildEnv: BuildEnv,
  extraRoots: string[] = []
): Promise<InstallerResolution | null> {
  const allowed = allowedInstallerExt(platform);
  const roots = [...candidateArtifactRoots(), ...extraRoots];
  const candidates: Array<{ path: string; score: number; mtimeMs: number }> = [];

  for (const root of roots) {
    const files = await collectFilesRecursively(root, 10);
    for (const filePath of files) {
      const name = basename(filePath);
      if (!matchesAllowedExt(name, allowed)) {
        continue;
      }
      const score = candidateScore(filePath, platform, buildEnv);
      let mtimeMs = 0;
      try {
        const info = await stat(filePath);
        mtimeMs = info.mtimeMs;
      } catch {
        // ignore stat failures
      }
      candidates.push({ path: filePath, score, mtimeMs });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.mtimeMs - a.mtimeMs;
  });

  const selected = candidates[0];
  return { path: selected.path, source: `auto-detected(score=${selected.score})` };
}

async function resolveInstallerPathForPublish(
  platform: PublishPlatform,
  buildEnv: BuildEnv,
  providedPath: string | undefined,
  extraRoots: string[]
): Promise<InstallerResolution> {
  if (providedPath?.trim()) {
    return { path: resolve(process.cwd(), providedPath), source: "manual" };
  }

  const auto = await detectInstallerPath(platform, buildEnv, extraRoots);
  if (auto) {
    return auto;
  }

  const fallback = defaultInstallerPath(platform);
  try {
    await access(fallback, fsConstants.R_OK);
    return { path: fallback, source: "default-dist" };
  } catch {
    const searchedRoots = [...candidateArtifactRoots(), ...extraRoots].map((item) => `- ${item}`).join("\n");
    throw new Error(
      `自动探测安装包失败：未在 artifacts/build/dist（含 app 子目录）找到 ${platform} 可发布文件。` +
        `\n你可以手动指定 --installer <path>。` +
        `\n已搜索目录：\n${searchedRoots}`
    );
  }
}

async function normalizeWindowsInstallerPath(filePath: string): Promise<InstallerResolution> {
  const lower = basename(filePath).toLowerCase();
  if (!lower.endsWith(".exe") || !lower.includes("setup")) {
    return { path: filePath, source: "as-is" };
  }

  const dir = dirname(filePath);
  const stem = basename(filePath, ".exe");
  const sameStemZip = join(dir, `${stem}.zip`);
  const noSpaceStemZip = join(dir, `${stem.replace(/ /g, "")}.zip`);
  const candidates = [sameStemZip, noSpaceStemZip];

  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.R_OK);
      return { path: candidate, source: "paired-zip" };
    } catch {
      // continue
    }
  }

  const files = await readdir(dir).catch(() => []);
  const stemLower = stem.toLowerCase().replace(/\s+/g, "");
  const fuzzy = files.find((name) => {
    const lowerName = name.toLowerCase();
    return lowerName.endsWith(".zip") && lowerName.includes(stemLower);
  });

  if (fuzzy) {
    const matched = join(dir, fuzzy);
    await access(matched, fsConstants.R_OK);
    return { path: matched, source: "paired-zip-fuzzy" };
  }

  throw new Error(
    `检测到 Windows Setup.exe：${filePath}\n` +
      "该文件需要配套 .metadata.json + .tar.zst，不能单独发布。请改为发布同目录 Setup.zip。"
  );
}

function ensureInstallerMatchesPlatform(filePath: string, platform: PublishPlatform): void {
  const lower = basename(filePath).toLowerCase();
  const allowed = allowedInstallerExt(platform);
  const matched = allowed.some((ext) => lower.endsWith(ext));
  if (!matched) {
    throw new Error(`安装包扩展名不匹配当前平台 ${platform}，仅支持: ${allowed.join(" / ")}`);
  }
}

async function resolvePublishVersion(opts: Options, installerPath: string): Promise<string | undefined> {
  if (opts.version?.trim()) {
    return opts.version.trim().replace(/^v/i, "");
  }
  const fromName = detectVersionFromInstallerPath(installerPath);
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
  channel: ReleaseChannel;
  timeoutMs: number;
  heartbeatMs: number;
}): Promise<Record<string, unknown>> {
  const file = Bun.file(params.filePath);
  const fileSize = file.size;
  const fileName = basename(params.filePath);
  const chunkSizeMb = Number.parseInt(process.env.UPLOAD_CHUNK_SIZE_MB || "", 10) || 16;
  const chunkThresholdMb = Number.parseInt(process.env.UPLOAD_CHUNK_THRESHOLD_MB || "", 10) || 20;
  const chunkSizeBytes = Math.max(1, chunkSizeMb) * 1024 * 1024;
  const chunkThresholdBytes = Math.max(1, chunkThresholdMb) * 1024 * 1024;
  console.log(
    `[publish] 上传策略: file=${fileName}, size=${formatBytes(fileSize)}, threshold=${formatBytes(chunkThresholdBytes)}, chunkSize=${formatBytes(chunkSizeBytes)}`
  );

  if (fileSize >= chunkThresholdBytes) {
    return await uploadFileByChunks({
      ...params,
      fileSize,
      chunkSizeBytes,
    });
  }

  const form = new FormData();
  form.append("file", file, basename(params.filePath));
  if (params.version) {
    form.append("version", params.version);
  }
  if (params.platform) {
    form.append("platform", params.platform);
  }
  form.append("channel", params.channel);

  const endpointUrl = new URL(`${params.baseUrl}${params.endpoint}`);
  if (params.platform) {
    endpointUrl.searchParams.set("platform", params.platform);
  }
  endpointUrl.searchParams.set("channel", params.channel);
  const url = endpointUrl.toString();
  console.log(`[publish] 开始上传(单请求): ${fileName} (${formatBytes(fileSize)}) -> ${url}`);

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, params.timeoutMs);
  const heartbeatHandle = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    console.log(`[publish] 上传中(单请求): ${fileName}，已耗时 ${formatDuration(elapsed)}（等待服务器返回中）...`);
  }, params.heartbeatMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.token}`,
        ...(params.platform ? { "x-platform": params.platform } : {}),
        "x-channel": params.channel,
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
  const speed = elapsed > 0 ? `${formatBytes((fileSize / elapsed) * 1000)}/s` : "n/a";
  console.log(
    `[publish] 上传完成(单请求): ${fileName} (${formatBytes(fileSize)}), HTTP ${res.status}, 耗时 ${formatDuration(elapsed)}, 平均速率 ${speed}`
  );

  return data;
}

async function uploadFileByChunks(params: {
  endpoint: string;
  filePath: string;
  token: string;
  baseUrl: string;
  version?: string;
  platform?: PublishPlatform;
  channel: ReleaseChannel;
  timeoutMs: number;
  heartbeatMs: number;
  fileSize: number;
  chunkSizeBytes: number;
}): Promise<Record<string, unknown>> {
  const fileName = basename(params.filePath);
  const totalChunks = Math.ceil(params.fileSize / params.chunkSizeBytes);
  const startedAt = Date.now();
  const baseHeaders = {
    Authorization: `Bearer ${params.token}`,
    ...(params.platform ? { "x-platform": params.platform } : {}),
    "x-channel": params.channel,
  };

  const initRes = await fetch(`${params.baseUrl}/api/upload/chunk/init`, {
    method: "POST",
    headers: {
      ...baseHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      target: params.endpoint,
      fileName,
      totalSize: params.fileSize,
      totalChunks,
      version: params.version,
      platform: params.platform,
      channel: params.channel,
    }),
  });
  const initData = (await initRes.json()) as Record<string, unknown>;
  if (!initRes.ok || initData.ok !== true || typeof initData.uploadId !== "string") {
    const err = typeof initData.error === "string" ? initData.error : `HTTP ${initRes.status}`;
    throw new Error(`初始化分片上传失败: ${err}`);
  }
  const uploadId = initData.uploadId;
  console.log(
    `[publish] 分片上传启用: ${fileName} (${formatBytes(params.fileSize)}), uploadId=${uploadId}, chunks=${totalChunks}, chunk=${formatBytes(params.chunkSizeBytes)}`
  );

  let uploadedBytes = 0;
  let completedChunks = 0;
  const heartbeatHandle = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    const progress = ((uploadedBytes / params.fileSize) * 100).toFixed(1);
    const speed = elapsed > 0 ? `${formatBytes((uploadedBytes / elapsed) * 1000)}/s` : "n/a";
    console.log(
      `[publish] 分片上传中: ${fileName}，chunk=${completedChunks}/${totalChunks}, uploaded=${formatBytes(uploadedBytes)}/${formatBytes(params.fileSize)} (${progress}%), avg=${speed}, elapsed=${formatDuration(elapsed)}`
    );
  }, params.heartbeatMs);

  try {
    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * params.chunkSizeBytes;
      const end = Math.min(start + params.chunkSizeBytes, params.fileSize);
      const chunkBytes = end - start;
      console.log(
        `[publish] 分片开始: ${fileName} uploadId=${uploadId} chunk=${index + 1}/${totalChunks}, bytes=${formatBytes(chunkBytes)}, range=[${start}, ${end})`
      );
      const chunkBlob = Bun.file(params.filePath).slice(start, end);
      const chunkData = await chunkBlob.arrayBuffer();

      let uploaded = false;
      let attempt = 0;
      let lastErr = "";
      while (!uploaded && attempt < 3) {
        attempt += 1;
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), params.timeoutMs);
        const chunkStartedAt = Date.now();
        try {
          const chunkRes = await fetch(
            `${params.baseUrl}/api/upload/chunk/${encodeURIComponent(uploadId)}/part/${index}`,
            {
              method: "POST",
              headers: {
                ...baseHeaders,
                "content-type": "application/octet-stream",
              },
              body: chunkData,
              signal: controller.signal,
            }
          );
          const chunkJson = (await chunkRes.json()) as Record<string, unknown>;
          if (!chunkRes.ok || chunkJson.ok !== true) {
            lastErr = typeof chunkJson.error === "string" ? chunkJson.error : `HTTP ${chunkRes.status}`;
            console.warn(
              `[publish] 分片失败待重试: ${fileName} uploadId=${uploadId} chunk=${index + 1}/${totalChunks}, attempt=${attempt}/3, status=${chunkRes.status}, error=${lastErr}`
            );
            continue;
          }
          uploaded = true;
          const chunkElapsed = Date.now() - chunkStartedAt;
          const speed = chunkElapsed > 0 ? `${formatBytes((chunkBytes / chunkElapsed) * 1000)}/s` : "n/a";
          console.log(
            `[publish] 分片成功: ${fileName} uploadId=${uploadId} chunk=${index + 1}/${totalChunks}, attempt=${attempt}/3, status=${chunkRes.status}, chunkElapsed=${formatDuration(chunkElapsed)}, speed=${speed}`
          );
        } catch (error) {
          lastErr = error instanceof Error ? error.message : String(error);
          console.warn(
            `[publish] 分片请求异常: ${fileName} uploadId=${uploadId} chunk=${index + 1}/${totalChunks}, attempt=${attempt}/3, error=${lastErr}`
          );
        } finally {
          clearTimeout(timeoutHandle);
        }
      }
      if (!uploaded) {
        throw new Error(`分片上传失败: uploadId=${uploadId}, chunk=${index + 1}/${totalChunks}, error=${lastErr}`);
      }

      uploadedBytes += chunkBytes;
      completedChunks += 1;
      const progress = ((uploadedBytes / params.fileSize) * 100).toFixed(1);
      const elapsed = Date.now() - startedAt;
      const speed = elapsed > 0 ? `${formatBytes((uploadedBytes / elapsed) * 1000)}/s` : "n/a";
      console.log(
        `[publish] 分片上传进度: ${fileName} uploadId=${uploadId} chunk=${completedChunks}/${totalChunks}, uploaded=${formatBytes(uploadedBytes)}/${formatBytes(params.fileSize)} (${progress}%), avg=${speed}`
      );
    }

    console.log(`[publish] 分片合并开始: ${fileName} uploadId=${uploadId}`);
    const completeRes = await fetch(`${params.baseUrl}/api/upload/chunk/${encodeURIComponent(uploadId)}/complete`, {
      method: "POST",
      headers: {
        ...baseHeaders,
      },
    });
    const completeText = await completeRes.text();
    let completeData: Record<string, unknown> = {};
    try {
      completeData = completeText ? (JSON.parse(completeText) as Record<string, unknown>) : {};
    } catch {
      throw new Error(`完成分片上传返回非 JSON: ${completeText}`);
    }
    if (!completeRes.ok || completeData.ok !== true) {
      const err = typeof completeData.error === "string" ? completeData.error : `HTTP ${completeRes.status}`;
      throw new Error(`完成分片上传失败: ${err}`);
    }

    const elapsed = Date.now() - startedAt;
    const speed = elapsed > 0 ? `${formatBytes((params.fileSize / elapsed) * 1000)}/s` : "n/a";
    console.log(
      `[publish] 分片上传完成: ${fileName}, uploadId=${uploadId}, total=${formatBytes(params.fileSize)}, 耗时 ${formatDuration(elapsed)}, 平均速率 ${speed}`
    );
    return completeData;
  } finally {
    clearInterval(heartbeatHandle);
  }
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

  let installerPath = "";
  let installerSource = "";
  let updaterArtifacts: string[] = [];

  if (!opts.skipInstaller) {
    const resolved = await resolveInstallerPathForPublish(hostPlatform, opts.buildEnv, opts.installerPath, opts.artifactRoots);
    installerPath = resolved.path;
    installerSource = resolved.source;

    if (hostPlatform === "windows") {
      const normalized = await normalizeWindowsInstallerPath(installerPath);
      installerPath = normalized.path;
      installerSource = `${installerSource}+${normalized.source}`;
    }

    ensureInstallerMatchesPlatform(installerPath, hostPlatform);
    opts.version = await resolvePublishVersion(opts, installerPath);
  }

  if (!opts.skipUpdater) {
    updaterArtifacts = await detectUpdaterArtifacts(hostPlatform, opts.buildEnv, opts.updaterDir, opts.artifactRoots, opts.version);
    if (updaterArtifacts.length === 0) {
      throw new Error(
        `未找到 Electrobun 更新产物（前缀: ${opts.buildEnv}-${PLATFORM_TOKEN[hostPlatform]}-）。` +
          `\n请确认已执行 Electrobun build，并检查 artifacts 目录。` +
          `\n若构建产物前缀不是当前 --build-env（例如 dev-win-），请改为对应 build-env 或手动指定 --updater-dir。` +
          `\n也可通过 --updater-dir <path> 指定目录，或使用 --skip-updater 跳过。`
      );
    }
  }

  console.log(`[publish] host platform: ${hostPlatform}`);
  console.log(`[publish] build env: ${opts.buildEnv}`);
  console.log(`[publish] base url: ${opts.baseUrl}`);
  console.log(`[publish] release channel: ${opts.releaseChannel}`);
  console.log(`[publish] token: ${opts.token === "clawos" ? "clawos (default)" : "***"}`);
  console.log(`[publish] timeout: ${formatDuration(opts.timeoutMs)}`);
  console.log(`[publish] heartbeat: ${formatDuration(opts.heartbeatMs)}`);
  if (opts.version) {
    console.log(`[publish] version: ${opts.version}`);
  }
  if (opts.updaterDir) {
    console.log(`[publish] updater dir: ${opts.updaterDir}`);
  }
  if (opts.artifactRoots.length > 0) {
    console.log(`[publish] extra artifact roots: ${opts.artifactRoots.join(", ")}`);
  }
  if (installerPath) {
    console.log(`[publish] installer path: ${installerPath}`);
    console.log(`[publish] installer source: ${installerSource}`);
  }
  if (!opts.skipUpdater) {
    console.log(`[publish] updater artifacts: ${updaterArtifacts.length} files`);
  }

  const uploadedSummaries: Array<{ kind: "installer" | "config" | "updater"; fileName: string; url: string }> = [];

  if (!opts.skipInstaller) {
    await assertFileReadable(installerPath, `${hostPlatform} 安装包`);
    console.log(`[publish] 上传安装包(${hostPlatform}): ${installerPath}`);
    const result = await uploadFile({
      endpoint: "/api/upload/installer",
      filePath: installerPath,
      token: opts.token,
      baseUrl: opts.baseUrl,
      version: opts.version,
      platform: hostPlatform,
      timeoutMs: opts.timeoutMs,
      heartbeatMs: opts.heartbeatMs,
      channel: opts.releaseChannel,
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
      channel: opts.releaseChannel,
    });
    console.log(`[publish] 配置文件上传成功: ${String(result.fileName || "unknown")}`);
    uploadedSummaries.push({
      kind: "config",
      fileName: String(result.fileName || "unknown"),
      url: String(result.url || ""),
    });
  }

  if (!opts.skipUpdater) {
    for (const filePath of updaterArtifacts) {
      await assertFileReadable(filePath, "Electrobun 更新产物");
      console.log(`[publish] 上传更新产物: ${filePath}`);
      const result = await uploadFile({
        endpoint: "/api/upload/electrobun-artifact",
        filePath,
        token: opts.token,
        baseUrl: opts.baseUrl,
        timeoutMs: opts.timeoutMs,
        heartbeatMs: opts.heartbeatMs,
        channel: opts.releaseChannel,
      });
      uploadedSummaries.push({
        kind: "updater",
        fileName: String(result.fileName || basename(filePath)),
        url: String(result.url || ""),
      });
    }
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
