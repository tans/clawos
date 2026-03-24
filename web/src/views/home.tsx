/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { changelogItems } from "../content/changelog";
import { getBrandConfig } from "../lib/branding";

function DownloadIcon() {
  return (
    <svg
      class="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4v10" />
      <path d="M8 10l4 4 4-4" />
      <rect x="4" y="17" width="16" height="3" rx="1" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      class="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
    <svg
      class="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 15.5A8.5 8.5 0 1 1 8.5 4 6.5 6.5 0 0 0 20 15.5z" />
    </svg>
  );
}

function SectionTitle({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <div class="max-w-3xl space-y-3">
      <div class="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">
        {eyebrow}
      </div>
      <h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p class="text-sm leading-7 text-base-content/70 sm:text-base">{desc}</p>
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

  const architecture = [
    "虾壳主机：交付入口，缩短从采购到见效路径",
    "ClawOS：统一维护配置、技能安装与任务运营",
    "OpenClaw：连接外部能力，形成可扩展执行体系",
    "OEM：从单点交付走向渠道化规模复制",
  ] as const;

  const executionGoals = [
    "客户成功：快速上线并看到经营结果",
    "交付效率：标准化主机与能力包，降低部署成本",
    "运营稳定：统一治理，长期可控",
    "生态增长：行业方案 + OEM 扩张",
  ] as const;

  const solutionTracks = [
    {
      title: "视频内容剪辑主机",
      desc: "面向内容团队，缩短制作周期，稳定交付节奏。",
    },
    {
      title: "客户线索获取主机",
      desc: "面向增长与销售团队，提升线索采集与跟进效率。",
    },
  ] as const;

  return (
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${brandName} | 虾壳主机 + ClawOS + OpenClaw + OEM`}</title>
        <link rel="icon" type="image/png" href={brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen text-base-content">
        <header class="hero-nav-overlay page-fade">
          <div class="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
            <div class="flex items-center gap-3 text-lg font-semibold text-white">
              <img
                src={brandLogoUrl}
                alt={`${brandName} Logo`}
                class="size-9 rounded-lg bg-white/90 object-contain p-1"
              />
              <span>{brandName}</span>
            </div>
            <nav class="hidden items-center gap-2 text-sm md:flex" aria-label="页面导航">
              <a class="hero-nav-link" href="#architecture">
                架构
              </a>
              <a class="hero-nav-link" href="#solutions">
                行业方案
              </a>
              <a class="hero-nav-link" href="#oem">
                OEM
              </a>
              <a class="hero-nav-link" href="#changelog">
                更新
              </a>
              <div class="inline-flex items-center rounded-full border border-white/35 bg-black/20 p-1">
                <a
                  class="inline-flex items-center gap-2 rounded-full bg-warning/25 px-3 py-2 text-xs font-semibold text-white"
                  href="/"
                  aria-current="page"
                >
                  <SunIcon />
                  Human
                </a>
                <a
                  class="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-white/75 transition-colors hover:text-white"
                  href="/to-agent"
                >
                  <MoonIcon />
                  Agent
                </a>
              </div>
            </nav>
          </div>
        </header>

        <main>
          <section class="hero-fullbleed">
            <img
              src="/public/clawos.png"
              alt={`${brandName} 产品展示`}
              class="hero-image-drift"
              loading="eager"
              decoding="async"
            />
            <div class="hero-gradient" />
            <div class="hero-content-wrap">
              <div class="hero-copy-col page-fade page-fade-delay-1">
                <p class="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                  虾壳主机 / ClawOS / OpenClaw / OEM
                </p>
                <h1 class="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  让智能体能力
                  <br />
                  成为可规模复制的企业产能
                </h1>
                <p class="mt-6 max-w-xl text-base leading-8 text-white/80 sm:text-lg">
                  我们交付的不只是工具，而是一条可落地、可运营、可扩张的业务执行路径。
                </p>
                <div class="mt-8 flex flex-wrap gap-3">
                  {hasInstaller ? (
                    <a class="btn btn-ghost border border-white/40 bg-black/25 text-white" href="/downloads/latest">
                      <DownloadIcon />
                      {`下载 ClawOS v${versionText}`}
                    </a>
                  ) : (
                    <button class="btn btn-ghost border border-white/30 bg-black/25 text-white" type="button" disabled>
                      安装包暂未发布
                    </button>
                  )}
                  <a
                    class="btn border-0 bg-white text-black hover:bg-white/90"
                    href="https://gx50d0q123.feishu.cn/wiki/CueLw8F8TiwjEMkGiCFclxtXnnh?from=from_copylink"
                    target="_blank"
                    rel="noreferrer"
                  >
                    预约业务咨询
                  </a>
                </div>
                <p class="mt-4 text-xs text-white/65">
                  {hasBetaInstaller ? `Beta v${betaVersionText} 已开放` : "Beta 通道筹备中"}
                  {" · "}
                  {hasAlphaInstaller ? `Alpha v${alphaVersionText} 可申请体验` : "Alpha 通道内测中"}
                </p>
              </div>
            </div>
          </section>

          <section id="architecture" class="mx-auto mt-16 w-full max-w-7xl px-5 sm:mt-20 sm:px-8 lg:px-12">
            <SectionTitle
              eyebrow="Business Architecture"
              title="三层协同，一个执行目标"
              desc="围绕客户成功、交付效率、运营稳定、生态增长，构建从单机到规模化的完整路径。"
            />
            <div class="mt-10 grid gap-5 md:grid-cols-2">
              {architecture.map((item) => (
                <article class="border-b border-base-content/10 pb-4 text-base leading-8 text-base-content/80">
                  {item}
                </article>
              ))}
            </div>
          </section>

          <section class="mx-auto mt-16 w-full max-w-7xl px-5 sm:mt-20 sm:px-8 lg:px-12">
            <SectionTitle
              eyebrow="Execution Goals"
              title="统一执行目标"
              desc="每个模块只服务一件事：把复杂能力变成可交付、可复购、可持续运营的结果。"
            />
            <div class="mt-10 space-y-3">
              {executionGoals.map((goal) => (
                <p class="rise-on-hover border-l-2 border-base-content/20 pl-4 text-sm leading-7 text-base-content/76 sm:text-base">
                  {goal}
                </p>
              ))}
            </div>
          </section>

          <section id="solutions" class="mx-auto mt-16 w-full max-w-7xl px-5 sm:mt-20 sm:px-8 lg:px-12">
            <SectionTitle
              eyebrow="Industry Hosts"
              title="行业专用主机"
              desc="以开箱即用主机承载具体业务场景，让客户直接进入可运营状态。"
            />
            <div class="mt-10 grid gap-10 lg:grid-cols-2">
              {solutionTracks.map((track) => (
                <article>
                  <h3 class="text-2xl font-semibold tracking-tight">{track.title}</h3>
                  <p class="mt-3 text-sm leading-7 text-base-content/72 sm:text-base">{track.desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="oem" class="mx-auto mt-16 w-full max-w-7xl px-5 sm:mt-20 sm:px-8 lg:px-12">
            <SectionTitle
              eyebrow="OEM Growth"
              title="OEM：从产品交付走向生态放大"
              desc="通过品牌共建与渠道合作，把平台能力复制到更多行业市场。"
            />
            <div class="mt-10 border-t border-base-content/10 pt-6">
              <p class="max-w-4xl text-sm leading-8 text-base-content/75 sm:text-base">
                OEM 不是附加功能，而是我们的增长机制。我们帮助合作伙伴在不自建底层体系的前提下，快速获得可销售、可交付、可运营的智能主机产品。
              </p>
            </div>
          </section>

          <section id="changelog" class="mx-auto mt-20 w-full max-w-7xl px-5 sm:mt-24 sm:px-8 lg:px-12">
            <SectionTitle
              eyebrow="Changelog"
              title="更新日志"
              desc="记录近期版本变化，便于快速了解更新。"
            />
            <div class="mt-8 space-y-5">
              {changelogItems.map((item) => (
                <article class="border-b border-base-content/10 pb-5">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-base font-semibold">{item.version}</span>
                    <span class="text-xs text-base-content/60">{item.date}</span>
                    <span class="badge badge-outline badge-sm">{item.channel.toUpperCase()}</span>
                  </div>
                  <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-base-content/70">
                    {item.highlights.map((highlight) => (
                      <li>{highlight}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section class="mx-auto mt-20 w-full max-w-7xl px-5 pb-16 sm:px-8 lg:px-12">
            <div class="border-t border-base-content/15 pt-8">
              <h2 class="text-2xl font-semibold tracking-tight">让团队从“会用”走向“可持续增长”</h2>
              <p class="mt-3 max-w-3xl text-sm leading-7 text-base-content/70 sm:text-base">
                如果你希望把虾壳主机 + ClawOS 用于行业交付或 OEM 合作，我们可以一起定义你的首个可复制场景。
              </p>
              <div class="mt-6 flex flex-wrap gap-3">
                <a
                  class="btn border-0 bg-black text-white hover:bg-black/90"
                  href="https://gx50d0q123.feishu.cn/wiki/CueLw8F8TiwjEMkGiCFclxtXnnh?from=from_copylink"
                  target="_blank"
                  rel="noreferrer"
                >
                  联系商务
                </a>
                <a class="btn btn-ghost border border-base-content/20" href="/ceo-letter">
                  阅读 CEO agent&apos;s letter
                </a>
              </div>
            </div>
          </section>

          <footer class="mx-auto w-full max-w-7xl px-5 pb-8 text-sm text-base-content/70 sm:px-8 lg:px-12">
            <div class="flex flex-col gap-2 border-t border-base-content/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p>{`@${brandDomain}`}</p>
              <div class="flex items-center gap-4">
                <a class="underline decoration-base-content/35 underline-offset-4 hover:decoration-base-content/80" href="/ceo-letter">
                  CEO agent&apos;s letter
                </a>
                <p>客服联系: tianshe00</p>
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
