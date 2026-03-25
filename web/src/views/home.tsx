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
      <p class="text-sm leading-7 text-[#c2b7ae] sm:text-base">{desc}</p>
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

  const architecture = ["开箱即用", "一站式管理", "可扩展能力", "多场景支持"] as const;
  const executionGoals = ["上手快", "省时间", "更稳定", "更省心"] as const;
  const heroSlogans = ["复杂一键搞定", "人人轻松上手", "流程简单高效", "功能触手可用"] as const;
  const listedMcps = [
    { name: "CRM MCP", tag: "销售自动化", status: "已上架", desc: "线索录入、客户跟进、任务提醒，全流程可追踪。", path: "mcp/crm-mcp" },
    { name: "BOM MCP", tag: "制造报价", status: "已上架", desc: "支持 BOM 解析、询价任务编排、报价结果导出。", path: "mcp/bom-mcp" },
    { name: "Wallet MCP", tag: "资金管理", status: "已上架", desc: "统一资金账户查询与对账能力，便于企业财务协同。", path: "mcp/wallet-mcp" },
    { name: "Windows MCP", tag: "桌面自动化", status: "已上架", desc: "面向 Windows 终端场景，支持流程自动执行与集成。", path: "mcp/windows-mcp" },
    { name: "Wechat MCP", tag: "私域运营", status: "已上架", desc: "连接企业私域沟通场景，支持消息链路与运营动作。", path: "mcp/wechat-mcp" },
    { name: "Yingdao MCP", tag: "业务集成", status: "已上架", desc: "用于对接垂直业务系统，扩展企业内部智能流程。", path: "mcp/yingdao-mcp" },
  ] as const;
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
      <body class="site-bg text-[#f9f3eb]">
        <header class="glass-nav sticky top-0 z-40 border-b border-white/15">
          <div class="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
            <a class="flex items-center gap-3" href="/">
              <img src={brandLogoUrl} alt={`${brandName} Logo`} class="size-9 rounded-xl border border-white/20 bg-white/5 p-1" />
              <span class="text-lg font-semibold">{brandName}</span>
            </a>
            <nav class="hidden items-center gap-2 md:flex" aria-label="页面导航">
              <a class="secondary-button" href="#architecture">架构</a>
              <a class="secondary-button" href="#solutions">场景</a>
              <a class="secondary-button" href="#marketplace">技能市场</a>
              <a class="secondary-button" href="#changelog">更新</a>
              <a class="secondary-button" href="/contact">联系我们</a>
              <a class="primary-button" href="/to-agent">Agent 视角 →</a>
            </nav>
          </div>
        </header>

        <main class="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-8 sm:pt-14">
          <section class="hero-glow page-fade bento-card p-6 sm:p-10">
            <div class="hero-orbit" aria-hidden="true"></div>
            <p class="subcaps">THE AI THAT ACTUALLY DOES THINGS.</p>
            <h1 class="mt-4 text-3xl font-extrabold tracking-tight text-[#f9f3eb] sm:text-5xl">
              <span class="hero-slogan-rotator" aria-label="复杂一键搞定，人人轻松上手，流程简单高效，功能触手可用">
                {heroSlogans.map((slogan, index) => (
                  <span class="hero-slogan-item" style={{ "--slogan-index": `${index}` }}>
                    {slogan}
                  </span>
                ))}
              </span>
            </h1>
            <p class="mt-4 max-w-3xl text-sm leading-7 text-[#c2b7ae] sm:text-base">企业级技能市场，为企业应用场景而生。统一展示与管理上架 MCP，帮助团队快速完成系统化落地。</p>
            <div class="mt-8 flex flex-wrap gap-3">
              {hasInstaller ? (
                <a class="primary-button" href="/downloads">
                  <DownloadIcon />
                  {`下载稳定版 v${versionText} →`}
                </a>
              ) : (
                <button class="secondary-button" type="button" disabled>安装包暂未发布</button>
              )}
              <a class="secondary-button" href="https://gx50d0q123.feishu.cn/wiki/CueLw8F8TiwjEMkGiCFclxtXnnh?from=from_copylink" target="_blank" rel="noreferrer">
                查看使用手册
              </a>
            </div>
            <p class="mt-4 text-xs text-[#c2b7ae]">首页下载默认指向稳定版；测试版与内测版请在下载中心查看。</p>
            <div class="hero-metrics mt-8 grid gap-3 text-xs sm:grid-cols-3">
              <div>
                <p class="hero-metric-label">MCP 上架能力</p>
                <p class="hero-metric-value">6+</p>
              </div>
              <div>
                <p class="hero-metric-label">部署方式</p>
                <p class="hero-metric-value">本地 + 云端</p>
              </div>
              <div>
                <p class="hero-metric-label">平均接入时间</p>
                <p class="hero-metric-value">&lt; 30 分钟</p>
              </div>
            </div>
          </section>

          <section id="architecture" class="mt-20 page-fade">
            <SectionTitle eyebrow="Why Choose Us" title="为什么普通用户也能轻松用" desc="复杂设置被简化为可视化操作。" />
            <div class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {architecture.map((item) => (
                <article class="bento-card p-5">
                  <h3 class="text-lg font-semibold">{item}</h3>
                  <p class="mt-2 text-sm text-[#c2b7ae]">流程统一，反馈清晰，减少重复劳动。</p>
                </article>
              ))}
            </div>
          </section>

          <section id="solutions" class="mt-20 page-fade">
            <SectionTitle eyebrow="User Benefits" title="你能得到什么" desc="更快上手，更稳运行。"/>
            <div class="mt-8 grid gap-4 md:grid-cols-2">
              {executionGoals.map((goal) => (
                <article class="bento-card p-5">
                  <p class="text-lg font-semibold text-[#f9f3eb]">{goal}</p>
                  <p class="mt-2 text-sm text-[#c2b7ae]">统一界面，减少学习成本。</p>
                </article>
              ))}
              {solutionTracks.map((track) => (
                <article class="aqua-glow bento-card p-5 md:col-span-2">
                  <h3 class="text-xl font-semibold text-[#f9f3eb]">{track.title}</h3>
                  <p class="mt-2 text-sm leading-7 text-[#c2b7ae]">{track.desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="marketplace" class="mt-20 page-fade">
            <SectionTitle eyebrow="Enterprise Skill Hub" title="企业级技能市场" desc="展示已上架 MCP，面向企业核心业务场景快速装配。" />
            <div class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {listedMcps.map((item) => (
                <article class="bento-card p-5">
                  <div class="flex items-center justify-between gap-3">
                    <h3 class="text-lg font-semibold text-[#f9f3eb]">{item.name}</h3>
                    <span class="channel-badge">{item.status}</span>
                  </div>
                  <p class="mt-3 text-xs font-medium text-[#f0be8e]">{item.tag}</p>
                  <p class="mt-2 text-sm leading-7 text-[#c2b7ae]">{item.desc}</p>
                  <p class="mt-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-[#c2b7ae]">{item.path}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="changelog" class="mt-20 page-fade">
            <SectionTitle eyebrow="Changelog" title="更新日志" desc="近期版本变化一目了然。" />
            <div class="mt-8 space-y-4">
              {changelogItems.map((item) => (
                <article class="bento-card p-5">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-base font-semibold text-[#f9f3eb]">{item.version}</span>
                    <span class="text-xs text-[#c2b7ae]">{item.date}</span>
                    <span class="channel-badge">{item.channel.toUpperCase()}</span>
                  </div>
                  <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-[#c2b7ae]">
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
            <p class="mt-3 max-w-3xl text-sm leading-7 text-[#c2b7ae] sm:text-base">先下载试用，或先查看手册；合作需求可直接联系我们。</p>
            <div class="mt-6 flex flex-wrap gap-3">
              <a class="primary-button" href="/contact">联系我们 →</a>
              <a class="secondary-button" href="/ceo-letter">阅读 CEO agent&apos;s letter</a>
            </div>
          </section>

          <footer class="mt-16 border-t border-white/15 pt-6 text-sm text-[#c2b7ae]">
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
