import type { BomLine, BomSourceType } from "../types";

function parseCsv(content: string): BomLine[] {
  const rows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length === 0) {
    return [];
  }
  const header = rows[0].split(",").map((item) => item.trim().toLowerCase());
  const partIndex = header.indexOf("partnumber");
  const qtyIndex = header.indexOf("quantity");
  const priceIndex = header.indexOf("unitprice");
  const descIndex = header.indexOf("description");
  if (partIndex < 0 || qtyIndex < 0) {
    throw new Error("CSV 缺少必要列: partNumber, quantity");
  }

  return rows.slice(1).map((line) => {
    const cols = line.split(",").map((item) => item.trim());
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
