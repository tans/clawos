import Electrobun, { BrowserView, BrowserWindow, Tray, type MenuItemConfig } from "electrobun";
import { createConnection, createServer, type Server } from "node:net";
import { ensureLocalConfigTemplateFile } from "../config/local";
import type { DesktopRpcSchema } from "../desktop-ui/rpc-schema";
import { invokeDesktopApi, renderDesktopPage } from "./desktop-ui";
import { computeDesktopControlPort } from "./single-instance";
import { detectAndPersistOpenclawExecutionEnvironment } from "../system/openclaw-execution";
import {
  getSelfUpdateStatus,
  runSelfUpdate,
  type ElectrobunUpdateStatusEntry,
  type SelfUpdateStatus,
} from "../system/self-update";
import { startGatewayControlTask } from "../tasks/gateway";
import shellHtml from "../desktop-ui/shell.html" with { type: "text" };
import { VERSION } from "../app.constants";

const SINGLE_INSTANCE_HOST = "127.0.0.1";
// Electrobun's flat-file views loader resolves the URL as a file path on Windows.
// Query strings break that resolution, so the views entry must stay path-only.
const SHELL_VIEW_URL = "views://clawos/shell.html";
const TRAY_ICON_URL = "views://clawos/logo.png";
const IS_DESKTOP_DEV = ["1", "true", "yes", "on"].includes(
  (process.env.CLAWOS_DESKTOP_DEV || "").trim().toLowerCase()
);
const SHOULD_OPEN_DEVTOOLS = ["1", "true", "yes", "on"].includes(
  (process.env.CLAWOS_DESKTOP_OPEN_DEVTOOLS || "").trim().toLowerCase()
);
const SHOULD_BACKGROUND_CHECK_UPDATES = !["0", "false", "no", "off"].includes(
  (process.env.CLAWOS_BACKGROUND_UPDATE_CHECK || "").trim().toLowerCase()
);
const SHOULD_BACKGROUND_DOWNLOAD_UPDATES = !["0", "false", "no", "off"].includes(
  (process.env.CLAWOS_BACKGROUND_UPDATE_DOWNLOAD || "").trim().toLowerCase()
);

type UpdateTrayPhase = "idle" | "checking" | "available" | "downloading" | "ready" | "applying" | "error";
type TrayClickEvent = {
  data?: {
    action?: string;
    data?: unknown;
  };
};
type UpdateTrayState = {
  phase: UpdateTrayPhase;
  hasUpdate: boolean;
  readyToApply: boolean;
  message: string;
  currentVersion: string;
  remoteVersion: string | null;
  checkedAt: string | null;
  error: string | null;
};

let desktopWindow: BrowserWindow | null = null;
let appTray: Tray | null = null;
let updateActionPromise: Promise<void> | null = null;
const APP_WINDOW_TITLE = `ClawOS v${VERSION}`;
const updateTrayState: UpdateTrayState = {
  phase: "idle",
  hasUpdate: false,
  readyToApply: false,
  message: "\u5c1a\u672a\u68c0\u67e5\u66f4\u65b0",
  currentVersion: VERSION,
  remoteVersion: null,
  checkedAt: null,
  error: null,
};

function resolveUseInlineShellHtml(): boolean {
  const raw = (process.env.CLAWOS_DESKTOP_INLINE_HTML || "").trim().toLowerCase();
  if (raw) {
    return ["1", "true", "yes", "on"].includes(raw);
  }

  return false;
}

