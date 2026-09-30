import React, { useState, useEffect, useRef } from "react";
import { Upload, message, Progress, Modal, Tooltip } from "antd";
import {
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd/es/upload/interface";
import { useTranslation } from "react-i18next";
import { fileUpload } from "../../../../../../services/media";
import { ImageBaseUrl } from "../../../../../../utils/url";
import { AuthenticatedDocumentVideo } from "@/components/common/AuthenticatedDocumentMedia";
import "./VideoUploadSetter.less";

const MAX_SIZE_MB = 2048;
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo"];
const ALLOWED_EXTENSIONS = ".mp4,.mov,.avi";

interface VideoUploadSetterProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
}

type UploadStatus = "idle" | "uploading" | "done" | "error";

const getPreviewUrl = (value?: string) =>
  // Accept either full URLs or backend-relative paths and normalize to previewable URL.
  value ? `${ImageBaseUrl}${value.replace(ImageBaseUrl, "")}` : "";

const VideoUploadSetter: React.FC<VideoUploadSetterProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState<string>("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const isMountedRef = useRef(true);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const previewUrl = value ? getPreviewUrl(value) : null;
  // Keep track of component lifecycle to avoid state updates after unmount.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      uploadAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    // Sync UI state from externally controlled field value (e.g. reopening an existing form).
    if (value) {
      setUploadStatus("done");
      if (!fileName) {
        setFileName(t("Video.videoFileFallbackName"));
      }
    }
  }, [value]);

  const beforeUpload: UploadProps["beforeUpload"] = (file) => {
    const isValidType = ALLOWED_TYPES.includes(file.type);
    if (!isValidType) {
      message.error(t("Video.unsupportedFormatsError"));
      return Upload.LIST_IGNORE;
    }

    const isWithinMaxSize = file.size / 1024 / 1024 <= MAX_SIZE_MB;
    if (!isWithinMaxSize) {
      message.error(t("Video.maxSizeError", { maxSizeMb: MAX_SIZE_MB }));
      return Upload.LIST_IGNORE;
    }

    setFileName(file.name);
    setCurrentFile(file);
    return true;
  };

  const uploadByApi = async (
    uploadFile: File,
    callbacks: {
      onProgress?: (event: { percent: number }) => void;
      onSuccess?: (url: string) => void;
      onError?: (error: Error) => void;
    }
  ) => {
    const { onProgress, onSuccess, onError } = callbacks;
    setUploadStatus("uploading");
    setUploadProgress(0);

    try {
      uploadAbortControllerRef.current?.abort();
      const abortController = new AbortController();
      uploadAbortControllerRef.current = abortController;
      // Upload the selected file first, then store the raw file name/path returned by the API.
      const formData = new FormData();
      formData.append("files", uploadFile);

      const res = (await fileUpload(formData, {
        signal: abortController.signal,
        timeout: 0,
      })) as { data?: string[] };
      const uploadedUrl = res?.data?.[0];

      if (!uploadedUrl) {
        throw new Error(t("Video.uploadNoUrlError"));
      }
      if (!isMountedRef.current) return;

      setUploadProgress(100);
      onProgress?.({ percent: 100 });
      // Persist relative path in schema value to keep payload/environment stable.
      const nextValue = uploadedUrl.replace(ImageBaseUrl, "");
      setUploadStatus("done");
      onChange?.(nextValue);
      onSuccess?.(nextValue);
    } catch (error) {
      if (!isMountedRef.current) return;
      if (
        error instanceof Error &&
        (error.name === "CanceledError" || error.name === "AbortError")
      ) {
        return;
      }
      setUploadStatus("error");
      setUploadProgress(0);
      message.error(t("Video.uploadFailed"));
      onError?.(error as Error);
    }
  };

  const customRequest: UploadProps["customRequest"] = async ({
    file,
    onSuccess,
    onProgress,
    onError,
  }) => {
    await uploadByApi(file as File, {
      onProgress: (event) => onProgress?.(event),
      onSuccess: (url) => onSuccess?.(url),
      onError: (error) => onError?.(error),
    });
  };

  const handleRemove = () => {
    setUploadStatus("idle");
    setUploadProgress(0);
    setFileName("");
    setCurrentFile(null);
    onChange?.(undefined);
  };

  const handleCancelUpload = () => {
    uploadAbortControllerRef.current?.abort();
    uploadAbortControllerRef.current = null;
    setUploadStatus("idle");
    setUploadProgress(0);
  };

  const handleRetry = () => {
    if (currentFile) {
      uploadByApi(currentFile, {
        onSuccess: () => {},
        onProgress: () => {},
        onError: () => {},
      });
    }
  };

  const handlePreview = () => {
    setPreviewVisible(true);
  };

  const renderUploadContent = () => {
    switch (uploadStatus) {
      case "idle":
        return (
          <Upload
            accept={ALLOWED_EXTENSIONS}
            beforeUpload={beforeUpload}
            customRequest={customRequest}
            maxCount={1}
            showUploadList={false}
          >
            <div className="upload-btn">
              <UploadOutlined className="upload-icon" />
              <span>{t("Video.uploadFile")}</span>
            </div>
          </Upload>
        );

      case "uploading":
        return (
          <div className="upload-progress-container">
            <div className="file-info">
              <div className="file-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="#d4a853" strokeWidth="1.5" fill="none"/>
                  <rect x="3" y="4" width="18" height="3" stroke="#d4a853" strokeWidth="1.5" fill="none"/>
                  <rect x="3" y="17" width="18" height="3" stroke="#d4a853" strokeWidth="1.5" fill="none"/>
                  <line x1="7" y1="4" x2="7" y2="7" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="12" y1="4" x2="12" y2="7" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="17" y1="4" x2="17" y2="7" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="7" y1="17" x2="7" y2="20" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="12" y1="17" x2="12" y2="20" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="17" y1="17" x2="17" y2="20" stroke="#d4a853" strokeWidth="1.5"/>
                </svg>
              </div>
              <div className="file-name">{fileName}</div>
            </div>
            <div className="progress-section">
              <Progress
                percent={Math.round(uploadProgress)}
                strokeColor="#d4a853"
                trailColor="#f5f5f5"
                showInfo={false}
                size="small"
              />
            </div>
            <Tooltip title={t("Video.cancel")}>
              <CloseCircleOutlined
                className="cancel-icon"
                onClick={handleCancelUpload}
              />
            </Tooltip>
          </div>
        );

      case "done":
        return (
          <div className="upload-done-container">
            <div className="file-info">
              <div className="file-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="#d4a853" strokeWidth="1.5" fill="none"/>
                  <rect x="3" y="4" width="18" height="3" stroke="#d4a853" strokeWidth="1.5" fill="none"/>
                  <rect x="3" y="17" width="18" height="3" stroke="#d4a853" strokeWidth="1.5" fill="none"/>
                  <line x1="7" y1="4" x2="7" y2="7" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="12" y1="4" x2="12" y2="7" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="17" y1="4" x2="17" y2="7" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="7" y1="17" x2="7" y2="20" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="12" y1="17" x2="12" y2="20" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="17" y1="17" x2="17" y2="20" stroke="#d4a853" strokeWidth="1.5"/>
                </svg>
              </div>
              <div className="file-name">{fileName}</div>
            </div>
            <div className="action-icons">
              <Tooltip title={t("Video.preview")}>
                <EyeOutlined className="action-icon preview" onClick={handlePreview} />
              </Tooltip>
              <Tooltip title={t("Video.delete")}>
                <DeleteOutlined className="action-icon delete" onClick={handleRemove} />
              </Tooltip>
            </div>
          </div>
        );

      case "error":
        return (
          <div className="upload-error-container">
            <div className="file-info">
              <div className="file-icon error">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="#d4a853" strokeWidth="1.5" fill="none"/>
                  <rect x="3" y="4" width="18" height="3" stroke="#d4a853" strokeWidth="1.5" fill="none"/>
                  <rect x="3" y="17" width="18" height="3" stroke="#d4a853" strokeWidth="1.5" fill="none"/>
                  <line x1="7" y1="4" x2="7" y2="7" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="12" y1="4" x2="12" y2="7" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="17" y1="4" x2="17" y2="7" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="7" y1="17" x2="7" y2="20" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="12" y1="17" x2="12" y2="20" stroke="#d4a853" strokeWidth="1.5"/>
                  <line x1="17" y1="17" x2="17" y2="20" stroke="#d4a853" strokeWidth="1.5"/>
                </svg>
              </div>
              <div className="file-name">{fileName}</div>
            </div>
            <div className="action-icons">
              <Tooltip title={t("Video.retry")}>
                <ReloadOutlined className="action-icon retry" onClick={handleRetry} />
              </Tooltip>
              <Tooltip title={t("Video.delete")}>
                <DeleteOutlined className="action-icon delete" onClick={handleRemove} />
              </Tooltip>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="video-upload-setter">
      {renderUploadContent()}
      
      {uploadStatus === "error" && (
        <div className="error-message">
          <WarningOutlined /> {t("Video.uploadFailed")}
        </div>
      )}
      
      <div className="upload-hint">
        {t("Video.uploadHint", { maxSizeMb: MAX_SIZE_MB })}
      </div>

      <Modal
        visible={previewVisible}
        title={t("Video.videoPreviewModalTitle")}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={800}
        centered
        destroyOnClose
      >
        {previewUrl && (
          <AuthenticatedDocumentVideo
            src={previewUrl}
            controls
            autoPlay
            style={{ width: "100%", maxHeight: "500px" }}
          />
        )}
      </Modal>
    </div>
  );
};

export default VideoUploadSetter;
