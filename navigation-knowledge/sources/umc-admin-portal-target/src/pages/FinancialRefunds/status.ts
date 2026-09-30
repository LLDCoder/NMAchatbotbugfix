import type { TFunction } from "i18next";

export type FinancialRefundStatusTone =
  | "pending"
  | "success"
  | "danger"
  | "neutral";

export const getFinancialRefundStatusLabel = (
  status?: string | null,
  t?: TFunction,
) => {
  const value = String(status ?? "").trim();
  if (isFinancialRefundCompleted(value)) {
    return t ? t("Finance.financialRefunds.status.refunded") : "Refunded";
  }
  return value || (t ? t("Finance.financialRefunds.status.pendingRefund") : "Pending Refund");
};

export const isFinancialRefundCompleted = (status?: string | null) => {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();

  return normalized.includes("completed") || normalized.includes("refunded");
};

export const getFinancialRefundStatusTone = (
  status?: string | null,
): FinancialRefundStatusTone => {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();

  if (isFinancialRefundCompleted(normalized) || normalized.includes("success")) {
    return "success";
  }
  if (
    normalized.includes("failed") ||
    normalized.includes("rejected") ||
    normalized.includes("cancelled")
  ) {
    return "danger";
  }
  if (normalized.includes("pending")) {
    return "pending";
  }

  return "neutral";
};
