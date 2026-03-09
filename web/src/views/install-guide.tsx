/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";

function InstallGuidePage() {
  return (
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ClawOS 安装说明</title>
        <link rel="icon" type="image/png" href="/public/logo.png" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body id="top" class="min-h-screen text-base-content">
        <main class="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
          <header class="page-fade surface-wash rounded-[2rem] px-6 py-5 sm:px-8">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-3">
                <img src="/public/logo.png" alt="ClawOS Logo" class="size-9 rounded-md object-contain" />
                <div>
                  <h1 class="text-2xl font-semibold sm:text-3xl">安装说明</h1>
                  <p class="mt-2 text-sm leading-7 text-base-content/70">适合首次安装和日常更新。</p>
                </div>
              </div>

              <nav class="flex flex-wrap gap-2 text-sm" aria-label="站点导航">
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="/">
                  首页
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="/downloads/latest">
                  下载
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#windows-install">
                  安装
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#upgrade">
                  更新
                </a>
                <a
                  class="btn btn-primary btn-sm"
                  href="https://gx50d0q123.feishu.cn/drive/folder/W2LOfFVGGlKMCqdkMEIcsPL6nWb?from=from_copylink"
                  target="_blank"
                  rel="noreferrer"
                >
                  详细手册
                </a>
              </nav>
            </div>
          </header>

          <section class="page-fade page-fade-delay-1 mt-6">
            <a
              class="group relative block overflow-hidden rounded-[1.75rem] border border-primary/20 bg-gradient-to-r from-primary/18 via-warning/12 to-base-100/92 px-6 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] transition-transform duration-300 hover:-translate-y-0.5"
              href="https://gx50d0q123.feishu.cn/drive/folder/W2LOfFVGGlKMCqdkMEIcsPL6nWb?from=from_copylink"
              target="_blank"
              rel="noreferrer"
            >
              <div class="absolute -right-10 -top-10 size-32 rounded-full bg-warning/15 blur-3xl" aria-hidden="true" />
              <div class="absolute -bottom-12 left-8 size-36 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
              <div class="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div class="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">Detailed Manual</div>
                  <h2 class="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">查看详细手册说明</h2>
                  <p class="mt-3 max-w-2xl text-sm leading-7 text-base-content/72 sm:text-base">
                    如果你需要更完整的安装、配置、更新和排障说明，请直接打开详细手册。
                  </p>
                </div>

                <div class="flex items-center gap-3">
                  <span class="hidden rounded-full border border-base-content/10 bg-base-100/70 px-3 py-2 text-xs font-medium text-base-content/70 sm:inline-flex">
                    飞书文档
                  </span>
                  <span class="btn btn-primary btn-wide">
                    打开详细手册
                  </span>
                </div>
              </div>
            </a>
          </section>

          <section class="page-fade page-fade-delay-1 mt-8 pt-6">
            <div class="flex flex-wrap gap-3 text-sm">
              <a class="btn btn-ghost btn-sm border border-base-content/15 bg-base-100/60" href="#windows-install">
                Windows 安装
              </a>
              <a class="btn btn-ghost btn-sm border border-base-content/15 bg-base-100/60" href="#upgrade">
                更新方式
              </a>
              <a class="btn btn-ghost btn-sm border border-base-content/15 bg-base-100/60" href="#after-install">
                安装后检查
              </a>
              <a
                class="btn btn-ghost btn-sm border border-primary/20 bg-primary/8 text-primary"
                href="https://gx50d0q123.feishu.cn/drive/folder/W2LOfFVGGlKMCqdkMEIcsPL6nWb?from=from_copylink"
                target="_blank"
                rel="noreferrer"
              >
                详细手册说明
              </a>
              <a class="btn btn-ghost btn-sm border border-base-content/15 bg-base-100/60" href="/">
                返回首页
              </a>
            </div>
          </section>

          <section id="windows-install" class="page-fade page-fade-delay-1 mt-10 scroll-mt-24 pt-8">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">Step 01</div>
                <h2 class="mt-2 text-xl font-semibold">Windows 安装</h2>
              </div>
              <a class="btn btn-ghost btn-xs border border-base-content/15" href="#top">
                回到顶部
              </a>
            </div>
            <ul class="mt-5 list-disc space-y-3 pl-5 text-sm leading-7 text-base-content/80">
              <li>下载最新安装包，按向导安装。</li>
              <li>遇到安全提示，点“更多信息”后继续。</li>
              <li>安装完成后可从桌面快捷方式启动。</li>
              <li>首次启动后检查 WSL、openclaw 和网络环境。</li>
            </ul>
          </section>

          <section id="upgrade" class="page-fade page-fade-delay-2 mt-8 scroll-mt-24 pt-8">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">Step 02</div>
                <h2 class="mt-2 text-xl font-semibold">更新方式</h2>
              </div>
              <a class="btn btn-ghost btn-xs border border-base-content/15" href="#top">
                回到顶部
              </a>
            </div>
            <ul class="mt-5 list-disc space-y-3 pl-5 text-sm leading-7 text-base-content/80">
              <li>直接安装最新安装包即可。</li>
              <li>旧版本会自动替换。</li>
              <li>不要混用旧脚本和新安装方式。</li>
            </ul>
          </section>

          <section id="after-install" class="page-fade page-fade-delay-3 mt-8 scroll-mt-24 pt-8">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">Step 03</div>
                <h2 class="mt-2 text-xl font-semibold">安装后检查</h2>
              </div>
              <a class="btn btn-ghost btn-xs border border-base-content/15" href="#top">
                回到顶部
              </a>
            </div>
            <ul class="mt-5 list-disc space-y-3 pl-5 text-sm leading-7 text-base-content/80">
              <li>先确认管理页面能正常打开。</li>
              <li>依赖 WSL 时，先检查 WSL 和 openclaw。</li>
              <li>端口、权限或网络异常，优先看程序提示。</li>
            </ul>
          </section>

          <div class="page-fade page-fade-delay-3 mt-10 flex flex-wrap gap-3">
            <a class="btn btn-primary btn-sm" href="/downloads/latest">
              下载最新安装包
            </a>
            <a class="btn btn-ghost btn-sm border border-base-content/15" href="/">
              返回首页
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

export function renderInstallGuidePage(): string {
  return `<!doctype html>${renderToString(<InstallGuidePage />)}`;
}
