import { isArabicLanguage } from "@/localization/language";
import type { RefundStatusItemDto } from "@/services/refunds";
import type { RefundFilterSelectOption } from "./types";

const normalizeText = (value?: unknown) => String(value ?? "").trim();

export function mapRefundFilterSelectOptions(
  items?: RefundStatusItemDto[] | null,
  language?: string | null,
  allowedValues?: readonly string[],
): RefundFilterSelectOption[] {
  const useArabic = isArabicLanguage(language);
  const allowedValueSet = allowedValues
    ? new Set(allowedValues.map((value) => normalizeText(value).toLowerCase()))
    : null;
  const seen = new Set<string>();

  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const nameEn = normalizeText(item?.nameEn);
      const nameAr = normalizeText(item?.nameAr);
      const code = normalizeText(item?.code);
      const value = nameEn || code || normalizeText(item?.id);
      const label = useArabic
        ? nameAr || nameEn || code
        : nameEn || nameAr || code;

      return {
        value,
        label: label || value,
      };
    })
    .filter((option) => {
      if (!option.value || !option.label) return false;

      const normalizedValue = option.value.toLowerCase();
      if (allowedValueSet && !allowedValueSet.has(normalizedValue)) return false;
      if (seen.has(normalizedValue)) return false;

      seen.add(normalizedValue);
      return true;
    });
}
