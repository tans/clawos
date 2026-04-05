/**
 * OnePay 收银台客户端
 * Docs: https://onepay.minapp.xin/llms.txt
 */

const ONEPAY_BASE = "https://onepay.minapp.xin";

export interface CreateOrderParams {
  fee: number; // 单位：分
  title: string;
  outTradeNo: string;
  redirectUrl: string;
  notifyUrl?: string;
  email?: string;
}

export interface CreateOrderResult {
  id: string;
  paymentUrl: string;
  fee: number;
  outTradeNo: string;
}

export interface OrderDetail {
  id: string;
  fee: number;
  outTradeNo: string;
  status: "pending" | "paid";
  paidAt?: string;
  title?: string;
  email?: string;
}

/**
 * 创建支付订单（JSON 模式，不自动跳转）
 */
export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult | null> {
  try {
    const res = await fetch(`${ONEPAY_BASE}/api/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fee: params.fee,
        title: params.title,
        outTradeNo: params.outTradeNo,
        redirectUrl: params.redirectUrl,
        notifyUrl: params.notifyUrl,
        email: params.email,
      }),
    });

    if (!res.ok) {
      console.error("[onepay] createOrder failed:", res.status, await res.text());
      return null;
    }

    const json = await res.json() as { data?: CreateOrderResult; paymentUrl?: string; order?: OrderDetail };
    if (json.paymentUrl && json.order) {
      return {
        id: json.order.id,
        paymentUrl: json.paymentUrl,
        fee: json.order.fee,
        outTradeNo: json.order.outTradeNo,
      };
    }

    return json.data ?? null;
  } catch (err) {
    console.error("[onepay] fetch error:", err);
    return null;
  }
}

/**
 * 查询订单状态
 */
export async function queryOrder(id?: string, outTradeNo?: string): Promise<OrderDetail | null> {
  try {
    const query = id ? `id=${id}` : outTradeNo ? `outTradeNo=${outTradeNo}` : "";
    const res = await fetch(`${ONEPAY_BASE}/api/query-order?${query}`);

    if (!res.ok) return null;

    const json = await res.json() as { order?: OrderDetail };
    return json.order ?? null;
  } catch {
    return null;
  }
}

/**
 * 轮询支付结果（前端用）
 */
export async function checkPayment(id: string): Promise<{ status: boolean; redirectUrl?: string }> {
  try {
    const res = await fetch(`${ONEPAY_BASE}/api/${id}/check`);
    if (!res.ok) return { status: false };
    return await res.json();
  } catch {
    return { status: false };
  }
}
