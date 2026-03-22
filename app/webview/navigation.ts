import { formatRuntimeError } from "./error-screen";
import { navigateToRoute } from "./render-route";
import { normalizePagePath, readRouteFromHash, toRouteHash } from "./router";
import { openExternalUrl, proxyApiRequest } from "./rpc";

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

function isApiRequest(url: URL): boolean {
  return url.pathname.startsWith("/api/");
}

export function installNavigationInterceptor(): void {
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

export function installFetchShim(): void {
  const nativeFetch = window.fetch.bind(window);
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

export function exposeDesktopHelpers(): void {
  Object.defineProperty(window, "__clawosDesktop", {
    configurable: true,
    enumerable: false,
    writable: false,
    value: {
      openExternalUrl,
    },
  });
}
