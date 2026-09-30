import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import PreviewModal from "@/components/common/PreviewModal";
import { CustomMessage } from "@/components/common";
import { downloadDocumentFile } from "@/services/media";
import {
  REFUND_ACTION_ICON_MAP,
  buildRefundAttachmentAccessUrl,
} from "../utils";
import type { RefundAttachment } from "../types";
import attachmentFileDeleteIcon from "../assets/icons/attachment_file_delete.svg";
import attachmentEyeApplicationInfoIcon from "../assets/icons/attachment_eye_application_info.svg";
import attachmentDownloadApplicationInfoIcon from "../assets/icons/attachment_download_application_info.svg";
import fileJpegIcon from "@/assets/images/FileJpeg.svg";
import fileJpgIcon from "@/assets/images/FileJpg.svg";
import filePdfIcon from "@/assets/images/FilePdf.svg";
import filePngIcon from "@/assets/images/FilePng.svg";

interface RefundAttachmentsProps {
  attachments: RefundAttachment[];
  onDelete?: (attachmentId: string) => void;
  onDownload?: (attachment: RefundAttachment) => void;
  compact?: boolean;
  showDownload?: boolean;
  variant?:
    | "default"
    | "applicationInfo"
    | "communication"
    | "composer"
    | "decision";
}

const getAttachmentPreviewUrl = (attachment: RefundAttachment) =>
  attachment.url ||
  (attachment.filePath
    ? buildRefundAttachmentAccessUrl(attachment.filePath)
    : "");

