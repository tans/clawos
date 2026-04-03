import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { getEnv } from "./env";
import { sha256Hex } from "./hash";
import type {
  AdminTask,
  InstallerPlatform,
  LatestRelease,
  AdminInstallerHistoryItem,
  McpManifest,
  McpRegistryEntry,
  McpRelease,
  McpShelfItem,
  Product,
  ReleaseAsset,
  ReleaseChannel,
  SiteSettings,
} from "./types";

const RELEASE_FILE_NAME = "latest.json";
const RELEASE_FILE_NAME_BY_CHANNEL: Record<ReleaseChannel, string> = {
  stable: "latest.json",
  beta: "latest-beta.json",
  alpha: "latest-alpha.json",
  canary: "latest-alpha.json",
};
const MCP_RELEASE_FILE_NAME_BY_CHANNEL: Record<ReleaseChannel, string> = {
  stable: "mcps.json",
  beta: "mcps-beta.json",
  alpha: "mcps-alpha.json",
  canary: "mcps-alpha.json",
};
const MCP_SHELF_FILE_NAME = "mcp-shelf.json";
const PRODUCTS_FILE_NAME = "products.json";
const TASKS_FILE_NAME = "tasks.json";
const SITE_SETTINGS_FILE_NAME = "site-settings.json";
const CONFIG_CANONICAL_NAME = "clawos_xiake.json";
const INSTALLER_PLATFORMS: InstallerPlatform[] = ["windows", "macos", "linux"];
const UPDATER_ASSET_MAX_ENTRIES = 240;
const UPDATER_FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const MCP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const MCP_PACKAGE_EXTENSIONS = [".zip", ".tgz", ".tar.gz"];

function nowIso(): string {
  return new Date().toISOString();
}

function compareVersionDesc(left: string, right: string): number {
  return right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" });
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
    changelog: "",
    thumbnailUrl: "",
    publishedAt: nowIso(),
    installer: null,
    installers: {},
    xiakeConfig: null,
    updaterAssets: [],
  };
}

function getReleaseFilePath(channel: ReleaseChannel): string {
  const env = getEnv();
  const fileName = RELEASE_FILE_NAME_BY_CHANNEL[channel] || RELEASE_FILE_NAME;
  return resolve(env.storageDir, "releases", fileName);
}

function getMcpReleaseFilePath(channel: ReleaseChannel): string {
  const env = getEnv();
  const fileName = MCP_RELEASE_FILE_NAME_BY_CHANNEL[channel];
  return resolve(env.storageDir, "releases", fileName);
}

function getMcpShelfFilePath(): string {
  const env = getEnv();
  return resolve(env.storageDir, "releases", MCP_SHELF_FILE_NAME);
}

function getProductsFilePath(): string {
  const env = getEnv();
  return resolve(env.storageDir, "releases", PRODUCTS_FILE_NAME);
}

function getTasksFilePath(): string {
  const env = getEnv();
  return resolve(env.storageDir, "releases", TASKS_FILE_NAME);
}

