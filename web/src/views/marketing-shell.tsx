/** @jsxImportSource hono/jsx */

import { PropsWithChildren } from "hono/jsx";
import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";
import { getEnv } from "../lib/env";

type MarketingShellProps = PropsWithChildren<{
  title: string;
  description: string;
  currentPath:
    | "/"
    | "/downloads"
    | "/shop"
    | "/contact"
    | "/agent-market"
    | "/market"
    | "/pay-success"
    | "/help";
}>;

const topNavItems = [
  { href: "/", label: "首页" },
  { href: "/downloads", label: "下载" },
  { href: "/shop", label: "商城" },
  { href: "/market", label: "众包市场" },
  { href: "/contact", label: "联系我们" },
  { href: "/help", label: "帮助" },
] as const;

export function renderMarketingShell({
  title,
  description,
  currentPath,
  children,
}: MarketingShellProps): string {
  const {
    brandName,
    brandLogoUrl,
    brandUrl,
    brandDomain,
    siteName,
    seoTitle,
    seoDescription,
    seoKeywords,
  } = getBrandConfig();
  const { marketplaceEnabled } = getEnv();
  const finalTitle = `${title} | ${seoTitle}`;
  const finalDescription = description?.trim() || seoDescription;

  return `<!doctype html>${renderToString(
    <html lang="zh-CN" data-theme="enterprise">
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen bg-surface text-ink-normal font-body antialiased">
        <a href="#main-content" class="skip-link focus-ring">
          跳转到主要内容
        </a>

        {/* Navigation */}
        <header class="nav-warm">
          <div class="nav-warm-inner">
            <a href="/" class="nav-brand focus-ring">
              <img
                src={brandLogoUrl}
                alt={`${brandName} logo`}
                class="nav-brand-logo"
              />
              <span>{brandName}</span>
            </a>

            <nav class="nav-links">
              {topNavItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  class={`nav-link ${item.href === currentPath ? "active" : ""}`}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div class="flex items-center gap-3">
              <a href="/shop" class="btn-primary-warm text-sm hidden sm:inline-flex">
                购买主机
              </a>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main id="main-content">
          {children}
        </main>

        {/* Footer */}
        <footer class="footer-warm">
          <div class="footer-warm-inner">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div class="space-y-2">
                <p class="font-display text-xl font-semibold text-ink-strong">
                  {brandName}
                </p>
                <p class="text-sm text-ink-soft">
                  让 Agent 协作更标准，让任务交付更稳定。
                </p>
              </div>

              <nav class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {marketplaceEnabled ? (
                  <a href="/market" class="text-ink-soft hover:text-accent transition-colors">
                    Agent 协作
                  </a>
                ) : null}
                <a href="/downloads" class="text-ink-soft hover:text-accent transition-colors">
                  下载试用
                </a>
                <a href="/shop" class="text-ink-soft hover:text-accent transition-colors">
                  产品商城
                </a>
                <a href="/contact" class="text-ink-soft hover:text-accent transition-colors">
                  部署评估
                </a>
              </nav>
            </div>

            <div class="mt-8 pt-6 border-t border-line-soft">
              <p class="text-xs text-ink-faint">
                &copy; {new Date().getFullYear()} {brandName} · {brandDomain}
              </p>
            </div>
          </div>
        </footer>

        {/* Scroll Animation Script */}
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('DOMContentLoaded', function() {
            var animatedElements = document.querySelectorAll('.animate-on-scroll');
            if (!animatedElements.length) return;

            var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
            if (reduceMotion.matches) {
              animatedElements.forEach(function(el) {
                el.classList.add('is-visible');
              });
              return;
            }

            var observer = new IntersectionObserver(function(entries) {
              entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                  entry.target.classList.add('is-visible');
                  observer.unobserve(entry.target);
                }
              });
            }, {
              threshold: 0.1,
              rootMargin: '0px 0px -40px 0px'
            });

            animatedElements.forEach(function(el) {
              observer.observe(el);
            });
          });
        ` }} />
      </body>
    </html>,
  )}`;
}
