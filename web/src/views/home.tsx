/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";

type IconName =
  | "panel"
  | "update"
  | "channels"
  | "agent"
  | "skill"
  | "browser"
  | "wallet"
  | "sessions"
  | "wsl"
  | "download";

function Icon({ name }: { name: IconName }) {
  switch (name) {
    case "panel":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h4" />
          <path d="M14 15h3" />
        </svg>
      );
    case "update":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M7 17a7 7 0 0 0 11-3" />
          <path d="M17 7A7 7 0 0 0 6 10" />
        </svg>
      );
    case "channels":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 7h14" />
          <path d="M5 12h14" />
          <path d="M5 17h9" />
          <circle cx="17" cy="17" r="2" />
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
    case "wallet":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5z" />
          <path d="M16 12h4" />
          <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "sessions":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 5h14v10H8l-3 3z" />
          <path d="M8 9h8" />
          <path d="M8 12h5" />
        </svg>
      );
    case "wsl":
      return (
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 10l2 2-2 2" />
          <path d="M11 14h5" />
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
    <article class="rounded-[1.5rem] border border-base-content/10 bg-base-100 p-6 shadow-sm sm:p-7">
      <div class="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon name={icon} />
      </div>
      <h3 class="mt-6 text-lg font-semibold">{title}</h3>
      <p class="mt-3 text-sm leading-7 text-base-content/70">{desc}</p>
    </article>
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

  return (
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ClawOS 官网</title>
        <link rel="icon" type="image/png" href="/public/logo.png" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen bg-base-200/40 text-base-content">
        <main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
          <header class="rounded-[1.5rem] border border-base-content/10 bg-base-100/85 px-5 py-4 backdrop-blur sm:px-7">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-3 text-lg font-semibold">
                <img src="/public/logo.png" alt="ClawOS Logo" class="size-9 rounded-lg object-contain" />
                <span>ClawOS</span>
              </div>
              <nav class="flex flex-wrap gap-2 text-sm" aria-label="页面导航">
                <a class="btn btn-ghost btn-sm" href="#overview">
                  介绍
                </a>
                <a class="btn btn-ghost btn-sm" href="#features">
                  功能
                </a>
                <a class="btn btn-ghost btn-sm" href="#windows">
                  Windows
                </a>
                <a class="btn btn-ghost btn-sm" href="/install-guide">
                  安装
                </a>
              </nav>
            </div>
          </header>

          <section
            id="overview"
            class="mt-8 rounded-[2rem] border border-base-content/10 bg-base-100/80 px-6 py-10 sm:mt-10 sm:px-10 sm:py-14 lg:px-14 lg:py-18"
          >
            <div class="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
              <div class="max-w-2xl">
                <div class="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">Windows + WSL + openclaw</div>
                <h1 class="mt-5 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">更容易用的 openclaw 桌面工具</h1>
                <p class="mt-6 max-w-xl text-base leading-8 text-base-content/72 sm:text-lg">
                  ClawOS 把 openclaw 常用操作放到一个桌面界面里。
                  <br />
                  你可以看状态、改配置、更新 gateway，也可以检查 WSL 和浏览器问题。
                </p>

                <div class="mt-8 flex flex-wrap gap-3">
                  <span class="badge badge-outline badge-primary px-3 py-3">中文界面</span>
                  <span class="badge badge-outline px-3 py-3">Windows 优先</span>
                  <span class="badge badge-outline px-3 py-3">本地管理 openclaw</span>
                </div>

                <div class="mt-10 flex flex-wrap gap-3">
                  {hasInstaller ? (
                    <a class="btn btn-primary btn-wide" href="/downloads/latest">
                      <Icon name="download" />
                      {`下载 v${versionText}`}
                    </a>
                  ) : (
                    <button class="btn btn-primary btn-wide" type="button" disabled>
                      <Icon name="download" />
                      安装包暂未发布
                    </button>
                  )}
                  <a class="btn btn-outline btn-wide" href="/install-guide">
                    查看安装说明
                  </a>
                </div>

                <div class="mt-10 grid gap-5 sm:grid-cols-3">
                  <div>
                    <div class="text-2xl font-semibold">1 个入口</div>
                    <div class="mt-2 text-sm leading-7 text-base-content/65">仪表盘、配置、任务日志集中在一起。</div>
                  </div>
                  <div>
                    <div class="text-2xl font-semibold">6 类配置</div>
                    <div class="mt-2 text-sm leading-7 text-base-content/65">channels、agents、skills、browser、wallet、settings。</div>
                  </div>
                  <div>
                    <div class="text-2xl font-semibold">Windows 友好</div>
                    <div class="mt-2 text-sm leading-7 text-base-content/65">更适合用来处理 WSL、端口和浏览器连通性问题。</div>
                  </div>
                </div>
              </div>

              <aside class="overflow-hidden rounded-[1.75rem] border border-base-content/10 bg-base-100">
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

          <section class="mt-16 sm:mt-20 lg:mt-24">
            <SectionTitle
              eyebrow="What It Does"
              title="现在能做什么"
              desc="首页不再讲太多概念，直接说你打开软件后能做的事。下面这些能力都已经在桌面版里提供。"
            />

            <div id="features" class="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <FeatureCard icon="panel" title="看运行状态" desc="在控制台里看 WSL、openclaw、gateway 和浏览器状态。出现异常时更容易定位问题。" />
              <FeatureCard icon="update" title="更新和重启 gateway" desc="桌面里直接执行更新、重启和相关任务。过程有日志，不需要手动记命令。" />
              <FeatureCard icon="channels" title="改 channels 配置" desc="常用渠道配置做成表单。打开页面就能看、就能改。" />
              <FeatureCard icon="agent" title="改 agents 和模型" desc="调整主模型、备用模型和 provider 信息。比直接改配置文件更直观。" />
              <FeatureCard icon="skill" title="管理 skills" desc="可以编辑 skills 和 tools 配置，也能处理常见的高级字段。" />
              <FeatureCard icon="browser" title="检查浏览器问题" desc="提供浏览器连通性检查、重启浏览器和重置配置，适合处理 Windows + WSL 场景。" />
              <FeatureCard icon="wallet" title="查看钱包信息" desc="本地钱包地址、创建时间和余额都能直接查看，不用再分散到别处找。" />
              <FeatureCard icon="sessions" title="查看会话记录" desc="可以直接浏览 gateway 会话和历史消息，排查问题更方便。" />
              <FeatureCard icon="wsl" title="处理环境问题" desc="针对 WSL、端口占用、权限不足这些常见问题，给出更清楚的反馈。" />
            </div>
          </section>

          <section
            id="windows"
            class="mt-16 rounded-[2rem] border border-base-content/10 bg-base-100/80 px-6 py-10 sm:mt-20 sm:px-10 sm:py-14 lg:mt-24 lg:px-14 lg:py-16"
          >
            <SectionTitle
              eyebrow="Why Windows"
              title="重点优化 Windows 使用体验"
              desc="ClawOS 不是一个泛泛的宣传页产品。它是围绕 Windows 用户用 openclaw 时最常见的问题来做的。"
            />

            <div class="mt-10 grid gap-8 lg:grid-cols-2">
              <div class="rounded-[1.5rem] border border-base-content/10 bg-base-100 p-6 sm:p-7">
                <h3 class="text-lg font-semibold">适合这些场景</h3>
                <ul class="mt-5 space-y-4 text-sm leading-7 text-base-content/72">
                  <li>你主要在 Windows 上用 openclaw。</li>
                  <li>你已经装了 WSL，但不想总是切回命令行处理问题。</li>
                  <li>你想把 gateway 更新、配置和排查放到一个界面里完成。</li>
                  <li>你希望给中文用户一个更容易理解的管理入口。</li>
                </ul>
              </div>

              <div class="rounded-[1.5rem] border border-base-content/10 bg-base-100 p-6 sm:p-7">
                <h3 class="text-lg font-semibold">首页描述保持简单</h3>
                <ul class="mt-5 space-y-4 text-sm leading-7 text-base-content/72">
                  <li>不强调抽象概念，直接说软件能做什么。</li>
                  <li>不堆很多行业词，尽量用短句。</li>
                  <li>不把所有能力塞进首屏，重要信息分区展开。</li>
                  <li>给页面更多留白，让下载、功能和说明更好读。</li>
                </ul>
              </div>
            </div>
          </section>

          <footer class="mt-16 rounded-[1.5rem] border border-base-content/10 bg-base-100/85 px-6 py-8 text-sm text-base-content/70 sm:mt-20">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>ClawOS.CC</p>
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
