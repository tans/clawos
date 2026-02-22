export interface ReleaseAsset {
  name: string;
  relativePath: string;
  size: number;
  sha256: string;
  uploadedAt: string;
}

export interface LatestRelease {
  version: string;
  publishedAt: string;
  installer: ReleaseAsset | null;
  xiakeConfig: ReleaseAsset | null;
}
