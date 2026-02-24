/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";

type IconName =
  | "panel"
  | "chat"
  | "agent"
  | "skill"
  | "browser"
  | "wsl"
  | "edu"
  | "med"
  | "biz"
  | "download";

function Icon({ name }: { name: IconName }) {
  switch (name) {
    case "panel":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 15h3" />
        </svg>
      );
    case "chat":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16v10H8l-4 4z" />
          <path d="M8 9h8" />
          <path d="M8 12h5" />
        </svg>
      );
    case "agent":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c1.6-3.4 4.3-5 8-5s6.4 1.6 8 5" />
        </svg>
      );
    case "skill":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.8-5.4 2.8 1-6.1-4.4-4.3 6.1-.9z" />
        </svg>
      );
    case "browser":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 10h18" />
          <path d="M12 3c2.5 2.3 4 5.5 4 9s-1.5 6.7-4 9c-2.5-2.3-4-5.5-4-9s1.5-6.7 4-9z" />
        </svg>
      );
    case "wsl":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 10l2 2-2 2" />
          <path d="M11 14h4" />
        </svg>
      );
    case "edu":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8l9-4 9 4-9 4z" />
          <path d="M7 10v5c0 1.8 2.2 3 5 3s5-1.2 5-3v-5" />
        </svg>
      );
    case "med":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4v16" />
          <path d="M4 12h16" />
          <rect x="3" y="3" width="18" height="18" rx="4" />
        </svg>
      );
    case "biz":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5h8v2" />
          <path d="M3 12h18" />
        </svg>
      );
    case "download":
      return (
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4v10" />
          <path d="M8 10l4 4 4-4" />
          <rect x="4" y="17" width="16" height="3" rx="1" />
        </svg>
      );
    default:
      return null;
  }
}

function FeatureCard({ icon, title, desc }: { icon: IconName; title: string; desc: string }) {
  return (
    <article class="card border border-base-content/10 bg-base-100 shadow-sm">
      <div class="card-body gap-3 p-5">
        <span class="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon name={icon} />
        </span>
        <h3 class="card-title text-base">{title}</h3>
        <p class="text-sm text-base-content/70">{desc}</p>
      </div>
    </article>
  );
}

function HomePage({ hasInstaller }: { hasInstaller: boolean }) {
  return (
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ClawOS 官网</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen bg-base-200/40 text-base-content">
        <main class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
          <header class="navbar rounded-box border border-base-content/10 bg-base-100/80 px-4 backdrop-blur md:px-6">
            <div class="flex-1 text-lg font-semibold">ClawOS</div>
            <nav class="flex flex-wrap justify-end gap-2" aria-label="页面导航">
              <a class="btn btn-ghost btn-sm" href="#features">
                特色
              </a>
              <a class="btn btn-ghost btn-sm" href="#functions">
                功能
              </a>
              <a class="btn btn-ghost btn-sm" href="#oem">
                OEM定制
              </a>
            </nav>
          </header>

          <section id="features" class="hero mt-8 rounded-[2rem] border border-base-content/10 bg-base-100/70">
            <div class="hero-content w-full max-w-6xl flex-col gap-10 px-6 py-10 text-center sm:px-12 sm:py-14">
              <div class="space-y-5">
                <div class="flex flex-wrap justify-center gap-2">
                  <span class="badge badge-primary badge-outline">Windows + WSL</span>
                  <span class="badge badge-info badge-outline">Gateway</span>
                  <span class="badge badge-accent badge-outline">OEM</span>
                </div>
                <h1 class="text-4xl font-black tracking-tight sm:text-5xl">可定制的openclaw</h1>
                <p class="mx-auto max-w-3xl text-base text-base-content/70 sm:text-lg">
                  一键升级 openclaw，简化 Agent 模型配置，内置精选技能市场。
                </p>
                <div class="flex justify-center">
                  {hasInstaller ? (
                    <a class="btn btn-primary btn-wide" href="/downloads/latest">
                      <Icon name="download" />
                      下载安装包
                    </a>
                  ) : (
                    <button class="btn btn-primary btn-wide" type="button" disabled>
                      <Icon name="download" />
                      安装包暂未发布
                    </button>
                  )}
                </div>
              </div>

              <aside class="mx-auto w-full max-w-[640px] overflow-hidden rounded-3xl border border-base-content/10 bg-base-100">
                <img
                  src="/public/clawos.png"
                  alt="ClawOS 产品图"
                  loading="eager"
                  decoding="async"
                  class="h-auto w-full object-contain"
                />
              </aside>
            </div>
          </section>

          <section id="functions" class="mt-8 space-y-6 rounded-[1.75rem] border border-base-content/10 bg-base-100/70 p-6 sm:p-8">
            <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h2 class="text-2xl font-semibold">核心能力</h2>
              <span class="text-sm text-base-content/60">产品化交付</span>
            </div>
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FeatureCard icon="panel" title="一键升级 openclaw" desc="升级、重启、状态检查一体化。" />
              <FeatureCard icon="agent" title="简化Agent模型配置" desc="减少手工改配置，降低上线门槛。" />
              <FeatureCard icon="skill" title="内置精选技能市场" desc="内置常用技能模板，开箱即用。" />
              <FeatureCard icon="chat" title="通讯渠道接入" desc="常见渠道统一接入与管理。" />
              <FeatureCard icon="browser" title="浏览器自动化" desc="浏览器与工作流配置统一管理。" />
              <FeatureCard icon="wsl" title="WSL 诊断" desc="端口、权限、环境问题可视排查。" />
            </div>
          </section>

          <section id="oem" class="mt-8 space-y-6 rounded-[1.75rem] border border-base-content/10 bg-base-100/70 p-6 sm:p-8">
            <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h2 class="text-2xl font-semibold">openclaw OEM</h2>
              <span class="text-sm text-base-content/60">定制行业解决方案</span>
            </div>

            <div class="space-y-2 text-base-content/80">
              <p>定制行业解决方案，打通现有业务体系。</p>
              <p>
                无论是传统的 SaaS 软件还是咨询行业，通过 openclaw OEM
                提供专属的软硬件一体方案，更好的服务，友好的交付，简单的销售模式。
              </p>
            </div>

            <div class="rounded-2xl border border-base-content/10 bg-base-100 p-5">
              <h3 class="text-sm font-semibold">一般OEM流程</h3>
              <ul class="steps steps-vertical mt-4 w-full gap-2 lg:steps-horizontal">
                <li class="step step-primary">确定品牌与配置</li>
                <li class="step step-primary">根据起订量和定制内容确定费用</li>
                <li class="step step-primary">批量发货或一件代发</li>
              </ul>
            </div>

            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FeatureCard icon="edu" title="教育行业" desc="教务、招生与校内协作场景。" />
              <FeatureCard icon="med" title="医疗行业" desc="流程规范、合规与数据协作。" />
              <FeatureCard icon="biz" title="SaaS / 咨询" desc="专属方案，标准交付，快速复制。" />
            </div>
          </section>

          <footer class="mt-8 rounded-box border border-base-content/10 bg-base-100/80 p-6 text-center text-sm text-base-content/70">
            <p class="text-center">@clawos.cc</p>
            <p class="mt-1 text-center">客服联系 tianshe00</p>
          </footer>
        </main>
      </body>
    </html>
  );
}

export function renderHomePage(hasInstaller: boolean): string {
  return `<!doctype html>${renderToString(<HomePage hasInstaller={hasInstaller} />)}`;
}
