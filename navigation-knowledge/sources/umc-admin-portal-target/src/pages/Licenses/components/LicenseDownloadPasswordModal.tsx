import { useState } from "react";
import { Modal, Input } from "antd";
import { DownloadOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { CustomMessage } from "@/components/common";
import CustomButton from "@/components/common/CustomButton";
import request from "@/utils/request";
import { getAllowedOrigins } from "@/utils/allowedOrigins";
import { DocumentPreview } from "@/utils/url";
import "./LicenseDownloadPasswordModal.less";

const DOCUMENT_DOWNLOAD_PATH = /^\/api\/Document\/(?:Dowload|Download)$/i;
const PDF_PREVIEW_PATH = /^\/api\/pdf\/preview$/i;

const getEndpointFileName = (value: string) => {
  try {
    const parsedUrl = new URL(value, window.location.origin);
    if (!DOCUMENT_DOWNLOAD_PATH.test(parsedUrl.pathname) && !PDF_PREVIEW_PATH.test(parsedUrl.pathname)) {
      return "";
    }

    return parsedUrl.searchParams.get("fileName")?.trim() || "";
  } catch {
    return "";
  }
};

const isSpecialBrowserUrl = (value: string) => /^(?:blob|data):/i.test(value);
const isAbsoluteUrl = (value: string) => /^[a-z][a-z0-9+.-]*:/i.test(value);

const buildPdfPreviewUrl = (filePath: string) => (
  `${DocumentPreview}${encodeURIComponent(filePath.replace(/^\/+/, ""))}`
);

const getApiBaseOrigins = () => {
  return getAllowedOrigins(window.location.origin, [
    import.meta.env.VITE_IMG_BASE_URL,
    import.meta.env.VITE_API_BASE_URL,
    import.meta.env.VITE_ALLOWED_DOCUMENT_ORIGINS,
  ]);
};

const getLicenseFilePath = (value: string) => {
  const endpointFileName = getEndpointFileName(value);
  if (endpointFileName) return endpointFileName;

  if (!isAbsoluteUrl(value)) return value;

  try {
    const parsedUrl = new URL(value);
    if (getApiBaseOrigins().has(parsedUrl.origin)) {
      return `${parsedUrl.pathname}${parsedUrl.search}`;
    }
  } catch {
    return value;
  }

  return value;
};

const resolveLicensePdfDownloadUrl = (value?: string) => {
  const rawUrl = String(value || "").trim();
  if (!rawUrl || isSpecialBrowserUrl(rawUrl)) return rawUrl;

  const filePath = getLicenseFilePath(rawUrl);
  if (!filePath) return "";
  if (isAbsoluteUrl(filePath)) return filePath;

  return buildPdfPreviewUrl(filePath);
};

const decodeFileName = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const ensurePdfFileName = (value?: string) => {
  const name = String(value || "license").trim() || "license";
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
};

const getDownloadFileName = (value?: string, fallbackName?: string) => {
  const rawUrl = String(value || "").trim();
  if (!rawUrl) return "";
  if (isSpecialBrowserUrl(rawUrl)) return ensurePdfFileName(fallbackName);

  const filePath = getLicenseFilePath(rawUrl);
  if (!filePath) return "";

  try {
    const parsedUrl = new URL(filePath, window.location.origin);
    const name = parsedUrl.pathname.split("/").filter(Boolean).pop() || "";
    return decodeFileName(name.trim());
  } catch {
    const name = filePath.split(/[?#]/)[0].split("/").filter(Boolean).pop() || "";
    return decodeFileName(name.trim());
  }
};

const triggerDownload = (downloadUrl: string, fileName: string) => {
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const parseJsonBlobError = async (blob: Blob) => {
  if (!blob.type.includes("application/json")) return;

  const text = await blob.text();
  if (!text) return;

  try {
    const payload = JSON.parse(text) as { isSuccess?: boolean; message?: string };
    if (payload.isSuccess === false || payload.message) {
      throw new Error(payload.message || "File download failed.");
    }
  } catch (error) {
    if (error instanceof Error) throw error;
  }
};

const downloadLicensePdfFile = async (fileUrl: string, fileName: string) => {
  const downloadUrl = resolveLicensePdfDownloadUrl(fileUrl);
  if (!downloadUrl) return false;

  if (isSpecialBrowserUrl(downloadUrl)) {
    triggerDownload(downloadUrl, fileName);
    return true;
  }

  const blob = await request.get<Blob, Blob>(downloadUrl, undefined, {
    responseType: "blob",
    skipErrorMessage: true,
  });
  await parseJsonBlobError(blob);

  const blobUrl = URL.createObjectURL(blob);
  try {
    triggerDownload(blobUrl, fileName);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  return true;
};

interface Props {
  url: string;
  visible: boolean;
  password: string;
  fileName: string;
  cancle: () => void;
}

const LicenseDownloadPasswordModal: React.FC<Props> = ({
  visible,
  cancle,
  url,
  password,
  fileName,
}) => {
  const { t } = useTranslation();
  const [downloadLoading, setDownloadLoading] = useState(false);

  const copyPassword = () => {
    const ele = document.createElement("input");
    ele.value = password;
    document.body.appendChild(ele);
    ele.select();
    document.execCommand("copy");
    document.body.removeChild(ele);
  };

  const copyAndDownload = async () => {
    if (downloadLoading) return;

    copyPassword();
    setDownloadLoading(true);
    try {
      const downloadFileName = getDownloadFileName(url, fileName);
      if (!downloadFileName) {
        CustomMessage.warning(t("Licensing.documentDownload.downloadUnavailable"));
        return;
      }

      const downloaded = await downloadLicensePdfFile(url, downloadFileName);
      if (!downloaded) {
        CustomMessage.warning(t("Licensing.documentDownload.downloadUnavailable"));
      }
    } catch {
      CustomMessage.warning(t("Licensing.documentDownload.downloadFailed"));
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onCancel={cancle}
      footer={null}
      width={"40rem"}
      centered
      destroyOnClose
      className="license-download-password-modal"
      maskClosable
    >
      <div className="document-down">
        <div className="_down-icon">
          <DownloadOutlined />
        </div>
        <div className="_down-title">
          {t("Licensing.documentDownload.title")}
        </div>
        <div className="_down-tips">
          {t("Licensing.documentDownload.subtitle")}
        </div>
        <div className="_down-password">
          <div className="_label">
            {t("Licensing.documentDownload.passwordLabel")}
          </div>
          <Input.Password value={password} readOnly />
        </div>
        <div className="_down-note">
          <div className="_icon">
            <ExclamationCircleOutlined />
          </div>
          <div className="_note">
            <div className="_title">
              {t("Licensing.documentDownload.noteTitle")}
            </div>
            <div className="_text">
              {t("Licensing.documentDownload.noteBody")}
            </div>
          </div>
        </div>
        <div className="_down-btn">
          <CustomButton
            text={
              downloadLoading
                ? t("Licensing.documentDownload.downloading")
                : t("Licensing.documentDownload.copyRedirect")
            }
            variant="primary"
            loading={downloadLoading}
            disabled={downloadLoading}
            onClick={() => {
              void copyAndDownload();
            }}
          />
        </div>
      </div>
    </Modal>
  );
};

export default LicenseDownloadPasswordModal;
