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
      CustomMessage.success(t("Content.permits.messages.disableSuccess"));
    }catch{
      CustomMessage.error(t("Content.permits.messages.disableFailed"));
    }
  }
  return <Modal
    centered
    title={t("Content.permits.modals.disableTitle")}
    visible={visible}
    onCancel={() => {
      cencelFun()
    }}
    width={'40rem'}
    footer={
      <div>
        <CustomButton
          text={t("common.cancel")}
          variant="outline"
          onClick={cencelFun}
        />
        <CustomButton
          text={t("common.confirm")}
          variant="primary"
          disabled={!disabledReason}
          onClick={handleOk}
        />
      </div>
    }
    className={`disable-license${isArabic ? " disable-license--rtl" : ""}`}
    destroyOnClose
  >
    <Form form={form} className="custorm-form" layout="vertical" preserve={false}>
      <Form.Item name="disabledReason" label={t("Content.permits.modals.disableReason")} required>
        <Select placeholder={t("Content.permits.modals.selectDisableReason")}>
          {reasonOpts.map((item) => (
            <Select.Option key={item.id} value={item.code}>{i18n.resolvedLanguage === 'en' ? item.nameEn : item.nameAr}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item className="notes-form-item" name="remarks" label={t("Content.permits.modals.notes")}>
        <Input.TextArea maxLength={1000} showCount placeholder={t("Content.permits.modals.disableReasonPlaceholder")} />
      </Form.Item>
    </Form>
  </Modal>
}
