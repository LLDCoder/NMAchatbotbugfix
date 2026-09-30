import React, { useEffect, useMemo, useState } from "react";
import { Modal, Input, Button, Spin } from "antd";
import DownloadIcon from "@/assets/images/Download.svg";
import {
  MinusOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { PasswordResponses } from "pdfjs-dist";
import { useTranslation } from "react-i18next";
import PdfScrollPreview from "@/components/common/PdfScrollPreview";
import { useAuthenticatedDocumentSource } from "@/hooks/useAuthenticatedDocumentUrl";
import {
  isPdfFile,
  resolveDocumentAccessUrl,
  resolvePdfPreviewUrl,
} from "@/utils/pdfPreview";
import "./index.less";

export interface PreviewModalProps {
  fileData: { url: string; name: string; filePath?: string };
  visible: boolean;
  onCancel: () => void;
  onDownload?: (fileData: { url: string; name: string; filePath?: string }) => void | Promise<void>;
  password?: string;
}

const PreviewModal: React.FC<PreviewModalProps> = ({
  fileData,
  visible,
  onCancel,
  onDownload,
  password,
}) => {
  const { t } = useTranslation();
  const [scale, setScale] = useState(100);
  const previewUrl = String(fileData.url ?? "").trim();
  const isPdf = useMemo(
    () => (
      isPdfFile(fileData.name) ||
      isPdfFile(fileData.filePath) ||
      isPdfFile(fileData.url)
    ),
    [fileData.filePath, fileData.name, fileData.url],
  );

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordCallback, setPasswordCallback] = useState<
    ((password: string) => void) | null
  >(null);

  const pdfPreviewUrl = useMemo(
    () => resolvePdfPreviewUrl(previewUrl, fileData.filePath),
    [fileData.filePath, previewUrl],
  );
  const imageAccessUrl = useMemo(
    () => (isPdf ? "" : resolveDocumentAccessUrl(previewUrl)),
    [isPdf, previewUrl],
  );
  // Native <img> and pdf.js loading cannot attach the bearer token, so protected
  // documents are streamed through the authenticated client as object URLs.
  const authenticatedPdf = useAuthenticatedDocumentSource(pdfPreviewUrl);
  const authenticatedImage = useAuthenticatedDocumentSource(imageAccessUrl);
  const activePreview = isPdf ? authenticatedPdf : authenticatedImage;
  const previewSource = activePreview.source;
  const previewData = isPdf ? authenticatedPdf.data : undefined;
  const isPreviewLoading = activePreview.status === "loading";
  const hasPreviewSource = Boolean(previewSource);

  useEffect(() => {
    setScale(100);
    setPasswordVisible(false);
    setPdfPassword("");
    setPasswordError("");
    setPasswordCallback(null);
  }, [visible]);

  useEffect(() => {
    if (password && passwordCallback) {
      passwordCallback(password);
    }
  }, [password, passwordCallback]);

  const handleDocumentLoadSuccess = () => {
    setPasswordVisible(false);
    setPdfPassword("");
    setPasswordError("");
    setPasswordCallback(null);
  };

  const handlePasswordRequest = (
    callback: (password: string) => void,
    reason: number,
  ) => {
    if (reason === PasswordResponses.INCORRECT_PASSWORD) {
      setPasswordError(t("sharedComponents.previewModal.password.incorrect"));
    }

    if (reason === PasswordResponses.NEED_PASSWORD) {
      setPasswordError("");
    }

    setPasswordCallback(() => callback);
    setPasswordVisible(true);
  };

  const handlePasswordSubmit = () => {
    if (!pdfPassword.trim()) {
      setPasswordError(t("sharedComponents.previewModal.password.required"));
      return;
    }

    if (passwordCallback) {
      setPasswordError("");
      passwordCallback(pdfPassword);
    }
  };

  const handlePasswordCancel = () => {
    setPasswordVisible(false);
    setPdfPassword("");
    setPasswordError("");
    setPasswordCallback(null);
    onCancel();
  };

  const handlePreviewCancel = () => {
    setPasswordVisible(false);
    setPdfPassword("");
    setPasswordError("");
    setPasswordCallback(null);
    onCancel();
  };

  const handleZoomOut = () => {
    setScale((currentScale) => Math.max(50, currentScale - 10));
  };

  const handleZoomIn = () => {
    setScale((currentScale) => Math.min(200, currentScale + 10));
  };

  const handleDownload = () => {
    if (onDownload) {
      void onDownload(fileData);
      return;
    }

    const downloadUrl = resolveDocumentAccessUrl(previewUrl);
    if (!downloadUrl) return;

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileData.name || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Modal
        visible={visible}
        onCancel={handlePreviewCancel}
        className="preview-modal"
        footer={null}
        destroyOnClose
        centered
        closable
        width="100vw"
      >
        {hasPreviewSource && isPdf ? (
          <div className="preview-modal__modal-actions">
            <img
              src={DownloadIcon}
              alt={t("common.download")}
              title={t("common.download")}
              className="preview-modal__pdf-download"
              onClick={handleDownload}
            />
          </div>
        ) : null}
        <div className="preview-modal__layout">
          {hasPreviewSource ? (
            isPdf ? (
              <div className="preview-modal__frame preview-modal__frame--pdf">
                <PdfScrollPreview
                file={previewSource}
                  data={previewData}
                  scale={scale}
                  className="preview-modal__pdf-preview"
                  onDocumentLoadSuccess={handleDocumentLoadSuccess}
                  onPassword={handlePasswordRequest}
                />
                <div className="pdf-preview-toolbar">
                  <MinusOutlined
                    className={`pdf-preview-toolbar__button ${scale <= 50 ? "is-disabled" : ""}`}
                    onClick={scale <= 50 ? undefined : handleZoomOut}
                  />
                  <span className="pdf-preview-toolbar__value">{scale}%</span>
                  <PlusOutlined
                    className={`pdf-preview-toolbar__button ${scale >= 200 ? "is-disabled" : ""}`}
                    onClick={scale >= 200 ? undefined : handleZoomIn}
                  />
                </div>
              </div>
            ) : (
              <div className="preview-modal__frame preview-modal__frame--image">
                <div className="preview-modal__image-shell">
                  <img
                    className="preview-modal__image"
                    src={previewSource}
                    alt={fileData.name}
                  />
                </div>
              </div>
            )
          ) : isPreviewLoading ? (
          <div className="preview-modal__frame preview-modal__frame--empty">
          <div className="preview-modal__loading">
          <Spin />
          <div className="preview-modal__loading-copy">
          {t("sharedComponents.previewModal.loading.description")}
          </div>
          </div>
          </div>
          ) : (
          <div className="preview-modal__frame preview-modal__frame--empty">
          <div className="preview-modal__unavailable">
          <div className="preview-modal__unavailable-card">
          <div className="preview-modal__unavailable-title">
            {t("sharedComponents.previewModal.unavailable.title")}
          </div>
          <div className="preview-modal__unavailable-copy">
            {t("sharedComponents.previewModal.unavailable.description")}
          </div>
          </div>
          </div>
          </div>
          )}
        </div>
      </Modal>

      {!password && (
        <Modal
          className="preview-password-modal"
          visible={passwordVisible}
          onCancel={handlePasswordCancel}
          footer={null}
          centered
          destroyOnClose
          zIndex={1001}
          closable={false}
          maskClosable={false}
        >
          <div className="preview-password-modal__body">
            <div className="preview-password-modal__copy">
              <h3 className="preview-password-modal__title">
                {t("sharedComponents.previewModal.password.title")}
              </h3>
              <div className="preview-password-modal__message">
                {t("sharedComponents.previewModal.password.description")}
              </div>
              <Input.Password
                value={pdfPassword}
                onChange={(e) => {
                  setPdfPassword(e.target.value);
                  if (passwordError) {
                    setPasswordError("");
                  }
                }}
                onPressEnter={handlePasswordSubmit}
                placeholder={t("sharedComponents.previewModal.password.placeholder")}
                autoFocus
                status={passwordError ? "error" : undefined}
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? "preview-password-modal-error" : undefined}
                className="preview-password-modal__input"
              />
              {passwordError ? (
                <div
                  id="preview-password-modal-error"
                  className="preview-password-modal__error"
                >
                  {passwordError}
                </div>
              ) : null}
            </div>
            <div className="preview-password-modal__actions">
              <Button
                className="preview-password-modal__action preview-password-modal__action--secondary"
                onClick={handlePasswordCancel}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="preview-password-modal__action preview-password-modal__action--primary"
                onClick={handlePasswordSubmit}
              >
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default PreviewModal;
