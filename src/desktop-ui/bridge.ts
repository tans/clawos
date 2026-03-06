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

const rpc = Electroview.defineRPC<DesktopRpcSchema>({
  handlers: { requests: {} },
});

new Electroview({ rpc });

const nativeFetch = window.fetch.bind(window);
let runtimeErrorRendered = false;

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
    <title>ClawOS 页面加载失败</title>
    <script src="views://clawos/bridge.js"></script>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f8fb;
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
      h1 { margin: 0 0 12px; font-size: 22px; }
      p { margin: 8px 0; line-height: 1.6; }
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
      <h1>ClawOS 页面加载失败</h1>
      <p>请稍后重试，或重启客户端。</p>
      <code>${escapeHtml(message)}</code>
    </main>
  </body>
</html>
  `);
  document.close();
}

function formatRuntimeError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.stack?.trim() || error.message.trim();
    return message || "未知异常";
  }
  const text = String(error || "").trim();
  return text || "未知异常";
}

function installGlobalErrorHandlers(): void {
  window.addEventListener("error", (event) => {
    const reason = event.error || event.message || "页面脚本异常";
    renderDesktopError(`页面脚本异常：${formatRuntimeError(reason)}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    renderDesktopError(`未处理的异步异常：${formatRuntimeError(event.reason)}`);
  });
}

async function navigateToRoute(route: string): Promise<void> {
  const normalizedRoute = normalizePagePath(route);

  try {
    const page = await rpc.request.renderPage({ path: normalizedRoute });
    if (page.status >= 400) {
      renderDesktopError(`页面返回异常状态码: ${page.status}`);
      return;
    }
    if (typeof page.html !== "string" || !page.html.trim()) {
      renderDesktopError("页面内容为空，无法渲染。");
      return;
    }

    document.open();
    document.write(page.html);
    document.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderDesktopError(message);
  }
}

function shouldInterceptLink(target: HTMLAnchorElement): boolean {
  const href = target.getAttribute("href");
  if (!href || href.startsWith("#")) {
    return false;
  }

  if (target.target && target.target !== "_self") {
    return false;
  }

  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  return href.startsWith("/");
}

function installNavigationInterceptor(): void {
  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      const link = event.target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      if (!shouldInterceptLink(link)) {
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

  const result: DesktopApiResponse = await rpc.request.api({
    path: `${requestUrl.pathname}${requestUrl.search}`,
    method,
    headers,
    body,
  });

  return new Response(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

function installFetchShim(): void {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
    const requestUrl = new URL(request.url, window.location.href);

    if (!isApiRequest(requestUrl)) {
      return nativeFetch(input, init);
    }

    return await proxyApiRequest(request);
  };
}

function startDesktopBridge(): void {
  installGlobalErrorHandlers();
  installFetchShim();
  installNavigationInterceptor();

  const alreadyRenderedPage = document.documentElement.hasAttribute("data-clawos-desktop-page");
  if (alreadyRenderedPage) {
    return;
  }

  void navigateToRoute(readRouteFromHash());
}

try {
  startDesktopBridge();
} catch (error) {
  renderDesktopError(`桌面桥接启动失败：${formatRuntimeError(error)}`);
}
