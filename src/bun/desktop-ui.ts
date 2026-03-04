import { handleApiRequest } from "../routes/api";
import { handlePageRequest } from "../routes/pages";
import type {
  DesktopApiRequest,
  DesktopApiResponse,
  DesktopPageResponse,
} from "../desktop-ui/rpc-schema";

const DESKTOP_BASE_URL = "http://clawos.desktop";
const DESKTOP_BRIDGE_URL = "views://clawos/bridge.js";
const DESKTOP_STYLES_URL = "views://clawos/styles.css";
const DESKTOP_SIDEBAR_SCRIPT_URL = "views://clawos/sidebar-update.js";

const KNOWN_PAGE_PATHS = new Set([
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

function normalizeMethod(method: string | undefined): string {
  const upper = String(method || "GET").trim().toUpperCase();
  if (!upper) {
    return "GET";
  }
  return upper;
}

function normalizePagePath(path: string): string {
  const raw = String(path || "/").trim();
  if (!raw || raw === "#" || raw === "#/" || raw === "#%2F") {
    return "/";
  }

  let decoded = raw;
  if (raw.startsWith("#")) {
    const encoded = raw.slice(1);
    try {
      decoded = decodeURIComponent(encoded);
    } catch {
      decoded = encoded;
    }
  }
  const withSlash = decoded.startsWith("/") ? decoded : `/${decoded}`;
  const pathname = withSlash.split("?")[0] || "/";

  if (KNOWN_PAGE_PATHS.has(pathname)) {
    return pathname;
  }

  if (pathname.endsWith("/") && KNOWN_PAGE_PATHS.has(pathname.slice(0, -1))) {
    return pathname.slice(0, -1);
  }

  return "/";
}

function appendDesktopBridge(html: string): string {
  let output = html;

  output = output
    .replace(/href="\/styles\.css"/g, `href="${DESKTOP_STYLES_URL}"`)
    .replace(/href='\/styles\.css'/g, `href='${DESKTOP_STYLES_URL}'`)
    .replace(/src="\/sidebar-update\.js"/g, `src="${DESKTOP_SIDEBAR_SCRIPT_URL}"`)
    .replace(/src='\/sidebar-update\.js'/g, `src='${DESKTOP_SIDEBAR_SCRIPT_URL}'`);

  if (!output.includes(DESKTOP_BRIDGE_URL)) {
    output = output.replace(
      /<head[^>]*>/i,
      (match) => `${match}\n    <script src="${DESKTOP_BRIDGE_URL}"></script>`
    );
  }

  output = output.replace(/<html\b([^>]*)>/i, (_match, attrs: string) => {
    if (attrs.includes("data-clawos-desktop-page")) {
      return `<html${attrs}>`;
    }
    return `<html${attrs} data-clawos-desktop-page="1">`;
  });

  return output;
}

function responseToHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

function buildNotFoundApiResponse(pathname: string): Response {
  return new Response(JSON.stringify({ ok: false, error: `接口不存在: ${pathname}` }), {
    status: 404,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function buildPageNotFoundResponse(pathname: string): Response {
  const html = `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ClawOS 页面不存在</title>
  </head>
  <body>
    <h1>页面不存在</h1>
    <p>路径：${pathname}</p>
  </body>
</html>
  `.trim();

  return new Response(html, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function invokeDesktopApi(params: DesktopApiRequest): Promise<DesktopApiResponse> {
  const endpoint = new URL(String(params.path || "/"), DESKTOP_BASE_URL);
  const method = normalizeMethod(params.method);

  const init: RequestInit = {
    method,
    headers: params.headers || {},
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = typeof params.body === "string" ? params.body : "";
  }

  const request = new Request(endpoint.toString(), init);
  const response =
    (await handleApiRequest(request, endpoint.pathname)) || buildNotFoundApiResponse(endpoint.pathname);

  return {
    status: response.status,
    headers: responseToHeaders(response),
    body: await response.text(),
  };
}

export async function renderDesktopPage(path: string): Promise<DesktopPageResponse> {
  const normalizedPath = normalizePagePath(path);
  const response = handlePageRequest(normalizedPath) || buildPageNotFoundResponse(normalizedPath);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();

  if (!contentType.includes("text/html")) {
    const page = buildPageNotFoundResponse(normalizedPath);
    return {
      status: page.status,
      html: appendDesktopBridge(await page.text()),
    };
  }

  return {
    status: response.status,
    html: appendDesktopBridge(await response.text()),
  };
}
