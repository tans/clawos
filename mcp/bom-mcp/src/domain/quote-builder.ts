import { resolveLinePrice } from "./pricing";
import type { BomLine, QuoteResult } from "../types";

export function buildQuoteResult(params: {
  jobId: string;
  currency?: string;
  taxRate?: number;
  lines: BomLine[];
}): QuoteResult {
  const taxRate = params.taxRate ?? 0;
  const missingItems: Array<{ partNumber: string; reason: string }> = [];
  const items = params.lines.map((line) => {
    const price = resolveLinePrice(line);
    if (price.source === "default") {
      missingItems.push({
        partNumber: line.partNumber,
        reason: "缺少有效单价，使用默认兜底单价",
      });
    }
    const subtotal = Number((line.quantity * price.unitPrice).toFixed(4));
    return {
      partNumber: line.partNumber,
      description: line.description,
      quantity: line.quantity,
      unitPrice: price.unitPrice,
      subtotal,
    };
  });
  const subtotal = Number(items.reduce((acc, item) => acc + item.subtotal, 0).toFixed(4));
  const tax = Number((subtotal * taxRate).toFixed(4));
  const grandTotal = Number((subtotal + tax).toFixed(4));

  return {
    jobId: params.jobId,
    currency: params.currency || "CNY",
    taxRate,
    totals: { subtotal, tax, grandTotal },
    items,
    missingItems,
    warnings: missingItems.length > 0 ? [`存在 ${missingItems.length} 条明细缺少有效单价，已按默认单价计算`] : [],
  };
}
