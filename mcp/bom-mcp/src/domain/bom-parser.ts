import type { BomLine, BomSourceType } from "../types";
import { parseXlsxBom } from "./xlsx-parser";

function toRawText(parts: Array<unknown>): string | undefined {
  const text = parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" | ");
  return text || undefined;
}

interface CsvRow {
  lineNo: number;
  cols: string[];
  rawText: string;
}

function parseCsvRows(content: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cols: string[] = [];
  let current = "";
  let rawText = "";
  let inQuotes = false;
  let rowLineNo = 1;
  let currentLineNo = 1;

  const pushCell = () => {
    cols.push(current.trim());
    current = "";
  };

  const pushRow = () => {
    pushCell();
    rows.push({ lineNo: rowLineNo, cols, rawText });
    cols = [];
    rawText = "";
  };

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '"') {
      rawText += ch;
      if (inQuotes && content[i + 1] === '"') {
        current += '"';
        rawText += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      pushCell();
      rawText += ch;
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      pushRow();
      if (ch === "\r" && content[i + 1] === "\n") {
        i += 1;
      }
      currentLineNo += 1;
      rowLineNo = currentLineNo;
      continue;
    }

    if (ch === "\r" || ch === "\n") {
      current += "\n";
      rawText += ch;
      if (ch === "\r" && content[i + 1] === "\n") {
        rawText += "\n";
        i += 1;
      }
      currentLineNo += 1;
      continue;
    }

    current += ch;
    rawText += ch;
  }

  if (current.length > 0 || cols.length > 0 || rawText.length > 0) {
    pushRow();
  }

  return rows;
}

function findHeaderIndex(header: string[], keys: string[]): number {
  for (const key of keys) {
    const index = header.indexOf(key);
    if (index >= 0) {
      return index;
    }
  }
  return -1;
}

function parseCsv(content: string): BomLine[] {
  const rows = parseCsvRows(content);
  const headerIndex = rows.findIndex((row) => row.cols.some((col) => col.trim().length > 0));
  if (headerIndex < 0) {
    return [];
  }
  const header = rows[headerIndex]?.cols.map((item) => item.trim().toLowerCase()) ?? [];
  const partIndex = findHeaderIndex(header, ["partnumber", "part number", "mpn", "manufacturer part number"]);
  const qtyIndex = findHeaderIndex(header, ["quantity", "qty"]);
  const priceIndex = findHeaderIndex(header, ["unitprice", "unit price", "price"]);
  const descIndex = findHeaderIndex(header, ["description", "desc"]);
  const designatorIndex = findHeaderIndex(header, ["designator", "reference", "refdes"]);
  const manufacturerIndex = findHeaderIndex(header, ["manufacturer", "mfr", "vendor"]);
  if (partIndex < 0 || qtyIndex < 0) {
    throw new Error("CSV 缺少必要列: partNumber, quantity");
  }

  const result: BomLine[] = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row === undefined) {
      continue;
    }
    const cols = row.cols;
    result.push({
      lineNo: row.lineNo,
      partNumber: cols[partIndex] || "",
      quantity: Number(cols[qtyIndex] || 0),
      unitPrice: priceIndex >= 0 ? Number(cols[priceIndex] || 0) : undefined,
      description: descIndex >= 0 ? cols[descIndex] : undefined,
      designator: designatorIndex >= 0 ? cols[designatorIndex] : undefined,
      manufacturer: manufacturerIndex >= 0 ? cols[manufacturerIndex] : undefined,
      rawText: row.rawText || undefined,
    });
  }
  return result;
}

function parseJson(content: string): BomLine[] {
  const parsed = JSON.parse(content) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("JSON BOM 必须是数组");
  }
  return parsed.map((row, index) => {
    const item = row as Record<string, unknown>;
    const lineNo =
      typeof item.lineNo === "number" && Number.isFinite(item.lineNo) ? item.lineNo : index + 1;
    return {
      lineNo,
      partNumber: String(item.partNumber || item.mpn || "").trim(),
      quantity: Number(item.quantity || 0),
      unitPrice: item.unitPrice === undefined ? undefined : Number(item.unitPrice),
      description: item.description ? String(item.description) : undefined,
      designator: item.designator ? String(item.designator) : undefined,
      manufacturer: item.manufacturer ? String(item.manufacturer) : undefined,
      rawText:
        (item.rawText ? String(item.rawText).trim() : "") ||
        toRawText([item.partNumber, item.mpn, item.description, item.designator, item.manufacturer]),
    };
  });
}

export function parseBom(
  sourceType: BomSourceType,
  content: string | ArrayBuffer | Uint8Array,
): BomLine[] {
  if (typeof content === "string") {
    if (!content.trim()) {
      throw new Error("BOM 内容不能为空");
    }
    if (sourceType === "csv") {
      return parseCsv(content);
    }
    if (sourceType === "xlsx") {
      throw new Error("xlsx 需要二进制内容");
    }
    return parseJson(content);
  }
  if (content instanceof ArrayBuffer && content.byteLength === 0) {
    throw new Error("BOM 内容不能为空");
  }
  if (content instanceof Uint8Array && content.length === 0) {
    throw new Error("BOM 内容不能为空");
  }
  if (sourceType !== "xlsx") {
    throw new Error("非 xlsx 格式需要文本内容");
  }
  return parseXlsxBom(content);
}
