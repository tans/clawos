import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getQuote } from "./get-quote";
import { singleBomToCsv, singleBomToXlsx } from "./export-shared";
import { recordExport } from "../infra/store";
import { resolveRuntimeEnv } from "../runtime-env";
import type { ExportFormat, ExportQuoteOutput } from "../types";

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

export async function exportQuote(jobId: string, format: ExportFormat): Promise<ExportQuoteOutput> {
  assertFormat(format);
  const quote = await getQuote(jobId);

  const { exportDir, publicBaseUrl } = resolveRuntimeEnv();
  await mkdir(exportDir, { recursive: true });

  const extension = format;
  const fileName = `${jobId}.${extension}`;
  const absolutePath = resolve(exportDir, fileName);

  const body =
    format === "json" ? JSON.stringify(quote, null, 2) : format === "csv" ? singleBomToCsv(quote) : singleBomToXlsx(quote);
  if (typeof body === "string") {
    await writeFile(absolutePath, body, "utf-8");
  } else {
    await writeFile(absolutePath, body);
  }

  const checksum = createHash("sha256").update(body).digest("hex");
  const exportId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  recordExport({ exportId, jobId, format: extension, filePath: absolutePath, checksum });

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const result: ExportQuoteOutput = {
    filePath: absolutePath,
    fileName,
    format,
    mimeType: MIME_TYPES[format],
    expiresAt,
  };

  if (publicBaseUrl) {
    result.downloadUrl = `${publicBaseUrl}/${encodeURIComponent(fileName)}`;
  }

  return result;
}
