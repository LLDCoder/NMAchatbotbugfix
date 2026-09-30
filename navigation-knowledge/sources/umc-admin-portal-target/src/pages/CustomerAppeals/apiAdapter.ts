import { msUntil } from "@/utils/gstTime";
import type {
  InspectionAppealAttachmentDto,
  InspectionAppealAdjustmentDto,
  InspectionAppealDetailDto,
  InspectionAppealHandlerDto,
  InspectionAppealListItemDto,
  InspectionAppealListResponseDto,
  InspectionAppealMessageDto,
  InspectionAppealStatsDto,
  InspectionAppealTimelineItemDto,
  InspectionAppealWriteAttachmentDto,
} from "@/services/inspectionAppeals";
import i18next from "i18next";
import {
  getInspectionViolationStatusFromId,
  type InspectionViolationStatus,
} from "@/services/inspection";
import {
  APPEAL_REASON_OPTIONS,
  APPEAL_STATUS_ID_MAP,
  APPEAL_STATUS_NAME_MAP,
  buildAppealAttachmentAccessUrl,
  getAppealReasonTranslationKey,
  getAppealStatusTranslationKey,
  normalizeAppealAttachmentFilePath,
} from "./utils";
import type {
  AppealAttachment,
  AppealAdjustment,
  AppealComment,
  AppealFilterOptions,
  AppealHandler,
  AppealListResult,
  AppealRecord,
  AppealStatus,
  AppealSummaryItem,
  AppealTimelineItem,
  AppealTimelineTextSegment,
  AppealViewRole,
} from "./types";

const EMPTY_VALUE = "-";
const APPEAL_TIMELINE_I18N_PREFIX =
  "Customer.customerAppealsDetails.timeline";
const REJECTED_NO_DECISION_TIMELINE_I18N_KEY =
  `${APPEAL_TIMELINE_I18N_PREFIX}.rejectedNoDecisionWithinDeadline`;
const REJECTED_NO_DECISION_TEXT = "No decision was made within 15 days.";
const AUTO_REJECTED_NO_DECISION_ACTION_TYPE_CODE =
  "autorejectednodecisionwithindeadline";
const FINAL_APPEAL_STATUS_KEYS = new Set([
  "approved",
  "rejected",
  "cancelled",
  "resolved",
]);
const FINAL_RELATED_VIOLATION_STATUSES = new Set<InspectionViolationStatus>([
  "PAID",
  "PENDING_PAYMENT",
  "CANCELLED",
  "WARNING_ISSUED",
]);

function buildTimelineTextSegment(
  text: string,
  i18nKey: string,
  i18nValues?: AppealTimelineTextSegment["i18nValues"],
  tone?: AppealTimelineTextSegment["tone"],
): AppealTimelineTextSegment {
  const segment: AppealTimelineTextSegment = { text, i18nKey };
  if (i18nValues) segment.i18nValues = i18nValues;
  if (tone) segment.tone = tone;
  return segment;
}

function buildTimelineActionTextSegment(
  text: string,
  i18nKey: string,
  i18nValues?: AppealTimelineTextSegment["i18nValues"],
  tone?: AppealTimelineTextSegment["tone"],
): AppealTimelineTextSegment {
  return buildTimelineTextSegment(
    text,
    `${APPEAL_TIMELINE_I18N_PREFIX}.${i18nKey}`,
    i18nValues,
    tone,
  );
}

const APPEAL_STATUS_CODE_MAP: Record<string, AppealStatus> = {
  pending: "Pending",
  resolved: "Resolved",
  departmentprocessing: "Department Processing",
  departmentprocessed: "Department Processed",
  pendingcustomer: "Pending Customer",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function normalizeText(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return "";
}

function isArabicLanguage() {
  const language = i18next.resolvedLanguage || i18next.language;
  return language?.toLowerCase().startsWith("ar") ?? false;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveLocalizedName(value?: unknown, fallback = "") {
  const fallbackText = normalizeText(fallback);
  if (!isRecord(value)) return fallbackText;

  const nameEn = normalizeText(value.nameEn);
  const nameAr = normalizeText(value.nameAr);

  if (isArabicLanguage()) {
    return nameAr || nameEn || fallbackText;
  }

  return nameEn || nameAr || fallbackText;
}

function resolveLocalizedObjectField(
  source: unknown,
  fieldNames: string[],
) {
  if (!isRecord(source)) return "";

  for (const fieldName of fieldNames) {
    const localizedValue = resolveLocalizedName(source[fieldName]);
    if (localizedValue) return localizedValue;
  }

  return "";
}

function resolveLocalizedNameFields(
  source: unknown,
  enFieldNames: string[],
  arFieldNames: string[],
) {
  if (!isRecord(source)) return "";

  const nameEn = normalizeText(...enFieldNames.map((fieldName) => source[fieldName]));
  const nameAr = normalizeText(...arFieldNames.map((fieldName) => source[fieldName]));

  if (isArabicLanguage()) return nameAr || nameEn;
  return nameEn || nameAr;
}

function resolveAppealReasonDisplay(source: unknown) {
  return (
    resolveLocalizedObjectField(source, [
      "appealReasonObj",
      "reasonObj",
      "appealReasonInfo",
      "reasonInfo",
      "appealReasonLookup",
      "reasonLookup",
    ]) ||
    resolveLocalizedNameFields(
      source,
      ["appealReasonNameEn", "reasonNameEn"],
      ["appealReasonNameAr", "reasonNameAr"],
    )
  );
}

function normalizeNullableNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  return normalizeNumber(value);
}

function normalizeRecommendationObjectTypeId(value: unknown) {
  if (!isRecord(value)) return undefined;
  return normalizeNullableNumber(value.recommendationTypeId);
}

function normalizeRecommendationObjectTypeCode(value: unknown) {
  if (!isRecord(value)) return "";
  return normalizeText(value.recommendationTypeCode);
}

function normalizeId(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "number" || typeof value === "string" ? value : undefined;
}

function normalizeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeMoney(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  });
}

export function unwrapAppealPayload<T>(payload: T | { data?: T | null } | null | undefined): T | null {
  if (!payload) return null;
  if (typeof payload === "object" && "data" in payload) {
    return (payload as { data?: T | null }).data ?? null;
  }
  return payload as T;
}

export function normalizeAppealListResponse(
  payload: InspectionAppealListResponseDto | { data?: InspectionAppealListResponseDto | null } | null | undefined,
): InspectionAppealListResponseDto {
  const data = unwrapAppealPayload<InspectionAppealListResponseDto>(payload) ?? {};
  const items = normalizeArray(data.items);
  return {
    ...data,
    items,
    total: data.total ?? data.totalCount ?? items.length,
  };
}

function normalizeDepartmentName(
  departmentName?: string | null,
  departmentCode?: string | null,
) {
  const rawName = normalizeText(departmentName);
  const rawCode = normalizeText(departmentCode);
  const raw = rawName || rawCode;
  if (!raw) return "";

  const compact = (rawCode || rawName).replace(/\s+/g, "").toLowerCase();
  let normalized = raw;

  if (compact === "customerhappiness" || compact === "customerdept") {
    normalized = "Customer Happiness";
  } else if (compact === "content" || compact === "contentdepartment") {
    normalized = "Content Department";
  } else if (compact === "inspection" || compact === "inspectiondepartment") {
    normalized = "Inspection Department";
  } else if (compact === "licensing" || compact === "licensingdepartment") {
    normalized = "Licensing Department";
  } else if (compact === "customer") {
    normalized = "Customer";
  }

  return normalized;
}

