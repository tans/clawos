export const ALLOWED_PAGE_PATHS = new Set([
  "/",
  "/index",
  "/config/channels",
  "/config/agents",
  "/config/environment",
  "/config/skills",
  "/config/browser",
  "/config/desktop-control",
  "/config/wallet",
  "/config/remote",
  "/config/settings",
  "/config/backups",
  "/react",
  "/sessions",
]);

export function normalizePagePath(rawPath: string): string {
  const raw = String(rawPath || "").trim();
  if (!raw || raw === "#" || raw === "#/" || raw === "#%2F") {
    return "/";
  }

  const strippedHash = raw.startsWith("#") ? raw.slice(1) : raw;
  let decoded = strippedHash;
  try {
    decoded = decodeURIComponent(strippedHash);
  } catch {
    decoded = strippedHash;
  }

  const withLeadingSlash = decoded.startsWith("/") ? decoded : `/${decoded}`;
  const pathOnly = withLeadingSlash.split("?")[0] || "/";
  if (ALLOWED_PAGE_PATHS.has(pathOnly)) {
    return pathOnly;
  }
  if (pathOnly.endsWith("/") && ALLOWED_PAGE_PATHS.has(pathOnly.slice(0, -1))) {
    return pathOnly.slice(0, -1);
  }
  return "/";
}

export function readRouteFromHash(): string {
  const value = window.location.hash || "";
  if (!value || value === "#") {
    return "/";
  }
  return normalizePagePath(value);
}

export function toRouteHash(route: string): string {
  return `#${encodeURIComponent(route)}`;
}
