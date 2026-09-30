import { message } from "antd";
import type { ReactNode } from "react";
import { shouldBlockOtherErrorToasts, shouldSuppressNetworkErrorToast } from "@/utils/blockOtherErrorToasts";
import "./index.less";
import ToastErrorIcon from "@/assets/icons/toast-error.svg";
import ToastInfoIcon from "@/assets/icons/toast-info.svg";
import ToastLoadingIcon from "@/assets/icons/toast-loading.svg";
import ToastSuccessIcon from "@/assets/icons/toast-success.svg";
import ToastWarningIcon from "@/assets/icons/toast-warning.svg";

export type MessageType = "success" | "error" | "warning" | "info" | "loading";

export interface CustomMessageOptions {
  content: ReactNode;
  type: MessageType;
  duration?: number;
  onClose?: () => void;
}

const messageIconMap: Record<MessageType, string> = {
  success: ToastSuccessIcon,
  error: ToastErrorIcon,
  warning: ToastWarningIcon,
  info: ToastInfoIcon,
  loading: ToastLoadingIcon,
};

function renderMessageIcon(type: MessageType) {
  return (
    <span className={`custom-message__icon custom-message__icon--${type}`}>
      <img src={messageIconMap[type]} alt="" />
    </span>
  );
}

class CustomMessage {
  static success(content: ReactNode, duration?: number, onClose?: () => void) {
    return message.success({
      content,
      duration: duration ?? 3,
      onClose,
      icon: renderMessageIcon("success"),
      className: "custom-message custom-message--success",
    });
  }

  static error(content: ReactNode, duration?: number, onClose?: () => void, key?: string) {
    if (shouldBlockOtherErrorToasts() || shouldSuppressNetworkErrorToast()) {
      return;
    }
    return message.error({
      content,
      duration: duration ?? 3,
      onClose,
      key,
      icon: renderMessageIcon("error"),
      className: "custom-message custom-message--error",
    });
  }

  static warning(content: ReactNode, duration?: number, onClose?: () => void) {
    return message.warning({
      content,
      duration: duration ?? 3,
      onClose,
      icon: renderMessageIcon("warning"),
      className: "custom-message custom-message--warning",
    });
  }

  static info(content: ReactNode, duration?: number, onClose?: () => void) {
    return message.info({
      content,
      duration: duration ?? 3,
      onClose,
      icon: renderMessageIcon("info"),
      className: "custom-message custom-message--info",
    });
  }

  static loading(content: ReactNode, duration?: number, onClose?: () => void) {
    return message.loading({
      content,
      duration: duration ?? 3,
      onClose,
      icon: renderMessageIcon("loading"),
      className: "custom-message custom-message--loading",
    });
  }

  static show(options: CustomMessageOptions) {
    const { content, type, duration, onClose } = options;

    if (type === "success") {
      return this.success(content, duration, onClose);
    } else if (type === "error") {
      return this.error(content, duration, onClose);
    } else if (type === "warning") {
      return this.warning(content, duration, onClose);
    } else if (type === "info") {
      return this.info(content, duration, onClose);
    } else if (type === "loading") {
      return this.loading(content, duration, onClose);
    }
  }

  static destroy() {
    message.destroy();
  }
}

export default CustomMessage;
