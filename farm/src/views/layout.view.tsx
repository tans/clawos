/** @jsxImportSource hono/jsx */
import type { Child, FC } from "hono/jsx";
import { renderToString } from "hono/jsx/dom/server";
import type { ConsoleUser } from "../types";

const LayoutRoot: FC<{ title: string; user?: ConsoleUser; children: Child }> = ({ title, user, children }) => {
  return (
    <html lang="zh-CN" data-theme="emerald">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link
          href="https://cdn.jsdelivr.net/npm/daisyui@4.12.22/dist/full.min.css"
          rel="stylesheet"
          type="text/css"
        />
      </head>
      <body class="bg-base-200 min-h-screen">
        <main class="max-w-6xl mx-auto p-4 md:p-6">
          {user ? (
            <div class="navbar bg-base-100 rounded-box shadow-sm mb-4 border border-base-300">
              <div class="flex-1 text-sm">
                账号：{user.mobile}（钱包：<span class="font-mono">{user.walletAddress}</span>）
              </div>
              <div class="flex-none">
                <a class="btn btn-sm btn-outline" href="/console/logout">
                  退出
                </a>
              </div>
            </div>
          ) : null}
          {children}
        </main>
      </body>
    </html>
  );
};

export function renderPageShell(content: Child, user?: ConsoleUser, title = "龙虾养殖场"): string {
  return `<!doctype html>${renderToString(<LayoutRoot title={title} user={user}>{content}</LayoutRoot>)}`;
}
