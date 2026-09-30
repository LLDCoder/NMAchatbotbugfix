import { Form, Input, Modal } from "antd";
import './index.less';
import { useTranslation } from "react-i18next";
import DocumentViewer from "@/components/common/DocumentViewer";
import { CustomButton, CustomMessage } from "@/components/common";
import { useEffect, useState } from "react";
import { postProcessedTransfer } from "@/services/tickets";


interface ITransferModalProps{
    visible: boolean;
    onCancel: () => void;
    row: {
        id: number;
    };
    onSave: () => void;
    confirmPermissionCode?: string;
    permissionRoutePath?: string;
}

export default function TransferModal({
    visible,
    onCancel,
    row,
    onSave,
    confirmPermissionCode,
    permissionRoutePath,
}:ITransferModalProps){
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [,update] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(()=>{
        if(visible){
            form.resetFields();
        }
    },[visible]);
    async function handleSave(){
        try{
            setLoading(true);
            const values = await form.validateFields();
            const data = {
                enquiryStatusId: 4,
                note: values.notes,
                attachmentUrls: Array.isArray(values.attachmentUrls) ? values.attachmentUrls : (values.attachmentUrls ? [values.attachmentUrls] : [])
            }
            const res = await postProcessedTransfer(row.id, data);
            if(res.data){
                CustomMessage.success(t("common.operationSuccess"));
                onSave();
                onCancel();
            }else{
                CustomMessage.error(t("common.operationFailed"));
            }
        }finally{
            setLoading(false);
        }
    }
    return <Modal
        centered
        className="transfer" 
        title={t("Customer.tickets.actions.transfer")} 
        footer={<div className="transfer-notes"> 
            <CustomButton text={t("common.cancel")} variant="outline" onClick={onCancel}  />
            <CustomButton
                loading={loading}
                onClick={handleSave}
                disabled={!form.getFieldValue('notes')}
                text={t("common.confirm")}
                permissionCode={confirmPermissionCode}
                permissionRoutePath={permissionRoutePath}
            />
        </div>} 
        visible={visible}
        onCancel={onCancel}
     >
        <Form form={form} onValuesChange={()=>update({})} layout="vertical" className="custorm-form">
            <Form.Item name="notes" label={t("Customer.tickets.common.notes")} required rules={[
                {required: true, message: t("common.required")}
            ]}>
                <Input.TextArea placeholder={t("Customer.tickets.common.enterNotes")} className="transfer-notes" rows={4} />
            </Form.Item>
            <Form.Item label={t("Customer.tickets.addModal.attachments")} name="attachmentUrls">
                <DocumentViewer
                    hasDelete
                    uploadConfig={{
                        maxCount: 3,
                        maxSize: 5,
                        uploadTip: "Maximum size: 5MB. File types: jpg, jpeg, and png.",
                    }}
                />
            </Form.Item>
        </Form>
    </Modal>
}
