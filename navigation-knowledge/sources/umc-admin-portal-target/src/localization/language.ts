export type PortalLanguage = "en" | "ar";

const normalizeLanguageTag = (language?: string | null) =>
  String(language ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");

export const isArabicLanguage = (language?: string | null): boolean =>
  normalizeLanguageTag(language).startsWith("ar");

export const normalizePortalLanguage = (
  language?: string | null,
): PortalLanguage => (isArabicLanguage(language) ? "ar" : "en");

export const toFormilyValidateLanguage = (
  language?: string | null,
): "en-US" | "ar-AE" => (isArabicLanguage(language) ? "ar-AE" : "en-US");
