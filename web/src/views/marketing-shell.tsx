/** @jsxImportSource hono/jsx */

import { PropsWithChildren } from "hono/jsx";
import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";

type MarketingShellProps = PropsWithChildren<{
  title: string;
  description: string;
  currentPath: "/" | "/downloads" | "/contact";
}>;

const navItems = [
  { href: "/", label: "解决方案" },
  { href: "/#architecture", label: "部署方式" },
  { href: "/#capabilities", label: "核心能力" },
  { href: "/#solutions", label: "适用场景" },
  { href: "/#governance", label: "治理能力" },
  { href: "/downloads", label: "下载试用" },
  { href: "/contact", label: "部署评估" },
] as const;

export function renderMarketingShell({ title, description, currentPath, children }: MarketingShellProps): string {
  const { brandName, brandLogoUrl, brandDomain } = getBrandConfig();

  return `<!doctype html>${renderToString(
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${brandName} | ${title}`}</title>
        <meta name="description" content={description} />
        <link rel="icon" type="image/png" href={brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="marketing-body">
        <a class="marketing-skip-link" href="#main-content">跳转到主要内容</a>
        <header class="marketing-nav">
          <div class="marketing-nav-inner">
            <a class="marketing-brand" href="/">
              <img src={brandLogoUrl} alt={`${brandName} logo`} class="marketing-brand-mark" />
              <span>{brandName}</span>
            </a>
            <nav class="marketing-nav-links" aria-label="主导航">
              {navItems.map((item) => (
                <a
                  href={item.href}
                  class={item.href === currentPath ? "marketing-nav-link is-active" : "marketing-nav-link"}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <main id="main-content">{children}</main>

        <footer class="marketing-footer">
          <div class="marketing-footer-inner">
            <p>{`${brandName} · ${brandDomain}`}</p>
            <div class="marketing-footer-links">
              <a href="/downloads">下载试用</a>
              <a href="/contact">部署评估</a>
            </div>
          </div>
        </footer>
      </body>
    </html>,
  )}`;
}
