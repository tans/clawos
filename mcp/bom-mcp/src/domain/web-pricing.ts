import type { PendingDecisionOption } from "../types";

export type WebSupplier = "digikey_cn" | "ic_net";

export interface WebPriceOffer {
  supplier: WebSupplier;
  partNumber: string;
  unitPrice: number;
  currency: "CNY";
  url: string;
}

export type WebLookupAttemptStatus = "matched" | "no_match" | "blocked" | "http_error" | "error";

export interface WebLookupAttempt {
  supplier: WebSupplier;
  url: string;
  status: WebLookupAttemptStatus;
}

export interface WebPriceLookupResult {
  offer: WebPriceOffer | null;
  attempts: WebLookupAttempt[];
}

interface WebCandidateOffer extends PendingDecisionOption {
  supplier: WebSupplier;
  sourceUrl: string;
}

function normalizeHtml(html: string): string {
  return html.replace(/\s+/g, " ").trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function detectBlockedDigikeyCnHtml(html: string): boolean {
  const normalized = normalizeHtml(html).toLowerCase();
  return (
    normalized.includes("<title>just a moment...</title>") ||
    normalized.includes("cloudflare") ||
    normalized.includes("cf-challenge") ||
    normalized.includes("challenge-platform") ||
    normalized.includes("security check")
  );
}

function detectBlockedIcNetHtml(html: string): boolean {
  const normalized = normalizeHtml(html);
  return (
    /<script[^>]*>\s*icic=~\[\];icic=\{\$_\$\$:/i.test(normalized) ||
    normalized.includes("$_$$:++icic") ||
    normalized.includes("document.cookie") ||
    normalized.length < 120 && !/<html|<body/i.test(normalized)
  );
}

function isBlockedSupplierHtml(html: string, supplier: WebSupplier): boolean {
  return supplier === "digikey_cn" ? detectBlockedDigikeyCnHtml(html) : detectBlockedIcNetHtml(html);
}

interface AnchorContext {
  text: string;
  context: string;
  start: number;
  end: number;
}

function extractAnchorContexts(html: string): AnchorContext[] {
  return [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const text = stripTags(match[1] ?? "");
      if (!text) {
        return null;
      }
      const start = Math.max(0, (match.index ?? 0) - 240);
      const end = Math.min(html.length, (match.index ?? 0) + match[0].length + 240);
      return { text, context: html.slice(start, end), start: match.index ?? 0, end: (match.index ?? 0) + match[0].length };
    })
    .filter((value): value is AnchorContext => value !== null);
}

interface HtmlElementRange {
  tagName: string;
  start: number;
  end: number;
}

const BLOCK_TAGS = new Set(["div", "li", "tr", "td", "article", "section"]);
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

function collectHtmlElementRanges(html: string): HtmlElementRange[] {
  const tagPattern = /<\/?([a-z0-9]+)\b[^>]*>/gi;
  const stack: Array<{ tagName: string; start: number }> = [];
  const ranges: HtmlElementRange[] = [];

  for (const match of html.matchAll(tagPattern)) {
    const rawTag = match[0];
    const tagName = (match[1] ?? "").toLowerCase();
    if (!tagName || VOID_TAGS.has(tagName)) {
      continue;
    }
    const isClosing = rawTag.startsWith("</");
    const isSelfClosing = rawTag.endsWith("/>");

    if (isClosing) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i]?.tagName !== tagName) {
          continue;
        }
        const [opened] = stack.splice(i, 1);
        ranges.push({
          tagName,
          start: opened.start,
          end: (match.index ?? 0) + rawTag.length,
        });
        break;
      }
      continue;
    }

    if (!isSelfClosing) {
      stack.push({ tagName, start: match.index ?? 0 });
    }
  }

  return ranges;
}

function findSmallestContainingBlockContext(html: string, start: number, end: number): string | null {
  const containingBlocks = collectHtmlElementRanges(html)
    .filter((range) => BLOCK_TAGS.has(range.tagName) && range.start <= start && range.end >= end)
    .sort((left, right) => (left.end - left.start) - (right.end - right.start));

  const block = containingBlocks[0];
  if (!block) {
    return null;
  }
  return html.slice(block.start, block.end);
}

function extractExactPartContexts(html: string, partNumber: string): string[] {
  const target = partNumber.trim().toUpperCase();
  const anchorContexts = extractAnchorContexts(html)
    .filter((anchor) => anchor.text.trim().toUpperCase() === target)
    .map((anchor) => {
      return (
        findSmallestContainingBlockContext(html, anchor.start, anchor.end) ??
        anchor.context
      );
    });
  if (anchorContexts.length > 0) {
    return [...new Set(anchorContexts)];
  }

  const upper = html.toUpperCase();
  const contexts: string[] = [];
  let index = upper.indexOf(target);
  while (index >= 0) {
    const start = Math.max(0, index - 240);
    const end = Math.min(html.length, index + target.length + 240);
    contexts.push(html.slice(start, end));
    index = upper.indexOf(target, index + target.length);
  }
  return contexts;
}

