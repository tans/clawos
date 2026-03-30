import type { BomLine } from "../types";

export function normalizeBomLines(lines: BomLine[]): BomLine[] {
  return lines
    .map((line) => ({
      lineNo: Number.isFinite(line.lineNo) ? line.lineNo : undefined,
      partNumber: line.partNumber.trim().toUpperCase(),
      quantity: Math.max(0, Math.floor(line.quantity)),
      unitPrice: line.unitPrice === undefined || Number.isNaN(line.unitPrice) ? undefined : Number(line.unitPrice),
      description: line.description?.trim() || undefined,
      designator: line.designator?.trim() || undefined,
      manufacturer: line.manufacturer?.trim() || undefined,
      rawText: line.rawText?.trim() || undefined,
    }))
    .filter((line) => line.partNumber.length > 0 && line.quantity > 0);
}
