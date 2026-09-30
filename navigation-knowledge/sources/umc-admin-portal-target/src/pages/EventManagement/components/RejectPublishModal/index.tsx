import { forwardRef, useImperativeHandle, useState } from "react";
import { Modal, Form, Input, Tag } from "antd";
import { CustomButton } from "@/components/common";
import "./index.less";
import type { IFieldType, IRejectModalRef, IRejectProps } from "./type";
import { RejectEvent } from "@/services/cms";
import { CustomMessage } from "@/components/common";
import { useTranslation } from "react-i18next";

const NOTE_KEYS = [
  "inaccurateInfo",
  "venueNotConfirmed",
  "scheduleConflict",
  "coverImageQualityLow",
] as const;

export const RejectPublishModal = forwardRef<IRejectModalRef, IRejectProps>((props, ref) => {
  const { onCloseCb } = props;
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [id, setId] = useState(0);
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
        RejectEvent({ id, reason: values.rejectReason }).then((res) => {
          handleClose();
          CustomMessage.success(t("CMS.common.operationSuccessful"));
        }).catch(() => {
          CustomMessage.error(t("CMS.eventManagement.messages.operationFailed"));
        }).finally(() => setLoading(false));
      })
      .catch((err) => console.error(err));
  };

  return (
    <Modal
      centered
      title={t("CMS.eventManagement.modals.rejectPublish.title")}
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
          label={t("CMS.eventManagement.modals.rejectPublish.rejectionReasons")}
          rules={[{ required: true, message: t("CMS.common.requiredField") }]}
        >
          <Input.TextArea
            showCount
            placeholder={t("CMS.eventManagement.modals.rejectPublish.reasonPlaceholder")}
            maxLength={1000}
            className="custom-textarea"
          />
        </Form.Item>
      </Form>
      <div className="custom-quick-note">
        <p className="note-title">{t("CMS.common.quickNote")}</p>
        <div className="notes-list">
          {NOTE_KEYS.map((noteKey) => {
            const note = t(
              `CMS.eventManagement.modals.rejectPublish.quickNotes.${noteKey}`
            );

            return (
            <Tag
              key={noteKey}
              color="rgba(225, 227, 229, 0.5)"
              className="note-item"
              onClick={() => {
                const value =
                  (form.getFieldValue("rejectReason") as string) ?? "";
                form.setFieldValue("rejectReason", value.concat(note, "; "));
              }}
            >
              {note}
            </Tag>
            );
          })}
        </div>
      </div>
    </Modal>
  );
});
export default RejectPublishModal;
