import * as React from "react";
import { connect, observer, useField } from "@formily/react";
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

const MultiFileComponent = observer(({
  value,
  onChange,
  fileFormat,
  fileSizeLimit,
  maxCount,
  titleEn,
  titleAr,
  labelEn,
  labelAr,
  placeholderEn,
  placeholderAr,
  uploadTipEn,
  uploadTipAr,
  ...props
}: {
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  fileFormat?: string[];
  fileSizeLimit?: number;
  maxCount?: number;
  titleEn?: string;
  titleAr?: string;
  labelEn?: string;
  labelAr?: string;
  placeholderEn?: string;
  placeholderAr?: string;
  uploadTipEn?: string;
  uploadTipAr?: string;
  [key: string]: unknown;
}) => {
  const field = useField();
  
  const contentLang = useFormPreviewLang();
  const uploadPlaceholder = i18n.t("MultiFile.uploadPlaceholder", {
    lng: contentLang,
  });

  const uploadFile = async (options: {
    file: File;
    onSuccess: (url: string) => void;
    onError?: (err: unknown) => void;
  }) => {
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
  const resolvedMaxCount = Math.min(5, Math.max(2, maxCount ?? 2));
  const fieldPattern = (field as { pattern?: string })?.pattern;
  const isReadOnly =
    !!props?.disabled ||
    fieldPattern === "readOnly" ||
    fieldPattern === "readPretty" ||
    fieldPattern === "disabled";

  return (
    <DocumentViewer
      value={value}
      onChange={onChange}
      hasView={isReadOnly}
      hasDownload={isReadOnly}
      disabled={isReadOnly}
      {...props}
      hasDelete={!isReadOnly}
      uploadConfig={{
        maxCount: resolvedMaxCount,
        uploadTip: "",
        maxSize,
        accept,
        customRequest: uploadFile,
        placeholder: uploadPlaceholder,
      }}
    />
  );
});

export const MultiFileDom = connect(MultiFileComponent);

export default MultiFileDom;
