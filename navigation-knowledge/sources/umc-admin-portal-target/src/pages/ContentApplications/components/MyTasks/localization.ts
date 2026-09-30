import type { TFunction } from "i18next";
import type { ServiceCategory } from "@/services/serviceApi";
import type {
  TCategoriesSelection,
  TStatusSelection,
} from "./type";

export const getDefaultApprovalResults = (
  t: TFunction,
): TStatusSelection[] => [
  {
    label: t("Content.contentApplications.approvalResults.approved"),
    value: "Approved",
  },
  {
    label: t("Content.contentApplications.approvalResults.rejected"),
    value: "Rejected",
  },
  {
    label: t(
      "Content.contentApplications.approvalResults.requestModification",
    ),
    value: "Request Modification",
  },
  {
    label: t("Content.contentApplications.approvalResults.externalApproval"),
    value: "External Approval",
  },
  {
    label: t("Content.contentApplications.approvalResults.sendBack"),
    value: "Send Back",
  },
  {
    label: "-",
    value: "-",
  },
];

export const getServiceCategoryOptions = (
  categories: Pick<ServiceCategory, "id" | "nameAr" | "nameEn">[],
  isArabic: boolean,
): TCategoriesSelection[] =>
  // No "all categories" entry: leaving the filter empty already drops
  // serviceCategoryId from the request, so an option carrying the same label as
  // the placeholder would only duplicate what clearing the field does.
  categories.map((item) => ({
    label: isArabic
      ? item.nameAr || item.nameEn
      : item.nameEn || item.nameAr,
    value: item.id,
  }));
