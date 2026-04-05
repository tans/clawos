/** @jsxImportSource hono/jsx */

import type { DownloadItem } from "../../lib/types";

export function renderDownloadsSection(items: DownloadItem[]) {
  return (
    <section id="downloads" class="card mb-6 bg-base-100 shadow">
      <div class="card-body">
        <div class="flex items-center justify-between mb-4">
          <h2 class="card-title">下载项管理</h2>
          <button class="btn btn-primary btn-sm" type="button" onClick="openCreateDownloadModal()">
            新建下载项
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra text-sm">
            <thead>
              <tr>
                <th>排序</th>
                <th>名称 / ID</th>
                <th>版本</th>
                <th>文件</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} class="text-center text-base-content/40 py-8">暂无下载项</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} data-item={encodeURIComponent(JSON.stringify(item))}>
                  <td class="w-16">
                    <span class="badge badge-ghost">{item.sortOrder}</span>
                  </td>
                  <td>
                    <div class="font-medium">{item.name}</div>
                    <div class="text-xs text-base-content/40">{item.id}</div>
                    <div class="text-xs text-base-content/50 mt-1 line-clamp-1">{item.description}</div>
                  </td>
                  <td><span class="badge badge-outline">{item.version || "-"}</span></td>
                  <td>
                    {item.files.length === 0 ? (
                      <span class="text-base-content/40 text-xs">无文件</span>
                    ) : (
                      <div class="flex flex-wrap gap-1">
                        {item.files.slice(0, 3).map((f) => (
                          <span key={f.name} class="badge badge-ghost badge-sm text-xs">{f.name}</span>
                        ))}
                        {item.files.length > 3 ? (
                          <span class="badge badge-ghost badge-sm text-xs">+{item.files.length - 3}</span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td>
                    {item.published ? (
                      <span class="badge badge-success badge-sm">已发布</span>
                    ) : (
                      <span class="badge badge-ghost badge-sm">草稿</span>
                    )}
                  </td>
                  <td>
                    <div class="flex gap-1 flex-wrap">
                      <button
                        class="btn btn-xs btn-outline"
                        type="button"
                        onClick="openEditDownloadModalFromEncoded(this.closest('tr').dataset.item)"
                      >
                        编辑
                      </button>
                      <button
                        class="btn btn-xs btn-outline"
                        type="button"
                        onClick="openUploadFileModal(this.closest('tr').dataset.item)"
                      >
                        上传文件
                      </button>
                      <form method="post" action="/admin/downloads/delete" class="inline">
                        <input type="hidden" name="id" value={item.id} />
                        <button class="btn btn-xs btn-error" type="submit">删除</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="text-xs text-base-content/40 mt-2">拖拽排序功能开发中，当前通过编辑设置 sortOrder 值来排序。</p>
      </div>

      {/* Create / Edit Modal */}
      <dialog id="download-modal" class="modal">
        <div class="modal-box max-w-2xl">
          <h3 class="font-bold text-lg" id="download-modal-title">新建下载项</h3>
          <form method="post" action="/admin/downloads/save" class="mt-4 grid gap-3 md:grid-cols-2">
            <input id="download-id" name="id" class="input input-bordered w-full" placeholder="唯一 ID (如 git-install)" required />
            <input id="download-name" name="name" class="input input-bordered w-full" placeholder="显示名称 (如 Git for Windows)" required />
            <input id="download-version" name="version" class="input input-bordered w-full" placeholder="版本号 (如 2.45.0)" />
            <input id="download-sort-order" name="sortOrder" type="number" class="input input-bordered w-full" placeholder="排序 (数字越小越靠前)" defaultValue="0" />
            <textarea
              id="download-description"
              name="description"
              class="textarea textarea-bordered w-full md:col-span-2"
              placeholder="描述（可选）"
              rows={2}
            />
            <label class="label cursor-pointer justify-start gap-3 md:col-span-2">
              <input id="download-published" name="published" type="checkbox" class="checkbox" value="true" />
              <span class="label-text">发布到前台</span>
            </label>
            <input type="hidden" name="originalId" id="download-original-id" value="" />
            <button class="btn btn-primary md:col-span-2" type="submit">保存</button>
          </form>
          <div class="modal-action">
            <form method="dialog"><button class="btn" type="submit">关闭</button></form>
          </div>
        </div>
      </dialog>

      {/* Upload File Modal */}
      <dialog id="upload-file-modal" class="modal">
        <div class="modal-box">
          <h3 class="font-bold text-lg" id="upload-file-modal-title">上传文件</h3>
          <form method="post" action="/admin/downloads/upload-file" encType="multipart/form-data" class="mt-4 space-y-3">
            <input type="hidden" name="itemId" id="upload-file-item-id" value="" />
            <div>
              <label class="label"><span class="label-text">选择文件</span></label>
              <input name="file" type="file" class="file-input file-input-bordered w-full" required />
            </div>
            <button class="btn btn-primary w-full" type="submit">上传</button>
          </form>
          <div class="modal-action">
            <form method="dialog"><button class="btn" type="submit">关闭</button></form>
          </div>
        </div>
      </dialog>
    </section>
  );
}
