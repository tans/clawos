/** @jsxImportSource hono/jsx */

import type { Order } from "../lib/types";
import { renderMarketingShell } from "./marketing-shell";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: Order["status"]) {
  const styles: Record<Order["status"], string> = {
    pending: "badge-warning",
    paid: "badge-success",
    failed: "badge-error",
    expired: "badge-neutral",
    cancelled: "badge-neutral",
    refunded: "badge-info",
  };
  const labels: Record<Order["status"], string> = {
    pending: "待支付",
    paid: "已完成",
    failed: "失败",
    expired: "已过期",
    cancelled: "已取消",
    refunded: "已退款",
  };
  return (
    <span class={`badge ${styles[status]} badge-sm`}>
      {labels[status]}
    </span>
  );
}

interface OrdersPageProps {
  orders: Order[];
}

function OrdersPage({ orders }: OrdersPageProps) {
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <section class="marketing-section py-12 sm:py-20">
      <div class="marketing-section-inner max-w-4xl mx-auto">
        <div class="mb-8">
          <h1 class="marketing-h1">我的订单</h1>
          <p class="text-base text-[color:var(--ink-soft)] mt-2">
            查看您的所有订单记录
          </p>
        </div>

        {sortedOrders.length === 0 ? (
          <div class="rounded-2xl border border-[color:var(--line-soft)] bg-white/70 p-8 text-center">
            <p class="text-[color:var(--ink-soft)]">暂无订单记录</p>
            <a href="/shop" class="btn btn-primary btn-sm mt-4">
              去商城看看
            </a>
          </div>
        ) : (
          <div class="space-y-4">
            {sortedOrders.map((order) => (
              <div
                key={order.id}
                class="rounded-2xl border border-[color:var(--line-soft)] bg-white p-6"
              >
                <div class="flex items-start justify-between mb-4">
                  <div>
                    <p class="text-sm font-mono text-[color:var(--ink-soft)]">
                      {order.id}
                    </p>
                    <p class="text-xs text-[color:var(--ink-soft)] mt-1">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  {statusBadge(order.status)}
                </div>

                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="font-medium text-[color:var(--ink-strong)]">
                      {order.productName}
                    </h3>
                  </div>
                  <p class="text-lg font-bold text-[color:var(--color-accent)]">
                    {order.productPriceCny}
                  </p>
                </div>

                {order.status === "pending" && (
                  <div class="mt-4 pt-4 border-t border-[color:var(--line-soft)]">
                    <a
                      href={`/shop/${order.productId}`}
                      class="btn btn-warning btn-sm"
                    >
                      继续支付
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function renderOrdersPage(orders: Order[]) {
  return renderMarketingShell({
    title: "我的订单",
    description: "查看您的所有订单记录",
    currentPath: "/orders",
    children: <OrdersPage orders={orders} />,
  });
}
