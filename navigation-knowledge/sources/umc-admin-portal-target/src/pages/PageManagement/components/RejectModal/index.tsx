import React, { useState } from 'react';
import { Input, Modal, Form, Tag } from 'antd';
import { CustomButton, CustomMessage } from "@/components/common";
import { reviewConfig } from "@/services/cms";
import { useTranslation } from "react-i18next";

import './index.less';
const NOTES = [
  "CMS.modals.rejectPublish.quickNotes.inaccurateInfo",
  "CMS.modals.rejectPublish.quickNotes.outdatedContent",
  "CMS.modals.rejectPublish.quickNotes.factualErrors",
  "CMS.modals.rejectPublish.quickNotes.textErrors",
];
const MAX_COMMENT_LENGTH = 1000;

interface RejectModalProps {
    visible: boolean;
    id: number | null;
    oncancel: () => void;
    refresh: () => void;
};

const RejectModal: React.FC<RejectModalProps> = ({
    visible,
    id,
    oncancel,
    refresh,
}) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    // review
    const reviewPage = () => {
      if (!id) return;
      form.validateFields(['approvalComment']).then(() => {
        setLoading(true);
        reviewConfig({
            id,
            status: 10,
            reason: form.getFieldValue('approvalComment')
        }).then(() => {
            CustomMessage.success(t("CMS.common.operationSuccessful"))
            setLoading(false);
            oncancel();
            refresh();
        }).finally(() => {
            setLoading(false);
        })
      })
    };
    return (
        <Modal
            centered
            title={t("CMS.modals.rejectPublish.title")}
            className="reject-modal"
            visible={visible}
            destroyOnClose
            onCancel={oncancel}
            footer={
            <div>
                <CustomButton
                    text={t("common.cancel")}
                    variant="outline"
                    onClick={oncancel}
                />
                <CustomButton
                    loading={loading}
                    text={t("common.confirm")}
                    variant="primary"
                    onClick={reviewPage}
                />
            </div>
            }
        >
        <Form form={form} layout="vertical" className="custom-form reject-form">
          <Form.Item 
            name="approvalComment" 
            label={t("CMS.common.notes")}
            rules={[{ required: true, message: t("CMS.common.requiredField") }]}
          >
            <Input.TextArea
              showCount
              className="custom-textarea"
              placeholder={t("CMS.modals.rejectPublish.reasonPlaceholder")}
              maxLength={MAX_COMMENT_LENGTH}
            />
          </Form.Item>
        </Form>
        <div className="custom-quick-note">
          <p className="note-title">{t("CMS.common.quickNote")}</p>
          <div className="notes-list">
            {NOTES.map((item, idx) => (
              <Tag
                key={`reject-note-${idx}`}
                color="rgba(225, 227, 229, 0.5)"
                className="note-item"
                onClick={() => {
                  const value =
                    (form.getFieldValue("approvalComment") as string) ?? ""
                  const nextValue = value
                    .concat(t(item), ";")
                    .slice(0, MAX_COMMENT_LENGTH)
                  form.setFieldsValue({ approvalComment: nextValue })
                  form.validateFields(["approvalComment"]).catch(() => undefined)
                }}
              >
                {t(item)}
              </Tag>
            ))}
          </div>
        </div>
      </Modal>
  )
};

export default RejectModal;
