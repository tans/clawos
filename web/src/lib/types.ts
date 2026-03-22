export interface ReleaseAsset {
  name: string;
  relativePath: string;
  size: number;
  sha256: string;
  uploadedAt: string;
}

export type InstallerPlatform = "windows" | "macos" | "linux";
export type ReleaseChannel = "stable" | "beta";

export interface LatestRelease {
  version: string;
  publishedAt: string;
  installer: ReleaseAsset | null;
  installers?: Partial<Record<InstallerPlatform, ReleaseAsset>>;
  xiakeConfig: ReleaseAsset | null;
  updaterAssets?: ReleaseAsset[];
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
