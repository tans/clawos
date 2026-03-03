import { BrowserWindow } from "electrobun";
import { ensureLocalConfigTemplateFile, readLocalAppSettings } from "../config/local";

const DEFAULT_PORT = 8080;
const HEALTH_PATH = "/api/health";

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

  try {
    await ensureClawosServer(serverUrl);
    new BrowserWindow({
      title: "ClawOS",
      frame: { x: 120, y: 80, width: 1360, height: 900 },
      url: serverUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[desktop] failed to bootstrap ClawOS server: ${message}`);
    new BrowserWindow({
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
