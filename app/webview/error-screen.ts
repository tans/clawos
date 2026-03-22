let runtimeErrorRendered = false;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatRuntimeError(error: unknown): string {
  if (error instanceof Error) {
    const text = error.stack?.trim() || error.message.trim();
    return text || "Unknown runtime error";
  }
  const text = String(error || "").trim();
  return text || "Unknown runtime error";
}

export function renderDesktopError(message: string): void {
  if (runtimeErrorRendered) {
    return;
  }

  runtimeErrorRendered = true;
  document.open();
  document.write(`
<!doctype html>
<html lang="zh-CN" data-clawos-desktop-page="1">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ClawOS - Page Load Failed</title>
    <style>
      body {
        margin: 0;
        font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif;
        background: #ffffff;
        color: #111827;
      }
      main {
        max-width: 780px;
        margin: 48px auto;
        padding: 24px;
        border-radius: 12px;
        border: 1px solid #dbe2ea;
        background: #fff;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 22px;
      }
      p {
        margin: 8px 0;
        line-height: 1.6;
      }
      code {
        display: block;
        margin-top: 8px;
        background: #f1f5f9;
        border-radius: 6px;
        padding: 10px;
        font-size: 12px;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>ClawOS Page Load Failed</h1>
      <p>Please refresh or restart the app.</p>
      <code>${escapeHtml(message)}</code>
    </main>
  </body>
</html>
  `);
  document.close();
}

export function installGlobalErrorHandlers(): void {
  window.addEventListener("error", (event) => {
    const reason = event.error || event.message || "Page script error";
    renderDesktopError(`Page script error: ${formatRuntimeError(reason)}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    renderDesktopError(`Unhandled async error: ${formatRuntimeError(event.reason)}`);
  });
}
