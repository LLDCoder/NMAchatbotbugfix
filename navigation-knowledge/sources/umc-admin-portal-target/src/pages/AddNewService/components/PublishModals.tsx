import React from "react";
import { Modal, Progress } from "antd";
import { CheckCircleOutlined, CopyOutlined } from "@ant-design/icons";
import { CustomButton } from "@/components/common";
import { useTranslation } from "react-i18next";
import "./PublishModals.less";

// 
interface PrePublishModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  testAccount?: string;
}

export const PrePublishModal: React.FC<PrePublishModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  testAccount = "test001@umc.gov"
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
      className="publish-modal pre-publish-modal"
      closable={true}
      centered
    >
      <h2 className="modal-title">
        {t("addNewService.publishModals.confirmPrePublishTitle")}
      </h2>
      
      <div className="modal-content">
        <p className="modal-description">
          {t("addNewService.publishModals.prePublishDescription")}
        </p>
        
        <div className="test-account-box">
          {testAccount}
        </div>
        
        <p className="modal-note">
          {t("addNewService.publishModals.prePublishNote")}
        </p>
      </div>
      
      <div className="modal-footer">
        <CustomButton
          text={t("common.cancel")}
          variant="outline"
          onClick={onCancel}
        />
        <CustomButton
          text={t("common.confirm")}
          variant="primary"
          onClick={onConfirm}
        />
      </div>
    </Modal>
  );
};

// 
interface PublishingModalProps {
  visible: boolean;
  progress: number;
}

export const PublishingModal: React.FC<PublishingModalProps> = ({
  visible,
  progress
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      footer={null}
      width={600}
      className="publish-modal publishing-modal"
      closable={false}
      centered
    >
      <div className="publishing-content">
        <div className="publishing-icon">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <path
              d="M40 10L50 30L70 35L55 50L58 70L40 60L22 70L25 50L10 35L30 30L40 10Z"
              fill="#E8D4B8"
              opacity="0.6"
            />
            <rect x="38" y="28" width="4" height="24" fill="#B8935A" rx="2">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 40 40"
                to="360 40 40"
                dur="2s"
                repeatCount="indefinite"
              />
            </rect>
          </svg>
        </div>
        
        <h2 className="modal-title">
          {t("addNewService.publishModals.publishingTitle")}
        </h2>
        <p className="modal-description">
          {t("addNewService.publishModals.publishingDescription")}
        </p>
        
        <div className="progress-container">
          <Progress
            percent={progress}
            strokeColor="#B8935A"
            trailColor="#E8E8E8"
            showInfo={true}
            format={(percent) => `${percent}%`}
          />
        </div>
      </div>
    </Modal>
  );
};

// 
interface PublishModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  serviceName: string;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  serviceName,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
      className="publish-modal official-publish-modal"
      closable={true}
      centered
    >
      <h2 className="modal-title">
        {t("addNewService.publishModals.confirmPublishTitle")}
      </h2>
      
      <div className="modal-content">
        <p className="modal-description">
          {t("addNewService.publishModals.publishDescription")}
        </p>
        
        <div className="service-name-box">
          {serviceName}
        </div>
        
        <p className="modal-note">
          {t("addNewService.publishModals.publishNote")}
        </p>
      </div>
      
      <div className="modal-footer">
        <CustomButton
          text={t("common.cancel")}
          variant="outline"
          onClick={onCancel}
        />
        <CustomButton
          text={t("common.confirm")}
          variant="primary"
          onClick={onConfirm}
        />
      </div>
    </Modal>
  );
};

// 
interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
  testAccount?: string;
  accessLink?: string;
  type?: 'pre-publish' | 'publish';
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  visible,
  onClose,
  testAccount = "test001@umc.gov",
  accessLink,
  type = 'pre-publish'
}) => {
  const { t } = useTranslation();
  const normalizedAccessLink = accessLink?.trim() || "";

  const handleCopyLink = () => {
    if (
      !normalizedAccessLink ||
      typeof navigator === "undefined" ||
      !navigator.clipboard?.writeText
    ) {
      return;
    }

    void navigator.clipboard.writeText(normalizedAccessLink).catch(() => undefined);
  };

  const handleOpenLink = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    if (!normalizedAccessLink || typeof window === "undefined") {
      return;
    }

    window.open(normalizedAccessLink, "_blank", "noopener,noreferrer");
  };

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      className="publish-modal success-modal"
      closable={false}
      centered
    >
      <div className="success-content">
        <div className="success-icon">
          <CheckCircleOutlined />
        </div>
        
        <h2 className="modal-title">
          {type === "pre-publish"
            ? t("addNewService.publishModals.prePublishSuccessTitle")
            : t("addNewService.publishModals.publishSuccessTitle")}
        </h2>
        
        <p className="modal-description">
          {type === "pre-publish"
            ? t("addNewService.publishModals.prePublishSuccessDescription")
            : t("addNewService.publishModals.publishSuccessDescription")}
        </p>
        
        {type === 'pre-publish' && (
          <div className="info-box">
            <div className="info-row">
              <span className="info-label">
                {t("addNewService.publishModals.testAccount")}
              </span>
              <span className="info-separator">:</span>
              <span className="info-value">{testAccount}</span>
            </div>
            {normalizedAccessLink && (
              <div className="info-row">
                <span className="info-label">
                  {t("addNewService.publishModals.accessLink")}
                </span>
                <span className="info-separator">:</span>
                <span className="info-value link">
                  <a
                    href={normalizedAccessLink}
                    className="access-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleOpenLink}
                  >
                    {normalizedAccessLink}
                  </a>
                  <CopyOutlined
                    className="copy-icon"
                    onClick={handleCopyLink}
                  />
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="modal-footer-center">
        <CustomButton
          text={t("common.close")}
          variant="primary"
          onClick={onClose}
        />
      </div>
    </Modal>
  );
};