function getSiteSettingsFilePath(): string {
  const env = getEnv();
  return resolve(env.storageDir, "releases", SITE_SETTINGS_FILE_NAME);
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

function getUpdaterDir(): string {
  const env = getEnv();
  return resolve(env.storageDir, "assets", "updater");
}

function getMcpDir(mcpId?: string, version?: string): string {
  const env = getEnv();
  if (mcpId && version) {
    return resolve(env.storageDir, "assets", "mcp", mcpId, version);
  }
  if (mcpId) {
    return resolve(env.storageDir, "assets", "mcp", mcpId);
  }
  return resolve(env.storageDir, "assets", "mcp");
}

function relativeAssetPath(
  kind: "installer" | "config" | "updater",
  fileName: string,
  platform?: InstallerPlatform
): string {
  if (kind === "installer" && platform) {
    return join("assets", kind, platform, fileName);
  }
  return join("assets", kind, fileName);
}

function relativeMcpAssetPath(mcpId: string, version: string, fileName: string): string {
  return join("assets", "mcp", mcpId, version, fileName);
}

function absoluteAssetPath(relativePath: string): string {
  const env = getEnv();
  return resolve(env.storageDir, relativePath);
}

async function ensureStorageDirs(): Promise<void> {
  await mkdir(resolve(getEnv().storageDir, "releases"), { recursive: true });
  await mkdir(getInstallerDir(), { recursive: true });
  await mkdir(getConfigDir(), { recursive: true });
  await mkdir(getUpdaterDir(), { recursive: true });
  await mkdir(getMcpDir(), { recursive: true });
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

export function normalizeReleaseChannel(raw: unknown): ReleaseChannel | null {
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "stable") {
    return "stable";
  }
  if (normalized === "beta") {
    return "beta";
  }
  if (normalized === "alpha") {
    return "alpha";
  }
  if (normalized === "canary") {
    return "canary";
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
    changelog: typeof data.changelog === "string" ? data.changelog.trim() : "",
    thumbnailUrl: typeof data.thumbnailUrl === "string" ? data.thumbnailUrl.trim() : "",
    publishedAt:
      typeof data.publishedAt === "string" && data.publishedAt.trim() ? data.publishedAt : nowIso(),
    installer: normalizeAsset(data.installer),
    installers,
    xiakeConfig: normalizeAsset(data.xiakeConfig),
    updaterAssets: Array.isArray(data.updaterAssets)
      ? data.updaterAssets
          .map((item) => normalizeAsset(item))
          .filter((item): item is ReleaseAsset => Boolean(item))
          .slice(0, UPDATER_ASSET_MAX_ENTRIES)
      : [],
  };
}

function normalizeMcpManifest(raw: unknown, fallbackId?: string, fallbackVersion?: string): McpManifest | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : fallbackId;
  const name =
    typeof data.name === "string" && data.name.trim()
      ? data.name.trim()
      : typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName.trim()
        : fallbackId;
  const version =
    typeof data.version === "string" && data.version.trim() ? data.version.trim() : fallbackVersion;

  if (!id || !name || !version) {
    return null;
  }

  return {
    ...data,
    schemaVersion:
      typeof data.schemaVersion === "string" && data.schemaVersion.trim() ? data.schemaVersion.trim() : "1.0",
    id,
    name,
    version,
  };
}

function normalizeTaskPriority(raw: unknown): AdminTask["priority"] {
  if (raw === "high" || raw === "low") {
    return raw;
  }
  return "medium";
}

function normalizeTask(raw: unknown): AdminTask | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;
  if (typeof data.id !== "string" || !data.id.trim() || typeof data.title !== "string" || !data.title.trim()) {
    return null;
  }

  return {
    id: data.id.trim(),
    title: data.title.trim(),
    description: typeof data.description === "string" ? data.description.trim() : "",
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl.trim() : "",
    done: data.done === true,
    priority: normalizeTaskPriority(data.priority),
    dueDate: typeof data.dueDate === "string" ? data.dueDate : "",
    updatedAt: typeof data.updatedAt === "string" && data.updatedAt.trim() ? data.updatedAt : nowIso(),
  };
}

function normalizeSiteSettings(raw: unknown): SiteSettings | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;
  if (typeof data.brandName !== "string" || typeof data.siteName !== "string") {
    return null;
  }

  return {
    brandName: data.brandName.trim(),
    siteName: data.siteName.trim(),
    brandLogoUrl: typeof data.brandLogoUrl === "string" ? data.brandLogoUrl.trim() : "",
    brandUrl: typeof data.brandUrl === "string" ? data.brandUrl.trim() : "",
    seoTitle: typeof data.seoTitle === "string" ? data.seoTitle.trim() : "",
    seoDescription: typeof data.seoDescription === "string" ? data.seoDescription.trim() : "",
    seoKeywords: typeof data.seoKeywords === "string" ? data.seoKeywords.trim() : "",
    updatedAt: typeof data.updatedAt === "string" && data.updatedAt.trim() ? data.updatedAt : nowIso(),
  };
}

function normalizeMcpRelease(raw: unknown): McpRelease | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const packageAsset = normalizeAsset(data.package);
  const channel = normalizeReleaseChannel(data.channel) || "stable";
  const manifest = normalizeMcpManifest(data.manifest, typeof data.id === "string" ? data.id : undefined);
  if (
    typeof data.id !== "string" ||
    !data.id.trim() ||
    typeof data.version !== "string" ||
    !data.version.trim() ||
    typeof data.publishedAt !== "string" ||
    !data.publishedAt.trim() ||
    !packageAsset ||
    !manifest
  ) {
    return null;
  }

  return {
    id: data.id.trim(),
    version: data.version.trim(),
    publishedAt: data.publishedAt.trim(),
    package: packageAsset,
    manifest,
    channel,
  };
}

