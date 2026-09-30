import moment from "moment";
import enterpriseIcon from "@/pages/CustomerRefunds/assets/icons/apply_for_company.svg";
import userIcon from "@/pages/CustomerRefunds/assets/icons/apply_for_user.svg";
import totalIcon from "./assets/icons/summary_total.svg";
import departmentProcessingIcon from "./assets/icons/summary_department_processing.svg";
import departmentProcessedCustomerIcon from "./assets/icons/summary_department_processed_customer.svg";
import departmentProcessedDepartmentIcon from "./assets/icons/summary_department_processed_department.svg";
import pendingCustomerIcon from "./assets/icons/summary_pending_customer.svg";
import approvedIcon from "./assets/icons/summary_approved.svg";
import rejectedIcon from "./assets/icons/summary_rejected.svg";
import cancelledIcon from "./assets/icons/summary_cancelled.svg";
import appealNumberIcon from "@/pages/CustomerRefunds/assets/icons/detail_refund_number.svg";
import appealReasonIcon from "@/pages/CustomerRefunds/assets/icons/detail_refund_category.svg";
import appealSlaIcon from "@/pages/CustomerRefunds/assets/icons/detail_sla.svg";
import appealStatusIcon from "@/pages/CustomerRefunds/assets/icons/detail_status.svg";
import appealLastUpdatedIcon from "@/pages/CustomerRefunds/assets/icons/detail_last_updated.svg";
import messageAttachIcon from "@/pages/CustomerRefunds/assets/icons/message_attach.svg";
import messageSendIcon from "@/pages/CustomerRefunds/assets/icons/message_send.svg";
import backIcon from "@/pages/CustomerRefunds/assets/icons/back_icon.svg";
import changeStatusIcon from "@/pages/CustomerRefunds/assets/icons/change_status_action.svg";
import attachmentClipIcon from "@/pages/CustomerRefunds/assets/icons/attachment_clip.svg";
import attachmentEyeIcon from "@/pages/CustomerRefunds/assets/icons/attachment_eye.svg";
import attachmentDownloadIcon from "@/pages/CustomerRefunds/assets/icons/attachment_download.svg";
import attachmentDeleteIcon from "@/pages/CustomerRefunds/assets/icons/attachment_delete.svg";
import userAvatarIcon from "@/pages/CustomerRefunds/assets/icons/user_avatar_icon.svg";
import { ImageBaseUrl } from "@/utils/url";
import type {
  AppealApplyFor,
  AppealStatus,
  AppealSummaryItem,
  AppealTabKey,
  AppealViewRole,
} from "./types";

export const APPEAL_REASON_OPTIONS = [
  "Procedural Error",
  "First-Time Violation",
  "Evidence Dispute",
  "Permit Application in Progress",
  "Other",
];

export const APPEAL_STATUS_ID_MAP: Record<string, number> = {
  Pending: 1,
  Resolved: 2,
  "Department Processing": 3,
  "Department Processed": 4,
  "Pending Customer": 5,
  Approved: 6,
  Rejected: 7,
  Cancelled: 8,
};

export const APPEAL_STATUS_NAME_MAP: Record<number, AppealStatus> = {
  1: "Pending",
  2: "Resolved",
  3: "Department Processing",
  4: "Department Processed",
  5: "Pending Customer",
  6: "Approved",
  7: "Rejected",
  8: "Cancelled",
};

export const APPEAL_CANCEL_VIOLATION_DECISION_TYPE_ID = 3;
export const APPEAL_CANCELLED_VIOLATION_STATUS_ID = 10;

export const APPEAL_TODO_STATUS_ORDER: Record<string, number> = {
  "Department Processing": 0,
  "Department Processed": 1,
  "Pending Customer": 2,
  Approved: 3,
  Rejected: 4,
  Cancelled: 5,
};

export const APPEAL_STATUS_CLASS_MAP: Record<string, string> = {
  "Department Processing": "is-warning",
  "Department Processed": "is-warning-soft",
  "Pending Customer": "is-gold",
  Approved: "is-success",
  Rejected: "is-danger",
  Cancelled: "is-muted",
  Resolved: "is-success",
  Pending: "is-warning",
};

function normalizeAppealLookupKey(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
}

const APPEAL_STATUS_TRANSLATION_KEY_MAP: Record<string, string> = {
  pending: "Customer.customerAppeals.statuses.pending",
  resolved: "Customer.customerAppeals.statuses.resolved",
  departmentprocessing: "Customer.customerAppeals.statuses.departmentProcessing",
  departmentprocessed: "Customer.customerAppeals.statuses.departmentProcessed",
  pendingcustomer: "Customer.customerAppeals.statuses.pendingCustomer",
  approved: "Customer.customerAppeals.statuses.approved",
  rejected: "Customer.customerAppeals.statuses.rejected",
  cancelled: "Customer.customerAppeals.statuses.cancelled",
  appealsubmitted: "Customer.customerAppeals.statuses.appealSubmitted",
  statusupdate: "Customer.customerAppealsDetails.dynamic.statusUpdate",
};

