import { getViolationStatusLabel } from "@/pages/InspectionCommon/helpers";
import type {
  CustomerProfileViolationItem,
  CustomerProfileViolationListResponse,
  CustomerProfileViolationStatusStat,
} from "@/services/customerManagement";
import { formatMoney } from "@/utils/utils";
import type { ViolationFineItem } from "../../types";

export type ViolationFilterOption = { label: string; value: string };

const STATUS_ID_KEYS: Record<string, string> = {
  "1": "warningissued",
  "2": "pendingrouting",
  "3": "pendingcontentreport",
  "4": "pendingreview",
  "5": "pendingcommitteedecision",
  "6": "pendingapproval",
  "7": "pendingpayment",
  "8": "underappeal",
  "9": "paid",
  "10": "cancelled",
  "11": "appealrejected",
  "12": "appealapproved",
};

const STATUS_LABELS: Record<string, string> = {
  warningissued: "Warning Issued",
  pendingrouting: "Pending Routing",
  pendingcontentreport: "Pending Content Report",
  pendingreview: "Pending Review",
  reviewinprogress: "Review in Progress",
  pendingcommitteedecision: "Pending Committee Decision",
  pendingapproval: "Pending Approval",
  pendingpayment: "Pending Payment",
  underappeal: "Under Appeal",
  paid: "Paid",
  cancelled: "Cancelled",
  appealrejected: "Appeal Rejected",
  appealapproved: "Appeal Approved",
};

const FILTER_STATUS_DEFINITIONS = [
  { key: "paid", label: "Paid", fallbackId: "9" },
  { key: "pendingpayment", label: "Pending Payment", fallbackId: "7" },
  { key: "underappeal", label: "Under Appeal", fallbackId: "8" },
  { key: "appealrejected", label: "Appeal Rejected", fallbackId: "11" },
  { key: "appealapproved", label: "Appeal Approved", fallbackId: "12" },
] as const;

const EMPTY_STATUS_KEYS = [
  "warningissued",
  "reviewinprogress",
  "pendingrouting",
  "pendingcontentreport",
  "pendingreview",
  "pendingcommitteedecision",
  "pendingapproval",
  "pendingpayment",
  "underappeal",
  "paid",
  "cancelled",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const safeText = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
};

export const normalizeViolationStatusKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");

const getCanonicalStatusKey = (
  statusId?: number | string | null,
  statusName?: string | null,
) => {
  const normalizedName = normalizeViolationStatusKey(statusName);
  const nameAliases: Record<string, string> = {
    warningissued: "warningissued",
    pendingrouting: "pendingrouting",
    pendingcontentreport: "pendingcontentreport",
    pendingreview: "pendingreview",
    underreview: "pendingreview",
    reviewinprogress: "reviewinprogress",
    pendingcommitteedecision: "pendingcommitteedecision",
    pendingapproval: "pendingapproval",
    pendingpayment: "pendingpayment",
    underappeal: "underappeal",
    onholdduringappeal: "underappeal",
    paid: "paid",
    closed: "paid",
    cancelled: "cancelled",
    canceled: "cancelled",
    appealrejected: "appealrejected",
    rejected: "appealrejected",
    appealapproved: "appealapproved",
    approved: "appealapproved",
  };

  if (nameAliases[normalizedName]) return nameAliases[normalizedName];

  const normalizedId = String(statusId ?? "").trim();
  return STATUS_ID_KEYS[normalizedId] || normalizedName;
};

const getStatusDisplayName = (
  statusId?: number | string | null,
  statusName?: string | null,
) => {
  const rawName = String(statusName ?? "").trim();
  if (rawName) return getViolationStatusLabel(rawName);

  const key = getCanonicalStatusKey(statusId, statusName);
  return STATUS_LABELS[key] || "-";
};

const formatFineAmount = (value?: number | string | null) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "-";
  }
  return String(formatMoney(String(value)));
};

