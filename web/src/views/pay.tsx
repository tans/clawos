/** @jsxImportSource hono/jsx */

import type { Order } from "../lib/types";
import { renderMarketingShell } from "./marketing-shell";

interface PaymentPageProps {
  order: Order | null;
  error?: string;
}

function PaymentPage({ order, error }: PaymentPageProps) {
  return (
    <section class="marketing-section py-12 sm:py-20">
      <div class="marketing-section-inner max-w-md mx-auto">
        {error ? (
          <div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 text-center">
            {error}
          </div>
        ) : (
          <div class="rounded-2xl border border-[color:var(--line-soft)] bg-white p-8 text-center">
            <h1 class="text-2xl font-bold text-[color:var(--color-ink-strong)] mb-2">订单待支付</h1>
            <p class="text-sm text-[color:var(--ink-soft)] mb-6">{order?.productName}</p>

            {/* Order Info */}
            <div class="mb-6 p-4 bg-stone-50 rounded-xl text-left">
              <p class="text-sm text-[color:var(--color-ink-soft)]">订单号</p>
              <p id="order-id" class="text-sm font-mono text-[color:var(--color-ink-strong)] break-all">{order?.id}</p>
              <p class="text-sm text-[color:var(--color-ink-soft)] mt-2">金额</p>
              <p class="text-lg font-bold text-[color:var(--color-accent)]">{order?.productPriceCny}</p>
            </div>

            {/* Loading */}
            <div id="payment-loading" class="mb-6">
              <div class="flex items-center justify-center gap-2">
                <div class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                <span class="text-sm text-amber-600">正在跳转到支付页面...</span>
              </div>
            </div>

            {/* Error */}
            <div id="payment-error" class="hidden mb-6 p-4 bg-red-50 rounded-xl text-red-700 text-sm"></div>
          </div>
        )}
      </div>

      {/* Payment Redirect Script */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var orderId = '${order?.id || ""}';

          fetch('/api/pay/qr/' + orderId)
            .then(function(res) { return res.json(); })
            .then(function(data) {
              if (!data.ok) {
                throw new Error(data.error || '获取支付链接失败');
              }
              // Redirect to Alipay payment page
              window.location.href = data.qrCodeUrl;
            })
            .catch(function(err) {
              var loading = document.getElementById('payment-loading');
              var errorDiv = document.getElementById('payment-error');
              if (loading) loading.classList.add('hidden');
              if (errorDiv) {
                errorDiv.classList.remove('hidden');
                errorDiv.textContent = err.message || '加载失败，请刷新页面重试';
              }
            });
        })();
      `}} />
    </section>
  );
}

export function renderPaymentPage(order: Order | null, error?: string) {
  return renderMarketingShell({
    title: "订单支付",
    description: "请扫描二维码完成支付",
    currentPath: "/pay",
    children: <PaymentPage order={order} error={error} />,
  });
}