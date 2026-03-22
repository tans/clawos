import { getQuote } from "./get-quote";
import type { ExportFormat, ExportQuoteOutput } from "../types";

function assertFormat(format: ExportFormat): void {
  if (format !== "json" && format !== "csv" && format !== "xlsx") {
    throw new Error(`不支持的导出格式: ${format}`);
  }
}

export async function exportQuote(jobId: string, format: ExportFormat): Promise<ExportQuoteOutput> {
  assertFormat(format);
  await getQuote(jobId);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  return {
    downloadUrl: `/downloads/mock/bom-quote/${encodeURIComponent(jobId)}.${format}`,
    expiresAt,
  };
}
