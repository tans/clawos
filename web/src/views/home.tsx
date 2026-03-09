/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";

function DownloadIcon() {
  return (
    <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v10" />
      <path d="M8 10l4 4 4-4" />
      <rect x="4" y="17" width="16" height="3" rx="1" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 15.5A8.5 8.5 0 1 1 8.5 4 6.5 6.5 0 0 0 20 15.5z" />
    </svg>
  );
}

function SectionTitle({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div class="max-w-3xl space-y-3">
      <div class="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">{eyebrow}</div>
      <h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p class="text-sm leading-7 text-base-content/70 sm:text-base">{desc}</p>
    </div>
  );
}

function HomePage({ hasInstaller, latestVersion }: { hasInstaller: boolean; latestVersion: string | null }) {
  const versionText = latestVersion?.trim() ? latestVersion.trim() : "dev";
  const features = [
    ["一键更新", "更新、重启、状态查看放在一起。"],
    ["模型配置", "常用模型和 provider 直接改。"],
    ["功能模板", "常见场景可直接启用。"],
    ["渠道接入", "常见消息渠道统一管理。"],
    ["网页自动化", "把重复网页操作整理成流程。"],
    ["环境自检", "端口、WSL、权限问题更快定位。"],
  ] as const;
  const oemFlow = ["确定品牌和配置。", "按定制内容和起订量报价。", "支持批量发货或一件代发。", "降低实施难度，缩短上线周期。"] as const;
  const industries = ["教育", "医疗", "SaaS / 咨询"] as const;

  return (
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ClawOS | 可定制的 openclaw</title>
        <link rel="icon" type="image/png" href="/public/logo.png" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen text-base-content">
        <main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
          <header class="page-fade surface-wash rounded-[2rem] px-5 py-4 sm:px-7">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-3 text-lg font-semibold">
                <img src="/public/logo.png" alt="ClawOS Logo" class="size-9 rounded-lg object-contain" />
                <span>ClawOS</span>
              </div>
              <nav class="flex flex-wrap items-center gap-2 text-sm" aria-label="页面导航">
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#overview">
                  介绍
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#features">
                  功能
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#oem">
                  定制
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="/install-guide">
                  安装
                </a>
                <div class="inline-flex items-center rounded-full border border-base-content/15 bg-base-100/55 p-1">
                  <a class="inline-flex items-center gap-2 rounded-full bg-warning/18 px-3 py-2 text-xs font-semibold text-base-content" href="/" aria-current="page">
                    <SunIcon />
                    Human
                  </a>
                  <a class="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-base-content/58 transition-colors hover:text-base-content" href="/to-agent">
                    <MoonIcon />
                    Agent
                  </a>
                </div>
              </nav>
            </div>
          </header>

          <section
            id="overview"
            class="page-fade page-fade-delay-1 ambient-shell mt-8 px-6 py-10 sm:mt-10 sm:px-10 sm:py-14 lg:px-14 lg:py-18"
          >
            <div class="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
              <div class="max-w-2xl">
                <div class="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">兼容多平台 / 可视化管理 / 行业定制</div>
                <h1 class="mt-5 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                  可定制的{" "}
                  <span class="text-rotate text-primary" style="--duration: 9s;">
                    <span>
                      <span>openclaw</span>
                      <span>Gateway 面板</span>
                      <span>Windows 工作台</span>
                    </span>
                  </span>
                </h1>
                <p class="mt-6 max-w-xl text-base leading-8 text-base-content/72 sm:text-lg">
                  像普通软件一样使用 openclaw。
                  <br />
                  支持 Windows / Linux / macOS，常用能力开箱即用。
                </p>
                <p class="mt-4 max-w-xl text-sm leading-7 text-base-content/62 sm:text-base">安装后直接启动，更新也保持同样简单。</p>

                <div class="mt-8 flex flex-wrap gap-3">
                  <span class="bg-base-100/70 px-3 py-2 text-xs font-medium tracking-[0.16em] text-base-content/70 uppercase">中文用户友好</span>
                  <span class="bg-base-100/60 px-3 py-2 text-xs font-medium tracking-[0.16em] text-base-content/70 uppercase">Windows / Linux / macOS</span>
                  <span class="bg-base-100/60 px-3 py-2 text-xs font-medium tracking-[0.16em] text-base-content/70 uppercase">Gateway Protocol 可视化</span>
                </div>

                <div class="mt-10 flex flex-wrap gap-3">
                  {hasInstaller ? (
                    <a class="btn btn-primary btn-wide" href="/downloads/latest">
                      <DownloadIcon />
                      {`下载 v${versionText}`}
                    </a>
                  ) : (
                    <button class="btn btn-primary btn-wide" type="button" disabled>
                      <DownloadIcon />
                      安装包暂未发布
                    </button>
                  )}
                  <a class="btn btn-ghost btn-wide border border-base-content/15 bg-base-100/60" href="/install-guide">
                    查看安装说明
                  </a>
                </div>

                <div class="mt-12 grid gap-6 sm:grid-cols-3">
                  <div>
                    <div class="text-2xl font-semibold">1 个入口</div>
                    <div class="mt-2 text-sm leading-7 text-base-content/65">升级、配置、排障集中处理。</div>
                  </div>
                  <div>
                    <div class="text-2xl font-semibold">6 类能力</div>
                    <div class="mt-2 text-sm leading-7 text-base-content/65">覆盖更新、配置、自动化与自检。</div>
                  </div>
                  <div>
                    <div class="text-2xl font-semibold">支持定制</div>
                    <div class="mt-2 text-sm leading-7 text-base-content/65">适合 OEM 和行业交付。</div>
                  </div>
                </div>
              </div>

              <aside class="float-gentle overflow-hidden bg-base-100/35">
                <img
                  src="/public/clawos.png"
                  alt="ClawOS 产品截图"
                  loading="eager"
                  decoding="async"
                  class="h-auto w-full object-contain"
                />
              </aside>
            </div>
          </section>

          <section class="page-fade page-fade-delay-2 mt-16 sm:mt-20 lg:mt-24">
            <SectionTitle eyebrow="Ready To Use" title="你能直接用的功能" desc="少配置，快上手。用更少的字，把能做的事说清楚。" />

            <div id="features" class="mt-12 grid gap-x-12 gap-y-10 pt-8 md:grid-cols-2">
              {features.map(([title, desc]) => (
                <article class="rise-on-hover space-y-2 bg-base-100/35 px-4 py-4">
                  <h3 class="text-lg font-semibold tracking-tight">{title}</h3>
                  <p class="max-w-md text-sm leading-7 text-base-content/68">{desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="oem" class="page-fade page-fade-delay-3 mt-20 px-1 sm:mt-24">
            <SectionTitle eyebrow="OEM Solution" title="openclaw OEM 定制" desc="面向行业客户，支持品牌、功能和交付方式的定制组合。" />

            <div class="mt-12 grid gap-12 pt-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <h3 class="text-lg font-semibold">流程</h3>
                <div class="mt-5 grid gap-5 sm:grid-cols-2">
                  {oemFlow.map((item) => (
                    <p class="text-sm leading-7 text-base-content/70">{item}</p>
                  ))}
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold">适用行业</h3>
                <div class="mt-5 space-y-3">
                  {industries.map((industry) => (
                    <p class="text-sm leading-7 text-base-content/70">{industry}</p>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <footer class="page-fade page-fade-delay-3 mt-16 px-2 py-8 text-sm text-base-content/70 sm:mt-20">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>@clawos.cc</p>
              <p>客服联系: tianshe00</p>
            </div>
          </footer>
        </main>
      </body>
    </html>
  );
}

export function renderHomePage(hasInstaller: boolean, latestVersion: string | null): string {
  return `<!doctype html>${renderToString(<HomePage hasInstaller={hasInstaller} latestVersion={latestVersion} />)}`;
}
