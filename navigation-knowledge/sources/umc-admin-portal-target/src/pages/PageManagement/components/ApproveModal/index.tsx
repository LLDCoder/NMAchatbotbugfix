import React from "react";
import { CustomMessage, ConfirmModal } from "@/components/common";
import { reviewConfig } from "@/services/cms";
import { useTranslation } from "react-i18next";

interface ApproveModalProps {
    visible: boolean;
    id: number | null;
    onCancel: () => void;
    refresh: () => void;
}

const ApproveModal: React.FC<ApproveModalProps> = ({
    visible,
    id,
    onCancel,
    refresh
}) => {
    const { t } = useTranslation();
    // review
    const reviewPage = () => {
        if (!id) return;
        reviewConfig({
            id,
            status: 100
        }).then(() => {
            CustomMessage.success(t("CMS.common.operationSuccessful"));
            onCancel();
            refresh();
        })
    };
  return (
    <ConfirmModal 
        visible={visible}
        title={t("CMS.modals.approveReview.title")}
        content={t("CMS.modals.approveReview.content")}
        contentPop={t("CMS.modals.approveReview.contentPop")}
        onCancel={onCancel}
        onConfirm={reviewPage}
    />
  )
};

export default ApproveModal;
