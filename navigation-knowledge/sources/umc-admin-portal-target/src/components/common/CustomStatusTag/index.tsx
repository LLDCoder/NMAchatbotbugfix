import "./index.less";
import { useTranslation } from "react-i18next";

export type CustomStatusTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "open"
  | "orange"
  | "gold"
  | "departmentProcessing";

export type CustomStatusSize = "default" | "compact";

export type StatusType =
  | "refund"
  | "wallet"
  | "application"
  | "transaction"
  | "equiry"
  | "userManagement"
  | "roleManagement"
  | "pageManagement"
  | "licenseStatus"
  | "contentLibraryStatus"
  | "refundOverviewStatus"
  | "appStatus"
  | "enquiryStatus"
  | "broadcast"
  | "accountStatus" // Can add more types here
  | "newspaperStatus"
  | "profileCard"
  | "walletStatus"
  | "applications";
interface TagProps {
  status?: number | string | null;
  type?: StatusType;
  label?: string;
  tone?: CustomStatusTone;
  size?: CustomStatusSize;
  className?: string;
}
interface StatusItem {
  textKey: string;
  class:
    | "warn"
    | "warning"
    | "error"
    | "success"
    | "info"
    | "open"
    | "orange"
    | "gold"
    | "departmentProcessing";
}
type StatusEnum = Record<StatusType, Record<number | string, StatusItem>>;

const toneClassMap: Record<CustomStatusTone, StatusItem["class"]> = {
  success: "success",
  warning: "warn",
  danger: "error",
  neutral: "info",
  open: "open",
  orange: "orange",
  gold: "gold",
  departmentProcessing: "departmentProcessing",
};

const buildClassName = (...classNames: Array<string | undefined | false>) =>
  classNames.filter(Boolean).join(" ");

