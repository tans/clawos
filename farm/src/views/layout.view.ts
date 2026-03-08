import type { ConsoleUser } from "../types";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderPageShell(body: string, user?: ConsoleUser, title = "龙虾养殖场"): string {
  const nav = user
    ? `<div class="navbar bg-base-100 rounded-box shadow-sm mb-4 border border-base-300">
        <div class="flex-1 text-sm">账号：${escapeHtml(user.mobile)}（钱包：<span class="font-mono">${escapeHtml(user.walletAddress)}</span>）</div>
        <div class="flex-none"><a class="btn btn-sm btn-outline" href="/console/logout">退出</a></div>
      </div>`
    : "";

  return `<!doctype html>
<html lang="zh-CN" data-theme="emerald">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@4.12.22/dist/full.min.css" rel="stylesheet" type="text/css" />
</head>
<body class="bg-base-200 min-h-screen">
  <main class="max-w-6xl mx-auto p-4 md:p-6">
    ${nav}
    ${body}
  </main>
</body>
</html>`;
}

export function escapeHtmlContent(input: string): string {
  return escapeHtml(input);
}
