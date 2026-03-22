import { BrowserWindow } from "electrobun";
import shellHtml from "../webview/shell.html" with { type: "text" };
import { VERSION } from "../shared/constants/app";

const SHELL_VIEW_URL = "views://clawos/shell.html";
const IS_DESKTOP_DEV = ["1", "true", "yes", "on"].includes(
  (process.env.CLAWOS_DESKTOP_DEV || "").trim().toLowerCase()
);
const SHOULD_OPEN_DEVTOOLS = ["1", "true", "yes", "on"].includes(
  (process.env.CLAWOS_DESKTOP_OPEN_DEVTOOLS || "").trim().toLowerCase()
);
const APP_WINDOW_TITLE = `ClawOS v${VERSION}`;

let desktopWindow: BrowserWindow | null = null;

export function resolveUseInlineShellHtml(): boolean {
  const raw = (process.env.CLAWOS_DESKTOP_INLINE_HTML || "").trim().toLowerCase();
  if (raw) {
    return ["1", "true", "yes", "on"].includes(raw);
  }

  return false;
}

export function isDesktopDevMode(): boolean {
  return IS_DESKTOP_DEV;
}

export function shouldOpenDevtools(): boolean {
  return SHOULD_OPEN_DEVTOOLS;
}

export function focusDesktopWindow(): void {
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

function attachWindowCloseTracking(window: BrowserWindow): void {
  window.on("close", () => {
    if (desktopWindow?.id === window.id) {
      desktopWindow = null;
    }
  });
}

export function renderStartupErrorHtml(errorMessage: string): string {
  const safeError = errorMessage
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
        background: #ffffff;
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

export function createDesktopWindow(createRpc: () => unknown): BrowserWindow {
  const windowContent = resolveUseInlineShellHtml() ? { html: shellHtml } : { url: SHELL_VIEW_URL };
  const window = new BrowserWindow({
    title: APP_WINDOW_TITLE,
    frame: { x: 120, y: 80, width: 1360, height: 900 },
    rpc: createRpc(),
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
  return window;
}

export function openOrCreateDesktopWindow(
  createRpc: () => unknown
): BrowserWindow {
  if (!desktopWindow) {
    return createDesktopWindow(createRpc);
  }
  focusDesktopWindow();
  return desktopWindow;
}

export function createStartupErrorWindow(message: string): BrowserWindow {
  const window = new BrowserWindow({
    title: `${APP_WINDOW_TITLE} (启动失败)`,
    frame: { x: 120, y: 80, width: 980, height: 700 },
    html: renderStartupErrorHtml(message),
  });
  attachWindowCloseTracking(window);
  desktopWindow = window;
  return window;
}
