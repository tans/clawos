/** @jsxImportSource hono/jsx */

import type { AdminInstallerHistoryItem, LatestRelease } from "../../lib/types";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function renderHistoryItem(item: AdminInstallerHistoryItem, index: number) {
  return (
    <details class="collapse-arrow collapse rounded-box border border-base-300 bg-base-100" open={index === 0}>
      <summary class="collapse-title pr-8 text-sm font-medium">
        {item.fileName}
      </summary>
      <div class="collapse-content text-xs text-base-content/70">
        <p>平台：{item.platform}</p>
        <p>文件大小：{formatBytes(item.size)}</p>
        <p>上传时间：{item.uploadedAt}</p>
        <p>版本识别：{item.versionHint || "未识别"}</p>
        <p>存储路径：{item.relativePath}</p>
      </div>
    </details>
  );
}

export function renderVersionsSection(releases: {
  latest: LatestRelease | null;
  history: AdminInstallerHistoryItem[];
}) {
  return (
    <section id="versions" class="mb-6 grid gap-4">
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h3 class="card-title text-base">软件管理</h3>
          <p class="text-xs text-base-content/60">当前版本：{releases.latest?.version || "dev"}</p>
          <form method="post" action="/admin/releases/save" class="mt-2 space-y-2">
            <input class="input input-bordered input-sm w-full" name="version" placeholder="例如 1.2.3" required />
            <textarea
              class="textarea textarea-bordered textarea-sm w-full"
              name="changelog"
              placeholder="更新日志（支持多行）"
            >
              {releases.latest?.changelog || ""}
            </textarea>
            <input
              id="release-stable-thumbnail-url"
              class="input input-bordered input-sm w-full"
              name="thumbnailUrl"
              placeholder="缩略图地址（选择文件自动上传）"
              value={releases.latest?.thumbnailUrl || ""}
              readonly
            />
            <input
              id="release-stable-thumbnail-file"
              class="file-input file-input-bordered file-input-sm w-full"
              type="file"
              accept="image/*"
              onchange="uploadAdminImage('release-stable-thumbnail-file','release-stable-thumbnail-url','logo','release-stable-thumbnail-status')"
            />
            <p id="release-stable-thumbnail-status" class="text-xs text-base-content/60">缩略图未上传</p>
            <input
              id="release-stable-installer-file"
              class="file-input file-input-bordered file-input-sm w-full"
              type="file"
              accept=".zip,.exe,.msi,.dmg,.pkg,.deb,.rpm,.appimage,.tar.gz"
              onchange="uploadReleaseInstaller('release-stable-installer-file','release-stable-version-status')"
            />
            <p id="release-stable-version-status" class="text-xs text-base-content/60">安装包未上传</p>
            <button class="btn btn-primary btn-sm w-full" type="submit">新建并发布</button>
          </form>
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h3 class="card-title text-base">历史上传</h3>
          <p class="text-xs text-base-content/60">点击每一项可显示/隐藏详情</p>
          <div class="mt-2 grid gap-2">
            {releases.history.length ? releases.history.map((item, index) => renderHistoryItem(item, index)) : (
              <p class="text-sm text-base-content/60">暂无历史上传记录</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
