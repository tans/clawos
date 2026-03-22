import { computeLinePrice } from "./pricing";
import type { BomLine, QuoteResult } from "../types";

export function buildQuoteResult(params: {
  jobId: string;
  currency?: string;
  taxRate?: number;
  lines: BomLine[];
}): QuoteResult {
  const taxRate = params.taxRate ?? 0;
  const items = params.lines.map((line) => {
    const unitPrice = computeLinePrice(line);
    const subtotal = Number((line.quantity * unitPrice).toFixed(4));
    return {
      partNumber: line.partNumber,
      description: line.description,
      quantity: line.quantity,
      unitPrice,
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
    missingItems: [],
    warnings: [],
  };
}