function focusDesktopWindow(): void {
  if (!desktopWindow) {
    return;
  }
  try {
    if (typeof (desktopWindow as unknown as { unminimize?: () => unknown }).unminimize === "function") {
      (desktopWindow as unknown as { unminimize: () => unknown }).unminimize();
    }
    desktopWindow.focus();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[desktop] failed to focus window: ${message}`);
  }
}

function formatCheckedTime(isoTime: string | null): string | null {
  if (!isoTime) {
    return null;
  }

  const value = new Date(isoTime);
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function updateTrayStatePatch(patch: Partial<UpdateTrayState>): void {
  Object.assign(updateTrayState, patch);
  refreshTrayMenu();
}

function syncTrayStateFromSelfUpdateStatus(status: SelfUpdateStatus): void {
  if (!status.supported) {
    updateTrayStatePatch({
      phase: "error",
      hasUpdate: false,
      readyToApply: false,
      message: status.reason || "\u5f53\u524d\u73af\u5883\u4e0d\u652f\u6301\u81ea\u52a8\u66f4\u65b0",
      currentVersion: status.currentVersion || VERSION,
      remoteVersion: null,
      checkedAt: status.checkedAt || null,
      error: status.reason || null,
    });
    return;
  }

  if (status.error) {
    updateTrayStatePatch({
      phase: "error",
      hasUpdate: Boolean(status.hasUpdate),
      readyToApply: Boolean(status.updateReady),
      message: status.error,
      currentVersion: status.currentVersion || VERSION,
      remoteVersion: status.remoteVersion,
      checkedAt: status.checkedAt || null,
      error: status.error,
    });
    return;
  }

  const phase: UpdateTrayPhase = status.updateReady
    ? "ready"
    : status.hasUpdate
      ? "available"
      : "idle";
  const message = status.updateReady
    ? `\u66f4\u65b0\u5df2\u5c31\u7eea\uff1a${status.remoteVersion || "\u65b0\u7248\u672c"}`
    : status.hasUpdate
      ? `\u53d1\u73b0\u65b0\u7248\u672c\uff1a${status.remoteVersion || "\u53ef\u66f4\u65b0"}`
      : "\u5f53\u524d\u5df2\u662f\u6700\u65b0\u7248\u672c";

  updateTrayStatePatch({
    phase,
    hasUpdate: Boolean(status.hasUpdate),
    readyToApply: Boolean(status.updateReady),
    message,
    currentVersion: status.currentVersion || VERSION,
    remoteVersion: status.remoteVersion,
    checkedAt: status.checkedAt || null,
    error: null,
  });
}

function syncTrayStateFromUpdaterStatus(entry: ElectrobunUpdateStatusEntry): void {
  switch (entry.status) {
    case "checking":
      updateTrayStatePatch({
        phase: "checking",
        message: "\u6b63\u5728\u68c0\u67e5\u66f4\u65b0...",
        error: null,
      });
      break;
    case "update-available":
      updateTrayStatePatch({
        phase: "available",
        hasUpdate: true,
        readyToApply: false,
        message: "\u53d1\u73b0\u65b0\u7248\u672c\uff0c\u6b63\u5728\u540e\u53f0\u4e0b\u8f7d...",
        error: null,
      });
      break;
    case "download-starting":
    case "checking-local-tar":
    case "local-tar-found":
    case "local-tar-missing":
    case "fetching-patch":
    case "patch-found":
    case "patch-not-found":
    case "downloading":
    case "downloading-patch":
    case "download-progress":
    case "downloading-full-bundle":
    case "decompressing":
    case "download-complete":
    case "patch-chain-complete":
    case "patch-applied":
    case "applying-patch":
      updateTrayStatePatch({
        phase: "downloading",
        hasUpdate: true,
        readyToApply: false,
        message: "\u6b63\u5728\u540e\u53f0\u4e0b\u8f7d\u66f4\u65b0...",
        error: null,
      });
      break;
    case "applying":
    case "extracting":
    case "replacing-app":
    case "launching-new-version":
      updateTrayStatePatch({
        phase: "applying",
        hasUpdate: true,
        readyToApply: true,
        message: "\u6b63\u5728\u5b89\u88c5\u66f4\u65b0\u5e76\u91cd\u542f...",
        error: null,
      });
      break;
    case "complete":
      updateTrayStatePatch({
        phase: "ready",
        hasUpdate: true,
        readyToApply: true,
        message: "\u66f4\u65b0\u5df2\u51c6\u5907\u5b8c\u6210\uff0c\u7b49\u5f85\u91cd\u542f\u5b89\u88c5",
        checkedAt: new Date().toISOString(),
        error: null,
      });
      break;
    case "no-update":
      updateTrayStatePatch({
        phase: "idle",
        hasUpdate: false,
        readyToApply: false,
        message: "\u5f53\u524d\u5df2\u662f\u6700\u65b0\u7248\u672c",
        checkedAt: new Date().toISOString(),
        error: null,
      });
      break;
    case "error":
      updateTrayStatePatch({
        phase: "error",
        message: entry.message || "\u68c0\u67e5\u66f4\u65b0\u5931\u8d25",
        error: entry.message || "\u68c0\u67e5\u66f4\u65b0\u5931\u8d25",
        checkedAt: new Date().toISOString(),
      });
      break;
    default:
      break;
  }
}

function getUpdateStatusLine(): string {
  const checkedTime = formatCheckedTime(updateTrayState.checkedAt);
  if (updateTrayState.phase === "ready") {
    return `\u66f4\u65b0\uff1a\u53ef\u91cd\u542f\u5b89\u88c5${updateTrayState.remoteVersion ? ` (${updateTrayState.remoteVersion})` : ""}`;
  }
  if (updateTrayState.phase === "downloading") {
    return "\u66f4\u65b0\uff1a\u540e\u53f0\u4e0b\u8f7d\u4e2d";
  }
  if (updateTrayState.phase === "checking") {
    return "\u66f4\u65b0\uff1a\u68c0\u67e5\u4e2d";
  }
  if (updateTrayState.phase === "error") {
    return "\u66f4\u65b0\uff1a\u68c0\u67e5\u5931\u8d25";
  }
  if (updateTrayState.hasUpdate) {
    return `\u66f4\u65b0\uff1a\u53d1\u73b0\u65b0\u7248\u672c${updateTrayState.remoteVersion ? ` (${updateTrayState.remoteVersion})` : ""}`;
  }
  if (checkedTime) {
    return `\u66f4\u65b0\uff1a\u5df2\u662f\u6700\u65b0 (${checkedTime})`;
  }
  return "\u66f4\u65b0\uff1a\u5c1a\u672a\u68c0\u67e5";
}

function buildTrayMenu(): MenuItemConfig[] {
  const menu: MenuItemConfig[] = [
    {
      label: desktopWindow ? "\u663e\u793a\u4e3b\u7a97\u53e3" : "\u6253\u5f00 ClawOS",
      action: "open-main",
    },
    {
      label: getUpdateStatusLine(),
      action: "noop",
      enabled: false,
    },
  ];

  if (updateTrayState.readyToApply) {
    menu.push({
      label: updateTrayState.remoteVersion
        ? `\u91cd\u542f\u5b89\u88c5 ${updateTrayState.remoteVersion}`
        : "\u91cd\u542f\u5b89\u88c5\u66f4\u65b0",
      action: "apply-update",
      enabled: updateTrayState.phase !== "applying",
    });
  } else if (updateTrayState.hasUpdate) {
    menu.push({
      label: "\u540e\u53f0\u4e0b\u8f7d\u66f4\u65b0",
      action: "download-update",
      enabled: updateTrayState.phase !== "downloading",
    });
  } else {
    menu.push({
      label: "\u68c0\u67e5\u66f4\u65b0",
      action: "check-update",
      enabled: updateTrayState.phase !== "checking",
    });
  }

  menu.push(
    {
      label: "\u91cd\u542f Gateway",
      action: "restart-gateway",
    },
    { type: "divider" },
    {
      label: "\u9000\u51fa",
      action: "quit-app",
    }
  );

  return menu;
}

function refreshTrayMenu(): void {
  if (!appTray) {
    return;
  }
  appTray.setMenu(buildTrayMenu());
}

function showDesktopNotification(title: string, body: string): void {
  try {
    Electrobun.Utils.showNotification({
      title,
      body,
      silent: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[desktop] failed to show notification: ${message}`);
  }
}

