import type {
  InspectionViolationTimelineItem,
  ViolationDetailData,
} from "@/services/inspection";

type ViolationTimelineDetail = Pick<
  ViolationDetailData,
  "createdOn" | "timeline" | "violationTimeline"
> & {
  reportedByUserId?: string | null;
};

const CUSTOMER_PORTAL_FINAL_SUBMIT_USER_ID = "customer-portal-final-submit";
const VIOLATION_CREATED_EVENT_TYPE = "ViolationCreated";
const VIOLATION_CREATED_TITLE = "Violation Created";
const VIOLATION_CREATED_ACTOR = "Automated";

const CUSTOMER_PORTAL_FINAL_SUBMIT_TIMELINE_EVENT_TYPES = new Set([
  "FINE_PAID",
  "PENDING_PAYMENT",
  "VIOLATION_CREATED",
]);

const ensureTimelineArray = (
  value?: InspectionViolationTimelineItem[] | null,
): InspectionViolationTimelineItem[] => (
  Array.isArray(value) ? value : []
);

export const normalizeTimelineCode = (value?: unknown) => (
  String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .toUpperCase()
);

export const getTimelineEventTime = (item: InspectionViolationTimelineItem) => (
  item.displayTime || item.createdOn || ""
);

export const isWarningIssuedTimelineEvent = (item: InspectionViolationTimelineItem) => (
  normalizeTimelineCode(item.eventType || item.rawEventType) === "WARNING_ISSUED"
);

export const isViolationCreatedTimelineEvent = (item: InspectionViolationTimelineItem) => {
  return normalizeTimelineCode(item.eventType) === "VIOLATION_CREATED";
};

export const getTimelineRelatedInspectionTaskNo = (
  item: InspectionViolationTimelineItem,
  value?: unknown,
) => {
  const text = String(value ?? "").trim();
  if (!isViolationCreatedTimelineEvent(item)) return "";

  const taskNoMatch = text.match(/\b(?:IN|IT)-\d{4}-\d+\b/i);
  if (taskNoMatch?.[0]) return taskNoMatch[0].toUpperCase();

  return "";
};

export const shouldRenderTimelineRelatedInspectionRow = (
  item: InspectionViolationTimelineItem,
  value?: unknown,
) => Boolean(getTimelineRelatedInspectionTaskNo(item, value));

const isCustomerPortalFinalSubmitViolation = (
  detail: ViolationTimelineDetail | null,
) => (
  String(detail?.reportedByUserId || "").trim() === CUSTOMER_PORTAL_FINAL_SUBMIT_USER_ID
);

const isCustomerPortalFinalSubmitTimelineEvent = (
  item: InspectionViolationTimelineItem,
) => (
  CUSTOMER_PORTAL_FINAL_SUBMIT_TIMELINE_EVENT_TYPES.has(
    normalizeTimelineCode(item.eventType),
  )
);

const buildViolationCreatedTimelineItem = (
  detail: ViolationTimelineDetail,
): InspectionViolationTimelineItem | null => {
  if (!detail.createdOn) return null;

  return {
    key: "violation-created",
    eventType: VIOLATION_CREATED_EVENT_TYPE,
    label: VIOLATION_CREATED_TITLE,
    displayTitle: VIOLATION_CREATED_TITLE,
    displayActor: VIOLATION_CREATED_ACTOR,
    displayTime: detail.createdOn,
    createdOn: detail.createdOn,
    actor: VIOLATION_CREATED_ACTOR,
    actorType: "system",
    isCurrentStatusEvent: false,
  };
};

export const buildViolationTimeline = (
  detail: ViolationTimelineDetail | null,
): InspectionViolationTimelineItem[] => {
  const timeline = detail?.violationTimeline?.length
    ? ensureTimelineArray(detail.violationTimeline)
    : ensureTimelineArray(detail?.timeline);
  const isCustomerPortalFinalSubmit = isCustomerPortalFinalSubmitViolation(detail);
  const items = isCustomerPortalFinalSubmit
    ? timeline.filter(isCustomerPortalFinalSubmitTimelineEvent)
    : timeline.slice();
  const hasViolationCreatedEvent = items.some(isViolationCreatedTimelineEvent);

  if (isCustomerPortalFinalSubmit && !hasViolationCreatedEvent && detail) {
    const createdEvent = buildViolationCreatedTimelineItem(detail);
    if (createdEvent) items.push(createdEvent);
  }

  return items.sort((currentItem, nextItem) => {
    const currentTime = Date.parse(getTimelineEventTime(currentItem));
    const nextTime = Date.parse(getTimelineEventTime(nextItem));
    return (Number.isNaN(nextTime) ? 0 : nextTime) - (Number.isNaN(currentTime) ? 0 : currentTime);
  });
};
