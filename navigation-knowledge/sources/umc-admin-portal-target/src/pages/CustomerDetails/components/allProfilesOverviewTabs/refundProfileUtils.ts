import type {
  ProfileRefundItemDto,
  ProfileRefundsByUserProfileResponse,
} from "@/services/refunds";
import { formatMoney } from "@/utils/utils";
import { normalizeCustomerRefundStatusLabel } from "../../refundStatus";
import type { RefundItem } from "../../types";

export type RefundOverviewStats = {
  departmentProcessingCount: number;
  departmentProcessedCount: number;
  pendingCustomerCount: number;
  pendingRefundCount: number;
  refundedCount: number;
  rejectedCount: number;
  cancelledCount: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const toSafeText = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
};

const toSafeCount = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
};

const getLocalizedValue = (
  value: ProfileRefundItemDto["statusObj"] | ProfileRefundItemDto["categoryObj"],
  language: string,
) => {
  const isArabic = language.toLowerCase().startsWith("ar");
  const localized = isArabic ? value?.nameAr : value?.nameEn;
  const fallback = isArabic ? value?.nameEn : value?.nameAr;
  return toSafeText(localized || fallback);
};

const formatRefundAmount = (value: ProfileRefundItemDto["amount"]) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "-";
  }
  return String(formatMoney(String(value)));
};

export const unwrapProfileRefundResponse = (
  response: unknown,
): ProfileRefundsByUserProfileResponse => {
  let current: unknown = response;

  for (let depth = 0; depth < 3; depth += 1) {
    if (!isRecord(current) || current.isSuccess === false) return {};
    if (!("data" in current)) break;
    const next = current.data;
    if (next === null || next === undefined) return {};
    current = next;
  }

  return isRecord(current)
    ? (current as ProfileRefundsByUserProfileResponse)
    : {};
};

export const mapProfileRefundItem = (
  item: ProfileRefundItemDto | null | undefined,
  index: number,
  language: string,
): RefundItem => {
  const source = item ?? {};
  const localizedStatus = getLocalizedValue(source.statusObj, language);
  const localizedCategory = getLocalizedValue(source.categoryObj, language);
  const lastUpdated = toSafeText(source.updateOn || source.createdOn);
  const sourceId = toSafeText(source.id);
  const applicationNumber = toSafeText(source.applicationNumber);
  const stableId =
    sourceId !== "-"
      ? sourceId
      : applicationNumber !== "-"
        ? applicationNumber
        : `profile-refund-row-${index}`;

  return {
    id: stableId,
    refundNo: toSafeText(source.referenceNumber || source.id),
    applicationNo: applicationNumber,
    referenceNo: toSafeText(source.referenceNumber),
    applyFor: toSafeText(source.applyFor),
    amount: formatRefundAmount(source.amount),
    refundCategory:
      localizedCategory !== "-"
        ? localizedCategory
        : toSafeText(source.categoryId),
    categoryId:
      source.categoryId === null || source.categoryId === undefined
        ? undefined
        : String(source.categoryId),
    status:
      localizedStatus !== "-"
        ? localizedStatus
        : normalizeCustomerRefundStatusLabel(source.statusId),
    statusId:
      source.statusId === null || source.statusId === undefined
        ? undefined
        : String(source.statusId),
    requestDate: lastUpdated,
    transactionTime: toSafeText(source.transactionTime),
    lastUpdated,
  };
};

export const mapProfileRefundListResponse = (
  response: unknown,
  language: string,
) => {
  const payload = unwrapProfileRefundResponse(response);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const total = toSafeCount(payload.totalCount ?? payload.total);

  return {
    items: items.map((item, index) =>
      mapProfileRefundItem(item, index, language),
    ),
    total,
  };
};

export const createEmptyRefundOverviewStats = (): RefundOverviewStats => ({
  departmentProcessingCount: 0,
  departmentProcessedCount: 0,
  pendingCustomerCount: 0,
  pendingRefundCount: 0,
  refundedCount: 0,
  rejectedCount: 0,
  cancelledCount: 0,
});

export const mapProfileRefundStats = (
  response: unknown,
): RefundOverviewStats => {
  const payload = unwrapProfileRefundResponse(response);

  return {
    departmentProcessingCount: toSafeCount(
      payload.departmentProcessingCount ?? payload.departmentProcessing,
    ),
    departmentProcessedCount: toSafeCount(
      payload.departmentProcessedCount ?? payload.departmentProcessed,
    ),
    pendingCustomerCount: toSafeCount(
      payload.pendingCustomerCount ?? payload.pendingCustomer,
    ),
    pendingRefundCount: toSafeCount(payload.pendingRefundCount),
    refundedCount: toSafeCount(payload.refundedCount),
    rejectedCount: toSafeCount(payload.rejectedCount),
    cancelledCount: toSafeCount(payload.cancelledCount),
  };
};
