/** @jsxImportSource hono/jsx */

import { getBrandConfig } from "../lib/branding";
import { renderMarketingShell } from "./marketing-shell";

interface DownloadChannelCard {
  id: "stable" | "beta" | "alpha";
  label: string;
  badgeClass: string;
  version: string;
  publishedAt: string;
  hasInstaller: boolean;
  windowsUrl: string;
  macosUrl: string;
  linuxUrl: string;
}

function formatPublishedAt(value: string | null): string {
  if (!value) return "暂无发布时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无发布时间";
  return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function renderDownloadsPage(cards: DownloadChannelCard[]): string {
  const { brandName } = getBrandConfig();
  return renderMarketingShell({
    title: "下载试用",
    description: `${brandName} 下载试用入口与企业部署评估入口。`,
    currentPath: "/downloads",
    children: <DownloadsPage cards={cards} brandName={brandName} />,
  });
}

function DownloadsPage({ cards, brandName }: { cards: DownloadChannelCard[]; brandName: string }) {
  const stable = cards.find((card) => card.id === "stable");
  const secondary = cards.filter((card) => card.id !== "stable");

  return (
    <>
      <section class="marketing-section py-10 sm:py-14">
        <div class="marketing-section-inner">
          <div class="marketing-card marketing-page-hero p-6 sm:p-8">
            <p class="marketing-kicker">Trial Entry</p>
            <h1 class="marketing-h2 mt-2 text-3xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-4xl">{`下载 ${brandName}，开始你的企业 AI 试点`}</h1>
            <p class="marketing-lead mt-4 max-w-3xl text-base leading-8 text-[color:var(--ink-soft)]">先从桌面试用开始；如果需要本地优先部署或虾壳主机交付，可直接咨询企业部署方案。</p>
          </div>
        </div>
      </section>

      <section class="marketing-section py-6 sm:py-8">
        <div class="marketing-section-inner lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:gap-6">
          <article class="marketing-card marketing-download-primary p-6 sm:p-8">
            <p class="marketing-kicker">Stable</p>
            <h2 class="mt-2 text-2xl font-bold tracking-tight text-[color:var(--ink-strong)]">下载稳定版</h2>
            <p class="mt-3 text-sm text-[color:var(--ink-soft)]">{`当前版本：${stable?.version ?? "dev"}`}</p>
            <div class="marketing-platform-list mt-5 grid gap-3 sm:flex sm:flex-wrap">
              <a class="marketing-primary-button" href={stable?.windowsUrl ?? "/downloads/latest/windows"}>下载 Windows</a>
              <a class="marketing-secondary-button" href={stable?.macosUrl ?? "/downloads/latest/macos"}>下载 macOS</a>
              <a class="marketing-secondary-button" href={stable?.linuxUrl ?? "/downloads/latest/linux"}>下载 Linux</a>
            </div>
          </article>

          <aside class="marketing-card marketing-download-consult mt-6 p-6 sm:p-8 lg:mt-0">
            <h2 class="text-2xl font-bold tracking-tight text-[color:var(--ink-strong)]">需要企业部署？</h2>
            <p class="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">如果你需要本地优先部署、虾壳主机交付或上线前评估，可直接发起部署评估。</p>
            <a class="marketing-primary-button mt-5" href="/contact">申请部署评估</a>
          </aside>
        </div>
      </section>

      <section class="marketing-section py-6 sm:py-10">
        <div class="marketing-section-inner marketing-grid-2 grid gap-5 lg:grid-cols-2">
          {secondary.map((card) => (
            <article key={card.id} class="marketing-card p-5 sm:p-6">
              <h3 class="text-lg font-semibold text-[color:var(--ink-strong)]">{card.label}</h3>
              <p class="mt-3 text-sm text-[color:var(--ink-soft)]">{`版本：${card.version}`}</p>
              <p class="mt-1 text-sm text-[color:var(--ink-soft)]">{`发布时间：${card.publishedAt}`}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function buildDownloadCards(input: {
  stableVersion: string | null;
  stablePublishedAt: string | null;
  hasStableInstaller: boolean;
  betaVersion: string | null;
  betaPublishedAt: string | null;
  hasBetaInstaller: boolean;
  alphaVersion: string | null;
  alphaPublishedAt: string | null;
  hasAlphaInstaller: boolean;
}): DownloadChannelCard[] {
  return [
    {
      id: "stable",
      label: "稳定版",
      badgeClass: "badge-neutral",
      version: input.stableVersion?.trim() || "dev",
      publishedAt: formatPublishedAt(input.stablePublishedAt),
      hasInstaller: input.hasStableInstaller,
      windowsUrl: "/downloads/latest/windows",
      macosUrl: "/downloads/latest/macos",
      linuxUrl: "/downloads/latest/linux",
    },
    {
      id: "beta",
      label: "测试版",
      badgeClass: "badge-warning",
      version: input.betaVersion?.trim() || "dev",
      publishedAt: formatPublishedAt(input.betaPublishedAt),
      hasInstaller: input.hasBetaInstaller,
      windowsUrl: "/downloads/beta/windows",
      macosUrl: "/downloads/beta/macos",
      linuxUrl: "/downloads/beta/linux",
    },
    {
      id: "alpha",
      label: "内测版",
      badgeClass: "badge-info",
      version: input.alphaVersion?.trim() || "dev",
      publishedAt: formatPublishedAt(input.alphaPublishedAt),
      hasInstaller: input.hasAlphaInstaller,
      windowsUrl: "/downloads/alpha/windows",
      macosUrl: "/downloads/alpha/macos",
      linuxUrl: "/downloads/alpha/linux",
    },
  ];
}
