import dayjs from "dayjs";

import { fromApi, GST } from "@/utils/gstTime";
import i18n from "@/localization/config";
import type { ArtifactLocale, ArtifactValue, ArtifactValueFormat } from "./artifacts";

const statusResourceKey = {
  active: "active",
  approved: "approved",
  blocked: "blocked",
  cancelled: "cancelled",
  completed: "completed",
  current: "current",
  expired: "expired",
  failed: "failed",
  inactive: "inactive",
  "in progress": "inProgress",
  modified: "modified",
  overdue: "overdue",
  paid: "paid",
  pending: "pending",
  rejected: "rejected",
  upcoming: "upcoming",
} as const;
type ArtifactStatusKey = keyof typeof statusResourceKey;
const statusAliases: Record<string, ArtifactStatusKey> = {
  reviewing: "current",
  success: "completed",
};

export function normalizeArtifactStatus(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ");
}

export function formatArtifactStatus(value: ArtifactValue, language: ArtifactLocale) {
  if (typeof value !== "string") return String(i18n.t("aiChatBot.chat.statuses.unknown", { lng: language }));
  const normalized = normalizeArtifactStatus(value);
  const resourceKey =
    statusResourceKey[normalized as ArtifactStatusKey] ??
    statusAliases[normalized];
  return String(i18n.t(`aiChatBot.chat.statuses.${resourceKey ?? "unknown"}`, { lng: language }));
}

export function formatArtifactValue(
  value: ArtifactValue,
  format: ArtifactValueFormat,
  language: ArtifactLocale,
  currency = "AED",
) {
  if (value === null) return String(i18n.t("aiChatBot.chat.notConfirmed", { lng: language }));
  const locale = language.startsWith("ar") ? "ar-AE" : "en-AE";

  if (format === "status") {
    return formatArtifactStatus(value, language);
  }

  if (format === "currency" && typeof value === "number") {
    return new Intl.NumberFormat(locale, {
      currency,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
      style: "currency",
    }).format(value);
  }

  if (format === "number" && typeof value === "number") {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  }

  if (format === "date" && (typeof value === "string" || typeof value === "number")) {
    const parsed = typeof value === "string" ? fromApi(value) : dayjs(value).tz(GST);
    if (parsed?.isValid()) {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: GST }).format(
        parsed.toDate(),
      );
    }
  }

  if (typeof value === "boolean") {
    return String(i18n.t(value ? "aiChatBot.chat.yes" : "aiChatBot.chat.no", { lng: language }));
  }

  return String(value);
}

export function formatTimelineTimestamp(value: string, language: ArtifactLocale) {
  const parsed = fromApi(value);
  if (!parsed) return "";
  return new Intl.DateTimeFormat(language.startsWith("ar") ? "ar-AE" : "en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: GST,
  }).format(parsed.toDate());
}
