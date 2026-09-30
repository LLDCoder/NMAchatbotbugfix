import { Modal, Form, Select, Input } from "antd";
import { useTranslation } from "react-i18next";
import './index.less'


interface ModalData {
  visible: boolean;
  cencelFun: Function;
  src: string;
}

export default function FilePassword({visible, cencelFun, src}: ModalData) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  console.log(visible);
  return <Modal
    centered
    title={<div className="file-down_title">
      <div>{t("Licensing.documentDownload.title")}</div>
      <div className="_tips">
        {t("Licensing.documentDownload.subtitle")}
      </div>
    </div>}
    visible={visible}
    className="file-password"
    onCancel={() => {
      cencelFun()
    }}
    width={'40rem'}
    okText={t("common.confirm")}
    cancelText={t("common.cancel")}
    destroyOnClose
  >
    <Form form={form} layout="vertical" >
      <Form.Item label={t("Licensing.documentDownload.passwordLabel")}>
        <Input.Password  />
      </Form.Item>
    </Form>
  </Modal>
}
