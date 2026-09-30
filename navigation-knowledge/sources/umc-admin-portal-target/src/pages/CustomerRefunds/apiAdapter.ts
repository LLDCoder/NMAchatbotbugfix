import type {
  AdminRefundDetailDto,
  AdminRefundDepartmentDto,
  AdminRefundDepartmentUserDto,
  AdminRefundStatisticsData,
  AdminRefundStatisticsResponseDto,
  AdminRefundStatusObjDto,
  AdminRefundTicketListItemDto,
  AdminRefundTimelineItemDto,
  RefundStatusItemDto,
} from "@/services/refunds";
import i18next from "i18next";
import type {
  RefundAttachment,
  RefundComment,
  RefundDepartmentProcessDecision,
  RefundHandler,
  RefundRecord,
  RefundStatus,
  RefundStatusChangePayload,
  RefundSummaryItem,
  RefundTimelineItem,
  RefundViewRole,
} from "./types";
import { REFUND_ROLE_CONFIG } from "./roleConfig";
import {
  buildRefundAttachmentAccessUrl,
  normalizeRefundAttachmentFilePath,
} from "./utils";
import { resolveAdminRefundListDisplayFields } from "./listLocalization";
import { formatPaymentCardInformation } from "@/utils/payment";

const EMPTY_RELATED_PAYMENT: RefundRecord["relatedPayment"] = {
  transactionNo: "",
  status: "",
  transactionType: "",
  lastUpdatedAt: "",
  paymentMethod: "",
  cardInformation: "",
  amountCharged: 0,
  description: "",
};

type AdminRefundSummaryCountKey =
  | "departmentProcessingCount"
  | "departmentProcessedCount"
  | "pendingCustomerCount"
  | "pendingRefundCount"
  | "rejectedCount"
  | "refundedCount"
  | "cancelledCount";

const SUMMARY_COUNT_KEYS: Record<
  Exclude<RefundSummaryItem["key"], "total">,
  AdminRefundSummaryCountKey
> = {
  departmentProcessing: "departmentProcessingCount",
  departmentProcessed: "departmentProcessedCount",
  pendingCustomer: "pendingCustomerCount",
  pendingRefund: "pendingRefundCount",
  rejected: "rejectedCount",
  refunded: "refundedCount",
  cancelled: "cancelledCount",
};

const SOURCE_PLACEHOLDER = "-";
const EMPTY_VALUE = "-";
const SYSTEM_COMMENT_TYPE_IDS = new Set([2, 3]);
const APPROVED_DECISION_TYPE_ID = 1;
const REJECTED_DECISION_TYPE_ID = 2;
const TIMELINE_EVENT_CODES = [
  "application_submitted",
  "auto_assignment",
  "department_processing_auto",
  "department_processing_manual",
  "department_processed",
  "pending_customer",
  "pending_refund",
  "rejected",
  "refunded",
  "cancelled",
] as const;

type RefundTimelineEventCode = (typeof TIMELINE_EVENT_CODES)[number];

const TIMELINE_EVENT_CODE_SET = new Set<string>(TIMELINE_EVENT_CODES);

function safeNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeText(value?: string | null, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeDisplayValue(value?: string | null, fallback = EMPTY_VALUE) {
  const text = normalizeText(value);
  return text || fallback;
}

function isArabicLanguage(language?: string | null) {
  const resolvedLanguage =
    language || i18next.resolvedLanguage || i18next.language;
  return resolvedLanguage?.toLowerCase().startsWith("ar") ?? false;
}

function resolveLocalizedName(
  value?: Pick<AdminRefundStatusObjDto, "nameEn" | "nameAr"> | null,
  fallback = "",
  language?: string | null,
) {
  const nameEn = normalizeText(value?.nameEn);
  const nameAr = normalizeText(value?.nameAr);
  const fallbackText = normalizeText(fallback);

  if (isArabicLanguage(language)) {
    return nameAr || nameEn || fallbackText;
  }

  return nameEn || nameAr || fallbackText;
}

function normalizeId(value?: string | number | null) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function maskPaymentDescription(
  description?: string | null,
  cardInfo?: string | null,
) {
  const text = normalizeText(description);
  const rawCardInfo = normalizeText(cardInfo);

  if (!text || !rawCardInfo) return text;

  return text
    .split(rawCardInfo)
    .join(formatPaymentCardInformation(rawCardInfo));
}

function normalizeTimelineEventCode(
  value?: string | null,
): RefundTimelineEventCode | "" {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (!normalized || !TIMELINE_EVENT_CODE_SET.has(normalized)) {
    return "";
  }

  return normalized as RefundTimelineEventCode;
}

function normalizeRefundDepartmentDisplayLabel(
  value?: string | null,
  fallback = EMPTY_VALUE,
) {
  const primaryText = normalizeText(value);
  const fallbackText = normalizeText(fallback);
  const hasLocalizedFallback = fallbackText && fallbackText !== EMPTY_VALUE;
  const text =
    isArabicLanguage() && hasLocalizedFallback
      ? fallbackText || primaryText
      : primaryText || fallbackText;
  return text || fallback;
}

function resolveTimelineEventCode(
  item?: AdminRefundTimelineItemDto | null,
): RefundTimelineEventCode | "" {
  const explicitEventCode = normalizeTimelineEventCode(item?.eventCode);
  if (explicitEventCode) return explicitEventCode;

  const statusName = normalizeText(item?.changeStatusObj?.nameEn).toLowerCase();

  if (item?.toStatusId === -1 || statusName === "application submitted") {
    return "application_submitted";
  }
  if (item?.toStatusId === 0 || statusName === "auto assignment") {
    return "auto_assignment";
  }
  if (item?.toStatusId === 1 || statusName === "department processing") {
    return "department_processing_manual";
  }
  if (item?.toStatusId === 2 || statusName === "department processed") {
    return "department_processed";
  }
  if (item?.toStatusId === 3 || statusName === "pending customer") {
    return "pending_customer";
  }
  if (item?.toStatusId === 4 || statusName === "pending refund") {
    return "pending_refund";
  }
  if (item?.toStatusId === 5 || statusName === "rejected") {
    return "rejected";
  }
  if (item?.toStatusId === 6 || statusName === "refunded") {
    return "refunded";
  }
  if (item?.toStatusId === 7 || statusName === "cancelled") {
    return "cancelled";
  }

  return "";
}

function buildTimelineItemId(
  item: AdminRefundTimelineItemDto,
  eventCode: RefundTimelineEventCode | "",
  index: number,
) {
  return [
    normalizeText(String(item.refundId ?? "timeline")),
    eventCode || "unknown",
    normalizeText(String(item.toStatusId ?? "status")),
    normalizeText(item.changeOnTime || "time"),
    String(index),
  ]
    .filter(Boolean)
    .join("-")
    .replace(/\s+/g, "_");
}

function resolveTimelineHandlerName(
  item: AdminRefundTimelineItemDto | null | undefined,
  eventCode: RefundTimelineEventCode | "",
) {
  const createdUserName = normalizeText(item?.createdUerName);
  const handledUserName = normalizeText(item?.handlUserName);

  if (eventCode === "application_submitted") {
    return createdUserName;
  }

  return handledUserName;
}

function buildTimelineActorLabel(
  item: AdminRefundTimelineItemDto | null | undefined,
  eventCode: RefundTimelineEventCode | "",
) {
  const handlerName = resolveTimelineHandlerName(item, eventCode);
  if (!handlerName) return "";

  if (eventCode === "application_submitted") {
    return i18next.t("Customer.customerRefundsDetails.dynamic.submittedBy", {
      handlerName,
    });
  }

  return i18next.t("Customer.customerRefundsDetails.dynamic.currentHandlerBy", {
    handlerName,
  });
}

function resolveTimelineDepartmentLabel(
  item: AdminRefundTimelineItemDto | null | undefined,
) {
  return normalizeText(item?.departmentName);
}

function resolveTimelineActionText(
  item: AdminRefundTimelineItemDto | null | undefined,
) {
  return normalizeText(item?.handleDes);
}

function resolveTimelineNote(
  item: AdminRefundTimelineItemDto | null | undefined,
  actionText: string,
  decisionNote: string,
) {
  const content = normalizeText(item?.content);

  if (content && content !== actionText) {
    return content;
  }

  if (decisionNote && decisionNote !== actionText) {
    return decisionNote;
  }

  return undefined;
}

function resolveTimelineDescription(
  item: AdminRefundTimelineItemDto | null | undefined,
  eventCode: RefundTimelineEventCode | "",
  actionText: string,
  decisionNote: string,
) {
  if (eventCode) return "";

  const candidates = [normalizeText(item?.content), normalizeText(item?.handleDes)];

  for (const candidate of candidates) {
    if (
      candidate &&
      candidate !== actionText &&
      candidate !== decisionNote &&
      candidate !== normalizeText(item?.handlUserName)
    ) {
      return candidate;
    }
  }

  return "";
}

export function normalizeRefundDepartmentLabel(
  value?: string | null,
  fallback = EMPTY_VALUE,
) {
  return normalizeRefundDepartmentDisplayLabel(value, fallback);
}

function resolveDecisionLabelByTypeId(decisionTypeId?: number | null) {
  if (decisionTypeId === APPROVED_DECISION_TYPE_ID) return "Approve";
  if (decisionTypeId === REJECTED_DECISION_TYPE_ID) return "Reject";
  return "";
}

function normalizeRefundDepartmentRecommendation(
  record?: RefundRecord | null,
) {
  const byTypeId = resolveDecisionLabelByTypeId(
    record?.departmentRecommendationTypeId,
  );
  if (byTypeId === "Approve" || byTypeId === "Reject") return byTypeId;

  return "";
}

function resolveRefundDepartmentRecommendationFromDecision(
  departmentDecision?: number | null,
) {
  const recommendation = resolveDecisionLabelByTypeId(departmentDecision);

  if (recommendation === "Approve" || recommendation === "Reject") {
    return {
      departmentRecommendation: recommendation,
      departmentRecommendationTypeId:
        typeof departmentDecision === "number" ? departmentDecision : undefined,
    };
  }

  return {
    departmentRecommendation: undefined,
    departmentRecommendationTypeId: undefined,
  };
}

function isRefundStatusAllowed(
  record: RefundRecord,
  allowedStatuses: RefundStatus[],
) {
  const normalizedStatus = normalizeText(record.status).toLowerCase();
  return allowedStatuses.some(
    (item) => normalizeText(item).toLowerCase() === normalizedStatus,
  );
}

export function mapEnumOptionsToNames(options?: RefundStatusItemDto[] | null) {
  const seen = new Set<string>();
  return (Array.isArray(options) ? options : [])
    .map((item) => normalizeText(resolveLocalizedName(item)))
    .filter((item) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function mapAdminDepartmentsToHandlers(
  items?: AdminRefundDepartmentDto[] | null,
): RefundHandler[] {
  const seen = new Set<string>();

  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const departmentName = normalizeRefundDepartmentLabel(
        item?.nameEn,
        normalizeText(item?.nameAr) || "",
      );

      if (!departmentName) {
        return null;
      }

      const handler: RefundHandler = {
        id: normalizeId(item?.id) || departmentName,
        name: departmentName,
        department: departmentName,
        departmentId: normalizeId(item?.id) || undefined,
      };

      return handler;
    })
    .filter((item): item is RefundHandler => {
      if (!item) return false;
      const key = item.department.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function mapAdminDepartmentUsersToHandlers(
  items?: AdminRefundDepartmentUserDto[] | null,
): RefundHandler[] {
  return (Array.isArray(items) ? items : []).map((item) => {
    const userId = normalizeId(item?.userId);
    const departmentId = normalizeId(item?.departmentId);

    return {
      id: [userId || normalizeText(item?.userName), departmentId]
        .filter(Boolean)
        .join(":"),
      name: normalizeDisplayValue(item?.userName),
      department: normalizeRefundDepartmentLabel(
        item?.departmentNameEn,
        normalizeText(item?.departmentNameAr) || "",
      ),
      departmentId: departmentId || undefined,
    };
  });
}

export function resolveRefundViewRole(
  response: AdminRefundStatisticsResponseDto | AdminRefundStatisticsData | null | undefined,
): RefundViewRole {
  const payload =
    (response as AdminRefundStatisticsResponseDto | undefined)?.data &&
    typeof (response as AdminRefundStatisticsResponseDto).data === "object"
      ? (response as AdminRefundStatisticsResponseDto).data
      : (response as AdminRefundStatisticsData | undefined);

  return payload?.isHappinessCenter ? "customer_happiness" : "business_department";
}

export function mapRefundSummaryItems(
  role: RefundViewRole,
  response: AdminRefundStatisticsResponseDto | AdminRefundStatisticsData | null | undefined,
): RefundSummaryItem[] {
  const payload =
    (response as AdminRefundStatisticsResponseDto | undefined)?.data &&
    typeof (response as AdminRefundStatisticsResponseDto).data === "object"
      ? (response as AdminRefundStatisticsResponseDto).data
      : (response as AdminRefundStatisticsData | undefined);

  const summaryMeta: Record<
    RefundSummaryItem["key"],
    { label: string; iconKey: RefundSummaryItem["iconKey"] }
  > = {
    total: {
      label: i18next.t("Customer.customerRefunds.summary.total"),
      iconKey: "total",
    },
    departmentProcessing: {
      label: i18next.t("Customer.customerRefunds.summary.departmentProcessing"),
      iconKey: "departmentProcessing",
    },
    departmentProcessed: {
      label: i18next.t("Customer.customerRefunds.summary.departmentProcessed"),
      iconKey: "departmentProcessed",
    },
    pendingCustomer: {
      label: i18next.t("Customer.customerRefunds.summary.pendingCustomer"),
      iconKey: "pendingCustomer",
    },
    pendingRefund: {
      label: i18next.t("Customer.customerRefunds.summary.pendingRefund"),
      iconKey: "pendingRefund",
    },
    refunded: {
      label: i18next.t("Customer.customerRefunds.summary.refunded"),
      iconKey: "refunded",
    },
    rejected: {
      label: i18next.t("Customer.customerRefunds.summary.rejected"),
      iconKey: "rejected",
    },
    cancelled: {
      label: i18next.t("Customer.customerRefunds.summary.cancelled"),
      iconKey: "cancelled",
    },
  };

  const roleConfig = REFUND_ROLE_CONFIG[role];
  return roleConfig.list.summaryKeys.map((key) => {
    if (key === "total") {
      return {
        key,
        label: summaryMeta[key].label,
        iconKey: summaryMeta[key].iconKey,
        count: safeNumber(payload?.total),
      };
    }

    const countKey = SUMMARY_COUNT_KEYS[key];
    return {
      key,
      label: summaryMeta[key].label,
      iconKey: summaryMeta[key].iconKey,
      count: safeNumber(payload?.[countKey]),
    };
  });
}

export function parseRefundSlaToHours(value?: string | null) {
  const text = normalizeText(value);
  if (!text) return undefined;

  if (/on time/i.test(text)) return 1;
  if (/exceeded/i.test(text)) return -1;

  const match = text.match(/(-?\d+(?:\.\d+)?)\s*(d|day|days|h|hour|hours|min|mins|minute|minutes)/i);
  if (!match) return undefined;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;

  const unit = match[2].toLowerCase();
  const baseHours =
    unit.startsWith("d")
      ? amount * 24
      : unit.startsWith("h")
        ? amount
        : amount / 60;

  return /overdue|exceeded/i.test(text) ? -Math.abs(baseHours) : Math.abs(baseHours);
}

function mapPlatformToOriginChannel(value?: string | null) {
  const text = normalizeText(value);
  const normalized = text.toLowerCase();
  if (!normalized) return EMPTY_VALUE;

  if (normalized === "web" || normalized === "from web") {
    return i18next.t("Customer.customerRefundsDetails.dynamic.fromWeb");
  }

  if (normalized === "mobile" || normalized === "from mobile") {
    return i18next.t("Customer.customerRefundsDetails.dynamic.fromMobile");
  }

  if (normalized === "tablet" || normalized === "from tablet") {
    return i18next.t("Customer.customerRefundsDetails.dynamic.fromTablet");
  }

  return text;
}

function resolveTimelineResponseDeadline(item?: AdminRefundTimelineItemDto | null) {
  return (
    normalizeText(item?.responseDeadline) ||
    normalizeText(item?.deadLine) ||
    normalizeText(item?.departmentDeadLine)
  );
}

export function buildEmptyRefundRecord(refundNo = "-"): RefundRecord {
  return {
    refundNo,
    applicationNumber: "",
    referenceNo: "",
    category: "",
    source: SOURCE_PLACEHOLDER,
    originChannel: EMPTY_VALUE,
    applyFor: {
      id: "",
      name: EMPTY_VALUE,
      type: undefined,
    },
    amount: 0,
    currency: "AED",
    status: EMPTY_VALUE,
    currentHandler: {
      id: "",
      name: EMPTY_VALUE,
      department: "",
    },
    lastUpdatedAt: "",
    assignedAt: "",
    refundReason: "",
    attachments: [],
    communicationRecords: [],
    timeline: [],
    relatedPayment: { ...EMPTY_RELATED_PAYMENT },
    applicantOverview: {
      fullName: "-",
      email: "-",
      mobileNumber: "-",
    },
    profileOverview: {
      profileType: "-",
      statusLabel: "-",
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

export function mapAdminRefundListItemToRecord(
  item: AdminRefundTicketListItemDto,
  language?: string | null,
): RefundRecord {
  const refundNo =
    normalizeText(item.applicationNo) ||
    String(item.refundId ?? "-");
  const localizedFields = resolveAdminRefundListDisplayFields(item, language);
  const slaText = localizedFields.sla;
  const currentHandlerName = normalizeDisplayValue(item.currentHandler);
  const currentHandlerDepartment = normalizeRefundDepartmentLabel(
    item.roleTypeObj?.nameEn,
    normalizeText(item.roleTypeObj?.nameAr) || "",
  );
  const statusText =
    normalizeText(item.statusObj?.nameEn) || normalizeDisplayValue(item.status);
  const statusDisplayText = normalizeDisplayValue(
    resolveLocalizedName(item.statusObj, statusText, language),
    statusText,
  );
  const sourceText = normalizeDisplayValue(item.sourceType, SOURCE_PLACEHOLDER);
  const departmentId = normalizeId(item.departmentId);

  return {
    ...buildEmptyRefundRecord(refundNo),
    refundId: item.refundId,
    userId: undefined,
    profileId: undefined,
    refundNo,
    applicationNumber: normalizeText(item.applicationNo),
    referenceNo: normalizeDisplayValue(item.referenceNo),
    category: localizedFields.category,
    categoryDisplay: localizedFields.categoryDisplay,
    source: sourceText,
    originChannel: EMPTY_VALUE,
    applyFor: {
      id: String(item.applyFor?.userTypeId ?? ""),
      name: localizedFields.applyForName,
      type: undefined,
    },
    amount: safeNumber(item.amount),
    status: statusText,
    statusDisplay: statusDisplayText,
    statusId:
      typeof item.statusObj?.id === "number" ? item.statusObj.id : undefined,
    currentHandler: {
      id: currentHandlerName,
      name: currentHandlerName,
      department: currentHandlerDepartment,
      departmentId: departmentId || undefined,
    },
    lastUpdatedAt: normalizeText(item.updateOn),
    assignedAt: normalizeText(item.createdOn || item.updateOn),
    slaHours: parseRefundSlaToHours(slaText),
    rawSla: localizedFields.slaDisplay,
  };
}

function toAttachment(url: string, index: number): RefundAttachment {
  const cleanUrl = normalizeText(url);
  const filePath = normalizeRefundAttachmentFilePath(cleanUrl);
  const filename =
    filePath.split("/").pop() ||
    i18next.t("Customer.customerRefundsDetails.attachmentList.attachmentLabel", {
      index: index + 1,
    });
  const extension = filename
    .split(".")
    .pop()
    ?.toLowerCase();
  const type: RefundAttachment["type"] =
    extension === "jpeg" || extension === "jpg" || extension === "png" || extension === "pdf"
      ? extension
      : "pdf";

  return {
    id: `${filename}-${index}`,
    name: filename,
    type,
    filePath,
    url: buildRefundAttachmentAccessUrl(filePath),
  };
}

export function mapAdminCommentDetails(
  commentDetails: AdminRefundDetailDto["commentDetails"],
): RefundComment[] {
  const list = Array.isArray(commentDetails) ? commentDetails : [];
  return list.map((item, index) => {
    const recommendation = resolveDecisionLabelByTypeId(item?.decisionTypeId);
    const senderDepartment =
      resolveLocalizedName(item?.detpartInfoObj) ||
      resolveLocalizedName(item?.roleTypeObj);
    const senderLabel = resolveLocalizedName(item?.roleTypeObj);
    const isSystemComment = SYSTEM_COMMENT_TYPE_IDS.has(
      Number(item?.commentTypeId),
    );

    return {
      id: String(item?.commentId ?? `comment-${index}`),
      kind: isSystemComment ? "system" : "message",
      audience: item?.isInternal ? "internal" : "customer",
      senderUserId: normalizeText(item?.userId),
      senderName: normalizeText(item?.userName),
      senderPhotoUrl: normalizeText(item?.photoUrl),
      senderLabel,
      senderDepartment,
      sentAt: normalizeText(item?.createdOn),
      content: normalizeText(item?.messageContent),
      notes: normalizeText(item?.note) || undefined,
      responseDeadline: normalizeText(item?.deadLine),
      recommendation:
        recommendation === "Approve" || recommendation === "Reject"
          ? recommendation
          : undefined,
      attachments: Array.isArray(item?.attachments)
        ? item.attachments
            .map((attachmentUrl, attachmentIndex) =>
              normalizeText(attachmentUrl)
                ? toAttachment(String(attachmentUrl), attachmentIndex)
                : null,
            )
            .filter(Boolean) as RefundAttachment[]
        : [],
    };
  });
}

export function mapAdminTimeline(
  items: AdminRefundTimelineItemDto[] | null | undefined,
): RefundTimelineItem[] {
  const list = Array.isArray(items) ? items : [];

  return list.map((item, index) => {
    const eventCode = resolveTimelineEventCode(item);
    const recommendation = resolveDecisionLabelByTypeId(
      item.refundDeptDecisionInfo?.decisionTypeId,
    );
    const decisionNote = normalizeText(item.refundDeptDecisionInfo?.content);
    const decisionAttachments = Array.isArray(item.refundDeptDecisionInfo?.attachments)
      ? item.refundDeptDecisionInfo?.attachments
          ?.map((attachment, attachmentIndex) =>
            normalizeText(attachment)
              ? toAttachment(String(attachment), attachmentIndex)
              : null,
            )
            .filter(Boolean)
      : [];
    const departmentLabel = resolveTimelineDepartmentLabel(item);
    const actionText = resolveTimelineActionText(item);
    const note = resolveTimelineNote(
      item,
      actionText,
      decisionNote,
    );

    return {
      id: buildTimelineItemId(item, eventCode, index),
      eventCode,
      title: normalizeText(
        resolveLocalizedName(item.changeStatusObj),
        EMPTY_VALUE,
      ),
      changedAt: normalizeText(item.changeOnTime),
      responseDeadline: resolveTimelineResponseDeadline(item),
      dotTone: index === 0 ? "active" : "inactive",
      actorLabel: buildTimelineActorLabel(
        item,
        eventCode,
      ),
      departmentLabel,
      actionSegments: actionText ? [{ text: actionText }] : undefined,
      description: resolveTimelineDescription(
        item,
        eventCode,
        actionText,
        decisionNote,
      ),
      recommendationSegments: recommendation
        ? [
            {
              text: i18next.t(
                "Customer.customerRefundsDetails.dynamic.departmentRecommendationPrefix",
              ),
            },
            {
              text:
                recommendation === "Approve"
                  ? i18next.t("Customer.customerRefunds.departmentModal.approve")
                  : recommendation === "Reject"
                    ? i18next.t("Customer.customerRefunds.departmentModal.reject")
                    : recommendation,
              tone: recommendation === "Approve" ? "success" : "danger",
            },
          ]
        : undefined,
      note,
      attachments: (decisionAttachments as RefundAttachment[]) || [],
      attachmentsCount: decisionAttachments.length,
    };
  });
}

export function mergeAdminRefundDetail(
  baseRecord: RefundRecord | null,
  detail: AdminRefundDetailDto,
  timelineItems: AdminRefundTimelineItemDto[] | null | undefined,
): RefundRecord {
  const fallbackRecord =
    baseRecord ??
    buildEmptyRefundRecord(
      normalizeText(detail.applicationNumber) || String(detail.id ?? "-"),
    );
  const attachmentUrls = [
    detail.attachmentsURL01,
    detail.attachmentsURL02,
    detail.attachmentsURL03,
  ]
    .map((item) => normalizeText(item))
    .filter(Boolean);
  const attachments = attachmentUrls.map((item, index) => toAttachment(item, index));
  const currentHandlerName =
    normalizeText(detail.currentHandlerName) ||
    normalizeText(fallbackRecord.currentHandler.name);
  const currentHandlerDepartment =
    normalizeRefundDepartmentDisplayLabel(
      detail.currentHandlerDepartmentName,
      normalizeText(fallbackRecord.currentHandler.department) || "",
    ) || normalizeText(fallbackRecord.currentHandler.department);
  const resolvedCurrentHandler: RefundRecord["currentHandler"] = {
    ...fallbackRecord.currentHandler,
    id:
      currentHandlerName ||
      normalizeText(fallbackRecord.currentHandler.id) ||
      EMPTY_VALUE,
    name: currentHandlerName || fallbackRecord.currentHandler.name,
    department:
      currentHandlerDepartment || fallbackRecord.currentHandler.department,
  };
  const commentDetails = mapAdminCommentDetails(detail.commentDetails);
  const timeline = mapAdminTimeline(timelineItems);
  const departmentRecommendation =
    resolveRefundDepartmentRecommendationFromDecision(detail.departmentDecision);
  const slaText = normalizeText(detail.sla);
  const paymentInfo = detail.paymentInfo;
  const paymentAmount =
    typeof paymentInfo?.amount === "number" ? paymentInfo.amount : 0;
  const paymentCardInfo =
    normalizeText(paymentInfo?.cardInfo) || normalizeText(detail.cardInfo);
  const paymentDescription = maskPaymentDescription(
    paymentInfo?.desciption,
    paymentCardInfo,
  );
  const paymentApplyForName =
    normalizeText(paymentInfo?.applyForObj?.userName) ||
    normalizeText(detail.applyFor) ||
    normalizeText(detail.apllyFor);
  const paymentStatus = resolveLocalizedName(paymentInfo?.statusObj);
  const transactionType = resolveLocalizedName(paymentInfo?.transactionTypeObj);
  const paymentMethod = resolveLocalizedName(paymentInfo?.paymentMethodObj);
  const paymentLastUpdated = normalizeText(paymentInfo?.updateOn);
  const sourceText = normalizeText(detail.sourceType) || fallbackRecord.source;
  const originChannelText = mapPlatformToOriginChannel(detail.platform);
  const hasDepartmentDecision = Object.prototype.hasOwnProperty.call(
    detail,
    "departmentDecision",
  );
  const resolvedDepartmentDecision = hasDepartmentDecision
    ? detail.departmentDecision ?? null
    : fallbackRecord.departmentDecision;
  const overviewIdentity = detail.overviewIdentity;
  const categoryText = normalizeDisplayValue(
    detail.categoryObj?.nameEn,
    fallbackRecord.category || EMPTY_VALUE,
  );
  const categoryDisplayText = normalizeDisplayValue(
    resolveLocalizedName(detail.categoryObj, fallbackRecord.categoryDisplay || categoryText),
    categoryText,
  );
  const statusText =
    normalizeText(detail.statusObj?.nameEn) || fallbackRecord.status;
  const statusDisplayText = normalizeDisplayValue(
    resolveLocalizedName(detail.statusObj, fallbackRecord.statusDisplay || statusText),
    statusText,
  );
  const refundReasonText =
    normalizeText(detail.reasonObj?.nameEn) || fallbackRecord.refundReason;
  const refundReasonDisplayText =
    resolveLocalizedName(
      detail.reasonObj,
      fallbackRecord.refundReasonDisplay || refundReasonText,
    ) || refundReasonText;

  return {
    ...fallbackRecord,
    refundId: detail.id ?? fallbackRecord.refundId,
    userId:
      normalizeText(overviewIdentity?.userId) ||
      normalizeText(detail.userId) ||
      fallbackRecord.userId,
    profileId:
      normalizeNumber(overviewIdentity?.profileId) ??
      normalizeNumber(overviewIdentity?.userProfileId) ??
      normalizeNumber(detail.profileId) ??
      normalizeNumber(detail.userProfileId) ??
      fallbackRecord.profileId,
    userProfileId:
      normalizeNumber(overviewIdentity?.userProfileId) ??
      normalizeNumber(overviewIdentity?.profileId) ??
      normalizeNumber(detail.userProfileId) ??
      normalizeNumber(detail.profileId) ??
      fallbackRecord.userProfileId,
    userTypeId:
      normalizeNumber(overviewIdentity?.userTypeId) ??
      normalizeNumber(detail.userTypeId) ?? fallbackRecord.userTypeId,
    userTypeCode:
      normalizeText(overviewIdentity?.userTypeCode) ||
      normalizeText(detail.userTypeCode) ||
      fallbackRecord.userTypeCode,
    establishmentId:
      normalizeNumber(overviewIdentity?.establishmentId) ??
      normalizeNumber(detail.establishmentId) ?? fallbackRecord.establishmentId,
    individualId:
      normalizeNumber(overviewIdentity?.individualId) ??
      normalizeNumber(detail.individualId) ?? fallbackRecord.individualId,
    establishmentName:
      normalizeText(overviewIdentity?.establishmentName) ||
      normalizeText(detail.establishmentName) || fallbackRecord.establishmentName,
    establishmentNameAr:
      normalizeText(overviewIdentity?.establishmentNameAr) ||
      normalizeText(detail.establishmentNameAr) ||
      fallbackRecord.establishmentNameAr,
    licenseNumber:
      normalizeText(overviewIdentity?.licenseNumber) ||
      normalizeText(detail.licenseNumber) || fallbackRecord.licenseNumber,
    refundNo:
      normalizeText(detail.applicationNumber) ||
      fallbackRecord.refundNo ||
      String(detail.id ?? "-"),
    applicationNumber:
      normalizeText(detail.applicationNumber) || fallbackRecord.applicationNumber,
    referenceNo:
      normalizeDisplayValue(detail.referenceNumber, fallbackRecord.referenceNo || EMPTY_VALUE),
    category: categoryText,
    categoryDisplay: categoryDisplayText,
    source: sourceText || SOURCE_PLACEHOLDER,
    originChannel: originChannelText,
    amount:
      typeof detail.amount === "number" ? detail.amount : fallbackRecord.amount,
    statusId:
      typeof detail.statusId === "number"
        ? detail.statusId
        : fallbackRecord.statusId,
    status: statusText,
    statusDisplay: statusDisplayText,
    ...(resolvedDepartmentDecision !== undefined
      ? { departmentDecision: resolvedDepartmentDecision }
      : {}),
    departmentRecommendation:
      departmentRecommendation.departmentRecommendation,
    departmentRecommendationTypeId:
      departmentRecommendation.departmentRecommendationTypeId,
    currentHandler: resolvedCurrentHandler,
    lastUpdatedAt:
      normalizeText(detail.updateOn) || fallbackRecord.lastUpdatedAt,
    assignedAt:
      normalizeText(detail.createdOn) || fallbackRecord.assignedAt,
    responseDeadline:
      normalizeText(detail.slaEndTime) || fallbackRecord.responseDeadline,
    slaHours:
      parseRefundSlaToHours(slaText) ?? fallbackRecord.slaHours,
    rawSla:
      slaText || fallbackRecord.rawSla,
    refundReason: refundReasonText,
    refundReasonDisplay: refundReasonDisplayText,
    attachments,
    notes: fallbackRecord.notes,
    communicationRecords: commentDetails,
    timeline,
    relatedPayment: {
      ...fallbackRecord.relatedPayment,
      transactionNo:
        normalizeText(paymentInfo?.transactionNo) ||
        normalizeText(detail.tanscationNo) ||
        fallbackRecord.relatedPayment.transactionNo,
      status: paymentStatus || fallbackRecord.relatedPayment.status,
      transactionType:
        transactionType || fallbackRecord.relatedPayment.transactionType,
      lastUpdatedAt:
        paymentLastUpdated || fallbackRecord.relatedPayment.lastUpdatedAt,
      paymentMethod:
        paymentMethod || fallbackRecord.relatedPayment.paymentMethod,
      cardInformation:
        formatPaymentCardInformation(
          paymentCardInfo || fallbackRecord.relatedPayment.cardInformation,
        ),
      amountCharged:
        typeof paymentInfo?.amount === "number"
          ? paymentAmount
          : fallbackRecord.relatedPayment.amountCharged,
      description:
        paymentDescription || fallbackRecord.relatedPayment.description,
    },
    applyFor: {
      ...fallbackRecord.applyFor,
      name: paymentApplyForName || fallbackRecord.applyFor.name,
      type: undefined,
    },
  };
}

export function mapStatusNameToId(
  statusName: string,
  options: RefundStatusItemDto[],
): number | undefined {
  const normalized = normalizeText(statusName).toLowerCase();
  const matched = options.find((item) => {
    return (
      normalizeText(item.nameEn).toLowerCase() === normalized ||
      normalizeText(item.code).toLowerCase() === normalized
    );
  });

  if (matched?.id) return matched.id;
  return undefined;
}

export function resolveAllowedRefundFinalStatuses(
  record?: RefundRecord | null,
): RefundStatusChangePayload["nextStatus"][] {
  const recommendation = normalizeRefundDepartmentRecommendation(record);
  const canChangeFromCurrentStatus = record
    ? isRefundStatusAllowed(record, ["Department Processed", "Pending Customer"])
    : false;

  if (recommendation === "Approve") {
    return ["Department Processing", "Pending Customer", "Pending Refund"];
  }

  if (recommendation === "Reject") {
    return ["Department Processing", "Pending Customer", "Rejected"];
  }

  if (record?.departmentDecision === null && canChangeFromCurrentStatus) {
    return ["Department Processing", "Pending Customer"];
  }

  return [];
}

export function canShowRefundChangeStatusAction(
  record?: RefundRecord | null,
  allowedStatuses: RefundStatus[] = ["Department Processed", "Pending Customer"],
) {
  if (!record) return false;
  return isRefundStatusAllowed(record, allowedStatuses);
}

export function mapProcessDecisionToId(
  decision: RefundDepartmentProcessDecision,
): number | undefined {
  return decision === "Approve"
    ? APPROVED_DECISION_TYPE_ID
    : REJECTED_DECISION_TYPE_ID;
}
