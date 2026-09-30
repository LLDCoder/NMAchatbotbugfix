import moment from "moment";
import type { TFunction } from "i18next";
import enterpriseIcon from "./assets/icons/apply_for_company.svg";
import userIcon from "./assets/icons/apply_for_user.svg";
import totalIcon from "./assets/icons/summary_total.svg";
import departmentProcessingIcon from "./assets/icons/summary_department_processing.svg";
import departmentProcessedIcon from "./assets/icons/summary_department_processed.svg";
import pendingCustomerIcon from "./assets/icons/summary_pending_customer.svg";
import pendingRefundIcon from "./assets/icons/summary_pending_refund.svg";
import refundedIcon from "./assets/icons/summary_refunded.svg";
import rejectedIcon from "./assets/icons/summary_rejected.svg";
import cancelledIcon from "./assets/icons/summary_cancelled.svg";
import refundNumberIcon from "./assets/icons/detail_refund_number.svg";
import refundCategoryIcon from "./assets/icons/detail_refund_category.svg";
import refundSlaIcon from "./assets/icons/detail_sla.svg";
import refundStatusIcon from "./assets/icons/detail_status.svg";
import refundLastUpdatedIcon from "./assets/icons/detail_last_updated.svg";
import messageAttachIcon from "./assets/icons/message_attach.svg";
import messageSendIcon from "./assets/icons/message_send.svg";
import backIcon from "./assets/icons/back_icon.svg";
import changeStatusIcon from "./assets/icons/change_status_action.svg";
import attachmentClipIcon from "./assets/icons/attachment_clip.svg";
import attachmentEyeIcon from "./assets/icons/attachment_eye.svg";
import attachmentDownloadIcon from "./assets/icons/attachment_download.svg";
import attachmentDeleteIcon from "./assets/icons/attachment_delete.svg";
import userAvatarIcon from "./assets/icons/user_avatar_icon.svg";
import { ImageBaseUrl } from "@/utils/url";
import type {
  RefundApplyFor,
  RefundStatus,
  RefundSummaryItem,
  RefundTabKey,
} from "./types";

export const TODO_STATUSES: RefundStatus[] = [
  "Department Processing",
  "Department Processed",
  "Pending Customer",
];

export const COMPLETED_STATUSES: RefundStatus[] = [
  "Pending Refund",
  "Rejected",
  "Refunded",
  "Cancelled",
];

export const TODO_STATUS_ORDER: Record<RefundStatus, number> = {
  "Department Processed": 0,
  "Pending Customer": 1,
  "Department Processing": 2,
  "Pending Refund": 3,
  Rejected: 4,
  Refunded: 5,
  Cancelled: 6,
};

export const STATUS_CLASS_MAP: Record<RefundStatus, string> = {
  "Department Processing": "is-warning",
  "Department Processed": "is-warning-soft",
  "Pending Customer": "is-gold",
  "Pending Refund": "is-warning-soft",
  Rejected: "is-danger",
  Refunded: "is-success",
  Cancelled: "is-muted",
};

export const SUMMARY_ICON_MAP: Record<RefundSummaryItem["iconKey"], string> = {
  total: totalIcon,
  departmentProcessing: departmentProcessingIcon,
  departmentProcessed: departmentProcessedIcon,
  pendingCustomer: pendingCustomerIcon,
  pendingRefund: pendingRefundIcon,
  refunded: refundedIcon,
  rejected: rejectedIcon,
  cancelled: cancelledIcon,
};

export const DETAIL_TOP_ICON_MAP = {
  refundNo: refundNumberIcon,
  category: refundCategoryIcon,
  sla: refundSlaIcon,
  status: refundStatusIcon,
  lastUpdatedAt: refundLastUpdatedIcon,
};

