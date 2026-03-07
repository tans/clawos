import Electrobun, { BrowserView, BrowserWindow } from "electrobun";
import { createConnection, createServer, type Server } from "node:net";
import { ensureLocalConfigTemplateFile } from "../config/local";
import type { DesktopRpcSchema } from "../desktop-ui/rpc-schema";
import { invokeDesktopApi, renderDesktopPage } from "./desktop-ui";
import { computeDesktopControlPort } from "./single-instance";
import { detectAndPersistOpenclawExecutionEnvironment } from "../system/openclaw-execution";
import shellHtml from "../desktop-ui/shell.html" with { type: "text" };
import { VERSION } from "../app.constants";

const SINGLE_INSTANCE_HOST = "127.0.0.1";
const SHELL_VIEW_URL = "views://clawos/shell.html";
const IS_DESKTOP_DEV = ["1", "true", "yes", "on"].includes(
  (process.env.CLAWOS_DESKTOP_DEV || "").trim().toLowerCase()
);
const SHOULD_OPEN_DEVTOOLS = ["1", "true", "yes", "on"].includes(
  (process.env.CLAWOS_DESKTOP_OPEN_DEVTOOLS || "").trim().toLowerCase()
);

let desktopWindow: BrowserWindow | null = null;
const APP_WINDOW_TITLE = `ClawOS v${VERSION}`;

function resolveUseInlineShellHtml(): boolean {
  const raw = (process.env.CLAWOS_DESKTOP_INLINE_HTML || "").trim().toLowerCase();
  if (raw) {
    return ["1", "true", "yes", "on"].includes(raw);
  }

  if (IS_DESKTOP_DEV) {
    return false;
  }

  return process.platform === "win32";
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

function createDesktopRpc() {
  return BrowserView.defineRPC<DesktopRpcSchema>({
    maxRequestTime: 60_000,
    handlers: {
      requests: {
        api: async (params) => await invokeDesktopApi(params),
        renderPage: async (params) => await renderDesktopPage(params.path),
      },
    },
  });
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
  });

  try {
    const windowContent = useInlineShellHtml ? { html: shellHtml } : { url: SHELL_VIEW_URL };
    desktopWindow = new BrowserWindow({
      title: APP_WINDOW_TITLE,
      frame: { x: 120, y: 80, width: 1360, height: 900 },
      rpc: createDesktopRpc(),
      ...windowContent,
    });

    if (IS_DESKTOP_DEV && SHOULD_OPEN_DEVTOOLS) {
      try {
        desktopWindow.webview.openDevTools();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[desktop] failed to open devtools: ${message}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[desktop] failed to bootstrap desktop UI: ${message}`);
    desktopWindow = new BrowserWindow({
      title: `${APP_WINDOW_TITLE} (启动失败)`,
      frame: { x: 120, y: 80, width: 980, height: 700 },
      html: renderStartupErrorHtml(message),
    });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[desktop] fatal startup error: ${message}`);
  process.exit(1);
});

