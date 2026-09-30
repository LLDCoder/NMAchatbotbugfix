import { Modal, Input } from "antd";
import { useState } from "react";
import CustomButton from "@/components/common/CustomButton";
import { DownloadOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { CustomMessage } from "@/components/common";
import { downloadDocumentFile } from "@/services/media";
import "./index.less";
import { useTranslation } from "react-i18next";
interface Props {
  code?: string;
  url: string;
  visible: boolean;
  password: string;
  fileName: string;
  cancle: () => void;
}
// P8 Plan A: downloads served same-origin through the gateway.
const baseUrl = window.location.origin;

const DocumentDown: React.FC<Props> = ({
  visible,
  cancle,
  url,
  password,
  fileName,
}) => {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);

  const copyPassword = () => {
    const ele = document.createElement("input");
    ele.value = password;
    document.body.appendChild(ele);
    ele.select();
    document.execCommand("copy");
    document.body.removeChild(ele);
  };

  // Native navigation cannot attach the bearer token, so the protected preview
  // endpoint is streamed through the authenticated client instead.
  const handleDownload = async () => {
    copyPassword();

    const fileReference = String(url ?? "").trim();
    if (!fileReference || isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadDocumentFile(
        `${baseUrl}/api/pdf/preview?fileName=${encodeURIComponent(fileReference)}`,
        `${fileName || "document"}.pdf`,
      );
    } catch {
      CustomMessage.error(t("sharedComponents.previewModal.unavailable.title"));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onCancel={() => {
        cancle();
      }}
      footer={null}
      width={"40rem"}
      className="DocumentDown"
      centered
    >
      <div className="document-down">
        <div className="_down-icon">
          <DownloadOutlined />
        </div>
        <div className="_down-title">{t("Content.permits.documentDown.filePassword")}</div>
        <div className="_down-tips">{t("Content.permits.documentDown.licenseTypeTips")}</div>
        <div className="_down-password">
          <div className="_label">{t("Content.permits.documentDown.password")}</div>
          <Input.Password value={password} />
        </div>
        <div className="_down-note">
          <div className="_icon">
            <ExclamationCircleOutlined />
          </div>
          <div className="_note">
            <div className="_title">{t("Content.permits.documentDown.note")}</div>
            <div className="_text">
              {t("Content.permits.documentDown.noteText")}
            </div>
          </div>
        </div>
        <div className="_down-btn">
        <CustomButton
        text={t("Content.permits.documentDown.copyPasswordRedirect")}
        variant="primary"
        disabled={isDownloading}
        onClick={() => {
        void handleDownload();
        }}
        />
        </div>
      </div>
    </Modal>
  );
};

export default DocumentDown;
