/** @jsxImportSource hono/jsx */

import type { SiteSettings } from "../../lib/types";

export function renderSettingsSection(settings: SiteSettings) {
  return (
    <section id="settings" class="card mb-6 bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">Logo / 品牌 / SEO 管理</h2>
        <form method="post" action="/admin/settings/save" class="grid gap-3 md:grid-cols-2">
          <input class="input input-bordered" name="brandName" value={settings.brandName} />
          <input class="input input-bordered" name="siteName" value={settings.siteName} />
          <input id="brand-logo-url" class="input input-bordered md:col-span-2" name="brandLogoUrl" value={settings.brandLogoUrl} />
          <input class="input input-bordered md:col-span-2" name="seoTitle" value={settings.seoTitle} />
          <textarea class="textarea textarea-bordered md:col-span-2" name="seoDescription">{settings.seoDescription}</textarea>
          <input class="input input-bordered md:col-span-2" name="seoKeywords" value={settings.seoKeywords} />
          <button class="btn btn-primary md:col-span-2" type="submit">保存设置</button>
        </form>
      </div>
    </section>
  );
}
