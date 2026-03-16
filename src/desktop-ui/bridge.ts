import { Electroview } from "electrobun/view";
import type { DesktopApiResponse, DesktopRpcSchema } from "./rpc-schema";

const ALLOWED_PAGE_PATHS = new Set([
  "/",
  "/index",
  "/config/channels",
  "/config/agents",
  "/config/skills",
  "/config/browser",
  "/config/wallet",
  "/config/settings",
  "/sessions",
]);

const BOOT_SCREEN_MIN_DURATION_MS = 2000;
const PAGE_RENDER_TIMEOUT_MS = 15_000;
const API_PROXY_TIMEOUT_MS = 20_000;
const OPEN_EXTERNAL_TIMEOUT_MS = 10_000;

const rpc = Electroview.defineRPC<DesktopRpcSchema>({
  maxRequestTime: 60_000,
  handlers: { requests: {} },
});

new Electroview({ rpc });

const nativeFetch = window.fetch.bind(window);
let runtimeErrorRendered = false;
let navigationToken = 0;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof window.setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  }) as Promise<T>;
}

function normalizePagePath(rawPath: string): string {
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

function readRouteFromHash(): string {
  const value = window.location.hash || "";
  if (!value || value === "#") {
    return "/";
  }
  return normalizePagePath(value);
}

function toRouteHash(route: string): string {
  return `#${encodeURIComponent(route)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRuntimeError(error: unknown): string {
  if (error instanceof Error) {
    const text = error.stack?.trim() || error.message.trim();
    return text || "Unknown runtime error";
  }
  const text = String(error || "").trim();
  return text || "Unknown runtime error";
}

function renderDesktopError(message: string): void {
  if (runtimeErrorRendered) {
    return;
  }

  runtimeErrorRendered = true;
  document.open();
  document.write(`
<!doctype html>
<html lang="zh-CN" data-clawos-desktop-page="1">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ClawOS - Page Load Failed</title>
    <style>
      body {
        margin: 0;
        font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif;
        background: #ffffff;
        color: #111827;
      }
      main {
        max-width: 780px;
        margin: 48px auto;
        padding: 24px;
        border-radius: 12px;
        border: 1px solid #dbe2ea;
        background: #fff;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 22px;
      }
      p {
        margin: 8px 0;
        line-height: 1.6;
      }
      code {
        display: block;
        margin-top: 8px;
        background: #f1f5f9;
        border-radius: 6px;
        padding: 10px;
        font-size: 12px;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>ClawOS Page Load Failed</h1>
      <p>Please refresh or restart the app.</p>
      <code>${escapeHtml(message)}</code>
    </main>
  </body>
</html>
  `);
  document.close();
}

function installGlobalErrorHandlers(): void {
  window.addEventListener("error", (event) => {
    const reason = event.error || event.message || "Page script error";
    renderDesktopError(`Page script error: ${formatRuntimeError(reason)}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    renderDesktopError(`Unhandled async error: ${formatRuntimeError(event.reason)}`);
  });
}

async function renderRoute(normalizedRoute: string, fallbackToHome: boolean): Promise<void> {
  const token = ++navigationToken;
  try {
    const page = await withTimeout(
      rpc.request.renderPage({ path: normalizedRoute }),
      PAGE_RENDER_TIMEOUT_MS,
      `Page render timeout (>${Math.floor(PAGE_RENDER_TIMEOUT_MS / 1000)}s)`
    );

    if (token !== navigationToken) {
      return;
    }

    if (page.status >= 400 || typeof page.html !== "string" || !page.html.trim()) {
      if (fallbackToHome && normalizedRoute !== "/") {
        await renderRoute("/", false);
        return;
      }

      const reason =
        page.status >= 400 ? `Page returned status ${page.status}` : "Page content is empty and cannot be rendered.";
      renderDesktopError(reason);
      return;
    }

    document.open();
    document.write(page.html);
    document.close();
  } catch (error) {
    if (fallbackToHome && normalizedRoute !== "/") {
      await renderRoute("/", false);
      return;
    }
    renderDesktopError(formatRuntimeError(error));
  }
}

async function navigateToRoute(route: string): Promise<void> {
  const normalizedRoute = normalizePagePath(route);
  await renderRoute(normalizedRoute, true);
}

function shouldInterceptLink(target: HTMLAnchorElement): boolean {
  const href = target.getAttribute("href");
  if (!href || href.startsWith("#")) {
    return false;
  }
  if (target.target && target.target !== "_self") {
    return false;
  }
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return false;
  }
  return href.startsWith("/");
}

function installNavigationInterceptor(): void {
  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) {
        return;
      }

      const link = event.target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || !shouldInterceptLink(link)) {
        return;
      }

      const route = normalizePagePath(link.getAttribute("href") || "/");
      event.preventDefault();

      const nextHash = toRouteHash(route);
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
        return;
      }
      void navigateToRoute(route);
    },
    true
  );

  window.addEventListener("hashchange", () => {
    void navigateToRoute(readRouteFromHash());
  });
}

function isApiRequest(url: URL): boolean {
  return url.pathname.startsWith("/api/");
}

async function proxyApiRequest(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url, window.location.href);
  const method = request.method ? request.method.toUpperCase() : "GET";
  const headers = Object.fromEntries(request.headers.entries());
  const body = method === "GET" || method === "HEAD" ? null : await request.text();

  const result: DesktopApiResponse = await withTimeout(
    rpc.request.api({
      path: `${requestUrl.pathname}${requestUrl.search}`,
      method,
      headers,
      body,
    }),
    API_PROXY_TIMEOUT_MS,
    `API proxy timeout (>${Math.floor(API_PROXY_TIMEOUT_MS / 1000)}s)`
  );

  return new Response(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

async function openExternalUrl(url: string): Promise<void> {
  await withTimeout(
    rpc.request.openExternalUrl({ url }),
    OPEN_EXTERNAL_TIMEOUT_MS,
    `Open external url timeout (>${Math.floor(OPEN_EXTERNAL_TIMEOUT_MS / 1000)}s)`
  );
}

function installFetchShim(): void {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
    const requestUrl = new URL(request.url, window.location.href);
    if (!isApiRequest(requestUrl)) {
      return nativeFetch(input, init);
    }

    try {
      return await proxyApiRequest(request);
    } catch (error) {
      const message = formatRuntimeError(error);
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
  };
}

function exposeDesktopHelpers(): void {
  const helpers = {
    openExternalUrl,
  };

  Object.defineProperty(window, "__clawosDesktop", {
    configurable: true,
    enumerable: false,
    writable: false,
    value: helpers,
  });
}

function startDesktopBridge(): void {
  installGlobalErrorHandlers();
  installFetchShim();
  installNavigationInterceptor();
  exposeDesktopHelpers();

  const alreadyRenderedPage = document.documentElement.hasAttribute("data-clawos-desktop-page");
  if (alreadyRenderedPage) {
    return;
  }

  window.setTimeout(() => {
    void navigateToRoute(readRouteFromHash());
  }, BOOT_SCREEN_MIN_DURATION_MS);
}

try {
  startDesktopBridge();
} catch (error) {
  renderDesktopError(`Desktop bridge startup failed: ${formatRuntimeError(error)}`);
}
