import type { TFunction } from "i18next";
import type {
  InspectionLookupOption,
  InspectionProfileTaskItem,
  InspectionProfileTaskListResponse,
  InspectionProfileTaskStatusStat,
} from "@/services/inspection";
import type {
  InspectionNoFullScanSelectOption,
  InspectionOverviewItem,
  InspectionOverviewStats,
} from "../../types";

type InspectionStatusKey = keyof InspectionOverviewStats;

const STATUS_ALIASES: Record<string, InspectionStatusKey> = {
  queued: "queued",
  pendingassignment: "queued",
  todo: "pendingVisit",
  assigned: "pendingVisit",
  pendingvisit: "pendingVisit",
  inprogress: "inProgress",
  accessfailed: "accessFailed",
  submitted: "completed",
  completed: "completed",
  cancelled: "cancelled",
};

const STATUS_ID_MAP: Record<number, InspectionStatusKey> = {
  0: "queued",
  1: "pendingVisit",
  2: "inProgress",
  3: "accessFailed",
  4: "completed",
  5: "cancelled",
};

const STATUS_LABEL_KEYS: Record<InspectionStatusKey, string> = {
  queued: "inspection.status.task.queued",
  pendingVisit: "inspection.status.task.pendingVisit",
  inProgress: "inspection.status.task.inProgress",
  accessFailed: "inspection.status.task.accessFailed",
  completed: "inspection.status.task.completed",
  cancelled: "inspection.status.task.cancelled",
};

const STATUS_FILTERS = [
  {
    aliases: ["PENDING_VISIT", "ASSIGNED", "TODO"],
    fallbackId: "1",
    statusKey: "pendingVisit" as const,
  },
  {
    aliases: ["IN_PROGRESS"],
    fallbackId: "2",
    statusKey: "inProgress" as const,
  },
  {
    aliases: ["COMPLETED", "SUBMITTED"],
    fallbackId: "4",
    statusKey: "completed" as const,
  },
  {
    aliases: ["ACCESS_FAILED"],
    fallbackId: "3",
    statusKey: "accessFailed" as const,
  },
  {
    aliases: ["CANCELLED"],
    fallbackId: "5",
    statusKey: "cancelled" as const,
  },
] as const;

const PRIORITY_FILTERS = [
  {
    aliases: ["HIGH"],
    fallbackId: "2",
    labelKey: "Customer.tickets.priority.high",
  },
  {
    aliases: ["MEDIUM"],
    fallbackId: "3",
    labelKey: "Customer.tickets.priority.medium",
  },
  {
    aliases: ["LOW"],
    fallbackId: "4",
    labelKey: "Customer.tickets.priority.low",
  },
] as const;

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");

const safeText = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
};

const optionalText = (value: unknown) => {
  const text = safeText(value);
  return text === "-" ? undefined : text;
};

const safeCount = (value: unknown) => {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
};

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

export const unwrapInspectionProfileTaskResponse = (
  response: unknown,
): InspectionProfileTaskListResponse => {
  const payload = getPayloadCandidates(response).find(
    (candidate) =>
      Boolean(candidate) &&
      typeof candidate === "object" &&
      ["items", "statuses", "totalCount"].some(
        (key) => key in (candidate as Record<string, unknown>),
      ),
  );

  return payload && typeof payload === "object"
    ? (payload as InspectionProfileTaskListResponse)
    : {};
};

export const createEmptyInspectionOverviewStats =
  (): InspectionOverviewStats => ({
    queued: 0,
    pendingVisit: 0,
    inProgress: 0,
    accessFailed: 0,
    completed: 0,
    cancelled: 0,
  });

const resolveInspectionStatusKey = (
  statusId?: number | null,
  statusCode?: string | null,
  statusName?: string | null,
) => {
  const normalizedCode = normalizeText(statusCode);
  const normalizedName = normalizeText(statusName);
  return (
    STATUS_ALIASES[normalizedCode] ||
    STATUS_ALIASES[normalizedName] ||
    STATUS_ID_MAP[Number(statusId)]
  );
};

const getInspectionStatusLabel = (
  item: Pick<InspectionProfileTaskItem, "statusId" | "statusCode" | "statusName">,
  t: TFunction,
) => {
  const statusKey = resolveInspectionStatusKey(
    item.statusId,
    item.statusCode,
    item.statusName,
  );
  if (statusKey) return t(STATUS_LABEL_KEYS[statusKey]);
  return safeText(item.statusName ?? item.statusCode);
};

