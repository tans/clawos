import { parseBom } from "./bom-parser";
import { analyzeCustomerIntent } from "./intent-analyzer";
import { normalizeBomLines } from "./normalizer";
import { buildQuoteResult } from "./quote-builder";
import type { WebSupplier } from "./web-pricing";
import type { MultiBomQuoteResult } from "../types";

export async function quoteCustomerMessage(params: {
  message: string;
  customer?: string;
  currency?: string;
  taxRate?: number;
  webPricing?: boolean;
  webSuppliers?: WebSupplier[];
}): Promise<MultiBomQuoteResult> {
  const analysis = await analyzeCustomerIntent(params.message);
  if (analysis.tasks.length === 0) {
    throw new Error("message 中未识别到有效 BOM");
  }
  const quotedAt = new Date().toISOString();
  const currency = params.currency || "CNY";

  const boms = await Promise.all(
    analysis.tasks.map(async (task, index) => {
      const lines = normalizeBomLines(parseBom("csv", task.bomContent));
      const quote = await buildQuoteResult({
        jobId: `multi_${index + 1}`,
        currency,
        taxRate: params.taxRate,
        lines,
        webPricing: params.webPricing,
        webSuppliers: params.webSuppliers,
      });

      return {
        bomId: `multi_${index + 1}`,
        bomName: task.taskName,
        quotedAt,
        currency,
        summary: {
          totalLines: quote.lines.length,
          resolvedLines: quote.lines.filter((line) => line.decisionType === "resolved").length,
          pendingDecisionLines: quote.pendingDecisions.length,
          failedLines: quote.failures.length,
          subtotal: quote.totals.subtotal,
          tax: quote.totals.tax,
          grandTotal: quote.totals.grandTotal,
        },
        lines: quote.lines,
        pendingDecisions: quote.pendingDecisions,
        failures: quote.failures,
        notes: quote.warnings,
      };
    }),
  );

  return {
    requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    customer: params.customer,
    quotedAt,
    currency,
    summary: {
      bomCount: boms.length,
      totalLines: boms.reduce((acc, bom) => acc + bom.summary.totalLines, 0),
      resolvedLines: boms.reduce((acc, bom) => acc + bom.summary.resolvedLines, 0),
      pendingDecisionLines: boms.reduce((acc, bom) => acc + bom.summary.pendingDecisionLines, 0),
      failedLines: boms.reduce((acc, bom) => acc + bom.summary.failedLines, 0),
    },
    boms,
    crossBomWarnings: [],
  };
}
