import type {
  InspectionProfileAppealItemDto,
  InspectionProfileAppealListResponseDto,
  InspectionProfileAppealStatusStatDto,
} from "@/services/inspectionAppeals";
import type { AppealItem } from "../../types";

export const PROFILE_APPEAL_STATUS_OPTIONS = [
  {
    id: "3",
    name: "Department Processing",
    translationKey: "Customer.customerAppeals.statuses.departmentProcessing",
  },
  {
    id: "4",
    name: "Department Processed",
    translationKey: "Customer.customerAppeals.statuses.departmentProcessed",
  },
  {
    id: "5",
    name: "Pending Customer",
    translationKey: "Customer.customerAppeals.statuses.pendingCustomer",
  },
  {
    id: "6",
    name: "Approved",
    translationKey: "Customer.customerAppeals.statuses.approved",
  },
  {
    id: "7",
    name: "Rejected",
    translationKey: "Customer.customerAppeals.statuses.rejected",
  },
  {
    id: "8",
    name: "Cancelled",
    translationKey: "Customer.customerAppeals.statuses.cancelled",
  },
] as const;

export type AppealOverviewStats = {
  departmentProcessing: number;
  departmentProcessed: number;
  pendingCustomer: number;
  approved: number;
  rejected: number;
  cancelled: number;
};

type AppealOverviewStatKey = keyof AppealOverviewStats;

const STATUS_CONFIG_BY_ID = new Map<string, (typeof PROFILE_APPEAL_STATUS_OPTIONS)[number]>(
  PROFILE_APPEAL_STATUS_OPTIONS.map((status) => [status.id, status]),
);

const STATUS_KEY_BY_ID: Record<string, AppealOverviewStatKey> = {
  "3": "departmentProcessing",
  "4": "departmentProcessed",
  "5": "pendingCustomer",
  "6": "approved",
  "7": "rejected",
  "8": "cancelled",
};

const STATUS_KEY_BY_NAME: Record<string, AppealOverviewStatKey> = {
  departmentprocessing: "departmentProcessing",
  departmentprocessed: "departmentProcessed",
  pendingcustomer: "pendingCustomer",
  approved: "approved",
  appealapproved: "approved",
  rejected: "rejected",
  appealrejected: "rejected",
  cancelled: "cancelled",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const toSafeText = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
};

const toStatusId = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  const id = String(value).trim();
  return id || undefined;
};

const normalizeStatusName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const humanizeStatusName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ");

const toSafeCount = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
};

const getStatusKey = (
  statusId: unknown,
  statusName: unknown,
): AppealOverviewStatKey | undefined => {
  const id = toStatusId(statusId);
  if (id && STATUS_KEY_BY_ID[id]) return STATUS_KEY_BY_ID[id];
  return STATUS_KEY_BY_NAME[normalizeStatusName(statusName)];
};

export const createEmptyAppealOverviewStats = (): AppealOverviewStats => ({
  departmentProcessing: 0,
  departmentProcessed: 0,
  pendingCustomer: 0,
  approved: 0,
  rejected: 0,
  cancelled: 0,
});

export const unwrapProfileAppealResponse = (
  response: unknown,
): InspectionProfileAppealListResponseDto => {
  let current: unknown = response;

  for (let depth = 0; depth < 3; depth += 1) {
    if (!isRecord(current) || current.isSuccess === false) return {};
    if (!("data" in current)) break;
    const next = current.data;
    if (next === null || next === undefined) return {};
    current = next;
  }

  return isRecord(current)
    ? (current as InspectionProfileAppealListResponseDto)
    : {};
};

export const mapProfileAppealItem = (
  item: InspectionProfileAppealItemDto | null | undefined,
  index: number,
): AppealItem => {
  const source = item ?? {};
  const appealNo = toSafeText(source.appealNo);
  const appealReason = toSafeText(source.appealReason);
  const violationNo = toSafeText(source.violationNo);
  const lastUpdated = toSafeText(source.lastUpdatedOn || source.submissionDate);
  const statusId = toStatusId(source.statusId);
  const canonicalStatus = statusId
    ? STATUS_CONFIG_BY_ID.get(statusId)?.name
    : undefined;
  const rawStatus = humanizeStatusName(source.status);
  const sourceId = toSafeText(source.id);
  const stableId =
    sourceId !== "-"
      ? sourceId
      : appealNo !== "-"
        ? appealNo
        : `profile-appeal-row-${index}`;

  return {
    id: stableId,
    appealNo,
    fineNo: violationNo,
    violationNo,
    appealCategory: appealReason,
    appealReason,
    applyFor: toSafeText(source.applyFor),
    status: canonicalStatus || rawStatus || "-",
    statusId,
    requestDate: lastUpdated,
    submissionTime: toSafeText(source.submissionDate),
    lastUpdated,
  };
};

export const mapProfileAppealListResponse = (response: unknown) => {
  const payload = unwrapProfileAppealResponse(response);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const mappedItems = items.map((item, index) =>
    mapProfileAppealItem(item, index),
  );

  return {
    items: mappedItems,
    total: toSafeCount(payload.total),
  };
};

const addStatusCount = (
  stats: AppealOverviewStats,
  statusId: unknown,
  statusName: unknown,
  count: unknown,
) => {
  const key = getStatusKey(statusId, statusName);
  if (!key) return;
  stats[key] += toSafeCount(count);
};

export const mapAppealItemsToStats = (
  items: Array<{
    statusId?: string | number | null;
    status?: string | null;
  }>,
): AppealOverviewStats => {
  const stats = createEmptyAppealOverviewStats();
  items.forEach((item) => {
    addStatusCount(stats, item?.statusId, item?.status, 1);
  });
  return stats;
};

export const mapProfileAppealStats = (
  response: unknown,
): AppealOverviewStats => {
  const payload = unwrapProfileAppealResponse(response);
  const stats = createEmptyAppealOverviewStats();
  const statuses = Array.isArray(payload.statuses) ? payload.statuses : [];

  if (statuses.length) {
    statuses.forEach((status: InspectionProfileAppealStatusStatDto) => {
      addStatusCount(
        stats,
        status?.statusId,
        status?.statusName,
        status?.count,
      );
    });
    return stats;
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  return mapAppealItemsToStats(items);
};
