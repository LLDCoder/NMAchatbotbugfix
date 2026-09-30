import React from "react";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import CustomButton from "../CustomButton";
import "./index.less";
import WaingGoldIcon from "@/assets/images/warning-gold1.png";

export interface TestConfirmModalProps {
  visible: boolean;
  title: string;
  description: string;
  account: string;
  note: string;
  cancelText?: string;
  confirmText?: string;
  loading?: boolean;
  width?: number;
  onCancel: () => void;
  onConfirm: () => void;
}

const TestConfirmModal: React.FC<TestConfirmModalProps> = ({
  visible,
  title,
  description,
  account,
  note,
  cancelText,
  confirmText,
  loading = false,
  width = 600,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const resolvedCancelText = cancelText ?? String(t("common.cancel"));
  const resolvedConfirmText = confirmText ?? String(t("common.confirm"));

  return (
    <Modal
      visible={visible}
      width={width}
      onCancel={onCancel}
      footer={null}
      closable={false}
      className="test-confirm-modal"
      centered
    >
      <div className="test-confirm-modal-content">
        <div className="test-confirm-modal-header">
          <div className="test-confirm-modal-icon">
            <img src={WaingGoldIcon} alt="" />
          </div>
          <h3 className="test-confirm-modal-title">{title}</h3>
        </div>
        <div className="test-confirm-modal-body">
          <p className="test-confirm-modal-description">{description}</p>
          <div className="test-confirm-modal-account">{account}</div>
          <p className="test-confirm-modal-note">{note}</p>
          <div className="test-confirm-modal-footer">
            <CustomButton
              text={resolvedCancelText}
              variant="outline"
              onClick={onCancel}
              customClassName="cancel-btn"
              disabled={loading}
            />
            <CustomButton
              text={resolvedConfirmText}
              variant="primary"
              onClick={onConfirm}
              customClassName="confirm-btn"
              loading={loading}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TestConfirmModal;