function extractPrice(normalizedHtml: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = normalizedHtml.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const unitPrice = Number(match[1].replace(/,/g, ""));
    if (Number.isFinite(unitPrice) && unitPrice > 0) {
      return Number(unitPrice.toFixed(4));
    }
  }
  return null;
}

function extractOfferFromContexts(contexts: string[], patterns: RegExp[]): number | null {
  for (const context of contexts) {
    const unitPrice = extractPrice(normalizeHtml(context), patterns);
    if (unitPrice !== null) {
      return unitPrice;
    }
  }
  return null;
}

function extractCandidateContexts(html: string): Array<{ partNumber: string; context: string }> {
  const anchorCandidates = extractAnchorContexts(html)
    .filter(({ text }) => /[A-Z]/i.test(text) && /\d/.test(text) && !/\s{2,}/.test(text))
    .map(({ text, context }) => ({
      partNumber: text.trim(),
      context,
    }));
  if (anchorCandidates.length > 0) {
    return anchorCandidates;
  }

  return [...html.matchAll(/\b[A-Z0-9][A-Z0-9\-./]{4,}\b/g)].map((match) => {
    const partNumber = match[0];
    const start = Math.max(0, (match.index ?? 0) - 240);
    const end = Math.min(html.length, (match.index ?? 0) + partNumber.length + 240);
    return {
      partNumber,
      context: html.slice(start, end),
    };
  });
}

function extractCandidateManufacturer(block: string): string | undefined {
  const directMatch = block.match(/class=["'][^"']*mfr[^"']*["'][^>]*>(.*?)<\/[^>]+>/i);
  if (directMatch?.[1]) {
    return stripTags(directMatch[1]);
  }

  const normalized = stripTags(block);
  const labelMatch = normalized.match(/(?:Manufacturer|厂商|品牌)[:：]?\s*([A-Za-z0-9 .&-]+)/i);
  return labelMatch?.[1]?.trim() || undefined;
}

export function extractDigikeyCnOffer(html: string, partNumber: string, url: string): WebPriceOffer | null {
  if (detectBlockedDigikeyCnHtml(html)) {
    return null;
  }
  const contexts = extractExactPartContexts(html, partNumber);
  if (contexts.length === 0) {
    return null;
  }
  const unitPrice = extractOfferFromContexts(contexts, [
    /价格阶梯[^¥￥]*[¥￥]\s*([0-9]+(?:\.[0-9]+)?)/i,
    /1\s*[:x+][^¥￥]*[¥￥]\s*([0-9]+(?:\.[0-9]+)?)/i,
    /[¥￥]\s*([0-9]+(?:\.[0-9]+)?)/,
  ]);
  if (unitPrice === null) {
    return null;
  }
  return {
    supplier: "digikey_cn",
    partNumber,
    unitPrice,
    currency: "CNY",
    url,
  };
}

export function extractDigikeyCnCandidateOptions(html: string, url: string): WebCandidateOffer[] {
  if (detectBlockedDigikeyCnHtml(html)) {
    return [];
  }
  return extractCandidateContexts(html)
    .map(({ partNumber, context }) => {
      return {
        supplier: "digikey_cn" as const,
        sourceUrl: url,
        partNumber,
        manufacturer: extractCandidateManufacturer(context),
        unitPrice: extractPrice(normalizeHtml(context), [
          /[¥￥]\s*([0-9]+(?:\.[0-9]+)?)/,
          /1\s*[:x+][^¥￥]*[¥￥]\s*([0-9]+(?:\.[0-9]+)?)/i,
        ]) ?? undefined,
        currency: "CNY",
        note: "候选项来自 DigiKey China 搜索结果",
      };
    })
    .filter((option): option is WebCandidateOffer => option !== null);
}

export function extractIcNetOffer(html: string, partNumber: string, url: string): WebPriceOffer | null {
  if (detectBlockedIcNetHtml(html)) {
    return null;
  }
  const contexts = extractExactPartContexts(html, partNumber);
  if (contexts.length === 0) {
    return null;
  }
  const unitPrice = extractOfferFromContexts(contexts, [
    /参考价[:：]?\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/i,
    /单价[:：]?\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/i,
    /价格[:：]?\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/i,
  ]);
  if (unitPrice === null) {
    return null;
  }
  return {
    supplier: "ic_net",
    partNumber,
    unitPrice,
    currency: "CNY",
    url,
  };
}

export function extractIcNetCandidateOptions(html: string, url: string): WebCandidateOffer[] {
  if (detectBlockedIcNetHtml(html)) {
    return [];
  }
  return extractCandidateContexts(html)
    .map(({ partNumber, context }) => {
      return {
        supplier: "ic_net" as const,
        sourceUrl: url,
        partNumber,
        manufacturer: extractCandidateManufacturer(context),
        unitPrice: extractPrice(normalizeHtml(context), [
          /参考价[:：]?\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/i,
          /单价[:：]?\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/i,
          /价格[:：]?\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/i,
        ]) ?? undefined,
        currency: "CNY",
        note: "候选项来自 IC Net 搜索结果",
      };
    })
    .filter((option): option is WebCandidateOffer => option !== null);
}

async function fetchHtml(url: string, fetchImpl: typeof fetch): Promise<{
  status: Exclude<WebLookupAttemptStatus, "matched" | "no_match"> | "ok";
  html?: string;
}> {
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        "user-agent": "clawos-bom-mcp/0.1",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
    });
    if (!response.ok) {
      return { status: "http_error" };
    }
    const html = await response.text();
    if (url.includes("digikey.cn") && isBlockedSupplierHtml(html, "digikey_cn")) {
      return { status: "blocked" };
    }
    if (url.includes("ic.net.cn") && isBlockedSupplierHtml(html, "ic_net")) {
      return { status: "blocked" };
    }
    return { status: "ok", html };
  } catch {
    return { status: "error" };
  }
}

