import { resolve, extname } from "node:path";
import { mkdir, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createSign, createVerify } from "node:crypto";

type OrderStatus = "created" | "pending_pay" | "paid" | "closed" | "failed";

type PresaleOrder = {
  id: string;
  outTradeNo: string;
  name: string;
  phone: string;
  address: string;
  amount: string;
  subject: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  alipayTradeNo?: string;
  tradeStatus?: string;
  callbackVerified?: boolean | null;
};

const root = process.cwd();
const port = Number(process.env.PORT ?? "8787");
const indexPath = resolve(root, "src", "index.html");
const stylePath = resolve(root, "dist", "output.css");
const dataDir = resolve(root, "data");
const orderFilePath = resolve(dataDir, "orders.json");

const alipayGateway = process.env.ALIPAY_GATEWAY ?? "https://openapi.alipay.com/gateway.do";
const alipayAppId = process.env.ALIPAY_APP_ID ?? "";
const alipayPrivateKey = process.env.ALIPAY_PRIVATE_KEY ?? "";
const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY ?? "";
const adminToken = process.env.ADMIN_TOKEN ?? "geekclaw-admin";
const presaleAmount = process.env.PRESALE_AMOUNT ?? "99.00";
const presaleSubject = process.env.PRESALE_SUBJECT ?? "GeekClaw 预售席位";

const assetMap = new Map([
  ["/logo.png", resolve(root, "logo.png")],
  ["/screenshot1.jpg", resolve(root, "screenshot1.jpg")],
  ["/screenshot2.jpg", resolve(root, "screenshot2.jpg")],
]);

const contentTypeByExt: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
};

function nowIso(): string {
  return new Date().toISOString();
}

function mapTradeStatusToOrderStatus(tradeStatus?: string): OrderStatus {
  if (!tradeStatus) return "pending_pay";
  if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") return "paid";
  if (tradeStatus === "TRADE_CLOSED") return "closed";
  return "failed";
}

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function ensureDataStore(): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  try {
    await access(orderFilePath, fsConstants.R_OK);
  } catch {
    await Bun.write(orderFilePath, "[]\n");
  }
}

async function readOrders(): Promise<PresaleOrder[]> {
  await ensureDataStore();
  try {
    const text = await Bun.file(orderFilePath).text();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed as PresaleOrder[];
    }
    return [];
  } catch {
    return [];
  }
}

async function writeOrders(orders: PresaleOrder[]): Promise<void> {
  await ensureDataStore();
  await Bun.write(orderFilePath, `${JSON.stringify(orders, null, 2)}\n`);
}

async function upsertOrder(next: PresaleOrder): Promise<void> {
  const orders = await readOrders();
  const idx = orders.findIndex((item) => item.outTradeNo === next.outTradeNo);
  if (idx >= 0) {
    orders[idx] = next;
  } else {
    orders.push(next);
  }
  await writeOrders(orders);
}

async function updateOrderByOutTradeNo(outTradeNo: string, updater: (order: PresaleOrder) => PresaleOrder): Promise<PresaleOrder | null> {
  const orders = await readOrders();
  const idx = orders.findIndex((item) => item.outTradeNo === outTradeNo);
  if (idx < 0) {
    return null;
  }

  const updated = updater(orders[idx]);
  orders[idx] = updated;
  await writeOrders(orders);
  return updated;
}

function parseBodyForm(contentType: string, bodyText: string): Record<string, string> {
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return {};
  }

  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(bodyText).entries()) {
    params[key] = value;
  }
  return params;
}

async function parseRequestParams(req: Request): Promise<Record<string, string>> {
  const url = new URL(req.url);
  const result: Record<string, string> = {};

  for (const [key, value] of url.searchParams.entries()) {
    result[key] = value;
  }

  if (req.method !== "POST") {
    return result;
  }

  const contentType = req.headers.get("content-type") ?? "";
  const bodyText = await req.text();
  const bodyParams = parseBodyForm(contentType, bodyText);
  return { ...result, ...bodyParams };
}

async function serveFile(path: string): Promise<Response> {
  try {
    await access(path, fsConstants.R_OK);
  } catch {
    return new Response("Not Found", { status: 404 });
  }

  const ext = extname(path).toLowerCase();
  return new Response(Bun.file(path), {
    headers: {
      "content-type": contentTypeByExt[ext] ?? "application/octet-stream",
      "cache-control": "public, max-age=600",
    },
  });
}

function getOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

function formatAlipayTimestamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function buildSignContent(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== "sign" && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function signAlipayParams(params: Record<string, string>): string {
  const signContent = buildSignContent(params);
  const signer = createSign("RSA-SHA256");
  signer.update(signContent, "utf8");
  return signer.sign(alipayPrivateKey, "base64");
}

function verifyAlipayCallback(params: Record<string, string>): boolean | null {
  if (!alipayPublicKey || !params.sign) {
    return null;
  }

  const sign = params.sign;
  const verify = createVerify("RSA-SHA256");
  verify.update(buildSignContent(params), "utf8");
  return verify.verify(alipayPublicKey, sign, "base64");
}

function presalePageHtml(req: Request): string {
  const callback = `${getOrigin(req)}/api/callback`;
  return `<!doctype html>
<html lang="zh-CN" data-theme="silk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GeekClaw 预售登记</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="min-h-screen bg-[#06030f] text-white">
    <main class="mx-auto w-full max-w-[720px] px-4 py-5">
      <section class="rounded-2xl border border-white/20 bg-black/45 p-5">
        <h1 class="text-2xl font-extrabold">预售登记</h1>
        <p class="mt-2 text-sm text-white/70">填写信息后将跳转支付宝支付，回调地址：${escapeHtml(callback)}</p>

        <form class="mt-5 space-y-4" method="POST" action="/api/presale">
          <label class="block">
            <span class="mb-2 block text-sm text-white/85">姓名</span>
            <input class="input w-full border-white/20 bg-white/10 text-white" name="name" required maxlength="32" placeholder="请输入姓名" />
          </label>

          <label class="block">
            <span class="mb-2 block text-sm text-white/85">手机</span>
            <input class="input w-full border-white/20 bg-white/10 text-white" name="phone" required pattern="^1[3-9]\\d{9}$" placeholder="请输入手机号" />
          </label>

          <label class="block">
            <span class="mb-2 block text-sm text-white/85">收货地址</span>
            <textarea class="textarea h-28 w-full border-white/20 bg-white/10 text-white" name="address" required maxlength="200" placeholder="请输入详细收货地址"></textarea>
          </label>

          <div class="rounded-xl border border-[#c8b8ff]/40 bg-[#160b36]/45 p-3 text-sm text-white/80">
            预售金额：¥${escapeHtml(presaleAmount)}
          </div>

          <button type="submit" class="btn w-full border-[#c8b8ff]/60 bg-[#6d45ff]/60 text-white hover:bg-[#7b5bff]">
            提交并前往支付宝支付
          </button>
        </form>
      </section>
    </main>
  </body>
</html>`;
}

function adminPageHtml(orders: PresaleOrder[]): string {
  const rows = orders
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((order) => {
      return `<tr>
<td class="px-3 py-2 text-xs">${escapeHtml(order.outTradeNo)}</td>
<td class="px-3 py-2 text-xs">${escapeHtml(order.name)}</td>
<td class="px-3 py-2 text-xs">${escapeHtml(maskPhone(order.phone))}</td>
<td class="px-3 py-2 text-xs">${escapeHtml(order.address)}</td>
<td class="px-3 py-2 text-xs">${escapeHtml(order.status)}</td>
<td class="px-3 py-2 text-xs">${escapeHtml(order.tradeStatus ?? "-")}</td>
<td class="px-3 py-2 text-xs">${escapeHtml(order.alipayTradeNo ?? "-")}</td>
<td class="px-3 py-2 text-xs">${escapeHtml(order.updatedAt)}</td>
</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN" data-theme="silk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GeekClaw 订单后台（建议版）</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="min-h-screen bg-[#06030f] text-white">
    <main class="mx-auto w-full max-w-[720px] px-4 py-5">
      <section class="rounded-2xl border border-white/20 bg-black/45 p-5">
        <h1 class="text-xl font-extrabold">订单管理后台（建议版）</h1>
        <p class="mt-2 text-xs text-white/70">建议项：按状态筛选、导出 CSV、发货信息、客服备注、回调重放。</p>
        <div class="mt-4 overflow-x-auto rounded-xl border border-white/15">
          <table class="w-full min-w-[900px] border-collapse text-left">
            <thead class="bg-white/10 text-xs">
              <tr>
                <th class="px-3 py-2">订单号</th>
                <th class="px-3 py-2">姓名</th>
                <th class="px-3 py-2">手机</th>
                <th class="px-3 py-2">地址</th>
                <th class="px-3 py-2">状态</th>
                <th class="px-3 py-2">交易状态</th>
                <th class="px-3 py-2">支付宝单号</th>
                <th class="px-3 py-2">更新时间</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="8" class="px-3 py-6 text-center text-xs text-white/60">暂无订单</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function isAdminAuthorized(req: Request): boolean {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-admin-token") ?? "";
  return token === adminToken;
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (pathname === "/presale") {
      return new Response(presalePageHtml(req), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (pathname === "/api/presale" && req.method === "POST") {
      const contentType = req.headers.get("content-type") ?? "";
      const bodyText = await req.text();
      const form = parseBodyForm(contentType, bodyText);

      const name = (form.name ?? "").trim();
      const phone = (form.phone ?? "").trim();
      const address = (form.address ?? "").trim();

      if (!name || !address || !/^1[3-9]\d{9}$/.test(phone)) {
        return new Response("参数不合法，请返回重试。", { status: 400 });
      }

      const outTradeNo = `GC${Date.now()}${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0")}`;
      const now = nowIso();
      const order: PresaleOrder = {
        id: crypto.randomUUID(),
        outTradeNo,
        name,
        phone,
        address,
        amount: presaleAmount,
        subject: presaleSubject,
        status: "created",
        createdAt: now,
        updatedAt: now,
      };

      await upsertOrder(order);
      return Response.redirect(`/api/alipay/pay?out_trade_no=${encodeURIComponent(outTradeNo)}`, 302);
    }

    if (pathname === "/api/alipay/pay") {
      if (!alipayAppId || !alipayPrivateKey) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "缺少支付宝配置，请设置 ALIPAY_APP_ID 和 ALIPAY_PRIVATE_KEY",
          }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          },
        );
      }

      const outTradeNo = url.searchParams.get("out_trade_no") ?? "";
      if (!outTradeNo) {
        return new Response("缺少订单号", { status: 400 });
      }

      const order = await updateOrderByOutTradeNo(outTradeNo, (current) => ({
        ...current,
        status: "pending_pay",
        updatedAt: nowIso(),
      }));

      if (!order) {
        return new Response("订单不存在", { status: 404 });
      }

      const callbackUrl = `${getOrigin(req)}/api/callback`;
      const params: Record<string, string> = {
        app_id: alipayAppId,
        method: "alipay.trade.page.pay",
        format: "JSON",
        charset: "utf-8",
        sign_type: "RSA2",
        timestamp: formatAlipayTimestamp(),
        version: "1.0",
        notify_url: callbackUrl,
        return_url: callbackUrl,
        biz_content: JSON.stringify({
          out_trade_no: outTradeNo,
          total_amount: order.amount,
          subject: order.subject,
          product_code: "FAST_INSTANT_TRADE_PAY",
        }),
      };

      params.sign = signAlipayParams(params);
      const query = new URLSearchParams(params).toString();
      return Response.redirect(`${alipayGateway}?${query}`, 302);
    }

    if (pathname === "/api/callback") {
      const params = await parseRequestParams(req);
      const verifyResult = verifyAlipayCallback(params);
      const outTradeNo = params.out_trade_no ?? "";
      const tradeStatus = params.trade_status;

      if (outTradeNo) {
        await updateOrderByOutTradeNo(outTradeNo, (current) => ({
          ...current,
          status: mapTradeStatusToOrderStatus(tradeStatus),
          updatedAt: nowIso(),
          tradeStatus,
          alipayTradeNo: params.trade_no ?? current.alipayTradeNo,
          callbackVerified: verifyResult,
        }));
      }

      console.log("[alipay-callback]", JSON.stringify(params));

      if (req.method === "POST") {
        return new Response("success", { headers: { "content-type": "text/plain; charset=utf-8" } });
      }

      return new Response(
        JSON.stringify(
          {
            ok: true,
            received: true,
            verified: verifyResult,
            trade_status: tradeStatus ?? null,
            out_trade_no: outTradeNo || null,
            trade_no: params.trade_no ?? null,
          },
          null,
          2,
        ),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      );
    }

    if (pathname === "/admin/orders") {
      if (!isAdminAuthorized(req)) {
        return new Response("Unauthorized", { status: 401 });
      }

      const orders = await readOrders();
      return new Response(adminPageHtml(orders), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (pathname === "/api/admin/orders") {
      if (!isAdminAuthorized(req)) {
        return new Response("Unauthorized", { status: 401 });
      }

      const orders = await readOrders();
      return new Response(JSON.stringify({ ok: true, total: orders.length, orders }, null, 2), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (pathname === "/") {
      return serveFile(indexPath);
    }

    if (pathname === "/styles.css") {
      return serveFile(stylePath);
    }

    const assetPath = assetMap.get(pathname);
    if (assetPath) {
      return serveFile(assetPath);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[geekclaw-site] running on http://127.0.0.1:${port}`);
console.log("[geekclaw-site] presale: /presale");
console.log("[geekclaw-site] admin: /admin/orders?token=<ADMIN_TOKEN>");
