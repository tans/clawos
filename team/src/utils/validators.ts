export function normalizeMobile(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!/^\+?[0-9]{6,20}$/.test(value)) {
    return null;
  }
  return value;
}

export function normalizeWalletAddress(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

export function normalizeHostId(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!/^[a-zA-Z0-9_.:-]{2,128}$/.test(value)) {
    return null;
  }
  return value;
}

export function normalizeHostName(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!value || value.length > 64) {
    return null;
  }
  return value;
}

export function parseLimit(raw: string | undefined, fallback = 20): number {
  if (!raw) {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    return fallback;
  }
  return Math.min(100, Math.floor(n));
}

export function normalizeCompanyName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 64) return null;
  return value;
}

export function normalizeCompanySlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(value)) return null;
  return value;
}
