/** @jsxImportSource hono/jsx */

import { getBrandConfig } from "../lib/branding";
import { renderMarketingShell } from "./marketing-shell";

interface DownloadItemCard {
  id: string;
  name: string;
  description: string;
  version: string;
  fileCount: number;
  firstFile: { name: string; size: number; sha256: string } | null;
  downloadUrl: string | null;
  updatedAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function DownloadItemRow({ item }: { item: DownloadItemCard }) {
  return (
    <div class="marketing-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="text-base font-semibold text-[color:var(--ink-strong)]">{item.name}</h3>
          <span class="badge badge-outline text-xs">{item.version}</span>
          {item.fileCount > 1 ? (
            <span class="badge badge-ghost text-xs">{item.fileCount} 个文件</span>
          ) : null}
        </div>
        <p class="mt-1 text-sm text-[color:var(--ink-soft)] line-clamp-2">
          {item.description || "暂无描述"}
        </p>
        <p class="mt-1 text-xs text-base-content/40">
          更新于 {formatDate(item.updatedAt)}
          {item.firstFile ? ` · ${formatSize(item.firstFile.size)}` : ""}
        </p>
      </div>
      <div class="flex gap-2 shrink-0">
        {item.downloadUrl ? (
          <a class="btn btn-primary btn-sm" href={item.downloadUrl}>
            下载
          </a>
        ) : (
          <span class="btn btn-disabled btn-sm">无可用文件</span>
        )}
      </div>
    </div>
  );
}

function DownloadsGrid({ items, brandName }: { items: DownloadItemCard[]; brandName: string }) {
  if (items.length === 0) {
    return (
      <div class="text-center py-16 text-base-content/40">
        暂无下载项
      </div>
    );
  }
  return (
    <div class="space-y-3">
      {items.map((item) => (
        <DownloadItemRow key={item.id} item={item} />
      ))}
    </div>
  );
}

export function renderDownloadsPage(items: DownloadItemCard[]): string {
  const { brandName } = getBrandConfig();
  return renderMarketingShell({
    title: "下载中心",
    description: `下载 ${brandName} 相关软件与安装包。`,
    currentPath: "/downloads",
    children: <DownloadsGrid items={items} brandName={brandName} />,
  });
}
