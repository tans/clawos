import { installGlobalErrorHandlers, formatRuntimeError, renderDesktopError } from "./error-screen";
import { exposeDesktopHelpers, installFetchShim, installNavigationInterceptor } from "./navigation";
import { navigateToRoute } from "./render-route";
import { readRouteFromHash } from "./router";

const BOOT_SCREEN_MIN_DURATION_MS = 2000;

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
