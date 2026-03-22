import { renderDesktopError, formatRuntimeError } from "./error-screen";
import { normalizePagePath } from "./router";
import { PAGE_RENDER_TIMEOUT_MS, rpc, withTimeout } from "./rpc";

let navigationToken = 0;

export async function renderRoute(normalizedRoute: string, fallbackToHome: boolean): Promise<void> {
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

export async function navigateToRoute(route: string): Promise<void> {
  const normalizedRoute = normalizePagePath(route);
  await renderRoute(normalizedRoute, true);
}
