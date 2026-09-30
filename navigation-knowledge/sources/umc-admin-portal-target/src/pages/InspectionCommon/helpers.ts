/* eslint-disable @typescript-eslint/no-explicit-any */
import i18next from "i18next";
import moment from "moment";
import type { InspectionTaskTimelineItem } from "@/services/inspection";
import { INSPECTION_QUERY_KEYS } from "./constants";

export type InspectionQueryState = {
  role: string;
  scope: string;
  tab: string;
  teamTab: string;
  teamTaskSource: string;
  view: string;
  taskId: string;
  taskNo: string;
  visitId: string;
  step: string;
  violationId: string;
  violationNo: string;
  type: string;
  status: string;
  from: string;
  reportNo: string;
  mode: string;
};

export const inspectionTaskStatusLabelMap: Record<string, string> = {
  DRAFT: "inspection.status.task.draft",
  PENDING_ASSIGNMENT: "inspection.status.task.queued",
  QUEUED: "inspection.status.task.queued",
  ASSIGNED: "inspection.status.task.pendingVisit",
  PENDING_VISIT: "inspection.status.task.pendingVisit",
  IN_PROGRESS: "inspection.status.task.inProgress",
  ACCESS_FAILED: "inspection.status.task.accessFailed",
  SUBMITTED: "inspection.status.task.completed",
  COMPLETED: "inspection.status.task.completed",
  CANCELLED: "inspection.status.task.cancelled",
};

export const inspectionPriorityLabelMap: Record<string, string> = {
  CRITICAL: "inspection.priority.critical",
  HIGH: "inspection.priority.high",
  MEDIUM: "inspection.priority.medium",
  LOW: "inspection.priority.low",
};

export const violationStatusLabelMap: Record<string, string> = {
  OPEN: "inspection.violation.status.open",
  PENDING_DECISION: "inspection.violation.status.pendingDecision",
  PENDING_ROUTING: "inspection.violation.status.pendingRouting",
  UNDER_REVIEW: "inspection.violation.status.pendingReview",
  PENDING_REVIEW: "inspection.violation.status.pendingReview",
  PENDING_CONTENT_REPORT: "inspection.violation.status.pendingContentReport",
  REPORT_SUBMITTED: "inspection.violation.status.reportSubmitted",
  PENDING_COMMITTEE_DECISION: "inspection.violation.status.pendingCommitteeDecision",
  PENDING_APPROVAL: "inspection.violation.status.pendingApproval",
  PENDING_PAYMENT: "inspection.violation.status.pendingPayment",
  QUEUED: "inspection.violation.status.queued",
  ON_HOLD_DURING_APPEAL: "inspection.violation.status.onHoldDuringAppeal",
  RECTIFICATION_REQUIRED: "inspection.violation.status.rectification",
  RECTIFICATION: "inspection.violation.status.rectification",
  WARNING_ISSUED: "inspection.violation.status.warningIssued",
  UNDER_APPEAL: "inspection.violation.status.underAppeal",
  RESOLVED: "inspection.violation.status.resolved",
  CLOSED: "inspection.violation.status.paid",
  PAID: "inspection.violation.status.paid",
  CANCELLED: "inspection.violation.status.cancelled",
};

export function getInspectionQuery(search: string): InspectionQueryState {
  const params = new URLSearchParams(search);
  return {
    role: params.get(INSPECTION_QUERY_KEYS.role) || "",
    scope: params.get(INSPECTION_QUERY_KEYS.scope) || "",
    tab: params.get(INSPECTION_QUERY_KEYS.tab) || "",
    teamTab: params.get(INSPECTION_QUERY_KEYS.teamTab) || "",
    teamTaskSource: params.get(INSPECTION_QUERY_KEYS.teamTaskSource) || "",
    view: params.get(INSPECTION_QUERY_KEYS.view) || "",
    taskId: params.get(INSPECTION_QUERY_KEYS.taskId) || "",
    taskNo: params.get(INSPECTION_QUERY_KEYS.taskNo) || "",
    visitId: params.get(INSPECTION_QUERY_KEYS.visitId) || "",
    step: params.get(INSPECTION_QUERY_KEYS.step) || "",
    violationId: params.get(INSPECTION_QUERY_KEYS.violationId) || "",
    violationNo: params.get(INSPECTION_QUERY_KEYS.violationNo) || "",
    type: params.get(INSPECTION_QUERY_KEYS.type) || "",
    status: params.get(INSPECTION_QUERY_KEYS.status) || "",
    from: params.get(INSPECTION_QUERY_KEYS.from) || "",
    reportNo: params.get(INSPECTION_QUERY_KEYS.reportNo) || "",
    mode: params.get(INSPECTION_QUERY_KEYS.mode) || "",
  };
}

