/** @jsxImportSource hono/jsx */

import { Hono } from "hono";
import { listRedemptionCodes } from "./lib/newapi";
import { createOrder, queryOrder } from "./lib/onepay";
import { PRODUCTS, getProduct } from "./lib/products";

const app = new Hono();

const PORT = parseInt(process.env.PORT || "3003", 10);
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const ONEPAY_NOTIFY_URL = process.env.ONEPAY_NOTIFY_URL || `${BASE_URL}/api/notify`;

const LS_KEY = "buytoken_codes";

// ============================================================
// 页面渲染
// ============================================================

function renderShell({ title }: { title: string }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 32px; }
    .products { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
    .product { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .product-name { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .product-desc { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 16px; }
    .product-price { font-size: 24px; font-weight: 700; color: #e55a00; margin-bottom: 16px; }
    .product-price span { font-size: 14px; font-weight: 400; color: #999; }
    .btn { display: inline-block; background: #e55a00; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; cursor: pointer; border: none; width: 100%; text-align: center; }
    .btn:hover { background: #cc4e00; }
    .tips { background: #fffbe6; border: 1px solid #ffe58f; border-radius: 8px; padding: 16px; margin-top: 32px; font-size: 14px; color: #8a6600; }
    .tips h3 { font-size: 15px; margin-bottom: 8px; }
    .tips li { margin-bottom: 4px; }
    .tab-bar { display: flex; gap: 0; border-bottom: 2px solid #eee; margin-bottom: 28px; }
    .tab { padding: 10px 24px; border: none; background: none; cursor: pointer; font-size: 15px; color: #666; border-bottom: 2px solid transparent; margin-bottom: -2px; border-radius: 6px 6px 0 0; }
    .tab:hover { color: #333; }
    .tab.active { color: #e55a00; border-bottom-color: #e55a00; font-weight: 600; }
    .codes-empty { background: white; border-radius: 12px; padding: 48px; text-align: center; color: #999; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .codes-empty p { margin-bottom: 20px; }
    .code-card { background: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: flex; align-items: center; gap: 16px; }
    .code-info { flex: 1; min-width: 0; }
    .code-name { font-size: 15px; font-weight: 600; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .code-meta { font-size: 13px; color: #999; }
    .code-value { font-size: 20px; font-weight: 700; color: #e55a00; white-space: nowrap; }
    .code-value span { font-size: 12px; font-weight: 400; color: #999; }
    .copy-btn { background: #f5f5f5; border: 1px solid #ddd; padding: 7px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; white-space: nowrap; }
    .copy-btn:hover { background: #eee; }
    .copy-btn.copied { background: #d4edda; border-color: #c3e6cb; color: #155724; }
    .result-card { background: white; border-radius: 12px; padding: 32px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-top: 24px; }
    .result-code { background: #f7f7f7; font-size: 22px; font-weight: 700; letter-spacing: 3px; padding: 16px 24px; border-radius: 8px; margin: 16px 0; word-break: break-all; }
    .result-meta { font-size: 14px; color: #999; margin-bottom: 20px; }
    .result-btn { background: #e55a00; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎫 Token 充值码购买</h1>
      <p class="subtitle">购买充值码，永久有效，支持 ClawOS Token 账户充值</p>
    </div>

    <div class="tab-bar">
      <button class="tab" id="tab-btn-buy" onclick="showTab('buy')">📦 购买商品</button>
      <button class="tab" id="tab-btn-my" onclick="showTab('my')">🎁 我的兑换码</button>
    </div>

    <div id="tab-buy" class="tab-content">
      <div class="products">
        ${PRODUCTS.map((p) => `
          <div class="product">
            <div class="product-name">${p.name}</div>
            <div class="product-desc">${p.description}</div>
            <div class="product-price">¥${(p.priceCents / 100).toFixed(2)} <span>面值 ¥${p.redemptionValue}</span></div>
            <button class="btn" onclick="buy('${p.id}')">立即购买</button>
          </div>
        `).join("")}
      </div>
      <div class="tips">
        <h3>💡 使用说明</h3>
        <ul>
          <li>支付成功后，兑换码自动存入「我的兑换码」</li>
          <li>复制兑换码，前往 ClawOS Token 账户充值</li>
          <li>兑换码永久有效，不限次数使用</li>
        </ul>
      </div>
    </div>

    <div id="tab-my" class="tab-content">
      <div id="my-codes-list"></div>
    </div>
  </div>

  <script>
    const LS_KEY = "${LS_KEY}";

    function showTab(name) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      document.getElementById('tab-btn-' + name).classList.add('active');
      document.getElementById('tab-' + name).style.display = 'block';
      if (name === 'my') renderMyCodes();
    }

    async function buy(productId) {
      const btn = event.target;
      btn.textContent = '正在跳转支付...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        });
        const data = await res.json();
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
        } else {
          alert('创建订单失败: ' + (data.error || '未知错误'));
          btn.textContent = '立即购买';
          btn.disabled = false;
        }
      } catch (e) {
        alert('网络错误，请重试');
        btn.textContent = '立即购买';
        btn.disabled = false;
      }
    }

    // ---- My Codes ----
    function getCodes() {
      try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
      catch { return []; }
    }

    function saveCode(code, name, value) {
      const codes = getCodes();
      if (codes.some(c => c.code === code)) return;
      codes.unshift({ code, name: name || '', value: value || 0, date: new Date().toISOString().slice(0, 10) });
      localStorage.setItem(LS_KEY, JSON.stringify(codes));
    }

    function copyCode(btn, code) {
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = '已复制 ✓';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('copied'); }, 2000);
      });
    }

    function renderMyCodes() {
      const codes = getCodes();
      const el = document.getElementById('my-codes-list');
      if (codes.length === 0) {
        el.innerHTML = '<div class="codes-empty"><p>暂无兑换码</p><button class="btn" onclick="showTab(\\'buy\\')" style="width:auto;padding:10px 28px;">去购买</button></div>';
        return;
      }
      el.innerHTML = codes.map(c => \`
        <div class="code-card">
          <div class="code-info">
            <div class="code-name">\${c.name}</div>
            <div class="code-meta">购买日期：\${c.date}｜面值 ¥\${c.value}</div>
          </div>
          <button class="copy-btn" onclick="copyCode(this, '\${c.code}')">复制</button>
        </div>
      \`).join('');
    }

    // ---- Auto-save from URL (after payment) ----
    (function autoSaveFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const saved = params.get('saved');
      if (saved) {
        try {
          const d = JSON.parse(decodeURIComponent(saved));
          if (d.code) saveCode(d.code, d.name || '', d.value || 0);
        } catch {}
      }
    })();
  </script>
</body>
</html>`;
}

// ============================================================
// 成功页（支付完成后轮询领取码）
// ============================================================

function renderSuccessPage({ orderId, productName }: { orderId: string; productName: string }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>支付中...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#f5f5f5; }
    .box { background:white; border-radius:16px; padding:48px; text-align:center; box-shadow:0 4px 16px rgba(0,0,0,0.1); max-width:420px; width:90%; }
    h2 { margin-bottom:12px; }
    p { color:#666; margin-bottom:24px; }
    .spinner { width:40px; height:40px; border:4px solid #e55a00; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto 24px; }
    @keyframes spin { to{transform:rotate(360deg)} }
    .result-card { margin-top:24px; text-align:left; }
    .result-card h3 { color:#155724; font-size:16px; margin-bottom:12px; }
    .result-code { background:#f7f7f7; font-size:18px; font-weight:700; letter-spacing:2px; padding:14px; border-radius:8px; word-break:break-all; margin:8px 0 12px; }
    .result-meta { font-size:13px; color:#999; margin-bottom:20px; }
    .result-btn { display:inline-block; background:#e55a00; color:white; padding:10px 24px; border-radius:8px; text-decoration:none; font-size:14px; }
  </style>
</head>
<body>
  <div class="box">
    <div id="loading">
      <div class="spinner"></div>
      <h2>支付完成后自动显示兑换码</h2>
      <p>请在收银台完成支付，页面将自动更新</p>
    </div>
    <div id="result" style="display:none"></div>
  </div>
  <script>
    const LS_KEY = "${LS_KEY}";
    const orderId = ${JSON.stringify(orderId)};
    const productName = ${JSON.stringify(productName)};

    function saveCode(code, name, value) {
      try {
        const codes = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        if (!codes.some(c => c.code === code)) {
          codes.unshift({ code, name: name || '', value: value || 0, date: new Date().toISOString().slice(0, 10) });
          localStorage.setItem(LS_KEY, JSON.stringify(codes));
        }
      } catch {}
    }

    async function check() {
      try {
        const res = await fetch('/api/check/' + orderId);
        const data = await res.json();
        if (data.status === 'paid') {
          const r = await fetch('/api/order/' + orderId);
          const order = await r.json();
          document.getElementById('loading').style.display = 'none';
          const d = document.getElementById('result');
          d.style.display = 'block';
          if (order.code) {
            saveCode(order.code, order.name || productName, order.value || 0);
            d.innerHTML = \`
              <div class="result-card">
                <h3>✅ 支付成功！</h3>
                <div class="result-code">\${order.code}</div>
                <div class="result-meta">面值 ¥\${order.value || ''}｜永久有效</div>
                <a class="result-btn" href="/">去充值 ClawOS Token →</a>
              </div>
            \`;
          } else {
            d.innerHTML = '<p style="color:#c00;">获取兑换码失败，请联系客服</p>';
          }
        } else {
          setTimeout(check, 2000);
        }
      } catch {
        setTimeout(check, 2000);
      }
    }
    check();
  </script>
</body>
</html>`;
}

// ============================================================
// API 路由
// ============================================================

app.get("/health", (c) => c.json({ ok: true, service: "buytoken" }));

app.get("/api/products", (c) => c.json({ ok: true, items: PRODUCTS }));

app.post("/api/create-order", async (c) => {
  const { productId } = await c.req.json().catch(() => ({}));

  const product = getProduct(productId);
  if (!product) {
    return c.json({ ok: false, error: "产品不存在" }, 400);
  }

  const outTradeNo = `bt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const redirectUrl = `${BASE_URL}/success?orderId=${outTradeNo}&productName=${encodeURIComponent(product.name)}`;

  const order = await createOrder({
    fee: product.priceCents,
    title: product.name,
    outTradeNo,
    redirectUrl,
    notifyUrl: ONEPAY_NOTIFY_URL,
  });

  if (!order) {
    return c.json({ ok: false, error: "创建订单失败，请重试" }, 500);
  }

  return c.json({ ok: true, orderId: outTradeNo, paymentUrl: order.paymentUrl });
});

app.get("/api/check/:orderId", async (c) => {
  const { orderId } = c.req.param();
  const order = await queryOrder(undefined, orderId);
  if (order?.status === "paid") {
    return c.json({ status: true });
  }
  return c.json({ status: false });
});

app.get("/success", (c) => {
  const orderId = c.req.query("orderId") || "";
  const productName = c.req.query("productName") || "";
  return c.html(renderSuccessPage({ orderId, productName }));
});

app.get("/api/order/:orderId", async (c) => {
  const { orderId } = c.req.param();

  const order = await queryOrder(undefined, orderId);
  if (!order || order.status !== "paid") {
    return c.json({ ok: false, error: "订单未支付或不存在" }, 400);
  }

  const codes = await listRedemptionCodes();
  if (!codes || codes.length === 0) {
    return c.json({ ok: false, error: "暂无可用兑换码，请联系客服" }, 500);
  }

  const unused = codes.find((c) => c.status === 1);
  if (!unused) {
    return c.json({ ok: false, error: "暂无可用兑换码，请联系客服" }, 500);
  }

  return c.json({ ok: true, code: unused.code, value: unused.quota, name: unused.name });
});

app.post("/api/notify", async (c) => {
  try {
    const body = await c.req.json();
    console.log("[notify] OnePay callback:", JSON.stringify(body));
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false, error: "解析失败" }, 400);
  }
});

app.get("/*", async (c) => {
  const path = c.req.path === "/" ? "/index.html" : c.req.path;
  const file = Bun.file(`./public${path}`);
  if (await file.exists()) {
    return new Response(file);
  }
  return c.html(renderShell({ title: "Token 充值码购买" }));
});

// ============================================================
// 启动
// ============================================================

if (import.meta.main) {
  console.log(`[buytoken] starting on http://127.0.0.1:${PORT}`);
  console.log(`[buytoken] base url: ${BASE_URL}`);
  Bun.serve({ port: PORT, fetch: app.fetch });
}

export { app };
