/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";
import type { AdminTask, LatestRelease, Product, SiteSettings } from "../lib/types";

interface AdminPageProps {
  products: Product[];
  tasks: AdminTask[];
  settings: SiteSettings;
  releases: {
    stable: LatestRelease | null;
    beta: LatestRelease | null;
    alpha: LatestRelease | null;
  };
  notice?: string;
}

function LoginPage({ error }: { error?: string }) {
  const { brandName, siteName, brandLogoUrl, seoDescription, seoKeywords } = getBrandConfig();
  const pageTitle = `${siteName} 管理后台登录`;

  return (
    <html lang="zh-CN" data-theme="light">
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

function releaseCard(label: string, channel: string, data: LatestRelease | null) {
  return (
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <h3 class="card-title text-base">{label}</h3>
        <p class="text-xs text-base-content/60">当前版本：{data?.version || "dev"}</p>
        <form method="post" action="/admin/releases/save" class="mt-2 space-y-2">
          <input type="hidden" name="channel" value={channel} />
          <input class="input input-bordered input-sm w-full" name="version" placeholder="例如 1.2.3" required />
          <button class="btn btn-primary btn-sm w-full" type="submit">
            更新版本
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminPage({ products, tasks, settings, releases, notice }: AdminPageProps) {
  const pageTitle = `${settings.siteName} 管理后台`;

  return (
    <html lang="zh-CN" data-theme="light">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{pageTitle}</title>
        <meta name="description" content={settings.seoDescription} />
        <meta name="keywords" content={settings.seoKeywords} />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="icon" type="image/png" href={settings.brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="bg-base-200">
        <div class="drawer lg:drawer-open">
          <input id="admin-sidebar" type="checkbox" class="drawer-toggle" />
          <div class="drawer-content p-4 lg:p-8">
            <div class="navbar mb-4 rounded-box bg-base-100 shadow">
              <div class="flex-1">
                <label for="admin-sidebar" class="btn btn-ghost btn-square lg:hidden">
                  ☰
                </label>
                <div class="ml-2 flex items-center gap-3">
                  <img src={settings.brandLogoUrl} alt={`${settings.brandName} logo`} class="h-9 w-9 rounded-lg object-cover" />
                  <div>
                    <h1 class="text-lg font-semibold">{settings.brandName} 后台</h1>
                    <p class="text-xs text-base-content/60">{settings.siteName}</p>
                  </div>
                </div>
              </div>
              <form method="post" action="/admin/logout">
                <button class="btn btn-outline btn-sm" type="submit">退出登录</button>
              </form>
            </div>

            {notice ? <div class="alert alert-success mb-4 text-sm">{notice}</div> : null}

            <section id="settings" class="card mb-6 bg-base-100 shadow">
              <div class="card-body">
                <h2 class="card-title">Logo / 品牌 / SEO 管理</h2>
                <form method="post" action="/admin/settings/save" class="grid gap-3 md:grid-cols-2">
                  <input class="input input-bordered" name="brandName" value={settings.brandName} />
                  <input class="input input-bordered" name="siteName" value={settings.siteName} />
                  <input class="input input-bordered md:col-span-2" name="brandLogoUrl" value={settings.brandLogoUrl} />
                  <input class="input input-bordered md:col-span-2" name="seoTitle" value={settings.seoTitle} />
                  <textarea class="textarea textarea-bordered md:col-span-2" name="seoDescription">{settings.seoDescription}</textarea>
                  <input class="input input-bordered md:col-span-2" name="seoKeywords" value={settings.seoKeywords} />
                  <button class="btn btn-primary md:col-span-2" type="submit">保存设置</button>
                </form>
              </div>
            </section>

            <section id="versions" class="mb-6 grid gap-3 md:grid-cols-3">
              {releaseCard("Stable 版本", "stable", releases.stable)}
              {releaseCard("Beta 版本", "beta", releases.beta)}
              {releaseCard("Alpha 版本", "alpha", releases.alpha)}
            </section>

            <section id="products" class="card mb-6 bg-base-100 shadow">
              <div class="card-body">
                <h2 class="card-title">商品管理</h2>
                <form method="post" action="/admin/products/save" class="grid gap-3 md:grid-cols-2">
                  <input class="input input-bordered" name="id" placeholder="商品ID (如 pro-plan)" required />
                  <input class="input input-bordered" name="name" placeholder="商品名称" required />
                  <input class="input input-bordered md:col-span-2" name="description" placeholder="商品描述" />
                  <input class="input input-bordered" name="priceCny" placeholder="价格 (如 199/月)" />
                  <input class="input input-bordered" name="link" placeholder="购买链接" />
                  <label class="label cursor-pointer justify-start gap-3 md:col-span-2">
                    <input class="checkbox" type="checkbox" name="published" value="true" />
                    <span class="label-text">发布到前台</span>
                  </label>
                  <button class="btn btn-primary md:col-span-2" type="submit">保存商品</button>
                </form>
                <div class="divider" />
                <div class="overflow-x-auto">
                  <table class="table table-zebra">
                    <thead><tr><th>ID</th><th>名称</th><th>价格</th><th>状态</th><th>操作</th></tr></thead>
                    <tbody>
                      {products.length === 0 ? <tr><td colSpan={5} class="text-center">暂无商品</td></tr> : products.map((product) => (
                        <tr>
                          <td>{product.id}</td><td>{product.name}</td><td>{product.priceCny || "-"}</td><td>{product.published ? "已发布" : "草稿"}</td>
                          <td><form method="post" action="/admin/products/delete"><input type="hidden" name="id" value={product.id} /><button class="btn btn-xs btn-error" type="submit">删除</button></form></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section id="tasks" class="card bg-base-100 shadow">
              <div class="card-body">
                <h2 class="card-title">任务管理</h2>
                <form method="post" action="/admin/tasks/save" class="grid gap-3 md:grid-cols-4">
                  <input class="input input-bordered md:col-span-2" name="title" placeholder="任务标题" required />
                  <select class="select select-bordered" name="priority" defaultValue="medium">
                    <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
                  </select>
                  <input class="input input-bordered" type="date" name="dueDate" />
                  <textarea class="textarea textarea-bordered md:col-span-4" name="description" placeholder="任务描述" />
                  <button class="btn btn-primary md:col-span-4" type="submit">新增任务</button>
                </form>
                <div class="divider" />
                <div class="space-y-2">
                  {tasks.length === 0 ? <p class="text-sm text-base-content/60">暂无任务</p> : tasks.map((task) => (
                    <div class="flex flex-wrap items-center justify-between gap-2 rounded-box border border-base-300 p-3">
                      <div>
                        <p class={`font-medium ${task.done ? "line-through text-base-content/50" : ""}`}>{task.title}</p>
                        <p class="text-xs text-base-content/60">优先级：{task.priority} {task.dueDate ? `· 截止 ${task.dueDate}` : ""}</p>
                      </div>
                      <div class="flex gap-2">
                        <form method="post" action="/admin/tasks/toggle"><input type="hidden" name="id" value={task.id} /><button class="btn btn-xs btn-outline" type="submit">{task.done ? "标记未完成" : "标记完成"}</button></form>
                        <form method="post" action="/admin/tasks/delete"><input type="hidden" name="id" value={task.id} /><button class="btn btn-xs btn-error" type="submit">删除</button></form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div class="drawer-side">
            <label for="admin-sidebar" class="drawer-overlay" />
            <aside class="min-h-full w-64 bg-base-100 p-4">
              <ul class="menu gap-1 text-sm">
                <li class="menu-title"><span>后台导航</span></li>
                <li><a href="#settings">品牌与 SEO</a></li>
                <li><a href="#versions">版本管理</a></li>
                <li><a href="#products">商品管理</a></li>
                <li><a href="#tasks">任务管理</a></li>
              </ul>
            </aside>
          </div>
        </div>
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
