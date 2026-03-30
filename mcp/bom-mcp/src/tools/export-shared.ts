import * as XLSX from "xlsx";
import type { MultiBomQuoteResult, QuoteResult } from "../types";

type CandidateOption = {
  manufacturer?: string;
  partNumber: string;
  unitPrice?: number;
  currency?: string;
  leadTime?: string;
  moq?: number;
  note?: string;
};

export function formatCandidateOptions(options: CandidateOption[]): string {
  return options
    .map((option) => {
      const parts = [option.manufacturer, option.partNumber].filter(Boolean);
      if (option.unitPrice !== undefined) {
        parts.push(`${option.currency || "CNY"} ${option.unitPrice}`);
      }
      if (option.moq !== undefined) {
        parts.push(`MOQ ${option.moq}`);
      }
      if (option.leadTime) {
        parts.push(`LT ${option.leadTime}`);
      }
      if (option.note) {
        parts.push(option.note);
      }
      return parts.join(" | ");
    })
    .join(" ; ");
}

export function buildSingleBomLineExportRows(quote: QuoteResult): Array<Record<string, string | number>> {
  const pendingByLineNo = new Map(quote.pendingDecisions.map((decision) => [decision.lineNo, decision]));

  return quote.lines.map((line) => {
    const pending = pendingByLineNo.get(line.lineNo);
    return {
      lineNo: line.lineNo,
      decisionType: line.decisionType,
      needsCustomerDecision: line.needsCustomerDecision ? "yes" : "no",
      partNumber: line.partNumber,
      selectedPartNumber: line.partNumber,
      description: line.description ?? "",
      designator: line.designator ?? "",
      manufacturer: line.manufacturer ?? "",
      selectedManufacturer: line.manufacturer ?? "",
      quantity: line.quantity,
      unitPrice: line.unitPrice ?? "",
      lineTotal: line.subtotal ?? "",
      moq: "",
      leadTime: "",
      currency: quote.currency,
      priceSource: line.priceSource ?? "",
      priceUpdatedAt: line.priceUpdatedAt ?? "",
      sourceRecordedAt: line.sourceRecordedAt ?? "",
      priceConfidence: line.priceConfidence ?? "",
      pricingState: line.pricingState ?? "",
      sourceUrl: line.sourceUrl ?? "",
      note: pending?.reason ?? line.reason,
      reason: line.reason,
      recommendedAction: pending?.recommendedAction ?? "",
      candidateOptions: pending ? formatCandidateOptions(pending.options) : "",
      originalPartText: pending?.originalPartText ?? "",
    };
  });
}

function flattenMultiBomLineRows(result: MultiBomQuoteResult): Array<Record<string, string | number>> {
  return result.boms.flatMap((bom) => {
    const pendingByLineNo = new Map(bom.pendingDecisions.map((decision) => [decision.lineNo, decision]));
    return bom.lines.map((line) => {
      const pending = pendingByLineNo.get(line.lineNo);
      return {
        bomId: bom.bomId,
        bomName: bom.bomName,
        quotedAt: bom.quotedAt,
        lineNo: line.lineNo,
        decisionType: line.decisionType,
        needsCustomerDecision: line.needsCustomerDecision ? "yes" : "no",
        partNumber: line.partNumber,
        selectedPartNumber: line.partNumber,
        description: line.description ?? "",
        designator: line.designator ?? "",
        manufacturer: line.manufacturer ?? "",
        selectedManufacturer: line.manufacturer ?? "",
        quantity: line.quantity,
        unitPrice: line.unitPrice ?? "",
        lineTotal: line.subtotal ?? "",
        moq: "",
        leadTime: "",
        currency: bom.currency,
        priceSource: line.priceSource ?? "",
        priceUpdatedAt: line.priceUpdatedAt ?? "",
        sourceRecordedAt: line.sourceRecordedAt ?? "",
        priceConfidence: line.priceConfidence ?? "",
        pricingState: line.pricingState ?? "",
        sourceUrl: line.sourceUrl ?? "",
        note: pending?.reason ?? line.reason,
        reason: line.reason,
        recommendedAction: pending?.recommendedAction ?? "",
        candidateOptions: pending ? formatCandidateOptions(pending.options) : "",
        originalPartText: pending?.originalPartText ?? "",
      };
    });
  });
}