function normalizeHandler(
  handler?: InspectionAppealHandlerDto | string | null,
  fallbackName?: string | null,
  fallbackDepartment?: string | null,
  fallbackDepartmentCode?: string | null,
): AppealHandler {
  if (typeof handler === "string") {
    return {
      id: normalizeText(fallbackName, handler) || EMPTY_VALUE,
      name: normalizeText(handler, fallbackName) || EMPTY_VALUE,
      department: normalizeDepartmentName(fallbackDepartment, fallbackDepartmentCode),
      departmentCode: normalizeText(fallbackDepartmentCode),
    };
  }

  const name = normalizeText(
    handler?.userName,
    handler?.name,
    fallbackName,
  );
  const departmentCode = normalizeText(
    handler?.departmentCode,
    fallbackDepartmentCode,
  );
  const department = normalizeDepartmentName(
    normalizeText(
      handler?.departmentName,
      handler?.departmentNameEn,
      handler?.departmentNameAr,
      fallbackDepartment,
    ),
    departmentCode,
  );

  return {
    id: normalizeText(handler?.userId, handler?.id, name) || EMPTY_VALUE,
    name: name || EMPTY_VALUE,
    department,
    departmentCode,
  };
}

function normalizeHandlerDisplayName(
  handler?: InspectionAppealHandlerDto | string | null,
  fallbackName?: string | null,
) {
  if (typeof handler === "string") {
    return normalizeText(fallbackName, handler);
  }

  return normalizeText(fallbackName, handler?.userName, handler?.name);
}

function resolveAppealApplyForType(
  item: InspectionAppealListItemDto,
): AppealRecord["applyFor"]["type"] {
  const violatorType = normalizeText(item.violation?.violatorType);
  if (violatorType === "Establishment") return "Commercial";
  if (violatorType === "Individual") return "Individual";
  return undefined;
}

function normalizeApplyFor(item: InspectionAppealListItemDto): AppealRecord["applyFor"] {
  const applyFor = item.applyFor;
  const applyForType = resolveAppealApplyForType(item);

  if (typeof applyFor === "string") {
    return {
      id: applyFor || EMPTY_VALUE,
      name: applyFor || EMPTY_VALUE,
      type: applyForType,
    };
  }

  const hasFineChange =
    applyFor?.oldFineAmount !== undefined ||
    applyFor?.newFineAmount !== undefined;
  const hasStatusChange =
    applyFor?.oldViolationStatusId !== undefined ||
    applyFor?.newViolationStatusId !== undefined ||
    Boolean(applyFor?.oldViolationStatusName || applyFor?.newViolationStatusName);
  let labelKey: string | undefined;
  let labelOptions: Record<string, string> | undefined;

  let name = normalizeText(
    applyFor?.name,
    applyFor?.userName,
    applyFor?.fullName,
    applyFor?.profileName,
  );
  if (!name && hasFineChange && hasStatusChange) {
    name = "Fine and status change";
    labelKey = "Customer.customerAppeals.dynamic.fineAndStatusChange";
  } else if (!name && hasFineChange) {
    const oldAmount = normalizeMoney(applyFor?.oldFineAmount);
    const newAmount = normalizeMoney(applyFor?.newFineAmount);
    if (oldAmount && newAmount) {
      name = `Fine ${oldAmount} to ${newAmount}`;
      labelKey = "Customer.customerAppeals.dynamic.fineChange";
      labelOptions = { oldAmount, newAmount };
    } else {
      name = "Fine adjustment";
      labelKey = "Customer.customerAppeals.dynamic.fineAdjustment";
    }
  } else if (!name && hasStatusChange) {
    const oldStatus = normalizeText(
      applyFor?.oldViolationStatusName,
      applyFor?.oldViolationStatusId,
    );
    const newStatus = normalizeText(
      applyFor?.newViolationStatusName,
      applyFor?.newViolationStatusId,
    );
    if (oldStatus && newStatus) {
      name = `Status ${oldStatus} to ${newStatus}`;
      labelKey = "Customer.customerAppeals.dynamic.statusChange";
      labelOptions = { oldStatus, newStatus };
    } else {
      name = "Violation status change";
      labelKey = "Customer.customerAppeals.dynamic.violationStatusChange";
    }
  }

  return {
    id: normalizeText(
      applyFor?.id,
      applyFor?.userId,
      applyFor?.profileId,
      name,
    ) || EMPTY_VALUE,
    name: name || EMPTY_VALUE,
    type: applyForType,
    labelKey,
    labelOptions,
  };
}

function normalizeStatusName(item: InspectionAppealListItemDto) {
  const statusId = normalizeNumber(item.statusId);
  return (
    normalizeStatusFromCode(item.statusCode) ||
    normalizeStatusFromId(statusId) ||
    normalizeText(item.statusName) ||
    EMPTY_VALUE
  );
}

function normalizeStatusCode(value?: string | null) {
  return normalizeText(value).replace(/[\s_-]+/g, "").toLowerCase();
}

