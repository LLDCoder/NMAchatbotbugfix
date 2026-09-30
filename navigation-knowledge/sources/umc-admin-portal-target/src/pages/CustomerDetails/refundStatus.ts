export const CUSTOMER_REFUND_STATUS_LABEL_BY_ID: Record<number, string> = {
  1: "Under Review",
  2: "Under Review",
  3: "Under Review",
  4: "Pending Refund",
  5: "Rejected",
  6: "Refunded",
  7: "Cancelled",
};

export function normalizeCustomerRefundStatusLabel(
  statusId?: number | string | null,
  statusName?: string | number | null,
) {
  const numericStatusId = Number(statusId ?? statusName);
  if (Number.isFinite(numericStatusId)) {
    const mappedLabel = CUSTOMER_REFUND_STATUS_LABEL_BY_ID[numericStatusId];
    if (mappedLabel) return mappedLabel;
  }

  const label = String(statusName ?? "").trim();
  const normalizedLabel = label.toLowerCase();

  if (
    normalizedLabel === "approved" ||
    normalizedLabel === "pending refund"
  ) {
    return "Pending Refund";
  }

  if (
    normalizedLabel === "pending approval" ||
    normalizedLabel === "pending review" ||
    normalizedLabel === "under review"
  ) {
    return "Under Review";
  }

  if (normalizedLabel === "completed" || normalizedLabel === "refunded") {
    return "Refunded";
  }

  if (normalizedLabel === "rejected") return "Rejected";
  if (normalizedLabel === "cancelled" || normalizedLabel === "canceled") {
    return "Cancelled";
  }

  return label || "-";
}
