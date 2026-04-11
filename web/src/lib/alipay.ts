import { AlipaySdk } from "alipay-sdk";
import type { AlipaySdkConfig } from "alipay-sdk";
import { getEnv } from "./env";

let alipayClient: AlipaySdk | null = null;

function getAlipayClient(): AlipaySdk | null {
  const env = getEnv();
  if (!env.alipayAppId || !env.alipayPrivateKey || !env.alipayPublicKey) {
    return null;
  }

  if (!alipayClient) {
    const config: AlipaySdkConfig = {
      appId: env.alipayAppId,
      privateKey: env.alipayPrivateKey,
      alipayPublicKey: env.alipayPublicKey,
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