function normalizeViolationStatusCode(value?: string | null) {
  return normalizeText(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .toUpperCase();
}

function normalizeStatusFromCode(statusCode?: string | null): AppealStatus | undefined {
  const normalizedStatusCode = normalizeStatusCode(statusCode);
  if (!normalizedStatusCode) return undefined;

  return APPEAL_STATUS_CODE_MAP[normalizedStatusCode];
}

function normalizeRelatedViolationStatusCandidate(
  value?: string | null,
  finalAppeal = false,
): InspectionViolationStatus | undefined {
  const normalizedStatus = normalizeViolationStatusCode(value);
  if (!normalizedStatus) return undefined;
  if (normalizedStatus === "CLOSED") return "PAID";
  if (finalAppeal && normalizedStatus === "RESOLVED") return "PAID";
  if (normalizedStatus === "WARNING_ISSUE") return "WARNING_ISSUED";
  if (normalizedStatus === "RECTIFICATION_REQUIRED") return "RECTIFICATION";
  if (normalizedStatus === "UNDER_REVIEW") return "PENDING_REVIEW";
  return normalizedStatus as InspectionViolationStatus;
}

function resolveRelatedViolationStatus(
  detail: Partial<InspectionAppealDetailDto>,
  appealStatus: AppealStatus,
): InspectionViolationStatus | undefined {
  const appealStatusKey = normalizeStatusCode(appealStatus);
  if (!appealStatusKey) return undefined;
  const finalAppeal = FINAL_APPEAL_STATUS_KEYS.has(appealStatusKey);

  const relatedViolation = detail.relatedViolation;
  const violation = detail.violation;
  const statusCandidates: Array<InspectionViolationStatus | undefined> = [
    normalizeRelatedViolationStatusCandidate(relatedViolation?.status, finalAppeal),
    normalizeRelatedViolationStatusCandidate(relatedViolation?.statusName, finalAppeal),
    normalizeRelatedViolationStatusCandidate(violation?.status, finalAppeal),
    normalizeRelatedViolationStatusCandidate(violation?.statusName, finalAppeal),
    normalizeRelatedViolationStatusCandidate(detail.violationStatusName, finalAppeal),
    getInspectionViolationStatusFromId(violation?.statusId),
    getInspectionViolationStatusFromId(detail.violationStatusId),
    detail.isViolationPaid === true ? "PAID" : undefined,
  ];

  if (!finalAppeal) {
    return statusCandidates.includes("UNDER_APPEAL") ? "UNDER_APPEAL" : undefined;
  }

  return statusCandidates.find(
    (status): status is InspectionViolationStatus =>
      Boolean(status && FINAL_RELATED_VIOLATION_STATUSES.has(status)),
  );
}

function normalizeStatusFromId(statusId?: number): AppealStatus | undefined {
  return statusId ? APPEAL_STATUS_NAME_MAP[statusId] : undefined;
}

function isStatusAllowed(
  record: AppealRecord,
  allowedStatuses: AppealStatus[],
) {
  const allowedCodes = allowedStatuses.map((status) =>
    normalizeStatusCode(String(status)),
  );
  const status =
    normalizeStatusFromCode(record.statusCode) ||
    normalizeStatusFromCode(record.status);
  return Boolean(status && allowedCodes.includes(normalizeStatusCode(status)));
}

export function isAppealStatusAllowed(
  record: AppealRecord | null | undefined,
  allowedStatuses: AppealStatus[],
) {
  if (!record) return false;
  return isStatusAllowed(record, allowedStatuses);
}

function normalizeStatusId(status?: AppealStatus | null) {
  return APPEAL_STATUS_ID_MAP[String(status ?? "")];
}

export function mapStatusNameToId(status?: AppealStatus | null) {
  return normalizeStatusId(status);
}

function parseSlaHours(value?: string | null) {
  const raw = normalizeText(value);
  if (!raw || raw === EMPTY_VALUE) return undefined;
  const matched = raw.match(/(-?\d+(?:\.\d+)?)\s*(d|day|days|h|hour|hours|min|minute|minutes)?/i);
  if (!matched) return undefined;
  const amount = Number(matched[1]);
  if (!Number.isFinite(amount)) return undefined;
  const unit = String(matched[2] ?? "h").toLowerCase();
  const hours = unit.startsWith("d") ? amount * 24 : unit.startsWith("min") ? amount / 60 : amount;
  return /overdue|exceeded/i.test(raw) ? -Math.abs(hours) : hours;
}

function parseSlaDueHours(value?: string | null) {
  const raw = normalizeText(value);
  if (!raw) return undefined;
  const remainingMs = msUntil(raw);
  if (remainingMs === null) return undefined;
  return remainingMs / 36e5;
}

type AppealSlaValue = InspectionAppealListItemDto["sla"];

function isAppealSlaObject(
  value: AppealSlaValue | undefined,
): value is Exclude<NonNullable<AppealSlaValue>, string> {
  return isRecord(value);
}

function normalizeAppealSlaDisplayText(value: AppealSlaValue | undefined) {
  if (typeof value === "string") return normalizeText(value);
  if (!isAppealSlaObject(value) || value.isVisible === false) return "";
  return normalizeText(value.displayText);
}

function normalizeAppealSlaDueOn(value: AppealSlaValue | undefined) {
  if (!isAppealSlaObject(value) || value.isVisible === false) return "";
  return normalizeText(value.dueOn);
}

function isAppealSlaHidden(value: AppealSlaValue | undefined) {
  return isAppealSlaObject(value) && !normalizeAppealSlaDisplayText(value);
}

function resolveAppealSlaHours(
  slaHours: number | null | undefined,
  sla: AppealSlaValue | undefined,
  slaDueOn?: string | null,
) {
  if (isAppealSlaObject(sla)) return undefined;
  if (typeof slaHours === "number") return slaHours;
  return parseSlaHours(normalizeAppealSlaDisplayText(sla)) ??
    parseSlaDueHours(slaDueOn);
}

function getAttachmentType(nameOrUrl: string): AppealAttachment["type"] {
  const ext = String(nameOrUrl).split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "pdf") {
    return ext;
  }
  return "pdf";
}

function normalizeAttachment(
  attachment: InspectionAppealAttachmentDto | string | null | undefined,
  index: number,
): AppealAttachment | null {
  if (!attachment) return null;

  if (typeof attachment === "string") {
    const filePath = normalizeAppealAttachmentFilePath(attachment);
    if (!filePath) return null;
    const name = decodeURIComponent(filePath.split("/").pop() || `Attachment ${index + 1}`);
    return {
      id: `${filePath}-${index}`,
      name,
      type: getAttachmentType(name || filePath),
      filePath,
      url: buildAppealAttachmentAccessUrl(filePath),
    };
  }

  const fileUrl = normalizeText(attachment.fileUrl, attachment.url, attachment.filePath);
  const filePath = normalizeAppealAttachmentFilePath(fileUrl);
  if (!filePath) return null;
  const name = normalizeText(
    attachment.fileName,
    attachment.name,
    decodeURIComponent(filePath.split("/").pop() || ""),
    `Attachment ${index + 1}`,
  );

  return {
    id: normalizeText(attachment.id, filePath, index),
    name,
    type: getAttachmentType(name || filePath),
    filePath,
    url: buildAppealAttachmentAccessUrl(filePath),
    contentType: normalizeText(attachment.contentType),
  };
}

export function mapAppealAttachments(
  attachments?: (InspectionAppealAttachmentDto | string)[] | null,
): AppealAttachment[] {
  return normalizeArray(attachments)
    .map((item, index) => normalizeAttachment(item, index))
    .filter(Boolean) as AppealAttachment[];
}

function mapAppealReasonAttachments(
  detail: Partial<InspectionAppealDetailDto>,
): AppealAttachment[] {
  const directAttachmentUrls = [
    detail.attachmentUrl1,
    detail.attachmentUrl2,
    detail.attachmentUrl3,
  ].filter((attachmentUrl): attachmentUrl is string =>
    Boolean(normalizeText(attachmentUrl)),
  );
  return mapAppealAttachments(directAttachmentUrls);
}

export function mapAppealAttachmentToWriteDto(
  attachment: AppealAttachment,
): InspectionAppealWriteAttachmentDto {
  return {
    fileName: attachment.name,
    fileUrl: attachment.filePath || attachment.url,
    contentType: attachment.contentType,
  };
}

function normalizeAdjustment(
  adjustment: InspectionAppealAdjustmentDto | null | undefined,
): AppealAdjustment | null {
  if (!adjustment) return null;
  return {
    violationItemId: adjustment.violationItemId ?? undefined,
    violationItemCode: normalizeText(adjustment.violationItemCode) || undefined,
    violationItemName: normalizeText(adjustment.violationItemName) || undefined,
    violationDescription: normalizeText(adjustment.violationDescription) || undefined,
    violationDescriptionEn: normalizeText(adjustment.violationDescriptionEn) || undefined,
    violationDescriptionAr: normalizeText(adjustment.violationDescriptionAr) || undefined,
    currentDegreeCode: normalizeText(adjustment.currentDegreeCode) || undefined,
    requestedDegreeCode: normalizeText(adjustment.newDegree) || undefined,
    isSelected:
      typeof adjustment.isSelected === "boolean" ? adjustment.isSelected : undefined,
    isCancelled:
      typeof adjustment.isCancelled === "boolean" ? adjustment.isCancelled : undefined,
    proposedDegree: adjustment.newDegree ?? undefined,
    proposedFineAmount: adjustment.newFineAmount ?? undefined,
    proposedViolationStatusId: adjustment.newViolationStatusId ?? undefined,
    amount:
      typeof adjustment.amount === "number" && Number.isFinite(adjustment.amount)
        ? adjustment.amount
        : undefined,
    notes: normalizeText(adjustment.notes) || undefined,
  };
}

function mapAppealAdjustments(
  adjustments?: InspectionAppealAdjustmentDto[] | null,
): AppealAdjustment[] {
  return normalizeArray(adjustments)
    .map(normalizeAdjustment)
    .filter(Boolean) as AppealAdjustment[];
}

function resolveAppealPaidFine(
  detail: InspectionAppealDetailDto,
) {
  return {
    hasPaidFine: Boolean(detail.isViolationPaid),
  };
}