function handleUpdateAction(operation: () => Promise<void>): void {
  if (updateActionPromise) {
    return;
  }

  updateActionPromise = operation().finally(() => {
    updateActionPromise = null;
    refreshTrayMenu();
  });
}

async function checkForUpdates(options: {
  trigger: "startup" | "tray";
  downloadIfAvailable: boolean;
}): Promise<void> {
  updateTrayStatePatch({
    phase: "checking",
    message:
      options.trigger === "startup"
        ? "\u542f\u52a8\u540e\u68c0\u67e5\u66f4\u65b0..."
        : "\u6b63\u5728\u68c0\u67e5\u66f4\u65b0...",
    error: null,
  });

  try {
    const status = await getSelfUpdateStatus(true);
    syncTrayStateFromSelfUpdateStatus(status);

    if (!status.hasUpdate) {
      return;
    }

    if (status.updateReady) {
      showDesktopNotification(
        "ClawOS \u66f4\u65b0\u5df2\u5c31\u7eea",
        status.remoteVersion
          ? `\u53ef\u91cd\u542f\u5b89\u88c5 ${status.remoteVersion}`
          : "\u66f4\u65b0\u5305\u5df2\u51c6\u5907\u5b8c\u6210"
      );
      return;
    }

    if (!options.downloadIfAvailable) {
      showDesktopNotification(
        "ClawOS \u53d1\u73b0\u65b0\u7248\u672c",
        status.remoteVersion
          ? `\u68c0\u6d4b\u5230 ${status.remoteVersion}`
          : "\u53d1\u73b0\u53ef\u7528\u66f4\u65b0"
      );
      return;
    }

    updateTrayStatePatch({
      phase: "downloading",
      hasUpdate: true,
      readyToApply: false,
      message: "\u53d1\u73b0\u65b0\u7248\u672c\uff0c\u6b63\u5728\u540e\u53f0\u4e0b\u8f7d...",
      error: null,
    });

    await runSelfUpdate({
      applyUpdate: false,
      onStatus: syncTrayStateFromUpdaterStatus,
    });

    const refreshed = await getSelfUpdateStatus(true);
    syncTrayStateFromSelfUpdateStatus(refreshed);
    if (refreshed.updateReady) {
      showDesktopNotification(
        "ClawOS \u66f4\u65b0\u5df2\u4e0b\u8f7d",
        refreshed.remoteVersion
          ? `\u5df2\u51c6\u5907\u5b89\u88c5 ${refreshed.remoteVersion}`
          : "\u66f4\u65b0\u5305\u5df2\u51c6\u5907\u5b8c\u6210"
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateTrayStatePatch({
      phase: "error",
      message,
      error: message,
      checkedAt: new Date().toISOString(),
    });
    console.warn(`[desktop] background update check failed: ${message}`);
  }
}

function startBackgroundUpdateCheck(): void {
  if (!SHOULD_BACKGROUND_CHECK_UPDATES) {
    return;
  }

  handleUpdateAction(async () => {
    await checkForUpdates({
      trigger: "startup",
      downloadIfAvailable: SHOULD_BACKGROUND_DOWNLOAD_UPDATES,
    });
  });
}

function applyReadyUpdate(): void {
  handleUpdateAction(async () => {
    try {
      updateTrayStatePatch({
        phase: "applying",
        message: "\u6b63\u5728\u5b89\u88c5\u66f4\u65b0\u5e76\u91cd\u542f...",
        error: null,
      });

      await runSelfUpdate({
        applyUpdate: true,
        onStatus: syncTrayStateFromUpdaterStatus,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateTrayStatePatch({
        phase: "error",
        message,
        error: message,
      });
      showDesktopNotification("ClawOS \u66f4\u65b0\u5931\u8d25", message);
    }
  });
}

function handleTrayClick(event: TrayClickEvent): void {
  const action = String(event?.data?.action || "").trim();
  if (!action) {
    openOrCreateDesktopWindow();
    return;
  }

  switch (action) {
    case "open-main":
      openOrCreateDesktopWindow();
      break;
    case "check-update":
      handleUpdateAction(async () => {
        await checkForUpdates({
          trigger: "tray",
          downloadIfAvailable: false,
        });
      });
      break;
    case "download-update":
      handleUpdateAction(async () => {
        await checkForUpdates({
          trigger: "tray",
          downloadIfAvailable: true,
        });
      });
      break;
    case "apply-update":
      applyReadyUpdate();
      break;
    case "restart-gateway":
      startGatewayControlTask("restart");
      showDesktopNotification("ClawOS", "\u5df2\u5f00\u59cb\u91cd\u542f Gateway");
      break;
    case "quit-app":
      Electrobun.Utils.quit();
      break;
    default:
      openOrCreateDesktopWindow();
      break;
  }
}

function ensureTray(): void {
  if (appTray) {
    refreshTrayMenu();
    return;
  }

  appTray = new Tray({
    title: "ClawOS",
    image: TRAY_ICON_URL,
    width: 18,
    height: 18,
  });
  appTray.on("tray-clicked", (event) => {
    handleTrayClick(event as TrayClickEvent);
  });
  refreshTrayMenu();
}

async function notifyRunningInstance(controlPort: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: SINGLE_INSTANCE_HOST, port: controlPort });
    let resolved = false;
    const done = (value: boolean): void => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(value);
    };

    socket.setTimeout(700);
    socket.once("connect", () => {
      socket.write("focus\n", () => {
        socket.end();
        done(true);
      });
    });
    socket.once("timeout", () => {
      socket.destroy();
      done(false);
    });
    socket.once("error", () => {
      done(false);
    });
    socket.once("close", () => {
      done(resolved);
    });
  });
}

