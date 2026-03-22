import { Electroview } from "electrobun/view";
import type { DesktopApiResponse, DesktopRpcSchema } from "../shared/rpc/schema";

export const PAGE_RENDER_TIMEOUT_MS = 15_000;
export const API_PROXY_TIMEOUT_MS = 20_000;
export const OPEN_EXTERNAL_TIMEOUT_MS = 10_000;

export const rpc = Electroview.defineRPC<DesktopRpcSchema>({
  maxRequestTime: 60_000,
  handlers: { requests: {} },
});

new Electroview({ rpc });

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
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

export async function proxyApiRequest(request: Request): Promise<Response> {
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

export async function openExternalUrl(url: string): Promise<void> {
  await withTimeout(
    rpc.request.openExternalUrl({ url }),
    OPEN_EXTERNAL_TIMEOUT_MS,
    `Open external url timeout (>${Math.floor(OPEN_EXTERNAL_TIMEOUT_MS / 1000)}s)`
  );
}
