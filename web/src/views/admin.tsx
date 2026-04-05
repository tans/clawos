/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";
import { renderProductsSection } from "./admin-sections/products";
import { renderSettingsSection } from "./admin-sections/settings";
import { renderTasksSection } from "./admin-sections/tasks";
import type { AdminPageProps, AdminSection } from "./admin-sections/types";

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
        <main class="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10">
          <section class="grid w-full overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-2xl lg:grid-cols-2">
            <div class="relative hidden overflow-hidden bg-gradient-to-br from-primary to-secondary p-10 text-primary-content lg:block">
              <div class="absolute -left-14 top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div class="absolute -bottom-16 right-6 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
              <div class="relative flex h-full flex-col justify-between">
                <div class="space-y-4">
                  <p class="text-sm uppercase tracking-[0.2em] text-primary-content/80">
                    Admin Console
                  </p>
                  <h2 class="text-3xl font-semibold leading-tight">
                    安全管理你的
                    <br />
                    {brandName} 内容系统
                  </h2>
                  <p class="max-w-sm text-sm text-primary-content/80">
                    登录后可统一维护版本、产品、站点配置与任务列表，所有变更都会立即同步到线上展示。
                  </p>
                </div>
                <ul class="space-y-3 text-sm text-primary-content/90">
                  <li>• 版本发布与安装包信息可视化管理</li>
                  <li>• 产品内容与图片素材集中维护</li>
                  <li>• 站点信息与任务协作一站式处理</li>
                </ul>
              </div>
            </div>

            <div class="p-6 sm:p-10">
              <div class="mx-auto max-w-md">
                <div class="mb-8 flex items-center gap-3">
                  <img
                    src={brandLogoUrl}
                    alt={`${brandName} logo`}
                    class="h-11 w-11 rounded-xl object-cover ring ring-base-300"
                  />
                  <div>
                    <h1 class="text-xl font-semibold">{`${brandName} 后台登录`}</h1>
                    <p class="text-xs text-base-content/60">{siteName}</p>
                  </div>
                </div>

                {error ? (
                  <div class="alert alert-error mb-5 py-2 text-sm">
                    <span>{error}</span>
                  </div>
                ) : null}

                <form class="space-y-5" method="post" action="/admin/login">
                  <label class="form-control">
                    <span class="label-text mb-1 text-sm">账号</span>
                    <input
                      class="input input-bordered h-11"
                      type="text"
                      name="username"
                      placeholder="请输入管理员账号"
                      autocomplete="username"
                      required
                    />
                  </label>
                  <label class="form-control">
                    <span class="label-text mb-1 text-sm">密码</span>
                    <input
                      class="input input-bordered h-11"
                      type="password"
                      name="password"
                      placeholder="请输入登录密码"
                      autocomplete="current-password"
                      required
                    />
                  </label>
                  <button class="btn btn-primary h-11 w-full text-base" type="submit">
                    登录管理后台
                  </button>
                </form>

                <p class="mt-5 text-xs text-base-content/60">
                  如遇登录问题，请检查环境变量 ADMIN_USERNAME 与 ADMIN_PASSWORD 是否配置正确。
                </p>
              </div>
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
    return renderSettingsSection(props.settings);
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
            if (!(fileInput instanceof HTMLInputElement)) {
              if (status) status.textContent = '上传控件不可用，请刷新后重试';
              return;
            }
            const file = fileInput?.files?.[0];
            if (!file) {
              if (status) status.textContent = '缺少文件：请先选择图片后再上传';
              return;
            }
            if (status) status.textContent = '上传中...';
            const formData = new FormData();
            formData.append('file', file);
            formData.set('kind', kind);
            const response = await fetch('/admin/upload/image', { method: 'POST', body: formData });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
              if (status) status.textContent = payload.error === '缺少文件' ? '上传失败：缺少文件，请重新选择图片' : (payload.error || '上传失败');
              return;
            }
            urlInput.value = payload.url;
            if (status) status.textContent = '上传成功，已自动回填地址';
          }

          async function uploadReleaseInstaller(fileInputId, statusId) {
            const fileInput = document.getElementById(fileInputId);
            const status = document.getElementById(statusId);
            if (!fileInput || !status) {
              return;
            }
            const file = fileInput?.files?.[0];
            if (!file) {
              status.textContent = '缺少安装包：请先选择文件';
              return;
            }
            const versionInput = fileInput
              .closest('form')
              ?.querySelector('input[name=\"version\"]');
            const version = (versionInput?.value || '').trim();
            status.textContent = '安装包上传中...';
            const formData = new FormData();
            formData.set('file', file);
            formData.set('channel', 'stable');
            if (version) {
              formData.set('version', version);
            }
            const response = await fetch('/admin/upload/installer', {
              method: 'POST',
              body: formData
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
              status.textContent = payload.error || '安装包上传失败';
              return;
            }
            status.textContent = '安装包上传成功：' + payload.fileName + '（版本 ' + payload.version + '）';
          }

          function bindAutoUpload(fileInputId, urlInputId, kind, statusId) {
            const fileInput = document.getElementById(fileInputId);
            if (!fileInput) return;
            fileInput.addEventListener('change', () => {
              uploadAdminImage(fileInputId, urlInputId, kind, statusId);
            });
          }

          const productModal = document.getElementById('product-modal');
          const taskModal = document.getElementById('task-modal');
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
          function openCreateTaskModal() {
            document.getElementById('task-title').value = '';
            document.getElementById('task-priority').value = 'medium';
            document.getElementById('task-due-date').value = '';
            document.getElementById('task-description').value = '';
            document.getElementById('task-image-url').value = '';
            document.getElementById('task-image-file').value = '';
            document.getElementById('task-image-upload-status').textContent = '选择图片后自动上传';
            if (taskModal) taskModal.showModal();
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