const RefundAttachments: React.FC<RefundAttachmentsProps> = ({
  attachments,
  onDelete,
  onDownload,
  compact = false,
  showDownload = true,
  variant = "default",
}) => {
  const { t } = useTranslation();
  const [previewAttachment, setPreviewAttachment] =
    useState<RefundAttachment | null>(null);
  const [downloadingId, setDownloadingId] = useState("");
  const usesFileCardIcon =
    variant === "applicationInfo" ||
    variant === "communication" ||
    variant === "composer" ||
    variant === "decision";
  const usesPreviewDeleteActions =
    variant === "composer" || variant === "decision";
  const usesFileActionIcons =
    variant === "applicationInfo" ||
    variant === "communication" ||
    variant === "composer" ||
    variant === "decision";

  const getAttachmentFileIcon = (attachment: RefundAttachment) => {
    const extension =
      attachment.type ||
      attachment.name.split(".").pop()?.toLowerCase() ||
      attachment.url.split(".").pop()?.toLowerCase() ||
      "pdf";

    switch (extension) {
      case "jpg":
        return fileJpgIcon;
      case "jpeg":
        return fileJpegIcon;
      case "png":
        return filePngIcon;
      case "pdf":
      default:
        return filePdfIcon;
    }
  };

  const previewFileData = useMemo(() => {
    if (!previewAttachment) return null;
    const previewUrl = getAttachmentPreviewUrl(previewAttachment);
    if (!previewUrl) return null;

    return {
      name: previewAttachment.name,
      url: previewUrl,
      filePath: previewAttachment.filePath,
    };
  }, [previewAttachment]);

  const getAttachmentDownloadUrl = (attachment: RefundAttachment) =>
    attachment.url ||
    (attachment.filePath
      ? buildRefundAttachmentAccessUrl(attachment.filePath)
      : "");

  // Native <a download> cannot attach the bearer token, so protected files are
  // streamed through the authenticated client instead of a direct navigation.
  const handleFallbackDownload = async (attachment: RefundAttachment) => {
    const downloadUrl = getAttachmentDownloadUrl(attachment);
    if (!downloadUrl || downloadingId) return;

    setDownloadingId(attachment.id);
    try {
      await downloadDocumentFile(downloadUrl, attachment.name);
    } catch {
      CustomMessage.error(
        t("Customer.customerRefunds.messages.fileUnavailable"),
      );
    } finally {
      setDownloadingId("");
    }
  };

  const handlePreview = (attachment: RefundAttachment) => {
    if (!getAttachmentPreviewUrl(attachment)) {
      CustomMessage.error(
        t("Customer.customerRefunds.messages.fileUnavailable"),
      );
      return;
    }

    setPreviewAttachment(attachment);
  };
  const shouldShowDownload = showDownload && !usesPreviewDeleteActions;

  if (!attachments.length) {
    return <div className="refund-attachment-empty">-</div>;
  }

  return (
    <>
      <div
        className={`refund-attachments ${compact ? "is-compact" : ""} ${
          variant === "applicationInfo" ? "is-application-info" : ""
        } ${variant === "communication" ? "is-communication" : ""} ${
          variant === "composer" ? "is-composer" : ""
        } ${variant === "decision" ? "is-decision" : ""
        }`}
      >
        {attachments.map((attachment) => {
          const downloadUrl = getAttachmentDownloadUrl(attachment);

          return (
            <div
              className={`refund-attachment-chip ${
                variant === "applicationInfo" ? "is-application-info" : ""
              } ${variant === "communication" ? "is-communication" : ""} ${
                variant === "composer" ? "is-composer" : ""
              } ${variant === "decision" ? "is-decision" : ""
              }`}
              key={attachment.id}
            >
              <div className="refund-attachment-left">
                <span
                  className={`refund-attachment-icon ${
                    variant === "applicationInfo" ? "is-application-info" : ""
                  } ${variant === "communication" ? "is-communication" : ""} ${
                    variant === "composer" ? "is-composer" : ""
                  } ${variant === "decision" ? "is-decision" : ""
                  }`}
                >
                  {usesFileCardIcon ? (
                    <img
                      src={getAttachmentFileIcon(attachment)}
                      alt=""
                      className="refund-attachment-icon-fold"
                    />
                  ) : (
                    <img src={REFUND_ACTION_ICON_MAP.attachmentClip} alt="" />
                  )}
                </span>
                <span
                  className={`refund-attachment-name ${
                    variant === "applicationInfo" ? "is-application-info" : ""
                  } ${variant === "communication" ? "is-communication" : ""} ${
                    variant === "composer" ? "is-composer" : ""
                  } ${variant === "decision" ? "is-decision" : ""
                  }`}
                >
                  {attachment.name}
                </span>
              </div>
              <div
                className={`refund-attachment-actions ${
                  variant === "applicationInfo" ? "is-application-info" : ""
                } ${variant === "communication" ? "is-communication" : ""} ${
                  variant === "composer" ? "is-composer" : ""
                } ${variant === "decision" ? "is-decision" : ""
                }`}
              >
                <button
                  type="button"
                  className="refund-attachment-action"
                  onClick={() => handlePreview(attachment)}
                >
                  {usesFileActionIcons ? (
                    <img src={attachmentEyeApplicationInfoIcon} alt="" />
                  ) : (
                    <img src={REFUND_ACTION_ICON_MAP.attachmentEye} alt="" />
                  )}
                </button>
                {shouldShowDownload && (onDownload || downloadUrl) ? (
                  onDownload ? (
                    <button
                      type="button"
                      className="refund-attachment-action"
                      onClick={() => onDownload(attachment)}
                    >
                      {variant === "applicationInfo" ? (
                        <img
                          className="refund-attachment-download-icon"
                          src={attachmentDownloadApplicationInfoIcon}
                          alt=""
                        />
                      ) : variant === "communication" ? (
                        <img
                          className="refund-attachment-download-icon"
                          src={attachmentDownloadApplicationInfoIcon}
                          alt=""
                        />
                      ) : (
                        <img src={REFUND_ACTION_ICON_MAP.attachmentDownload} alt="" />
                      )}
                    </button>
                  ) : (
                  <button
                  type="button"
                  className="refund-attachment-action"
                  disabled={downloadingId === attachment.id}
                  onClick={() => {
                  void handleFallbackDownload(attachment);
                  }}
                  >
                  {variant === "applicationInfo" ? (
                  <img
                  className="refund-attachment-download-icon"
                  src={attachmentDownloadApplicationInfoIcon}
                  alt=""
                  />
                  ) : variant === "communication" ? (
                  <img
                  className="refund-attachment-download-icon"
                  src={attachmentDownloadApplicationInfoIcon}
                  alt=""
                  />
                  ) : (
                  <img src={REFUND_ACTION_ICON_MAP.attachmentDownload} alt="" />
                  )}
                  </button>
                  )
                ) : null}
                {onDelete && (
                  <button
                    type="button"
                    className="refund-attachment-action refund-attachment-delete"
                    onClick={() => onDelete(attachment.id)}
                  >
                    <img
                      src={
                        variant === "applicationInfo" ||
                        variant === "composer" ||
                        variant === "decision"
                          ? attachmentFileDeleteIcon
                          : REFUND_ACTION_ICON_MAP.attachmentDelete
                      }
                      alt=""
                    />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {previewFileData ? (
        <PreviewModal
          visible={Boolean(previewAttachment)}
          fileData={previewFileData}
          onCancel={() => setPreviewAttachment(null)}
          onDownload={
            onDownload && previewAttachment
              ? () => onDownload(previewAttachment)
              : undefined
          }
        />
      ) : null}
    </>
  );
};

export default RefundAttachments;