export function getRoleFromSearch(search: string): string {
  return getInspectionQuery(search).role;
}

export function normalizeInspectionCode(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .toUpperCase();
}

const PRE_VISIT_CHECKLIST_STEP_ID = "10";
const STARTED_PRE_VISIT_STEP_CODES = new Set([
  "PRE_VISIT_CHECKLIST",
  "TARGET_ACCESS",
  "CHECKIN",
  "CHECK_IN",
  "CHECKLIST",
  "SEIZED_MATERIALS",
  "SEIZED_MATERIAL",
  "CONTACT_PERSON",
  "DECLARATION_ACKNOWLEDGEMENT",
  "DECLARATION_ACKNOWLEDGMENT",
  "REINSPECTION",
  "REVIEW",
  "REVIEW_CONFIRM",
  "REVIEW_AND_CONFIRM",
  "REVIEW_AND_SUBMIT",
  "SUBMIT_REPORT",
  "CHECKOUT",
  "CHECK_OUT",
  "ACCESS_FAILED",
]);

const asInspectionRecord = (value?: unknown): Record<string, any> => (
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}
);

const getInspectionRecordValue = (
  source: Record<string, any>,
  keys: string[],
) => {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const getInspectionExecutionValue = (
  task: unknown,
  keys: string[],
) => {
  const record = asInspectionRecord(task);
  const executionState = asInspectionRecord(record.executionState);
  const executionResult = asInspectionRecord(record.executionResult);
  return getInspectionRecordValue(record, keys)
    ?? getInspectionRecordValue(executionState, keys)
    ?? getInspectionRecordValue(executionResult, keys);
};

export function getInspectionExecutionStepCode(task?: unknown) {
  return getInspectionExecutionValue(task, [
    "currentStepCode",
    "CurrentStepCode",
    "currentStepKey",
    "CurrentStepKey",
    "currentStep",
    "CurrentStep",
    "stepCode",
    "StepCode",
    "step",
    "Step",
  ]);
}

export function getInspectionExecutionStepId(task?: unknown) {
  return getInspectionExecutionValue(task, [
    "currentStepId",
    "CurrentStepId",
    "stepId",
    "StepId",
  ]);
}

export function hasStartedPreVisitExecution(task?: unknown) {
  const stepCode = normalizeInspectionCode(String(getInspectionExecutionStepCode(task) ?? ""));
  if (STARTED_PRE_VISIT_STEP_CODES.has(stepCode)) return true;

  return String(getInspectionExecutionStepId(task) ?? "").trim() === PRE_VISIT_CHECKLIST_STEP_ID;
}

export function buildInspectionPath(pathname: string, search: string, patch: Record<string, string | number | null | undefined> = {}) {
  const params = new URLSearchParams(search);
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      params.delete(key);
      return;
    }
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function normalizeTaskStatus(status?: string | null) {
  const value = normalizeInspectionCode(status);
  if (value === "PENDING_ASSIGNMENT") return "QUEUED";
  if (value === "ASSIGNED") return "PENDING_VISIT";
  if (value === "SUBMITTED") return "COMPLETED";
  return value || "PENDING_VISIT";
}

export function normalizeViolationStatus(status?: string | null) {
  const value = normalizeInspectionCode(status);
  if (value === "UNDER_REVIEW") return "PENDING_REVIEW";
  if (value === "RECTIFICATION_REQUIRED") return "RECTIFICATION";
  if (value === "CLOSED") return "PAID";
  return value || "OPEN";
}

export function formatDate(value?: string | null, fallback = "-") {
  if (!value) return fallback;
  const date = moment(value);
  return date.isValid() ? date.format("DD/MM/YYYY") : fallback;
}

export function formatDateTime(value?: string | null, fallback = "-") {
  if (!value) return fallback;
  const date = moment(value);
  return date.isValid() ? date.format("DD/MM/YYYY HH:mm:ss") : fallback;
}

export function formatNumber(value?: number | string | null, fallback = "0") {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = Number(value);
  if (Number.isNaN(normalized)) return fallback;
  return new Intl.NumberFormat("en-US").format(normalized);
}

export function formatCurrency(value?: number | null, currency = "AED") {
  if (value === undefined || value === null) return "-";
  return `${currency} ${formatNumber(value)}`;
}

export function getCurrentLanguage() {
  return i18next.resolvedLanguage === "ar" ? "ar" : "en";
}

export function getLocalizedText(en?: string | null, ar?: string | null, fallback = "-") {
  const isArabic = getCurrentLanguage() === "ar";
  const text = isArabic ? ar || en : en || ar;
  return text || fallback;
}

const getAddressDisplayPart = (value?: unknown) => String(value || "").trim();

const normalizeAddressDisplayPart = (value?: unknown) => (
  getAddressDisplayPart(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
);

const splitAddressDisplayPart = (value?: unknown) => (
  getAddressDisplayPart(value)
    .toLowerCase()
    .split(/[\s,]+/u)
    .filter(Boolean)
);

const isAddressPartContained = (source?: unknown, part?: unknown) => {
  const sourceKey = normalizeAddressDisplayPart(source);
  const partKey = normalizeAddressDisplayPart(part);
  if (!sourceKey || !partKey) return false;
  if (sourceKey === partKey) return true;

  const sourceWords = splitAddressDisplayPart(source);
  const partWords = splitAddressDisplayPart(part);
  if (!sourceWords.length || !partWords.length || partWords.length > sourceWords.length) return false;

  return sourceWords.some((_, index) => (
    partWords.every((word, offset) => sourceWords[index + offset] === word)
  ));
};

const getUniqueAddressParts = (parts: string[]) => {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = normalizeAddressDisplayPart(part) || part;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function getTaskTargetName(task?: any) {
  const target = task?.inspectionTarget;
  return getLocalizedText(
    target?.establishmentNameEn || target?.fullNameEn || target?.fullName,
    target?.establishmentNameAr || target?.fullNameAr,
    target?.licenseNumber || "-",
  );
}

export function getTaskTargetTypeName(task?: any) {
  const target = task?.inspectionTarget;
  if (!target) return "-";
  return getLocalizedText(
    target.targetTypeNameEn || target.targetTypeName || (target.targetType === 2 ? i18next.t("inspection.target.individual") : i18next.t("inspection.target.establishment")),
    target.targetTypeNameAr,
  );
}

export function getTaskLicenseNumber(task?: any) {
  return task?.inspectionTarget?.licenseNumber || "-";
}

export function getTaskEmirateName(task?: any) {
  return getLocalizedText(
    task?.inspectionTarget?.address?.emirateNameEn,
    task?.inspectionTarget?.address?.emirateNameAr,
  );
}

export function getTaskAddress(task?: any) {
  const address = task?.inspectionTarget?.address;
  if (!address) return "-";
  const street = getAddressDisplayPart(address.street);
  const community = getAddressDisplayPart(getLocalizedText(address.communityNameEn, address.communityNameAr, ""));
  const emirate = getAddressDisplayPart(getLocalizedText(address.emirateNameEn, address.emirateNameAr, ""));
  const parts = [
    street,
    community && !isAddressPartContained(street, community) ? community : "",
    emirate,
  ];

  return getUniqueAddressParts(parts.filter(Boolean)).join(", ") || "-";
}

export function getPriorityClassName(priority?: string | null) {
  const value = String(priority || "MEDIUM").toUpperCase();
  return `priority-${value.toLowerCase()}`;
}

export function getStatusClassName(status?: string | null) {
  return `status-${normalizeTaskStatus(status).toLowerCase()}`;
}

export function getViolationStatusClassName(status?: string | null) {
  return `status-${normalizeViolationStatus(status).toLowerCase()}`;
}

export function getTaskStatusLabel(status?: string | null) {
  const key = inspectionTaskStatusLabelMap[normalizeTaskStatus(status)];
  return key ? i18next.t(key) : String(status || "-");
}

export function getPriorityLabel(priority?: string | null) {
  const value = String(priority || "").toUpperCase();
  const key = inspectionPriorityLabelMap[value];
  return key ? i18next.t(key) : String(priority || "-");
}

export function getViolationStatusLabel(status?: string | null) {
  const key = violationStatusLabelMap[normalizeViolationStatus(status)];
  return key ? i18next.t(key) : String(status || "-");
}

export function getRiskLevelLabel(value?: string | null) {
  const normalized = String(value || "LOW").toLowerCase();
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

export function getRiskLevelClassName(value?: string | null) {
  return String(value || "LOW").toLowerCase();
}

/**
 * Localizes the fixed English creator sentinels the task APIs return
 * ("AI-generated", "Auto Generated", ...). Real user names pass through unchanged.
 */
export function getInspectionCreatorLabel(creatorName?: string | null) {
  const raw = String(creatorName ?? "").trim();
  if (!raw) return "";

  const normalized = raw.replace(/[\s_-]+/g, "").toLowerCase();
  if (normalized === "aigenerated") return i18next.t("inspection.tasks.creators.aiGenerated");
  if (normalized === "autogenerated") return i18next.t("inspection.tasks.creators.autoGenerated");
  if (normalized === "batchgenerated") return i18next.t("inspection.tasks.creators.batchGenerated");
  if (normalized === "manual") return i18next.t("inspection.tasks.creators.manual");

  return raw;
}

export function getAssigneeName(task?: any) {
  const assignment = task?.assignment;
  if (!assignment) return "-";
  if (Array.isArray(assignment.assignedInspectors)) {
    const names = assignment.assignedInspectors.map((item: any) => item.inspectorName || item.inspectorId || item).filter(Boolean);
    return names.length ? names.join(", ") : "-";
  }
  return assignment.assignedInspector || assignment.assignedInspectors || "-";
}

export function joinReasonNames(reasons?: any[]) {
  if (!Array.isArray(reasons) || reasons.length === 0) return "-";
  return reasons.map((item) => getLocalizedText(
    item?.violationNameEn || item?.violationName || item?.titleEn || item?.title || item?.descriptionEn,
    item?.violationNameAr || item?.titleAr || item?.descriptionAr,
    "",
  )).filter(Boolean).join(", ");
}

const getTimelineTime = (item: InspectionTaskTimelineItem) => (
  item.createdOn || item.time || ""
);

const sortTimelineDesc = (items: InspectionTaskTimelineItem[]) => (
  items.slice().sort((currentItem, nextItem) => {
    const currentTime = Date.parse(getTimelineTime(currentItem));
    const nextTime = Date.parse(getTimelineTime(nextItem));
    return (Number.isNaN(nextTime) ? 0 : nextTime) - (Number.isNaN(currentTime) ? 0 : currentTime);
  })
);

export function buildTaskTimeline(task?: any): InspectionTaskTimelineItem[] {
  if (!Array.isArray(task?.timeline) || !task.timeline.length) {
    return [];
  }

  return sortTimelineDesc(task.timeline.map((item: any, index: number) => {
    const rawEventType = item.eventType || item.eventCode || item.type || "";

    return {
      id: item.id ?? `${rawEventType || "timeline"}-${index}`,
      eventType: rawEventType,
      eventCode: item.eventCode,
      title: item.title,
      titleEn: item.titleEn,
      titleAr: item.titleAr,
      label: item.label,
      descriptionEn: item.descriptionEn,
      descriptionAr: item.descriptionAr,
      fromStatusId: item.fromStatusId,
      toStatusId: item.toStatusId,
      operatorRoleId: item.operatorRoleId,
      operatorName: item.operatorName,
      actor: item.actor,
      actualActorName: item.actualActorName,
      pendingHandlerName: item.pendingHandlerName,
      currentOwnerTypeCode: item.currentOwnerTypeCode,
      currentOwnerSummary: item.currentOwnerSummary,
      displayActorSource: item.displayActorSource,
      createdOn: item.createdOn,
      time: item.time,
      displayTitle: item.displayTitle,
      displayActor: item.displayActor,
      displayTime: item.displayTime,
      displayDetails: item.displayDetails,
      displayLocation: item.displayLocation,
      displayStatusCode: item.displayStatusCode,
      isCurrentStatusEvent: item.isCurrentStatusEvent,
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
      result: item.result || item.resultCode,
      resultCode: item.resultCode,
      resultTone: item.resultTone,
      durationLabel: item.durationLabel,
      metadata: item.metadata || {},
    };
  }));
}
