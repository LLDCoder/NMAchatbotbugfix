/**
 * Map portal i18n (`react-i18next` / `language` cookie) to wangEditor locales.
 */
export function resolveWangEditorLocaleFromPortalLang(
  language: string | undefined,
): string {
  const lng = (language ?? "en").toLowerCase();
  if (lng.startsWith("ar")) return "ar";
  if (lng.startsWith("zh")) return "zh-CN";
  return "en";
}
