import type {
  EstablishmentInfo,
  UserManagementValueObject,
} from "@/services/userManagement";
import dayjs from "dayjs";
import {
  COMMERCIAL_PROFILE_USER_TYPE_IDS,
  EGAMING_PROFILE_USER_TYPE_IDS,
} from "./constants";
import type { StatusTone, ViewType } from "./type";

type Translate = (key: string) => string;

export const normalizeText = (value?: string | null) =>
  value?.toLowerCase().trim() ?? "";

export const isArabicLanguage = (language?: string | null) =>
  language?.toLowerCase().startsWith("ar") ?? false;

export const formatDate = (value?: string | null) =>
  value ? dayjs(value).format("DD/MM/YYYY") : "-";

export const safeText = (value?: string | number | null) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") {
    return value.trim() === "" ? "-" : value;
  }
  return String(value);
};

export const getSlaDisplayText = (value?: string | null) => {
  const normalizedValue = String(value ?? "").trim();

  return normalizedValue || "-";
};

export const getStatusTone = (statusName?: string | null): StatusTone => {
  const normalized = normalizeText(statusName);
  if (normalized.includes("pending")) return "pending";
  if (normalized.includes("approv")) return "success";
  if (normalized.includes("reject") || normalized.includes("declin")) {
    return "danger";
  }
  return "pending";
};

export const getValueObjectName = (
  value?: UserManagementValueObject | null,
  preferAr = false,
) =>
  preferAr
    ? value?.nameAr || value?.nameEn || "-"
    : value?.nameEn || value?.nameAr || "-";

const getProfileStatusTranslationKey = (statusName?: string | null) => {
  const normalized = normalizeText(statusName).replace(/[\s_-]+/g, "");
  if (normalized.includes("pendingreview")) return "pendingReview";
  if (normalized.includes("underreview")) return "underReview";
  if (normalized.includes("approv")) return "approved";
  if (normalized.includes("reject") || normalized.includes("declin")) {
    return "rejected";
  }
  return undefined;
};

export const getLocalizedStatusLabel = (
  status?: UserManagementValueObject | null,
  preferAr = false,
  t?: Translate,
) => {
  const translate = t || ((key: string) => key);
  const translationKey = getProfileStatusTranslationKey(
    status?.nameEn || status?.nameAr,
  );

  if (translationKey) {
    return translate(`Profile.details.statuses.${translationKey}`);
  }

  return getValueObjectName(status, preferAr);
};

export const normalizeLegacyViewType = (value?: string | null): ViewType | null => {
  if (
    value === "individual" ||
    value === "commercial" ||
    value === "government" ||
    value === "egaming"
  ) {
    return value;
  }

  return null;
};

export const resolveProfileViewByUserTypeId = (
  userTypeId?: number | null,
): ViewType | null => {
  if (userTypeId === null || userTypeId === undefined || Number.isNaN(userTypeId)) {
    return null;
  }

  if (userTypeId === 1) {
    return "individual";
  }
  if (
    EGAMING_PROFILE_USER_TYPE_IDS.includes(
      userTypeId as (typeof EGAMING_PROFILE_USER_TYPE_IDS)[number],
    )
  ) {
    return "egaming";
  }

  if (
    COMMERCIAL_PROFILE_USER_TYPE_IDS.includes(
      userTypeId as (typeof COMMERCIAL_PROFILE_USER_TYPE_IDS)[number],
    )
  ) {
    return "commercial";
  }

  return "government";
};

export const resolveViewFromUserType = (
  userType?: UserManagementValueObject | null,
): "commercial" | "individual" => {
  const normalized = normalizeText(userType?.nameEn || userType?.nameAr);
  if (normalized.includes("individual")) return "individual";
  return "commercial";
};

export const getEstablishmentSubTypeLabel = (
  establishment?: EstablishmentInfo | null,
  preferAr?: boolean,
): string => {
  const typeObj = establishment?.establishmentTypeObj;
  const raw = preferAr
    ? typeObj?.nameAr?.trim() || typeObj?.nameEn?.trim()
    : typeObj?.nameEn?.trim() || typeObj?.nameAr?.trim();
  return (raw ?? "").trim();
};