export const mapInspectionProfileTaskToOverviewItem = (
  item: InspectionProfileTaskItem,
  index: number,
  t: TFunction,
): InspectionOverviewItem => {
  const id = optionalText(item.id);
  const taskNo = safeText(item.taskNo);
  const statusKey = resolveInspectionStatusKey(
    item.statusId,
    item.statusCode,
    item.statusName,
  );

  return {
    id: id || (taskNo !== "-" ? `task-${taskNo}` : `inspection-task-${index}`),
    taskNo,
    inspectionTarget: safeText(
      item.targetName ?? item.establishmentName ?? item.fullName,
    ),
    inspectionTargetType:
      optionalText(item.targetTypeCode) || optionalText(item.targetTypeName),
    inspectionReason: safeText(item.inspectionReasonName),
    priority: safeText(item.priorityName),
    dueDate: safeText(item.dueDate),
    status: getInspectionStatusLabel(item, t),
    statusKey,
    assignedTime: safeText(item.assignedOn),
    inspector: optionalText(item.inspectorName),
  };
};

export const mapInspectionProfileTaskListResponse = (
  response: unknown,
  t: TFunction,
) => {
  const payload = unwrapInspectionProfileTaskResponse(response);
  const items = Array.isArray(payload.items)
    ? payload.items.filter(
        (item): item is InspectionProfileTaskItem =>
          Boolean(item && typeof item === "object"),
      )
    : [];

  return {
    items: items.map((item, index) =>
      mapInspectionProfileTaskToOverviewItem(item, index, t),
    ),
    total: safeCount(payload.totalCount),
  };
};

export const mapInspectionProfileStats = (
  response: unknown,
): InspectionOverviewStats => {
  const stats = createEmptyInspectionOverviewStats();
  const payload = unwrapInspectionProfileTaskResponse(response);
  const statuses = Array.isArray(payload.statuses) ? payload.statuses : [];

  statuses.forEach((status: InspectionProfileTaskStatusStat) => {
    const statusKey = resolveInspectionStatusKey(
      status?.statusId,
      status?.statusCode,
      status?.statusName,
    );
    if (!statusKey) return;
    stats[statusKey] += safeCount(status?.count);
  });

  return stats;
};

const getLookupLabel = (
  option: InspectionLookupOption | null | undefined,
  isArabic: boolean,
) => {
  const localized = isArabic
    ? option?.nameAr || option?.nameEn
    : option?.nameEn || option?.nameAr;
  return optionalText(localized || option?.name || option?.code || option?.id);
};

const getLookupValue = (
  option: InspectionLookupOption | null | undefined,
  valueField: "id" | "code" = "id",
) => optionalText(option?.[valueField]);

export const buildInspectionLookupOptions = (
  options: InspectionLookupOption[] | null | undefined,
  isArabic: boolean,
  valueField: "id" | "code" = "id",
): InspectionNoFullScanSelectOption[] => {
  const seenValues = new Set<string>();
  const seenLabels = new Set<string>();

  return (Array.isArray(options) ? options : []).reduce<
    InspectionNoFullScanSelectOption[]
  >((result, option) => {
    const value = getLookupValue(option, valueField);
    const label = getLookupLabel(option, isArabic);
    const normalizedLabel = normalizeText(label);
    if (
      !value ||
      !label ||
      seenValues.has(value) ||
      seenLabels.has(normalizedLabel)
    ) {
      return result;
    }
    seenValues.add(value);
    seenLabels.add(normalizedLabel);
    result.push({ label, value });
    return result;
  }, []);
};

const findLookupOption = (
  options: InspectionLookupOption[],
  aliases: readonly string[],
  fallbackId: string,
) => {
  const normalizedAliases = new Set(
    aliases.concat(fallbackId).map(normalizeText),
  );
  return options.find((option) =>
    [option?.code, option?.nameEn, option?.nameAr, option?.name, option?.id].some(
      (value) => normalizedAliases.has(normalizeText(value)),
    ),
  );
};

export const buildInspectionStatusOptions = (
  options: InspectionLookupOption[] | null | undefined,
  _isArabic: boolean,
  t: TFunction,
): InspectionNoFullScanSelectOption[] => {
  const safeOptions = Array.isArray(options) ? options : [];
  return STATUS_FILTERS.map((filter) => {
    const match = findLookupOption(
      safeOptions,
      filter.aliases,
      filter.fallbackId,
    );
    return {
      label: t(STATUS_LABEL_KEYS[filter.statusKey]),
      value: getLookupValue(match) || filter.fallbackId,
    };
  });
};

export const buildInspectionPriorityOptions = (
  options: InspectionLookupOption[] | null | undefined,
  isArabic: boolean,
  t: TFunction,
): InspectionNoFullScanSelectOption[] => {
  const safeOptions = Array.isArray(options) ? options : [];
  return PRIORITY_FILTERS.map((filter) => {
    const match = findLookupOption(
      safeOptions,
      filter.aliases,
      filter.fallbackId,
    );
    return {
      label: getLookupLabel(match, isArabic) || t(filter.labelKey),
      value: getLookupValue(match) || filter.fallbackId,
    };
  });
};

export const getInspectionNumberParam = (value?: string) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
