import { readOpenclawConfig } from "./openclaw-config";
import { looksLikeSpecificPartNumber } from "./component-classifier";
import type { PendingDecisionOption } from "../types";

export type WebSupplier = "digikey_cn" | "ickey_cn" | "ic_net";
export type WebLookupBlockReason = "cloudflare_challenge" | "js_challenge" | "login_required";

export interface WebPriceOffer {
  supplier: WebSupplier;
  partNumber: string;
  unitPrice: number;
  currency: string;
  url: string;
}

export type WebLookupAttemptStatus = "matched" | "no_match" | "blocked" | "http_error" | "error";

export interface WebLookupAttempt {
  supplier: WebSupplier;
  url: string;
  status: WebLookupAttemptStatus;
  blockReason?: WebLookupBlockReason;
}

export interface WebPriceLookupResult {
  offer: WebPriceOffer | null;
  attempts: WebLookupAttempt[];
}

interface WebCandidateOffer extends PendingDecisionOption {
  supplier: WebSupplier;
  sourceUrl: string;
}

interface CdpVersionProbeResult {
  webSocketDebuggerUrl: string;
}

interface CdpPageSnapshot {
  html: string;
  url: string;
}

function normalizeHtml(html: string): string {
  return html.replace(/\s+/g, " ").trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function classifyBlockedDigikeyCnHtml(html: string): WebLookupBlockReason | null {
  const normalized = normalizeHtml(html).toLowerCase();
  return (
    normalized.includes("<title>just a moment...</title>") ||
    normalized.includes("cloudflare") ||
    normalized.includes("cf-challenge") ||
    normalized.includes("challenge-platform") ||
    normalized.includes("security check")
  )
    ? "cloudflare_challenge"
    : null;
}

function classifyBlockedIcNetHtml(html: string): WebLookupBlockReason | null {
  const normalized = normalizeHtml(html);
  if (
    normalized.includes("member.ic.net.cn/login.php") ||
    /gotoUrl\(['"]https:\/\/member\.ic\.net\.cn\/login\.php/i.test(normalized) ||
    /window\.location\.href\s*=\s*['"]https:\/\/member\.ic\.net\.cn\/login\.php/i.test(normalized)
  ) {
    return "login_required";
  }
  if (
    /<script[^>]*>\s*icic=~\[\];icic=\{\$_\$\$:/i.test(normalized) ||
    normalized.includes("$_$$:++icic") ||
    normalized.includes("document.cookie") ||
    normalized.length < 120 && !/<html|<body/i.test(normalized)
  ) {
    return "js_challenge";
  }
  return null;
}

function classifyBlockedIckeyCnHtml(_html: string): WebLookupBlockReason | null {
  return null;
}

function classifyBlockedSupplierHtml(html: string, supplier: WebSupplier): WebLookupBlockReason | null {
  if (supplier === "digikey_cn") {
    return classifyBlockedDigikeyCnHtml(html);
  }
  if (supplier === "ickey_cn") {
    return classifyBlockedIckeyCnHtml(html);
  }
  return classifyBlockedIcNetHtml(html);
}

interface SupplierRequestConfig {
  userAgent: string;
  cookie?: string;
  referer?: string;
  extraHeaders: Record<string, string>;
}

function readTrimmedEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function parseHeaderJson(value: string | undefined): Record<string, string> {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, headerValue]) => {
        if (typeof headerValue !== "string") {
          return [];
        }
        const trimmed = headerValue.trim();
        return trimmed ? [[key, trimmed]] : [];
      }),
    );
  } catch {
    return {};
  }
}

