export interface ReleaseAsset {
  name: string;
  relativePath: string;
  size: number;
  sha256: string;
  uploadedAt: string;
}

export type InstallerPlatform = "windows" | "macos" | "linux";
export type ReleaseChannel = "stable" | "beta" | "alpha" | "canary";

export interface LatestRelease {
  version: string;
  changelog?: string;
  thumbnailUrl?: string;
  publishedAt: string;
  installer: ReleaseAsset | null;
  installers?: Partial<Record<InstallerPlatform, ReleaseAsset>>;
  xiakeConfig: ReleaseAsset | null;
  updaterAssets?: ReleaseAsset[];
}

export interface AdminInstallerHistoryItem {
  fileName: string;
  platform: InstallerPlatform;
  size: number;
  uploadedAt: string;
  relativePath: string;
  versionHint: string | null;
}

export interface McpManifest {
  schemaVersion: string;
  id: string;
  name: string;
  version: string;
  description?: string;
  displayName?: string;
  publisher?: {
    name?: string;
    website?: string;
  };
  platforms?: string[];
  [key: string]: unknown;
}

export interface McpRelease {
  id: string;
  version: string;
  publishedAt: string;
  package: ReleaseAsset;
  manifest: McpManifest;
  channel: ReleaseChannel;
}

export interface McpRegistryEntry {
  latest: McpRelease;
  versions: McpRelease[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  priceCny: string;
  link: string;
  published: boolean;
  requiresLogistics: boolean;
  imageUrls: string[];
  updatedAt: string;
}

export interface McpShelfItem {
  mcpId: string;
  version: string;
  channel: ReleaseChannel;
  published: boolean;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type OrderStatus = "pending" | "paid" | "failed" | "expired" | "cancelled" | "refunded";

export interface Order {
  id: string;
  productId: string;
  productName: string;
  productPriceCny: string;
  status: OrderStatus;
  alipayTradeNo?: string;
  alipayQrCodeUrl?: string;
  alipayOutTradeNo?: string;
  createdAt: string;
  paidAt?: string;
  notifyData?: Record<string, unknown>;
  // Shipping info
  shippingName?: string;
  shippingPhone?: string;
  shippingAddress?: string;
}

export interface AdminTask {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  done: boolean;
  priority: "low" | "medium" | "high";
  dueDate: string;
  updatedAt: string;
}

export interface SiteSettings {
  brandName: string;
  siteName: string;
  brandLogoUrl: string;
  heroBannerUrl: string;
  brandUrl: string;
  customerServiceWechat: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Download Items (new unified download module)
// ---------------------------------------------------------------------------

export interface DownloadFile {
  name: string;
  /** bytes */
  size: number;
  sha256: string;
  uploadedAt: string;
  /** relative path within storage, e.g. "downloads/{itemId}/{fileName}" */
  relativePath: string;
}

export interface DownloadItem {
  id: string;
  name: string;
  description: string;
  /** Logo URL - can be local path or external URL */
  logo: string;
  version: string;
  files: DownloadFile[];
  published: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
