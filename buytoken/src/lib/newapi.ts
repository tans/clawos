/**
 * NewAPI Redemption Code API Client
 * Docs: https://docs.newapi.pro/zh/docs/api/management/redemption/redemption-get
 */

const NEWAPI_BASE = "https://token.minapp.xin";
const ACCESS_TOKEN = "Fnzzd8OghB74fPugHFUXZ57aFYxXb+AW";

export interface RedemptionCode {
  id: string;
  code: string;
  name: string;
  value: number; // 面额（元）
  createdAt: string;
  usedAt?: string;
  status: "unused" | "used";
}

export interface NewApiError {
  message: string;
  success: false;
}

/**
 * 获取所有兑换码
 */
export async function listRedemptionCodes(): Promise<RedemptionCode[] | null> {
  try {
    const res = await fetch(`${NEWAPI_BASE}/api/redemption/`, {
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("[newapi] listRedemptionCodes failed:", res.status, await res.text());
      return null;
    }

    const json = await res.json() as { data?: RedemptionCode[] } | NewApiError;
    if (!json.success && "message" in json) {
      console.error("[newapi] error:", json.message);
      return null;
    }

    return json.data ?? null;
  } catch (err) {
    console.error("[newapi] fetch error:", err);
    return null;
  }
}