const APPEAL_REASON_TRANSLATION_KEY_MAP: Record<string, string> = {
  proceduralerror: "Customer.customerAppeals.reasons.proceduralError",
  firsttimeviolation: "Customer.customerAppeals.reasons.firstTimeViolation",
  evidencedispute: "Customer.customerAppeals.reasons.evidenceDispute",
  permitapplicationinprogress:
    "Customer.customerAppeals.reasons.permitApplicationInProgress",
  other: "Customer.customerAppeals.reasons.other",
};

const APPEAL_SUMMARY_TRANSLATION_KEY_MAP: Record<string, string> = {
  total: "Customer.customerAppeals.summary.total",
  departmentProcessing: "Customer.customerAppeals.summary.departmentProcessing",
  departmentProcessed: "Customer.customerAppeals.summary.departmentProcessed",
  pendingCustomer: "Customer.customerAppeals.summary.pendingCustomer",
  approved: "Customer.customerAppeals.summary.approved",
  rejected: "Customer.customerAppeals.summary.rejected",
  cancelled: "Customer.customerAppeals.summary.cancelled",
};

export function getAppealStatusTranslationKey(status?: string | null) {
  return APPEAL_STATUS_TRANSLATION_KEY_MAP[normalizeAppealLookupKey(status)];
}

export function getAppealReasonTranslationKey(reason?: string | null) {
  return APPEAL_REASON_TRANSLATION_KEY_MAP[normalizeAppealLookupKey(reason)];
}

export function getAppealSummaryTranslationKey(key?: string | null) {
  return key ? APPEAL_SUMMARY_TRANSLATION_KEY_MAP[key] : undefined;
}

export function getAppealDepartmentTranslationKey(value?: string | null) {
  const raw = String(value ?? "").trim();
  const compact = normalizeAppealLookupKey(raw);

  if (!compact) return undefined;
  if (compact.includes("happiness")) {
    return "Customer.customerAppeals.departments.customerHappiness";
  }
  if (compact.includes("content")) {
    return "Customer.customerAppeals.departments.contentDepartment";
  }
  if (compact.includes("inspection")) {
    return "Customer.customerAppeals.departments.inspectionDepartment";
  }
  if (compact.includes("licens")) {
    return "Customer.customerAppeals.departments.licensingDepartment";
  }
  if (compact === "customer") {
    return "Customer.customerAppeals.departments.customer";
  }
  if (compact === "handlers") {
    return "Customer.customerAppeals.departments.handlers";
  }

  return undefined;
}

export function getAppealDecisionTranslationKey(value?: string | null) {
  const compact = normalizeAppealLookupKey(value);
  if (compact === "approve") return "Customer.customerAppeals.departmentModal.approve";
  if (compact === "reject") return "Customer.customerAppeals.departmentModal.reject";
  return undefined;
}

const APPEAL_SUMMARY_ICON_MAP: Record<AppealSummaryItem["iconKey"], string> = {
  total: totalIcon,
  departmentProcessing: departmentProcessingIcon,
  departmentProcessed: departmentProcessedCustomerIcon,
  pendingCustomer: pendingCustomerIcon,
  approved: approvedIcon,
  rejected: rejectedIcon,
  cancelled: cancelledIcon,
};

export function getAppealSummaryIconSrc(
  iconKey: AppealSummaryItem["iconKey"],
  viewRole: AppealViewRole,
) {
  if (
    iconKey === "departmentProcessed" &&
    (viewRole === "department" || viewRole === "committee")
  ) {
    return departmentProcessedDepartmentIcon;
  }

  return APPEAL_SUMMARY_ICON_MAP[iconKey];
}

export function getAppealSummaryIconClassName(
  iconKey: AppealSummaryItem["iconKey"],
  viewRole: AppealViewRole,
) {
  const variant =
    iconKey === "departmentProcessed" &&
    (viewRole === "department" || viewRole === "committee")
      ? "department-processed-department"
      : iconKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

  return `appeal-summary-card__icon appeal-summary-card__icon--${variant}`;
}

export const APPEAL_DETAIL_TOP_ICON_MAP = {
  appealNo: appealNumberIcon,
  appealReason: appealReasonIcon,
  sla: appealSlaIcon,
  status: appealStatusIcon,
  lastUpdatedAt: appealLastUpdatedIcon,
};

