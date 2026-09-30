import React from "react";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import "./index.less";
import Warning2Icon from "@/assets/images/warning2.svg";
import {
  AuthenticatedDocumentHtml,
} from "@/components/common/AuthenticatedDocumentHtml";

export interface AnnouncementModalProps {
  visible: boolean;
  headerLabel?: string;
  title: string;
  content: string;
  onClose: () => void;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  visible,
  headerLabel,
  title,
  content,
  onClose,
}) => {
  const { t } = useTranslation();
  const displayHeaderLabel = headerLabel ?? t("notifications.announcement");

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      closable
      centered
      maskClosable={false}
      width={640}
      className="announcement-modal"
    >
      <div className="announcement-container">
        <div className="announcement-header">
          <div className="announcement-icon">
            <img src={Warning2Icon} alt="" />
          </div>
          <span className="announcement-label">{displayHeaderLabel}</span>
        </div>
        <div className="announcement-body">
          <h2 className="announcement-title">{title}</h2>
          <AuthenticatedDocumentHtml
            className="announcement-content"
            html={content}
          />
        </div>
      </div>
    </Modal>
  );
};

export default AnnouncementModal;
