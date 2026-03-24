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

  const hostProductLines = [
    {
      title: "通用 OpenClaw 主机",
      subtitle: "入门学习，自主设置",
      bullets: ["适合开发者与 PoC 团队", "可按需安装技能与流程", "低门槛启动，快速熟悉 OpenClaw"],
    },
    {
      title: "行业主机",
      subtitle: "预设技能，开箱即用",
      bullets: ["适合要快速上线业务的团队", "内置行业模板，减少配置成本", "直接进入可运营状态"],
    },
  ] as const;

  const industryHosts = ["内容生成主机", "客户管理主机", "行业专家主机"] as const;

  const clawosCapabilities = ["目标拆解与任务编排", "多角色 AI 员工协同", "执行可视化、审计可追踪"] as const;

  const openclawExtensions = ["MCP 能力接入（营销 / 投研 / IT / 运维）", "企业系统与 API 集成", "流程模板与角色权限定制"] as const;

  const clusterAndCompany = [
    "多节点统一纳管与任务分发",
    "状态巡检、异常告警与风险治理",
    "Owner / 管理层 / 业务单元 / AI 员工分层协作",
  ] as const;

  const oemOdmScopes = ["软件定制：界面、流程、角色、权限、MCP 组合", "硬件定制：外观、规格、预装系统、启动流程", "交付定制：部署、培训、运维、持续升级"] as const;

  const cooperationFlow = ["需求评估", "方案确认", "打样部署", "批量交付"] as const;

  return (
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${brandName} | 主机 + ClawOS + OpenClaw + OEM/ODM`}</title>
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
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#host-business">
                  主机业务
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#clawos-software">
                  ClawOS 软件
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#openclaw-extension">
                  定制扩展
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#cluster-company">
                  集群管理
                </a>
                <a class="btn btn-ghost btn-sm border border-base-content/15" href="#oem-odm">
                  OEM / ODM
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

          <section class="page-fade page-fade-delay-1 ambient-shell mt-8 px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-18">
            <div class="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
              <div class="max-w-2xl">
                <div class="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">主机业务 / ClawOS 软件 / OpenClaw 扩展 / 集群管理 / OEM ODM</div>
                <h1 class="mt-5 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">企业级 AI 业务落地平台</h1>
                <p class="mt-6 max-w-xl text-base leading-8 text-base-content/72 sm:text-lg">
                  以主机业务为入口，基于 ClawOS 统一控制平面，通过 OpenClaw 完成行业扩展，支持集群化与无人公司搭建，最终提供 OEM/ODM
                  软硬件深度定制方案。
                </p>

                <div class="mt-8 flex flex-wrap gap-3">
                  <a class="btn btn-outline border border-base-content/15 bg-base-100/40" href="#host-business">
                    查看主机方案
                  </a>
                  {hasInstaller ? (
                    <a class="btn btn-ghost border border-base-content/15 bg-base-100/60" href="/downloads/latest">
                      <DownloadIcon />
                      {`下载 ClawOS v${versionText}`}
                    </a>
                  ) : (
                    <button class="btn btn-ghost border border-base-content/15 bg-base-100/60" type="button" disabled>
                      <DownloadIcon />
                      安装包暂未发布
                    </button>
                  )}
                  <a
                    class="btn btn-outline border border-base-content/15 bg-base-100/40"
                    href="https://gx50d0q123.feishu.cn/wiki/CueLw8F8TiwjEMkGiCFclxtXnnh?from=from_copylink"
                    target="_blank"
                    rel="noreferrer"
                  >
                    咨询定制方案
                  </a>
                </div>

                <div class="mt-10 grid gap-4 sm:grid-cols-3">
                  <div class="bg-base-100/45 px-4 py-3 text-sm">硬件入口：主机业务</div>
                  <div class="bg-base-100/45 px-4 py-3 text-sm">软件大脑：ClawOS 控制平面</div>
                  <div class="bg-base-100/45 px-4 py-3 text-sm">深度合作：OEM / ODM</div>
                </div>
              </div>

              <aside class="float-gentle overflow-hidden bg-base-100/35">
                <img src="/public/clawos.png" alt={`${brandName} 产品截图`} loading="eager" decoding="async" class="h-auto w-full object-contain" />
              </aside>
            </div>
          </section>

          <section id="host-business" class="page-fade page-fade-delay-2 mt-16 sm:mt-20 lg:mt-24">
            <SectionTitle eyebrow="Host Business" title="1. 主机业务" desc="分为通用 OpenClaw 主机与行业主机两条产品线，覆盖入门学习与业务落地。" />
            <div class="mt-10 grid gap-6 md:grid-cols-2">
              {hostProductLines.map((line) => (
                <article class="space-y-3 bg-base-100/35 px-5 py-5">
                  <h3 class="text-lg font-semibold">{line.title}</h3>
                  <p class="text-sm text-base-content/70">{line.subtitle}</p>
                  <ul class="list-disc space-y-1 pl-5 text-sm text-base-content/72">
                    {line.bullets.map((bullet) => (
                      <li>{bullet}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <div class="mt-6 bg-base-100/35 px-5 py-4">
              <p class="text-sm font-semibold">行业主机方向</p>
              <div class="mt-3 flex flex-wrap gap-2">
                {industryHosts.map((host) => (
                  <span class="bg-base-100/70 px-3 py-2 text-xs font-medium tracking-[0.08em]">{host}</span>
                ))}
              </div>
            </div>
          </section>

          <section id="clawos-software" class="page-fade page-fade-delay-2 mt-16 sm:mt-20 lg:mt-24">
            <SectionTitle eyebrow="ClawOS" title="2. ClawOS 软件" desc="统一控制平面，负责目标、任务、流程、监控与告警。" />
            <div class="mt-10 grid gap-6 md:grid-cols-2">
              <article class="bg-base-100/35 px-5 py-5">
                <h3 class="text-base font-semibold">核心能力</h3>
                <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-base-content/72">
                  {clawosCapabilities.map((item) => (
                    <li>{item}</li>
                  ))}
                </ul>
              </article>
              <article class="bg-base-100/35 px-5 py-5">
                <h3 class="text-base font-semibold">下载通道</h3>
                <div class="mt-4 flex flex-wrap gap-3">
                  {hasInstaller ? (
                    <a class="btn btn-ghost border border-base-content/15 bg-base-100/60" href="/downloads/latest">
                      <DownloadIcon />
                      {`稳定版 v${versionText}`}
                    </a>
                  ) : (
                    <button class="btn btn-ghost border border-base-content/15 bg-base-100/60" type="button" disabled>
                      安装包暂未发布
                    </button>
                  )}
                  {hasBetaInstaller ? (
                    <a class="btn btn-ghost border border-warning/30 bg-warning/10" href="/downloads/beta">
                      <DownloadIcon />
                      {`Beta v${betaVersionText}`}
                    </a>
                  ) : null}
                  {hasAlphaInstaller ? (
                    <a class="btn btn-ghost border border-info/30 bg-info/10" href="/downloads/alpha">
                      <DownloadIcon />
                      {`Alpha v${alphaVersionText}`}
                    </a>
                  ) : null}
                </div>
              </article>
            </div>
          </section>

          <section id="openclaw-extension" class="page-fade page-fade-delay-2 mt-16 sm:mt-20 lg:mt-24">
            <SectionTitle eyebrow="OpenClaw Extension" title="3. 定制扩展 OpenClaw" desc="把通用能力转化为你的行业流程与业务资产。" />
            <div class="mt-10 bg-base-100/35 px-5 py-5">
              <ul class="list-disc space-y-2 pl-5 text-sm text-base-content/72">
                {openclawExtensions.map((item) => (
                  <li>{item}</li>
                ))}
              </ul>
              <div class="mt-5">
                <a class="btn btn-outline border border-base-content/15" href="#oem-odm">
                  咨询定制开发
                </a>
              </div>
            </div>
          </section>

          <section id="cluster-company" class="page-fade page-fade-delay-2 mt-16 sm:mt-20 lg:mt-24">
            <SectionTitle eyebrow="Cluster & Company" title="4. 集群管理 / 无人公司搭建" desc="从单点部署走向可治理、可审计、可复制的公司级运营。" />
            <div class="mt-10 bg-base-100/35 px-5 py-5">
              <ul class="list-disc space-y-2 pl-5 text-sm text-base-content/72">
                {clusterAndCompany.map((item) => (
                  <li>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section id="oem-odm" class="page-fade page-fade-delay-3 mt-16 sm:mt-20 lg:mt-24">
            <SectionTitle eyebrow="OEM / ODM" title="5. OEM / ODM 合作" desc="软件硬件深度定制，支持从 PoC 到规模化商用。" />
            <div class="mt-10 grid gap-6 lg:grid-cols-2">
              <article class="bg-base-100/35 px-5 py-5">
                <h3 class="text-base font-semibold">定制范围</h3>
                <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-base-content/72">
                  {oemOdmScopes.map((item) => (
                    <li>{item}</li>
                  ))}
                </ul>
              </article>
              <article class="bg-base-100/35 px-5 py-5">
                <h3 class="text-base font-semibold">合作流程</h3>
                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                  {cooperationFlow.map((item) => (
                    <p class="bg-base-100/55 px-3 py-2 text-sm text-base-content/75">{item}</p>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <section id="changelog" class="page-fade page-fade-delay-3 mt-20 px-1 sm:mt-24">
            <SectionTitle eyebrow="Changelog" title="更新日志" desc="记录近期版本变化，便于快速了解更新。" />
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
