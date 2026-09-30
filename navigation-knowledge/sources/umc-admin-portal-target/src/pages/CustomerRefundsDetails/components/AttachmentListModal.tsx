import React from "react";
import { Empty, Modal } from "antd";
import { useTranslation } from "react-i18next";
import type { RefundTimelineItem } from "@/pages/CustomerRefunds/types";
import AttachmentsDisplay from "@/pages/CustomerRefundsDetails/components/AttachmentsDisplay";

interface AttachmentListModalProps {
  item: RefundTimelineItem | null;
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
      title={t("Customer.customerRefundsDetails.attachmentList.title")}
      onCancel={onCancel}
      footer={null}
      width={960}
      centered
      destroyOnClose
      className="refund-timeline-attachments-modal"
    >
      {attachments.length ? (
        <div className="refund-timeline-attachments-modal-grid">
          {attachments.map((attachment, index) => (
            <div
              key={attachment.id}
              className="refund-timeline-attachments-modal-item"
            >
              <AttachmentsDisplay
                label={t(
                  "Customer.customerRefundsDetails.attachmentList.attachmentLabel",
                  { index: index + 1 },
                )}
                attachments={[attachment]}
                variant="communication"
                className="refund-timeline-attachments-modal-attachment"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="refund-timeline-attachments-modal-empty">
          <Empty
            description={t(
              "Customer.customerRefundsDetails.attachmentList.noAttachments",
            )}
          />
        </div>
      )}
    </Modal>
  );
};

export default AttachmentListModal;
