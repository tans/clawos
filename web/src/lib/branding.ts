export interface BrandConfig {
  brandName: string;
  siteName: string;
  brandDomain: string;
  brandLogoUrl: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
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

  const brandName = process.env.OEM_BRAND_NAME?.trim() || "ClawOS";
  const siteName = process.env.OEM_SITE_NAME?.trim() || brandName;
  const seoTitle = process.env.OEM_SEO_TITLE?.trim() || siteName;
  const seoDescription =
    process.env.OEM_SEO_DESCRIPTION?.trim() ||
    `${siteName} 提供企业 AI 部署、运行治理与交付支持，适配本地优先和混合部署场景。`;
  const seoKeywords =
    process.env.OEM_SEO_KEYWORDS?.trim() || `${siteName},ClawOS,企业AI,私有化部署,本地部署,智能体`;

  cachedBrandConfig = {
    brandName,
    siteName,
    brandDomain: process.env.OEM_BRAND_DOMAIN?.trim() || "clawos.cc",
    brandLogoUrl: normalizeLogoUrl(process.env.OEM_BRAND_LOGO_URL),
    seoTitle,
    seoDescription,
    seoKeywords,
  };

  return cachedBrandConfig;
}

export function resetBrandConfigCacheForTests(): void {
  cachedBrandConfig = null;
}