export const unwrapCustomerProfileViolationResponse = (
  response: unknown,
): CustomerProfileViolationListResponse => {
  let current: unknown = response;

  for (let depth = 0; depth < 3; depth += 1) {
    if (!isRecord(current)) return {};
    if (current.isSuccess === false) return {};
    if (!("data" in current) || current.data === null || current.data === undefined) {
      break;
    }
    current = current.data;
  }

  return isRecord(current)
    ? (current as unknown as CustomerProfileViolationListResponse)
    : {};
};

export const mapCustomerProfileViolationToRow = (
  item: CustomerProfileViolationItem,
  index: number,
): ViolationFineItem => {
  const createdOn = safeText(item?.createdOn);
  const paymentDate = safeText(item?.paidOn || item?.paymentTime);
  const paidTime = safeText(item?.paidTime);
  const typeId = Number(item?.violationTypeId);
  const violationType =
    typeId === 1
      ? "License Violation"
      : typeId === 2
        ? "Content Violation"
        : safeText(item?.violationTypeName);

  return {
    id: String(
      item?.violationId ??
        item?.violationNo ??
        `profile-violation-row-${index}`,
    ),
    fineNo: safeText(item?.violationNo),
    inspectionNo: safeText(item?.sourceTaskNo),
    violationType,
    violationTypeId:
      item?.violationTypeId === null || item?.violationTypeId === undefined
        ? undefined
        : String(item.violationTypeId),
    fineAmount: formatFineAmount(item?.fineAmount),
    status: getStatusDisplayName(item?.statusId, item?.statusName),
    statusId:
      item?.statusId === null || item?.statusId === undefined
        ? undefined
        : String(item.statusId),
    issueDate: createdOn,
    paymentDate,
    paidTime,
    violator: safeText(item?.violatorName),
    applyFor: safeText(item?.violatorName),
    sourceTask: safeText(item?.sourceTaskNo),
    sourceTaskId:
      item?.sourceTaskId === null || item?.sourceTaskId === undefined
        ? undefined
        : String(item.sourceTaskId),
    reportedBy: safeText(item?.reportedByName),
    creationTime: createdOn,
  };
};

export const mapCustomerProfileViolationRows = (response: unknown) => {
  const payload = unwrapCustomerProfileViolationResponse(response);
  const items = Array.isArray(payload.items) ? payload.items : [];

  return items.map((item, index) =>
    mapCustomerProfileViolationToRow(item, index),
  );
};

export const createEmptyViolationStatusCounts = (): Record<string, number> =>
  EMPTY_STATUS_KEYS.reduce<Record<string, number>>((counts, key) => {
    counts[key] = 0;
    return counts;
  }, {});

export const buildViolationStatusCounts = (
  statuses?: CustomerProfileViolationStatusStat[] | null,
) => {
  const counts = createEmptyViolationStatusCounts();

  (Array.isArray(statuses) ? statuses : []).forEach((status) => {
    const key = getCanonicalStatusKey(status?.statusId, status?.statusName);
    if (!key) return;

    const rawCount = Number(status?.count ?? 0);
    const count = Number.isFinite(rawCount) ? rawCount : 0;
    counts[key] = (counts[key] || 0) + count;
  });

  return counts;
};

export const mapCustomerProfileViolationStatusCounts = (response: unknown) => {
  const payload = unwrapCustomerProfileViolationResponse(response);
  return buildViolationStatusCounts(payload.statuses);
};

export const buildViolationFilterStatusOptions = (
  statuses?: CustomerProfileViolationStatusStat[] | null,
): ViolationFilterOption[] => {
  const list = Array.isArray(statuses) ? statuses : [];

  return FILTER_STATUS_DEFINITIONS.map((definition) => {
    const matchingStatus = list.find(
      (status) =>
        getCanonicalStatusKey(status?.statusId, status?.statusName) ===
        definition.key,
    );
    const responseId = String(matchingStatus?.statusId ?? "").trim();

    return {
      label: definition.label,
      value: responseId || definition.fallbackId,
    };
  });
};

export const mapCustomerProfileViolationFilterStatusOptions = (
  response: unknown,
) => {
  const payload = unwrapCustomerProfileViolationResponse(response);
  return buildViolationFilterStatusOptions(payload.statuses);
};
