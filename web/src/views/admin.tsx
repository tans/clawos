/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";
import { renderDownloadsSection } from "./admin-sections/downloads";
import { renderProductsSection } from "./admin-sections/products";
import { renderSettingsSection } from "./admin-sections/settings";
import type { AdminPageProps, AdminSection } from "./admin-sections/types";
import { renderTasksSection } from "./admin-sections/tasks";

function LoginPage({ error }: { error?: string }) {
  const { brandName, siteName, brandLogoUrl, seoDescription, seoKeywords } = getBrandConfig();
  const pageTitle = `${siteName} 管理后台登录`;
  return (
    <html lang="zh-CN" data-theme="winter">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{pageTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta name="keywords" content={seoKeywords} />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="icon" type="image/png" href={brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen bg-base-200">
        <main class="mx-auto flex min-h-screen max-w-md items-center px-4">
          <section class="card w-full bg-base-100 shadow-xl">
            <div class="card-body">
              <div class="mb-2 flex items-center gap-3">
                <img src={brandLogoUrl} alt={`${brandName} logo`} class="h-9 w-9 rounded-lg object-cover" />
                <div>
                  <h1 class="card-title">{`${brandName} 后台登录`}</h1>
                  <p class="text-xs text-base-content/60">{siteName}</p>
                </div>
              </div>
              {error ? <p class="text-sm text-error">{error}</p> : null}
              <form class="space-y-4" method="post" action="/admin/login">
                <label class="form-control">
                  <span class="label-text">账号</span>
                  <input class="input input-bordered" type="text" name="username" required />
                </label>
                <label class="form-control">
                  <span class="label-text">密码</span>
                  <input class="input input-bordered" type="password" name="password" required />
                </label>
                <button class="btn btn-primary w-full" type="submit">登录</button>
              </form>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}

function sectionHref(section: AdminSection): string {
  return section === "settings" ? "/admin" : `/admin/${section}`;
}

function renderActiveSection(props: AdminPageProps) {
  if (props.activeSection === "settings") return renderSettingsSection(props.settings);
  if (props.activeSection === "downloads") return renderDownloadsSection(props.downloads);
  if (props.activeSection === "products") return renderProductsSection(props.products);
  return renderTasksSection(props.tasks);
}

function AdminPage(props: AdminPageProps) {
  const pageTitle = `${props.settings.siteName} 管理后台`;
  return (
    <html lang="zh-CN" data-theme="winter">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{pageTitle}</title>
        <meta name="description" content={props.settings.seoDescription} />
        <meta name="keywords" content={props.settings.seoKeywords} />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="icon" type="image/png" href={props.settings.brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="bg-base-200">
        <div class="drawer lg:drawer-open">
          <input id="admin-sidebar" type="checkbox" class="drawer-toggle" />
          <div class="drawer-content p-4 lg:p-8">
            <div class="navbar mb-4 rounded-box bg-base-100 shadow">
              <div class="flex-1">
                <label htmlFor="admin-sidebar" class="btn btn-ghost btn-square lg:hidden">☰</label>
                <div class="ml-2 flex items-center gap-3">
                  <img src={props.settings.brandLogoUrl} alt={`${props.settings.brandName} logo`} class="h-9 w-9 rounded-lg object-cover" />
                  <div>
                    <h1 class="text-lg font-semibold">{props.settings.brandName} 后台</h1>
                    <p class="text-xs text-base-content/60">{props.settings.siteName}</p>
                  </div>
                </div>
              </div>
              <form method="post" action="/admin/logout">
                <button class="btn btn-outline btn-sm" type="submit">退出登录</button>
              </form>
            </div>
            {props.notice ? <div class="alert alert-success mb-4 text-sm">{props.notice}</div> : null}
            {renderActiveSection(props)}
          </div>
          <div class="drawer-side">
            <label htmlFor="admin-sidebar" class="drawer-overlay" />
            <aside class="min-h-full w-64 bg-base-100 p-4">
              <ul class="menu gap-1 text-sm">
                <li class="menu-title"><span>后台导航</span></li>
                <li>
                  <a href={sectionHref("settings")} class={props.activeSection === "settings" ? "active" : ""}>
                    品牌与 SEO
                  </a>
                </li>
                <li>
                  <a href={sectionHref("downloads")} class={props.activeSection === "downloads" ? "active" : ""}>
                    下载项管理
                  </a>
                </li>
                <li>
                  <a href={sectionHref("products")} class={props.activeSection === "products" ? "active" : ""}>
                    商品管理
                  </a>
                </li>
                <li>
                  <a href={sectionHref("tasks")} class={props.activeSection === "tasks" ? "active" : ""}>
                    任务管理
                  </a>
                </li>
              </ul>
            </aside>
          </div>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
          async function uploadAdminImage(fileInputId, urlInputId, kind, statusId) {
            const fileInput = document.getElementById(fileInputId);
            const urlInput = document.getElementById(urlInputId);
            const status = statusId ? document.getElementById(statusId) : null;
            if (!(fileInput instanceof HTMLInputElement)) { if (status) status.textContent = '控件不可用'; return; }
            const file = fileInput?.files?.[0];
            if (!file) { if (status) status.textContent = '请先选择文件'; return; }
            if (status) status.textContent = '上传中...';
            const formData = new FormData();
            formData.append('file', file);
            formData.set('kind', kind);
            const response = await fetch('/admin/upload/image', { method: 'POST', body: formData });
            const payload = await response.json();
            if (!response.ok || !payload.ok) { if (status) status.textContent = payload.error || '上传失败'; return; }
            urlInput.value = payload.url;
            if (status) status.textContent = '上传成功';
          }
          function bindAutoUpload(fileInputId, urlInputId, kind, statusId) {
            const fileInput = document.getElementById(fileInputId);
            if (!fileInput) return;
            fileInput.addEventListener('change', () => uploadAdminImage(fileInputId, urlInputId, kind, statusId));
          }

          // Product modal
          const productModal = document.getElementById('product-modal');
          function openCreateProductModal() {
            document.getElementById('product-modal-title').textContent = '新增商品';
            ['product-id','product-name','product-description','product-image-url','product-price','product-link'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            document.getElementById('product-published') && (document.getElementById('product-published').checked = false);
            if (productModal) productModal.showModal();
          }
          function openEditProductModal(product) {
            document.getElementById('product-modal-title').textContent = '编辑商品';
            ['product-id','product-name','product-description','product-image-url','product-price','product-link'].forEach(id => { const el = document.getElementById(id); if (el) el.value = (product[id.replace('product-','')] || ''); });
            document.getElementById('product-published') && (document.getElementById('product-published').checked = Boolean(product.published));
            if (productModal) productModal.showModal();
          }
          function openEditProductModalFromEncoded(encoded) {
            if (!encoded) return;
            try { openEditProductModal(JSON.parse(decodeURIComponent(encoded))); } catch(e) { console.error(e); }
          }

          // Download item modal
          const downloadModal = document.getElementById('download-modal');
          function openCreateDownloadModal() {
            document.getElementById('download-modal-title').textContent = '新建下载项';
            ['download-id','download-name','download-version','download-description','download-original-id'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            document.getElementById('download-sort-order') && (document.getElementById('download-sort-order').value = '0');
            document.getElementById('download-published') && (document.getElementById('download-published').checked = false);
            if (downloadModal) downloadModal.showModal();
          }
          function openEditDownloadModal(item) {
            document.getElementById('download-modal-title').textContent = '编辑下载项';
            document.getElementById('download-original-id').value = item.id || '';
            document.getElementById('download-id').value = item.id || '';
            document.getElementById('download-name').value = item.name || '';
            document.getElementById('download-version').value = item.version || '';
            document.getElementById('download-description').value = item.description || '';
            document.getElementById('download-sort-order').value = String(item.sortOrder || 0);
            document.getElementById('download-published').checked = Boolean(item.published);
            if (downloadModal) downloadModal.showModal();
          }
          function openEditDownloadModalFromEncoded(encoded) {
            if (!encoded) return;
            try { openEditDownloadModal(JSON.parse(decodeURIComponent(encoded))); } catch(e) { console.error(e); }
          }

          // Upload file modal
          const uploadFileModal = document.getElementById('upload-file-modal');
          function openUploadFileModal(encodedItem) {
            if (!encodedItem) return;
            try {
              const item = JSON.parse(decodeURIComponent(encodedItem));
              document.getElementById('upload-file-item-id').value = item.id;
              document.getElementById('upload-file-modal-title').textContent = '上传文件到：' + (item.name || item.id);
              if (uploadFileModal) uploadFileModal.showModal();
            } catch(e) { console.error(e); }
          }

          bindAutoUpload('logo-upload-file', 'brand-logo-url', 'logo', 'logo-upload-status');
          bindAutoUpload('product-image-file', 'product-image-url', 'product', 'product-image-upload-status');
          bindAutoUpload('task-image-file', 'task-image-url', 'task', 'task-image-upload-status');
        `,
          }}
        />
      </body>
    </html>
  );
}

export function renderAdminLoginPage(error?: string): string {
  return `<!doctype html>${renderToString(<LoginPage error={error} />)}`;
}

export function renderAdminPage(props: AdminPageProps): string {
  return `<!doctype html>${renderToString(<AdminPage {...props} />)}`;
}
