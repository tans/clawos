import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { getEnv } from "./env";
import { sha256Hex } from "./hash";
import type { InstallerPlatform, LatestRelease, ReleaseAsset } from "./types";

const RELEASE_FILE_NAME = "latest.json";
const CONFIG_CANONICAL_NAME = "clawos_xiake.json";
const INSTALLER_PLATFORMS: InstallerPlatform[] = ["windows", "macos", "linux"];

function nowIso(): string {
  return new Date().toISOString();
}

function ensureSafeFileName(fileName: string): string {
  const name = basename(fileName).trim();
  if (!name) {
    throw new Error("文件名不能为空");
  }

  // Keep file names ASCII-safe and filesystem-safe.
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function detectVersionFromFileName(fileName: string): string | null {
  const match = fileName.match(/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/);
  return match?.[1] ?? null;
}

function createEmptyRelease(): LatestRelease {
  return {
    version: "dev",
    publishedAt: nowIso(),
    installer: null,
    installers: {},
    xiakeConfig: null,
  };
}

function getReleaseFilePath(): string {
  const env = getEnv();
  return resolve(env.storageDir, "releases", RELEASE_FILE_NAME);
}

function getInstallerDir(platform?: InstallerPlatform): string {
  const env = getEnv();
  return platform
    ? resolve(env.storageDir, "assets", "installer", platform)
    : resolve(env.storageDir, "assets", "installer");
}

function getConfigDir(): string {
  const env = getEnv();
  return resolve(env.storageDir, "assets", "config");
}

function relativeAssetPath(kind: "installer" | "config", fileName: string, platform?: InstallerPlatform): string {
  if (kind === "installer" && platform) {
    return join("assets", kind, platform, fileName);
  }
  return join("assets", kind, fileName);
}

function absoluteAssetPath(relativePath: string): string {
  const env = getEnv();
  return resolve(env.storageDir, relativePath);
}

async function ensureStorageDirs(): Promise<void> {
  await mkdir(resolve(getEnv().storageDir, "releases"), { recursive: true });
  await mkdir(getInstallerDir(), { recursive: true });
  await mkdir(getConfigDir(), { recursive: true });
  await Promise.all(INSTALLER_PLATFORMS.map((platform) => mkdir(getInstallerDir(platform), { recursive: true })));
}

export function normalizeInstallerPlatform(raw: unknown): InstallerPlatform | null {
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "windows" || normalized === "win" || normalized === "win32") {
    return "windows";
  }
  if (normalized === "macos" || normalized === "mac" || normalized === "darwin" || normalized === "osx") {
    return "macos";
  }
  if (normalized === "linux") {
    return "linux";
  }
  return null;
}

function detectInstallerPlatformFromFileName(fileName: string): InstallerPlatform | null {
  const normalized = fileName.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.endsWith(".exe") || normalized.endsWith(".msi")) {
    return "windows";
  }
  if (normalized.endsWith(".dmg") || normalized.endsWith(".pkg")) {
    return "macos";
  }
  if (
    normalized.endsWith(".appimage") ||
    normalized.endsWith(".deb") ||
    normalized.endsWith(".rpm") ||
    normalized.endsWith(".tar.gz")
  ) {
    return "linux";
  }
  return null;
}

function normalizeAsset(raw: unknown): ReleaseAsset | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;
  if (
    typeof data.name !== "string" ||
    typeof data.relativePath !== "string" ||
    typeof data.size !== "number" ||
    typeof data.sha256 !== "string" ||
    typeof data.uploadedAt !== "string"
  ) {
    return null;
  }

  return {
    name: data.name,
    relativePath: data.relativePath,
    size: data.size,
    sha256: data.sha256,
    uploadedAt: data.uploadedAt,
  };
}

function normalizeRelease(raw: unknown): LatestRelease {
  if (!raw || typeof raw !== "object") {
    return createEmptyRelease();
  }

  const data = raw as Record<string, unknown>;
  const installersRaw =
    data.installers && typeof data.installers === "object" && !Array.isArray(data.installers)
      ? (data.installers as Record<string, unknown>)
      : null;
  const installers: Partial<Record<InstallerPlatform, ReleaseAsset>> = {};
  if (installersRaw) {
    for (const platform of INSTALLER_PLATFORMS) {
      const normalized = normalizeAsset(installersRaw[platform]);
      if (normalized) {
        installers[platform] = normalized;
      }
    }
  }

  return {
    version: typeof data.version === "string" && data.version.trim() ? data.version : "dev",
    publishedAt:
      typeof data.publishedAt === "string" && data.publishedAt.trim() ? data.publishedAt : nowIso(),
    installer: normalizeAsset(data.installer),
    installers,
    xiakeConfig: normalizeAsset(data.xiakeConfig),
  };
}