async function openControlServer(controlPort: number, onFocus: () => void): Promise<Server> {
  return await new Promise<Server>((resolve, reject) => {
    const server = createServer((socket) => {
      socket.setEncoding("utf8");
      socket.on("data", (chunk) => {
        const text = String(chunk || "").trim().toLowerCase();
        if (text.includes("focus")) {
          onFocus();
        }
      });
      socket.on("error", () => {
        // ignore per-connection errors
      });
      socket.end("ok\n");
    });

    server.once("error", (error) => reject(error));
    server.listen(controlPort, SINGLE_INSTANCE_HOST, () => resolve(server));
  });
}

async function acquireSingleInstanceGuard(controlPort: number): Promise<{ isPrimary: boolean; server: Server | null }> {
  if (await notifyRunningInstance(controlPort)) {
    return { isPrimary: false, server: null };
  }

  try {
    const server = await openControlServer(controlPort, focusDesktopWindow);
    return { isPrimary: true, server };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === "EADDRINUSE" && (await notifyRunningInstance(controlPort))) {
      return { isPrimary: false, server: null };
    }
    throw error;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderStartupErrorHtml(errorMessage: string): string {
  const safeError = escapeHtml(errorMessage);
  return `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ClawOS &#21551;&#21160;&#22833;&#36133;</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        font-family:
          "Microsoft YaHei UI",
          "Microsoft YaHei",
          "PingFang SC",
          "Noto Sans CJK SC",
          "Segoe UI",
          sans-serif;
        background: #f6f8fb;
        color: #111827;
      }
      main { max-width: 720px; margin: 48px auto; background: #ffffff; border: 1px solid #dbe2ea; border-radius: 12px; padding: 24px; box-shadow: 0 6px 20px rgba(15, 23, 42, 0.06); }
      h1 { margin: 0 0 12px; font-size: 22px; }
      p { margin: 8px 0; line-height: 1.6; }
      code { display: block; margin-top: 8px; background: #f1f5f9; border-radius: 6px; padding: 10px; font-size: 12px; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <main>
      <h1>ClawOS &#21551;&#21160;&#22833;&#36133;</h1>
      <p>&#26700;&#38754;&#22771;&#21021;&#22987;&#21270;&#22833;&#36133;&#12290;</p>
      <p>&#38169;&#35823;&#20449;&#24687;&#65306;</p>
      <code>${safeError}</code>
      <p>&#35831;&#37325;&#21551;&#23458;&#25143;&#31471;&#21518;&#37325;&#35797;&#12290;</p>
    </main>
  </body>
</html>
  `.trim();
}

function assertAllowedExternalUrl(rawUrl: string): string {
  const url = String(rawUrl || "").trim();
  if (!url) {
    throw new Error("\u5916\u90e8\u94fe\u63a5\u4e0d\u80fd\u4e3a\u7a7a\u3002");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`\u5916\u90e8\u94fe\u63a5\u65e0\u6548\uff1a${url}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`\u4e0d\u652f\u6301\u7684\u5916\u90e8\u94fe\u63a5\u534f\u8bae\uff1a${parsed.protocol}`);
  }

  return parsed.toString();
}

function createDesktopRpc() {
  return BrowserView.defineRPC<DesktopRpcSchema>({
    maxRequestTime: 60_000,
    handlers: {
      requests: {
        api: async (params) => await invokeDesktopApi(params),
        renderPage: async (params) => await renderDesktopPage(params.path),
        openExternalUrl: async (params) => {
          const url = assertAllowedExternalUrl(params?.url || "");
          const ok = Electrobun.Utils.openExternal(url);
          if (!ok) {
            throw new Error(`\u8c03\u7528\u7cfb\u7edf\u6d4f\u89c8\u5668\u5931\u8d25\uff1a${url}`);
          }
          return { ok: true };
        },
      },
    },
  });
}

function attachWindowCloseTracking(window: BrowserWindow): void {
  window.on("close", () => {
    if (desktopWindow?.id === window.id) {
      desktopWindow = null;
      refreshTrayMenu();
    }
  });
}

function createDesktopWindow(): BrowserWindow {
  const windowContent = resolveUseInlineShellHtml() ? { html: shellHtml } : { url: SHELL_VIEW_URL };
  const window = new BrowserWindow({
    title: APP_WINDOW_TITLE,
    frame: { x: 120, y: 80, width: 1360, height: 900 },
    rpc: createDesktopRpc(),
    ...windowContent,
  });

  attachWindowCloseTracking(window);

  if (IS_DESKTOP_DEV && SHOULD_OPEN_DEVTOOLS) {
    try {
      window.webview.openDevTools();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[desktop] failed to open devtools: ${message}`);
    }
  }

  desktopWindow = window;
  refreshTrayMenu();
  return window;
}

