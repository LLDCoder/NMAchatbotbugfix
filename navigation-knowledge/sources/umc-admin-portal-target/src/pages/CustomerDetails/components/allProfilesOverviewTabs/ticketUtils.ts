import type { TFunction } from "i18next";
import type {
  AccountTicketDictionaryDto,
  AccountTicketsItemDto,
  TicketsStatusCountDto,
} from "@/services/tickets";
import type { TicketItem } from "../../types";

export interface NormalizedTicketsStatusCount {
  openCount: number;
  pendingCustormer: number;
  departmentProcessingCount: number;
  departmentProcessedCount: number;
  resolvedCount: number;
  completedCount: number;
  cancelledCount: number;
  totalCount: number;
  reopentCount: number;
}

export const createEmptyTicketsStatusCount =
  (): NormalizedTicketsStatusCount => ({
    openCount: 0,
    pendingCustormer: 0,
    departmentProcessingCount: 0,
    departmentProcessedCount: 0,
    resolvedCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    totalCount: 0,
    reopentCount: 0,
  });

const getPayloadCandidates = (response: unknown) => {
  const candidates: unknown[] = [];
  let current = response;

  for (let depth = 0; depth < 4; depth += 1) {
    candidates.push(current);
    if (!current || typeof current !== "object" || !("data" in current)) {
      break;
    }
    current = (current as { data?: unknown }).data;
  }

  return candidates;
};

const safeCount = (value: unknown) => {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
};

const safeText = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
};

const getLocalizedName = (
  value: AccountTicketDictionaryDto | null | undefined,
  isArabic: boolean,
) => {
  const primary = isArabic ? value?.nameAr : value?.nameEn;
  const secondary = isArabic ? value?.nameEn : value?.nameAr;
  return safeText(primary) !== "-" ? safeText(primary) : safeText(secondary);
};

const TICKET_TYPE_KEYS: Record<number, string> = {
  1: "Customer.customerDetails.allProfilesOverview.ticketFilters.types.enquiry",
  2: "Customer.customerDetails.allProfilesOverview.ticketFilters.types.complaint",
  4: "Customer.customerDetails.allProfilesOverview.ticketFilters.types.suggestion",
};

const TICKET_STATUS_KEYS: Record<number, string> = {
  1: "Customer.customerDetails.allProfilesOverview.stats.open",
  2: "Customer.customerDetails.allProfilesOverview.stats.pendingCustomer",
  3: "Customer.customerDetails.allProfilesOverview.stats.departmentProcessing",
  4: "Customer.customerDetails.allProfilesOverview.stats.departmentProcessed",
  5: "Customer.customerDetails.allProfilesOverview.stats.resolved",
  6: "Customer.customerDetails.allProfilesOverview.stats.completed",
  7: "Customer.customerDetails.allProfilesOverview.stats.cancelled",
};

const TICKET_PRIORITY_KEYS: Record<number, string> = {
  1: "Customer.tickets.priority.high",
  2: "Customer.tickets.priority.medium",
  3: "Customer.tickets.priority.low",
};

const getFallbackLabel = (
  id: number | null | undefined,
  keys: Record<number, string>,
  t: TFunction,
) => {
  if (!Number.isFinite(id)) return "-";
  const key = keys[Number(id)];
  return key ? t(key) : "-";
};

const getDictionaryLabel = (
  value: AccountTicketDictionaryDto | null | undefined,
  id: number | null | undefined,
  keys: Record<number, string>,
  isArabic: boolean,
  t: TFunction,
) => {
  const localizedName = getLocalizedName(value, isArabic);
  return localizedName !== "-"
    ? localizedName
    : getFallbackLabel(id, keys, t);
};

