import * as XLSX from "xlsx";
import type { BomLine } from "../types";

function normalizeRowKeys(row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), String(value ?? "")]),
  );
}

function pickFirstValue(row: Record<string, unknown>, keys: string[]): string {
  const normalized = normalizeRowKeys(row);
  for (const key of keys) {
    const value = normalized[key.toLowerCase()];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function buildRowRawText(row: Record<string, unknown>): string | undefined {
  const text = Object.entries(row)
    .map(([header, value]) => [header.trim(), String(value ?? "").trim()] as const)
    .filter(([, value]) => value.length > 0)
    .map(([header, value]) => `${header}: ${value}`)
    .join(" | ");
  return text || undefined;
}

const XlsxAliases = {
  partNumber: [
    "alternative pn",
    "jofre pn",
    "manufacturer part number 1",
    "manufacturer part number",
    "mpn",
    "part number",
    "partnumber",
    "p/n",
  ],
  quantity: ["quantity", "qty", "кол-во"],
  description: ["description", "наименование"],
  designator: ["designator", "reference", "refdes"],
  manufacturer: ["alternative mnf", "manufacturer 1", "manufacturer", "mfr", "производитель"],
} as const;

const HeaderHints = new Set(
  Object.values(XlsxAliases)
    .flat()
    .map((alias) => alias.toLowerCase()),
);

export function parseXlsxBom(input: ArrayBuffer | Uint8Array): BomLine[] {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Array<unknown>>(sheet, { defval: "", header: 1, blankrows: true });
  const headerIndex = rows.findIndex((row) => {
    const normalized = row
      .map((cell) => String(cell ?? "").trim().toLowerCase())
      .filter(Boolean);
    const matchCount = normalized.filter((value) => HeaderHints.has(value)).length;
    return matchCount >= 2;
  });

  if (headerIndex < 0) {
    return [];
  }

  const headerRow = rows[headerIndex] ?? [];
  const headers = headerRow.map((cell) => String(cell ?? "").trim());
  const dataRows = rows.slice(headerIndex + 1);

  return dataRows
    .map((row, index) => {
      const worksheetRow = headerIndex + 2 + index;
      const record: Record<string, unknown> = {};
      row.forEach((cell, columnIndex) => {
        const header = headers[columnIndex];
        if (header) {
          record[header] = cell;
        }
      });
      return {
        lineNo: worksheetRow,
        partNumber: pickFirstValue(record, [...XlsxAliases.partNumber]),
        quantity: Number(pickFirstValue(record, [...XlsxAliases.quantity]) || 0),
        description: pickFirstValue(record, [...XlsxAliases.description]) || undefined,
        designator: pickFirstValue(record, [...XlsxAliases.designator]) || undefined,
        manufacturer: pickFirstValue(record, [...XlsxAliases.manufacturer]) || undefined,
        rawText: buildRowRawText(record),
      };
    })
    .filter((line) => line.partNumber.length > 0);
}
