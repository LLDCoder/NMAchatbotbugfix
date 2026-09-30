import React from "react";
import { Empty, Modal } from "antd";
import { useTranslation } from "react-i18next";
import type { AppealTimelineItem } from "@/pages/CustomerAppeals/types";
import AttachmentsDisplay from "@/pages/CustomerAppealsDetails/components/AttachmentsDisplay";

interface AttachmentListModalProps {
  item: AppealTimelineItem | null;
  onCancel: () => void;
}

const AttachmentListModal: React.FC<AttachmentListModalProps> = ({
  item,
  onCancel,
}) => {
  const { t } = useTranslation();
  const attachments = item?.attachments ?? [];

  return (
    <Modal
      visible={Boolean(item)}
      title={t("Customer.customerAppealsDetails.attachmentList.title")}
      onCancel={onCancel}
      footer={null}
      width={960}
      centered
      destroyOnClose
      className="appeal-timeline-attachments-modal"
    >
      {attachments.length ? (
        <div className="appeal-timeline-attachments-modal__grid">
          {attachments.map((attachment, index) => (
            <div
              key={attachment.id}
              className="appeal-timeline-attachments-modal__item"
            >
              <AttachmentsDisplay
                label={t(
                  "Customer.customerAppealsDetails.attachmentList.attachmentLabel",
                  { index: index + 1 },
                )}
                attachments={[attachment]}
                variant="communication"
                className="appeal-timeline-attachments-modal__attachment"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="appeal-timeline-attachments-modal__empty">
          <Empty
            description={t(
              "Customer.customerAppealsDetails.attachmentList.noAttachments",
            )}
          />
        </div>
      )}
    </Modal>
  );
};

export default AttachmentListModal;
