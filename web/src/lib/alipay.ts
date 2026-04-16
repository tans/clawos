import { AlipaySdk } from "alipay-sdk";
import type { AlipaySdkConfig } from "alipay-sdk";
import { getEnv } from "./env";

let alipayClient: AlipaySdk | null = null;

/**
 * Normalize RSA key to proper PEM format.
 * - PEM keys (with headers) are passed through as-is
 * - Raw base64 content is wrapped with appropriate headers
 * Alipay 密钥文件格式: PKCS#1 (-----BEGIN RSA PRIVATE KEY-----)
 */
function rawToPem(key: string, type: "private" | "public"): string {
  const trimmed = key.trim();

  // Already PEM format - pass through as-is
  // Node.js crypto handles PKCS#1, PKCS#8, and SubjectPublicKeyInfo transparently
  if (trimmed.startsWith("-----BEGIN")) {
    return trimmed;
  }

  // Raw base64 content without PEM headers
  // Remove description lines (e.g., "应用公钥：" prefix) and join
  const base64Content = trimmed
    .split("\n")
    .filter((line) => !line.includes("：") && !line.includes(":"))
    .join("");

  if (type === "private") {
    return `-----BEGIN RSA PRIVATE KEY-----\n${base64Content}\n-----END RSA PRIVATE KEY-----`;
  } else {
    return `-----BEGIN PUBLIC KEY-----\n${base64Content}\n-----END PUBLIC KEY-----`;
  }
}

function getAlipayClient(): AlipaySdk | null {
  const env = getEnv();
  if (!env.alipayAppId || !env.alipayPrivateKey || !env.alipayPublicKey) {
    return null;
  }

  if (!alipayClient) {
    const config: AlipaySdkConfig = {
      appId: env.alipayAppId,
      privateKey: rawToPem(env.alipayPrivateKey, "private"),
      alipayPublicKey: rawToPem(env.alipayPublicKey, "public"),
      signType: "RSA2",
      gateway: env.alipayGateway,
    };
    alipayClient = new AlipaySdk(config);
  }

  return alipayClient;
}

export function isAlipayConfigured(): boolean {
  return getAlipayClient() !== null;
}

export interface CreateQrCodeResult {
  outTradeNo: string;
  qrCodeUrl: string;
}

export async function createQrCodeOrder(params: {
  outTradeNo: string;
  totalAmount: string;
  subject: string;
}): Promise<CreateQrCodeResult> {
  const client = getAlipayClient();
  if (!client) {
    throw new Error("支付宝未配置");
  }

  const env = getEnv();

  const result = await client.exec(
    "alipay.trade.precreate",
    {
      bizContent: {
        out_trade_no: params.outTradeNo,
        total_amount: params.totalAmount,
        subject: params.subject,
      },
      notifyUrl: env.alipayNotifyUrl || undefined,
    },
    { signType: "RSA2" },
  );

  if (!result || typeof result !== "object") {
    throw new Error("支付宝返回无效");
  }

  const res = result as Record<string, unknown>;

  if (res.code !== "10000") {
    throw new Error(`支付宝错误: ${res.msg} (${res.code})`);
  }

  const response = res.alipay_trade_precreate_response as Record<string, unknown>;

  if (!response || !response.qr_code) {
    throw new Error("支付宝未返回二维码");
  }

  return {
    outTradeNo: params.outTradeNo,
    qrCodeUrl: response.qr_code as string,
  };
}

export interface CreatePagePayResult {
  outTradeNo: string;
  payUrl: string;
  totalAmount: string;
}

export async function createPagePayOrder(params: {
  outTradeNo: string;
  totalAmount: string;
  subject: string;
  returnUrl: string;
}): Promise<CreatePagePayResult> {
  const client = getAlipayClient();
  if (!client) {
    throw new Error("支付宝未配置");
  }

  const env = getEnv();

  const payUrl = client.pageExecute(
    "alipay.trade.page.pay",
    "GET",
    {
      bizContent: {
        out_trade_no: params.outTradeNo,
        total_amount: params.totalAmount,
        subject: params.subject,
        product_code: "FAST_INSTANT_TRADE_PAY",
      },
      notifyUrl: env.alipayNotifyUrl || undefined,
      returnUrl: params.returnUrl,
    },
  );

  return {
    outTradeNo: params.outTradeNo,
    payUrl,
    totalAmount: params.totalAmount,
  };
}

export interface CreateWapPayResult {
  outTradeNo: string;
  payUrl: string;
  totalAmount: string;
}

export async function createWapPayOrder(params: {
  outTradeNo: string;
  totalAmount: string;
  subject: string;
  returnUrl: string;
}): Promise<CreateWapPayResult> {
  const client = getAlipayClient();
  if (!client) {
    throw new Error("支付宝未配置");
  }

  const env = getEnv();

  const payUrl = client.pageExecute(
    "alipay.trade.wap.pay",
    "GET",
    {
      bizContent: {
        out_trade_no: params.outTradeNo,
        total_amount: params.totalAmount,
        subject: params.subject,
        product_code: "QUICK_WAP_WAY",
      },
      notifyUrl: env.alipayNotifyUrl || undefined,
      returnUrl: params.returnUrl,
    },
  );

  return {
    outTradeNo: params.outTradeNo,
    payUrl,
    totalAmount: params.totalAmount,
  };
}

export async function queryOrderStatus(outTradeNo: string): Promise<{
  status: "pending" | "paid" | "failed";
  tradeNo?: string;
}> {
  const client = getAlipayClient();
  if (!client) {
    throw new Error("支付宝未配置");
  }

  const result = await client.exec(
    "alipay.trade.query",
    { outTradeNo },
    { signType: "RSA2" },
  );

  if (!result || typeof result !== "object") {
    throw new Error("支付宝返回无效");
  }

  const res = result as Record<string, unknown>;

  if (res.code !== "10000") {
    // Trade not found or error
    return { status: "pending" };
  }

  const response = res.alipay_trade_query_response as Record<string, unknown>;
  const tradeStatus = response.trade_status as string | undefined;

  if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
    return {
      status: "paid",
      tradeNo: response.trade_no as string | undefined,
    };
  }

  return { status: "pending" };
}

export function verifyNotification(
  postData: Record<string, string>,
): boolean {
  const client = getAlipayClient();
  if (!client) {
    return false;
  }

  try {
    // The SDK's checkSignature verifies the sign field against the params
    return client.checkSignature(postData);
  } catch {
    return false;
  }
}
