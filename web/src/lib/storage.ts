import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { getEnv } from "./env";
import { sha256Hex } from "./hash";
import type {
  AdminTask,
  DownloadFile,
  DownloadItem,
  McpManifest,
  McpRegistryEntry,
  McpRelease,
  McpShelfItem,
  Order,
  OrderStatus,
  Product,
  ReleaseChannel,
  SiteSettings,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
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
const DOWNLOAD_ITEMS_FILE_NAME = "download-items.json";
const ORDERS_FILE_NAME = "orders.json";
const MCP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const MCP_PACKAGE_EXTENSIONS = [".zip", ".tgz", ".tar.gz"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function nowIso(): string {
  return new Date().toISOString();
}

function compareVersionDesc(left: string, right: string): number {
  return right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" });
}

function ensureSafeFileName(fileName: string): string {
  const name = basename(fileName).trim();
  if (!name) throw new Error("文件名不能为空");
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function assertMcpId(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) throw new Error("mcpId 不能为空");
  if (!MCP_ID_PATTERN.test(trimmed)) throw new Error("mcpId 格式非法");
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
  if (size <= 0) throw new Error(`${label}不能为空`);
  if (size > maxBytes) throw new Error(`${label}超过大小限制`);
}

async function ensureReadable(filePath: string): Promise<void> {
  await access(filePath, fsConstants.R_OK);
}

// ---------------------------------------------------------------------------
// Storage path helpers
// ---------------------------------------------------------------------------
function getDownloadsDir(): string {
  return resolve(getEnv().storageDir, "downloads");
}

function getDownloadItemDir(itemId: string): string {
  return resolve(getDownloadsDir(), itemId);
}

function getMcpDir(mcpId?: string, version?: string): string {
  const env = getEnv();
  if (mcpId && version) return resolve(env.storageDir, "assets", "mcp", mcpId, version);
  if (mcpId) return resolve(env.storageDir, "assets", "mcp", mcpId);
  return resolve(env.storageDir, "assets", "mcp");
}

function getMcpReleaseFilePath(channel: ReleaseChannel): string {
  const env = getEnv();
  return resolve(env.storageDir, "releases", MCP_RELEASE_FILE_NAME_BY_CHANNEL[channel]);
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

function getDownloadItemsFilePath(): string {
  const env = getEnv();
  return resolve(env.storageDir, "releases", DOWNLOAD_ITEMS_FILE_NAME);
}

function getOrdersFilePath(): string {
  const env = getEnv();
  return resolve(env.storageDir, "releases", ORDERS_FILE_NAME);
}

async function ensureStorageDirs(): Promise<void> {
  const env = getEnv();
  await mkdir(resolve(env.storageDir, "releases"), { recursive: true });
  await mkdir(getDownloadsDir(), { recursive: true });
  await mkdir(getMcpDir(), { recursive: true });
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------
function normalizeAsset(raw: unknown): import("./types").ReleaseAsset | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (
    typeof d.name !== "string" ||
    typeof d.relativePath !== "string" ||
    typeof d.size !== "number" ||
    typeof d.sha256 !== "string" ||
    typeof d.uploadedAt !== "string"
  )
    return null;
  return { name: d.name, relativePath: d.relativePath, size: d.size, sha256: d.sha256, uploadedAt: d.uploadedAt };
}

function normalizeDownloadFile(raw: unknown): DownloadFile | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (
    typeof d.name !== "string" ||
    typeof d.size !== "number" ||
    typeof d.sha256 !== "string" ||
    typeof d.uploadedAt !== "string" ||
    typeof d.relativePath !== "string"
  )
    return null;
  return { name: d.name, size: d.size, sha256: d.sha256, uploadedAt: d.uploadedAt, relativePath: d.relativePath };
}

function normalizeDownloadItem(raw: unknown): DownloadItem | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.id !== "string" || !d.id.trim()) return null;
  const files = Array.isArray(d.files) ? d.files.map(normalizeDownloadFile).filter((f): f is DownloadFile => Boolean(f)) : [];
  return {
    id: d.id.trim(),
    name: typeof d.name === "string" ? d.name.trim() : "",
    description: typeof d.description === "string" ? d.description.trim() : "",
    logo: typeof d.logo === "string" ? d.logo.trim() : "",
    version: typeof d.version === "string" ? d.version.trim() : "",
    files,
    published: Boolean(d.published),
    sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : 0,
    createdAt: typeof d.createdAt === "string" ? d.createdAt : nowIso(),
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : nowIso(),
  };
}

