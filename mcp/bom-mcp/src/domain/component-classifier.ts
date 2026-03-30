import type { BomLine } from "../types";

const GENERIC_COMPONENT_PATTERN = /^(?:\d+(?:\.\d+)?(?:p|n|u|uf|nf|pf|mh|uh|ohm|r|k|m|a|v)|cr\d{4}\s+)/i;
const SPECIFIC_PART_PATTERN = /^[A-Z0-9][A-Z0-9\-./]{4,}$/;
const CAPACITOR_HINT_PATTERN = /\b(?:\d+(?:\.\d+)?(?:p|n|u|uf|nf|pf)|x[57]r|np0|capacitor)\b/i;

export type ComponentFamily = "capacitor" | "battery" | "unknown";

function hasLettersAndNumbers(value: string): boolean {
  return /[A-Z]/.test(value) && /\d/.test(value);
}

export function looksLikeSpecificPartNumber(partNumber: string): boolean {
  const normalized = partNumber.trim().toUpperCase();
  if (!normalized || normalized.includes(" ")) {
    return false;
  }
  if (!SPECIFIC_PART_PATTERN.test(normalized)) {
    return false;
  }
  return hasLettersAndNumbers(normalized);
}

export function isAmbiguousElectronicComponent(line: BomLine): boolean {
  const normalized = line.partNumber.trim().toUpperCase();
  if (!normalized) {
    return true;
  }
  if (looksLikeSpecificPartNumber(normalized)) {
    return false;
  }
  if (GENERIC_COMPONENT_PATTERN.test(normalized)) {
    return true;
  }
  if (normalized.includes(" ")) {
    return true;
  }
  return normalized.length < 6;
}

export function inferComponentFamily(line: BomLine): ComponentFamily {
  const text = [line.partNumber, line.description, line.rawText].filter(Boolean).join(" ");
  if (/CR2032/i.test(text)) {
    return "battery";
  }
  if (CAPACITOR_HINT_PATTERN.test(text)) {
    return "capacitor";
  }
  return "unknown";
}

export function buildCandidateSearchQuery(line: BomLine): string {
  const base = line.rawText?.trim() || line.description?.trim() || line.partNumber.trim();
  const family = inferComponentFamily(line);
  if (family === "capacitor" && !/\bcapacitor\b/i.test(base)) {
    return `${base} capacitor`;
  }
  if (family === "battery" && !/\bbattery\b/i.test(base)) {
    return `${base} battery`;
  }
  return base;
}
