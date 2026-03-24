/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";

interface DownloadChannelCard {
  id: "stable" | "beta" | "alpha";
  label: string;
  badgeClass: string;
  version: string;
  publishedAt: string;
  hasInstaller: boolean;
  windowsUrl: string;
  macosUrl: string;
  linuxUrl: string;
}

function formatPublishedAt(value: string | null): string {
  if (!value) return "暂无发布时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无发布时间";
  return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function renderDownloadsPage(cards: DownloadChannelCard[]): string {
  const { brandName, brandLogoUrl } = getBrandConfig();

  return `<!doctype html>${renderToString(
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${brandName} | 下载中心`}</title>
        <link rel="icon" type="image/png" href={brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="site-bg min-h-screen text-[#1a1a1a]">
        <main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
          <header class="hero-glow bento-card px-5 py-5 sm:px-7">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <img src={brandLogoUrl} alt={`${brandName} Logo`} class="size-9 rounded-lg object-contain" />
                <div>
                  <p class="subcaps">Downloads</p>
                  <h1 class="mt-1 text-xl font-bold tracking-tight">下载中心</h1>
                  <p class="text-sm text-[#666]">按版本通道与系统平台选择安装包。</p>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <a class="secondary-button" href="/">返回首页</a>
                <a class="primary-button" href="/contact">联系我们 →</a>
              </div>
            </div>
          </header>

          <section class="mt-10 page-fade grid gap-5 lg:grid-cols-3">
            {cards.map((card) => (
              <article class="bento-card p-5">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="text-lg font-semibold">{card.label}</h2>
                  <span class="channel-badge">{card.id.toUpperCase()}</span>
                </div>
                <p class="mt-2 text-sm text-[#666]">{`版本：${card.version}`}</p>
                <p class="mt-1 text-xs text-[#666]">{`发布时间：${card.publishedAt}`}</p>

                {card.hasInstaller ? (
                  <div class="mt-5 grid gap-2">
                    <a class="secondary-button w-full" href={card.windowsUrl}>下载 Windows</a>
                    <a class="secondary-button w-full" href={card.macosUrl}>下载 macOS</a>
                    <a class="secondary-button w-full" href={card.linuxUrl}>下载 Linux</a>
                  </div>
                ) : (
                  <button class="secondary-button mt-5 w-full" type="button" disabled>
                    暂无可用安装包
                  </button>
                )}
              </article>
            ))}
          </section>
        </main>
      </body>
    </html>,
  )}`;
}

export function buildDownloadCards(input: {
  stableVersion: string | null;
  stablePublishedAt: string | null;
  hasStableInstaller: boolean;
  betaVersion: string | null;
  betaPublishedAt: string | null;
  hasBetaInstaller: boolean;
  alphaVersion: string | null;
  alphaPublishedAt: string | null;
  hasAlphaInstaller: boolean;
}): DownloadChannelCard[] {
  return [
    {
      id: "stable",
      label: "稳定版",
      badgeClass: "badge-neutral",
      version: input.stableVersion?.trim() || "dev",
      publishedAt: formatPublishedAt(input.stablePublishedAt),
      hasInstaller: input.hasStableInstaller,
      windowsUrl: "/downloads/latest/windows",
      macosUrl: "/downloads/latest/macos",
      linuxUrl: "/downloads/latest/linux",
    },
    {
      id: "beta",
      label: "测试版",
      badgeClass: "badge-warning",
      version: input.betaVersion?.trim() || "dev",
      publishedAt: formatPublishedAt(input.betaPublishedAt),
      hasInstaller: input.hasBetaInstaller,
      windowsUrl: "/downloads/beta/windows",
      macosUrl: "/downloads/beta/macos",
      linuxUrl: "/downloads/beta/linux",
    },
    {
      id: "alpha",
      label: "内测版",
      badgeClass: "badge-info",
      version: input.alphaVersion?.trim() || "dev",
      publishedAt: formatPublishedAt(input.alphaPublishedAt),
      hasInstaller: input.hasAlphaInstaller,
      windowsUrl: "/downloads/alpha/windows",
      macosUrl: "/downloads/alpha/macos",
      linuxUrl: "/downloads/alpha/linux",
    },
  ];
}
