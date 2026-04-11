/** @jsxImportSource hono/jsx */

import { renderMarketingShell } from "./marketing-shell";

interface OrderInfo {
  id: string;
  productId: string;
  productName: string;
  productPriceCny: string;
  status: string;
  createdAt: string;
  paidAt?: string;
}

interface PaySuccessProps {
  order: OrderInfo | null;
  error?: string;
}

function PaySuccessPage({ order, error }: PaySuccessProps) {
  return (
    <section class="marketing-section py-12 sm:py-20">
      <div class="marketing-section-inner max-w-2xl mx-auto">
        {error ? (
          <div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" class="text-red-500">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-red-800 mb-2">查询失败</h2>
            <p class="text-red-600 mb-6">{error}</p>
            <a href="/shop" class="marketing-primary-button">
              返回商城
            </a>
          </div>
        ) : order ? (
          <div class="rounded-2xl border border-[color:var(--color-line-soft)] bg-white p-8 text-center shadow-sm">
            <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" class="text-green-500">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <h1 class="text-2xl font-bold text-[color:var(--color-ink-strong)] mb-2">
              支付成功！
            </h1>
            <p class="text-[color:var(--color-ink-soft)] mb-8">
              感谢您的购买。我们将尽快为您处理订单。
            </p>

            {/* Order Details */}
            <div class="bg-stone-50 rounded-xl p-6 text-left mb-8">
              <h3 class="text-sm font-semibold text-[color:var(--color-ink-soft)] uppercase tracking-wide mb-4">
                订单详情
              </h3>
              <dl class="space-y-3">
                <div class="flex justify-between">
                  <dt class="text-sm text-[color:var(--color-ink-soft)]">商品</dt>
                  <dd class="text-sm font-medium text-[color:var(--color-ink-strong)]">{order.productName}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-sm text-[color:var(--color-ink-soft)]">订单号</dt>
                  <dd class="text-sm font-mono text-[color:var(--color-ink-strong)]">{order.id}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-sm text-[color:var(--color-ink-soft)]">支付金额</dt>
                  <dd class="text-sm font-bold text-[color:var(--color-accent)]">{order.productPriceCny}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-sm text-[color:var(--color-ink-soft)]">支付时间</dt>
                  <dd class="text-sm text-[color:var(--color-ink-strong)]">
                    {order.paidAt ? new Date(order.paidAt).toLocaleString("zh-CN") : "-"}
                  </dd>
                </div>
              </dl>
            </div>

            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/shop" class="marketing-primary-button">
                继续购物
              </a>
              <a href="/" class="marketing-secondary-button">
                返回首页
              </a>
            </div>
          </div>
        ) : (
          <div class="rounded-2xl border border-[color:var(--color-line-soft)] bg-white p-8 text-center">
            <h1 class="text-2xl font-bold text-[color:var(--color-ink-strong)] mb-4">
              订单不存在
            </h1>
            <p class="text-[color:var(--color-ink-soft)] mb-6">
              未找到相关订单信息
            </p>
            <a href="/shop" class="marketing-primary-button">
              返回商城
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

export function renderPaySuccessPage(order: OrderInfo | null, error?: string) {
  return renderMarketingShell({
    title: "支付成功",
    description: "您的订单已完成支付",
    currentPath: "/shop",
    children: <PaySuccessPage order={order} error={error} />,
  });
}
