import { Form, Input, Modal } from "antd";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { CustomButton } from "@/components/common";
import {
  createMobileNumberFormRule,
  FormMobileNumberInput,
} from "@/components/common/MobileNumberInput";
import type { MobileNumberValue } from "@/components/common/MobileNumberInput";
import "./SendMessageModal.less";

const { TextArea } = Input;
const MAX_MESSAGE_LENGTH = 300;

interface SendMessageModalFormValues {
  mobileNumber: MobileNumberValue;
  message: string;
}

export interface SendMessageFormValues {
  userId?: string;
  countryCode: string;
  mobileNumber: string;
  message: string;
}

export interface SendMessageModalOpenOptions
  extends Partial<SendMessageFormValues> {
  title?: string;
  hideMobileNumber?: boolean;
}

export type SendMessagePayload = SendMessageFormValues;

export interface SendMessageModalRef {
  open: (options?: SendMessageModalOpenOptions) => void;
  close: () => void;
}

export interface SendMessageModalProps {
  onSend: (values: SendMessagePayload) => void | Promise<void>;
  onClose?: () => void;
  title?: string;
  mobileNumberLabel?: string;
  mobilePlaceholder?: string;
  messageRequiredText?: string;
  cancelText?: string;
  sendText?: string;
}

const DEFAULT_COUNTRY_CODE = "+971";

const SendMessageModal = forwardRef<SendMessageModalRef, SendMessageModalProps>(
  (
    {
      onSend,
      onClose,
      title,
      mobileNumberLabel,
      mobilePlaceholder,
      messageRequiredText,
      cancelText,
      sendText,
    },
    ref,
  ) => {
    const { t, i18n } = useTranslation();
    const [form] = Form.useForm<SendMessageModalFormValues>();
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resolvedTitle, setResolvedTitle] = useState<string | undefined>(
      undefined,
    );
    const [hideMobileNumber, setHideMobileNumber] = useState(false);
    const [formValues, setFormValues] = useState<SendMessageModalFormValues>({
      mobileNumber: {
        countryCode: DEFAULT_COUNTRY_CODE,
        phoneNumber: "",
      },
      message: "",
    });
    const userIdRef = useRef<string>();

    const modalTitle =
      resolvedTitle ?? title ?? t("Customer.accounts.actions.externalSms");
    const resolvedCancelText = cancelText ?? t("common.cancel");
    const resolvedSendText = sendText ?? t("common.send");
    const resolvedMobileLabel =
      mobileNumberLabel ??
      t("Customer.accounts.sendMessageModal.mobileNumberLabel");
    const resolvedMobilePlaceholder =
      mobilePlaceholder ??
      t("Customer.accounts.sendMessageModal.mobilePlaceholder");
    const resolvedMessageRequired =
      messageRequiredText ??
      t("Customer.accounts.sendMessageModal.messageRequiredText");
    const isRtl = i18n.dir(i18n.language) === "rtl";

    const close = useCallback(() => {
      setVisible(false);
    }, []);

    const open = useCallback(
      (options: SendMessageModalOpenOptions = {}) => {
        const nextFormValues: SendMessageModalFormValues = {
          mobileNumber: {
            countryCode: options.countryCode ?? DEFAULT_COUNTRY_CODE,
            phoneNumber: options.mobileNumber ?? "",
          },
          message: options.message ?? "",
        };

        form.resetFields();
        form.setFieldsValue(nextFormValues);
        form.setFields([
          { name: "mobileNumber", errors: [] },
          { name: "message", errors: [] },
        ]);
        userIdRef.current = options.userId;
        setResolvedTitle(options.title);
        setHideMobileNumber(Boolean(options.hideMobileNumber));
        setFormValues(nextFormValues);
        setVisible(true);
      },
      [form],
    );

    useImperativeHandle(
      ref,
      () => ({
        open,
        close,
      }),
      [close, open],
    );

    const handleCancel = useCallback(() => {
      if (loading) return;
      close();
      onClose?.();
    }, [close, loading, onClose]);

    const handleSend = useCallback(
      async (values: SendMessageModalFormValues) => {
        if (loading) return;

        const countryCode =
          values.mobileNumber.countryCode?.trim() || DEFAULT_COUNTRY_CODE;
        const mobileNumber = values.mobileNumber.phoneNumber.trim();

        setLoading(true);
        try {
          await onSend({
            userId: userIdRef.current,
            countryCode,
            mobileNumber,
            message: values.message.trim(),
          });
          close();
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      },
      [close, loading, onSend],
    );

    return (
      <Modal
        visible={visible}
        title={modalTitle}
        width={960}
        centered
        destroyOnClose
        maskClosable={!loading}
        keyboard={!loading}
        onCancel={handleCancel}
        afterClose={() => {
          form.resetFields();
          userIdRef.current = undefined;
        }}
        className={`send-message-modal${
          hideMobileNumber ? " send-message-modal--message-only" : ""
        }${isRtl ? " send-message-modal--rtl" : ""}`}
        footer={
          <div className="send-message-modal__footer">
            <CustomButton
              text={resolvedCancelText}
              variant="outline"
              size="large"
              disabled={loading}
              onClick={handleCancel}
              customClassName="send-message-modal__button"
            />
            <CustomButton
              text={resolvedSendText}
              variant="primary"
              size="large"
              loading={loading}
              onClick={() => form.submit()}
              customClassName="send-message-modal__button"
            />
          </div>
        }
      >
        <Form<SendMessageModalFormValues>
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={formValues}
          onFinish={handleSend}
          className="send-message-modal__form"
        >
          {hideMobileNumber ? (
            <Form.Item name="mobileNumber" hidden>
              <FormMobileNumberInput
                defaultCountryCode={DEFAULT_COUNTRY_CODE}
              />
            </Form.Item>
          ) : (
            <Form.Item
              label={resolvedMobileLabel}
              name="mobileNumber"
              rules={[
                createMobileNumberFormRule({
                  required: true,
                  messageOverrides: {
                    REQUIRED: resolvedMobilePlaceholder,
                  },
                }),
              ]}
              className="send-message-modal__phone-field"
            >
              <FormMobileNumberInput
                defaultCountryCode={DEFAULT_COUNTRY_CODE}
                placeholder={resolvedMobilePlaceholder}
              />
            </Form.Item>
          )}

          <Form.Item
            name="message"
            rules={[
              {
                required: true,
                whitespace: true,
                message: resolvedMessageRequired,
              },
            ]}
            className="send-message-modal__message-field"
          >
            <TextArea
              maxLength={MAX_MESSAGE_LENGTH}
              showCount
              placeholder={t(
                "Customer.accounts.sendMessageModal.messagePlaceholder",
              )}
              aria-label={t(
                "Customer.accounts.sendMessageModal.messageLabel",
              )}
            />
          </Form.Item>
        </Form>
      </Modal>
    );
  },
);

SendMessageModal.displayName = "SendMessageModal";

export default SendMessageModal;
