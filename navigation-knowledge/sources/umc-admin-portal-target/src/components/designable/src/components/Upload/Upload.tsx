import * as React from "react";
import { connect, useField } from "@formily/react";
import DocumentViewer from "../../../../common/DocumentViewer/index";
import { fileUpload } from "@/services/media";
import i18n from "@/localization/config";
import { useFormPreviewLang } from "@/components/designable/playground/FormPreviewLangContext";

const FILE_FORMAT_TO_ACCEPT: Record<string, string> = {
  JPG: ".jpg",
  JPEG: ".jpeg",
  PNG: ".png",
  PDF: ".pdf",
  DOCX: ".docx",
  MP4: ".mp4",
};

const UploadComponent = ({
  value,
  onChange,
  fileFormat,
  fileSizeLimit,
  titleEn,
  titleAr,
  labelEn,
  labelAr,
  placeholderEn,
  placeholderAr,
  uploadTipEn,
  uploadTipAr,
  reuploadTooltipEn,
  reuploadTooltipAr,
  ...props
}) => {
  const field = useField();
    const contentLang = useFormPreviewLang();
  const uploadPlaceholder = i18n.t("Upload.uploadPlaceholder", {
    lng: contentLang,
  });
  const uploadFile = async (options: any) => {
    const { file, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await fileUpload(formData);
      if (res.data && res.data.length > 0) {
        onSuccess(res.data[0]);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      if (onError) {
        onError(error);
      }
    }
  };

  const accept =
    fileFormat && Array.isArray(fileFormat) && fileFormat.length > 0
      ? fileFormat
          .map((f: string) => FILE_FORMAT_TO_ACCEPT[f] || `.${f.toLowerCase()}`)
          .join(",")
      : "";

  const maxSize = Math.min(100, Math.max(1, fileSizeLimit ?? 5));
  const isDisabled =
    field?.pattern === "readOnly" ||
    field?.pattern === "readPretty" ||
    field?.pattern === "disabled" ||
    !!props?.disabled;
  const uploadConfig = {
    maxCount: 1,
    uploadTip: "",
    maxSize,
    accept,
    customRequest: uploadFile,
    placeholder: uploadPlaceholder,
  };

  return (
    <DocumentViewer
      value={value}
      onChange={onChange}
      {...props}
      hasView={isDisabled ? true : (props?.hasView ?? true)}
      hasDownload={isDisabled ? false : (props?.hasDownload ?? false)}
      disabled={isDisabled}
      hasDelete={isDisabled ? false : (props?.hasDelete ?? true)}
      uploadConfig={uploadConfig}
    />
  );
};

export const UploadDom = connect(UploadComponent);

export default UploadDom;
