/** @jsxImportSource hono/jsx */

import type { DownloadItem } from "../lib/types";
import { getBrandConfig } from "../lib/branding";
import { renderMarketingShell } from "./marketing-shell";

function getFileDownloadUrl(item: DownloadItem, fileName: string): string {
  return `/downloads/${item.id}/${encodeURIComponent(fileName)}`;
}

function getPlatformFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes("windows") || lower.includes("win")) return "Windows";
  if (lower.includes("macos") || lower.includes("darwin") || lower.includes("mac")) return "macOS";
  if (lower.includes("linux") || lower.includes("ubuntu") || lower.includes("centos")) return "Linux";
  return "Other";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DownloadsPage({ items }: { items: DownloadItem[] }) {
  const { brandName } = getBrandConfig();

  if (items.length === 0) {
    return (
      <section class="marketing-section py-10 sm:py-14">
        <div class="marketing-section-inner">
          <div class="marketing-card marketing-page-hero p-6 sm:p-8 text-center">
            <p class="marketing-kicker">Downloads</p>
            <h1 class="marketing-h2 mt-2">下载中心</h1>
            <p class="marketing-lead mt-4">暂无下载内容</p>
            <p class="text-base text-[color:var(--ink-soft)] mt-2">
              请在管理后台添加下载项
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section class="marketing-section py-10 sm:py-14">
        <div class="marketing-section-inner">
          <div class="marketing-card marketing-page-hero p-6 sm:p-8">
            <p class="marketing-kicker">Downloads</p>
            <h1 class="marketing-h2 mt-2">下载中心</h1>
            <p class="marketing-lead mt-4">
              找到你需要的工具和软件，快速开始使用 {brandName}。
            </p>
          </div>
        </div>
      </section>

      <section class="marketing-section py-6 sm:py-8">
        <div class="marketing-section-inner">
          <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} class="marketing-card rounded-2xl overflow-hidden hover:shadow-warm-lg transition-all duration-300">
                {/* Logo */}
                <div class="aspect-[3/1] bg-[color:var(--color-surface-muted)] flex items-center justify-center p-6">
                  {item.logo ? (
                    <img
                      src={item.logo}
                      alt={item.name}
                      class="max-h-16 max-w-full object-contain"
                      onError="this.style.display='none'"
                    />
                  ) : (
                    <div class="text-4xl font-display text-[color:var(--ink-faint)]">
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div class="p-6">
                  <div class="flex items-center gap-2 flex-wrap mb-2">
                    <h3 class="text-xl font-semibold text-[color:var(--ink-strong)]">{item.name}</h3>
                    {item.version && (
                      <span class="badge badge-outline badge-sm">{item.version}</span>
                    )}
                  </div>

                  {item.description && (
                    <p class="text-sm text-[color:var(--ink-soft)] line-clamp-2 mb-4">
                      {item.description}
                    </p>
                  )}

                  {/* Files */}
                  {item.files.length > 0 ? (
                    <div class="space-y-2">
                      {item.files.slice(0, 4).map((file) => {
                        const platform = getPlatformFromFileName(file.name);
                        return (
                          <a
                            key={file.name}
                            href={getFileDownloadUrl(item, file.name)}
                            class="flex items-center justify-between gap-3 p-3 rounded-xl bg-[color:var(--color-surface-muted)] hover:bg-[color:var(--color-accent-subtle)] transition-colors group"
                          >
                            <div class="flex items-center gap-3 min-w-0">
                              <span class="text-lg">📦</span>
                              <div class="min-w-0">
                                <p class="text-sm font-medium text-[color:var(--ink-strong)] truncate">{platform}</p>
                                <p class="text-xs text-[color:var(--ink-faint)] truncate">{file.name}</p>
                              </div>
                            </div>
                            <div class="flex items-center gap-2 flex-shrink-0">
                              <span class="text-xs text-[color:var(--ink-faint)]">{formatFileSize(file.size)}</span>
                              <span class="text-[color:var(--ink-faint)] group-hover:text-[color:var(--color-accent)] transition-colors">↓</span>
                            </div>
                          </a>
                        );
                      })}
                      {item.files.length > 4 && (
                        <p class="text-xs text-center text-[color:var(--ink-faint)] pt-2">
                          还有 {item.files.length - 4} 个文件
                        </p>
                      )}
                    </div>
                  ) : (
                    <p class="text-sm text-[color:var(--ink-faint)] text-center py-4">暂无下载文件</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section class="marketing-section py-6">
        <div class="marketing-section-inner">
          <aside class="marketing-card rounded-2xl p-8 text-center">
            <h2 class="text-2xl font-semibold text-[color:var(--ink-strong)] mb-3">需要企业部署？</h2>
            <p class="marketing-lead mb-6 max-w-xl mx-auto">
              虾壳主机预装 OpenClaw，到手即用，快速部署企业 AI 能力。
            </p>
            <a class="marketing-primary-button" href="/shop">购买主机</a>
          </aside>
        </div>
      </section>
    </>
  );
}

export function renderDownloadsPage(items: DownloadItem[]): string {
  const { brandName } = getBrandConfig();
  return renderMarketingShell({
    title: "下载中心",
    description: `${brandName} 下载中心 - 提供各类工具和软件安装包。`,
    currentPath: "/downloads",
    children: <DownloadsPage items={items} />,
  });
}
