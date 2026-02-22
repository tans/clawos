import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { getEnv } from "./env";
import { sha256Hex } from "./hash";
import type { LatestRelease, ReleaseAsset } from "./types";

const RELEASE_FILE_NAME = "latest.json";
const CONFIG_CANONICAL_NAME = "clawos_xiake.json";

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
    xiakeConfig: null,
  };
}

function getReleaseFilePath(): string {
  const env = getEnv();
  return resolve(env.storageDir, "releases", RELEASE_FILE_NAME);
}

function getInstallerDir(): string {
  const env = getEnv();
  return resolve(env.storageDir, "assets", "installer");
}

function getConfigDir(): string {
  const env = getEnv();
  return resolve(env.storageDir, "assets", "config");
}

function relativeAssetPath(kind: "installer" | "config", fileName: string): string {
  return join("assets", kind, fileName);
}

function absoluteAssetPath(relativePath: string): string {
  const env = getEnv();
  return resolve(env.storageDir, relativePath);
}

async function ensureStorageDirs(): Promise<void> {
  await Promise.all([
    mkdir(resolve(getEnv().storageDir, "releases"), { recursive: true }),
    mkdir(getInstallerDir(), { recursive: true }),
    mkdir(getConfigDir(), { recursive: true }),
  ]);
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
  return {
    version: typeof data.version === "string" && data.version.trim() ? data.version : "dev",
    publishedAt:
      typeof data.publishedAt === "string" && data.publishedAt.trim() ? data.publishedAt : nowIso(),
    installer: normalizeAsset(data.installer),
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

function assertInstallerFile(fileName: string): void {
  const ext = extname(fileName).toLowerCase();
  if (![".exe", ".msi", ".zip"].includes(ext)) {
    throw new Error("安装包仅支持 .exe / .msi / .zip");
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
}): Promise<UploadedAssetResult> {
  const env = getEnv();
  await ensureStorageDirs();

  const safeName = ensureSafeFileName(params.fileName);
  assertInstallerFile(safeName);
  assertFileSize(params.bytes.byteLength, env.maxInstallerSizeBytes, "安装包");

  const outputPath = resolve(getInstallerDir(), safeName);
  await writeFile(outputPath, params.bytes);

  const asset: ReleaseAsset = {
    name: safeName,
    relativePath: relativeAssetPath("installer", safeName),
    size: params.bytes.byteLength,
    sha256: sha256Hex(params.bytes),
    uploadedAt: nowIso(),
  };

  const latest = (await readLatestRelease()) ?? createEmptyRelease();
  latest.installer = asset;
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

export async function resolveLatestInstaller(): Promise<ResolvedDownload> {
  const latest = await readLatestRelease();
  if (!latest?.installer) {
    throw new Error("尚未上传安装包");
  }

  const absolutePath = absoluteAssetPath(latest.installer.relativePath);
  await ensureReadable(absolutePath);
  return { release: latest, asset: latest.installer, absolutePath };
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
