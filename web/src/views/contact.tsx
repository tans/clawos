/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";

const MANUAL_URL = "https://gx50d0q123.feishu.cn/wiki/CueLw8F8TiwjEMkGiCFclxtXnnh?from=from_copylink";

export function renderContactPage(): string {
  const { brandName, brandLogoUrl } = getBrandConfig();

  return `<!doctype html>${renderToString(
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${brandName} | 联系我们`}</title>
        <link rel="icon" type="image/png" href={brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="site-bg min-h-screen text-[#1a1a1a]">
        <main class="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
          <header class="hero-glow bento-card px-5 py-5 sm:px-7">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <img src={brandLogoUrl} alt={`${brandName} Logo`} class="size-9 rounded-lg object-contain" />
                <div>
                  <p class="subcaps">Support</p>
                  <h1 class="text-xl font-bold tracking-tight">联系我们</h1>
                </div>
              </div>
              <a class="secondary-button" href="/">返回首页</a>
            </div>
          </header>

          <section class="mt-8 page-fade bento-card p-6">
            <h2 class="section-title text-xl sm:text-2xl">
              <span class="section-marker">&gt;</span>
              商务与合作
            </h2>
            <p class="mt-3 text-sm leading-7 text-[#666]">如需购买、行业方案咨询、OEM 合作，请通过以下方式联系。</p>
            <ul class="mt-4 space-y-2 text-sm text-[#666]">
              <li>客服微信：tianshe00</li>
              <li>联系人页面：当前页（本页即“联系我们”）</li>
            </ul>
          </section>

          <section class="aqua-glow mt-6 page-fade bento-card p-6">
            <h2 class="section-title text-xl sm:text-2xl">
              <span class="section-marker">&gt;</span>
              使用手册
            </h2>
            <p class="mt-3 text-sm leading-7 text-[#666]">飞书链接是“使用手册”，不是“联系我们”。</p>
            <a class="primary-button mt-4" href={MANUAL_URL} target="_blank" rel="noreferrer">
              打开飞书使用手册 →
            </a>
          </section>
        </main>
      </body>
    </html>,
  )}`;
}