function normalizeProduct(raw: unknown): Product | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.id !== "string" || !d.id.trim() || typeof d.name !== "string" || !d.name.trim()) return null;
  return {
    id: d.id.trim(),
    name: d.name.trim(),
    description: typeof d.description === "string" ? d.description.trim() : "",
    imageUrl: typeof d.imageUrl === "string" ? d.imageUrl.trim() : "",
    priceCny: typeof d.priceCny === "string" ? d.priceCny.trim() : "",
    link: typeof d.link === "string" ? d.link.trim() : "",
    published: Boolean(d.published),
    requiresLogistics: Boolean(d.requiresLogistics),
    updatedAt: typeof d.updatedAt === "string" && d.updatedAt.trim() ? d.updatedAt.trim() : nowIso(),
  };
}

function normalizeTask(raw: unknown): AdminTask | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.id !== "string" || !d.id.trim() || typeof d.title !== "string" || !d.title.trim()) return null;
  return {
    id: d.id.trim(),
    title: d.title.trim(),
    description: typeof d.description === "string" ? d.description.trim() : "",
    imageUrl: typeof d.imageUrl === "string" ? d.imageUrl.trim() : "",
    done: d.done === true,
    priority: d.priority === "high" || d.priority === "low" ? d.priority : "medium",
    dueDate: typeof d.dueDate === "string" ? d.dueDate : "",
    updatedAt: typeof d.updatedAt === "string" && d.updatedAt.trim() ? d.updatedAt.trim() : nowIso(),
  };
}

function normalizeSiteSettings(raw: unknown): SiteSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.brandName !== "string" || typeof d.siteName !== "string") return null;
  return {
    brandName: d.brandName.trim(),
    siteName: d.siteName.trim(),
    brandLogoUrl: typeof d.brandLogoUrl === "string" ? d.brandLogoUrl.trim() : "",
    brandUrl: typeof d.brandUrl === "string" ? d.brandUrl.trim() : "",
    seoTitle: typeof d.seoTitle === "string" ? d.seoTitle.trim() : "",
    seoDescription: typeof d.seoDescription === "string" ? d.seoDescription.trim() : "",
    seoKeywords: typeof d.seoKeywords === "string" ? d.seoKeywords.trim() : "",
    updatedAt: typeof d.updatedAt === "string" && d.updatedAt.trim() ? d.updatedAt.trim() : nowIso(),
  };
}

function normalizeMcpManifest(raw: unknown, fallbackId?: string, fallbackVersion?: string): McpManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const id = typeof d.id === "string" && d.id.trim() ? d.id.trim() : fallbackId;
  const name =
    typeof d.name === "string" && d.name.trim()
      ? d.name.trim()
      : typeof d.displayName === "string" && d.displayName.trim()
        ? d.displayName.trim()
        : fallbackId;
  const version =
    typeof d.version === "string" && d.version.trim() ? d.version.trim() : fallbackVersion;
  if (!id || !name || !version) return null;
  return {
    ...d,
    schemaVersion: typeof d.schemaVersion === "string" && d.schemaVersion.trim() ? d.schemaVersion.trim() : "1.0",
    id,
    name,
    version,
  };
}

function normalizeMcpRelease(raw: unknown): McpRelease | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const packageAsset = normalizeAsset(d.package);
  const channel = normalizeReleaseChannel(d.channel) || "stable";
  const manifest = normalizeMcpManifest(d.manifest, typeof d.id === "string" ? d.id : undefined);
  if (
    typeof d.id !== "string" || !d.id.trim() ||
    typeof d.version !== "string" || !d.version.trim() ||
    typeof d.publishedAt !== "string" || !d.publishedAt.trim() ||
    !packageAsset || !manifest
  )
    return null;
  return { id: d.id.trim(), version: d.version.trim(), publishedAt: d.publishedAt.trim(), package: packageAsset, manifest, channel };
}

function normalizeReleaseChannel(raw: unknown): ReleaseChannel | null {
  if (typeof raw !== "string") return null;
  const n = raw.trim().toLowerCase();
  if (n === "stable" || n === "beta" || n === "alpha" || n === "canary") return n;
  return null;
}

