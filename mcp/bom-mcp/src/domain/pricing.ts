import type { BomLine, QuotePriceSource, QuotePricingState } from "../types";
import { getLatestPartPrice, type StoredPartPrice, upsertWebPartPrice } from "../infra/store";
import { looksLikeSpecificPartNumber } from "./component-classifier";
import { resolveFxRate } from "./fx";
import { lookupWebPriceDetailed, type WebLookupAttempt, type WebSupplier } from "./web-pricing";

function blockedAttemptMessage(attempt: WebLookupAttempt): string {
  if (attempt.blockReason === "cloudflare_challenge") {
    return `${attempt.supplier} 返回 Cloudflare challenge，当前需要浏览器会话或人工登录态`;
  }
  if (attempt.blockReason === "login_required") {
    return `${attempt.supplier} 当前需要登录后才能访问报价页`;
  }
  if (attempt.blockReason === "js_challenge") {
    return `${attempt.supplier} 返回 JS 防护页，当前需要浏览器会话或人工登录态`;
  }
  return `${attempt.supplier} 返回防护页，当前无法直接抓取`;
}

export interface LinePriceResolution {
  unitPrice?: number;
  source: QuotePriceSource;
  updatedAt?: string;
  sourceRecordedAt?: string;
  pricingState?: QuotePricingState;
  supplier?: string;
  sourceUnitPrice?: number;
  sourceCurrency?: string;
  fxRate?: number;
  fxPair?: string;
  sourceUrl?: string;
  warnings?: string[];
}

function summarizeLookupWarnings(attempts: WebLookupAttempt[]): string[] {
  const supplierMessages = new Map<string, string>();

  for (const attempt of attempts) {
    if (supplierMessages.has(attempt.supplier)) {
      continue;
    }
    if (attempt.status === "blocked") {
      supplierMessages.set(attempt.supplier, blockedAttemptMessage(attempt));
    } else if (attempt.status === "http_error") {
      supplierMessages.set(attempt.supplier, `${attempt.supplier} 当前请求失败`);
    } else if (attempt.status === "error") {
      supplierMessages.set(attempt.supplier, `${attempt.supplier} 当前访问异常`);
    }
  }

  return [...supplierMessages.values()];
}

function isExpiredStoredPrice(price: StoredPartPrice | null): boolean {
  if (!price?.expiresAt) {
    return false;
  }
  const expiresAt = Date.parse(price.expiresAt);
  if (Number.isNaN(expiresAt)) {
    return false;
  }
  return expiresAt <= Date.now();
}

function mapStoredPriceSource(price: StoredPartPrice): Exclude<QuotePriceSource, "input" | "missing"> {
  return price.sourceType === "catalog" ||
      price.sourceType === "digikey_cn" ||
      price.sourceType === "ickey_cn" ||
      price.sourceType === "ic_net"
    ? price.sourceType
    : "manual";
}

function buildStoredPriceResolution(price: StoredPartPrice, warnings: string[] = []): LinePriceResolution {
  return {
    unitPrice: Number(price.unitPrice.toFixed(4)),
    source: mapStoredPriceSource(price),
    updatedAt: new Date().toISOString(),
    sourceRecordedAt: price.effectiveAt,
    pricingState: warnings.length > 0 ? "stale_fallback" : "cached",
    supplier: price.supplier,
    sourceCurrency: price.currency,
    sourceUrl: price.sourceRef,
    warnings,
  };
}

function applyQuoteCurrencyConversion(
  resolution: LinePriceResolution,
  quoteCurrency: string | undefined,
): LinePriceResolution {
  if (resolution.unitPrice === undefined) {
    return resolution;
  }

  const normalizedQuoteCurrency = quoteCurrency?.trim().toUpperCase() || "CNY";
  const sourceCurrency = resolution.sourceCurrency?.trim().toUpperCase();
  if (!sourceCurrency || sourceCurrency === normalizedQuoteCurrency) {
    return resolution;
  }

  const fxRate = resolveFxRate(sourceCurrency, normalizedQuoteCurrency);
  if (!fxRate) {
    return {
      ...resolution,
      sourceUnitPrice: Number(resolution.unitPrice.toFixed(4)),
      unitPrice: undefined,
      fxRate: undefined,
      fxPair: `${sourceCurrency}/${normalizedQuoteCurrency}`,
      warnings: [
        ...(resolution.warnings ?? []),
        `源站币种 ${sourceCurrency} 与报价币种 ${normalizedQuoteCurrency} 不同，缺少 ${sourceCurrency}/${normalizedQuoteCurrency} 汇率配置`,
      ],
    };
  }

  return {
    ...resolution,
    sourceUnitPrice: Number(resolution.unitPrice.toFixed(4)),
    unitPrice: Number((resolution.unitPrice * fxRate.rate).toFixed(4)),
    fxRate: Number(fxRate.rate.toFixed(6)),
    fxPair: fxRate.pair,
  };
}

