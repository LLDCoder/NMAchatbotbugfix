import { isArabicLanguage } from "@/localization/language";
import type { AdminRefundTicketListItemDto } from "@/services/refunds";

const EMPTY_VALUE = "-";

const normalizeText = (value?: unknown) => String(value ?? "").trim();

const resolveLocalizedText = (
  englishValue: unknown,
  arabicValue: unknown,
  fallback: string,
  language?: string | null,
) => {
  const englishText = normalizeText(englishValue);
  const arabicText = normalizeText(arabicValue);

  if (isArabicLanguage(language)) {
    return arabicText || englishText || fallback;
  }

  return englishText || arabicText || fallback;
};

export function resolveAdminRefundListDisplayFields(
  item: AdminRefundTicketListItemDto,
  language?: string | null,
) {
  const category =
    normalizeText(item.refundCategoryObj?.nameEn) ||
    normalizeText(item.refundCategory) ||
    normalizeText(item.refundCategoryObj?.nameAr) ||
    EMPTY_VALUE;
  const sla =
    normalizeText(item.slaObj?.nameEn) ||
    normalizeText(item.sla) ||
    normalizeText(item.slaObj?.nameAr) ||
    EMPTY_VALUE;

  return {
    category,
    categoryDisplay: resolveLocalizedText(
      item.refundCategoryObj?.nameEn,
      item.refundCategoryObj?.nameAr,
      category,
      language,
    ),
    applyForName: resolveLocalizedText(
      item.applyFor?.userName,
      item.applyFor?.userNameAr,
      EMPTY_VALUE,
      language,
    ),
    sla,
    slaDisplay: resolveLocalizedText(
      item.slaObj?.nameEn,
      item.slaObj?.nameAr,
      sla,
      language,
    ),
  };
}
