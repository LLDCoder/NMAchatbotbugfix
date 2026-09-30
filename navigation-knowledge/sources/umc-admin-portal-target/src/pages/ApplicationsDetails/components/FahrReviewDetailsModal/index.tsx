import React, { useState } from "react";
import { CloseOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import { CustomButton } from "@/components/common";
import DocumentViewer from "@/components/common/DocumentViewer";
import ReviewResultIcon from "@/assets/images/ReviewResult.svg";
import TimelineDateIcon from "@/assets/images/line-date.svg";
import Paperclip from "@/assets/icons/Paperclip";
import InspectionAttachmentGrid from "@/pages/InspectionStartVisit/components/InspectionAttachmentGrid";
import type {
  FahrReviewAction,
  FahrReviewTimelineAttachment,
  FahrReviewTimelineItem,
} from "./fahrReviewViewModel";
import "./index.less";

export type {
  FahrReviewAction,
  FahrReviewStatusTone,
  FahrReviewTimelineAttachment,
  FahrReviewTimelineItem,
} from "./fahrReviewViewModel";

export interface FahrReviewPermit {
  name?: string;
  fileUrl?: string;
  onView?: () => void;
  onDownload?: () => void;
}

export interface FahrReviewDetailsModalProps {
  visible: boolean;
  itimadNumber: string;
  timelineItems: FahrReviewTimelineItem[];
  permit?: FahrReviewPermit | null;
  title?: string;
  timelineTitle?: string;
  onCancel: () => void;
  onAction?: (action: FahrReviewAction) => void;
}

const MAX_VISIBLE_ATTACHMENTS = 3;

const toAttachmentGridItems = (attachment: FahrReviewTimelineAttachment) =>
  (attachment.files || []).map((file) => ({
    fileName: file.fileName,
    fileUrl: `/api/Document/Dowload?fileName=${encodeURIComponent(file.fileKey)}`,
  }));

const FahrReviewDetailsModal: React.FC<FahrReviewDetailsModalProps> = ({
  visible,
  itimadNumber,
  timelineItems,
  permit,
  title,
  timelineTitle,
  onCancel,
  onAction,
}) => {
  const { t } = useTranslation();
  const [selectedAttachment, setSelectedAttachment] =
    useState<FahrReviewTimelineAttachment | null>(null);
  const resolvedTitle = title || t("Licensing.fahrReview.title");
  const resolvedTimelineTitle =
    timelineTitle || t("Licensing.fahrReview.timelineTitle");
  const handleCancel = () => {
    setSelectedAttachment(null);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      width={640}
      centered
      destroyOnClose
      footer={null}
      maskClosable
      className="fahr-review-details-modal"
      closeIcon={<CloseOutlined />}
      onCancel={handleCancel}
      title={
        <div className="fahr-review-details-modal__heading">
          <h2 className="fahr-review-details-modal__title">
            {resolvedTitle}
          </h2>
          <p className="fahr-review-details-modal__subtitle">
            {t("Licensing.fahrReview.itimadNumber", {
              number: itimadNumber,
            })}
          </p>
        </div>
      }
    >
      {permit && (
        <div className="fahr-review-details-modal__permit">
          <DocumentViewer
            className="fahr-review-details-modal__permit-viewer"
            fileName={
              permit.name || t("Licensing.fahrReview.permitFallback")
            }
            fileUrl={permit.fileUrl}
            fileType="PDF"
            hasView
            hasDownload
            onView={permit.onView}
            onDownload={permit.onDownload}
          />
        </div>
      )}

      <section
        className="fahr-review-details-modal__timeline-card"
        aria-labelledby="fahr-review-timeline-title"
      >
        <h3
          id="fahr-review-timeline-title"
          className="fahr-review-details-modal__timeline-title"
        >
          {resolvedTimelineTitle}
        </h3>

        <div className="fahr-review-details-modal__timeline">
          {timelineItems.map((item, index) => {
            const isLast = index === timelineItems.length - 1;
            const statusTone = item.statusTone || "neutral";

            return (
              <div
                key={item.id ?? `${item.title}-${item.dateTime}-${index}`}
                className="fahr-review-details-modal__timeline-item"
              >
                <div className="fahr-review-details-modal__timeline-marker">
                  <span
                    className={`fahr-review-details-modal__timeline-dot${
                      item.active ? " is-active" : ""
                    }`}
                  />
                  {!isLast && (
                    <span className="fahr-review-details-modal__timeline-line" />
                  )}
                </div>

                <div className="fahr-review-details-modal__timeline-content">
                  <div className="fahr-review-details-modal__timeline-item-title">
                    {item.title}
                  </div>
                  <div className="fahr-review-details-modal__timeline-meta">
                    <div className="fahr-review-details-modal__timeline-meta-row">
                      <img src={TimelineDateIcon} alt="" />
                      <span>{item.dateTime}</span>
                    </div>
                    {item.status && (
                      <div className="fahr-review-details-modal__timeline-meta-row">
                        <img src={ReviewResultIcon} alt="" />
                        <span
                          className={`fahr-review-details-modal__status fahr-review-details-modal__status--${statusTone}`}
                        >
                          {item.status}
                        </span>
                      </div>
                    )}
                  </div>
                  {item.description && (
                    <p className="fahr-review-details-modal__timeline-description">
                      {item.description}
                    </p>
                  )}
                  {item.attachment?.files?.length ? (
                    item.attachment.files.length > MAX_VISIBLE_ATTACHMENTS ? (
                      <div className="fahr-review-details-modal__attachment-group">
                        <InspectionAttachmentGrid
                          attachments={toAttachmentGridItems({
                            ...item.attachment,
                            files: item.attachment.files.slice(
                              0,
                              MAX_VISIBLE_ATTACHMENTS,
                            ),
                          })}
                          className="fahr-review-details-modal__attachment-grid inspection-attachment-grid--single"
                        />
                        <button
                          type="button"
                          className="fahr-review-details-modal__attachment-summary"
                          onClick={() => setSelectedAttachment(item.attachment!)}
                        >
                          <span className="fahr-review-details-modal__attachment-summary-label">
                            <Paperclip />
                            <span>{t("Licensing.fahrReview.timeline.attachments")}</span>
                          </span>
                          <span className="fahr-review-details-modal__attachment-summary-count">
                            +{item.attachment.files.length - MAX_VISIBLE_ATTACHMENTS}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <InspectionAttachmentGrid
                        attachments={toAttachmentGridItems(item.attachment)}
                        className="fahr-review-details-modal__attachment-grid inspection-attachment-grid--single"
                      />
                    )
                  ) : null}
                  {onAction && item.actions?.length ? (
                    <div className="fahr-review-details-modal__timeline-actions">
                      {item.actions.map((timelineAction) => (
                        <CustomButton
                          key={timelineAction.action}
                          text={timelineAction.label}
                          variant={timelineAction.variant}
                          size="small"
                          customClassName="fahr-review-details-modal__timeline-action"
                          disabled={timelineAction.disabled}
                          onClick={() => onAction?.(timelineAction.action)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <Modal
        visible={Boolean(selectedAttachment)}
        title={t("Licensing.fahrReview.timeline.attachmentList")}
        onCancel={() => setSelectedAttachment(null)}
        footer={null}
        width={960}
        centered
        destroyOnClose
        className="fahr-review-details-modal__attachments-modal"
      >
        <InspectionAttachmentGrid
          attachments={
            selectedAttachment
              ? toAttachmentGridItems(selectedAttachment)
              : []
          }
          className="fahr-review-details-modal__attachments-modal-grid inspection-attachment-grid--two-columns"
        />
      </Modal>
    </Modal>
  );
};

export default FahrReviewDetailsModal;
