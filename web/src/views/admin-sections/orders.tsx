/** @jsxImportSource hono/jsx */

import type { Order } from "../../lib/types";

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
    paid: "已支付",
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

interface OrdersSectionProps {
  orders: Order[];
}

function OrdersSection({ orders }: OrdersSectionProps) {
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const totalAmount = orders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => {
      const price = parseFloat(o.productPriceCny.replace(/[^0-9.]/g, "")) || 0;
      return sum + price;
    }, 0);

  return (
    <section id="orders" class="card bg-base-100 shadow">
      <div class="card-body">
        <div class="flex items-center justify-between mb-4">
          <h2 class="card-title">订单管理</h2>
          <div class="text-sm text-base-content/60">
            共 {orders.length} 笔订单，已支付收入 ¥{totalAmount.toFixed(2)}
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>订单号</th>
                <th>商品</th>
                <th>金额</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>支付时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} class="text-center">暂无订单</td>
                </tr>
              ) : (
                sortedOrders.map((order) => (
                  <tr key={order.id}>
                    <td class="font-mono text-xs">{order.id}</td>
                    <td>{order.productName}</td>
                    <td>{order.productPriceCny}</td>
                    <td>{statusBadge(order.status)}</td>
                    <td class="text-sm">{formatDate(order.createdAt)}</td>
                    <td class="text-sm">{order.paidAt ? formatDate(order.paidAt) : "-"}</td>
                    <td>
                      <div class="flex gap-1">
                        <button
                          class="btn btn-xs btn-ghost"
                          onclick={`showOrderDetail('${order.id}')`}
                        >
                          详情
                        </button>
                        {order.status === "pending" && (
                          <form method="post" action="/admin/orders/cancel" class="inline">
                            <input type="hidden" name="id" value={order.id} />
                            <button class="btn btn-xs btn-error" type="submit">
                              取消
                            </button>
                          </form>
                        )}
                        {order.status === "paid" && (
                          <form method="post" action="/admin/orders/refund" class="inline">
                            <input type="hidden" name="id" value={order.id} />
                            <button class="btn btn-xs btn-warning" type="submit">
                              退款
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div class="text-xs text-base-content/50 mt-2">
          提示：待支付订单超过24小时将自动过期
        </div>
      </div>

      {/* Order Detail Modal */}
      <dialog id="order-modal" class="modal">
        <div class="modal-box max-w-2xl">
          <h3 class="font-bold text-lg" id="order-modal-title">订单详情</h3>
          <div id="order-detail-content" class="mt-4">
            {/* Filled by JS */}
          </div>
          <div class="modal-action">
            <form method="dialog">
              <button class="btn">关闭</button>
            </form>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button type="submit">close</button></form>
      </dialog>

      <script dangerouslySetInnerHTML={{ __html: `
        window.__orders = ${JSON.stringify(orders)};
        window.showOrderDetail = function(orderId) {
          const order = window.__orders.find(function(o) { return o.id === orderId; });
          if (!order) return;
          document.getElementById('order-modal-title').textContent = '订单详情: ' + order.id;
          var content = document.getElementById('order-detail-content');
          var html = '<dl class="grid grid-cols-2 gap-4 text-sm">';
          html += '<div><dt class="text-base-content/60">订单号</dt><dd class="font-mono break-all">' + order.id + '</dd></div>';
          html += '<div><dt class="text-base-content/60">商品</dt><dd>' + order.productName + '</dd></div>';
          html += '<div><dt class="text-base-content/60">金额</dt><dd class="font-bold">' + order.productPriceCny + '</dd></div>';
          html += '<div><dt class="text-base-content/60">状态</dt><dd>' + order.status + '</dd></div>';
          html += '<div><dt class="text-base-content/60">创建时间</dt><dd>' + new Date(order.createdAt).toLocaleString('zh-CN') + '</dd></div>';
          html += '<div><dt class="text-base-content/60">支付时间</dt><dd>' + (order.paidAt ? new Date(order.paidAt).toLocaleString('zh-CN') : '-') + '</dd></div>';
          if (order.alipayOutTradeNo) {
            html += '<div><dt class="text-base-content/60">支付宝交易号</dt><dd class="font-mono break-all">' + order.alipayOutTradeNo + '</dd></div>';
          }
          if (order.alipayTradeNo) {
            html += '<div><dt class="text-base-content/60">商户单号</dt><dd class="font-mono break-all">' + order.alipayTradeNo + '</dd></div>';
          }
          html += '</dl>';
          content.innerHTML = html;
          document.getElementById('order-modal').showModal();
        };
      ` }} />
    </section>
  );
}

export function renderOrdersSection(orders: Order[]) {
  return <OrdersSection orders={orders} />;
}