function resolveSupplierRequestConfig(supplier: WebSupplier): SupplierRequestConfig {
  const supplierKey = supplier.toUpperCase();
  return {
    userAgent:
      readTrimmedEnv(`BOM_MCP_WEB_${supplierKey}_USER_AGENT`) ??
      readTrimmedEnv("BOM_MCP_WEB_USER_AGENT") ??
      "clawos-bom-mcp/0.1",
    cookie:
      readTrimmedEnv(`BOM_MCP_WEB_${supplierKey}_COOKIE`) ??
      readTrimmedEnv("BOM_MCP_WEB_COOKIE"),
    referer:
      readTrimmedEnv(`BOM_MCP_WEB_${supplierKey}_REFERER`) ??
      readTrimmedEnv("BOM_MCP_WEB_REFERER"),
    extraHeaders: {
      ...parseHeaderJson(readTrimmedEnv("BOM_MCP_WEB_HEADERS_JSON")),
      ...parseHeaderJson(readTrimmedEnv(`BOM_MCP_WEB_${supplierKey}_HEADERS_JSON`)),
    },
  };
}

function resolveDigikeyCdpBaseUrl(): string | undefined {
  return readTrimmedEnv("BOM_MCP_DIGIKEY_CDP_URL");
}

async function readConfiguredOpenclawBrowserCdpUrl(): Promise<string | undefined> {
  const parsed = await readOpenclawConfig();
  const browser = parsed && typeof parsed.browser === "object" && parsed.browser !== null
    ? parsed.browser as Record<string, unknown>
    : null;
  const cdpUrl = typeof browser?.cdpUrl === "string" ? browser.cdpUrl.trim() : "";
  return cdpUrl || undefined;
}

async function fetchCdpVersion(cdpBaseUrl: string): Promise<CdpVersionProbeResult> {
  const versionUrl = new URL("/json/version", cdpBaseUrl).toString();
  const response = await fetch(versionUrl, {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`cdp version probe failed: HTTP ${response.status}`);
  }
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const webSocketDebuggerUrl = typeof payload?.webSocketDebuggerUrl === "string"
    ? payload.webSocketDebuggerUrl.trim()
    : "";
  if (!webSocketDebuggerUrl) {
    throw new Error("cdp version probe missing webSocketDebuggerUrl");
  }
  return { webSocketDebuggerUrl };
}

async function withCdpSession<T>(
  webSocketDebuggerUrl: string,
  work: (call: (method: string, params?: Record<string, unknown>, sessionId?: string) => Promise<unknown>) => Promise<T>,
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    let messageId = 0;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
    const ws = new WebSocket(webSocketDebuggerUrl);

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      for (const waiter of pending.values()) {
        waiter.reject(new Error("cdp session terminated"));
      }
      pending.clear();
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch {
        // ignore socket close errors
      }
      callback();
    };

    const call = (method: string, params?: Record<string, unknown>, sessionId?: string): Promise<unknown> => {
      return new Promise((resolveCall, rejectCall) => {
        const id = ++messageId;
        pending.set(id, { resolve: resolveCall, reject: rejectCall });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf-8")) as {
          id?: number;
          result?: unknown;
          error?: { message?: string };
        };
        if (typeof payload.id !== "number") {
          return;
        }
        const waiter = pending.get(payload.id);
        if (!waiter) {
          return;
        }
        pending.delete(payload.id);
        if (payload.error) {
          waiter.reject(new Error(payload.error.message || "cdp call failed"));
          return;
        }
        waiter.resolve(payload.result);
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error(String(error))));
      }
    };

    ws.onerror = () => {
      finish(() => reject(new Error("cdp websocket error")));
    };

    ws.onclose = () => {
      if (!settled) {
        finish(() => reject(new Error("cdp websocket closed")));
      }
    };

    ws.onopen = async () => {
      try {
        const result = await work(call);
        finish(() => resolve(result));
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error(String(error))));
      }
    };
  });
}

