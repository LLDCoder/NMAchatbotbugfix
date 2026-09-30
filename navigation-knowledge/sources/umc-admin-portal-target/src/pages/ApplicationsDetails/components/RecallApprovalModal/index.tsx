import React, { useEffect } from "react";
import { Form, Input, Modal } from "antd";
import { useTranslation } from "react-i18next";
import WarningGold from "@/assets/icons/WarningGold";
import { CustomButton } from "@/components/common";
import "./index.less";

const RECALL_REASON_MAX_LENGTH = 500;

interface RecallApprovalFormValues {
  reason: string;
}

interface RecallApprovalModalProps {
  visible: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

const RecallApprovalModal: React.FC<RecallApprovalModalProps> = ({
  visible,
  loading,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<RecallApprovalFormValues>();
  const reason = Form.useWatch("reason", form) as string | undefined;
  const isConfirmDisabled = loading || !reason?.trim();

  useEffect(() => {
    if (!visible) {
      form.resetFields();
    }
  }, [form, visible]);

  const handleSubmit = async () => {
    if (loading) return;

    try {
      const values = await form.validateFields();
      await onConfirm(values.reason.trim());
    } catch (error) {
      if (!(error as { errorFields?: unknown[] })?.errorFields) {
        console.error("Failed to confirm recall approval:", error);
      }
    }
  };

  return (
    <Modal
      title={t("applications.recallApproval.title")}
      visible={visible}
      width={640}
      centered
      destroyOnClose
      closable={!loading}
      maskClosable={!loading}
      keyboard={!loading}
      className="form-modal recall-approval-modal"
      onCancel={loading ? undefined : onCancel}
      footer={
        <div>
          <CustomButton
            text={t("applications.recallApproval.cancel")}
            variant="outline"
            disabled={loading}
            onClick={onCancel}
            customStyle={{width: 140, height: 48, borderRadius: 8}}
          />
          <CustomButton
            loading={loading}
            disabled={isConfirmDisabled}
            text={t("applications.recallApproval.confirm")}
            variant="primary"
            onClick={handleSubmit}
            customStyle={{width: 140, height: 48, borderRadius: 8}}
          />
        </div>
      }
    >
      <div className="recall-approval-modal__warning">
        <WarningGold className="warning-icon" />
        <span>{t("applications.recallApproval.warning")}</span>
      </div>
      <Form form={form} layout="vertical" className="recall-approval-modal__form">
        <Form.Item
          name="reason"
          label={t("applications.recallApproval.reason")}
          rules={[
            {
              required: true,
              whitespace: true,
              message: t("applications.recallApproval.validation.required"),
            },
            {
              max: RECALL_REASON_MAX_LENGTH,
              message: t("applications.recallApproval.validation.maxLength"),
            },
          ]}
        >
          <Input.TextArea
            className="recall-approval-modal__textarea"
            showCount
            maxLength={RECALL_REASON_MAX_LENGTH}
            disabled={loading}
            placeholder={t("applications.recallApproval.reasonPlaceholder")}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RecallApprovalModal;
