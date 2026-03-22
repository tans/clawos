export type Locale = "zh-CN" | "en";

export type TranslationParams = Record<string, string | number>;

export type TranslationTable = Record<Locale, Record<string, string>>;

export function resolveLocale(
  preferred: string | null | undefined,
  fallback: Locale = "zh-CN",
): Locale {
  if (preferred === "en") return "en";
  if (preferred === "zh-CN") return "zh-CN";
  return fallback;
}

export function translate(
  table: TranslationTable,
  locale: Locale,
  key: string,
  params: TranslationParams = {},
): string {
  const template =
    table[locale]?.[key] ?? table["zh-CN"]?.[key] ?? key;

  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params[name] ?? ""),
  );
}
