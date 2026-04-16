/** @jsxImportSource hono/jsx */

import type { SiteSettings } from "../../lib/types";

export function renderSettingsSection(settings: SiteSettings) {
  return (
    <section id="settings" class="card mb-6 bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">Logo / 品牌 / SEO 管理</h2>
        <form method="post" action="/admin/settings/save" class="mt-4 space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">品牌名</span>
              </label>
              <input class="input input-bordered w-full" name="brandName" value={settings.brandName} />
            </div>
            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">站点名</span>
              </label>
              <input class="input input-bordered w-full" name="siteName" value={settings.siteName} />
            </div>
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">品牌链接</span>
            </label>
            <input class="input input-bordered w-full" name="brandUrl" value={settings.brandUrl} placeholder="https://example.com" />
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Logo 图片地址</span>
            </label>
            <input
              id="brand-logo-url"
              class="input input-bordered w-full"
              name="brandLogoUrl"
              value={settings.brandLogoUrl}
              placeholder="选择文件后自动上传并回填地址"
              readonly
            />
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Logo 图片上传</span>
            </label>
            <input id="logo-upload-file" class="file-input file-input-bordered w-full" type="file" accept="image/*" />
            <p id="logo-upload-status" class="text-xs text-base-content/60 mt-1">选择图片后自动上传</p>
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">首页 Banner 地址</span>
            </label>
            <input
              id="hero-banner-url"
              class="input input-bordered w-full"
              name="heroBannerUrl"
              value={settings.heroBannerUrl}
              placeholder="Banner 图片或视频 URL（外链或上传后自动填充）"
            />
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">首页 Banner 图片上传</span>
            </label>
            <input id="hero-banner-file" class="file-input file-input-bordered w-full" type="file" accept="image/*,video/*" />
            <p id="hero-banner-upload-status" class="text-xs text-base-content/60 mt-1">选择图片后自动上传</p>
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">SEO 标题</span>
            </label>
            <input class="input input-bordered w-full" name="seoTitle" value={settings.seoTitle} />
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">SEO 描述</span>
            </label>
            <textarea class="textarea textarea-bordered w-full" name="seoDescription">{settings.seoDescription}</textarea>
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">SEO 关键词</span>
            </label>
            <input class="input input-bordered w-full" name="seoKeywords" value={settings.seoKeywords} />
          </div>

          <button class="btn btn-primary w-full" type="submit">保存设置</button>
        </form>
      </div>
    </section>
  );
}