import React, { useMemo, useState } from "react";
import PreviewModal from "@/components/common/PreviewModal";
import type { AppealAttachment } from "../types";
import { APPEAL_ACTION_ICON_MAP, buildAppealAttachmentAccessUrl } from "../utils";
import attachmentFileDeleteIcon from "@/pages/CustomerRefunds/assets/icons/attachment_file_delete.svg";
import attachmentEyeApplicationInfoIcon from "@/pages/CustomerRefunds/assets/icons/attachment_eye_application_info.svg";
import attachmentDownloadApplicationInfoIcon from "@/pages/CustomerRefunds/assets/icons/attachment_download_application_info.svg";
import fileJpegIcon from "@/assets/images/FileJpeg.svg";
import fileJpgIcon from "@/assets/images/FileJpg.svg";
import filePdfIcon from "@/assets/images/FilePdf.svg";
import filePngIcon from "@/assets/images/FilePng.svg";

interface AppealAttachmentsProps {
  attachments: AppealAttachment[];
  onDelete?: (attachmentId: string) => void;
  compact?: boolean;
  variant?: "default" | "applicationInfo" | "communication" | "composer" | "decision";
}

const AppealAttachments: React.FC<AppealAttachmentsProps> = ({
  attachments,
  onDelete,
  compact = false,
  variant = "default",
}) => {
  const [previewAttachment, setPreviewAttachment] =
    useState<AppealAttachment | null>(null);
  const usesFileCardIcon =
    variant === "applicationInfo" ||
    variant === "communication" ||
    variant === "composer" ||
    variant === "decision";
  const usesPreviewDeleteActions = variant === "composer" || variant === "decision";
  const usesFileActionIcons = usesFileCardIcon;

  const getAttachmentFileIcon = (attachment: AppealAttachment) => {
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
    const previewUrl =
      previewAttachment.url ||
      (previewAttachment.filePath
        ? buildAppealAttachmentAccessUrl(previewAttachment.filePath)
        : "");

    return {
      name: previewAttachment.name,
      url: previewUrl,
      filePath: previewAttachment.filePath,
    };
  }, [previewAttachment]);

  const getAttachmentDownloadUrl = (attachment: AppealAttachment) =>
    attachment.url ||
    (attachment.filePath
      ? buildAppealAttachmentAccessUrl(attachment.filePath)
      : "");

  if (!attachments.length) {
    if (variant === "composer" || variant === "decision") {
      return null;
    }
    return <div className="appeal-attachment-empty">-</div>;
  }

  return (
    <>
      <div
        className={`appeal-attachments ${compact ? "is-compact" : ""} ${
          variant === "applicationInfo" ? "is-application-info" : ""
        } ${variant === "communication" ? "is-communication" : ""} ${
          variant === "composer" ? "is-composer" : ""
        } ${variant === "decision" ? "is-decision" : ""}`}
      >
        {attachments.map((attachment) => (
          <div
            className={`appeal-attachment-chip ${
              variant === "applicationInfo" ? "is-application-info" : ""
            } ${variant === "communication" ? "is-communication" : ""} ${
              variant === "composer" ? "is-composer" : ""
            } ${variant === "decision" ? "is-decision" : ""}`}
            key={attachment.id}
          >
            <div className="appeal-attachment-chip__left">
              <span
                className={`appeal-attachment-chip__icon ${
                  variant === "applicationInfo" ? "is-application-info" : ""
                } ${variant === "communication" ? "is-communication" : ""} ${
                  variant === "composer" ? "is-composer" : ""
                } ${variant === "decision" ? "is-decision" : ""}`}
              >
                {usesFileCardIcon ? (
                  <img
                    src={getAttachmentFileIcon(attachment)}
                    alt=""
                    className="appeal-attachment-chip__file-icon"
                  />
                ) : (
                  <img src={APPEAL_ACTION_ICON_MAP.attachmentClip} alt="" />
                )}
              </span>
              <span
                className={`appeal-attachment-chip__name ${
                  variant === "applicationInfo" ? "is-application-info" : ""
                } ${variant === "communication" ? "is-communication" : ""} ${
                  variant === "composer" ? "is-composer" : ""
                } ${variant === "decision" ? "is-decision" : ""}`}
              >
                {attachment.name}
              </span>
            </div>
            <div
              className={`appeal-attachment-chip__actions ${
                variant === "applicationInfo" ? "is-application-info" : ""
              } ${variant === "communication" ? "is-communication" : ""} ${
                variant === "composer" ? "is-composer" : ""
              } ${variant === "decision" ? "is-decision" : ""}`}
            >
              <button
                type="button"
                className="appeal-attachment-chip__action"
                onClick={() => setPreviewAttachment(attachment)}
              >
                {usesFileActionIcons ? (
                  <img src={attachmentEyeApplicationInfoIcon} alt="" />
                ) : (
                  <img src={APPEAL_ACTION_ICON_MAP.attachmentEye} alt="" />
                )}
              </button>
              {!usesPreviewDeleteActions && (
                <a
                  href={getAttachmentDownloadUrl(attachment)}
                  download={attachment.name}
                  className="appeal-attachment-chip__action"
                >
                  {usesFileActionIcons ? (
                    <img
                      className="appeal-attachment-chip__download-icon"
                      src={attachmentDownloadApplicationInfoIcon}
                      alt=""
                    />
                  ) : (
                    <img src={APPEAL_ACTION_ICON_MAP.attachmentDownload} alt="" />
                  )}
                </a>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="appeal-attachment-chip__action appeal-attachment-chip__action--delete"
                  onClick={() => onDelete(attachment.id)}
                >
                  <img
                    src={
                      usesFileActionIcons
                        ? attachmentFileDeleteIcon
                        : APPEAL_ACTION_ICON_MAP.attachmentDelete
                    }
                    alt=""
                  />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {previewFileData ? (
        <PreviewModal
          visible={Boolean(previewAttachment)}
          fileData={previewFileData}
          onCancel={() => setPreviewAttachment(null)}
        />
      ) : null}
    </>
  );
};

export default AppealAttachments;