function parseCdpSnapshotValue(value: unknown, fallbackUrl: string): CdpPageSnapshot | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown> | null;
    if (parsed && typeof parsed.html === "string") {
      const html = parsed.html.trim();
      if (!html) {
        return null;
      }
      return {
        html,
        url: typeof parsed.url === "string" && parsed.url.trim() ? parsed.url.trim() : fallbackUrl,
      };
    }
  } catch {
    // fall back to treating the evaluated value as raw HTML
  }

  return {
    html: trimmed,
    url: fallbackUrl,
  };
}

async function fetchDigikeyHtmlViaCdp(partNumber: string): Promise<CdpPageSnapshot | null> {
  const cdpBaseUrl = resolveDigikeyCdpBaseUrl() ?? await readConfiguredOpenclawBrowserCdpUrl();
  if (!cdpBaseUrl) {
    return null;
  }

  const { webSocketDebuggerUrl } = await fetchCdpVersion(cdpBaseUrl);
  const searchUrl = digikeyUrls(partNumber)[0];

  return await withCdpSession(webSocketDebuggerUrl, async (call) => {
    const createTarget = (await call("Target.createTarget", { url: "about:blank" })) as { targetId?: string };
    const targetId = typeof createTarget?.targetId === "string" ? createTarget.targetId : "";
    if (!targetId) {
      throw new Error("cdp missing targetId");
    }

    const attachTarget = (await call("Target.attachToTarget", { targetId, flatten: true })) as { sessionId?: string };
    const sessionId = typeof attachTarget?.sessionId === "string" ? attachTarget.sessionId : "";
    if (!sessionId) {
      throw new Error("cdp missing sessionId");
    }

    await call("Page.enable", {}, sessionId);
    await call("Runtime.enable", {}, sessionId);
    await call("DOM.enable", {}, sessionId);
    await call("Page.navigate", { url: searchUrl }, sessionId);
    await Bun.sleep(2500);
    const evaluated = (await call(
      "Runtime.evaluate",
      {
        expression:
          "JSON.stringify({ html: document.documentElement ? document.documentElement.outerHTML : '', url: location.href })",
        returnByValue: true,
      },
      sessionId,
    )) as { result?: { value?: unknown } };
    await call("Target.closeTarget", { targetId });

    return parseCdpSnapshotValue(evaluated?.result?.value, searchUrl);
  });
}

interface AnchorContext {
  text: string;
  context: string;
  start: number;
  end: number;
  href?: string;
}

