/**
 * NewAPI Redemption Code API Client
 * Docs: https://docs.newapi.pro/zh/docs/api/management/redemption/redemption-get
 */

const NEWAPI_BASE = "https://token.minapp.xin";
const ACCESS_TOKEN = "Fnzzd8OghB74fPugHFUXZ57aFYxXb+AW";

export interface RedemptionCode {
  id: number;
  code: string; // API 返回的是 key 字段
  name: string;
  quota: number; // Token 配额
  createdTime: number; // unix timestamp
  redeemedTime?: number;
  usedUserId?: number;
  status: 1 | 3; // 1=未兑换 3=已兑换
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
        "New-Api-User": "1",
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("[newapi] listRedemptionCodes failed:", res.status, await res.text());
      return null;
    }

    const json = await res.json() as { data?: { items?: RedemptionCode[] } } | NewApiError;
    if (!json.success && "message" in json) {
      console.error("[newapi] error:", json.message);
      return null;
    }

    return json.data?.items ?? null;
  } catch (err) {
    console.error("[newapi] fetch error:", err);
    return null;
  }
}
