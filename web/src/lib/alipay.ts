import { AlipaySdk } from "alipay-sdk";
import type { AlipaySdkConfig } from "alipay-sdk";
import { getEnv } from "./env";

let alipayClient: AlipaySdk | null = null;

/**
 * Normalize RSA key to proper PEM format.
 * Handles both PKCS#1 (-----BEGIN RSA PRIVATE KEY-----) and PKCS#8 (-----BEGIN PRIVATE KEY-----)
 * for private keys, and both PKCS#1 (-----BEGIN RSA PUBLIC KEY-----) and PKCS#8 (-----BEGIN PUBLIC KEY-----)
 * for public keys. Also handles raw base64 content without PEM headers.
 */
function rawToPem(key: string, type: "private" | "public"): string {
  const trimmed = key.trim();

  // Already properly formatted PEM
  if (trimmed.startsWith("-----BEGIN")) {
    // Normalize headers: convert PKCS#1 to PKCS#8 for consistency
    if (type === "private") {
      if (trimmed.includes("-----BEGIN RSA PRIVATE KEY-----")) {
        return trimmed.replace("-----BEGIN RSA PRIVATE KEY-----", "-----BEGIN PRIVATE KEY-----")
                      .replace("-----END RSA PRIVATE KEY-----", "-----END PRIVATE KEY-----");
      }
    } else {
      if (trimmed.includes("-----BEGIN RSA PUBLIC KEY-----")) {
        return trimmed.replace("-----BEGIN RSA PUBLIC KEY-----", "-----BEGIN PUBLIC KEY-----")
                      .replace("-----END RSA PUBLIC KEY-----", "-----END PUBLIC KEY-----");
      }
    }
    return trimmed;
  }

  // Remove any description lines (e.g., "应用公钥：" prefix)
  const base64Content = trimmed
    .split("\n")
    .filter((line) => !line.includes("：") && !line.includes(":"))
    .join("")
    .replace(/\s/g, "");

  if (type === "private") {
    return `-----BEGIN PRIVATE KEY-----\n${base64Content}\n-----END PRIVATE KEY-----`;
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
      outTradeNo: params.outTradeNo,
      totalAmount: params.totalAmount,
      subject: params.subject,
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

  const result = await client.exec(
    "alipay.trade.page.pay",
    {
      outTradeNo: params.outTradeNo,
      totalAmount: params.totalAmount,
      subject: params.subject,
      productCode: "FAST_INSTANT_TRADE_PAY",
      notifyUrl: env.alipayNotifyUrl || undefined,
      returnUrl: params.returnUrl,
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

  const response = res.alipay_trade_page_pay_response as Record<string, unknown>;

  if (!response || !response.qr_code) {
    throw new Error("支付宝未返回支付链接");
  }

  return {
    outTradeNo: params.outTradeNo,
    payUrl: response.qr_code as string,
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
