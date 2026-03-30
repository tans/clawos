import type { QuoteLineDecisionType, QuotePriceConfidence, QuotePriceSource } from "../types";

function isFreshEnough(recordedAt: string | undefined, maxAgeDays: number): boolean {
  if (!recordedAt) {
    return false;
  }
  const recordedTime = Date.parse(recordedAt);
  if (Number.isNaN(recordedTime)) {
    return false;
  }
  return Date.now() - recordedTime <= maxAgeDays * 24 * 60 * 60 * 1000;
}

function classifyStoredPriceFreshness(recordedAt: string | undefined): QuotePriceConfidence {
  if (isFreshEnough(recordedAt, 30)) {
    return "high";
  }
  if (isFreshEnough(recordedAt, 90)) {
    return "medium";
  }
  return "low";
}

export function derivePriceConfidence(params: {
  priceSource?: QuotePriceSource;
  priceUpdatedAt?: string;
  sourceRecordedAt?: string;
  decisionType: QuoteLineDecisionType;
}): QuotePriceConfidence {
  if (params.decisionType !== "resolved" || !params.priceSource || !params.priceUpdatedAt) {
    return "low";
  }

  switch (params.priceSource) {
    case "input":
      return "high";
    case "manual":
      return classifyStoredPriceFreshness(params.sourceRecordedAt);
    case "catalog":
      return isFreshEnough(params.sourceRecordedAt, 30) ? "medium" : "low";
    case "digikey_cn":
      return isFreshEnough(params.sourceRecordedAt, 7) ? "medium" : "low";
    case "ic_net":
      return "low";
    default:
      return "low";
  }
}