function normalizeMcpRegistryEntry(raw: unknown, key: string): McpRegistryEntry | null {
  const asRelease = normalizeMcpRelease(raw);
  if (asRelease) return { latest: asRelease, versions: [asRelease] };
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const latest = normalizeMcpRelease(d.latest);
  if (!latest) return null;
  const versionsRaw = Array.isArray(d.versions) ? d.versions : [];
  const versions = versionsRaw.map(normalizeMcpRelease).filter((item): item is McpRelease => Boolean(item));
  const hasLatest = versions.some((item) => item.version === latest.version);
  const merged = hasLatest ? versions : [...versions, latest];
  return { latest, versions: merged.filter((item) => item.id === key) };
}

function normalizeMcpShelfItem(raw: unknown): McpShelfItem | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const channel = normalizeReleaseChannel(d.channel) || "stable";
  if (typeof d.mcpId !== "string" || !d.mcpId.trim() || typeof d.version !== "string" || !d.version.trim()) return null;
  return {
    mcpId: d.mcpId.trim(),
    version: d.version.trim(),
    channel,
    published: Boolean(d.published),
    updatedAt: typeof d.updatedAt === "string" && d.updatedAt.trim() ? d.updatedAt.trim() : nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Download Items
// ---------------------------------------------------------------------------

export async function readDownloadItems(): Promise<DownloadItem[]> {
  await ensureStorageDirs();
  try {
    const content = await readFile(getDownloadItemsFilePath(), "utf-8");
    const raw = JSON.parse(content);
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => normalizeDownloadItem(item))
      .filter((item): item is DownloadItem => Boolean(item))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
    throw error;
  }
}

export async function writeDownloadItems(items: DownloadItem[]): Promise<void> {
  await ensureStorageDirs();
  await writeFile(getDownloadItemsFilePath(), `${JSON.stringify(items, null, 2)}\n`, "utf-8");
}

export async function upsertDownloadItem(
  item: Omit<DownloadItem, "createdAt" | "updatedAt">,
): Promise<DownloadItem> {
  const id = item.id.trim().toLowerCase();
  if (!id) throw new Error("下载项 ID 不能为空");
  if (!item.name.trim()) throw new Error("名称不能为空");

  const all = await readDownloadItems();
  const now = nowIso();
  const next: DownloadItem = {
    ...item,
    id,
    name: item.name.trim(),
    description: item.description.trim(),
    logo: item.logo?.trim() ?? "",
    version: item.version.trim(),
    files: item.files ?? [],
    published: Boolean(item.published),
    sortOrder: item.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  const idx = all.findIndex((i) => i.id === id);
  if (idx >= 0) {
    next.createdAt = all[idx].createdAt;
    all[idx] = next;
  } else {
    all.push(next);
  }

  await writeDownloadItems(all.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)));
  return next;
}

export async function deleteDownloadItem(itemId: string): Promise<void> {
  const all = await readDownloadItems();
  await writeDownloadItems(all.filter((item) => item.id !== itemId.trim().toLowerCase()));
}

export async function listPublishedDownloadItems(): Promise<DownloadItem[]> {
  const all = await readDownloadItems();
  return all.filter((item) => item.published);
}

export async function getDownloadItemById(itemId: string): Promise<DownloadItem | null> {
  const all = await readDownloadItems();
  return all.find((item) => item.id === itemId.trim().toLowerCase()) ?? null;
}

