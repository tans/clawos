// Re-exported for backwards compat — new code should import directly from storage
export function normalizeReleaseChannel(raw: unknown) {
  if (typeof raw !== "string") return null;
  const n = raw.trim().toLowerCase();
  if (n === "stable" || n === "beta" || n === "alpha" || n === "canary") return n;
  return null;
}

export function normalizeInstallerPlatform(raw: unknown) {
  if (typeof raw !== "string") return null;
  const n = raw.trim().toLowerCase();
  if (n === "windows" || n === "win" || n === "win32") return "windows";
  if (n === "macos" || n === "mac" || n === "darwin" || n === "osx") return "macos";
  if (n === "linux") return "linux";
  return null;
}
