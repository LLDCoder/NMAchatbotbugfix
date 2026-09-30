import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { Modal, Form, Input, Tag } from "antd";
import { CustomButton } from "@/components/common";
import "./index.less";
import type { IFieldType, IRejectModalRef, IRejectProps } from "./type";
import { RejectJob } from "@/services/cms";
import { CustomMessage } from "@/components/common";
import { useTranslation } from "react-i18next";

const REJECT_REASON_MAX_LENGTH = 1000;

const appendQuickNote = (current: string, note: string, maxLength: number) => {
  const suffix = `${note}; `;
  const next = `${current}${suffix}`;
  return next.length <= maxLength ? next : next.slice(0, maxLength);
};

export const RejectPublishModal = forwardRef<IRejectModalRef, IRejectProps>((props, ref) => {
  const { onCloseCb } = props;
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [id, setId] = useState(0);

  const quickNotes = useMemo(() => {
    const raw = t("CMS.jobOpeningsManagement.modals.rejectPublish.newQuickNotes", {
      returnObjects: true,
    });
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [t]);

  useImperativeHandle(ref, () => ({
    show: () => setVisible(true),
    setId: (id: number) => setId(id),
  }));

  const handleClose = () => {
    setVisible(false);
    onCloseCb?.();
  };

  const onSubmit = () => {
    form
      .validateFields()
      .then(async (values: IFieldType) => {
        RejectJob({ id, reason: values.rejectReason })
          .then(() => {
            handleClose();
            CustomMessage.success(t("CMS.common.operationSuccessful"));
          })
          .catch(() => {
            CustomMessage.error(t("CMS.jobOpeningsManagement.messages.operationFailed"));
          })
          .finally(() => setLoading(false));
      })
      .catch((err) => console.error(err));
  };

  return (
    <Modal
      centered
      title={t("CMS.jobOpeningsManagement.modals.rejectPublish.title")}
      className="reject-modal"
      visible={visible}
      destroyOnClose
      onCancel={handleClose}
      footer={
        <div>
          <CustomButton
            text={t("CMS.common.cancel")}
            variant="outline"
            onClick={handleClose}
          />
          <CustomButton
            loading={loading}
            text={t("CMS.common.confirm")}
            variant="primary"
            onClick={onSubmit}
          />
        </div>
      }
    >
      <Form form={form} layout="vertical" className="custom-form reject-form">
        <Form.Item
          name="rejectReason"
          label={t("CMS.jobOpeningsManagement.modals.rejectPublish.Notes")}
          rules={[{ required: true, message: t("CMS.common.requiredField") }]}
          normalize={(value) =>
            typeof value === "string" ? value.slice(0, REJECT_REASON_MAX_LENGTH) : value
          }
        >
          <Input.TextArea
            showCount
            placeholder={t("CMS.jobOpeningsManagement.modals.rejectPublish.reasonPlaceholder")}
            maxLength={REJECT_REASON_MAX_LENGTH}
            className="custom-textarea"
          />
        </Form.Item>
      </Form>
      <div className="custom-quick-note">
        <p className="note-title">{t("CMS.common.quickNotes")}</p>
        <div className="notes-list">
          {quickNotes.map((item) => (
            <Tag
              key={item.slice(0, 12)}
              color="rgba(225, 227, 229, 0.5)"
              className="note-item"
              onClick={() => {
                const value = (form.getFieldValue("rejectReason") as string) ?? "";
                form.setFieldValue(
                  "rejectReason",
                  appendQuickNote(value, item, REJECT_REASON_MAX_LENGTH)
                );
              }}
            >
              {item}
            </Tag>
          ))}
        </div>
      </div>
    </Modal>
  );
});
export default RejectPublishModal;