function openOrCreateDesktopWindow(): BrowserWindow {
  if (!desktopWindow) {
    return createDesktopWindow();
  }
  focusDesktopWindow();
  return desktopWindow;
}

async function main(): Promise<void> {
  const controlPort = computeDesktopControlPort();
  const useInlineShellHtml = resolveUseInlineShellHtml();
  console.log(`[desktop] booting ClawOS shell (${useInlineShellHtml ? "inline html" : "views url"})`);
  console.log(`[desktop] single-instance control at ${SINGLE_INSTANCE_HOST}:${controlPort}`);
  if (IS_DESKTOP_DEV) {
    console.log("[desktop] dev mode enabled");
    if (SHOULD_OPEN_DEVTOOLS) {
      console.log("[desktop] devtools auto-open enabled");
    }
  }

  try {
    ensureLocalConfigTemplateFile();
    await detectAndPersistOpenclawExecutionEnvironment();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[desktop] failed to detect execution environment: ${message}`);
  }

  const guard = await acquireSingleInstanceGuard(controlPort);
  if (!guard.isPrimary) {
    console.log("[desktop] another instance is active; requested focus and exiting.");
    process.exit(0);
    return;
  }

  Electrobun.events.on("before-quit", () => {
    guard.server?.close();
    appTray?.remove();
    appTray = null;
  });

  ensureTray();

  try {
    createDesktopWindow();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[desktop] failed to bootstrap desktop UI: ${message}`);
    const fallbackWindow = new BrowserWindow({
      title: `${APP_WINDOW_TITLE} (\u542f\u52a8\u5931\u8d25)`,
      frame: { x: 120, y: 80, width: 980, height: 700 },
      html: renderStartupErrorHtml(message),
    });
    attachWindowCloseTracking(fallbackWindow);
    desktopWindow = fallbackWindow;
  }

  startBackgroundUpdateCheck();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[desktop] fatal startup error: ${message}`);
  process.exit(1);
});
