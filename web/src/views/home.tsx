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
    "开箱即用：下载安装后即可开始使用，无需复杂配置",
    "一站式管理：常用功能集中在一个界面，操作更简单",
    "可扩展能力：可按需接入更多工具，功能持续扩充",
    "多场景支持：个人、团队和合作方都能灵活使用",
  ] as const;

  const executionGoals = [
    "上手快：少走弯路，新用户也能快速开始",
    "省时间：把重复操作交给系统，效率更高",
    "更稳定：统一管理更新与配置，减少出错",
    "更省心：需要时可随时联系客服获得帮助",
  ] as const;

  const solutionTracks = [
    {
      title: "内容创作场景",
      desc: "适合短视频与图文团队，减少重复流程，让产出更稳定。",
    },
    {
      title: "获客与跟进场景",
      desc: "适合做线索收集和客户跟进，帮助你更快推进业务。",
    },
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
              <a class="hero-nav-link" href="/contact">
                联系我们
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
            <div class="hero-gradient" />
            <div class="hero-content-wrap">
              <div class="hero-copy-col page-fade page-fade-delay-1">
                <p class="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                  简单好用 / 开箱即用 / 持续更新
                </p>
                <h1 class="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  把复杂功能
                  <br />
                  变成人人都能用的简单操作
                </h1>
                <p class="mt-6 max-w-xl text-base leading-8 text-white/80 sm:text-lg">
                  不管你是个人用户还是小团队，都可以快速上手，把常见任务更轻松地跑起来。
                </p>
                <div class="mt-8 flex flex-wrap gap-3">
                  {hasInstaller ? (
                    <a class="btn btn-ghost border border-white/40 bg-black/25 text-white" href="/downloads">
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
                    查看使用手册
                  </a>
                </div>
                <p class="mt-4 text-xs text-white/65">
                  {hasBetaInstaller ? `测试版 v${betaVersionText} 已开放` : "测试版通道筹备中"}
                  {" · "}
                  {hasAlphaInstaller ? `内测版 v${alphaVersionText} 可申请体验` : "内测版通道进行中"}
                </p>
              </div>
            </div>
          </section>

          <section id="architecture" class="mx-auto mt-16 w-full max-w-7xl px-5 sm:mt-20 sm:px-8 lg:px-12">
            <SectionTitle
              eyebrow="Why Choose Us"
              title="为什么普通用户也能轻松用"
              desc="把原本复杂的设置、更新和使用流程做成更直观的体验。"
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
              eyebrow="User Benefits"
              title="你能得到什么"
              desc="从下载安装到日常使用，重点都是让你更快、更稳、更省心。"
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
              eyebrow="Use Cases"
              title="常见使用场景"
              desc="根据不同工作内容提供合适能力，减少你自己折腾的时间。"
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
              eyebrow="For Partners"
              title="也支持合作与定制"
              desc="如果你有品牌或行业需求，也可以联系我们做联合交付。"
            />
            <div class="mt-10 border-t border-base-content/10 pt-6">
              <p class="max-w-4xl text-sm leading-8 text-base-content/75 sm:text-base">
                对普通用户来说，你可以直接使用现成功能；对合作方来说，我们也提供定制化支持，帮助快速上线。
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
              <h2 class="text-2xl font-semibold tracking-tight">准备开始体验了吗？</h2>
              <p class="mt-3 max-w-3xl text-sm leading-7 text-base-content/70 sm:text-base">
                可以先下载试用，也可以先看使用手册；如果你有合作或采购需求，欢迎随时联系我们。
              </p>
              <div class="mt-6 flex flex-wrap gap-3">
                <a
                  class="btn border-0 bg-black text-white hover:bg-black/90"
                  href="/contact">
                  联系我们
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
                <a class="underline decoration-base-content/35 underline-offset-4 hover:decoration-base-content/80" href="/contact">联系我们</a>
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