function normalizeAppealRelatedViolation(
  detail: Partial<InspectionAppealDetailDto>,
  appealStatus: AppealStatus,
  fallback?: AppealRecord["relatedViolation"],
): AppealRecord["relatedViolation"] {
  const relatedViolation = detail.relatedViolation;
  const violation = detail.violation;

  const violationNo = normalizeText(
    relatedViolation?.violationNo,
    violation?.violationNo,
  );
  const violationType = normalizeText(
    relatedViolation?.violationType,
    relatedViolation?.violationTypeName,
    violation?.violationType,
    violation?.violationTypeName,
  );
  const violationDate = normalizeText(
    relatedViolation?.violationDate,
    relatedViolation?.createdOn,
    violation?.violationDate,
    violation?.createdOn,
  );
  const explicitStatus = normalizeText(
    relatedViolation?.status,
    relatedViolation?.statusName,
    violation?.status,
    violation?.statusName,
    detail.violationStatusName,
  );
  const hasStatusId =
    Boolean(getInspectionViolationStatusFromId(violation?.statusId)) ||
    Boolean(getInspectionViolationStatusFromId(detail.violationStatusId));
  const hasStatusEvidence =
    Boolean(explicitStatus) || hasStatusId || detail.isViolationPaid === true;
  const status = hasStatusEvidence
    ? resolveRelatedViolationStatus(detail, appealStatus)
    : undefined;

  if (!violationNo && !violationType && !violationDate && !status) {
    return fallback;
  }

  return {
    violationNo: violationNo || EMPTY_VALUE,
    violationType: violationType || EMPTY_VALUE,
    violationDate: violationDate || EMPTY_VALUE,
    status: status || EMPTY_VALUE,
  };
}

function buildEmptyAppealRecord(reference: string): AppealRecord {
  return {
    appealNo: reference || EMPTY_VALUE,
    violationNo: EMPTY_VALUE,
    appealReason: EMPTY_VALUE,
    status: EMPTY_VALUE,
    applyFor: {
      id: EMPTY_VALUE,
      name: EMPTY_VALUE,
    },
    currentHandler: {
      id: EMPTY_VALUE,
      name: EMPTY_VALUE,
      department: "",
    },
    assignedAt: "",
    lastUpdatedAt: "",
    attachments: [],
    communicationRecords: [],
    timeline: [],
    adjustments: [],
    applicantOverview: {
      fullName: EMPTY_VALUE,
      email: EMPTY_VALUE,
      mobileNumber: EMPTY_VALUE,
    },
    profileOverview: {
      profileType: EMPTY_VALUE,
      statusLabel: EMPTY_VALUE,
      statusTone: "neutral",
      fields: [],
      statistics: [],
      alerts: [],
    },
    applicationOverview: {
      statistics: [],
    },
  };
}

export function buildFallbackAppealDetailRecord(reference?: string | number | null): AppealRecord {
  const fallbackReference = normalizeText(reference) || EMPTY_VALUE;
  return {
    ...buildEmptyAppealRecord(fallbackReference),
    appealId: fallbackReference,
  };
}

export function mapAppealListItemToRecord(
  item: InspectionAppealListItemDto,
): AppealRecord {
  const status = normalizeStatusName(item);
  const statusId = normalizeNumber(item.statusId);
  const statusDisplay = resolveLocalizedName(item.statusObj);
  const appealReason = normalizeText(item.appealReason) || EMPTY_VALUE;
  const appealReasonDisplay = resolveAppealReasonDisplay(item);
  const currentDepartmentName = normalizeDepartmentName(
    normalizeText(
      item.currentDepartment?.name,
      item.currentDepartment?.departmentName,
      item.currentDepartmentName,
    ),
    normalizeText(
      item.currentDepartment?.code,
      item.currentDepartment?.departmentCode,
      item.currentDepartmentCode,
    ),
  );
  const currentDepartmentCode = normalizeText(
    item.currentDepartment?.code,
    item.currentDepartment?.departmentCode,
    item.currentDepartmentCode,
  );
  const currentHandlerName = normalizeHandlerDisplayName(
    item.currentHandler,
    item.currentHandlerUserName,
  );
  const appealNo = normalizeText(item.appealNo) || EMPTY_VALUE;
  const rawSla = normalizeAppealSlaDisplayText(item.sla);
  const slaDueOn = normalizeText(
    normalizeAppealSlaDueOn(item.sla),
    item.slaDueOn,
  );

  return {
    ...buildEmptyAppealRecord(appealNo),
    appealId: item.id ?? appealNo,
    sourceTaskId: normalizeId(item.sourceTaskId),
    taskId: normalizeId(item.taskId),
    userId:
      normalizeText(
        typeof item.applyFor === "object" ? item.applyFor?.userId : "",
      ) || undefined,
    profileId:
      typeof item.applyFor === "object" &&
      typeof item.applyFor?.profileId === "number"
        ? item.applyFor.profileId
        : undefined,
    applicationNo: normalizeText(item.applicationNo) || undefined,
    appealNo,
    violationNo: normalizeText(item.violation?.violationNo) || EMPTY_VALUE,
    violationId: item.violationId ?? item.violation?.id ?? undefined,
    violationTypeId: normalizeId(item.violation?.violationTypeId),
    violationStatusId: normalizeId(item.violation?.statusId),
    violationStatusName: normalizeText(item.violation?.statusName) || undefined,
    violationFineAmount: normalizeNumber(item.violation?.fineAmount),
    appealReason,
    appealReasonDisplay: appealReasonDisplay || undefined,
    statusId,
    statusCode: normalizeText(item.statusCode) || undefined,
    status,
    statusDisplay: statusDisplay || undefined,
    applyFor: normalizeApplyFor(item),
    currentHandler: normalizeHandler(
      item.currentHandler,
      currentHandlerName,
      currentHandlerName ? currentDepartmentName : "",
      currentDepartmentCode,
    ),
    ownerHandler: normalizeHandler(
      item.ownerHandler,
      undefined,
      item.ownerDepartment?.name,
      item.ownerDepartment?.code,
    ),
    assignedAt: normalizeText(item.assignedOn, item.createdOn),
    lastUpdatedAt: normalizeText(item.lastUpdatedOn),
    responseDeadline: normalizeText(item.responseDeadline, slaDueOn),
    slaDeadline: slaDueOn || undefined,
    slaHours: resolveAppealSlaHours(item.slaHours, item.sla, slaDueOn),
    rawSla,
  };
}

function normalizeCount(value: unknown) {
  const count = normalizeNumber(value);
  return count ?? 0;
}

export function mapAppealSummaryItems(
  stats: InspectionAppealStatsDto | { data?: InspectionAppealStatsDto | null } | null,
  keys: AppealSummaryItem["key"][],
): AppealSummaryItem[] {
  const data = unwrapAppealPayload(stats) ?? {};
  const countMap: Record<AppealSummaryItem["key"], number> = {
    total: normalizeCount(data.total ?? data.totalCount),
    departmentProcessing: normalizeCount(data.departmentProcessingCount),
    departmentProcessed: normalizeCount(data.departmentProcessedCount),
    pendingCustomer: normalizeCount(data.pendingCustomerCount),
    approved: normalizeCount(data.approvedCount),
    rejected: normalizeCount(data.rejectedCount),
    cancelled: normalizeCount(data.cancelledCount),
  };

  const labelFallbackMap: Record<AppealSummaryItem["key"], string> = {
    total: "Total",
    departmentProcessing: "Department Processing",
    departmentProcessed: "Department Processed",
    pendingCustomer: "Pending Customer",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };

  const iconMap: Record<AppealSummaryItem["key"], AppealSummaryItem["iconKey"]> = {
    total: "total",
    departmentProcessing: "departmentProcessing",
    departmentProcessed: "departmentProcessed",
    pendingCustomer: "pendingCustomer",
    approved: "approved",
    rejected: "rejected",
    cancelled: "cancelled",
  };

  return keys.map((key) => ({
    key,
    label: labelFallbackMap[key],
    count: countMap[key] ?? 0,
    iconKey: iconMap[key],
  }));
}

