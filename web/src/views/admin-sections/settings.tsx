/** @jsxImportSource hono/jsx */

import type { SiteSettings } from "../../lib/types";

export function renderSettingsSection(settings: SiteSettings) {
  return (
    <section id="settings" class="card mb-6 bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">Logo / 品牌 / SEO 管理</h2>
        <form method="post" action="/admin/settings/save" class="grid gap-3 md:grid-cols-2">
          <label class="form-control">
            <span class="label-text">品牌名</span>
            <input class="input input-bordered" name="brandName" value={settings.brandName} />
          </label>
          <label class="form-control">
            <span class="label-text">站点名</span>
            <input class="input input-bordered" name="siteName" value={settings.siteName} />
          </label>
          <label class="form-control md:col-span-2">
            <span class="label-text">品牌链接</span>
            <input class="input input-bordered" name="brandUrl" value={settings.brandUrl} placeholder="https://example.com" />
          </label>
          <label class="form-control md:col-span-2">
            <span class="label-text">Logo 图片地址</span>
            <input id="brand-logo-url" class="input input-bordered" name="brandLogoUrl" value={settings.brandLogoUrl} />
          </label>
          <label class="form-control md:col-span-2">
            <span class="label-text">SEO 标题</span>
            <input class="input input-bordered" name="seoTitle" value={settings.seoTitle} />
          </label>
          <label class="form-control md:col-span-2">
            <span class="label-text">SEO 描述</span>
            <textarea class="textarea textarea-bordered" name="seoDescription">{settings.seoDescription}</textarea>
          </label>
          <label class="form-control md:col-span-2">
            <span class="label-text">SEO 关键词</span>
            <input class="input input-bordered" name="seoKeywords" value={settings.seoKeywords} />
          </label>
          <button class="btn btn-primary md:col-span-2" type="submit">保存设置</button>
        </form>
      </div>
    </section>
  );
}
