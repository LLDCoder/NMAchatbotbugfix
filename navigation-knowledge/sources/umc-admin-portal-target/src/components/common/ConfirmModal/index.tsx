import React from "react";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import CustomButton from "../CustomButton";
import "./index.less";
import WaingRedIcon from "@/assets/images/warning-circle.png";
import WaingGoldIcon from "@/assets/images/warning-gold1.png";
import CheckCircleIcon from "@/assets/images/checkcircle.png";

export type ConfirmModalType = "warning" | "danger" | "info" | "success";

export interface ConfirmModalProps {
  visible: boolean;
  type?: ConfirmModalType;
  title: string;
  content?: React.ReactNode;
  contentPop?: React.ReactNode;
  cancelText?: string;
  confirmText?: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
  icon?: string;
  width?: number;
  confirmPermissionCode?: string;
  permissionRoutePath?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  type = "warning",
  title,
  content,
  contentPop,
  cancelText,
  confirmText,
  onCancel,
  onConfirm,
  loading = false,
  icon,
  width,
  confirmPermissionCode,
  permissionRoutePath,
}) => {
  const { t } = useTranslation();
  const resolvedCancelText = cancelText ?? t("common.cancel");
  const resolvedConfirmText = confirmText ?? t("common.confirm");

  const hasRenderableContent = (value: React.ReactNode) => {
    if (value === null || value === undefined || value === false) {
      return false;
    }

    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return true;
  };

  const resolvedContent = hasRenderableContent(contentPop)
    ? contentPop
    : hasRenderableContent(content)
    ? content
    : null;

  const getIconConfig = () => {
    switch (type) {
      case "warning":
        return {
          icon: <img src={icon ?? WaingGoldIcon} alt="" />,
          className: "warning-icon",
        };
      case "danger":
        return {
          icon: <img src={icon ?? WaingRedIcon} alt="" />,
          className: "danger-icon",
        };
      case "info":
        return {
          icon: <img src={icon ?? WaingGoldIcon} alt="" />,
          className: "info-icon",
        };
      case "success":
        return {
          icon: <img src={icon ?? CheckCircleIcon} alt="" />,
          className: "success-icon",
        };
      default:
        return {
          icon: "!",
          className: "warning-icon",
        };
    }
  };

  const getConfirmButtonVariant = () => {
    switch (type) {
      case "danger":
        return "danger";
      default:
        return "primary";
    }
  };

  const getCancelButtonVariant = () => {
    switch (type) {
      case "danger":
        return "danger";
      default:
        return "outline";
    }
  };

  const iconConfig = getIconConfig();

  return (
    <Modal
      visible={visible}
      width={width}
      onCancel={onCancel}
      footer={null}
      closable={false}
      className={type === "danger" ? "darger-confirm-modal" : "confirm-modal"}
      centered
    >
      <div className="confirm-modal-content">
        <div className="confirm-modal-header">
          <div className={`confirm-modal-icon ${iconConfig.className}`}>
            {iconConfig.icon}
          </div>
          <h3 className="confirm-modal-title">{title}</h3>
        </div>
        {resolvedContent !== null ? (
          <div
            className={`confirm-modal-text ${
              typeof resolvedContent === "string"
                ? "confirm-modal-text--plain"
                : "confirm-modal-text--rich"
            }`}
          >
            {resolvedContent}
          </div>
        ) : null}
        <div className="confirm-modal-footer">
          {resolvedCancelText && (
            <CustomButton
              text={resolvedCancelText}
              variant={getCancelButtonVariant()}
              onClick={onCancel}
              customClassName="cancel-btn"
              disabled={loading}
            />
          )}
          <CustomButton
            text={resolvedConfirmText}
            variant={getConfirmButtonVariant()}
            onClick={onConfirm}
            customClassName="confirm-btn"
            loading={loading}
            permissionCode={confirmPermissionCode}
            permissionRoutePath={permissionRoutePath}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
