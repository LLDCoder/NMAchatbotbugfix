import { useEffect, useState } from "react";
import { Modal, Form, Input, message } from "antd";
import { postProcess } from "@/services/tickets";
import { useTranslation } from "react-i18next";
import DocumentViewer from "@/components/common/DocumentViewer";
import { CustomButton } from "@/components/common";
import AttachmentFormLabel from "../AttachmentFormLabel";

import "./index.less";

interface SendBackModalProps {
    visible: boolean;
    row: any;
    onCancel: () => void;
    onSave: (values: any) => void;
}



export default function SendBackModal(params: SendBackModalProps) {
    const { visible, row, onCancel, onSave } = params;
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    useEffect(()=>{
        if(visible){
            form.resetFields();
        }
    },[visible]);

    const handleCancel = () => {
        setLoading(false);
        onCancel();
    }

    const handleSave = async () => {
        const values = await form.validateFields();
        setLoading(true);

        try {
            const res:any = await postProcess(row.id, {
                ...values,
                departmentProcessTypeId: 2,
                attachmentUrls: (typeof values.attachmentUrls === "string") ? [values.attachmentUrls] : values.attachmentUrls,
            });
            if (res.statusCode === 200){
                message.success(t("Customer.tickets.sendBackModal.sendBackSuccess"));
            }else{
                message.error(t("Customer.tickets.sendBackModal.sendBackFailed"));
            }
            onSave(values);
            handleCancel();
        } finally {
            setLoading(false);
        }
    }

    return  <Modal
        centered
        className="send-back-modal"
        title={t("Customer.tickets.actions.sendBack")}
        visible={visible}
        onCancel={handleCancel}
        afterClose={() => setLoading(false)}
        footer={<div className="transfer-notes">
            <CustomButton text={t("common.cancel")} variant="outline" onClick={handleCancel} />
            <CustomButton
                loading={loading}
                onClick={handleSave}
                text={t("common.confirm")}
            />
        </div>} 
    >
        <Form form={form} layout="vertical">
            
            <Form.Item label={<AttachmentFormLabel />} name="attachmentUrls">
                <DocumentViewer
                    hasDelete
                    uploadConfig={{
                        maxCount: 3,
                        maxSize: 5,
                        uploadTip: "",
                    }}
                />
            </Form.Item>
            <Form.Item name="note" label={t("Customer.tickets.common.notes")} required rules={[
                { required: true, message: t("Customer.tickets.common.pleaseEnterNotes") }
            ]}>
                <Input.TextArea
                    placeholder={t("Customer.tickets.common.enterNotes")}
                    className="transfer-notes"
                    rows={4}
                    maxLength={1000}
                    showCount
                />
            </Form.Item>
        </Form>
    </Modal>
}
