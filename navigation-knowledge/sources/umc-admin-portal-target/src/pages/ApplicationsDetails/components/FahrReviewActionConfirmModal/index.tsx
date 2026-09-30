import React from "react";
import { useTranslation } from "react-i18next";
import { ConfirmModal } from "@/components/common";
import { inspectionFigmaAssets } from "@/pages/InspectionCommon/assets";
import type { FahrReviewAction } from "@/pages/ApplicationsDetails/components/FahrReviewDetailsModal";
import WarningGoldIcon from "@/assets/images/warning-gold1.png";

export type FahrReviewConfirmAction = Extract<
  FahrReviewAction,
  "cancelTransaction" | "applyTransaction" | "unapplyTransaction"
>;

interface FahrReviewActionConfirmModalProps {
  visible: boolean;
  action: FahrReviewConfirmAction | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const FahrReviewActionConfirmModal: React.FC<
  FahrReviewActionConfirmModalProps
> = ({ visible, action, loading = false, onCancel, onConfirm }) => {
  const { t } = useTranslation();
  if (!action) return null;

  const copy =
    action === "cancelTransaction"
      ? {
          title: t("Licensing.fahrReview.confirm.cancelTitle"),
          content: t("Licensing.fahrReview.confirm.cancelContent"),
        }
      : action === "unapplyTransaction"
        ? {
            title: t("Licensing.fahrReview.confirm.unapplyTitle"),
            content: t("Licensing.fahrReview.confirm.unapplyContent"),
        }
      : {
          title: t("Licensing.fahrReview.confirm.applyTransactionTitle"),
          content: t("Licensing.fahrReview.confirm.applyTransactionContent"),
        };

  const icon =
    action === "unapplyTransaction"
      ? inspectionFigmaAssets.modalConfirm.warningRed
      : action === "cancelTransaction"
        ? undefined
        : WarningGoldIcon;

  return (
    <ConfirmModal
      visible={visible}
      type="info"
      title={copy.title}
      content={copy.content}
      cancelText={t("common.cancel")}
      confirmText={t("common.confirm")}
      loading={loading}
      icon={icon}
      width={600}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};

export default FahrReviewActionConfirmModal;
