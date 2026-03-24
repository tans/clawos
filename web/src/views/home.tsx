/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { changelogItems } from "../content/changelog";
import { getBrandConfig } from "../lib/branding";

function DownloadIcon() {
  return (
    <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v10" />
      <path d="M8 10l4 4 4-4" />
      <rect x="4" y="17" width="16" height="3" rx="1" />
    </svg>
  );
}

function SectionTitle({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div class="max-w-3xl space-y-3">
      <div class="subcaps">{eyebrow}</div>
      <h2 class="section-title">
        <span class="section-marker">&gt;</span>
        {title}
      </h2>
      <p class="text-sm leading-7 text-[#666] sm:text-base">{desc}</p>
    </div>
  );
}

function HomePage({
  hasInstaller,
  latestVersion,
  hasBetaInstaller,
  betaVersion,
  hasAlphaInstaller,
  alphaVersion,
}: {
  hasInstaller: boolean;
  latestVersion: string | null;
  hasBetaInstaller: boolean;
  betaVersion: string | null;
  hasAlphaInstaller: boolean;
  alphaVersion: string | null;
}) {
  const { brandName, brandDomain, brandLogoUrl } = getBrandConfig();
  const versionText = latestVersion?.trim() ? latestVersion.trim() : "dev";
  const betaVersionText = betaVersion?.trim() ? betaVersion.trim() : "dev";
  const alphaVersionText = alphaVersion?.trim() ? alphaVersion.trim() : "dev";

  const architecture = ["开箱即用", "一站式管理", "可扩展能力", "多场景支持"] as const;
  const executionGoals = ["上手快", "省时间", "更稳定", "更省心"] as const;
  const solutionTracks = [
    { title: "内容创作场景", desc: "适合短视频与图文团队，减少重复流程，让产出更稳定。" },
    { title: "获客与跟进场景", desc: "适合做线索收集和客户跟进，帮助你更快推进业务。" },
  ] as const;

  return (
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${brandName} | 更简单的智能助手平台`}</title>
        <link rel="icon" type="image/png" href={brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="site-bg text-[#1a1a1a]">
        <header class="glass-nav sticky top-0 z-40 border-b border-[#f3d7da]">
          <div class="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
            <a class="flex items-center gap-3" href="/">
              <img src={brandLogoUrl} alt={`${brandName} Logo`} class="size-9 rounded-xl border border-[#f1d6d9] bg-white p-1" />
              <span class="text-lg font-semibold">{brandName}</span>
            </a>
            <nav class="hidden items-center gap-2 md:flex" aria-label="页面导航">
              <a class="secondary-button" href="#architecture">架构</a>
              <a class="secondary-button" href="#solutions">场景</a>
              <a class="secondary-button" href="#changelog">更新</a>
              <a class="secondary-button" href="/contact">联系我们</a>
              <a class="primary-button" href="/to-agent">Agent 视角 →</a>
            </nav>
          </div>
        </header>

        <main class="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-8 sm:pt-14">
          <section class="hero-glow page-fade bento-card p-6 sm:p-10">
            <p class="subcaps">THE AI THAT ACTUALLY DOES THINGS.</p>
            <h1 class="mt-4 text-3xl font-extrabold tracking-tight text-[#1a1a1a] sm:text-5xl">把复杂功能变成人人都能用的简单操作</h1>
            <p class="mt-4 max-w-3xl text-sm leading-7 text-[#666] sm:text-base">不管你是个人用户还是小团队，都可以快速上手，把常见任务更轻松地跑起来。</p>
            <div class="mt-8 flex flex-wrap gap-3">
              {hasInstaller ? (
                <a class="primary-button" href="/downloads">
                  <DownloadIcon />
                  {`下载 ClawOS v${versionText} →`}
                </a>
              ) : (
                <button class="secondary-button" type="button" disabled>安装包暂未发布</button>
              )}
              <a class="secondary-button" href="https://gx50d0q123.feishu.cn/wiki/CueLw8F8TiwjEMkGiCFclxtXnnh?from=from_copylink" target="_blank" rel="noreferrer">
                查看使用手册
              </a>
            </div>
            <p class="mt-4 text-xs text-[#666]">
              {hasBetaInstaller ? `测试版 v${betaVersionText} 已开放` : "测试版通道筹备中"}
              {" · "}
              {hasAlphaInstaller ? `内测版 v${alphaVersionText} 可申请体验` : "内测版通道进行中"}
            </p>
          </section>

          <section id="architecture" class="mt-20 page-fade">
            <SectionTitle eyebrow="Why Choose Us" title="为什么普通用户也能轻松用" desc="把原本复杂的设置、更新和使用流程做成更直观的体验。" />
            <div class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {architecture.map((item) => (
                <article class="bento-card p-5">
                  <h3 class="text-lg font-semibold">{item}</h3>
                  <p class="mt-2 text-sm text-[#666]">流程统一，反馈清晰，减少重复劳动。</p>
                </article>
              ))}
            </div>
          </section>

          <section id="solutions" class="mt-20 page-fade">
            <SectionTitle eyebrow="User Benefits" title="你能得到什么" desc="从下载安装到日常使用，重点都是让你更快、更稳、更省心。" />
            <div class="mt-8 grid gap-4 md:grid-cols-2">
              {executionGoals.map((goal) => (
                <article class="bento-card p-5">
                  <p class="text-lg font-semibold text-[#1a1a1a]">{goal}</p>
                  <p class="mt-2 text-sm text-[#666]">基于统一界面和稳定交互，降低学习与执行成本。</p>
                </article>
              ))}
              {solutionTracks.map((track) => (
                <article class="aqua-glow bento-card p-5 md:col-span-2">
                  <h3 class="text-xl font-semibold text-[#1a1a1a]">{track.title}</h3>
                  <p class="mt-2 text-sm leading-7 text-[#666]">{track.desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="changelog" class="mt-20 page-fade">
            <SectionTitle eyebrow="Changelog" title="更新日志" desc="记录近期版本变化，便于快速了解更新。" />
            <div class="mt-8 space-y-4">
              {changelogItems.map((item) => (
                <article class="bento-card p-5">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-base font-semibold text-[#1a1a1a]">{item.version}</span>
                    <span class="text-xs text-[#666]">{item.date}</span>
                    <span class="channel-badge">{item.channel.toUpperCase()}</span>
                  </div>
                  <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-[#666]">
                    {item.highlights.map((highlight) => (
                      <li>{highlight}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section class="aqua-glow page-fade mt-20 bento-card p-6 sm:p-8">
            <h2 class="section-title">
              <span class="section-marker">&gt;</span>
              准备开始体验了吗？
            </h2>
            <p class="mt-3 max-w-3xl text-sm leading-7 text-[#666] sm:text-base">可以先下载试用，也可以先看使用手册；如果你有合作或采购需求，欢迎随时联系我们。</p>
            <div class="mt-6 flex flex-wrap gap-3">
              <a class="primary-button" href="/contact">联系我们 →</a>
              <a class="secondary-button" href="/ceo-letter">阅读 CEO agent&apos;s letter</a>
            </div>
          </section>

          <footer class="mt-16 border-t border-[#f0d3d6] pt-6 text-sm text-[#666]">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>{`@${brandDomain}`}</p>
              <div class="flex items-center gap-4">
                <a class="brand-link" href="/ceo-letter">CEO agent&apos;s letter →</a>
                <a class="brand-link" href="/contact">联系我们 →</a>
              </div>
            </div>
          </footer>
        </main>
      </body>
    </html>
  );
}

export function renderHomePage(
  hasInstaller: boolean,
  latestVersion: string | null,
  hasBetaInstaller: boolean,
  betaVersion: string | null,
  hasAlphaInstaller: boolean,
  alphaVersion: string | null,
) {
  return renderToString(
    <HomePage
      hasInstaller={hasInstaller}
      latestVersion={latestVersion}
      hasBetaInstaller={hasBetaInstaller}
      betaVersion={betaVersion}
      hasAlphaInstaller={hasAlphaInstaller}
      alphaVersion={alphaVersion}
    />,
  );
}
