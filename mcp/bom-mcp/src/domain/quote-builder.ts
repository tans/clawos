import { isAmbiguousElectronicComponent } from "./component-classifier";
import { buildPendingDecisionOptions } from "./pending-decision-options";
import { derivePriceConfidence } from "./price-confidence";
import { resolveLinePrice } from "./pricing";
import type { BomLine, QuoteResult } from "../types";
import type { WebSupplier } from "./web-pricing";

export async function buildQuoteResult(params: {
  jobId: string;
  currency?: string;
  taxRate?: number;
  lines: BomLine[];
  webPricing?: boolean;
  webSuppliers?: WebSupplier[];
}): Promise<QuoteResult> {
  const taxRate = params.taxRate ?? 0;
  const lineResults = await Promise.all(params.lines.map(async (line, index) => {
    const lineNo = line.lineNo ?? index + 1;
    if (isAmbiguousElectronicComponent(line)) {
      const reason = "客户提供的器件信息过于模糊，存在多个可能型号，无法安全自动选型";
      const options = await buildPendingDecisionOptions(line, {
        decisionType: "ambiguous_candidates",
        webPricing: params.webPricing,
        webSuppliers: params.webSuppliers,
      });
      return {
        line: {
          lineNo,
          partNumber: line.partNumber,
          description: line.description,
          designator: line.designator,
          manufacturer: line.manufacturer,
          quantity: line.quantity,
          decisionType: "ambiguous_candidates" as const,
          needsCustomerDecision: true,
          reason,
        },
        pendingDecision: {
          lineNo,
          description: line.description,
          originalPartText: line.rawText || line.partNumber,
          decisionType: "ambiguous_candidates" as const,
          reason,
          recommendedAction: "请选择明确型号后重新报价",
          options,
          question: `请确认第 ${lineNo} 行器件 ${line.partNumber} 的具体型号`,
        },
      };
    }

    const price = await resolveLinePrice(line, {
      webPricing: params.webPricing,
      webSuppliers: params.webSuppliers,
    });
    if (price.source === "missing" || price.unitPrice === undefined) {
      const reasonBase = "未获取到可靠价格，需要客户补充价格来源或确认替代型号";
      const reason = price.warnings && price.warnings.length > 0
        ? `${reasonBase}；${price.warnings.join("；")}`
        : reasonBase;
      const options = await buildPendingDecisionOptions(line, {
        decisionType: "missing_reliable_price",
        webPricing: params.webPricing,
        webSuppliers: params.webSuppliers,
      });
      return {
        line: {
          lineNo,
          partNumber: line.partNumber,
          description: line.description,
          designator: line.designator,
          manufacturer: line.manufacturer,
          quantity: line.quantity,
          decisionType: "missing_reliable_price" as const,
          needsCustomerDecision: true,
          priceSource: price.source,
          reason,
        },
        pendingDecision: {
          lineNo,
          description: line.description,
          originalPartText: line.rawText || line.partNumber,
          decisionType: "missing_reliable_price" as const,
          reason,
          recommendedAction: "请确认价格来源或接受候选型号后重新报价",
          options,
          question: `请确认第 ${lineNo} 行器件 ${line.partNumber} 的价格或可接受替代料`,
        },
      };
    }

    const subtotal = Number((line.quantity * price.unitPrice).toFixed(4));
    const reasonBase =
      price.source === "input"
        ? "使用 BOM 内价格"
        : price.source === "manual"
          ? "使用人工维护价格"
          : price.source === "catalog"
            ? "使用已记录的器件价格"
            : `使用 ${price.source} 网站抓取价格`;
    const reason = price.warnings && price.warnings.length > 0
      ? `${reasonBase}；${price.warnings.join("；")}`
      : reasonBase;

    return {
      line: {
        lineNo,
        partNumber: line.partNumber,
        description: line.description,
        designator: line.designator,
        manufacturer: line.manufacturer,
        quantity: line.quantity,
        unitPrice: price.unitPrice,
        subtotal,
        decisionType: "resolved" as const,
        needsCustomerDecision: false,
        priceSource: price.source,
        priceUpdatedAt: price.updatedAt,
        priceConfidence: derivePriceConfidence({
          priceSource: price.source,
          priceUpdatedAt: price.updatedAt,
          sourceRecordedAt: price.sourceRecordedAt,
          decisionType: "resolved",
        }),
        supplier: price.supplier,
        sourceUrl: price.sourceUrl,
        reason,
      },
    };
  }));
  const lines = lineResults.map((result) => result.line);
  const pendingDecisions = lineResults.flatMap((result) =>
    result.pendingDecision ? [result.pendingDecision] : [],
  );
  const subtotal = Number(lines.reduce((acc, item) => acc + (item.subtotal ?? 0), 0).toFixed(4));
  const tax = Number((subtotal * taxRate).toFixed(4));
  const grandTotal = Number((subtotal + tax).toFixed(4));
  const warnings =
    pendingDecisions.length > 0
      ? [`存在 ${pendingDecisions.length} 条待确认器件，报价结果仅覆盖已能可靠定价的明细`]
      : [];
  const status = pendingDecisions.length > 0 ? "completed_with_decisions" : "completed";

  return {
    jobId: params.jobId,
    status,
    currency: params.currency || "CNY",
    taxRate,
    totals: { subtotal, tax, grandTotal },
    lines,
    pendingDecisions,
    failures: [],
    warnings,
  };
}
