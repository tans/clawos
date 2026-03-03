import Electrobun, { BrowserWindow } from "electrobun";
import { createServer, createConnection, type Server } from "node:net";
import { ensureLocalConfigTemplateFile, readLocalAppSettings } from "../config/local";

const DEFAULT_PORT = 8080;
const HEALTH_PATH = "/api/health";
const SINGLE_INSTANCE_HOST = "127.0.0.1";
const IS_DESKTOP_DEV = ["1", "true", "yes", "on"].includes(
  (process.env.CLAWOS_DESKTOP_DEV || "").trim().toLowerCase()
);
let desktopWindow: BrowserWindow | null = null;

function resolveServerPort(): number {
  const fromEnv = Number.parseInt(process.env.CLAWOS_DESKTOP_PORT || "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0 && fromEnv <= 65535) {
    return fromEnv;
  }

  try {
    ensureLocalConfigTemplateFile();
    const settings = readLocalAppSettings();
    if (Number.isFinite(settings.port) && settings.port > 0 && settings.port <= 65535) {
      return settings.port;
    }
  } catch {
    // Fall back to the default port when local config is unreadable.
  }

  return DEFAULT_PORT;
}

function buildServerUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

function resolveControlPort(serverPort: number): number {
  const fromEnv = Number.parseInt(process.env.CLAWOS_DESKTOP_CONTROL_PORT || "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0 && fromEnv <= 65535) {
    return fromEnv;
  }

  const derived = serverPort + 71;
  if (derived <= 65535) {
    return derived;
  }
  return Math.max(1, serverPort - 71);
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

async function isServerReady(serverUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${serverUrl}${HEALTH_PATH}`);
    if (!response.ok) {
      return false;
    }
    const payload = await response.json().catch(() => null);
    return Boolean(payload && typeof payload === "object" && (payload as { ok?: unknown }).ok === true);
  } catch {
    return false;
  }
}

async function waitForServer(serverUrl: string, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    if (await isServerReady(serverUrl)) {
      return true;
    }
    await Bun.sleep(300);
  }
  return false;
}

async function ensureClawosServer(serverUrl: string): Promise<void> {
  if (await waitForServer(serverUrl, 800)) {
    return;
  }

  // Do not open an external browser when running inside the desktop shell.
  process.env.CLAWOS_AUTO_OPEN_BROWSER = "0";
  process.env.CLAWOS_DESKTOP = "1";
  await import("../server.ts");

  const started = await waitForServer(serverUrl, 15_000);
  if (!started) {
    throw new Error(`ClawOS 服务启动超时：${serverUrl}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderStartupErrorHtml(serverUrl: string, errorMessage: string): string {
  const safeUrl = escapeHtml(serverUrl);
  const safeError = escapeHtml(errorMessage);
  return `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ClawOS 启动失败</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f8fb; color: #111827; }
      main { max-width: 720px; margin: 48px auto; background: #ffffff; border: 1px solid #dbe2ea; border-radius: 12px; padding: 24px; box-shadow: 0 6px 20px rgba(15, 23, 42, 0.06); }
      h1 { margin: 0 0 12px; font-size: 22px; }
      p { margin: 8px 0; line-height: 1.6; }
      code { display: block; margin-top: 8px; background: #f1f5f9; border-radius: 6px; padding: 10px; font-size: 12px; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <main>
      <h1>ClawOS 启动失败</h1>
      <p>桌面壳未能连接到本地服务：<code>${safeUrl}</code></p>
      <p>错误信息：</p>
      <code>${safeError}</code>
      <p>请先检查端口占用、WSL 状态和权限后重试。</p>
    </main>
  </body>
</html>
  `.trim();
}

async function main(): Promise<void> {
  const serverPort = resolveServerPort();
  const serverUrl = buildServerUrl(serverPort);
  const controlPort = resolveControlPort(serverPort);
  console.log(`[desktop] booting ClawOS shell at ${serverUrl}`);
  console.log(`[desktop] single-instance control at ${SINGLE_INSTANCE_HOST}:${controlPort}`);
  if (IS_DESKTOP_DEV) {
    console.log("[desktop] dev mode enabled");
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
    await ensureClawosServer(serverUrl);
    desktopWindow = new BrowserWindow({
      title: "ClawOS",
      frame: { x: 120, y: 80, width: 1360, height: 900 },
      url: serverUrl,
    });
    if (IS_DESKTOP_DEV) {
      try {
        desktopWindow.webview.openDevTools();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[desktop] failed to open devtools: ${message}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[desktop] failed to bootstrap ClawOS server: ${message}`);
    desktopWindow = new BrowserWindow({
      title: "ClawOS (启动失败)",
      frame: { x: 120, y: 80, width: 980, height: 700 },
      html: renderStartupErrorHtml(serverUrl, message),
    });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[desktop] fatal startup error: ${message}`);
  process.exit(1);
});
