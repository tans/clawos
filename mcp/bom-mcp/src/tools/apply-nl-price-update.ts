import { upsertManualPartPrice } from "../infra/store";

interface ApplyNlPriceUpdateInput {
  partNumber: string;
  unitPrice: number;
  supplier?: string;
  currency?: string;
  reason?: string;
  operatorId?: string;
}

export async function applyNlPriceUpdate(input: ApplyNlPriceUpdateInput): Promise<{
  ok: true;
  partNumber: string;
  unitPrice: number;
}> {
  if (!input.partNumber?.trim()) {
    throw new Error("partNumber 不能为空");
  }
  if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
    throw new Error("unitPrice 必须是大于 0 的数字");
  }

  upsertManualPartPrice({
    partNumber: input.partNumber,
    unitPrice: input.unitPrice,
    supplier: input.supplier,
    currency: input.currency,
    sourceType: "nl",
    reason: input.reason ?? "自然语言价格修正",
    operatorType: "human",
    operatorId: input.operatorId,
  });

  return {
    ok: true,
    partNumber: input.partNumber.trim().toUpperCase(),
    unitPrice: Number(input.unitPrice.toFixed(4)),
  };
}
