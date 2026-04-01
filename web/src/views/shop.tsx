/** @jsxImportSource hono/jsx */

import type { Product } from "../lib/types";
import { renderMarketingShell } from "./marketing-shell";

function ShopPage({ items }: { items: Product[] }) {
  return (
    <section class="marketing-section py-20 sm:py-24">
      <div class="marketing-section-inner space-y-6">
        <div class="max-w-3xl space-y-4">
          <p class="marketing-kicker">Product Catalog</p>
          <h1 class="marketing-h1">商城</h1>
          <p class="text-base leading-8 text-[color:var(--ink-soft)]">
            浏览已发布商品。你可以直接跳转到购买链接，或联系团队获取部署与采购支持。
          </p>
        </div>

        {items.length === 0 ? (
          <div class="rounded-2xl border border-[color:var(--line-soft)] bg-white/70 p-8 text-sm text-[color:var(--ink-soft)]">
            暂无已发布商品，请稍后再试。
          </div>
        ) : (
          <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((product) => (
              <article class="rounded-2xl border border-[color:var(--line-soft)] bg-white p-6 shadow-sm">
                <div class="space-y-3">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} class="h-40 w-full rounded-xl object-cover" />
                  ) : null}
                  <p class="text-xs uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">{product.id}</p>
                  <h2 class="text-xl font-semibold text-[color:var(--ink-strong)]">{product.name}</h2>
                  <p class="min-h-16 text-sm leading-7 text-[color:var(--ink-soft)]">
                    {product.description || "暂无描述"}
                  </p>
                  <p class="text-sm font-medium text-[color:var(--ink-strong)]">{product.priceCny || "联系销售"}</p>
                  {product.link ? (
                    <a class="marketing-primary-button inline-flex" href={product.link} target="_blank" rel="noreferrer">
                      立即购买
                    </a>
                  ) : (
                    <a class="marketing-secondary-button inline-flex" href="/contact">
                      联系销售
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function renderShopPage(items: Product[]) {
  return renderMarketingShell({
    title: "商城",
    description: "查看 ClawOS 已发布商品与购买入口。",
    currentPath: "/shop",
    children: <ShopPage items={items} />,
  });
}