export async function storeDownloadFile(
  itemId: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<DownloadFile> {
  const env = getEnv();
  await ensureStorageDirs();
  const safeName = ensureSafeFileName(fileName);
  assertFileSize(bytes.byteLength, env.maxInstallerSizeBytes, "文件");

  const itemDir = getDownloadItemDir(itemId);
  await mkdir(itemDir, { recursive: true });
  const outputPath = resolve(itemDir, safeName);
  await writeFile(outputPath, bytes);

  const file: DownloadFile = {
    name: safeName,
    relativePath: join("downloads", itemId, safeName),
    size: bytes.byteLength,
    sha256: sha256Hex(bytes),
    uploadedAt: nowIso(),
  };

  // Update item with new file
  const all = await readDownloadItems();
  const idx = all.findIndex((i) => i.id === itemId);
  if (idx >= 0) {
    const existingNames = new Set(all[idx].files.map((f) => f.name));
    if (!existingNames.has(safeName)) {
      all[idx] = { ...all[idx], files: [...all[idx].files, file], updatedAt: nowIso() };
    } else {
      all[idx] = {
        ...all[idx],
        files: all[idx].files.map((f) => (f.name === safeName ? file : f)),
        updatedAt: nowIso(),
      };
    }
    await writeDownloadItems(all);
  }

  return file;
}

export async function resolveDownloadItemFile(
  itemId: string,
  fileName: string,
): Promise<{ item: DownloadItem; file: DownloadFile; absolutePath: string }> {
  const item = await getDownloadItemById(itemId);
  if (!item) throw new Error(`下载项不存在: ${itemId}`);
  const file = item.files.find((f) => f.name === fileName);
  if (!file) throw new Error(`文件不存在: ${fileName}`);
  const absolutePath = resolve(getEnv().storageDir, file.relativePath);
  await ensureReadable(absolutePath);
  return { item, file, absolutePath };
}

export async function reorderDownloadItems(orderedIds: string[]): Promise<void> {
  const all = await readDownloadItems();
  const idOrder = new Map(orderedIds.map((id, i) => [id.trim().toLowerCase(), i]));
  const reordered = [
    ...all
      .filter((item) => !idOrder.has(item.id))
      .map((item) => ({ ...item, sortOrder: item.sortOrder })),
    ...all
      .filter((item) => idOrder.has(item.id))
      .sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999))
      .map((item) => ({ ...item, sortOrder: idOrder.get(item.id) ?? 0 })),
  ];
  await writeDownloadItems(reordered);
}

/**
 * Fetch an external URL and save it to local storage.
 * Returns the local URL path if successful.
 */
