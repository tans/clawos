export interface BrandConfig {
  brandName: string;
  brandDomain: string;
  brandLogoUrl: string;
}

let cachedBrandConfig: BrandConfig | null = null;

function normalizeLogoUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    return "/public/logo.png";
  }

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }

  return `/${value.replace(/^\/+/, "")}`;
}

export function getBrandConfig(): BrandConfig {
  if (cachedBrandConfig) {
    return cachedBrandConfig;
  }

  cachedBrandConfig = {
    brandName: process.env.OEM_BRAND_NAME?.trim() || "ClawOS",
    brandDomain: process.env.OEM_BRAND_DOMAIN?.trim() || "clawos.cc",
    brandLogoUrl: normalizeLogoUrl(process.env.OEM_BRAND_LOGO_URL),
  };

  return cachedBrandConfig;
}

export function resetBrandConfigCacheForTests(): void {
  cachedBrandConfig = null;
}