export const mapAccountTicketToTicketItem = (
  item: AccountTicketsItemDto,
  index: number,
  language: string,
  t: TFunction,
): TicketItem => {
  const isArabic = String(language ?? "").toLowerCase().startsWith("ar");
  const numericId = Number(item?.id);
  const detailsId =
    Number.isInteger(numericId) && numericId > 0 ? numericId : undefined;
  const customerName = safeText(item?.custormer);
  const localizedCustomerName = getLocalizedName(
    item?.curstomerUserObj,
    isArabic,
  );
  const customerTypeId = Number(item?.curstomerUserObj?.userTypeId);
  const customerTypeCode = safeText(item?.curstomerUserObj?.userTypeCode);
  const statusId = Number(item?.enquiryStatusId ?? item?.enquiryStatusObj?.id);
  const enquiryTypeId = Number(
    item?.enquiryTypeId ?? item?.enquiryTypeObj?.id,
  );
  const knownTypeLabel = getFallbackLabel(
    Number.isFinite(enquiryTypeId) ? enquiryTypeId : undefined,
    TICKET_TYPE_KEYS,
    t,
  );

  return {
    id: detailsId ? String(detailsId) : `ticket-${index}`,
    detailsId,
    ticketNo: safeText(item?.enquiryNumber),
    reopen: safeCount(item?.reopenTimes) > 0,
    reopenTimes: safeCount(item?.reopenTimes),
    type:
      knownTypeLabel !== "-"
        ? knownTypeLabel
        : getLocalizedName(item?.enquiryTypeObj, isArabic),
    applicationNo: safeText(item?.applicationNo),
    serviceName: getLocalizedName(item?.serviceObj, isArabic),
    customer:
      customerName !== "-" ? customerName : localizedCustomerName,
    customerTypeId: Number.isFinite(customerTypeId) && customerTypeId > 0
      ? customerTypeId
      : undefined,
    customerTypeCode:
      customerTypeCode !== "-" ? customerTypeCode : undefined,
    priority: getDictionaryLabel(
      item?.priorityObj,
      item?.priorityId,
      TICKET_PRIORITY_KEYS,
      isArabic,
      t,
    ),
    status:
      Number.isFinite(statusId) && statusId > 0 ? String(statusId) : "-",
    statusName: getDictionaryLabel(
      item?.enquiryStatusObj,
      Number.isFinite(statusId) ? statusId : undefined,
      TICKET_STATUS_KEYS,
      isArabic,
      t,
    ),
    lastUpdated: safeText(item?.updatedOn ?? item?.createdOn),
    createdOn: safeText(item?.createdOn),
    issueCategory: getLocalizedName(item?.issueCategoryObj, isArabic),
    currentHandler: safeText(item?.currentHander),
  };
};

export const mapAccountTicketsResponse = (
  response: unknown,
  language: string,
  t: TFunction,
) => {
  const candidates = getPayloadCandidates(response);
  let payload: Record<string, unknown> | null = null;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    const page =
      record.page && typeof record.page === "object"
        ? (record.page as Record<string, unknown>)
        : null;
    if ("items" in record || (page && "items" in page)) {
      payload = page && "items" in page ? page : record;
      break;
    }
  }

  const items = Array.isArray(payload?.items)
    ? payload.items.filter(
        (item): item is AccountTicketsItemDto =>
          Boolean(item && typeof item === "object"),
      )
    : [];

  return {
    items: items.map((item, index) =>
      mapAccountTicketToTicketItem(item, index, language, t),
    ),
    total: safeCount(payload?.total ?? payload?.totalCount),
  };
};

export const mapTicketsStatusCount = (
  response: unknown,
): NormalizedTicketsStatusCount => {
  const candidates = getPayloadCandidates(response);
  const payload = candidates.find(
    (candidate) =>
      Boolean(candidate) &&
      typeof candidate === "object" &&
      [
        "totalCount",
        "openCount",
        "pendingCustormer",
        "departmentProcessingCount",
        "departmentProcessedCount",
        "resolvedCount",
        "completedCount",
        "cancelledCount",
        "reopentCount",
      ].some((key) => key in (candidate as Record<string, unknown>)),
  ) as TicketsStatusCountDto | undefined;

  return {
    totalCount: safeCount(payload?.totalCount),
    openCount: safeCount(payload?.openCount),
    pendingCustormer: safeCount(payload?.pendingCustormer),
    departmentProcessingCount: safeCount(
      payload?.departmentProcessingCount,
    ),
    departmentProcessedCount: safeCount(payload?.departmentProcessedCount),
    resolvedCount: safeCount(payload?.resolvedCount),
    reopentCount: safeCount(payload?.reopentCount),
    completedCount: safeCount(payload?.completedCount),
    cancelledCount: safeCount(payload?.cancelledCount),
  };
};