export function buildAppealFilterOptions(
  handlers: AppealHandler[],
  departments: AppealHandler[],
): AppealFilterOptions {
  return {
    handlers,
    appealReasons: APPEAL_REASON_OPTIONS,
    todoStatuses: [
      "Department Processing",
      "Department Processed",
      "Pending Customer",
    ],
    completedStatuses: ["Approved", "Rejected", "Cancelled"],
    departments,
  };
}

export function mapAppealListResponse(
  payload: InspectionAppealListResponseDto | { data?: InspectionAppealListResponseDto | null } | null | undefined,
): AppealListResult {
  const response = normalizeAppealListResponse(payload);
  return {
    items: normalizeArray(response.items).map(mapAppealListItemToRecord),
    total: response.total ?? 0,
  };
}

export function resolveAppealViewRole(
  role: AppealViewRole,
  stats?: InspectionAppealStatsDto | { data?: InspectionAppealStatsDto | null } | null,
): AppealViewRole {
  const data = unwrapAppealPayload(stats);
  return data ? role : role;
}

function normalizeRecommendation(
  value?: string | null,
): "Approve" | "Reject" | undefined {
  const raw = normalizeText(value).replace(/[\s_-]+/g, "").toLowerCase();
  if (raw === "approve") return "Approve";
  if (raw === "reject") return "Reject";
  return undefined;
}

function normalizeRecommendationTypeId(value?: number | string | null) {
  const recommendationTypeId = normalizeNullableNumber(value);
  if (recommendationTypeId === 1) return "Approve";
  if (recommendationTypeId === 2) return "Reject";
  return undefined;
}

function normalizeRecommendationFromFields(
  recommendationTypeId?: number | string | null,
  recommendationTypeCode?: string | null,
) {
  const recommendationFromTypeId = normalizeRecommendationTypeId(recommendationTypeId);
  if (recommendationFromTypeId) return recommendationFromTypeId;

  return normalizeRecommendation(recommendationTypeCode);
}

function normalizeActionTypeCode(value?: string | null) {
  return normalizeText(value).replace(/[\s_-]+/g, "").toLowerCase();
}

function getLatestDepartmentAction(
  actions?: InspectionAppealDetailDto["departmentActions"] | null,
) {
  const getActionTime = (
    action: NonNullable<InspectionAppealDetailDto["departmentActions"]>[number],
  ) => Date.parse(normalizeText(action.actionOn, action.createdOn));

  const actionsWithRecommendation = normalizeArray(actions).filter((item) =>
    Boolean(
      normalizeRecommendationFromFields(
        item.recommendationTypeId,
        item.recommendationTypeCode,
      ),
    ),
  );

  return actionsWithRecommendation.reduce<
    NonNullable<InspectionAppealDetailDto["departmentActions"]>[number] | undefined
  >((latest, item) => {
    if (!latest) return item;

    const itemTime = getActionTime(item);
    const latestTime = getActionTime(latest);
    const hasItemTime = Number.isFinite(itemTime);
    const hasLatestTime = Number.isFinite(latestTime);

    if (hasItemTime && hasLatestTime) {
      return itemTime >= latestTime ? item : latest;
    }
    if (hasItemTime) return item;
    if (!hasLatestTime) return item;
    return latest;
  }, undefined);
}

type AppealMessageMapContext = {
  customerDisplayName?: string;
  departmentActions?: InspectionAppealDetailDto["departmentActions"] | null;
  appealSlaDueOn?: string;
};

function isUserMessage(item: InspectionAppealMessageDto) {
  return normalizeActionTypeCode(item.messageTypeCode) === "usermessage";
}

function isAutoTransferSystemMessage(
  item: InspectionAppealMessageDto,
  isSystem: boolean,
) {
  if (!isSystem) return false;
  const content = normalizeText(item.body, item.content, item.messageContent);
  return /automatically transferred to/i.test(content);
}

function isSameDateTime(left?: string | null, right?: string | null) {
  const leftText = normalizeText(left);
  const rightText = normalizeText(right);
  if (!leftText || !rightText) return false;

  const leftTime = Date.parse(leftText);
  const rightTime = Date.parse(rightText);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime === rightTime;
  }

  return leftText === rightText;
}

function getMessageDepartmentAction(
  item: InspectionAppealMessageDto,
  actions?: InspectionAppealDetailDto["departmentActions"] | null,
) {
  const messageCreatedOn = normalizeText(item.createdOn);
  if (!messageCreatedOn) return undefined;

  return normalizeArray(actions).find((action) => {
    if (normalizeActionTypeCode(action.actionTypeCode) !== "process") {
      return false;
    }

    return isSameDateTime(
      normalizeText(action.actionOn, action.createdOn),
      messageCreatedOn,
    );
  });
}

function getDecisionSystemContent(
  item: InspectionAppealMessageDto,
  hasMappedRecommendation: boolean,
) {
  const content =
    normalizeText(item.body, item.content, item.messageContent, item.note) ||
    EMPTY_VALUE;

  if (!hasMappedRecommendation) return content;

  return content
    .split(/\r?\n/)
    .filter((line) => !/^Recommended Action:/i.test(line.trim()))
    .join("\n")
    .trim() || content;
}

export function mapAppealMessages(
  messages?: InspectionAppealMessageDto[] | null,
  context: AppealMessageMapContext = {},
): AppealComment[] {
  return normalizeArray(messages).map((item, index) => {
    const messageType = normalizeText(item.messageTypeCode).toLowerCase();
    const isInternalNote = Boolean(item.isInternalNote ?? item.isInternal);
    const isSystem =
      Boolean(item.isSystemMessage) ||
      Boolean(item.isSystemEvent) ||
      messageType.includes("system") ||
      (!item.senderUserId && messageType.includes("internal"));
    const isCustomerMessage = isUserMessage(item);
    const matchedDepartmentAction = isSystem
      ? getMessageDepartmentAction(item, context.departmentActions)
      : undefined;
    const actionRecommendation = normalizeRecommendationFromFields(
      matchedDepartmentAction?.recommendationTypeId,
      matchedDepartmentAction?.recommendationTypeCode,
    );
    const recommendation = actionRecommendation || normalizeRecommendationFromFields(
      item.recommendationTypeId,
      item.recommendationTypeCode,
    );
    const actionAttachments = matchedDepartmentAction
      ? mapAppealAttachments(matchedDepartmentAction.attachments)
      : [];
    const attachments = actionAttachments.length
      ? actionAttachments
      : mapAppealAttachments(item.attachments);
    const senderDepartment = isCustomerMessage
      ? "Customer"
      : normalizeDepartmentName(
          normalizeText(
            item.senderDepartmentName,
            item.currentDepartmentName,
            item.targetDepartmentName,
          ),
          normalizeText(
            item.senderDepartmentCode,
            item.currentDepartmentCode,
            item.targetDepartmentCode,
          ),
        );
    const responseDeadline = isAutoTransferSystemMessage(item, isSystem)
      ? normalizeText(context.appealSlaDueOn)
      : normalizeText(item.deadline, item.responseDeadline);
    const notes = normalizeText(matchedDepartmentAction?.notes, item.note, item.reason);
    const content = getDecisionSystemContent(item, Boolean(actionRecommendation));
    const hideAttachmentOnlyPlaceholder =
      content === EMPTY_VALUE && attachments.length > 0;

    return {
      id: normalizeText(item.id, item.messageId, `message-${index}`),
      kind: isSystem ? "system" : "message",
      audience: isInternalNote ? "internal" : "customer",
      isInternalNote,
      senderUserId: normalizeText(item.senderUserId),
      senderName:
        (isCustomerMessage ? normalizeText(context.customerDisplayName) : "") ||
        normalizeText(item.senderUserName, item.senderName) ||
        (isSystem ? "System" : EMPTY_VALUE),
      senderPhotoUrl: normalizeText(item.senderPhotoUrl),
      senderDepartment,
      senderDepartmentCode: normalizeText(
        item.senderDepartmentCode,
        item.currentDepartmentCode,
      ),
      sentAt: normalizeText(item.createdOn),
      content: hideAttachmentOnlyPlaceholder ? "" : content,
      responseDeadline,
      recommendation,
      reviewResult: normalizeText(item.reviewResultCode),
      notes,
      attachments,
    };
  });
}

