import type { BomLine, PendingDecisionOption, QuoteLineDecisionType } from "../types";
import { buildCandidateSearchQuery, looksLikeSpecificPartNumber } from "./component-classifier";
import { lookupWebCandidates, type WebSupplier } from "./web-pricing";

function fallbackCandidateOptions(line: BomLine): PendingDecisionOption[] {
  const normalized = line.partNumber.trim().toUpperCase();

  if (normalized === "68U") {
    return [
      {
        manufacturer: "YMIN",
        partNumber: "VKMD1001J680MV",
        note: "68u electrolytic capacitor candidate",
      },
      {
        manufacturer: "Samsung Electro-Mechanics",
        partNumber: "CS3225X5R476K160NRL",
        note: "high-capacitance MLCC candidate, verify capacitance/package before use",
      },
    ];
  }

  return [];
}

export async function buildPendingDecisionOptions(
  line: BomLine,
  params: {
    decisionType: Extract<QuoteLineDecisionType, "ambiguous_candidates" | "missing_reliable_price">;
    webPricing?: boolean;
    webSuppliers?: WebSupplier[];
  },
): Promise<PendingDecisionOption[]> {
  const shouldUseWebCandidates = params.webPricing && (
    params.decisionType === "missing_reliable_price" ||
    looksLikeSpecificPartNumber(line.partNumber)
  );

  if (shouldUseWebCandidates) {
    const query = buildCandidateSearchQuery(line);
    const webOptions = await lookupWebCandidates(query, params.webSuppliers);
    if (webOptions.length > 0) {
      if (params.decisionType === "missing_reliable_price") {
        const exactPartNumber = line.partNumber.trim().toUpperCase();
        return webOptions
          .filter((option) => option.partNumber.trim().toUpperCase() === exactPartNumber)
          .slice(0, 5);
      }
      return webOptions.slice(0, 5);
    }
  }

  if (params.decisionType === "missing_reliable_price") {
    return [];
  }

  return fallbackCandidateOptions(line);
}
