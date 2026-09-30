/* eslint-disable @typescript-eslint/no-explicit-any -- Formily field props */
import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { observer, useField, useForm } from "@formily/react";
import { Upload, Modal, message, Card, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd";
import { useTranslation } from "react-i18next";
import i18n from "@/localization/config";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import { isNonEditablePattern } from "@/components/designable/src/utils/readOnlyMultiSelect";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { openSafeFilePreviewUrl } from "./filePreviewSecurity";
import "./styles.less";

interface FileItem {
  uid: string;
  name: string;
  status: "done" | "uploading" | "error";
  url?: string;
  thumbUrl?: string;
  type?: string;
  size?: number;
}

interface FileUploadGridValue {
  fileList?: FileItem[];
}

const MAX_UPLOAD_MB = 10;

const getConfiguredPreviewOrigins = () => [
  String(import.meta.env.VITE_API_BASE_URL ?? ""),
  String(import.meta.env.VITE_IMG_BASE_URL ?? ""),
  String(import.meta.env.VITE_ALLOWED_FILE_PREVIEW_ORIGINS ?? ""),
];

const isImageFile = (fileName: string) => {
  const extension = fileName.toLowerCase().split(".").pop();
  return ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(
    extension || "",
  );
};

function isHtmlTooltip(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

function isEffectivelyEmptyTip(html: string): boolean {
  if (!html) return true;
  const stripped = html.replace(/<[^>]*>/g, "").trim();
  return (
    stripped.length === 0 && !/<img\s/i.test(html) && !/<video\s/i.test(html)
  );
}

export const FileUploadGridField: React.FC<any> = observer((props) => {
  const {
    titleEn,
    titleAr,
    descriptionEn,
    descriptionAr,
    addButtonLabel,
    maxImages: maxImagesProp,
    title,
    disabled,
    ...restProps
  } = props;

  const field = useField<any>();
  const form = useForm();
  const isReadOnly =
    Boolean(disabled) ||
    isNonEditablePattern(field.pattern) ||
    isNonEditablePattern(form.pattern);
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();

  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);

  const lngOpt = previewLang === "ar" ? "ar" : "en";

  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(
        i18n.t(`ImageList.${key}`, {
          lng: lngOpt,
          ...(options ?? {}),
        }),
      ),
    [lngOpt],
  );

  const resolvedTitleText = useMemo(() => {
    const raw = getBilingualValueByLang({
      lang: previewLang,
      host,
      en: titleEn,
      ar: titleAr,
      legacy: typeof title === "string" ? title : undefined,
      fallback: "",
    });
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed.length > 0) return trimmed;
    if (host === "designer") return "";
    return translate("defaultCardTitle");
  }, [previewLang, host, titleEn, titleAr, title, translate]);

  const descriptionTipRaw = useMemo(
    () =>
      getBilingualValueByLang({
        lang: previewLang,
        host,
        en: descriptionEn,
        ar: descriptionAr,
        fallback: "",
      }),
    [previewLang, host, descriptionEn, descriptionAr],
  );

  const descriptionTipEl = useMemo(() => {
    const tip = descriptionTipRaw;
    if (!tip || typeof tip !== "string") return null;
    if (isEffectivelyEmptyTip(tip)) return null;
    const content = isHtmlTooltip(tip) ? (
      <div
        className="html-tooltip-content"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(tip) }}
        style={{ maxWidth: 800 }}
      />
    ) : (
      tip
    );
    return (
      <Tooltip title={content} overlayInnerStyle={{ maxWidth: 800 }}>
        <span
          style={{
            display: "inline-flex",
            marginLeft: 4,
            lineHeight: 1,
          }}
        >
          <QuestionCircleOutlined
            style={{
              color: "rgba(0,0,0,0.45)",
              cursor: "help",
              fontSize: 14,
            }}
          />
        </span>
      </Tooltip>
    );
  }, [descriptionTipRaw]);

  const resolvedAddButtonLabel = useMemo(() => {
    const t = typeof addButtonLabel === "string" ? addButtonLabel.trim() : "";
    return t.length > 0 ? t : translate("defaultAddButton");
  }, [addButtonLabel, translate]);

  const effectiveMaxImages = Math.min(
    12,
    Math.max(
      1,
      typeof maxImagesProp === "number" && Number.isFinite(maxImagesProp)
        ? maxImagesProp
        : 4,
    ),
  );

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");

  const fileList = useMemo(() => {
    const v = (field.value || {}) as FileUploadGridValue;
    return v.fileList || [];
  }, [field.value]);

  const handleFieldChange = useCallback(
    (key: keyof FileUploadGridValue, value: unknown) => {
      const prev = (field.value || {}) as FileUploadGridValue;
      field.setValue({
        ...prev,
        [key]: value,
      });
    },
    [field],
  );

  const handlePreview = useCallback((file: FileItem) => {
    if (!file.url && !file.thumbUrl) {
      return;
    }

    if (isImageFile(file.name)) {
      setPreviewImage(file.url || file.thumbUrl || "");
      setPreviewVisible(true);
      setPreviewTitle(file.name);
    } else if (file.url) {
      const opened = openSafeFilePreviewUrl(
        file.url,
        window.location.origin,
        getConfiguredPreviewOrigins(),
        (url, target, features) => window.open(url, target, features),
      );

      if (!opened) {
        message.warning(translate("previewUnavailable"));
      }
    }
  }, [translate]);

  const antdFileList: UploadFile[] = fileList.map((f) => ({
    uid: f.uid,
    name: f.name,
    status: (f.status || "done") as UploadFile["status"],
    url: f.url,
    thumbUrl: f.thumbUrl,
    type: f.type,
    size: f.size,
  }));

  const handleRemove = useCallback(
    (file: FileItem) => {
      const newFileList = fileList.filter((item) => item.uid !== file.uid);
      handleFieldChange("fileList", newFileList);
    },
    [fileList, handleFieldChange],
  );

  const handleChange: UploadProps["onChange"] = useCallback(
    ({ fileList: newFileList }) => {
      const processedFileList = newFileList.map((file: UploadFile) => ({
        uid: file.uid,
        name: file.name,
        status: file.status || "done",
        url: file.response?.url || file.url,
        thumbUrl: file.thumbUrl,
        type: file.type,
        size: file.size,
      }));

      handleFieldChange("fileList", processedFileList);
    },
    [handleFieldChange],
  );

  const beforeUpload = useCallback(
    (file: File) => {
      if (antdFileList.length >= effectiveMaxImages) {
        message.warning(
          translate("maxUploadsReached", { max: effectiveMaxImages }),
        );
        return false;
      }
      const isValidSize = file.size / 1024 / 1024 < MAX_UPLOAD_MB;
      if (!isValidSize) {
        message.error(
          translate("fileTooLarge", { maxMb: MAX_UPLOAD_MB }),
        );
        return false;
      }
      return true;
    },
    [antdFileList.length, effectiveMaxImages, translate],
  );

  const customRequest = useCallback(({ file, onSuccess }: any) => {
    setTimeout(() => {
      const mockUrl = URL.createObjectURL(file);
      onSuccess({
        url: mockUrl,
        name: file.name,
      });
    }, 1000);
  }, []);

  const cardTitleEl = (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <span>{resolvedTitleText}</span>
      {descriptionTipEl}
    </span>
  );

  return (
    <div className="file-upload-grid-container" {...restProps}>
      <Card className="file-upload-grid-card" title={cardTitleEl}>
        <Upload
          listType="picture-card"
          fileList={antdFileList}
          disabled={isReadOnly}
          showUploadList={{ showRemoveIcon: !isReadOnly }}
          onChange={handleChange}
          beforeUpload={beforeUpload}
          customRequest={customRequest}
          accept="image/*,.pdf,.doc,.docx,.txt"
          onPreview={(file) =>
            handlePreview({
              uid: file.uid,
              name: file.name,
              status: (file.status || "done") as any,
              url: (file.url as string) || (file.thumbUrl as string),
              thumbUrl: file.thumbUrl as string,
              type: file.type,
              size: file.size,
            })
          }
          onRemove={(file) => {
            if (isReadOnly) {
              return false;
            }

            handleRemove({
              uid: file.uid,
              name: file.name,
              status: (file.status || "done") as any,
              url: file.url as string,
              thumbUrl: file.thumbUrl as string,
              type: file.type,
              size: file.size,
            });
            return true;
          }}
        >
          {isReadOnly || antdFileList.length >= effectiveMaxImages ? null : (
            <div>{resolvedAddButtonLabel}</div>
          )}
        </Upload>

        <Modal
          centered
          visible={previewVisible}
          title={previewTitle}
          footer={null}
          onCancel={() => setPreviewVisible(false)}
          width="80%"
          style={{ maxWidth: "800px" }}
        >
          <img
            alt={translate("previewImageAlt")}
            style={{ width: "100%" }}
            src={previewImage}
          />
        </Modal>
      </Card>
    </div>
  );
});