function normalizeTimelineTitle(item: InspectionAppealTimelineItemDto) {
  if (isCancelledTimelineEvent(item)) return "Cancelled";

  const statusId = normalizeNumber(item.toStatusId);
  const rawTitle =
    normalizeText(
      item.eventName,
      statusId ? APPEAL_STATUS_NAME_MAP[statusId] : "",
      item.displayStatusCode,
    ) || "Status Update";
  const compactTitle = rawTitle.replace(/\s+/g, "").toLowerCase();
  const knownTitle = Object.values(APPEAL_STATUS_NAME_MAP).find(
    (statusName) =>
      statusName.replace(/\s+/g, "").toLowerCase() === compactTitle,
  );

  if (knownTitle) return knownTitle;
  if (compactTitle === "appealsubmitted") return "Appeal Submitted";

  return rawTitle.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function getTimelineRefundNo(
  item: InspectionAppealTimelineItemDto,
) {
  return normalizeText(item.refundNo);
}

function isApprovedTimelineEvent(
  item: InspectionAppealTimelineItemDto,
  title: string,
) {
  return (
    title === "Approved" ||
    normalizeActionTypeCode(item.eventCode) === "appealapproved"
  );
}

function isRejectedTimelineEvent(
  item: InspectionAppealTimelineItemDto,
  title: string,
) {
  return (
    title === "Rejected" ||
    normalizeActionTypeCode(item.eventCode) === "appealrejected"
  );
}

function isCancelledTimelineEvent(item: InspectionAppealTimelineItemDto) {
  return normalizeActionTypeCode(item.eventCode) === "cancelled";
}

function isAutoRejectedNoDecisionTimelineEvent(
  item: InspectionAppealTimelineItemDto,
) {
  return (
    normalizeActionTypeCode(item.actionTypeCode) ===
    AUTO_REJECTED_NO_DECISION_ACTION_TYPE_CODE
  );
}

function isDepartmentProcessedTimelineEvent(
  item: InspectionAppealTimelineItemDto,
  title: string,
) {
  return (
    title === "Department Processed" ||
    normalizeActionTypeCode(item.eventCode) === "appealdepartmentprocessed"
  );
}

function buildAutoRejectedNoDecisionActionSegments() {
  return [
    buildTimelineTextSegment(
      REJECTED_NO_DECISION_TEXT,
      REJECTED_NO_DECISION_TIMELINE_I18N_KEY,
    ),
  ];
}

function buildTimelineActionSegments(
  item: InspectionAppealTimelineItemDto,
  title: string,
): AppealTimelineTextSegment[] | undefined {
  const isSubmitted = /submitted/i.test(title);
  const content = normalizeText(item.content);
  const eventCode = normalizeActionTypeCode(item.eventCode);
  const actionTypeCode = normalizeActionTypeCode(item.actionTypeCode);
  const targetName = normalizeText(item.targetHandlerUserName) || EMPTY_VALUE;

  if (isAutoRejectedNoDecisionTimelineEvent(item)) {
    return buildAutoRejectedNoDecisionActionSegments();
  }

  if (isSubmitted) return undefined;

  if (eventCode === "appealassigned") {
    return [
      buildTimelineActionTextSegment(
        `Appeal assigned to ${targetName}.`,
        "appealAssignedTo",
        { targetName },
      ),
    ];
  }

  if (
    eventCode === "appealdepartmentprocessing" &&
    actionTypeCode === "reassigntodepartment"
  ) {
    return [
      buildTimelineActionTextSegment(
        `Appeal was automatically transferred to ${targetName}.`,
        "appealAutoTransferredTo",
        { targetName },
      ),
    ];
  }

  if (eventCode === "appealdepartmentprocessed") {
    if (actionTypeCode === "sendback") {
      return [
        buildTimelineActionTextSegment(
          `Appeal was sent back and automatically transferred to ${targetName}.`,
          "appealSentBackTransferredTo",
          { targetName },
        ),
      ];
    }

    if (actionTypeCode === "process") {
      return [
        buildTimelineActionTextSegment(
          `Appeal was processed and automatically transferred to ${targetName}.`,
          "appealProcessedTransferredTo",
          { targetName },
        ),
      ];
    }
  }

  if (title === "Approved") {
    return [
      buildTimelineActionTextSegment(
        "Status changed to ",
        "statusChangedTo",
      ),
      buildTimelineTextSegment(
        "Approved",
        "Customer.customerAppeals.statuses.approved",
        undefined,
        "success",
      ),
      { text: "." },
    ];
  }

  if (title === "Rejected") {
    return [
      buildTimelineActionTextSegment(
        "Status changed to ",
        "statusChangedTo",
      ),
      buildTimelineTextSegment(
        "Rejected",
        "Customer.customerAppeals.statuses.rejected",
        undefined,
        "danger",
      ),
      { text: "." },
    ];
  }

  if (title === "Pending Customer") {
    return [
      buildTimelineActionTextSegment(
        "Status changed to ",
        "statusChangedTo",
      ),
      buildTimelineTextSegment(
        "pending customer",
        "Customer.customerAppeals.statuses.pendingCustomer",
        undefined,
        "primary",
      ),
      { text: "." },
    ];
  }

  if (content) {
    return [{ text: content }];
  }

  return undefined;
}

function buildRecommendationSegments(
  item: InspectionAppealTimelineItemDto,
  title: string,
): AppealTimelineTextSegment[] | undefined {
  if (!isDepartmentProcessedTimelineEvent(item, title)) return undefined;

  const recommendation = normalizeRecommendationFromFields(
    item.recommendationTypeId,
    item.recommendationTypeCode,
  );
  if (!recommendation) return undefined;

  return [
    { text: "Department Recommendation: " },
    {
      text: recommendation,
      tone: recommendation === "Approve" ? "success" : "danger",
    },
  ];
}

function buildProblemCauseSegments(
  item: InspectionAppealTimelineItemDto,
): AppealTimelineTextSegment[] | undefined {
  const reason = normalizeText(item.reason);
  if (!reason) return undefined;
  const reasonI18nKey = getAppealReasonTranslationKey(reason);
  return [
    { text: "Problem Cause: " },
    {
      text: reason,
      tone: "primary",
      ...(reasonI18nKey ? { i18nKey: reasonI18nKey } : {}),
    },
  ];
}

export function mapAppealTimeline(
  timeline?: InspectionAppealTimelineItemDto[] | null,
): AppealTimelineItem[] {
  // Keep the backend event for automatic assignment and auditing, but omit it
  // from the Admin Portal appeal timeline.
  const list = normalizeArray(timeline).filter(
    (item) =>
      normalizeActionTypeCode(item.eventCode) !==
      "appealhappinessinitialassignment",
  );
  const displayList = [...list].reverse();

  return displayList.map((item, index) => {
    const rawTitle = normalizeTimelineTitle(item);
    const departmentLabel = normalizeDepartmentName(
      normalizeText(item.targetDepartmentName, item.handlerDepartmentName),
      normalizeText(item.targetDepartmentCode, item.handlerDepartmentCode),
    );
    const actorName = normalizeText(item.handlerUserName);
    const attachments = mapAppealAttachments(item.attachments);
    const isSubmitted = /submitted/i.test(rawTitle);
    const isApproved = isApprovedTimelineEvent(item, rawTitle);
    const isRejected = isRejectedTimelineEvent(item, rawTitle);
    const isCancelled = isCancelledTimelineEvent(item);
    const isAutoRejectedNoDecision =
      isAutoRejectedNoDecisionTimelineEvent(item);
    const isDepartmentProcessed = isDepartmentProcessedTimelineEvent(
      item,
      rawTitle,
    );
    const refundNo = getTimelineRefundNo(item);
    const note =
      !isAutoRejectedNoDecision &&
      (isApproved || isRejected || isDepartmentProcessed)
        ? normalizeText(item.note)
        : "";
    const baseTimelineItem: AppealTimelineItem = {
      id: normalizeText(item.id, item.eventCode, item.createdOn, `timeline-${index}`),
      title: rawTitle,
      titleI18nKey: getAppealStatusTranslationKey(rawTitle),
      changedAt: normalizeText(item.createdOn),
      responseDeadline: normalizeText(item.deadline, item.responseDeadline),
      dotTone: index === 0 ? "active" : "inactive",
      actionSegments: buildTimelineActionSegments(item, rawTitle),
    };

    if (isCancelled) {
      return {
        ...baseTimelineItem,
        attachments: [],
        attachmentsCount: 0,
      };
    }

    return {
      ...baseTimelineItem,
      actorPrefix: isSubmitted ? "Submitted by" : "Current Handler",
      actorLabel: actorName || EMPTY_VALUE,
      departmentLabel: departmentLabel || EMPTY_VALUE,
      referenceType: refundNo ? "refund" : undefined,
      refundRequestId: item.refundRequestId ?? undefined,
      referenceLabel: refundNo ? "Refund No." : undefined,
      referenceNo: refundNo,
      recommendationSegments: buildRecommendationSegments(item, rawTitle),
      problemCauseSegments: buildProblemCauseSegments(item),
      note,
      attachments,
      attachmentsCount: attachments.length,
    };
  });
}

export function mergeAppealDetail(
  baseRecord: AppealRecord | null,
  detailPayload:
    | Partial<InspectionAppealDetailDto>
    | { data?: Partial<InspectionAppealDetailDto> | null },
  messagesPayload?: InspectionAppealMessageDto[] | { data?: InspectionAppealMessageDto[] | null } | null,
  timelinePayload?: InspectionAppealTimelineItemDto[] | { data?: InspectionAppealTimelineItemDto[] | null } | null,
): AppealRecord {
  const detail = unwrapAppealPayload(detailPayload) ?? {};
  const fallback =
    baseRecord ??
    buildEmptyAppealRecord(
      normalizeText(detail.appealNo, detail.id),
    );
  const status = normalizeStatusName(detail);
  const statusDisplay = resolveLocalizedName(detail.statusObj);
  const messages = unwrapAppealPayload(messagesPayload) ?? detail.messages ?? [];
  const timeline = unwrapAppealPayload(timelinePayload) ?? detail.timeline ?? [];
  const attachments = mapAppealReasonAttachments(detail);
  const currentDepartmentName = normalizeDepartmentName(
    normalizeText(
      detail.currentDepartment?.name,
      detail.currentDepartment?.departmentName,
      detail.currentDepartmentName,
    ),
    normalizeText(
      detail.currentDepartment?.code,
      detail.currentDepartment?.departmentCode,
      detail.currentDepartmentCode,
    ),
  );
  const currentDepartmentCode = normalizeText(
    detail.currentDepartment?.code,
    detail.currentDepartment?.departmentCode,
    detail.currentDepartmentCode,
  );
  const currentHandlerName = normalizeHandlerDisplayName(
    detail.currentHandler,
    detail.currentHandlerUserName,
  );
  const currentHandler = normalizeHandler(
    detail.currentHandler,
    currentHandlerName,
    currentHandlerName ? currentDepartmentName : "",
    currentDepartmentCode,
  );
  const applyFor = normalizeApplyFor(detail);
  const latestDepartmentAction = getLatestDepartmentAction(detail.departmentActions);
  const detailRecommendationTypeId =
    normalizeRecommendationObjectTypeId(detail.departmentRecommendation) ??
    normalizeNullableNumber(detail.departmentRecommendationTypeId);
  const detailRecommendationTypeCode =
    normalizeRecommendationObjectTypeCode(detail.departmentRecommendation) ||
    normalizeText(detail.departmentRecommendationTypeCode);
  const recommendation = normalizeRecommendationFromFields(
    detailRecommendationTypeId,
    detailRecommendationTypeCode,
  );
  const detailAdjustments = mapAppealAdjustments(
    detail.adjustments && detail.adjustments.length
      ? detail.adjustments
      : latestDepartmentAction?.adjustments,
  );
  const paymentSummary = resolveAppealPaidFine(detail);
  const detailSlaHidden = isAppealSlaHidden(detail.sla);
  const detailRawSla = normalizeAppealSlaDisplayText(detail.sla);
  const detailSlaDueOn = normalizeText(
    normalizeAppealSlaDueOn(detail.sla),
    detail.slaDueOn,
  );
  const detailSlaHours = resolveAppealSlaHours(
    detail.slaHours,
    detail.sla,
    detailSlaDueOn,
  );
  const overviewIdentity = detail.overviewIdentity;
  const appealReason =
    normalizeText(detail.appealReason) ||
    fallback.appealReason;
  const appealReasonDisplay =
    resolveAppealReasonDisplay(detail) ||
    fallback.appealReasonDisplay;

  return {
    ...fallback,
    appealId:
      normalizeId(detail.id) ??
      fallback.appealId,
    sourceTaskId: normalizeId(detail.sourceTaskId) ?? fallback.sourceTaskId,
    taskId: normalizeId(detail.taskId) ?? fallback.taskId,
    violationId: detail.violationId ?? detail.violation?.id ?? fallback.violationId,
    violationTypeId:
      normalizeId(detail.violationTypeId) ??
      normalizeId(detail.violation?.violationTypeId) ??
      fallback.violationTypeId,
    violationStatusId:
      normalizeId(detail.violationStatusId) ??
      normalizeId(detail.violation?.statusId) ??
      fallback.violationStatusId,
    violationStatusName:
      normalizeText(detail.violationStatusName, detail.violation?.statusName) ||
      fallback.violationStatusName,
    violationFineAmount:
      normalizeNumber(detail.violationFineAmount ?? detail.violation?.fineAmount) ??
      fallback.violationFineAmount,
    hasPaidFine: paymentSummary.hasPaidFine,
    userId:
      normalizeText(
        overviewIdentity?.userId,
        detail.userId,
        typeof detail.applyFor === "object" ? detail.applyFor?.userId : "",
      ) || fallback.userId,
    profileId:
      normalizeNullableNumber(overviewIdentity?.profileId) ??
      normalizeNullableNumber(overviewIdentity?.userProfileId) ??
      normalizeNullableNumber(detail.profileId) ??
      normalizeNullableNumber(detail.userProfileId) ??
      (typeof detail.applyFor === "object"
        ? normalizeNullableNumber(detail.applyFor?.profileId)
        : undefined) ??
      fallback.profileId,
    userProfileId:
      normalizeNullableNumber(overviewIdentity?.userProfileId) ??
      normalizeNullableNumber(overviewIdentity?.profileId) ??
      normalizeNullableNumber(detail.userProfileId) ??
      normalizeNullableNumber(detail.profileId) ??
      fallback.userProfileId,
    userTypeId:
      normalizeNullableNumber(overviewIdentity?.userTypeId) ??
      normalizeNullableNumber(detail.userTypeId) ??
      (typeof detail.applyFor === "object"
        ? normalizeNullableNumber(detail.applyFor?.userTypeId)
        : undefined) ??
      fallback.userTypeId,
    userTypeCode:
      normalizeText(overviewIdentity?.userTypeCode, detail.userTypeCode) ||
      fallback.userTypeCode,
    establishmentId:
      normalizeNullableNumber(overviewIdentity?.establishmentId) ??
      normalizeNullableNumber(detail.establishmentId) ??
      fallback.establishmentId,
    individualId:
      normalizeNullableNumber(overviewIdentity?.individualId) ??
      normalizeNullableNumber(detail.individualId) ??
      fallback.individualId,
    establishmentName:
      normalizeText(overviewIdentity?.establishmentName) ||
      normalizeText(detail.establishmentName) || fallback.establishmentName,
    establishmentNameAr:
      normalizeText(overviewIdentity?.establishmentNameAr) ||
      normalizeText(detail.establishmentNameAr) || fallback.establishmentNameAr,
    licenseNumber:
      normalizeText(overviewIdentity?.licenseNumber) ||
      normalizeText(detail.licenseNumber) || fallback.licenseNumber,
    applicationNo: normalizeText(detail.applicationNo) || fallback.applicationNo,
    appealNo: normalizeText(detail.appealNo) || fallback.appealNo,
    violationNo: normalizeText(detail.violation?.violationNo) || fallback.violationNo,
    appealReason,
    appealReasonDisplay: appealReasonDisplay || undefined,
    statusId:
      normalizeNumber(detail.statusId) ??
      fallback.statusId,
    statusCode: normalizeText(detail.statusCode) || fallback.statusCode,
    status,
    statusDisplay: statusDisplay || fallback.statusDisplay,
    applyFor,
    currentHandler,
    assignedAt:
      normalizeText(detail.assignedOn, detail.createdOn) || fallback.assignedAt,
    lastUpdatedAt: normalizeText(detail.lastUpdatedOn) || fallback.lastUpdatedAt,
    responseDeadline:
      normalizeText(detail.responseDeadline, detailSlaDueOn) ||
      fallback.responseDeadline,
    slaDeadline: detailSlaDueOn || fallback.slaDeadline,
    slaHours: isAppealSlaObject(detail.sla)
      ? undefined
      : detailSlaHours ?? fallback.slaHours,
    rawSla: detailSlaHidden ? "" : detailRawSla || fallback.rawSla,
    notes: normalizeText(detail.appealReasonRemark),
    attachments,
    communicationRecords: mapAppealMessages(messages, {
      customerDisplayName: applyFor.name,
      departmentActions: detail.departmentActions,
      appealSlaDueOn: detailSlaDueOn,
    }),
    timeline: mapAppealTimeline(timeline),
    departmentRecommendation: recommendation,
    departmentRecommendationTypeId: detailRecommendationTypeId,
    departmentRecommendationTypeCode: detailRecommendationTypeCode || undefined,
    finalDecision:
      normalizeText(
        detail.finalDecision?.decisionTypeCode,
        detail.finalDecision?.notes,
      ) || fallback.finalDecision,
    refund: detail.refund
      ? {
          refundNo: normalizeText(detail.refund.refundNo),
          refundAmount:
            typeof detail.refund.refundAmount === "number"
              ? detail.refund.refundAmount
              : undefined,
          refundScope: normalizeText(detail.refund.refundScope),
          failureReason: normalizeText(detail.refund.failureReason),
          retryCount:
            typeof detail.refund.retryCount === "number"
              ? detail.refund.retryCount
              : undefined,
          lastRetryOn: normalizeText(detail.refund.lastRetryOn),
        }
      : fallback.refund,
    adjustments: detailAdjustments.length ? detailAdjustments : fallback.adjustments,
    applicantOverview: {
      fullName: applyFor.name || fallback.applicantOverview.fullName,
      email: normalizeText(detail.applicantEmail) || fallback.applicantOverview.email,
      mobileNumber:
        normalizeText(detail.applicantMobileNumber) ||
        fallback.applicantOverview.mobileNumber,
    },
    profileOverview: {
      profileType:
        normalizeText(detail.profileType) || fallback.profileOverview.profileType,
      statusLabel:
        normalizeText(detail.profileStatus) || fallback.profileOverview.statusLabel,
      statusTone: fallback.profileOverview.statusTone || "neutral",
      fields: [
        {
          label: "Establishment Name",
          labelKey: "Customer.customerAppealsDetails.overview.establishmentName",
          value: normalizeText(detail.establishmentName, applyFor.name) || EMPTY_VALUE,
        },
        {
          label: "Commercial License Number",
          labelKey:
            "Customer.customerAppealsDetails.overview.commercialLicenseNumber",
          value: normalizeText(detail.commercialLicenseNumber) || EMPTY_VALUE,
        },
        {
          label: "Emirate",
          labelKey: "Customer.customerAppealsDetails.overview.emirate",
          value: normalizeText(detail.emirate) || EMPTY_VALUE,
        },
      ],
      statistics: fallback.profileOverview.statistics,
      alerts: fallback.profileOverview.alerts,
    },
    applicationOverview: fallback.applicationOverview,
    relatedViolation: normalizeAppealRelatedViolation(
      detail,
      status,
      fallback.relatedViolation,
    ),
  };
}

export function resolveAllowedFinalStatuses(record?: AppealRecord | null) {
  if (!record) return [] as const;

  const recommendation = normalizeRecommendationTypeId(
    record.departmentRecommendationTypeId,
  );
  if (recommendation === "Approve") {
    return ["Department Processing", "Pending Customer", "Approved"] as const;
  }
  if (recommendation === "Reject") {
    return ["Department Processing", "Pending Customer", "Rejected"] as const;
  }
  return ["Department Processing", "Pending Customer"] as const;
}

export function canChangeStatus(
  record?: AppealRecord | null,
  allowedStatuses: AppealStatus[] = ["Department Processed", "Pending Customer"],
) {
  if (!record) return false;
  if (!isStatusAllowed(record, allowedStatuses)) return false;
  return resolveAllowedFinalStatuses(record).length > 0;
}

export function canShowChangeStatusAction(
  record?: AppealRecord | null,
  allowedStatuses: AppealStatus[] = ["Department Processed", "Pending Customer"],
) {
  if (!record) return false;
  return isStatusAllowed(record, allowedStatuses);
}

export function mapRecommendationToTypeId(
  decision: "Approve" | "Reject",
  explicitId?: number,
) {
  if (explicitId) return explicitId;
  return decision === "Approve" ? 1 : 2;
}

export function mapDepartmentCode(departmentId?: string) {
  const raw = normalizeText(departmentId);
  if (!raw) return "";
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  if (compact.includes("content")) return "ContentDepartment";
  if (compact.includes("inspection")) return "InspectionDepartment";
  if (compact.includes("licens")) return "LicensingDepartment";
  return raw;
}