function digikeyUrls(partNumber: string): string[] {
  const encoded = encodeURIComponent(partNumber);
  return [
    `https://www.digikey.cn/zh/products/result?keywords=${encoded}`,
    `https://www.digikey.cn/en/products/result?keywords=${encoded}`,
  ];
}

function icNetUrls(partNumber: string): string[] {
  const encoded = encodeURIComponent(partNumber);
  return [
    `https://www.ic.net.cn/search.php?keys=${encoded}`,
    `https://www.ic.net.cn/search.php?key=${encoded}`,
  ];
}

export async function lookupWebPrice(
  partNumber: string,
  suppliers: WebSupplier[] = ["digikey_cn", "ic_net"],
  fetchImpl: typeof fetch = fetch,
): Promise<WebPriceOffer | null> {
  return (await lookupWebPriceDetailed(partNumber, suppliers, fetchImpl)).offer;
}

export async function lookupWebPriceDetailed(
  partNumber: string,
  suppliers: WebSupplier[] = ["digikey_cn", "ic_net"],
  fetchImpl: typeof fetch = fetch,
): Promise<WebPriceLookupResult> {
  const attempts: WebLookupAttempt[] = [];
  for (const supplier of suppliers) {
    const urls = supplier === "digikey_cn" ? digikeyUrls(partNumber) : icNetUrls(partNumber);
    for (const url of urls) {
      const result = await fetchHtml(url, fetchImpl);
      if (result.status !== "ok" || !result.html) {
        attempts.push({ supplier, url, status: result.status });
        continue;
      }
      const offer =
        supplier === "digikey_cn"
          ? extractDigikeyCnOffer(result.html, partNumber, url)
          : extractIcNetOffer(result.html, partNumber, url);
      if (offer) {
        attempts.push({ supplier, url, status: "matched" });
        return { offer, attempts };
      }
      attempts.push({ supplier, url, status: "no_match" });
    }
  }
  return { offer: null, attempts };
}

export async function lookupWebCandidates(
  query: string,
  suppliers: WebSupplier[] = ["digikey_cn", "ic_net"],
  fetchImpl: typeof fetch = fetch,
): Promise<PendingDecisionOption[]> {
  const seen = new Set<string>();
  const options: PendingDecisionOption[] = [];

  for (const supplier of suppliers) {
    const urls = supplier === "digikey_cn" ? digikeyUrls(query) : icNetUrls(query);
    for (const url of urls) {
      const result = await fetchHtml(url, fetchImpl);
      if (result.status !== "ok" || !result.html) {
        continue;
      }
      const extracted =
        supplier === "digikey_cn"
          ? extractDigikeyCnCandidateOptions(result.html, url)
          : extractIcNetCandidateOptions(result.html, url);
      for (const option of extracted) {
        if (seen.has(option.partNumber)) {
          continue;
        }
        seen.add(option.partNumber);
        options.push({
          manufacturer: option.manufacturer,
          partNumber: option.partNumber,
          unitPrice: option.unitPrice,
          currency: option.currency,
          note: option.note,
        });
      }
      if (options.length > 0) {
        return options.slice(0, 5);
      }
    }
  }

  return options;
}
