import React, { type ReactNode } from "react";
import { Modal, type ModalProps } from "antd";
import CustomButton from "../CustomButton";
import "./index.less";

export interface ChangePasswordCommonProps extends Omit<ModalProps, "footer"> {
  title?: string | ReactNode;
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showFooter?: boolean;
  confirmLoading?: boolean;
  confirmDisabled?: boolean;
  confirmButtonVariant?: "primary" | "secondary" | "outline" | "text" | "gold" | "danger" | "danger-outline";
  cancelButtonVariant?: "primary" | "secondary" | "outline" | "text" | "gold" | "danger" | "danger-outline";
  customFooter?: ReactNode;
  width?: number | string;
  centered?: boolean;
}

const ChangePasswordCommon: React.FC<ChangePasswordCommonProps> = ({
  title,
  children,
  confirmText = "Confirm",
  cancelText,
  onConfirm,
  onCancel,
  showFooter = true,
  confirmLoading = false,
  confirmDisabled = false,
  confirmButtonVariant = "primary",
  cancelButtonVariant = "outline",
  customFooter,
  width = 600,
  centered = true,
  visible,
  closable = false,
  maskClosable = false,
  ...restProps
}) => {
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
  };

  const renderFooter = () => {
    if (!showFooter) {
      return null;
    }

    if (customFooter) {
      return customFooter;
    }

    return (
      <div className="change-password-common-footer">
        {cancelText && (
          <CustomButton
            text={cancelText}
            variant={cancelButtonVariant}
            onClick={handleCancel}
            customClassName="cancel-btn"
            disabled={confirmLoading}
          />
        )}
        {confirmText && (
          <CustomButton
            text={confirmText}
            variant={confirmButtonVariant}
            onClick={handleConfirm}
            customClassName="confirm-btn"
            loading={confirmLoading}
            disabled={confirmDisabled}
          />
        )}
      </div>
    );
  };

  return (
    <Modal
      visible={visible}
      onCancel={handleCancel}
      footer={renderFooter()}
      title={title}
      width={width}
      centered={centered}
      closable={closable}
      maskClosable={maskClosable}
      className="change-password-common-modal"
      {...restProps}
      getContainer={restProps.getContainer}
    >
      <div className="change-password-common-content">{children}</div>
    </Modal>
  );
};

export default ChangePasswordCommon;