export const REFUND_ACTION_ICON_MAP = {
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

export function getApplyForIcon(applyFor: RefundApplyFor) {
  if (!applyFor.type) return undefined;
  return applyFor.type === "Commercial" ? enterpriseIcon : userIcon;
}

export function getStatusClassName(status: RefundStatus) {
  return STATUS_CLASS_MAP[status] ?? "is-muted";
}

export function formatDateTime(value?: string) {
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

export function formatDateTimeMinute(value?: string) {
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

export function formatAmount(value: number, currency = "AED") {
  return `-${currency} ${Math.abs(value).toFixed(2)}`;
}

export function formatSummaryCount(value: number) {
  return value.toLocaleString();
}

export function getTabLabel(tab: RefundTabKey) {
  return tab === "todo" ? "To Do" : "Completed";
}

function getRefundSlaText(
  t: TFunction | undefined,
  key: "overdue" | "remaining" | "exceeded" | "onTime",
  fallback: string,
) {
  const translationKey = `Customer.customerRefunds.sla.${key}`;
  const text = t?.(translationKey);
  return text && text !== translationKey ? text : fallback;
}

export function getSlaLabel(
  slaHours?: number,
  fallbackText?: string,
  t?: TFunction,
) {
  if (slaHours === undefined || slaHours === null) return fallbackText || "-";

  const absValue = Math.abs(slaHours);
  let duration = "";

  if (absValue >= 24) {
    const days = Math.floor(absValue / 24);
    duration = `${days}d`;
  } else if (absValue >= 1) {
    const hours = Math.floor(absValue);
    duration = `${hours}h`;
  } else {
    const minutes = Math.floor(absValue * 60);
    duration = `${minutes}min`;
  }

  const statusText =
    slaHours < 0
      ? getRefundSlaText(t, "overdue", "Overdue")
      : getRefundSlaText(t, "remaining", "Remaining");

  return `${duration} ${statusText}`;
}

export function getSlaCompletionLabel(
  slaHours?: number,
  fallbackText?: string,
  t?: TFunction,
) {
  if (slaHours === undefined || slaHours === null) return fallbackText || "-";
  return slaHours < 0
    ? getRefundSlaText(t, "exceeded", "Exceeded")
    : getRefundSlaText(t, "onTime", "On Time");
}

function isAbsoluteUrl(value: string) {
  return /^(https?:)?\/\//i.test(value);
}

function isRootRelativeUrl(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

function isApiPath(value: string) {
  return /^\/api\//i.test(value);
}

function isDirectRootRelativeUrl(value: string) {
  return isRootRelativeUrl(value) && !isApiPath(value);
}

function isDataUrl(value: string) {
  return /^data:/i.test(value);
}

function isBlobUrl(value: string) {
  return /^blob:/i.test(value);
}

function getUrlPathname(value: string) {
  try {
    return new URL(value, "https://local.invalid").pathname;
  } catch {
    return "";
  }
}

function isInvalidInspectionDeclarationMockFileUrl(value: string) {
  return /^\/api\/admin\/inspection\/mock-files\/declarations\/.+\.pdf$/i.test(
    getUrlPathname(value),
  );
}

function getDocumentDownloadFileName(value: string) {
  try {
    const parsedUrl = new URL(value, "https://local.invalid");
    if (!/^\/api\/Document\/(?:Dowload|Download)$/i.test(parsedUrl.pathname)) return "";

    const fileName = parsedUrl.searchParams.get("fileName");
    return fileName ? decodeURIComponent(fileName) : "";
  } catch {
    return "";
  }
}

export function normalizeRefundAttachmentFilePath(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (isInvalidInspectionDeclarationMockFileUrl(raw)) return "";

  if (isDataUrl(raw) || isBlobUrl(raw)) return raw;

  if (raw.startsWith(ImageBaseUrl)) {
    return decodeURIComponent(raw.slice(ImageBaseUrl.length));
  }

  const documentDownloadFileName = getDocumentDownloadFileName(raw);
  if (documentDownloadFileName) return documentDownloadFileName;

  if (isDirectRootRelativeUrl(raw)) return raw;

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

export function buildRefundAttachmentAccessUrl(value?: string | null) {
  const filePath = normalizeRefundAttachmentFilePath(value);
  if (!filePath) return "";

  if (isDataUrl(filePath) || isBlobUrl(filePath) || isAbsoluteUrl(filePath)) {
    return filePath;
  }

  if (isDirectRootRelativeUrl(filePath)) return filePath;
  if (isApiPath(filePath)) return "";

  return `${ImageBaseUrl}${encodeURIComponent(filePath)}`;
}
