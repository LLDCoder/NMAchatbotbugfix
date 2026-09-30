import React from "react";
import arEG from "antd/lib/locale/ar_EG";
import enUS from "antd/lib/locale/en_US";
import { isArabicLanguage } from "@/localization/language";

export function getAntdLocale(language: string) {
  if (isArabicLanguage(language)) {
    return {
      ...arEG,
      Pagination: {
        ...arEG.Pagination,
        items_per_page: "/الصفحة",
        page_size: "حجم الصفحة",
      },
    };
  }
  return enUS;
}

export function buildPaginationOptionText(
  value: string | number,
  language: string,
): React.ReactNode {
  const pageLabel = isArabicLanguage(language) ? "الصفحة" : "page";
  return React.createElement("span", { dir: "ltr" }, `${value}/${pageLabel}`);
}
