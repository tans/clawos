/** @jsxImportSource hono/jsx */

import { PropsWithChildren } from "hono/jsx";
import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";
import { getEnv } from "../lib/env";

type MarketingShellProps = PropsWithChildren<{
  title: string;
  description: string;
  currentPath: "/" | "/downloads" | "/shop" | "/contact" | "/agent-market" | "/market";
}>;

const topNavItems = [
  { href: "/", label: "首页" },
  { href: "/downloads", label: "下载" },
  { href: "/shop", label: "商城" },
  { href: "/market", label: "任务市场" },
  { href: "/contact", label: "联系我们" },
] as const;

export function renderMarketingShell({ title, description, currentPath, children }: MarketingShellProps): string {
  const { brandName, brandLogoUrl, brandUrl, brandDomain, siteName, seoTitle, seoDescription, seoKeywords } = getBrandConfig();
  const { marketplaceEnabled } = getEnv();
  const finalTitle = `${title} | ${seoTitle}`;
  const finalDescription = description?.trim() || seoDescription;

  return `<!doctype html>${renderToString(
    <html lang="zh-CN" data-theme="pastel">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{finalTitle}</title>
        <meta name="description" content={finalDescription} />
        <meta name="keywords" content={seoKeywords} />
        <meta property="og:title" content={finalTitle} />
        <meta property="og:description" content={finalDescription} />
        <meta property="og:site_name" content={siteName} />
        <link rel="icon" type="image/png" href={brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen bg-base-100 text-base-content">
        <a
          href="#main-content"
          class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-box focus:bg-base-100 focus:px-4 focus:py-2 focus:shadow"
        >
          跳转到主要内容
        </a>

        <header class="sticky top-0 z-40 border-b border-base-200/70 bg-base-100/85 backdrop-blur">
          <div class="navbar mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div class="navbar-start">
              <a href="/" class="btn btn-ghost px-2 text-lg font-semibold">
                <img src={brandLogoUrl} alt={`${brandName} logo`} class="h-8 w-8 rounded" />
                <span>{brandName}</span>
              </a>
            </div>
            <div class="navbar-center hidden lg:flex">
              <ul class="menu menu-horizontal px-1 text-sm">
                {topNavItems.map((item) => (
                  <li>
                    <a href={item.href} class={item.href === currentPath ? "active font-semibold" : ""}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div class="navbar-end gap-2">
              <a href="/contact" class="btn btn-primary btn-sm hidden sm:inline-flex">咨询方案</a>
            </div>
          </div>
        </header>

        <main id="main-content">{children}</main>

        <footer class="border-t border-base-200 bg-base-100">
          <div class="footer mx-auto max-w-7xl items-center px-4 py-8 text-base-content sm:px-6 lg:px-8">
            <aside>
              <p class="font-semibold">
                <a class="link link-hover" href={brandUrl} target="_blank" rel="noreferrer">{`${brandName} · ${brandDomain}`}</a>
              </p>
              <p class="text-sm text-base-content/60">让 Agent 协作更标准，让任务交付更稳定。</p>
            </aside>
            <nav class="md:place-self-center md:justify-self-end">
              <div class="grid grid-flow-col gap-4 text-sm">
                {marketplaceEnabled ? <a class="link link-hover" href="/market">Agent 协作</a> : null}
                <a class="link link-hover" href="/downloads">下载试用</a>
                <a class="link link-hover" href="/shop">产品商城</a>
                <a class="link link-hover" href="/contact">部署评估</a>
              </div>
            </nav>
          </div>
        </footer>
      </body>
    </html>,
  )}`;
}
