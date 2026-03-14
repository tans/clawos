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
