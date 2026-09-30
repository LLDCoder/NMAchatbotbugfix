import { Modal, Form, Select, Input } from "antd";
import './index.less'
import { useEffect, useState } from "react";
import { getCertificateDisableReason, type IDict } from "@/services/dictionary";
import { useTranslation } from "react-i18next";
import { postUpdateCertificateStatus, type LicenseManagementListResponseDto } from "@/services/license";
import { CustomButton, CustomMessage } from "@/components/common";


interface ModalData {
  visible: boolean;
  cencelFun: () => void;
  row: LicenseManagementListResponseDto;
  onOk?: () => void;
  confirmPermissionCode?: string;
  permissionRoutePath?: string;
}

export default function DisableLicenseModal({
  visible,
  cencelFun,
  row,
  onOk,
}: ModalData) {
  const { i18n, t } = useTranslation();
  const isArabic = i18n.language?.startsWith("ar");
  const [form] = Form.useForm();
  const [,update] = useState({});
  const disabledReason = Form.useWatch("disabledReason", form);
  const [reasonOpts, setReasonOtps] = useState<IDict[]>([]);
  useEffect(() => { 
    getCertificateDisableReason().then(res => { 
      if(res.data){
        setReasonOtps(res.data);
      }
    })
  }, []);
  
  async function handleOk(){
    const values = await form.validateFields();

    try{
      await postUpdateCertificateStatus({
        certificateId: row.id,
        status: '204',
        disabledReason: values.disabledReason,
        remarks: values.remarks,
      });
      onOk?.();
      cencelFun();
      CustomMessage.success(t("common.operationSuccess"));
    }catch{
      CustomMessage.error(t("common.operationFailed"));
    }
  }
  return <Modal
    centered
    title={t("Licensing.disableModal.title")}
    visible={visible}
    onCancel={() => {
      cencelFun()
    }}
    width={'40rem'}
    footer={
      <div>
        <CustomButton
          text={t("Licensing.modal.cancel")}
          variant="outline"
          onClick={cencelFun}
        />
        <CustomButton
          text={t("Licensing.modal.confirm")}
          variant="primary"
          disabled={!disabledReason}
          onClick={handleOk}
        />
      </div>
    }
    className={`disable-license${isArabic ? " disable-license--rtl" : ""}`}
    destroyOnClose
  >
    <Form form={form} className="custorm-form" layout="vertical" preserve={false} onValuesChange={() =>  update({})} >
      <Form.Item name="disabledReason" label={t("Licensing.disableModal.disabledReasonLabel")} required>
        <Select placeholder={t("Licensing.disableModal.selectReasonPlaceholder")}>
          {reasonOpts.map((item) => (
            <Select.Option key={item.id} value={item.code}>{i18n.resolvedLanguage === 'en' ? item.nameEn : item.nameAr}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item className="notes-form-item" name="remarks" label={t("Licensing.disableModal.notesLabel")}>
        <Input.TextArea maxLength={1000} placeholder={t("Licensing.disableModal.remarksPlaceholder")} />
      </Form.Item>
      <div className="note-length-tip">
        {t("Licensing.disableModal.charCount", {
          current: form.getFieldValue("remarks")?.length ?? 0,
          max: 1000,
        })}
      </div>
    </Form>
  </Modal>
}
