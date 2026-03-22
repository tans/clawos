import type { BomLine } from "../types";

const DEFAULT_PRICE = 1;

export function computeLinePrice(line: BomLine): number {
  const price = line.unitPrice === undefined || line.unitPrice <= 0 ? DEFAULT_PRICE : line.unitPrice;
  return Number(price.toFixed(4));
}