export async function resolveLinePrice(
  line: BomLine,
  options: {
    quoteCurrency?: string;
    webPricing?: boolean;
    webSuppliers?: WebSupplier[];
  } = {},
): Promise<LinePriceResolution> {
  const directPrice = line.unitPrice !== undefined && line.unitPrice > 0 ? line.unitPrice : null;
  if (directPrice !== null) {
    return {
      unitPrice: Number(directPrice.toFixed(4)),
      source: "input",
      updatedAt: new Date().toISOString(),
      pricingState: "input",
    };
  }

  const storedPrice = getLatestPartPrice(line.partNumber);
  if (storedPrice && storedPrice.unitPrice > 0) {
    const canRefreshExpiredWebPrice =
      options.webPricing &&
      looksLikeSpecificPartNumber(line.partNumber) &&
      (storedPrice.sourceType === "digikey_cn" ||
        storedPrice.sourceType === "ickey_cn" ||
        storedPrice.sourceType === "ic_net") &&
      isExpiredStoredPrice(storedPrice);

    if (!canRefreshExpiredWebPrice) {
      return applyQuoteCurrencyConversion(buildStoredPriceResolution(storedPrice), options.quoteCurrency);
    }

    const webLookup = await lookupWebPriceDetailed(line.partNumber, options.webSuppliers);
    if (webLookup.offer) {
      const updatedAt = new Date().toISOString();
      upsertWebPartPrice({
        partNumber: line.partNumber,
        unitPrice: webLookup.offer.unitPrice,
        supplier: webLookup.offer.supplier,
        currency: webLookup.offer.currency,
        sourceRef: webLookup.offer.url,
      });
      return applyQuoteCurrencyConversion({
        unitPrice: webLookup.offer.unitPrice,
        source: webLookup.offer.supplier,
        updatedAt,
        sourceRecordedAt: updatedAt,
        pricingState: "live_fetch",
        supplier: webLookup.offer.supplier,
        sourceCurrency: webLookup.offer.currency,
        sourceUrl: webLookup.offer.url,
      }, options.quoteCurrency);
    }

    return applyQuoteCurrencyConversion(
      buildStoredPriceResolution(storedPrice, [
        `${storedPrice.sourceType} 缓存已过期，沿用上次确认价格（${storedPrice.effectiveAt}）`,
        ...summarizeLookupWarnings(webLookup.attempts),
      ]),
      options.quoteCurrency,
    );
  }

  if (options.webPricing && looksLikeSpecificPartNumber(line.partNumber)) {
    const webLookup = await lookupWebPriceDetailed(line.partNumber, options.webSuppliers);
    if (webLookup.offer) {
      const updatedAt = new Date().toISOString();
      upsertWebPartPrice({
        partNumber: line.partNumber,
        unitPrice: webLookup.offer.unitPrice,
        supplier: webLookup.offer.supplier,
        currency: webLookup.offer.currency,
        sourceRef: webLookup.offer.url,
      });
      return applyQuoteCurrencyConversion({
        unitPrice: webLookup.offer.unitPrice,
        source: webLookup.offer.supplier,
        updatedAt,
        sourceRecordedAt: updatedAt,
        pricingState: "live_fetch",
        supplier: webLookup.offer.supplier,
        sourceCurrency: webLookup.offer.currency,
        sourceUrl: webLookup.offer.url,
      }, options.quoteCurrency);
    }

    return {
      source: "missing",
      warnings: summarizeLookupWarnings(webLookup.attempts),
    };
  }

  return { source: "missing" };
}

export async function computeLinePrice(
  line: BomLine,
  options: {
    quoteCurrency?: string;
    webPricing?: boolean;
    webSuppliers?: WebSupplier[];
  } = {},
): Promise<number> {
  return (await resolveLinePrice(line, options)).unitPrice ?? 0;
}
