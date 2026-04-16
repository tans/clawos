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

            {/* QR Code */}
            <div id="qrcode-container" class="mb-6 flex justify-center">
              <div id="qrcode-loading" class="w-64 h-64 flex items-center justify-center bg-stone-50 rounded-xl">
                <span class="text-[color:var(--color-ink-soft)]">加载中...</span>
              </div>
            </div>

            {/* Order Info */}
            <div class="mb-6 p-4 bg-stone-50 rounded-xl text-left">
              <p class="text-sm text-[color:var(--color-ink-soft)]">订单号</p>
              <p id="order-id" class="text-sm font-mono text-[color:var(--color-ink-strong)] break-all">{order?.id}</p>
              <p class="text-sm text-[color:var(--color-ink-soft)] mt-2">金额</p>
              <p class="text-lg font-bold text-[color:var(--color-accent)]">{order?.productPriceCny}</p>
            </div>

            {/* Status */}
            <div id="payment-status" class="mb-6">
              <div class="flex items-center justify-center gap-2">
                <div class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                <span id="status-text" class="text-sm text-amber-600">等待支付...</span>
              </div>
            </div>

            {/* Error */}
            <div id="payment-error" class="hidden mb-6 p-4 bg-red-50 rounded-xl text-red-700 text-sm"></div>
          </div>
        )}
      </div>

      {/* Payment Script */}
      <script dangerouslySetInnerHTML={{ __html: `
        let pollInterval = null;
        var orderId = '${order?.id || ""}';

        async function loadQrCode() {
          try {
            // Fetch order to get QR code URL
            const statusRes = await fetch('/api/pay/status/' + orderId);
            const statusData = await statusRes.json();

            if (!statusData.ok) {
              throw new Error(statusData.error || '获取订单信息失败');
            }

            // If order is already paid, redirect to success page
            if (statusData.status === 'paid') {
              window.location.href = '/pay-success?orderId=' + orderId;
              return;
            }

            // Get the order details
            const order = statusData.order;
            if (!order) {
              throw new Error('订单不存在');
            }

            // Fetch the QR code URL from the order
            const qrRes = await fetch('/api/pay/qr/' + orderId);
            const qrData = await qrRes.json();

            if (!qrData.ok) {
              throw new Error(qrData.error || '获取支付二维码失败');
            }

            // Show QR code
            var qrLoading = document.getElementById('qrcode-loading');
            if (qrLoading) {
              qrLoading.classList.add('hidden');
              qrLoading.insertAdjacentHTML('beforebegin', '<img src="' + qrData.qrCodeUrl + '" alt="支付二维码" class="w-64 h-64 rounded-xl" />');
            }

            // Start polling for payment status
            startPolling();

          } catch (err) {
            var qrContainer = document.getElementById('qrcode-container');
            var paymentError = document.getElementById('payment-error');
            if (qrContainer) qrContainer.classList.add('hidden');
            if (paymentError) {
              paymentError.classList.remove('hidden');
              paymentError.textContent = err.message || '加载失败';
            }
          }
        }

        function startPolling() {
          pollInterval = setInterval(async () => {
            try {
              const statusRes = await fetch('/api/pay/status/' + orderId);
              const statusData = await statusRes.json();

              if (statusData.status === 'paid') {
                clearInterval(pollInterval);
                var statusText = document.getElementById('status-text');
                if (statusText) {
                  statusText.textContent = '支付成功！';
                  statusText.className = 'text-sm text-green-600';
                }
                var statusDiv = document.querySelector('#payment-status span');
                if (statusDiv) statusDiv.className = 'w-2 h-2 rounded-full bg-green-400';
                setTimeout(function() {
                  window.location.href = '/pay-success?orderId=' + orderId;
                }, 1000);
              } else if (statusData.status === 'failed') {
                clearInterval(pollInterval);
                var paymentError = document.getElementById('payment-error');
                var paymentStatus = document.getElementById('payment-status');
                if (paymentError) {
                  paymentError.classList.remove('hidden');
                  paymentError.textContent = '支付失败，请重试';
                }
                if (paymentStatus) paymentStatus.classList.add('hidden');
              }
            } catch (e) {
              console.error('Poll error:', e);
            }
          }, 2000);
        }

        // Load QR code on page load
        loadQrCode();
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