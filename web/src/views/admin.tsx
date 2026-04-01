/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";
import { renderProductsSection } from "./admin-sections/products";
import { renderSettingsSection } from "./admin-sections/settings";
import { renderTasksSection } from "./admin-sections/tasks";
import type { AdminPageProps, AdminSection } from "./admin-sections/types";
import { renderVersionsSection } from "./admin-sections/versions";

function LoginPage({ error }: { error?: string }) {
  const { brandName, siteName, brandLogoUrl, seoDescription, seoKeywords } =
    getBrandConfig();
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
                <img
                  src={brandLogoUrl}
                  alt={`${brandName} logo`}
                  class="h-9 w-9 rounded-lg object-cover"
                />
                <div>
                  <h1 class="card-title">{`${brandName} 后台登录`}</h1>
                  <p class="text-xs text-base-content/60">{siteName}</p>
                </div>
              </div>
              {error ? <p class="text-sm text-error">{error}</p> : null}
              <form class="space-y-4" method="post" action="/admin/login">
                <label class="form-control">
                  <span class="label-text">账号</span>
                  <input
                    class="input input-bordered"
                    type="text"
                    name="username"
                    required
                  />
                </label>
                <label class="form-control">
                  <span class="label-text">密码</span>
                  <input
                    class="input input-bordered"
                    type="password"
                    name="password"
                    required
                  />
                </label>
                <button class="btn btn-primary w-full" type="submit">
                  登录
                </button>
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
  if (props.activeSection === "settings") {
    return (
      <>
        {renderSettingsSection(props.settings)}
        <section class="card mb-6 bg-base-100 shadow">
          <div class="card-body">
            <h3 class="card-title text-base">Logo 上传</h3>
            <div class="space-y-2">
              <input
                id="logo-upload-file"
                class="file-input file-input-bordered"
                type="file"
                accept="image/*"
              />
              <p id="logo-upload-status" class="text-xs text-base-content/60">
                选择图片后自动上传并回填 Logo 地址
              </p>
            </div>
          </div>
        </section>
      </>
    );
  }
  if (props.activeSection === "versions") {
    return renderVersionsSection(props.releases);
  }
  if (props.activeSection === "products") {
    return renderProductsSection(props.products);
  }
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
                <label
                  for="admin-sidebar"
                  class="btn btn-ghost btn-square lg:hidden"
                >
                  ☰
                </label>
                <div class="ml-2 flex items-center gap-3">
                  <img
                    src={props.settings.brandLogoUrl}
                    alt={`${props.settings.brandName} logo`}
                    class="h-9 w-9 rounded-lg object-cover"
                  />
                  <div>
                    <h1 class="text-lg font-semibold">
                      {props.settings.brandName} 后台
                    </h1>
                    <p class="text-xs text-base-content/60">
                      {props.settings.siteName}
                    </p>
                  </div>
                </div>
              </div>
              <form method="post" action="/admin/logout">
                <button class="btn btn-outline btn-sm" type="submit">
                  退出登录
                </button>
              </form>
            </div>

            {props.notice ? (
              <div class="alert alert-success mb-4 text-sm">{props.notice}</div>
            ) : null}
            {renderActiveSection(props)}
          </div>

          <div class="drawer-side">
            <label for="admin-sidebar" class="drawer-overlay" />
            <aside class="min-h-full w-64 bg-base-100 p-4">
              <ul class="menu gap-1 text-sm">
                <li class="menu-title">
                  <span>后台导航</span>
                </li>
                <li>
                  <a
                    href={sectionHref("settings")}
                    class={props.activeSection === "settings" ? "active" : ""}
                  >
                    品牌与 SEO
                  </a>
                </li>
                <li>
                  <a
                    href={sectionHref("versions")}
                    class={props.activeSection === "versions" ? "active" : ""}
                  >
                    版本管理
                  </a>
                </li>
                <li>
                  <a
                    href={sectionHref("products")}
                    class={props.activeSection === "products" ? "active" : ""}
                  >
                    商品管理
                  </a>
                </li>
                <li>
                  <a
                    href={sectionHref("tasks")}
                    class={props.activeSection === "tasks" ? "active" : ""}
                  >
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
            const file = fileInput?.files?.[0];
            if (!file) {
              if (status) status.textContent = '请先选择图片';
              return;
            }
            if (status) status.textContent = '上传中...';
            const formData = new FormData();
            formData.set('file', file);
            formData.set('kind', kind);
            const response = await fetch('/admin/upload/image', { method: 'POST', body: formData });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
              if (status) status.textContent = payload.error || '上传失败';
              return;
            }
            urlInput.value = payload.url;
            if (status) status.textContent = '上传成功，已自动回填地址';
          }

          function bindAutoUpload(fileInputId, urlInputId, kind, statusId) {
            const fileInput = document.getElementById(fileInputId);
            if (!fileInput) return;
            fileInput.addEventListener('change', () => {
              uploadAdminImage(fileInputId, urlInputId, kind, statusId);
            });
          }

          const productModal = document.getElementById('product-modal');
          function openCreateProductModal() {
            document.getElementById('product-modal-title').textContent = '新增商品';
            document.getElementById('product-id').value = '';
            document.getElementById('product-name').value = '';
            document.getElementById('product-description').value = '';
            document.getElementById('product-image-url').value = '';
            document.getElementById('product-price').value = '';
            document.getElementById('product-link').value = '';
            document.getElementById('product-published').checked = false;
            if (productModal) productModal.showModal();
          }
          function openEditProductModal(product) {
            document.getElementById('product-modal-title').textContent = '编辑商品';
            document.getElementById('product-id').value = product.id || '';
            document.getElementById('product-name').value = product.name || '';
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-image-url').value = product.imageUrl || '';
            document.getElementById('product-price').value = product.priceCny || '';
            document.getElementById('product-link').value = product.link || '';
            document.getElementById('product-published').checked = Boolean(product.published);
            if (productModal) productModal.showModal();
          }
          function openEditProductModalFromEncoded(encodedProduct) {
            if (!encodedProduct) return;
            try {
              const product = JSON.parse(decodeURIComponent(encodedProduct));
              openEditProductModal(product);
            } catch (error) {
              console.error('无法解析商品信息', error);
            }
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