export async function readLatestRelease(): Promise<LatestRelease | null> {
  await ensureStorageDirs();

  try {
    const content = await readFile(getReleaseFilePath(), "utf-8");
    return normalizeRelease(JSON.parse(content));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeLatestRelease(release: LatestRelease): Promise<void> {
  await ensureStorageDirs();
  await writeFile(getReleaseFilePath(), `${JSON.stringify(release, null, 2)}\n`, "utf-8");
}

function assertInstallerFile(fileName: string, platform: InstallerPlatform): void {
  const normalized = fileName.trim().toLowerCase();
  const ext = extname(normalized).toLowerCase();
  const byPlatform: Record<InstallerPlatform, string[]> = {
    windows: [".exe", ".msi", ".zip"],
    macos: [".dmg", ".pkg", ".zip"],
    linux: [".appimage", ".deb", ".rpm", ".tar.gz", ".zip"],
  };
  const allowed = byPlatform[platform];
  const matched =
    allowed.some((candidate) => normalized.endsWith(candidate)) ||
    (platform !== "linux" && allowed.includes(ext));
  if (!matched) {
    throw new Error(`安装包扩展名与平台不匹配：${platform} 仅支持 ${allowed.join(" / ")}`);
  }
}

function assertConfigFile(fileName: string): void {
  const ext = extname(fileName).toLowerCase();
  if (ext !== ".json") {
    throw new Error("配置文件必须是 .json");
  }
}

function assertFileSize(size: number, maxBytes: number, label: string): void {
  if (size <= 0) {
    throw new Error(`${label}不能为空`);
  }
  if (size > maxBytes) {
    throw new Error(`${label}超过大小限制`);
  }
}

async function ensureReadable(filePath: string): Promise<void> {
  await access(filePath, fsConstants.R_OK);
}

export interface UploadedAssetResult {
  release: LatestRelease;
  asset: ReleaseAsset;
}

export async function storeInstaller(params: {
  fileName: string;
  bytes: Uint8Array;
  version?: string;
  platform?: InstallerPlatform;
}): Promise<UploadedAssetResult> {
  const env = getEnv();
  await ensureStorageDirs();

  const safeName = ensureSafeFileName(params.fileName);
  const platform =
    normalizeInstallerPlatform(params.platform) || detectInstallerPlatformFromFileName(safeName) || "windows";
  assertInstallerFile(safeName, platform);
  assertFileSize(params.bytes.byteLength, env.maxInstallerSizeBytes, "安装包");

  const outputPath = resolve(getInstallerDir(platform), safeName);
  await writeFile(outputPath, params.bytes);

  const asset: ReleaseAsset = {
    name: safeName,
    relativePath: relativeAssetPath("installer", safeName, platform),
    size: params.bytes.byteLength,
    sha256: sha256Hex(params.bytes),
    uploadedAt: nowIso(),
  };

  const latest = (await readLatestRelease()) ?? createEmptyRelease();
  latest.installers = { ...(latest.installers || {}), [platform]: asset };
  if (platform === "windows" || !latest.installer) {
    latest.installer = asset;
  }
  latest.version =
    params.version?.trim() || detectVersionFromFileName(safeName) || latest.version || "dev";
  latest.publishedAt = nowIso();

  await writeLatestRelease(latest);
  return { release: latest, asset };
}

export async function storeXiakeConfig(params: {
  fileName: string;
  bytes: Uint8Array;
}): Promise<UploadedAssetResult> {
  const env = getEnv();
  await ensureStorageDirs();

  assertConfigFile(params.fileName);
  assertFileSize(params.bytes.byteLength, env.maxConfigSizeBytes, "配置文件");

  const outputPath = resolve(getConfigDir(), CONFIG_CANONICAL_NAME);
  await writeFile(outputPath, params.bytes);

  const asset: ReleaseAsset = {
    name: CONFIG_CANONICAL_NAME,
    relativePath: relativeAssetPath("config", CONFIG_CANONICAL_NAME),
    size: params.bytes.byteLength,
    sha256: sha256Hex(params.bytes),
    uploadedAt: nowIso(),
  };

  const latest = (await readLatestRelease()) ?? createEmptyRelease();
  latest.xiakeConfig = asset;
  latest.publishedAt = nowIso();

  await writeLatestRelease(latest);
  return { release: latest, asset };
}

export interface ResolvedDownload {
  release: LatestRelease;
  asset: ReleaseAsset;
  absolutePath: string;
}

export async function resolveLatestInstaller(platform?: InstallerPlatform): Promise<ResolvedDownload> {
  const latest = await readLatestRelease();
  if (!latest) {
    throw new Error("尚未上传安装包");
  }

  const candidate =
    (platform && latest.installers ? latest.installers[platform] : null) ||
    latest.installer ||
    (latest.installers
      ? INSTALLER_PLATFORMS.map((item) => latest.installers?.[item]).find((item): item is ReleaseAsset => Boolean(item))
      : null);
  if (!candidate) {
    throw new Error("尚未上传安装包");
  }

  const absolutePath = absoluteAssetPath(candidate.relativePath);
  await ensureReadable(absolutePath);
  return { release: latest, asset: candidate, absolutePath };
}

export async function resolveLatestXiakeConfig(): Promise<ResolvedDownload> {
  const latest = await readLatestRelease();
  if (!latest?.xiakeConfig) {
    throw new Error("尚未上传 clawos_xiake.json");
  }

  const absolutePath = absoluteAssetPath(latest.xiakeConfig.relativePath);
  await ensureReadable(absolutePath);
  return { release: latest, asset: latest.xiakeConfig, absolutePath };
}
