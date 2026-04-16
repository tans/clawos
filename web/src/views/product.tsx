/** @jsxImportSource hono/jsx */

import type { Product } from "../lib/types";
import { renderMarketingShell } from "./marketing-shell";

function formatPrice(priceCny: string): string {
  // Handle formats like "99/月", "1399", "799.00"
  const cleaned = priceCny.replace(/\/.*$/, "").trim();
  if (cleaned.includes(".")) {
    return `¥${cleaned}`;
  }
  return `¥${cleaned}`;
}

interface ProductDetailProps {
  product: Product;
  error?: string;
}

function ProductDetailPage({ product, error }: ProductDetailProps) {
  return (
    <section class="marketing-section py-12 sm:py-20">
      <div class="marketing-section-inner">
        {error ? (
          <div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 text-center">
            {error}
          </div>
        ) : (
          <div class="grid gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Product Image */}
            <div class="relative">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  class="w-full rounded-2xl object-cover shadow-lg"
                  style={{ maxHeight: "500px" }}
                />
              ) : (
                <div class="w-full aspect-square rounded-2xl bg-gradient-to-br from-[color:var(--color-accent)]/10 to-[color:var(--color-accent)]/5 flex items-center justify-center">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" class="text-[color:var(--color-accent)]/30">
                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              {/* Detail Images */}
              {product.imageUrls && product.imageUrls.length > 0 && (
                <div class="mt-4 space-y-3">
                  {product.imageUrls.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`${product.name} 详情图 ${index + 1}`}
                      class="w-full rounded-xl object-cover shadow-sm"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div class="flex flex-col space-y-6">
              <div>
                <p class="text-sm uppercase tracking-[0.14em] text-[color:var(--color-accent)] mb-2">{product.id}</p>
                <h1 class="text-3xl sm:text-4xl font-bold text-[color:var(--color-ink-strong)] font-display">
                  {product.name}
                </h1>
              </div>

              <div class="text-4xl font-bold text-[color:var(--color-ink-strong)]">
                {formatPrice(product.priceCny)}
                {product.priceCny.includes("/") && (
                  <span class="text-lg text-[color:var(--color-ink-soft)] font-normal">
                    {product.priceCny.match(/\/(.+)$/)?.[1]}
                  </span>
                )}
              </div>

              <div class="prose prose-stone max-w-none">
                <p class="text-base leading-8 text-[color:var(--color-ink-normal)]">
                  {product.description || "暂无商品描述"}
                </p>
              </div>

              {/* Buy Button */}
              <div class="pt-4">
                <button
                  type="button"
                  id="buy-button"
                  class="marketing-primary-button text-lg px-8 py-4"
                  onclick="initiatePayment()"
                >
                  立即购买
                </button>
              </div>

              {/* Back to Shop */}
              <div class="pt-4">
                <a href="/shop" class="text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent)] transition-colors flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  返回商城
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <dialog id="payment-modal" class="modal-overlay">
        <div class="modal-content p-8 max-w-md w-full mx-auto rounded-2xl bg-white shadow-2xl">
          <div class="text-center">
            <h3 class="text-xl font-semibold text-[color:var(--color-ink-strong)] mb-2">请扫码支付</h3>
            <p id="modal-product-name" class="text-sm text-[color:var(--color-ink-soft)] mb-6">{product?.name}</p>

            {/* Shipping Form */}
            <div id="shipping-form" class="hidden mb-6 text-left">
              <h4 class="text-sm font-medium text-[color:var(--color-ink-strong)] mb-3">请填写收货信息</h4>
              <div class="space-y-3">
                <div>
                  <label class="text-xs text-[color:var(--color-ink-soft)]">收货人姓名</label>
                  <input id="shipping-name" type="text" class="input input-bordered w-full mt-1" placeholder="请输入收货人姓名" />
                </div>
                <div>
                  <label class="text-xs text-[color:var(--color-ink-soft)]">手机号</label>
                  <input id="shipping-phone" type="tel" class="input input-bordered w-full mt-1" placeholder="请输入手机号" maxlength="11" />
                </div>
                <div>
                  <label class="text-xs text-[color:var(--color-ink-soft)]">收货地址</label>
                  <textarea id="shipping-address" class="textarea textarea-bordered w-full mt-1" placeholder="请输入详细收货地址" rows="2"></textarea>
                </div>
              </div>
              <div class="mt-4 flex gap-2">
                <button type="button" id="shipping-back" class="btn btn-outline flex-1" onclick="hideShippingForm()">返回</button>
                <button type="button" id="shipping-submit" class="btn btn-primary flex-1" onclick="submitShippingInfo()">确认并支付</button>
              </div>
            </div>

            {/* QR Code */}
            <div id="qrcode-container" class="mb-6 flex justify-center hidden">
              <div id="qrcode-loading" class="w-64 h-64 flex items-center justify-center bg-stone-50 rounded-xl">
                <span class="text-[color:var(--color-ink-soft)]">加载中...</span>
              </div>
            </div>

            {/* Order Info */}
            <div id="order-info" class="hidden mb-6 p-4 bg-stone-50 rounded-xl text-left">
              <p class="text-sm text-[color:var(--color-ink-soft)]">订单号</p>
              <p id="order-id" class="text-sm font-mono text-[color:var(--color-ink-strong)] break-all"></p>
            </div>

            {/* Status */}
            <div id="payment-status" class="mb-6 hidden">
              <div class="flex items-center justify-center gap-2">
                <div class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                <span id="status-text" class="text-sm text-amber-600">等待支付...</span>
              </div>
            </div>

            {/* Error */}
            <div id="payment-error" class="hidden mb-6 p-4 bg-red-50 rounded-xl text-red-700 text-sm"></div>

            {/* Close Button */}
            <button
              type="button"
              id="modal-close"
              class="marketing-secondary-button"
              onclick="closePaymentModal()"
            >
              关闭
            </button>
          </div>
        </div>
      </dialog>

      {/* Payment Script */}
      <script dangerouslySetInnerHTML={{ __html: `
        let pollInterval = null;
        var pendingProductId = null;
        var requiresLogistics = ${product?.requiresLogistics || false};

        window.initiatePayment = function() {
          const productId = '${product?.id || ""}';
          const button = document.getElementById('buy-button');
          const modal = document.getElementById('payment-modal');
          const qrContainer = document.getElementById('qrcode-container');
          const qrLoading = document.getElementById('qrcode-loading');
          const orderInfo = document.getElementById('order-info');
          const paymentStatus = document.getElementById('payment-status');
          const paymentError = document.getElementById('payment-error');
          const statusText = document.getElementById('status-text');
          const orderIdEl = document.getElementById('order-id');
          const shippingForm = document.getElementById('shipping-form');

          // Disable button
          if (button) button.disabled = true;

          pendingProductId = productId;

          // Show modal
          modal.showModal();

          // If requires logistics, show shipping form first
          if (requiresLogistics) {
            qrContainer.classList.add('hidden');
            qrLoading.classList.add('hidden');
            orderInfo.classList.add('hidden');
            paymentStatus.classList.add('hidden');
            paymentError.classList.add('hidden');
            if (shippingForm) shippingForm.classList.remove('hidden');
            if (button) button.disabled = false;
            return;
          }

          // Proceed directly to payment
          qrContainer.classList.remove('hidden');
          qrLoading.classList.remove('hidden');
          orderInfo.classList.add('hidden');
          paymentStatus.classList.add('hidden');
          paymentError.classList.add('hidden');
          if (shippingForm) shippingForm.classList.add('hidden');

          createOrder(productId, null, null, null);
        };

        window.hideShippingForm = function() {
          const shippingForm = document.getElementById('shipping-form');
          const button = document.getElementById('buy-button');
          if (shippingForm) shippingForm.classList.add('hidden');
          if (button) button.disabled = false;
          pendingProductId = null;
        };

        window.submitShippingInfo = async function() {
          const shippingName = document.getElementById('shipping-name').value.trim();
          const shippingPhone = document.getElementById('shipping-phone').value.trim();
          const shippingAddress = document.getElementById('shipping-address').value.trim();

          // Validation
          if (!shippingName) {
            alert('请填写收货人姓名');
            return;
          }
          if (!shippingPhone) {
            alert('请填写手机号');
            return;
          }
          if (!/^1[3-9]\\d{9}$/.test(shippingPhone)) {
            alert('手机号格式不正确');
            return;
          }
          if (!shippingAddress) {
            alert('请填写收货地址');
            return;
          }

          const shippingForm = document.getElementById('shipping-form');
          const qrContainer = document.getElementById('qrcode-container');
          const qrLoading = document.getElementById('qrcode-loading');
          const orderInfo = document.getElementById('order-info');
          const paymentStatus = document.getElementById('payment-status');
          const paymentError = document.getElementById('payment-error');

          if (shippingForm) shippingForm.classList.add('hidden');
          qrContainer.classList.remove('hidden');
          qrLoading.classList.remove('hidden');
          orderInfo.classList.add('hidden');
          paymentStatus.classList.add('hidden');
          paymentError.classList.add('hidden');

          createOrder(pendingProductId, shippingName, shippingPhone, shippingAddress);
        };

        async function createOrder(productId, shippingName, shippingPhone, shippingAddress) {
          const qrContainer = document.getElementById('qrcode-container');
          const qrLoading = document.getElementById('qrcode-loading');
          const orderInfo = document.getElementById('order-info');
          const paymentStatus = document.getElementById('payment-status');
          const paymentError = document.getElementById('payment-error');
          const statusText = document.getElementById('status-text');
          const orderIdEl = document.getElementById('order-id');
          const button = document.getElementById('buy-button');

          try {
            const requestBody = { productId: productId };
            if (shippingName) {
              requestBody.shippingName = shippingName;
              requestBody.shippingPhone = shippingPhone;
              requestBody.shippingAddress = shippingAddress;
            }

            const res = await fetch('/api/pay/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody)
            });
            const data = await res.json();

            if (!data.ok) {
              throw new Error(data.error || '创建订单失败');
            }

            // Save order to localStorage
            var orderData = {
              id: data.orderId,
              productId: productId,
              productName: data.productName,
              productPriceCny: data.priceCny,
              status: 'pending',
              createdAt: new Date().toISOString()
            };
            if (shippingName) {
              orderData.shippingName = shippingName;
              orderData.shippingPhone = shippingPhone;
              orderData.shippingAddress = shippingAddress;
            }
            var savedOrders = JSON.parse(localStorage.getItem('clawos_orders') || '[]');
            savedOrders.push(orderData);
            localStorage.setItem('clawos_orders', JSON.stringify(savedOrders));

            // Show QR code
            qrLoading.classList.add('hidden');
            qrLoading.insertAdjacentHTML('beforebegin', '<img src="' + data.qrCodeUrl + '" alt="支付二维码" class="w-64 h-64 rounded-xl" />');

            // Show order info
            orderInfo.classList.remove('hidden');
            orderIdEl.textContent = data.orderId;

            // Start polling
            paymentStatus.classList.remove('hidden');
            statusText.textContent = '等待支付...';

            pollInterval = setInterval(async () => {
              try {
                const statusRes = await fetch('/api/pay/status/' + data.orderId);
                const statusData = await statusRes.json();

                if (statusData.status === 'paid') {
                  clearInterval(pollInterval);
                  statusText.textContent = '支付成功！';
                  statusText.className = 'text-sm text-green-600';
                  document.querySelector('#payment-status span').className = 'w-2 h-2 rounded-full bg-green-400';
                  // Update order status in localStorage
                  var savedOrders = JSON.parse(localStorage.getItem('clawos_orders') || '[]');
                  savedOrders = savedOrders.map(function(o) {
                    if (o.id === data.orderId) {
                      o.status = 'paid';
                      o.paidAt = new Date().toISOString();
                    }
                    return o;
                  });
                  localStorage.setItem('clawos_orders', JSON.stringify(savedOrders));
                  setTimeout(function() {
                    window.location.href = '/pay-success?orderId=' + data.orderId;
                  }, 1000);
                } else if (statusData.status === 'failed') {
                  clearInterval(pollInterval);
                  paymentError.classList.remove('hidden');
                  paymentError.textContent = '支付失败，请重试';
                  paymentStatus.classList.add('hidden');
                }
              } catch (e) {
                console.error('Poll error:', e);
              }
            }, 2000);

          } catch (err) {
            qrContainer.classList.add('hidden');
            paymentError.classList.remove('hidden');
            paymentError.textContent = err.message || '创建订单失败';
            paymentStatus.classList.add('hidden');

            if (button) button.disabled = false;
          }
        }

        window.closePaymentModal = function() {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          const modal = document.getElementById('payment-modal');
          if (modal) modal.close();
        };

        // Close modal on escape
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') {
            closePaymentModal();
          }
        });
      `}} />
    </section>
  );
}

export function renderProductPage(product: Product | null, error?: string) {
  return renderMarketingShell({
    title: product ? product.name : "商品详情",
    description: product ? product.description : "商品详情页",
    currentPath: "/shop",
    children: <ProductDetailPage product={product!} error={error} />,
  });
}
