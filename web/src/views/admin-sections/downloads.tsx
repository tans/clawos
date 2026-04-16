/** @jsxImportSource hono/jsx */

import type { DownloadItem } from "../../lib/types";

export function renderDownloadsSection(items: DownloadItem[]) {
  return (
    <section id="downloads" class="card bg-base-100 shadow">
      <div class="card-body">
        <div class="flex items-center justify-between mb-4">
          <h2 class="card-title">下载管理</h2>
          <button class="btn btn-primary btn-sm" type="button" onClick="openCreateDownloadModal()">
            新建下载项
          </button>
        </div>

        {items.length === 0 ? (
          <div class="text-center py-12 text-base-content/40">
            <p>暂无下载项</p>
            <p class="text-sm mt-2">点击上方按钮创建第一个下载项</p>
          </div>
        ) : (
          <div class="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} class="border border-base-300 rounded-xl p-4 hover:shadow-md transition-shadow" data-item-id={item.id}>
                <div class="flex items-start gap-4">
                  {/* Logo */}
                  <div class="flex-shrink-0">
                    {item.logo ? (
                      <img
                        src={item.logo}
                        alt={item.name}
                        class="w-16 h-16 rounded-lg object-cover border border-base-300"
                        onError="this.src='/public/logo.png'"
                      />
                    ) : (
                      <div class="w-16 h-16 rounded-lg bg-base-200 flex items-center justify-center border border-base-300">
                        <span class="text-2xl">📦</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="font-semibold text-lg">{item.name}</h3>
                      {item.version && (
                        <span class="badge badge-outline badge-sm">{item.version}</span>
                      )}
                      {item.published ? (
                        <span class="badge badge-success badge-sm">已发布</span>
                      ) : (
                        <span class="badge badge-ghost badge-sm">草稿</span>
                      )}
                    </div>
                    <p class="text-sm text-base-content/60 mt-1 line-clamp-1">
                      {item.description || "暂无描述"}
                    </p>
                    <div class="flex items-center gap-4 mt-2 text-xs text-base-content/50">
                      <span>排序: {item.sortOrder}</span>
                      <span>文件: {item.files.length} 个</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div class="flex flex-wrap gap-1 flex-shrink-0">
                    <button
                      class="btn btn-xs btn-outline"
                      type="button"
                      onClick={`openEditDownloadModal('${item.id}')`}
                    >
                      编辑
                    </button>
                    <button
                      class="btn btn-xs btn-outline"
                      type="button"
                      onClick={`openUploadFileModal('${item.id}')`}
                    >
                      上传文件
                    </button>
                    <form method="post" action="/admin/downloads/delete" class="inline">
                      <input type="hidden" name="id" value={item.id} />
                      <button class="btn btn-xs btn-error" type="submit" onClick="return confirm('确认删除?')">
                        删除
                      </button>
                    </form>
                  </div>
                </div>

                {/* Files list */}
                {item.files.length > 0 && (
                  <div class="mt-3 pl-20">
                    <div class="flex flex-wrap gap-2">
                      {item.files.map((file) => (
                        <div key={file.name} class="badge badge-ghost gap-1 py-3 px-3">
                          <span class="truncate max-w-32">{file.name}</span>
                          <span class="text-[10px] opacity-60">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <dialog id="download-modal" class="modal">
        <div class="modal-box max-w-2xl">
          <h3 class="font-bold text-lg" id="download-modal-title">新建下载项</h3>
          <form method="post" action="/admin/downloads/save" class="mt-4 space-y-4">
            <div class="grid gap-4 md:grid-cols-2">
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">唯一 ID *</span>
                </label>
                <input id="download-id" name="id" class="input input-bordered w-full" placeholder="如 git-install" required />
              </div>
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">显示名称 *</span>
                </label>
                <input id="download-name" name="name" class="input input-bordered w-full" placeholder="如 Git for Windows" required />
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">版本号</span>
                </label>
                <input id="download-version" name="version" class="input input-bordered w-full" placeholder="如 2.45.0" />
              </div>
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">排序（数字越小越靠前）</span>
                </label>
                <input id="download-sort-order" name="sortOrder" type="number" class="input input-bordered w-full" placeholder="0" defaultValue="0" />
              </div>
            </div>

            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">简介</span>
              </label>
              <textarea
                id="download-description"
                name="description"
                class="textarea textarea-bordered w-full"
                placeholder="描述（可选）"
                rows={2}
              />
            </div>

            {/* Logo */}
            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">Logo</span>
              </label>
              <div class="flex items-center gap-3">
                <input
                  id="download-logo-url"
                  name="logo"
                  class="input input-bordered flex-1"
                  placeholder="Logo URL（外链或上传后自动填充）"
                />
                <label class="btn btn-outline btn-sm cursor-pointer">
                  <span>上传</span>
                  <input
                    id="download-logo-file"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    onChange="uploadDownloadLogo(this)"
                  />
                </label>
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  onClick="fetchDownloadLogo()"
                >
                  抓取
                </button>
              </div>
              <div id="download-logo-status" class="text-xs mt-1 text-base-content/50"></div>
              <img
                id="download-logo-preview"
                src=""
                alt="Logo 预览"
                class="hidden w-20 h-20 rounded-lg object-cover border border-base-300 mt-2"
              />
            </div>

            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-3">
                <input id="download-published" name="published" type="checkbox" class="checkbox" value="true" />
                <span class="label-text">发布到前台</span>
              </label>
            </div>

            <input type="hidden" name="originalId" id="download-original-id" value="" />
            <button class="btn btn-primary" type="submit">保存</button>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop"><button type="submit">close</button></form>
      </dialog>

      {/* Upload File Modal */}
      <dialog id="upload-file-modal" class="modal">
        <div class="modal-box">
          <h3 class="font-bold text-lg" id="upload-file-modal-title">上传文件</h3>
          <form method="post" action="/admin/downloads/upload-file" encType="multipart/form-data" class="mt-4 space-y-3">
            <input type="hidden" name="itemId" id="upload-file-item-id" value="" />
            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">选择文件</span>
              </label>
              <input name="file" type="file" class="file-input file-input-bordered w-full" required />
            </div>
            <div id="upload-file-name" class="text-sm text-base-content/60"></div>
            <button class="btn btn-primary w-full" type="submit">上传</button>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop"><button type="submit">close</button></form>
      </dialog>
    </section>
  );
}