export function singleBomToCsv(quote: QuoteResult): string {
  const rows = buildSingleBomLineExportRows(quote);
  const header = Object.keys(rows[0] ?? {
    lineNo: "",
    decisionType: "",
    needsCustomerDecision: "",
    partNumber: "",
    selectedPartNumber: "",
    description: "",
    designator: "",
    manufacturer: "",
    selectedManufacturer: "",
    quantity: "",
    unitPrice: "",
    lineTotal: "",
    moq: "",
    leadTime: "",
    currency: "",
    priceSource: "",
    priceUpdatedAt: "",
    sourceRecordedAt: "",
    priceConfidence: "",
    pricingState: "",
    sourceUrl: "",
    note: "",
    reason: "",
    recommendedAction: "",
    candidateOptions: "",
    originalPartText: "",
  });
  const bodyRows = rows.map((row) =>
    header
      .map((key) => {
        const escaped = String(row[key] ?? "").replace(/"/g, '""');
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
      })
      .join(","),
  );
  return `${header.join(",")}\n${bodyRows.join("\n")}\n`;
}

export function singleBomToXlsx(quote: QuoteResult): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const lineRows = buildSingleBomLineExportRows(quote);
  const summaryRows = [
    { key: "status", value: quote.status },
    { key: "currency", value: quote.currency },
    { key: "subtotal", value: quote.totals.subtotal },
    { key: "taxRate", value: quote.taxRate },
    { key: "tax", value: quote.totals.tax },
    { key: "grandTotal", value: quote.totals.grandTotal },
    { key: "warnings", value: quote.warnings.join(" ; ") },
  ];

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(lineRows), "Lines");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function multiBomToCsv(result: MultiBomQuoteResult): string {
  const rows = flattenMultiBomLineRows(result);
  const header = Object.keys(rows[0] ?? {
    bomId: "",
    bomName: "",
    quotedAt: "",
    lineNo: "",
    decisionType: "",
    needsCustomerDecision: "",
    partNumber: "",
    selectedPartNumber: "",
    description: "",
    designator: "",
    manufacturer: "",
    selectedManufacturer: "",
    quantity: "",
    unitPrice: "",
    lineTotal: "",
    moq: "",
    leadTime: "",
    currency: "",
    priceSource: "",
    priceUpdatedAt: "",
    sourceRecordedAt: "",
    priceConfidence: "",
    pricingState: "",
    sourceUrl: "",
    note: "",
    reason: "",
    recommendedAction: "",
    candidateOptions: "",
    originalPartText: "",
  });
  const bodyRows = rows.map((row) =>
    header
      .map((key) => {
        const escaped = String(row[key] ?? "").replace(/"/g, '""');
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
      })
      .join(","),
  );
  return `${header.join(",")}\n${bodyRows.join("\n")}\n`;
}

export function multiBomToXlsx(result: MultiBomQuoteResult): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const summaryRows = [
    { key: "requestId", value: result.requestId },
    { key: "customer", value: result.customer ?? "" },
    { key: "quotedAt", value: result.quotedAt },
    { key: "currency", value: result.currency },
    { key: "bomCount", value: result.summary.bomCount },
    { key: "totalLines", value: result.summary.totalLines },
    { key: "resolvedLines", value: result.summary.resolvedLines },
    { key: "pendingDecisionLines", value: result.summary.pendingDecisionLines },
    { key: "failedLines", value: result.summary.failedLines },
    { key: "crossBomWarnings", value: result.crossBomWarnings.join(" ; ") },
  ];
  const bomRows = result.boms.map((bom) => ({
    bomId: bom.bomId,
    bomName: bom.bomName,
    quotedAt: bom.quotedAt,
    currency: bom.currency,
    totalLines: bom.summary.totalLines,
    resolvedLines: bom.summary.resolvedLines,
    pendingDecisionLines: bom.summary.pendingDecisionLines,
    failedLines: bom.summary.failedLines,
    subtotal: bom.summary.subtotal,
    tax: bom.summary.tax,
    grandTotal: bom.summary.grandTotal,
    notes: bom.notes.join(" ; "),
  }));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(bomRows), "BOMs");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(flattenMultiBomLineRows(result)), "Lines");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
