/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { changelogItems } from "../content/changelog";
import { getBrandConfig } from "../lib/branding";

const LOBSTER_DESKTOP_DOWNLOAD_URL = "https://ydschool-video.nosdn.127.net/1772959618633LobsterAI+Setup+0.2.2.exe";

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
  const coreCapabilities = [
    ["AI 员工职能介绍", "按 CEO / COO / CMO / CTO 等角色配置职责，任务自动分派。"],
    ["无人公司集中管理", "统一控制台查看目标、预算、心跳任务和关键 KPI。"],
    ["统一监控", "单页追踪每个员工的执行状态、工单链路与成本变化。"],
    ["虚拟公司架构", "支持投资公司、营销广告公司、IT 解决方案公司并行运营。"],
    ["硬件产品：虾壳 3.0", "软硬一体交付，结合边缘设备实现本地代理与远程协同。"],
  ] as const;
  const mcpCapabilities = [
    ["Marketing MCP", "管理广告投放、素材生成、渠道排期与转化复盘。"],
    ["Investment MCP", "进行市场扫描、风险提示、组合跟踪与周报生成。"],
    ["IT Solution MCP", "承接需求拆解、研发协作、测试发布与运维巡检。"],
    ["Ops & Monitor MCP", "统一告警、审计日志、预算阈值和异常工单升级。"],
  ] as const;
  const virtualOrg = [
    "董事会 / Owner：审批战略、预算和关键 hires。",
    "总部运营中心：统一监控、财务与风险控制。",
    "投资公司：研究、交易、风控三层代理协作。",
    "营销广告公司：内容、投放、增长代理按漏斗协同。",
    "IT 解决方案公司：产品、开发、测试、运维全链路自动化。",
  ] as const;
  const oemFlow = [
    "OEM 定制 GTA（Go-To-Agent）方案评估。",
    "确认品牌形象、MCP 组合与虚拟公司架构。",
    "按设备数量与交付周期报价，支持批量部署。",
    "上线后提供监控模板、告警规则和运营陪跑。",
  ] as const;

  return (
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${brandName} | 可定制的 openclaw`}</title>
        <link rel="icon" type="image/png" href={brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen text-base-content">
        <main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
          <header class="page-fade surface-wash rounded-[2rem] px-5 py-4 sm:px-7">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-3 text-lg font-semibold">
                <img src={brandLogoUrl} alt={`${brandName} Logo`} class="size-9 rounded-lg object-contain" />
                <span>{brandName}</span>
              </div>
              <nav class="flex flex-wrap items-center gap-2 text-sm" aria-label="页面导航">
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#overview">
                  介绍
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#core-features">
                  基础功能
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#advanced-features">
                  进阶功能
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#oem">
                  定制
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

          <div class="page-fade page-fade-delay-1 mt-5 flex justify-center">
            <a
              class="btn btn-primary btn-wide"
              href={LOBSTER_DESKTOP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
            >
              <DownloadIcon />
              简易版龙虾下载
            </a>
          </div>

          <section
            id="overview"
            class="page-fade page-fade-delay-1 ambient-shell mt-8 px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-18"
          >
            <div class="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
              <div class="max-w-2xl">
                <div class="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">无人公司 / AI 员工 / MCP 编排 / OEM 定制</div>
                <h1 class="mt-5 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                  Web 改版：{" "}
                  <span class="text-rotate text-primary" style="--duration: 9s;">
                    <span>
                      <span>无人公司控制台</span>
                      <span>AI 员工调度中心</span>
                      <span>虾壳 3.0 软硬一体平台</span>
                    </span>
                  </span>
                </h1>
                <p class="mt-6 max-w-xl text-base leading-8 text-base-content/72 sm:text-lg">
                  像管理真实公司一样管理 AI 组织。
                  <br />
                  从任务到执行再到复盘，全部在同一控制台完成。
                </p>
                <p class="mt-4 max-w-xl text-sm leading-7 text-base-content/62 sm:text-base">支持多公司并行运营，适配投资、营销广告与 IT 解决方案等业务形态。</p>

                <div class="mt-8 flex flex-wrap gap-3">
                  <span class="bg-base-100/70 px-3 py-2 text-xs font-medium tracking-[0.16em] text-base-content/70 uppercase">基础功能 + 进阶功能</span>
                  <span class="bg-base-100/60 px-3 py-2 text-xs font-medium tracking-[0.16em] text-base-content/70 uppercase">各 MCP 职能可视化</span>
                  <span class="bg-base-100/60 px-3 py-2 text-xs font-medium tracking-[0.16em] text-base-content/70 uppercase">OEM 定制 GTA</span>
                </div>

                <div class="mt-12 grid gap-6 sm:grid-cols-3">
                  <div>
                    <div class="text-2xl font-semibold">1 个中控台</div>
                    <div class="mt-2 text-sm leading-7 text-base-content/65">集中管理多家公司与全部 AI 员工。</div>
                  </div>
                  <div>
                    <div class="text-2xl font-semibold">2 层能力</div>
                    <div class="mt-2 text-sm leading-7 text-base-content/65">基础功能 + 各 MCP 进阶编排能力。</div>
                  </div>
                  <div>
                    <div class="text-2xl font-semibold">虾壳 3.0</div>
                    <div class="mt-2 text-sm leading-7 text-base-content/65">支持软硬件一体化 OEM 交付。</div>
                  </div>
                </div>

                <div class="mt-10 flex flex-wrap gap-3">
                  {hasInstaller ? (
                    <a class="btn btn-ghost btn-wide border border-base-content/15 bg-base-100/60" href="/downloads/latest">
                      <DownloadIcon />
                      {`下载 v${versionText}`}
                    </a>
                  ) : (
                    <button class="btn btn-ghost btn-wide border border-base-content/15 bg-base-100/60" type="button" disabled>
                      <DownloadIcon />
                      安装包暂未发布
                    </button>
                  )}
                  {hasBetaInstaller ? (
                    <a class="btn btn-ghost btn-wide border border-warning/30 bg-warning/10" href="/downloads/beta">
                      <DownloadIcon />
                      {`下载 Beta v${betaVersionText}`}
                    </a>
                  ) : null}
                  {hasAlphaInstaller ? (
                    <a class="btn btn-ghost btn-wide border border-info/30 bg-info/10" href="/downloads/alpha">
                      <DownloadIcon />
                      {`下载 Alpha v${alphaVersionText}`}
                    </a>
                  ) : null}
                  <a
                    class="btn btn-outline btn-wide border border-base-content/15 bg-base-100/40"
                    href="https://gx50d0q123.feishu.cn/wiki/CueLw8F8TiwjEMkGiCFclxtXnnh?from=from_copylink"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <DownloadIcon />
                    使用手册
                  </a>
                </div>
              </div>

              <aside class="float-gentle overflow-hidden bg-base-100/35">
                <img
                  src="/public/clawos.png"
                  alt={`${brandName} 产品截图`}
                  loading="eager"
                  decoding="async"
                  class="h-auto w-full object-contain"
                />
              </aside>
            </div>
          </section>

          <section id="core-features" class="page-fade page-fade-delay-2 mt-16 sm:mt-20 lg:mt-24">
            <SectionTitle eyebrow="Basic Features" title="1. 基础功能" desc="围绕 AI 员工、无人公司和虾壳 3.0 的核心能力。" />

            <div class="mt-12 grid gap-x-12 gap-y-10 pt-8 md:grid-cols-2">
              {coreCapabilities.map(([title, desc]) => (
                <article class="rise-on-hover space-y-2 bg-base-100/35 px-4 py-4">
                  <h3 class="text-lg font-semibold tracking-tight">{title}</h3>
                  <p class="max-w-md text-sm leading-7 text-base-content/68">{desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="advanced-features" class="page-fade page-fade-delay-2 mt-16 sm:mt-20 lg:mt-24">
            <SectionTitle eyebrow="Advanced Features" title="2. 进阶功能（各 MCP 介绍）" desc="把每个业务域做成独立 MCP，按公司级目标协同运行。" />

            <div class="mt-12 grid gap-x-12 gap-y-10 pt-8 md:grid-cols-2">
              {mcpCapabilities.map(([title, desc]) => (
                <article class="rise-on-hover space-y-2 bg-base-100/35 px-4 py-4">
                  <h3 class="text-lg font-semibold tracking-tight">{title}</h3>
                  <p class="max-w-md text-sm leading-7 text-base-content/68">{desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="oem" class="page-fade page-fade-delay-3 mt-20 px-1 sm:mt-24">
            <SectionTitle eyebrow="Virtual Company Blueprint" title="无人公司架构参考（Paperclip 风格）" desc="基于‘多公司 + 统一控制平面’思路，构建可扩展的虚拟公司矩阵。" />

            <div class="mt-8 space-y-3 bg-base-100/35 px-5 py-5">
              {virtualOrg.map((item) => (
                <p class="text-sm leading-7 text-base-content/72">{item}</p>
              ))}
            </div>

            <SectionTitle eyebrow="OEM Solution" title="6. OEM 定制 GTA" desc="按场景输出可落地的 Go-To-Agent 交付方案。" />

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
                <h3 class="text-lg font-semibold">硬件产品</h3>
                <div class="mt-5 space-y-3">
                  <p class="text-sm leading-7 text-base-content/70">虾壳 3.0：支持本地推理与云端协同，适配无人公司边缘节点。</p>
                  <p class="text-sm leading-7 text-base-content/70">支持批量预装企业模板，开箱即用接入控制台。</p>
                  <p class="text-sm leading-7 text-base-content/70">可按行业提供 OEM 外观与启动流程定制。</p>
                </div>
              </div>
            </div>
          </section>

          <section id="changelog" class="page-fade page-fade-delay-3 mt-20 px-1 sm:mt-24">
            <SectionTitle eyebrow="Changelog" title="更新日志（中文）" desc="记录近期版本更新，方便快速了解变化。" />
            <div class="mt-10 space-y-4">
              {changelogItems.map((item) => (
                <article class="bg-base-100/45 px-5 py-4">
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

          <footer class="page-fade page-fade-delay-3 mt-16 px-2 py-8 text-sm text-base-content/70 sm:mt-20">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>{`@${brandDomain}`}</p>
              <p>客服联系: tianshe00</p>
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
  hasBetaInstaller = false,
  betaVersion: string | null = null,
  hasAlphaInstaller = false,
  alphaVersion: string | null = null
): string {
  return `<!doctype html>${renderToString(
    <HomePage
      hasInstaller={hasInstaller}
      latestVersion={latestVersion}
      hasBetaInstaller={hasBetaInstaller}
      betaVersion={betaVersion}
      hasAlphaInstaller={hasAlphaInstaller}
      alphaVersion={alphaVersion}
    />
  )}`;
}