export const APPEAL_ACTION_ICON_MAP = {
  messageAttach: messageAttachIcon,
  messageSend: messageSendIcon,
  back: backIcon,
  changeStatus: changeStatusIcon,
  attachmentClip: attachmentClipIcon,
  attachmentEye: attachmentEyeIcon,
  attachmentDownload: attachmentDownloadIcon,
  attachmentDelete: attachmentDeleteIcon,
  userAvatar: userAvatarIcon,
};

export function getAppealApplyForIcon(applyFor: AppealApplyFor) {
  if (!applyFor.type) return undefined;
  return applyFor.type === "Commercial" ? enterpriseIcon : userIcon;
}

export function getAppealStatusClassName(status?: AppealStatus | null) {
  return APPEAL_STATUS_CLASS_MAP[String(status ?? "")] ?? "is-muted";
}

export function formatAppealDateTime(value?: string) {
  if (!value) return "-";
  const parsed = moment(
    value,
    [
      moment.ISO_8601,
      "DD/MM/YYYY HH:mm:ss",
      "DD/MM/YYYY HH:mm",
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DD HH:mm",
    ],
    true,
  );
  return parsed.isValid() ? parsed.format("DD/MM/YYYY HH:mm:ss") : "-";
}

export function formatAppealDateTimeMinute(value?: string) {
  if (!value) return "-";
  const parsed = moment(
    value,
    [
      moment.ISO_8601,
      "DD/MM/YYYY HH:mm:ss",
      "DD/MM/YYYY HH:mm",
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DD HH:mm",
    ],
    true,
  );
  return parsed.isValid() ? parsed.format("DD/MM/YYYY HH:mm") : "-";
}

export function formatAppealSummaryCount(value: number) {
  return value.toLocaleString();
}

export function getAppealTabLabel(tab: AppealTabKey) {
  return tab === "todo" ? "To Do" : "Completed";
}

export function getAppealSlaLabel(
  slaHours?: number,
  fallbackText?: string,
  labels?: { overdue: string; remaining: string },
) {
  if (slaHours === undefined || slaHours === null) return fallbackText || "-";

  const absValue = Math.abs(slaHours);
  let duration = "";

  if (absValue >= 24) {
    duration = `${Math.floor(absValue / 24)}d`;
  } else if (absValue >= 1) {
    duration = `${Math.floor(absValue)}h`;
  } else {
    duration = `${Math.max(0, Math.floor(absValue * 60))}min`;
  }

  return slaHours < 0
    ? `${duration} ${labels?.overdue ?? "Overdue"}`
    : `${duration} ${labels?.remaining ?? "Remaining"}`;
}

export function getAppealSlaCompletionLabel(
  slaHours?: number,
  fallbackText?: string,
  labels?: { exceeded: string; onTime: string },
) {
  if (slaHours === undefined || slaHours === null) return fallbackText || "-";
  return slaHours < 0
    ? labels?.exceeded ?? "Exceeded"
    : labels?.onTime ?? "On Time";
}

function isAbsoluteUrl(value: string) {
  return /^(https?:)?\/\//i.test(value);
}

function isDataUrl(value: string) {
  return /^data:/i.test(value);
}

function isBlobUrl(value: string) {
  return /^blob:/i.test(value);
}

function getDocumentDownloadFileName(value: string) {
  if (!value.startsWith("/api/Document/Dowload")) return "";

  try {
    const parsedUrl = new URL(value, "https://local.invalid");
    const fileName = parsedUrl.searchParams.get("fileName");
    return fileName ? decodeURIComponent(fileName) : "";
  } catch {
    return "";
  }
}

export function normalizeAppealAttachmentFilePath(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (isDataUrl(raw) || isBlobUrl(raw)) return raw;

  if (raw.startsWith(ImageBaseUrl)) {
    return decodeURIComponent(raw.slice(ImageBaseUrl.length));
  }

  const documentDownloadFileName = getDocumentDownloadFileName(raw);
  if (documentDownloadFileName) return documentDownloadFileName;

  if (isAbsoluteUrl(raw)) {
    try {
      const parsedUrl = new URL(raw);
      const fileName = parsedUrl.searchParams.get("fileName");
      return fileName ? decodeURIComponent(fileName) : raw;
    } catch {
      return raw;
    }
  }

  return raw;
}

export function buildAppealAttachmentAccessUrl(value?: string | null) {
  const filePath = normalizeAppealAttachmentFilePath(value);
  if (!filePath) return "";

  if (isDataUrl(filePath) || isBlobUrl(filePath) || isAbsoluteUrl(filePath)) {
    return filePath;
  }

  return `${ImageBaseUrl}${encodeURIComponent(filePath)}`;
}
