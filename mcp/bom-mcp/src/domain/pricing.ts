import type { BomLine } from "../types";
import { getLatestPartPrice } from "../infra/store";

const DEFAULT_PRICE = 1;

export interface LinePriceResolution {
  unitPrice: number;
  source: "input" | "catalog" | "default";
}

export function resolveLinePrice(line: BomLine): LinePriceResolution {
  const directPrice = line.unitPrice !== undefined && line.unitPrice > 0 ? line.unitPrice : null;
  if (directPrice !== null) {
    return { unitPrice: Number(directPrice.toFixed(4)), source: "input" };
  }

  const catalogPrice = getLatestPartPrice(line.partNumber);
  if (catalogPrice !== null && catalogPrice > 0) {
    return { unitPrice: Number(catalogPrice.toFixed(4)), source: "catalog" };
  }

  return { unitPrice: Number(DEFAULT_PRICE.toFixed(4)), source: "default" };
}

export function computeLinePrice(line: BomLine): number {
  return resolveLinePrice(line).unitPrice;
}
