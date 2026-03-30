import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { getQuote } from "./get-quote";
import { recordExport } from "../infra/store";
import type { ExportFormat, ExportQuoteOutput } from "../types";

function assertFormat(format: ExportFormat): void {
  if (format !== "json" && format !== "csv" && format !== "xlsx") {
    throw new Error(`不支持的导出格式: ${format}`);
  }
}

type QuoteData = Awaited<ReturnType<typeof getQuote>>;

function formatCandidateOptions(options: Array<{
  manufacturer?: string;
  partNumber: string;
  unitPrice?: number;
  currency?: string;
  leadTime?: string;
  moq?: number;
  note?: string;
}>): string {
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

function buildLineExportRows(quote: QuoteData): Array<Record<string, string | number>> {
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
      priceConfidence: line.priceConfidence ?? "",
      note: pending?.reason ?? line.reason,
      reason: line.reason,
      recommendedAction: pending?.recommendedAction ?? "",
      candidateOptions: pending ? formatCandidateOptions(pending.options) : "",
      originalPartText: pending?.originalPartText ?? "",
    };
  });
}

function toCsv(quote: QuoteData): string {
  const rows = buildLineExportRows(quote);
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
    priceConfidence: "",
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

function toXlsx(quote: QuoteData): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const lineRows = buildLineExportRows(quote);
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

export async function exportQuote(jobId: string, format: ExportFormat): Promise<ExportQuoteOutput> {
  assertFormat(format);
  const quote = await getQuote(jobId);

  const outputDir = resolve(process.cwd(), "artifacts", "mcp", "bom-mcp", "exports");
  await mkdir(outputDir, { recursive: true });

  const extension = format;
  const fileName = `${jobId}.${extension}`;
  const absolutePath = resolve(outputDir, fileName);

  const body =
    format === "json" ? JSON.stringify(quote, null, 2) : format === "csv" ? toCsv(quote) : toXlsx(quote);
  if (typeof body === "string") {
    await writeFile(absolutePath, body, "utf-8");
  } else {
    await writeFile(absolutePath, body);
  }

  const checksum = createHash("sha256").update(body).digest("hex");
  const exportId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  recordExport({ exportId, jobId, format: extension, filePath: absolutePath, checksum });

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    downloadUrl: `/artifacts/mcp/bom-mcp/exports/${encodeURIComponent(fileName)}`,
    expiresAt,
  };
}
