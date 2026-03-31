import { getOpenclawBomQuoteSkillConfigSync, getOpenclawBomQuoteSkillEnvValueSync } from "./openclaw-config";

interface FxRateEntry {
  pair: string;
  rate: number;
}

function normalizeCurrency(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toUpperCase();
  return trimmed ? trimmed : undefined;
}

function normalizeFxPair(fromCurrency: string, toCurrency: string): string {
  return `${fromCurrency}/${toCurrency}`;
}

function parsePositiveRate(value: string | undefined): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  const rate = Number(trimmed);
  return Number.isFinite(rate) && rate > 0 ? rate : undefined;
}

function parseFxRatesJson(): FxRateEntry[] {
  const raw = process.env.BOM_MCP_FX_RATES_JSON?.trim() || getOpenclawBomQuoteSkillEnvValueSync("BOM_MCP_FX_RATES_JSON");
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }
    return Object.entries(parsed).flatMap(([pair, value]) => {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return [];
      }
      const normalizedPair = pair.trim().toUpperCase().replace(/[_-]/g, "/");
      return normalizedPair ? [{ pair: normalizedPair, rate: value }] : [];
    });
  } catch {
    return [];
  }
}

function parseDirectEnvPair(fromCurrency: string, toCurrency: string): number | undefined {
  return parsePositiveRate(
    process.env[`BOM_MCP_FX_${fromCurrency}_${toCurrency}`] ??
      getOpenclawBomQuoteSkillEnvValueSync(`BOM_MCP_FX_${fromCurrency}_${toCurrency}`),
  );
}

function parseOpenclawSkillConfigRate(fromCurrency: string, toCurrency: string): number | undefined {
  const config = getOpenclawBomQuoteSkillConfigSync();
  const fxRates = config?.fxRates;
  if (!fxRates || typeof fxRates !== "object" || Array.isArray(fxRates)) {
    return undefined;
  }
  const exactKey = normalizeFxPair(fromCurrency, toCurrency);
  const value = (fxRates as Record<string, unknown>)[exactKey];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

export interface ResolvedFxRate {
  pair: string;
  rate: number;
  source: "env_pair" | "env_json";
}

export function resolveFxRate(fromCurrency: string, toCurrency: string): ResolvedFxRate | null {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (!from || !to || from === to) {
    return null;
  }

  const direct = parseDirectEnvPair(from, to);
  if (direct !== undefined) {
    return {
      pair: normalizeFxPair(from, to),
      rate: direct,
      source: "env_pair",
    };
  }

  for (const entry of parseFxRatesJson()) {
    if (entry.pair === normalizeFxPair(from, to)) {
      return {
        pair: entry.pair,
        rate: entry.rate,
        source: "env_json",
      };
    }
  }

  const skillConfigRate = parseOpenclawSkillConfigRate(from, to);
  if (skillConfigRate !== undefined) {
    return {
      pair: normalizeFxPair(from, to),
      rate: skillConfigRate,
      source: "env_json",
    };
  }

  return null;
}
