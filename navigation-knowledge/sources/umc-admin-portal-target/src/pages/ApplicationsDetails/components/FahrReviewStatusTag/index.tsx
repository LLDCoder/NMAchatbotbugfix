import { useTranslation } from "react-i18next";
import RightArrow from "@/assets/icons/RightArrow";
import Paperclip from "@/assets/icons/Paperclip";
import type { FahrPersonStatus } from "@/services/fahr";
import "./index.less";
export type FahrReviewStatus = FahrPersonStatus;
export interface FahrReviewStatusTagProps {
  status: FahrReviewStatus;
  label?: string;
  onClick: () => void;
  className?: string;
  permit?: {
    name?: string;
    onDownload: () => void;
  };
}
const statusConfig: Record<
  FahrReviewStatus,
  {
    textKey: string;
    tone: "pending" | "approved" | "rejected" | "neutral";
  }
> = {
  Pending: {
    textKey: "Licensing.fahrReview.status.pendingReview",
    tone: "pending",
  },
  Approved: {
    textKey: "Licensing.fahrReview.status.approved",
    tone: "approved",
  },
  Rejected: {
    textKey: "Licensing.fahrReview.status.rejected",
    tone: "rejected",
  },
  RFI: {
    textKey: "Licensing.fahrReview.status.requestForInformation",
    tone: "pending",
  },
  Revoke: {
    textKey: "Licensing.fahrReview.status.underProcessing",
    tone: "pending",
  },
  Cancel: {
    textKey: "Licensing.fahrReview.status.cancelled",
    tone: "rejected",
  },
  PushFailed: {
    textKey: "Licensing.fahrReview.status.pushFailed",
    tone: "rejected",
  },
  CancelRequested: {
    textKey: "Licensing.fahrReview.status.cancelRequested",
    tone: "pending",
  },
  ApproveTransactionApplied: {
    textKey: "Licensing.fahrReview.status.transactionApplied",
    tone: "approved",
  },
  UnapplyTransactionApplied: {
    textKey: "Licensing.fahrReview.status.transactionUnapplied",
    tone: "pending",
  },
  TransactionApplied: {
    textKey: "Licensing.fahrReview.status.transactionApplied",
    tone: "approved",
  },
  TransactionUnapplied: {
    textKey: "Licensing.fahrReview.status.transactionUnapplied",
    tone: "pending",
  },
};
const UNKNOWN_STATUS_CONFIG = {
  textKey: "Licensing.fahrReview.status.unknown",
  tone: "neutral",
} as const;
const mapFahrReviewStatusText = (
  status: FahrReviewStatus,
  label: string | undefined,
  translate: (key: string) => string,
) => {
  const statusTextMap: Partial<Record<FahrReviewStatus, string>> = {
    Pending: translate("Licensing.fahrReview.status.pendingReview"),
  };
  const config = statusConfig[status] || UNKNOWN_STATUS_CONFIG;
  return statusTextMap[status] || label || translate(config.textKey);
};

export default function FahrReviewStatusTag({
  status,
  label,
  onClick,
  className,
  permit,
}: FahrReviewStatusTagProps) {
  const { t } = useTranslation();
  const config = statusConfig[status] || UNKNOWN_STATUS_CONFIG;
  return (
    <div className={`fahr-review-status-tag-group ${className || ""}`}>
      {permit && (
        <button
          type="button"
          className="fahr-review-status-tag__permit"
          title={permit.name || t("Licensing.fahrReview.permitFallback")}
          onClick={permit.onDownload}
        >
          <span
            className="fahr-review-status-tag__permit-icon"
            aria-hidden="true"
          >
            <Paperclip />
          </span>
          <span>{t("Licensing.fahrReview.permitLabel")}</span>
        </button>
      )}
      <button
        type="button"
        className={`fahr-review-status-tag fahr-review-status-tag--${config.tone}`}
        aria-haspopup="dialog"
        onClick={onClick}
      >
        <span className="fahr-review-status-tag__label">
          {t("Licensing.fahrReview.systemLabel")}:{" "}
          {mapFahrReviewStatusText(status, label, t)}
        </span>
        <span className="fahr-review-status-tag__arrow" aria-hidden="true">
          <RightArrow />
        </span>
      </button>
    </div>
  );
}