function extractAnchorContexts(html: string): AnchorContext[] {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const text = stripTags(match[2] ?? "");
      if (!text) {
        return null;
      }
      const href = (match[1] ?? "").match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim();
      const start = Math.max(0, (match.index ?? 0) - 240);
      const end = Math.min(html.length, (match.index ?? 0) + match[0].length + 240);
      return {
        text,
        context: html.slice(start, end),
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
        href,
      };
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

function extractDigikeyCandidateContexts(html: string): Array<{ partNumber: string; context: string }> {
  return extractAnchorContexts(html)
    .filter(({ text, href }) => {
      if (!href || !/(?:\/(?:zh|en)\/products\/detail\/|\/products\/detail\/|\/detail\/)/i.test(href)) {
        return false;
      }
      return /[A-Z]/i.test(text) && /\d/.test(text) && !/\s{2,}/.test(text);
    })
    .map((anchor) => {
      const containingBlocks = collectHtmlElementRanges(html)
        .filter((range) => BLOCK_TAGS.has(range.tagName) && range.start <= anchor.start && range.end >= anchor.end)
        .sort((left, right) => (left.end - left.start) - (right.end - right.start));
      const preferredBlock = containingBlocks.find((block) => {
        const context = html.slice(block.start, block.end);
        return /class=["'][^"']*(?:candidate|mfr|price)[^"']*["']/i.test(context) || /[¥￥]\s*[0-9]+/.test(context);
      });
      const context = preferredBlock
        ? html.slice(preferredBlock.start, preferredBlock.end)
        : findSmallestContainingBlockContext(html, anchor.start, anchor.end) ?? anchor.context;

      return {
        partNumber: anchor.text.trim(),
        context,
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

function resolveDigikeyCurrency(html: string): string | null {
  const normalized = normalizeHtml(html);
  const fromJson = normalized.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/i)?.[1]?.toUpperCase();
  if (fromJson) {
    return fromJson;
  }
  const fromText = normalized.match(/所有价格均以\s*([A-Z]{3})\s*计算/i)?.[1]?.toUpperCase()
    ?? normalized.match(/全部价格均按\s*([A-Z]{3})\s*计价/i)?.[1]?.toUpperCase();
  if (fromText) {
    return fromText;
  }
  if (/\$\s*[0-9]/.test(normalized)) {
    return "USD";
  }
  if (/[¥￥]\s*[0-9]/.test(normalized)) {
    return "CNY";
  }
  return null;
}

function looksLikeDigikeyDetailPage(html: string, partNumber: string): boolean {
  const normalized = normalizeHtml(html);
  const target = partNumber.trim().toUpperCase();
  if (!target || !normalized.toUpperCase().includes(target)) {
    return false;
  }
  return (
    /制造商产品编号/i.test(normalized) ||
    /DigiKey 零件编号/i.test(normalized) ||
    /所有价格均以\s*[A-Z]{3}\s*计算/i.test(normalized) ||
    /全部价格均按\s*[A-Z]{3}\s*计价/i.test(normalized) ||
    /data-testid=["']pricing-table-container["']/i.test(normalized) ||
    /"priceCurrency"\s*:/i.test(normalized)
  );
}

function resolveDigikeyDetailPageUrl(html: string, fallbackUrl: string): string {
  const normalized = normalizeHtml(html);
  const canonicalUrl = normalized.match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1]
    ?? normalized.match(/"url"\s*:\s*"((?:https?:\/\/|https?:\\\/\\\/)[^"]*\/products\/detail\/[^"]+)"/i)?.[1];
  if (!canonicalUrl) {
    return fallbackUrl;
  }
  return canonicalUrl
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&");
}

function extractDigikeyDetailPageUnitPrice(html: string, currency: string): number | null {
  const normalizedHtml = normalizeHtml(html);
  const normalizedText = normalizeHtml(stripTags(html));
  const escapedCurrency = currency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const jsonPatterns = [
    new RegExp(`"priceCurrency"\\s*:\\s*"${escapedCurrency}"[^{}]{0,400}?"price"\\s*:\\s*"([0-9]+(?:\\.[0-9]+)?)"`, "i"),
    new RegExp(`"price"\\s*:\\s*"([0-9]+(?:\\.[0-9]+)?)"[^{}]{0,400}?"priceCurrency"\\s*:\\s*"${escapedCurrency}"`, "i"),
  ];
  const jsonPrice = extractPrice(normalizedHtml, jsonPatterns);
  if (jsonPrice !== null) {
    return jsonPrice;
  }

  const priceSymbolPattern = currency === "USD" ? "\\$" : "[¥￥]";
  const htmlTablePrice = extractPrice(normalizedHtml, [
    new RegExp(`<tr[^>]*>[\\s\\S]{0,200}?<t[dh][^>]*>\\s*1\\s*</t[dh]>[\\s\\S]{0,200}?<t[dh][^>]*>\\s*${priceSymbolPattern}\\s*([0-9]+(?:\\.[0-9]+)?)\\s*</t[dh]>`, "i"),
  ]);
  if (htmlTablePrice !== null) {
    return htmlTablePrice;
  }

  return extractPrice(normalizedText, [
    new RegExp(`(?:数量\\s*)?单价\\s*总价\\s*1\\s*${priceSymbolPattern}\\s*([0-9]+(?:\\.[0-9]+)?)`, "i"),
    new RegExp(`(?:^|\\s)1(?:\\s|$)\\s*${priceSymbolPattern}\\s*([0-9]+(?:\\.[0-9]+)?)(?:\\s|$)`, "i"),
  ]);
}

function extractDigikeyDetailPageOffer(html: string, partNumber: string, url: string): WebPriceOffer | null {
  if (!looksLikeDigikeyDetailPage(html, partNumber)) {
    return null;
  }
  const currency = resolveDigikeyCurrency(html);
  if (!currency) {
    return null;
  }
  const unitPrice = extractDigikeyDetailPageUnitPrice(html, currency);
  if (unitPrice === null) {
    return null;
  }
  return {
    supplier: "digikey_cn",
    partNumber,
    unitPrice,
    currency,
    url: resolveDigikeyDetailPageUrl(html, url),
  };
}

export function extractDigikeyCnOffer(html: string, partNumber: string, url: string): WebPriceOffer | null {
  if (classifyBlockedDigikeyCnHtml(html)) {
    return null;
  }

  const detailPageOffer = extractDigikeyDetailPageOffer(html, partNumber, url);
  if (detailPageOffer) {
    return detailPageOffer;
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
  if (classifyBlockedDigikeyCnHtml(html)) {
    return [];
  }

  return extractDigikeyCandidateContexts(html)
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
  if (classifyBlockedIcNetHtml(html)) {
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
  if (classifyBlockedIcNetHtml(html)) {
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

function extractIckeyResultBlocks(html: string): string[] {
  const ranges = collectHtmlElementRanges(html);
  return [...html.matchAll(/<div class="search-r-list"[^>]*>/gi)]
    .map((match) => {
      const start = match.index ?? 0;
      const range = ranges
        .filter((item) => item.tagName === "div" && item.start === start)
        .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
      return range ? html.slice(range.start, range.end) : null;
    })
    .filter((block): block is string => block !== null && /search-th-name/i.test(block));
}

function isIckeyLegacySearchUrl(url: string): boolean {
  try {
    return new URL(url).host === "search.ickey.cn";
  } catch {
    return false;
  }
}

function isIckeyRelatedResultPage(html: string): boolean {
  const normalized = normalizeHtml(stripTags(html));
  return (
    normalized.includes("已为您返回相关结果") ||
    /未找到与[^。]*相匹配的商品/.test(normalized) ||
    /很抱歉，未找到[^。]*相关商品/.test(normalized)
  );
}

function extractIckeyField(block: string, className: string): string | undefined {
  const match = block.match(new RegExp(`<div class="${className}"[^>]*>([\\s\\S]*?)<\\/div>`, "i"));
  const value = stripTags(match?.[1] ?? "").trim();
  return value || undefined;
}

function extractIckeyStock(block: string): number | undefined {
  const stockText = block.match(/<div class="text-search">([\s\S]*?)<\/div>/i)?.[1];
  const normalized = stripTags(stockText ?? "").replace(/,/g, "").trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function extractIckeyMoq(block: string): number | undefined {
  const match = stripTags(block).match(/(\d+)\s*片起订/);
  if (!match?.[1]) {
    return undefined;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function extractIckeyLeadTime(block: string): string | undefined {
  const deliveryBlock = block.match(/<div class="search-th-delivery">([\s\S]*?)<\/div>\s*<div class="search-th-oper">/i)?.[1];
  if (!deliveryBlock) {
    return undefined;
  }
  const values = [...deliveryBlock.matchAll(/<div>([\s\S]*?)<\/div>/gi)]
    .map((match) => stripTags(match[1] ?? "").trim())
    .filter((value) => value.length > 0);
  return values.join("；") || undefined;
}

function extractIckeySourceUrl(block: string, fallbackUrl: string): string {
  const dataHref = block.match(/data-href=["']([^"']+)["']/i)?.[1]?.trim();
  if (!dataHref) {
    return fallbackUrl;
  }
  if (dataHref.startsWith("//")) {
    return `https:${dataHref}`;
  }
  if (dataHref.startsWith("/")) {
    return new URL(dataHref, fallbackUrl).toString();
  }
  return dataHref;
}

function buildIckeyCandidateOption(block: string, fallbackUrl: string): WebCandidateOffer | null {
  const partNumber = extractIckeyField(block, "search-th-name");
  if (!partNumber) {
    return null;
  }

  const manufacturer = extractIckeyField(block, "search-th-maf");
  const leadTime = extractIckeyLeadTime(block);
  const moq = extractIckeyMoq(block);
  const stock = extractIckeyStock(block);
  const unitPrice = extractPrice(normalizeHtml(stripTags(block)), [
    /(?:参考价|单价|价格)[:：]?\s*[¥￥]\s*([0-9]+(?:\.[0-9]+)?)/i,
    /[¥￥]\s*([0-9]+(?:\.[0-9]+)?)/,
  ]) ?? undefined;
  const explain = extractIckeyField(block, "search-th-explain");
  const noteSegments = ["候选项来自 ICkey.cn 公开搜索结果"];
  if (stock !== undefined) {
    noteSegments.push(`库存 ${stock}`);
  }
  if (explain) {
    noteSegments.push(`说明 ${explain}`);
  }

  return {
    supplier: "ickey_cn",
    sourceUrl: extractIckeySourceUrl(block, fallbackUrl),
    partNumber,
    manufacturer,
    unitPrice,
    currency: unitPrice !== undefined ? "CNY" : undefined,
    leadTime,
    moq,
    note: noteSegments.join("；"),
  };
}

export function extractIckeyCnOffer(html: string, partNumber: string, url: string): WebPriceOffer | null {
  if (classifyBlockedIckeyCnHtml(html)) {
    return null;
  }
  const target = partNumber.trim().toUpperCase();
  const exactMatch = extractIckeyResultBlocks(html)
    .map((block) => buildIckeyCandidateOption(block, url))
    .find((option) => option?.partNumber.trim().toUpperCase() === target && option.unitPrice !== undefined);

  if (!exactMatch?.unitPrice) {
    return null;
  }

  return {
    supplier: "ickey_cn",
    partNumber: exactMatch.partNumber,
    unitPrice: exactMatch.unitPrice,
    currency: exactMatch.currency || "CNY",
    url: exactMatch.sourceUrl,
  };
}

export function extractIckeyCnCandidateOptions(html: string, url: string): WebCandidateOffer[] {
  if (classifyBlockedIckeyCnHtml(html)) {
    return [];
  }

  const specificBlocks = extractIckeyResultBlocks(html)
    .map((block) => buildIckeyCandidateOption(block, url))
    .filter((option): option is WebCandidateOffer => option !== null);
  if (specificBlocks.length > 0) {
    return specificBlocks;
  }
  if (isIckeyLegacySearchUrl(url) && isIckeyRelatedResultPage(html)) {
    return [];
  }

  return [];
}

async function fetchHtml(supplier: WebSupplier, url: string, fetchImpl: typeof fetch): Promise<{
  status: Exclude<WebLookupAttemptStatus, "matched" | "no_match"> | "ok";
  html?: string;
  blockReason?: WebLookupBlockReason;
}> {
  try {
    const requestConfig = resolveSupplierRequestConfig(supplier);
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        "user-agent": requestConfig.userAgent,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        pragma: "no-cache",
        ...(requestConfig.cookie ? { cookie: requestConfig.cookie } : {}),
        ...(requestConfig.referer ? { referer: requestConfig.referer } : {}),
        ...requestConfig.extraHeaders,
      },
    });
    if (!response.ok) {
      return { status: "http_error" };
    }
    const html = await response.text();
    const blockReason = classifyBlockedSupplierHtml(html, supplier);
    if (blockReason) {
      return { status: "blocked", blockReason };
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

function ickeyUrls(partNumber: string): string[] {
  const encodedPath = encodeURIComponent(partNumber);
  if (!looksLikeSpecificPartNumber(partNumber)) {
    return [
      `https://www.ickey.cn/new-search/${encodedPath}/`,
    ];
  }

  const encodedQuery = encodeURIComponent(partNumber);
  return [
    `https://www.ickey.cn/new-search/${encodedPath}/`,
    `https://search.ickey.cn/site/index.html?keyword=${encodedQuery}`,
  ];
}

export async function lookupWebPrice(
  partNumber: string,
  suppliers: WebSupplier[] = ["ickey_cn", "digikey_cn", "ic_net"],
  fetchImpl: typeof fetch = fetch,
): Promise<WebPriceOffer | null> {
  return (await lookupWebPriceDetailed(partNumber, suppliers, fetchImpl)).offer;
}

export async function lookupWebPriceDetailed(
  partNumber: string,
  suppliers: WebSupplier[] = ["ickey_cn", "digikey_cn", "ic_net"],
  fetchImpl: typeof fetch = fetch,
): Promise<WebPriceLookupResult> {
  const attempts: WebLookupAttempt[] = [];
  for (const supplier of suppliers) {
    if (supplier === "digikey_cn") {
      try {
        const cdpPage = await fetchDigikeyHtmlViaCdp(partNumber);
        if (cdpPage) {
          const pageUrl = cdpPage.url || digikeyUrls(partNumber)[0];
          const offer = extractDigikeyCnOffer(cdpPage.html, partNumber, pageUrl);
          if (offer) {
            attempts.push({ supplier, url: pageUrl, status: "matched" });
            return { offer, attempts };
          }
          attempts.push({ supplier, url: pageUrl, status: "no_match" });
        }
      } catch {
        // fall through to HTTP fetch path
      }
    }

    const urls = supplier === "digikey_cn"
      ? digikeyUrls(partNumber)
      : supplier === "ickey_cn"
        ? ickeyUrls(partNumber)
        : icNetUrls(partNumber);
    for (const url of urls) {
      const result = await fetchHtml(supplier, url, fetchImpl);
      if (result.status !== "ok" || !result.html) {
        attempts.push({ supplier, url, status: result.status, blockReason: result.blockReason });
        continue;
      }
      const offer =
        supplier === "digikey_cn"
          ? extractDigikeyCnOffer(result.html, partNumber, url)
          : supplier === "ickey_cn"
            ? extractIckeyCnOffer(result.html, partNumber, url)
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
  suppliers: WebSupplier[] = ["ickey_cn", "digikey_cn", "ic_net"],
  fetchImpl: typeof fetch = fetch,
): Promise<PendingDecisionOption[]> {
  const seen = new Set<string>();
  const options: PendingDecisionOption[] = [];

  for (const supplier of suppliers) {
    if (supplier === "digikey_cn") {
      try {
        const cdpPage = await fetchDigikeyHtmlViaCdp(query);
        if (cdpPage) {
          const extracted = extractDigikeyCnCandidateOptions(cdpPage.html, cdpPage.url || digikeyUrls(query)[0]);
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
              leadTime: option.leadTime,
              moq: option.moq,
              note: option.note,
            });
          }
          if (options.length > 0) {
            return options.slice(0, 5);
          }
        }
      } catch {
        // fall through to HTTP fetch path
      }
    }

    const urls = supplier === "digikey_cn"
      ? digikeyUrls(query)
      : supplier === "ickey_cn"
        ? ickeyUrls(query)
        : icNetUrls(query);
    for (const url of urls) {
      const result = await fetchHtml(supplier, url, fetchImpl);
      if (result.status !== "ok" || !result.html) {
        continue;
      }
      const extracted =
        supplier === "digikey_cn"
          ? extractDigikeyCnCandidateOptions(result.html, url)
          : supplier === "ickey_cn"
            ? extractIckeyCnCandidateOptions(result.html, url)
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
          leadTime: option.leadTime,
          moq: option.moq,
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
