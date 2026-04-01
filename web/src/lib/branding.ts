import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getEnv } from "./env";

export interface BrandConfig {
  brandName: string;
  siteName: string;
  brandUrl: string;
  brandDomain: string;
  brandLogoUrl: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
}

let cachedBrandConfig: BrandConfig | null = null;

function normalizeBrandUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    return "https://clawos.cc";
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `https://${value.replace(/^\/+/, "")}`;
}

function deriveBrandDomain(brandUrl: string): string {
  try {
    return new URL(brandUrl).host || "clawos.cc";
  } catch {
    return brandUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "clawos.cc";
  }
}

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

  const envBrandName = process.env.OEM_BRAND_NAME?.trim() || "ClawOS";
  const envSiteName = process.env.OEM_SITE_NAME?.trim() || envBrandName;
  const envBrandUrl = normalizeBrandUrl(process.env.OEM_BRAND_URL?.trim() || process.env.OEM_BRAND_DOMAIN?.trim());
  const envBrandLogoUrl = normalizeLogoUrl(process.env.OEM_BRAND_LOGO_URL);
  const envSeoTitle = process.env.OEM_SEO_TITLE?.trim() || envSiteName;
  const envSeoDescription =
    process.env.OEM_SEO_DESCRIPTION?.trim() ||
    `${envSiteName} 提供企业 AI 部署、运行治理与交付支持，适配本地优先和混合部署场景。`;
  const envSeoKeywords =
    process.env.OEM_SEO_KEYWORDS?.trim() || `${envSiteName},ClawOS,企业AI,私有化部署,本地部署,智能体`;

  let settingsOverride: Record<string, unknown> | null = null;
  try {
    const filePath = resolve(getEnv().storageDir, "releases", "site-settings.json");
    if (existsSync(filePath)) {
      settingsOverride = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    }
  } catch {
    settingsOverride = null;
  }

  const brandName =
    (typeof settingsOverride?.brandName === "string" && settingsOverride.brandName.trim()) || envBrandName;
  const siteName =
    (typeof settingsOverride?.siteName === "string" && settingsOverride.siteName.trim()) || envSiteName;
  const brandLogoUrl = normalizeLogoUrl(
    (typeof settingsOverride?.brandLogoUrl === "string" && settingsOverride.brandLogoUrl.trim()) || envBrandLogoUrl,
  );
  const brandUrl = normalizeBrandUrl(
    (typeof settingsOverride?.brandUrl === "string" && settingsOverride.brandUrl.trim()) || envBrandUrl,
  );
  const seoTitle =
    (typeof settingsOverride?.seoTitle === "string" && settingsOverride.seoTitle.trim()) || envSeoTitle;
  const seoDescription =
    (typeof settingsOverride?.seoDescription === "string" && settingsOverride.seoDescription.trim()) ||
    envSeoDescription;
  const seoKeywords =
    (typeof settingsOverride?.seoKeywords === "string" && settingsOverride.seoKeywords.trim()) || envSeoKeywords;

  cachedBrandConfig = {
    brandName,
    siteName,
    brandUrl,
    brandDomain: deriveBrandDomain(brandUrl),
    brandLogoUrl,
    seoTitle,
    seoDescription,
    seoKeywords,
  };

  return cachedBrandConfig;
}

export function resetBrandConfigCache(): void {
  cachedBrandConfig = null;
}

export function resetBrandConfigCacheForTests(): void {
  resetBrandConfigCache();
}
