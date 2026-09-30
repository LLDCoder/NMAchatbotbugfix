import { useState, useEffect } from "react";
import { Modal, Form, Select, Input, message } from "antd";
import DocumentViewer from "@/components/common/DocumentViewer";
import CustomButton from "@/components/common/CustomButton";
import { useTranslation } from "react-i18next";
import { getProblemCauses, postProcess } from "@/services/tickets";
import AttachmentFormLabel from "../AttachmentFormLabel";
import { isArabicLanguage } from "@/localization/language";
import "./index.less";



interface ProcessModalProps {
    visible: boolean;
    row: any;
    onCancel: () => void;
    onSave: (values: any) => void;
}
export default function  ProcessModal(params:ProcessModalProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { visible, row, onCancel, onSave } = params;
    const [problemCauseOptions, setProblemCauseOptions] = useState<Array<any>>([]);
    const { t, i18n } = useTranslation();
    const problemCauseId = Form.useWatch("problemCauseId", form);
    const note = Form.useWatch("note", form);
    const submitDisabled = !problemCauseId || !String(note ?? "").trim();
    useEffect(()=>{
        getProblemCauses().then((res)=>{
            if(Array.isArray(res.data)){
                setProblemCauseOptions(res.data.map(item => ({
                    value: item.id,
                    label: isArabicLanguage(i18n.language)
                        ? item.nameAr || item.nameEn
                        : item.nameEn || item.nameAr,
                })));
            }
        });
    },[i18n.language]);
    useEffect(()=>{
        if(visible){
            form.resetFields();
        }
    },[visible]);
    const handleSave = async () => {
        if (loading) {
            return;
        }
        let values: Record<string, unknown> = {};
        try {
            values = await form.validateFields();
        } catch {
            return;
        }
        setLoading(true);
        try {
            const res:any = await postProcess(row.id, {
                ...values,
                departmentProcessTypeId: 1,
                attachmentUrls: (typeof values.attachmentUrls === "string") ? [values.attachmentUrls] : values.attachmentUrls,
            });
            if (res.statusCode === 200){
                message.success(t("Customer.tickets.processModal.processSuccess"));
            }else{
                message.error(t("Customer.tickets.processModal.processFailed"));
            }
            onSave(values);
            onCancel();
        } catch {
            message.error(t("Customer.tickets.processModal.processFailed"));
        } finally {
            setLoading(false);
        }
    };



    return <Modal
            centered
            className="process-modal"
            title={t("Customer.tickets.processModal.title")}
            visible={visible}
            onCancel={onCancel}
            footer={
                <div className="transfer-notes">
                    <CustomButton text={t("common.cancel")} variant="outline" onClick={onCancel} />
                    <CustomButton
                        loading={loading}
                        disabled={submitDisabled}
                        onClick={handleSave}
                        text={t("common.confirm")}
                    />
                </div>
            }
        >
        <Form form={form} layout="vertical">
            <Form.Item label={t("Customer.tickets.processModal.problemCause")} name="problemCauseId" required rules={[
                { required: true, message: t("Customer.tickets.processModal.pleaseSelectProblemCause") }
            ]}> 
                <Select
                    placeholder={t("Customer.tickets.processModal.selectProblemCause")}
                    allowClear
                >
                    {problemCauseOptions.map(item => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
                    </Select>
            </Form.Item>
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
            <Form.Item label={t("Customer.tickets.processModal.resolutionDescription")} required rules={[
                { required: true, message: t("Customer.tickets.processModal.pleaseEnterResolutionDescription") }
            ]} name="note">
                <Input.TextArea
                    className="process-modal-resolution"
                    placeholder={t("Customer.tickets.processModal.enterResolutionDescription")}
                    rows={4}
                    maxLength={1000}
                    showCount
                />
            </Form.Item>
        </Form>
    </Modal>
};
