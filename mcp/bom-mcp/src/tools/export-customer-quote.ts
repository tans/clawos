import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { quoteCustomerMessage } from "../domain/quote-customer-message";
import { multiBomToCsv, multiBomToXlsx } from "./export-shared";
import { validateTaxRate } from "./quote-params";
import { resolveRuntimeEnv } from "../runtime-env";
import type { ExportFormat, ExportQuoteOutput } from "../types";

interface ExportCustomerQuoteInput {
  message: string;
  customer?: string;
  currency?: string;
  taxRate?: number;
  webPricing?: boolean;
  webSuppliers?: Array<"digikey_cn" | "ickey_cn" | "ic_net">;
  format?: ExportFormat;
}

function assertFormat(format: ExportFormat): void {
  if (format !== "json" && format !== "csv" && format !== "xlsx") {
    throw new Error(`不支持的导出格式: ${format}`);
  }
}

const MIME_TYPES: Record<ExportFormat, string> = {
  json: "application/json",
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function exportCustomerQuoteTool(input: ExportCustomerQuoteInput): Promise<ExportQuoteOutput> {
  if (!input.message?.trim()) {
    throw new Error("message 不能为空");
  }
  validateTaxRate(input.taxRate, "taxRate");

  const format = input.format || "xlsx";
  assertFormat(format);

  const result = await quoteCustomerMessage({
    message: input.message,
    customer: input.customer,
    currency: input.currency,
    taxRate: input.taxRate,
    webPricing: input.webPricing,
    webSuppliers: input.webSuppliers,
  });

  const { exportDir, publicBaseUrl } = resolveRuntimeEnv();
  await mkdir(exportDir, { recursive: true });

  const fileName = `${result.requestId}.${format}`;
  const absolutePath = resolve(exportDir, fileName);
  const body =
    format === "json"
      ? JSON.stringify(result, null, 2)
      : format === "csv"
        ? multiBomToCsv(result)
        : multiBomToXlsx(result);

  if (typeof body === "string") {
    await writeFile(absolutePath, body, "utf-8");
  } else {
    await writeFile(absolutePath, body);
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const output: ExportQuoteOutput = {
    filePath: absolutePath,
    fileName,
    format,
    mimeType: MIME_TYPES[format],
    expiresAt,
  };

  if (publicBaseUrl) {
    output.downloadUrl = `${publicBaseUrl}/${encodeURIComponent(fileName)}`;
  }

  return output;
}
