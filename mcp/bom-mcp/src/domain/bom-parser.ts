import type { BomLine, BomSourceType } from "../types";

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cols.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cols.push(current.trim());
  return cols;
}

function parseCsv(content: string): BomLine[] {
  const rows = content
    .split(/\r?\n/)
    .filter(Boolean);
  if (rows.length === 0) {
    return [];
  }
  const header = parseCsvLine(rows[0]).map((item) => item.trim().toLowerCase());
  const partIndex = header.indexOf("partnumber");
  const qtyIndex = header.indexOf("quantity");
  const priceIndex = header.indexOf("unitprice");
  const descIndex = header.indexOf("description");
  if (partIndex < 0 || qtyIndex < 0) {
    throw new Error("CSV 缺少必要列: partNumber, quantity");
  }

  return rows.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      partNumber: cols[partIndex] || "",
      quantity: Number(cols[qtyIndex] || 0),
      unitPrice: priceIndex >= 0 ? Number(cols[priceIndex] || 0) : undefined,
      description: descIndex >= 0 ? cols[descIndex] : undefined,
    };
  });
}

function parseJson(content: string): BomLine[] {
  const parsed = JSON.parse(content) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("JSON BOM 必须是数组");
  }
  return parsed.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      partNumber: String(item.partNumber || "").trim(),
      quantity: Number(item.quantity || 0),
      unitPrice: item.unitPrice === undefined ? undefined : Number(item.unitPrice),
      description: item.description ? String(item.description) : undefined,
    };
  });
}

export function parseBom(sourceType: BomSourceType, content: string): BomLine[] {
  if (!content.trim()) {
    throw new Error("BOM 内容不能为空");
  }
  if (sourceType === "csv") {
    return parseCsv(content);
  }
  if (sourceType === "xlsx") {
    throw new Error("v1 暂不支持 xlsx，请先转为 csv/json");
  }
  return parseJson(content);
}
