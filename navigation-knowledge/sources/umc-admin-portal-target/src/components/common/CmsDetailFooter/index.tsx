import type { FC } from "react";
import { useTranslation } from "react-i18next";
import CustomButton from "../CustomButton";
import CustomFooter from "../CustomFooter";
import { useButtonPermission } from "@/routes/access";
import type { CmsDetailFooterProps } from "./type";

const EDITABLE_STATUSES = ["Draft", "Rejected", "Unpublished"];

/**
 * Shared bottom action bar for CMS detail pages (News / Event / Job).
 * Renders status-aware actions; each module injects its own API callbacks.
 */
const CmsDetailFooter: FC<CmsDetailFooterProps> = ({
  status = "",
  routePath,
  approvePermissionCode,
  rejectPermissionCode,
  deletePermissionCode,
  unpublishPermissionCode,
  supportsScheduled = false,
  onBack,
  onPreview,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onUnpublish,
  onDuplicate,
}) => {
  const { t } = useTranslation();
  const { canRenderButton } = useButtonPermission(routePath);

  const isPending = status === "Pending Review";
  const isEditable = EDITABLE_STATUSES.includes(status);
  const canUnpublish =
    status === "Published" || (supportsScheduled && status === "Scheduled");
  const canReview = approvePermissionCode
    ? canRenderButton(approvePermissionCode)
    : true;
  const canReject = rejectPermissionCode
    ? canRenderButton(rejectPermissionCode)
    : canReview;
  const canDelete = deletePermissionCode
    ? canRenderButton(deletePermissionCode)
    : true;
  const canRenderUnpublish = unpublishPermissionCode
    ? canRenderButton(unpublishPermissionCode)
    : true;
  const hasFooterActions = Boolean(
    onPreview ||
      (isPending && onApprove && canReview) ||
      (isPending && onReject && canReject) ||
      (isEditable && onEdit) ||
      (isEditable && onDelete && canDelete) ||
      (canUnpublish && onUnpublish && canRenderUnpublish) ||
      onDuplicate,
  );

  if (!hasFooterActions) {
    return null;
  }

  return (
    <CustomFooter
      onBack={onBack}
      rightContent={
        <>
          {onPreview && (
            <CustomButton
              text={t("CMS.common.preview")}
              variant="outline"
              onClick={onPreview}
            />
          )}
          {isEditable && onEdit && (
            <CustomButton
              text={t("CMS.common.edit")}
              variant="outline"
              onClick={onEdit}
            />
          )}
          {isEditable && canDelete && onDelete && (
            <CustomButton
              text={t("CMS.common.delete")}
              variant="danger-outline"
              onClick={onDelete}
            />
          )}
          {canUnpublish && canRenderUnpublish && onUnpublish && (
            <CustomButton
              text={t("CMS.common.unpublish")}
              variant="outline"
              onClick={onUnpublish}
            />
          )}
          {isPending && canReject && onReject && (
            <CustomButton
              text={t("CMS.common.reject")}
              variant="danger-outline"
              onClick={onReject}
            />
          )}
          {onDuplicate && (
            <CustomButton
              text={t("CMS.common.duplicate")}
              variant="primary"
              onClick={onDuplicate}
            />
          )}
          {isPending && canReview && onApprove && (
            <CustomButton
              text={t("CMS.common.approve")}
              variant="primary"
              onClick={onApprove}
            />
          )}
        </>
      }
    />
  );
};

export default CmsDetailFooter;
