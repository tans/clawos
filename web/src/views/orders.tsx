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
  return (
    <section class="marketing-section py-12 sm:py-20">
      <div class="marketing-section-inner max-w-4xl mx-auto">
        <div class="mb-8">
          <h1 class="marketing-h1">我的订单</h1>
          <p class="text-base text-[color:var(--ink-soft)] mt-2">
            查看您的所有订单记录
          </p>
        </div>

        <div id="orders-list">
          <div class="text-center text-[color:var(--ink-soft)] py-8">加载中...</div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var orders = JSON.parse(localStorage.getItem('clawos_orders') || '[]');
          var container = document.getElementById('orders-list');

          if (orders.length === 0) {
            container.innerHTML = '<div class="rounded-2xl border border-[color:var(--line-soft)] bg-white/70 p-8 text-center"><p class="text-[color:var(--ink-soft)]">暂无订单记录</p><a href="/shop" class="btn btn-primary btn-sm mt-4">去商城看看</a></div>';
            return;
          }

          // Sort by createdAt desc
          orders.sort(function(a, b) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          });

          var html = '<div class="space-y-4">';
          orders.forEach(function(order) {
            var statusLabels = {
              pending: '待支付',
              paid: '已完成',
              failed: '失败',
              expired: '已过期',
              cancelled: '已取消',
              refunded: '已退款'
            };
            var statusStyles = {
              pending: 'badge-warning',
              paid: 'badge-success',
              failed: 'badge-error',
              expired: 'badge-neutral',
              cancelled: 'badge-neutral',
              refunded: 'badge-info'
            };
            var badgeClass = statusStyles[order.status] || 'badge-neutral';
            var label = statusLabels[order.status] || order.status;
            var createdAt = new Date(order.createdAt).toLocaleString('zh-CN');

            html += '<div class="rounded-2xl border border-[color:var(--line-soft)] bg-white p-6">';
            html += '<div class="flex items-start justify-between mb-4">';
            html += '<div><p class="text-sm font-mono text-[color:var(--ink-soft)]">' + order.id + '</p>';
            html += '<p class="text-xs text-[color:var(--ink-soft)] mt-1">' + createdAt + '</p></div>';
            html += '<span class="badge ' + badgeClass + ' badge-sm">' + label + '</span></div>';
            html += '<div class="flex items-center justify-between">';
            html += '<div><h3 class="font-medium text-[color:var(--ink-strong)]">' + order.productName + '</h3></div>';
            html += '<p class="text-lg font-bold text-[color:var(--color-accent)]">' + order.productPriceCny + '</p></div>';

            if (order.status === 'pending') {
              html += '<div class="mt-4 pt-4 border-t border-[color:var(--line-soft)]">';
              html += '<a href="/shop/' + order.productId + '" class="btn btn-warning btn-sm">继续支付</a></div>';
            }
            html += '</div>';
          });
          html += '</div>';
          container.innerHTML = html;
        })();
      ` }} />
    </section>
  );
}

export function renderOrdersPage(_orders: Order[]) {
  return renderMarketingShell({
    title: "我的订单",
    description: "查看您的所有订单记录",
    currentPath: "/orders",
    children: <OrdersPage orders={[]} />,
  });
}
