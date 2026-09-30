import React, { useEffect, useRef, useState } from "react";
import { Upload, Input } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import UploadCloud from "@/assets/images/uploadCloud.png";
import DisableUploadCloud from "@/assets/images/disableUploadCloud.svg";
import FileJpg from "@/assets/images/FileJpg.svg";
import "./index.less";
import CustomMessage from "../CustomMessage";
import type { RcFile, UploadFile } from "antd/lib/upload";
import { useTranslation } from "react-i18next";

export interface FileItem {
  id?: string;
  url: string;
  name: string;
}

interface FileUploadProps {
  value?: FileItem[];
  onChange?: (files: FileItem[]) => void;
  maxCount?: number;
  maxSize?: number; // MB
  accept?: string;
  placeholder?: string;
  uploadTip?: string;
  customRequest: (options: any) => void;
  disabled?: boolean;
  isSingle?: boolean;
  beforeUpload?: (file: RcFile) => boolean;
  onProgress?: (percent: number) => void;
  maxSizeErrorMessage?: string;
  hideFileList?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  value = [],
  onChange,
  maxCount = 3,
  maxSize = 5,
  accept = ".jpg,.jpeg,.png,.pdf",
  placeholder,
  uploadTip,
  customRequest,
  disabled = false,
  isSingle = false,
  beforeUpload,
  onProgress,
  maxSizeErrorMessage,
  hideFileList = false,
}) => {
  const { t } = useTranslation();
  const fileList = value;
  const fileListRef = useRef(fileList);
  const uploadFileList: UploadFile[] = fileList.map((file, index) => ({
    uid: `${file.url}-${index}`,
    name: file.name,
    status: "done",
    url: file.url,
  }));
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressTimer, setProgressTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const fileTypes = accept
    .split(",")
    .map((item) => item.replace(".", "").trim())
    .filter(Boolean)
    .join(", ");
  const resolvedPlaceholder = placeholder || t("common.uploadFile");
  const resolvedUploadTip =
    uploadTip === undefined
      ? t("common.uploadTip", {
          maxSize,
          fileTypes,
          maxCount,
        })
      : uploadTip;

  useEffect(() => {
    fileListRef.current = fileList;
  }, [fileList]);

  const handleDelete = (index: number) => {
    if (disabled) {
      return;
    }
    const newFileList = fileListRef.current.filter((_, i) => i !== index);
    fileListRef.current = newFileList;
    onChange?.(newFileList);
  };

  const handleUpload = async (options: any) => {
    const { file, onProgress: optionsOnProgress } = options;

    if (file.size / 1024 / 1024 > maxSize) {
      console.error(`File size exceeds ${maxSize}MB`);
      CustomMessage.error(
        maxSizeErrorMessage || t("common.fileSizeExceeds", { maxSize }),
      );
      return;
    }

    if (fileListRef.current.length >= maxCount) {
      console.error(`Maximum ${maxCount} files allowed`);
      CustomMessage.error(t("common.maxFilesAllowed", { maxCount }));
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    // Clear any existing timer
    if (progressTimer) {
      clearInterval(progressTimer);
      setProgressTimer(null);
    }

    // Remove spaces from filename
    const cleanedFileName = file.name.replace(/\s/g, "");
    // Create a new file with the cleaned name
    const cleanedFile = new File([file], cleanedFileName, { type: file.type });

    // Simulate progress from 0 to 80% in 1 second
    let currentProgress = 0;
    const increment = 80 / 10; // 10 steps to reach 80% in 1 second
    const timer = setInterval(() => {
      if (currentProgress < 80) {
        currentProgress += increment;
        if (currentProgress >= 80) {
          currentProgress = 80;
          clearInterval(timer);
          setProgressTimer(null);
        }
        setUploadProgress(currentProgress);
        onProgress?.(currentProgress);
      }
    }, 100); // 100ms per step, 10 steps = 1 second
    setProgressTimer(timer);

    try {
      // Wait for the upload to complete
      const uploadedFile = await new Promise<FileItem | string>((resolve, reject) => {
        customRequest({
          ...options,
          file: cleanedFile,
          onProgress: (progress: any) => {
            // If actual progress is provided, use it
            if (progress && progress.percent) {
              setUploadProgress(progress.percent);
              optionsOnProgress?.(progress);
              onProgress?.(progress.percent);
            }
          },
          onSuccess: (result: FileItem | string) => resolve(result),
          onError: (error: any) => reject(error),
        });
      });

      // Clear any existing timer
      if (progressTimer) {
        clearInterval(progressTimer);
        setProgressTimer(null);
      }

      // Animate from 80% to 100% in 1 second
      currentProgress = 80;
      const finalIncrement = 20 / 10; // 10 steps to reach 100% in 1 second
      const finalTimer = setInterval(() => {
        if (currentProgress < 100) {
          currentProgress += finalIncrement;
          if (currentProgress >= 100) {
            currentProgress = 100;
            clearInterval(finalTimer);
            setProgressTimer(null);
          }
          setUploadProgress(currentProgress);
          onProgress?.(currentProgress);
        }
      }, 100); // 100ms per step, 10 steps = 1 second
      setProgressTimer(finalTimer);

      // Wait for the animation to complete before setting the file
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Set the file after the animation
      const newFile: FileItem =
        typeof uploadedFile === "string"
          ? { url: uploadedFile, name: cleanedFileName }
          : {
              id: uploadedFile.id,
              url: uploadedFile.url,
              name: uploadedFile.name || cleanedFileName,
            };
      const newFileList = [...fileListRef.current, newFile];
      fileListRef.current = newFileList;
      onChange?.(newFileList);
      setUploading(false);
      setUploadProgress(0);
    } catch (error) {
      console.error("Upload failed:", error);
      // Clear timer on error
      if (progressTimer) {
        clearInterval(progressTimer);
        setProgressTimer(null);
      }
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const files = fileList.map((file, index) => (
    <div className="file-item" key={index}>
      <img src={FileJpg} alt={t("common.file")} />
      <span className="file-name">{file.name}</span>
      {!disabled ? (
        <DeleteOutlined
          className="delete-icon"
          onClick={() => handleDelete(index)}
        />
      ) : null}
    </div>
  ));

  return isSingle ? (
    <div className="file-upload-wrapper">
      {!hideFileList && fileList.length > 0 ? (
        <div className="file-single">{files}</div>
      ) : (
        <div className="upload-input-wrapper">
          {uploading && (
            <div className="upload-progress">
              <div
                className="upload-progress-bar"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
          <Upload
            fileList={uploadFileList}
            maxCount={maxCount}
            multiple={maxCount > 1}
            customRequest={handleUpload}
            showUploadList={false}
            accept={accept}
            disabled={disabled || uploading || fileList.length >= maxCount}
            beforeUpload={beforeUpload}
          >
            <Input
              prefix={
                <img
                  src={disabled ? DisableUploadCloud : UploadCloud}
                  alt={t("common.uploadFile")}
                />
              }
              className="upload-input"
              readOnly
              size="large"
              placeholder={resolvedPlaceholder}
              disabled={disabled || fileList.length >= maxCount}
            />
          </Upload>
        </div>
      )}
      {hideFileList || fileList.length > 0 || !resolvedUploadTip ? null : (
        <div className="upload-tip">{resolvedUploadTip}</div>
      )}
    </div>
  ) : (
    <div className="file-upload-wrapper">
      <div className="upload-input-wrapper">
        {uploading && (
          <div className="upload-progress">
            <div
              className="upload-progress-bar"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
        <Upload
          className="common-upload"
          fileList={uploadFileList}
          maxCount={maxCount}
          multiple={maxCount > 1}
          customRequest={handleUpload}
          showUploadList={false}
          accept={accept}
          disabled={disabled || uploading || fileList.length >= maxCount}
          beforeUpload={beforeUpload}
        >
          <Input
            prefix={
              <img
                src={disabled ? DisableUploadCloud : UploadCloud}
                alt={t("common.uploadFile")}
              />
            }
            className="upload-input"
            readOnly
            size="large"
            placeholder={resolvedPlaceholder}
            disabled={disabled || fileList.length >= maxCount}
          />
        </Upload>
      </div>
      {!hideFileList && fileList.length > 0 && (
        <div className="file-list">{files}</div>
      )}
      {resolvedUploadTip && (
        <div className="upload-tip">{resolvedUploadTip}</div>
      )}
    </div>
  );
};

export default FileUpload;