export async function fetchExternalUrlAndSave(url: string): Promise<{ localPath: string } | { error: string }> {
  try {
    const urlObj = new URL(url);
    const response = await fetch(urlObj.toString(), {
      headers: {
        "User-Agent": "ClawOS/1.0",
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      return { error: `Failed to fetch: ${response.status} ${response.statusText}` };
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return { error: "URL does not point to an image" };
    }
    const extMatch = contentType.match(/image\/(\w+)/);
    const ext = extMatch ? `.${extMatch[1]}` : ".png";
    const fileName = `logo-${Date.now()}-${randomUUID()}${ext}`;
    const dir = resolve(getEnv().storageDir, "assets", "downloads-logos");
    await mkdir(dir, { recursive: true });
    const arrayBuffer = await response.arrayBuffer();
    await writeFile(resolve(dir, fileName), new Uint8Array(arrayBuffer));
    return { localPath: `/admin-assets/downloads-logos/${fileName}` };
  } catch (err) {
    return { error: `Failed to fetch external URL: ${(err as Error).message}` };
  }
}

// ---------------------------------------------------------------------------
// MCP (kept as-is, unrelated to downloads)
// ---------------------------------------------------------------------------

export async function readMcpRegistry(channel: ReleaseChannel = "stable"): Promise<Record<string, McpRegistryEntry>> {
  await ensureStorageDirs();
  try {
    const content = await readFile(getMcpReleaseFilePath(channel), "utf-8");
    const raw = JSON.parse(content) as Record<string, unknown>;
    return Object.entries(raw)
      .map(([key, value]) => {
        const normalized = normalizeMcpRegistryEntry(value, key);
        return normalized ? ([key, normalized] as const) : null;
      })
      .filter((item): item is readonly [string, McpRegistryEntry] => Boolean(item))
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return {};
    throw error;
  }
}

export async function writeMcpRegistry(
  registry: Record<string, McpRegistryEntry>,
  channel: ReleaseChannel = "stable",
): Promise<void> {
  await ensureStorageDirs();
  await writeFile(getMcpReleaseFilePath(channel), `${JSON.stringify(registry, null, 2)}\n`, "utf-8");
}

export async function listMcpReleases(channel: ReleaseChannel = "stable"): Promise<McpRelease[]> {
  const registry = await readMcpRegistry(channel);
  return Object.values(registry).map((entry) => entry.latest).sort((a, b) => a.id.localeCompare(b.id));
}

export async function resolveLatestMcpPackage(
  mcpId: string,
  channel: ReleaseChannel = "stable",
): Promise<{ release: McpRelease; asset: import("./types").ReleaseAsset; absolutePath: string }> {
  const registry = await readMcpRegistry(channel);
  const normalizedId = assertMcpId(mcpId);
  const release = registry[normalizedId]?.latest;
  if (!release) throw new Error(`MCP 不存在: ${mcpId}`);
  const absolutePath = resolve(getEnv().storageDir, release.package.relativePath);
  await ensureReadable(absolutePath);
  return { release, asset: release.package, absolutePath };
}

export async function readMcpRelease(
  mcpId: string,
  channel: ReleaseChannel = "stable",
): Promise<McpRelease | null> {
  const registry = await readMcpRegistry(channel);
  const normalizedId = assertMcpId(mcpId);
  return registry[normalizedId]?.latest ?? null;
}

export async function listMcpReleaseVersions(
  mcpId: string,
  channel: ReleaseChannel = "stable",
): Promise<McpRelease[]> {
  const registry = await readMcpRegistry(channel);
  const normalizedId = assertMcpId(mcpId);
  return [...(registry[normalizedId]?.versions || [])].sort((a, b) => {
    const publishedAtOrder = b.publishedAt.localeCompare(a.publishedAt);
    if (publishedAtOrder !== 0) return publishedAtOrder;
    return compareVersionDesc(a.version, b.version);
  });
}

export async function resolveMcpPackageByVersion(
  mcpId: string,
  version: string,
  channel: ReleaseChannel = "stable",
): Promise<{ release: McpRelease; asset: import("./types").ReleaseAsset; absolutePath: string }> {
  const normalizedId = assertMcpId(mcpId);
  const normalizedVersion = version.trim();
  if (!normalizedVersion) throw new Error("version 不能为空");
  const registry = await readMcpRegistry(channel);
  const release = registry[normalizedId]?.versions.find((v) => v.version === normalizedVersion);
  if (!release) throw new Error(`MCP 版本不存在: ${normalizedId}@${normalizedVersion}`);
  const absolutePath = resolve(getEnv().storageDir, release.package.relativePath);
  await ensureReadable(absolutePath);
  return { release, asset: release.package, absolutePath };
}

export async function storeMcpPackage(params: {
  mcpId: string;
  fileName: string;
  bytes: Uint8Array;
  version: string;
  manifest: McpManifest;
  channel?: ReleaseChannel;
}): Promise<{ release: McpRelease; asset: import("./types").ReleaseAsset }> {
  const env = getEnv();
  await ensureStorageDirs();
  const mcpId = assertMcpId(params.mcpId);
  const version = params.version.trim();
  if (!version) throw new Error("MCP version 不能为空");

  const manifest = normalizeMcpManifest(params.manifest, mcpId, version);
  if (!manifest) throw new Error("MCP manifest 非法或缺少必要字段");
  if (manifest.id !== mcpId) throw new Error(`MCP manifest.id 不匹配: ${manifest.id} !== ${mcpId}`);
  if (manifest.version !== version) throw new Error(`MCP manifest.version 不匹配: ${manifest.version} !== ${version}`);

  const safeName = assertMcpPackageFileName(params.fileName);
  assertFileSize(params.bytes.byteLength, env.maxMcpPackageSizeBytes, "MCP 包");

  const outputDir = getMcpDir(mcpId, version);
  await mkdir(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, safeName);
  await writeFile(outputPath, params.bytes);

  const asset: import("./types").ReleaseAsset = {
    name: safeName,
    relativePath: join("assets", "mcp", mcpId, version, safeName),
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
  const existingVersions = registry[mcpId]?.versions || [];
  const filtered = existingVersions.filter((v) => v.version !== version);
  registry[mcpId] = { latest: nextRelease, versions: [...filtered, nextRelease] };
  await writeMcpRegistry(registry, channel);
  return { release: nextRelease, asset };
}

// ---------------------------------------------------------------------------
// Products (kept)
// ---------------------------------------------------------------------------

export async function readProducts(): Promise<Product[]> {
  await ensureStorageDirs();
  try {
    const content = await readFile(getProductsFilePath(), "utf-8");
    const raw = JSON.parse(content);
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeProduct).filter((p): p is Product => Boolean(p)).sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
    throw error;
  }
}

export async function writeProducts(products: Product[]): Promise<void> {
  await ensureStorageDirs();
  await writeFile(getProductsFilePath(), `${JSON.stringify(products, null, 2)}\n`, "utf-8");
}

export async function upsertProduct(product: Omit<Product, "updatedAt">): Promise<Product> {
  const id = product.id.trim().toLowerCase();
  if (!id) throw new Error("商品 ID 不能为空");
  if (!product.name.trim()) throw new Error("商品名称不能为空");
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
  const all = await readProducts();
  await writeProducts(all.filter((item) => item.id !== productId.trim().toLowerCase()));
}

export async function listPublishedProducts(): Promise<Product[]> {
  return (await readProducts()).filter((item) => item.published);
}

export async function getProductById(productId: string): Promise<Product | null> {
  const all = await readProducts();
  return all.find((item) => item.id === productId.trim().toLowerCase()) ?? null;
}

// ---------------------------------------------------------------------------
// Tasks (kept)
// ---------------------------------------------------------------------------

export async function readTasks(): Promise<AdminTask[]> {
  await ensureStorageDirs();
  try {
    const content = await readFile(getTasksFilePath(), "utf-8");
    const raw = JSON.parse(content);
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeTask).filter((t): t is AdminTask => Boolean(t)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
  if (!task.title.trim()) throw new Error("任务标题不能为空");
  const id = task.id.trim() || `task-${Date.now()}`;
  const all = await readTasks();
  const next: AdminTask = {
    ...task,
    id,
    title: task.title.trim(),
    description: task.description.trim(),
    imageUrl: task.imageUrl.trim(),
    dueDate: task.dueDate.trim(),
    updatedAt: nowIso(),
  };
  const filtered = all.filter((item) => item.id !== id);
  await writeTasks([next, ...filtered]);
  return next;
}

export async function toggleTask(taskId: string): Promise<void> {
  const id = taskId.trim();
  const all = await readTasks();
  await writeTasks(
    all.map((item) =>
      item.id === id ? { ...item, done: !item.done, updatedAt: nowIso() } : item,
    ),
  );
}

export async function deleteTask(taskId: string): Promise<void> {
  const all = await readTasks();
  await writeTasks(all.filter((item) => item.id !== taskId.trim()));
}

// ---------------------------------------------------------------------------
// Site Settings (kept)
// ---------------------------------------------------------------------------

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
  const next: SiteSettings = { ...settings, updatedAt: nowIso() };
  await ensureStorageDirs();
  await writeFile(getSiteSettingsFilePath(), `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  return next;
}

// ---------------------------------------------------------------------------
// MCP Shelf (kept)
// ---------------------------------------------------------------------------

export async function readMcpShelf(): Promise<McpShelfItem[]> {
  await ensureStorageDirs();
  try {
    const content = await readFile(getMcpShelfFilePath(), "utf-8");
    const raw = JSON.parse(content);
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeMcpShelfItem).filter((i): i is McpShelfItem => Boolean(i));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
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
  if (!item.mcpId || !item.version) throw new Error("mcpId 和 version 不能为空");
  const all = await readMcpShelf();
  const filtered = all.filter(
    (current) => !(current.mcpId === item.mcpId && current.version === item.version && current.channel === item.channel),
  );
  await writeMcpShelf([...filtered, item]);
  return item;
}

export async function listPublishedMcpShelf(channel: ReleaseChannel = "stable"): Promise<McpRelease[]> {
  const [items, releases] = await Promise.all([readMcpShelf(), listMcpReleases(channel)]);
  const index = new Map(releases.map((r) => [`${r.id}@${r.version}@${channel}`, r]));
  return items
    .filter((item) => item.channel === channel && item.published)
    .map((item) => index.get(`${item.mcpId}@${item.version}@${channel}`))
    .filter((r): r is McpRelease => Boolean(r));
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

function normalizeOrder(raw: unknown): Order | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (
    typeof d.id !== "string" ||
    !d.id.trim() ||
    typeof d.productId !== "string" ||
    !d.productId.trim() ||
    typeof d.productName !== "string" ||
    !d.productName.trim() ||
    typeof d.productPriceCny !== "string" ||
    !d.productPriceCny.trim() ||
    typeof d.status !== "string"
  ) {
    return null;
  }
  const validStatuses: OrderStatus[] = ["pending", "paid", "failed", "expired", "cancelled", "refunded"];
  if (!validStatuses.includes(d.status as OrderStatus)) return null;
  return {
    id: d.id.trim(),
    productId: d.productId.trim(),
    productName: d.productName.trim(),
    productPriceCny: d.productPriceCny.trim(),
    status: d.status as OrderStatus,
    alipayTradeNo: typeof d.alipayTradeNo === "string" ? d.alipayTradeNo.trim() : undefined,
    alipayQrCodeUrl: typeof d.alipayQrCodeUrl === "string" ? d.alipayQrCodeUrl.trim() : undefined,
    alipayOutTradeNo: typeof d.alipayOutTradeNo === "string" ? d.alipayOutTradeNo.trim() : undefined,
    createdAt: typeof d.createdAt === "string" && d.createdAt.trim() ? d.createdAt.trim() : nowIso(),
    paidAt: typeof d.paidAt === "string" && d.paidAt.trim() ? d.paidAt.trim() : undefined,
    notifyData: typeof d.notifyData === "object" && d.notifyData !== null ? d.notifyData : undefined,
    shippingName: typeof d.shippingName === "string" && d.shippingName.trim() ? d.shippingName.trim() : undefined,
    shippingPhone: typeof d.shippingPhone === "string" && d.shippingPhone.trim() ? d.shippingPhone.trim() : undefined,
    shippingAddress: typeof d.shippingAddress === "string" && d.shippingAddress.trim() ? d.shippingAddress.trim() : undefined,
  };
}

export async function readOrders(): Promise<Order[]> {
  await ensureStorageDirs();
  try {
    const content = await readFile(getOrdersFilePath(), "utf-8");
    const raw = JSON.parse(content);
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeOrder).filter((o): o is Order => Boolean(o));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
    throw error;
  }
}

export async function writeOrders(orders: Order[]): Promise<void> {
  await ensureStorageDirs();
  await writeFile(getOrdersFilePath(), `${JSON.stringify(orders, null, 2)}\n`, "utf-8");
}

export async function createOrder(params: {
  productId: string;
  productName: string;
  productPriceCny: string;
  alipayQrCodeUrl?: string;
  alipayOutTradeNo?: string;
  shippingName?: string;
  shippingPhone?: string;
  shippingAddress?: string;
}): Promise<Order> {
  const orders = await readOrders();
  const id = `order-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const order: Order = {
    id,
    productId: params.productId,
    productName: params.productName,
    productPriceCny: params.productPriceCny,
    status: "pending",
    alipayQrCodeUrl: params.alipayQrCodeUrl,
    alipayOutTradeNo: params.alipayOutTradeNo,
    createdAt: nowIso(),
    shippingName: params.shippingName,
    shippingPhone: params.shippingPhone,
    shippingAddress: params.shippingAddress,
  };
  orders.push(order);
  await writeOrders(orders);
  return order;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  extra?: Partial<Order>,
): Promise<void> {
  const orders = await readOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx < 0) throw new Error(`订单不存在: ${orderId}`);
  orders[idx] = {
    ...orders[idx],
    status,
    ...extra,
    ...(status === "paid" ? { paidAt: nowIso() } : {}),
  };
  await writeOrders(orders);
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const orders = await readOrders();
  return orders.find((o) => o.id === orderId) ?? null;
}

export async function getOrdersByProductId(productId: string): Promise<Order[]> {
  const orders = await readOrders();
  return orders.filter((o) => o.productId === productId);
}

export async function expireOldPendingOrders(maxAgeHours: number = 24): Promise<number> {
  const orders = await readOrders();
  const now = Date.now();
  let expiredCount = 0;
  const updated = orders.map((order) => {
    if (order.status === "pending") {
      const createdAt = new Date(order.createdAt).getTime();
      const ageHours = (now - createdAt) / (1000 * 60 * 60);
      if (ageHours >= maxAgeHours) {
        expiredCount++;
        return { ...order, status: "expired" as OrderStatus };
      }
    }
    return order;
  });
  if (expiredCount > 0) {
    await writeOrders(updated);
  }
  return expiredCount;
}

// ---------------------------------------------------------------------------
// Re-exports for backwards compat
// ---------------------------------------------------------------------------
export { normalizeReleaseChannel, normalizeInstallerPlatform } from "./compat";