function normalizeMcpRegistryEntry(raw: unknown, key: string): McpRegistryEntry | null {
  const asRelease = normalizeMcpRelease(raw);
  if (asRelease) {
    return { latest: asRelease, versions: [asRelease] };
  }

  if (!raw || typeof raw !== "object") {
    return null;
  }
  const data = raw as Record<string, unknown>;
  const latest = normalizeMcpRelease(data.latest);
  if (!latest) {
    return null;
  }
  const versionsRaw = Array.isArray(data.versions) ? data.versions : [];
  const versions = versionsRaw
    .map((item) => normalizeMcpRelease(item))
    .filter((item): item is McpRelease => Boolean(item));
  const hasLatest = versions.some((item) => item.version === latest.version);
  const merged = hasLatest ? versions : [...versions, latest];
  return {
    latest,
    versions: merged.filter((item) => item.id === key),
  };
}

function normalizeProduct(raw: unknown): Product | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const data = raw as Record<string, unknown>;
  if (typeof data.id !== "string" || !data.id.trim() || typeof data.name !== "string" || !data.name.trim()) {
    return null;
  }
  return {
    id: data.id.trim(),
    name: data.name.trim(),
    description: typeof data.description === "string" ? data.description.trim() : "",
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl.trim() : "",
    priceCny: typeof data.priceCny === "string" ? data.priceCny.trim() : "",
    link: typeof data.link === "string" ? data.link.trim() : "",
    published: Boolean(data.published),
    updatedAt: typeof data.updatedAt === "string" && data.updatedAt.trim() ? data.updatedAt.trim() : nowIso(),
  };
}

function normalizeMcpShelfItem(raw: unknown): McpShelfItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const data = raw as Record<string, unknown>;
  const channel = normalizeReleaseChannel(data.channel) || "stable";
  if (
    typeof data.mcpId !== "string" ||
    !data.mcpId.trim() ||
    typeof data.version !== "string" ||
    !data.version.trim()
  ) {
    return null;
  }
  return {
    mcpId: data.mcpId.trim(),
    version: data.version.trim(),
    channel,
    published: Boolean(data.published),
    updatedAt: typeof data.updatedAt === "string" && data.updatedAt.trim() ? data.updatedAt.trim() : nowIso(),
  };
}

