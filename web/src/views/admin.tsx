/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";
import type { McpRelease, McpShelfItem, Product, ReleaseChannel } from "../lib/types";

interface AdminPageProps {
  products: Product[];
  stableMcps: McpRelease[];
  betaMcps: McpRelease[];
  shelf: McpShelfItem[];
  notice?: string;
}

function LoginPage({ error }: { error?: string }) {
  const { brandName } = getBrandConfig();

  return (
    <html lang="zh-CN" data-theme="light">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${brandName} 后台登录`}</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen bg-base-200">
        <main class="mx-auto flex min-h-screen max-w-md items-center px-4">
          <section class="card w-full bg-base-100 shadow-xl">
            <div class="card-body">
              <h1 class="card-title">后台登录</h1>
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

function mcpKey(item: Pick<McpShelfItem, "mcpId" | "version" | "channel">): string {
  return `${item.channel}:${item.mcpId}:${item.version}`;
}

function renderMcpTable(title: string, channel: ReleaseChannel, items: McpRelease[], shelf: Set<string>) {
  return (
    <section class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">{title}</h2>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>ID</th>
                <th>版本</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} class="text-center text-base-content/60">
                    暂无 MCP 发布记录
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const key = mcpKey({ mcpId: item.id, version: item.version, channel });
                  const published = shelf.has(key);
                  return (
                    <tr>
                      <td>{item.id}</td>
                      <td>{item.version}</td>
                      <td>{published ? "已上架" : "未上架"}</td>
                      <td>
                        <form method="post" action="/admin/mcp/shelf" class="inline-flex gap-2">
                          <input type="hidden" name="mcpId" value={item.id} />
                          <input type="hidden" name="version" value={item.version} />
                          <input type="hidden" name="channel" value={channel} />
                          <input type="hidden" name="published" value={published ? "false" : "true"} />
                          <button class={`btn btn-xs ${published ? "btn-warning" : "btn-success"}`} type="submit">
                            {published ? "下架" : "上架"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function AdminPage({ products, stableMcps, betaMcps, shelf, notice }: AdminPageProps) {
  const { brandName } = getBrandConfig();
  const shelfSet = new Set(shelf.filter((item) => item.published).map((item) => mcpKey(item)));

  return (
    <html lang="zh-CN" data-theme="light">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${brandName} 后台`}</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="bg-base-200">
        <main class="mx-auto max-w-6xl space-y-6 px-4 py-6">
          <header class="flex items-center justify-between">
            <h1 class="text-2xl font-semibold">{`${brandName} 后台`}</h1>
            <form method="post" action="/admin/logout">
              <button class="btn btn-outline btn-sm" type="submit">
                退出登录
              </button>
            </form>
          </header>

          {notice ? <div class="alert alert-success text-sm">{notice}</div> : null}

          <section class="card bg-base-100 shadow">
            <div class="card-body">
              <h2 class="card-title">新增 / 编辑商品</h2>
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
                <button class="btn btn-primary md:col-span-2" type="submit">
                  保存商品
                </button>
              </form>
            </div>
          </section>

          <section class="card bg-base-100 shadow">
            <div class="card-body">
              <h2 class="card-title">商品列表</h2>
              <div class="overflow-x-auto">
                <table class="table table-zebra">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>名称</th>
                      <th>价格</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={5} class="text-center text-base-content/60">
                          暂无商品
                        </td>
                      </tr>
                    ) : (
                      products.map((product) => (
                        <tr>
                          <td>{product.id}</td>
                          <td>{product.name}</td>
                          <td>{product.priceCny || "-"}</td>
                          <td>{product.published ? "已发布" : "草稿"}</td>
                          <td>
                            <form method="post" action="/admin/products/delete">
                              <input type="hidden" name="id" value={product.id} />
                              <button class="btn btn-xs btn-error" type="submit">
                                删除
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {renderMcpTable("MCP 上架（Stable）", "stable", stableMcps, shelfSet)}
          {renderMcpTable("MCP 上架（Beta）", "beta", betaMcps, shelfSet)}
        </main>
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