const CustomStatusTag = ({
  status,
  type = "refund",
  label,
  tone,
  size = "default",
  className,
}: TagProps) => {
  const { t } = useTranslation();
  const statusEnum: StatusEnum = {
    refund: {
      1: { textKey: "customStatusTag.pendingApproval", class: "warn" },
      2: { textKey: "customStatusTag.rejected", class: "error" },
      3: { textKey: "customStatusTag.pendingRefund", class: "warn" },
      4: { textKey: "customStatusTag.completed", class: "success" },
      5: { textKey: "customStatusTag.cancelled", class: "info" },
    },
    wallet: {
      1: { textKey: "customStatusTag.pending", class: "warn" },
      2: { textKey: "customStatusTag.processing", class: "info" },
      3: { textKey: "customStatusTag.completed", class: "success" },
      4: { textKey: "customStatusTag.failed", class: "error" },
      5: { textKey: "customStatusTag.pendingCompleted", class: "success" },
      6: { textKey: "customStatusTag.refundInProgress", class: "info" },
      7: { textKey: "customStatusTag.refundCompleted", class: "success" },
    },
    walletStatus: {
      1: { textKey: "customStatusTag.inactive", class: "warn" },
      2: { textKey: "customStatusTag.active", class: "success" },
      3: { textKey: "customStatusTag.locked", class: "error" },
    },
    application: {
      1: { textKey: "customStatusTag.cancelled", class: "info" },
      2: { textKey: "customStatusTag.completed", class: "success" },
      3: { textKey: "customStatusTag.failed", class: "error" },
      4: { textKey: "customStatusTag.active", class: "success" },
      5: { textKey: "customStatusTag.paid", class: "success" },
    },
    transaction: {
      1: { textKey: "customStatusTag.pending", class: "info" },
      2: { textKey: "customStatusTag.processing", class: "success" },
      3: { textKey: "customStatusTag.completed", class: "success" },
      4: { textKey: "customStatusTag.failed", class: "error" },
      5: { textKey: "customStatusTag.pendingCompleted", class: "success" },
      6: { textKey: "customStatusTag.refundInProgress", class: "warn" },
      7: { textKey: "customStatusTag.refundCompleted", class: "success" },
      8: { textKey: "customStatusTag.failedRefund", class: "error" },
    },
    equiry: {
      1: { textKey: "customStatusTag.underProcessing", class: "warn" },
      2: { textKey: "customStatusTag.resolved", class: "success" },
      3: { textKey: "customStatusTag.completed", class: "success" },
      4: { textKey: "customStatusTag.cancelled", class: "info" },
    },
    userManagement: {
      1: { textKey: "customStatusTag.active", class: "success" },
      2: { textKey: "customStatusTag.deactivated", class: "warn" },
      3: { textKey: "customStatusTag.inactive", class: "info" },
    },
    roleManagement: {
      1: { textKey: "customStatusTag.active", class: "success" },
      2: { textKey: "customStatusTag.disabled", class: "warn" },
    },
    licenseStatus: {
      201: { textKey: "customStatusTag.active", class: "success" },
      205: { textKey: "customStatusTag.expireSoon", class: "error" },
      202: { textKey: "customStatusTag.expired", class: "error" },
      203: { textKey: "customStatusTag.cancelled", class: "info" },
      204: { textKey: "customStatusTag.suspended", class: "orange" },
    },
    broadcast: {
      1: { textKey: "customStatusTag.active", class: "success" },
      2: { textKey: "customStatusTag.scheduled", class: "warning" },
      3: { textKey: "customStatusTag.expired", class: "error" },
    },
    contentLibraryStatus: {
    Approved: { textKey: "customStatusTag.approved", class: "success" },
    Rejected: { textKey: "customStatusTag.rejected", class: "error" },
    "Pending Review": { textKey: "customStatusTag.pendingReview", class: "warning" },
    "Pending Approval": { textKey: "customStatusTag.pendingApproval", class: "warning" },
    },
    refundOverviewStatus: {
      "Under Review": { textKey: "customStatusTag.underReview", class: "warn" },
      "Pending Refund": { textKey: "customStatusTag.pendingRefund", class: "warn" },
      Rejected: { textKey: "customStatusTag.rejected", class: "error" },
      Refunded: { textKey: "customStatusTag.completed", class: "success" },
      Cancelled: { textKey: "customStatusTag.cancelled", class: "info" },
      1: { textKey: "customStatusTag.underReview", class: "warn" },
      2: { textKey: "customStatusTag.underReview", class: "warn" },
      3: { textKey: "customStatusTag.underReview", class: "warn" },
      4: { textKey: "customStatusTag.pendingRefund", class: "warn" },
      5: { textKey: "customStatusTag.rejected", class: "error" },
      6: { textKey: "customStatusTag.completed", class: "success" },
      7: { textKey: "customStatusTag.cancelled", class: "info" },
    },
    appStatus: {
      100: { textKey: "customStatusTag.allStatuses", class: "info" },
      101: { textKey: "customStatusTag.draft", class: "info" },
      102: { textKey: "customStatusTag.underReview", class: "warn" },
      103: { textKey: "customStatusTag.pendingPayment", class: "warn" },
      104: { textKey: "customStatusTag.pendingModification", class: "warn" },
      105: { textKey: "customStatusTag.completed", class: "success" },
      106: { textKey: "customStatusTag.rejected", class: "error" },
      107: { textKey: "customStatusTag.cancelled", class: "info" },
    },
    enquiryStatus: {
      1: { textKey: "customStatusTag.open", class: "open" },
      2: { textKey: "customStatusTag.pendingCustomer", class: "warning" },
      3: {
        textKey: "customStatusTag.departmentProcessing",
        class: "departmentProcessing",
      },
      4: { textKey: "customStatusTag.departmentProcessed", class: "open" },
      5: { textKey: "customStatusTag.resolved", class: "success" },
      6: { textKey: "customStatusTag.completed", class: "success" },
      7: { textKey: "customStatusTag.cancelled", class: "warn" },
    },
    accountStatus: {
      Active: { textKey: "customStatusTag.active", class: "success" },
      Suspended: { textKey: "customStatusTag.suspended", class: "error" },
    },
    newspaperStatus: {
      Approved: { textKey: "customStatusTag.approved", class: "success" },
      Rejected: { textKey: "customStatusTag.rejected", class: "error" },
      "Pending Review": { textKey: "customStatusTag.pendingReview", class: "warning" },
    },
    profileCard: {
      Approved: { textKey: "customStatusTag.approved", class: "success" },
      Rejected: { textKey: "customStatusTag.rejected", class: "error" },
      Expired: { textKey: "customStatusTag.expired", class: "error" },
      Suspended: { textKey: "customStatusTag.suspended", class: "error" },
      "Under Review": { textKey: "customStatusTag.underReview", class: "warning" },
      "Pending Review": { textKey: "customStatusTag.pendingReview", class: "warn" },
      "Pending Completion": { textKey: "customStatusTag.pendingCompletion", class: "warning" },
    },
    applications: {
      Completed: { textKey: "customStatusTag.completed", class: "success" },
      Approved: { textKey: "customStatusTag.approved", class: "success" },
      "Initial Approval": { textKey: "customStatusTag.initialApproval", class: "orange" },
      "External Approval": { textKey: "customStatusTag.externalApproval", class: "warn" },
      "Pending Payment": { textKey: "customStatusTag.pendingPayment", class: "warn" },
      "Pending Review": { textKey: "customStatusTag.pendingReview", class: "warn" },
      "Pending Disposition": {
        textKey: "customStatusTag.pendingDisposition",
        class: "warn",
      },
      "Disposition Verification": {
        textKey: "customStatusTag.dispositionVerification",
        class: "warn",
      },
      "Pending Refund": { textKey: "customStatusTag.pendingRefund", class: "warn" },
      Rejected: { textKey: "customStatusTag.rejected", class: "error" },
      "Final Approval": { textKey: "customStatusTag.finalApproval", class: "orange" },
      Canceled: { textKey: "customStatusTag.canceled", class: "info" },
      Cancelled: { textKey: "customStatusTag.cancelled", class: "info" },
      "Pending Modification": {
        textKey: "customStatusTag.pendingModification",
        class: "warn",
      },
    },
    pageManagement: {
      100: { textKey:"customStatusTag.published", class: "success" },
      0: { textKey: "customStatusTag.draft", class: "info" },
      50: { textKey: "customStatusTag.pendingReview", class: "warn" },
      10: { textKey: "customStatusTag.rejected", class: "error" }
    }
  };
  const isEmptyStatus =
    status === null ||
    status === undefined ||
    status === "" ||
    (typeof status === "number" && Number.isNaN(status));
  const statusConfig = isEmptyStatus ? undefined : statusEnum[type]?.[status];
  const resolvedClass = tone ? toneClassMap[tone] : statusConfig?.class;
  const resolvedLabel =
    label ??
    (statusConfig ? t(statusConfig.textKey) : isEmptyStatus ? "-" : status);

  return (
    <div
      className={buildClassName(
        "tag_box",
        size === "compact" && "tag_box--compact",
        resolvedClass,
        className,
      )}
    >
      {resolvedLabel}
    </div>
  );
};

export default CustomStatusTag;