export async function readLatestRelease(channel: ReleaseChannel = "stable"): Promise<LatestRelease | null> {
  await ensureStorageDirs();

  try {
    const content = await readFile(getReleaseFilePath(channel), "utf-8");
    return normalizeRelease(JSON.parse(content));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function readMcpRegistry(channel: ReleaseChannel = "stable"): Promise<Record<string, McpRegistryEntry>> {
  await ensureStorageDirs();

  try {
    const content = await readFile(getMcpReleaseFilePath(channel), "utf-8");
    const raw = JSON.parse(content) as Record<string, unknown>;
    const entries = Object.entries(raw)
      .map(([key, value]) => {
        const normalized = normalizeMcpRegistryEntry(value, key);
        if (!normalized) {
          return null;
        }
        return [key, normalized] as const;
      })
      .filter((item): item is readonly [string, McpRegistryEntry] => Boolean(item));
    return Object.fromEntries(entries);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function writeMcpRegistry(
  registry: Record<string, McpRegistryEntry>,
  channel: ReleaseChannel = "stable"
): Promise<void> {
  await ensureStorageDirs();
  await writeFile(getMcpReleaseFilePath(channel), `${JSON.stringify(registry, null, 2)}\n`, "utf-8");
}

export async function readProducts(): Promise<Product[]> {
  await ensureStorageDirs();
  try {
    const content = await readFile(getProductsFilePath(), "utf-8");
    const raw = JSON.parse(content);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map((item) => normalizeProduct(item))
      .filter((item): item is Product => Boolean(item))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function writeProducts(products: Product[]): Promise<void> {
  await ensureStorageDirs();
  await writeFile(getProductsFilePath(), `${JSON.stringify(products, null, 2)}\n`, "utf-8");
}

export async function upsertProduct(product: Omit<Product, "updatedAt">): Promise<Product> {
  const id = product.id.trim().toLowerCase();
  if (!id) {
    throw new Error("商品 ID 不能为空");
  }
  if (!product.name.trim()) {
    throw new Error("商品名称不能为空");
  }

  const all = await readProducts();
  const next: Product = {
    ...product,
    id,
    name: product.name.trim(),
    description: product.description.trim(),
    imageUrl: product.imageUrl.trim(),
    priceCny: product.priceCny.trim(),
    link: product.link.trim(),
    updatedAt: nowIso(),
  };
  const filtered = all.filter((item) => item.id !== id);
  await writeProducts([...filtered, next].sort((a, b) => a.id.localeCompare(b.id)));
  return next;
}

export async function deleteProduct(productId: string): Promise<void> {
  const id = productId.trim().toLowerCase();
  const all = await readProducts();
  await writeProducts(all.filter((item) => item.id !== id));
}

export async function listPublishedProducts(): Promise<Product[]> {
  const all = await readProducts();
  return all.filter((item) => item.published);
}

export async function readTasks(): Promise<AdminTask[]> {
  await ensureStorageDirs();
  try {
    const content = await readFile(getTasksFilePath(), "utf-8");
    const raw = JSON.parse(content);
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => normalizeTask(item))
      .filter((item): item is AdminTask => Boolean(item))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
    throw error;
  }
}

export async function writeTasks(tasks: AdminTask[]): Promise<void> {
  await ensureStorageDirs();
  await writeFile(getTasksFilePath(), `${JSON.stringify(tasks, null, 2)}\n`, "utf-8");
}

export async function upsertTask(task: Omit<AdminTask, "updatedAt">): Promise<AdminTask> {
  const title = task.title.trim();
  if (!title) throw new Error("任务标题不能为空");
  const id = task.id.trim() || `task-${Date.now()}`;
  const next: AdminTask = {
    ...task,
    id,
    title,
    description: task.description.trim(),
    imageUrl: task.imageUrl.trim(),
    dueDate: task.dueDate.trim(),
    updatedAt: nowIso(),
  };

  const all = await readTasks();
  const filtered = all.filter((item) => item.id !== id);
  await writeTasks([next, ...filtered]);
  return next;
}

export async function toggleTask(taskId: string): Promise<void> {
  const id = taskId.trim();
  const all = await readTasks();
  await writeTasks(
    all.map((item) =>
      item.id === id
        ? {
            ...item,
            done: !item.done,
            updatedAt: nowIso(),
          }
        : item,
    ),
  );
}

export async function deleteTask(taskId: string): Promise<void> {
  const id = taskId.trim();
  const all = await readTasks();
  await writeTasks(all.filter((item) => item.id !== id));
}

export async function readSiteSettings(): Promise<SiteSettings | null> {
  await ensureStorageDirs();
  try {
    const content = await readFile(getSiteSettingsFilePath(), "utf-8");
    return normalizeSiteSettings(JSON.parse(content));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return null;
    throw error;
  }
}

export async function writeSiteSettings(settings: Omit<SiteSettings, "updatedAt">): Promise<SiteSettings> {
  const next: SiteSettings = {
    ...settings,
    updatedAt: nowIso(),
  };
  await ensureStorageDirs();
  await writeFile(getSiteSettingsFilePath(), `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  return next;
}

export async function readMcpShelf(): Promise<McpShelfItem[]> {
  await ensureStorageDirs();
  try {
    const content = await readFile(getMcpShelfFilePath(), "utf-8");
    const raw = JSON.parse(content);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map((item) => normalizeMcpShelfItem(item))
      .filter((item): item is McpShelfItem => Boolean(item))
      .sort((a, b) => `${a.channel}:${a.mcpId}`.localeCompare(`${b.channel}:${b.mcpId}`));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function writeMcpShelf(items: McpShelfItem[]): Promise<void> {
  await ensureStorageDirs();
  await writeFile(getMcpShelfFilePath(), `${JSON.stringify(items, null, 2)}\n`, "utf-8");
}

export async function setMcpShelfStatus(params: {
  mcpId: string;
  version: string;
  channel: ReleaseChannel;
  published: boolean;
}): Promise<McpShelfItem> {
  const item: McpShelfItem = {
    mcpId: params.mcpId.trim(),
    version: params.version.trim(),
    channel: params.channel,
    published: params.published,
    updatedAt: nowIso(),
  };
  if (!item.mcpId || !item.version) {
    throw new Error("mcpId 和 version 不能为空");
  }
  const all = await readMcpShelf();
  const filtered = all.filter(
    (current) => !(current.mcpId === item.mcpId && current.version === item.version && current.channel === item.channel)
  );
  await writeMcpShelf([...filtered, item]);
  return item;
}

export async function listPublishedMcpShelf(channel: ReleaseChannel = "stable"): Promise<McpRelease[]> {
  const [items, releases] = await Promise.all([readMcpShelf(), listMcpReleases(channel)]);
  const index = new Map(releases.map((release) => [`${release.id}@${release.version}@${channel}`, release]));
  return items
    .filter((item) => item.channel === channel && item.published)
    .map((item) => index.get(`${item.mcpId}@${item.version}@${channel}`))
    .filter((item): item is McpRelease => Boolean(item));
}

export async function writeLatestRelease(release: LatestRelease, channel: ReleaseChannel = "stable"): Promise<void> {
  await ensureStorageDirs();
  await writeFile(getReleaseFilePath(channel), `${JSON.stringify(release, null, 2)}\n`, "utf-8");
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

function assertUpdaterFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) {
    throw new Error("更新产物文件名不能为空");
  }
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    throw new Error("更新产物文件名不允许包含路径分隔符");
  }
  if (!UPDATER_FILE_NAME_PATTERN.test(trimmed)) {
    throw new Error("更新产物文件名包含非法字符，仅允许字母、数字、点、下划线和中划线");
  }
  return trimmed;
}

function assertMcpId(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    throw new Error("mcpId 不能为空");
  }
  if (!MCP_ID_PATTERN.test(trimmed)) {
    throw new Error("mcpId 格式非法，仅支持小写字母、数字、点、下划线和中划线");
  }
  return trimmed;
}

function assertMcpPackageFileName(fileName: string): string {
  const safeName = ensureSafeFileName(fileName);
  const lower = safeName.toLowerCase();
  if (!MCP_PACKAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw new Error(`MCP 包扩展名不支持，仅支持 ${MCP_PACKAGE_EXTENSIONS.join(" / ")}`);
  }
  return safeName;
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
  channel?: ReleaseChannel;
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

  const channel = normalizeReleaseChannel(params.channel) || "stable";
  const latest = (await readLatestRelease(channel)) ?? createEmptyRelease();
  latest.installers = { ...(latest.installers || {}), [platform]: asset };
  if (platform === "windows" || !latest.installer) {
    latest.installer = asset;
  }
  latest.version =
    params.version?.trim() || detectVersionFromFileName(safeName) || latest.version || "dev";
  latest.publishedAt = nowIso();

  await writeLatestRelease(latest, channel);
  return { release: latest, asset };
}

export async function storeXiakeConfig(params: {
  fileName: string;
  bytes: Uint8Array;
  channel?: ReleaseChannel;
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

  const channel = normalizeReleaseChannel(params.channel) || "stable";
  const latest = (await readLatestRelease(channel)) ?? createEmptyRelease();
  latest.xiakeConfig = asset;
  latest.publishedAt = nowIso();

  await writeLatestRelease(latest, channel);
  return { release: latest, asset };
}

export async function storeUpdaterArtifact(params: {
  fileName: string;
  bytes: Uint8Array;
  channel?: ReleaseChannel;
}): Promise<{ release: LatestRelease; asset: ReleaseAsset }> {
  const env = getEnv();
  await ensureStorageDirs();

  const safeName = assertUpdaterFileName(params.fileName);
  assertFileSize(params.bytes.byteLength, env.maxInstallerSizeBytes, "更新产物");

  const outputPath = resolve(getUpdaterDir(), safeName);
  await writeFile(outputPath, params.bytes);

  const asset: ReleaseAsset = {
    name: safeName,
    relativePath: relativeAssetPath("updater", safeName),
    size: params.bytes.byteLength,
    sha256: sha256Hex(params.bytes),
    uploadedAt: nowIso(),
  };

  const channel = normalizeReleaseChannel(params.channel) || "stable";
  const latest = (await readLatestRelease(channel)) ?? createEmptyRelease();
  const merged = [...(latest.updaterAssets || []).filter((item) => item.name !== safeName), asset]
    .sort((a, b) => (a.name === b.name ? 0 : a.name < b.name ? -1 : 1))
    .slice(-UPDATER_ASSET_MAX_ENTRIES);
  latest.updaterAssets = merged;
  latest.publishedAt = nowIso();
  await writeLatestRelease(latest, channel);

  return { release: latest, asset };
}

export async function storeMcpPackage(params: {
  mcpId: string;
  fileName: string;
  bytes: Uint8Array;
  version: string;
  manifest: McpManifest;
  channel?: ReleaseChannel;
}): Promise<{ release: McpRelease; asset: ReleaseAsset }> {
  const env = getEnv();
  await ensureStorageDirs();

  const mcpId = assertMcpId(params.mcpId);
  const version = params.version.trim();
  if (!version) {
    throw new Error("MCP version 不能为空");
  }

  const manifest = normalizeMcpManifest(params.manifest, mcpId, version);
  if (!manifest) {
    throw new Error("MCP manifest 非法或缺少必要字段");
  }
  if (manifest.id !== mcpId) {
    throw new Error(`MCP manifest.id 不匹配 mcpId: ${manifest.id} !== ${mcpId}`);
  }
  if (manifest.version !== version) {
    throw new Error(`MCP manifest.version 不匹配 version: ${manifest.version} !== ${version}`);
  }

  const safeName = assertMcpPackageFileName(params.fileName);
  assertFileSize(params.bytes.byteLength, env.maxMcpPackageSizeBytes, "MCP 包");

  const outputDir = getMcpDir(mcpId, version);
  await mkdir(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, safeName);
  await writeFile(outputPath, params.bytes);

  const asset: ReleaseAsset = {
    name: safeName,
    relativePath: relativeMcpAssetPath(mcpId, version, safeName),
    size: params.bytes.byteLength,
    sha256: sha256Hex(params.bytes),
    uploadedAt: nowIso(),
  };

  const channel = normalizeReleaseChannel(params.channel) || "stable";
  const nextRelease: McpRelease = {
    id: mcpId,
    version,
    publishedAt: nowIso(),
    package: asset,
    manifest,
    channel,
  };

  const registry = await readMcpRegistry(channel);
  const existing = registry[mcpId];
  const existingVersions = existing?.versions || [];
  const filtered = existingVersions.filter((item) => item.version !== version);
  registry[mcpId] = {
    latest: nextRelease,
    versions: [...filtered, nextRelease],
  };
  await writeMcpRegistry(registry, channel);

  return { release: nextRelease, asset };
}

export interface ResolvedDownload {
  release: LatestRelease;
  asset: ReleaseAsset;
  absolutePath: string;
}

export async function listUpdaterAssets(prefix?: string): Promise<ReleaseAsset[]> {
  await ensureStorageDirs();
  const dir = getUpdaterDir();
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const normalizedPrefix = typeof prefix === "string" ? prefix.trim() : "";
  const results: ReleaseAsset[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const fileName = entry.name;
    if (normalizedPrefix && !fileName.startsWith(normalizedPrefix)) {
      continue;
    }
    if (!UPDATER_FILE_NAME_PATTERN.test(fileName)) {
      continue;
    }

    const absolutePath = resolve(dir, fileName);
    const fileStat = await stat(absolutePath).catch(() => null);
    if (!fileStat || !fileStat.isFile() || fileStat.size <= 0) {
      continue;
    }

    results.push({
      name: fileName,
      relativePath: relativeAssetPath("updater", fileName),
      size: fileStat.size,
      sha256: "",
      uploadedAt: fileStat.mtime.toISOString(),
    });
  }

  return results.sort((a, b) => (a.name === b.name ? 0 : a.name < b.name ? -1 : 1));
}

export async function resolveUpdaterArtifact(fileName: string): Promise<{
  asset: ReleaseAsset;
  absolutePath: string;
}> {
  await ensureStorageDirs();
  const safeName = assertUpdaterFileName(fileName);
  const absolutePath = resolve(getUpdaterDir(), safeName);
  await ensureReadable(absolutePath);

  const fileStat = await stat(absolutePath);
  return {
    asset: {
      name: safeName,
      relativePath: relativeAssetPath("updater", safeName),
      size: fileStat.size,
      sha256: "",
      uploadedAt: fileStat.mtime.toISOString(),
    },
    absolutePath,
  };
}

export async function resolveLatestInstaller(
  platform?: InstallerPlatform,
  channel: ReleaseChannel = "stable"
): Promise<ResolvedDownload> {
  const latest = await readLatestRelease(channel);
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

export async function listInstallerHistory(): Promise<AdminInstallerHistoryItem[]> {
  await ensureStorageDirs();
  const results: AdminInstallerHistoryItem[] = [];

  for (const platform of INSTALLER_PLATFORMS) {
    const dir = getInstallerDir(platform);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const fileName = entry.name;
      const absolutePath = resolve(dir, fileName);
      const fileStat = await stat(absolutePath).catch(() => null);
      if (!fileStat || !fileStat.isFile() || fileStat.size <= 0) {
        continue;
      }
      results.push({
        fileName,
        platform,
        size: fileStat.size,
        uploadedAt: fileStat.mtime.toISOString(),
        relativePath: relativeAssetPath("installer", fileName, platform),
        versionHint: detectVersionFromFileName(fileName),
      });
    }
  }

  return results.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function resolveLatestXiakeConfig(channel: ReleaseChannel = "stable"): Promise<ResolvedDownload> {
  const latest = await readLatestRelease(channel);
  if (!latest?.xiakeConfig) {
    throw new Error("尚未上传 clawos_xiake.json");
  }

  const absolutePath = absoluteAssetPath(latest.xiakeConfig.relativePath);
  await ensureReadable(absolutePath);
  return { release: latest, asset: latest.xiakeConfig, absolutePath };
}

export async function listMcpReleases(channel: ReleaseChannel = "stable"): Promise<McpRelease[]> {
  const registry = await readMcpRegistry(channel);
  return Object.values(registry)
    .map((entry) => entry.latest)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function readMcpRelease(mcpId: string, channel: ReleaseChannel = "stable"): Promise<McpRelease | null> {
  const registry = await readMcpRegistry(channel);
  const normalizedId = assertMcpId(mcpId);
  return registry[normalizedId]?.latest || null;
}

export async function listMcpReleaseVersions(
  mcpId: string,
  channel: ReleaseChannel = "stable"
): Promise<McpRelease[]> {
  const registry = await readMcpRegistry(channel);
  const normalizedId = assertMcpId(mcpId);
  return [...(registry[normalizedId]?.versions || [])].sort((a, b) => {
    const publishedAtOrder = b.publishedAt.localeCompare(a.publishedAt);
    if (publishedAtOrder !== 0) {
      return publishedAtOrder;
    }
    return compareVersionDesc(a.version, b.version);
  });
}

export async function readMcpReleaseByVersion(
  mcpId: string,
  version: string,
  channel: ReleaseChannel = "stable"
): Promise<McpRelease | null> {
  const versions = await listMcpReleaseVersions(mcpId, channel);
  const normalizedVersion = version.trim();
  if (!normalizedVersion) {
    throw new Error("version 不能为空");
  }
  return versions.find((item) => item.version === normalizedVersion) || null;
}

export async function resolveLatestMcpPackage(
  mcpId: string,
  channel: ReleaseChannel = "stable"
): Promise<{ release: McpRelease; asset: ReleaseAsset; absolutePath: string }> {
  const release = await readMcpRelease(mcpId, channel);
  if (!release) {
    throw new Error(`MCP 不存在: ${mcpId}`);
  }

  const absolutePath = absoluteAssetPath(release.package.relativePath);
  await ensureReadable(absolutePath);
  return {
    release,
    asset: release.package,
    absolutePath,
  };
}

export async function resolveMcpPackageByVersion(
  mcpId: string,
  version: string,
  channel: ReleaseChannel = "stable"
): Promise<{ release: McpRelease; asset: ReleaseAsset; absolutePath: string }> {
  const release = await readMcpReleaseByVersion(mcpId, version, channel);
  if (!release) {
    throw new Error(`MCP 版本不存在: ${mcpId}@${version}`);
  }

  const absolutePath = absoluteAssetPath(release.package.relativePath);
  await ensureReadable(absolutePath);
  return {
    release,
    asset: release.package,
    absolutePath,
  };
}
