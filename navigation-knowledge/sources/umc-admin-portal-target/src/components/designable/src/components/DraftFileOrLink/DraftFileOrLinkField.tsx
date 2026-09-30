import type { Field, FieldValidator } from "@formily/core";
import { observer, useField, useForm } from "@formily/react";
import { Input, Radio } from "antd";
import type { RadioChangeEvent } from "antd/lib/radio";
import type { RcFile } from "antd/lib/upload";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CustomMessage from "@/components/common/CustomMessage";
import DocumentViewer from "@/components/common/DocumentViewer";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import {
  fileUpload,
  getDocumentUploadResponseUrl,
} from "@/services/media";
import i18n from "@/localization/config";
import {
  DEFAULT_DRAFT_FILE_OR_LINK_TYPE,
  isDraftFileOrLinkType,
  resolveDraftFileOrLinkPasswordFieldName,
  resolveDraftFileOrLinkTypeFieldName,
  type DraftFileOrLinkType,
} from "./schemaContract";
import "./styles.less";

const DEFAULT_FILE_FORMATS = ["JPG", "JPEG", "PNG", "PDF", "DOCX", "MP4"];
const FILE_FORMAT_TO_ACCEPT: Record<string, string> = {
  JPG: ".jpg",
  JPEG: ".jpeg",
  PNG: ".png",
  PDF: ".pdf",
  DOCX: ".docx",
  MP4: ".mp4",
};
const DEFAULT_FILE_SIZE_LIMIT = 5;
const MAX_LINK_LENGTH = 2000;

export interface DraftFileOrLinkFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  onFileUploadSuccess?: (fileData: { url: string; name: string }[]) => void;
  fileFormat?: string[];
  fileSizeLimit?: number;
  uploadPlaceholder?: string;
  uploadTip?: string;
  invalidFileTypeMessage?: string;
  maxSizeErrorMessage?: string;
  disabled?: boolean;
  readOnly?: boolean;
  title?: string;
  titleEn?: string;
  titleAr?: string;
}

type FieldWithDesignable = Field & {
  designable?: boolean;
};

interface ValidationContext {
  form: ReturnType<typeof useForm>;
  typePath: string;
  invalidUrlMessage: string;
}

const getSiblingPath = (address: string, siblingName: string) => {
  const segments = address.split(".");
  segments[segments.length - 1] = siblingName;
  return segments.join(".");
};

const toValidatorList = (
  validator: FieldValidator | undefined,
): Exclude<FieldValidator, unknown[]>[] => {
  if (!validator) return [];
  return (Array.isArray(validator) ? validator : [validator]) as Exclude<
    FieldValidator,
    unknown[]
  >[];
};

const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeFileFormats = (fileFormat?: string[]) => {
  const configured = Array.isArray(fileFormat)
    ? fileFormat
        .map((format) => String(format).trim().toUpperCase())
        .filter((format) => Boolean(FILE_FORMAT_TO_ACCEPT[format]))
    : [];
  return configured.length > 0 ? configured : DEFAULT_FILE_FORMATS;
};

const normalizeFileSizeLimit = (value?: number) =>
  Math.min(
    100,
    Math.max(
      1,
      Number.isFinite(value) ? Number(value) : DEFAULT_FILE_SIZE_LIMIT,
    ),
  );

export const DraftFileOrLinkField = observer(
  ({
    value = "",
    onChange,
    onFileUploadSuccess,
    fileFormat,
    fileSizeLimit,
    uploadPlaceholder: uploadPlaceholderProp,
    uploadTip = "",
    invalidFileTypeMessage: invalidFileTypeMessageProp,
    maxSizeErrorMessage,
    disabled = false,
    readOnly = false,
  }: DraftFileOrLinkFieldProps) => {
    const field = useField<FieldWithDesignable>();
    const form = useForm();
    const language = useFormPreviewLang();
    const host = useFormLanguageHost();
    const locale = language === "ar" ? "ar" : "en";
    const address = field.address.toString();
    const valueFieldName = address.split(".").at(-1) || "draftFileOrLink";
    const typeFieldName = resolveDraftFileOrLinkTypeFieldName(valueFieldName);
    const passwordFieldName =
      resolveDraftFileOrLinkPasswordFieldName(valueFieldName);
    const typePath = getSiblingPath(address, typeFieldName);
    const passwordPath = getSiblingPath(address, passwordFieldName);
    const storedType = form.getValuesIn(typePath);
    const passwordValue = String(form.getValuesIn(passwordPath) ?? "");
    const selectedType = isDraftFileOrLinkType(storedType)
      ? storedType
      : DEFAULT_DRAFT_FILE_OR_LINK_TYPE;
    const isDesigner = host === "designer" || Boolean(field.designable);
    const isReadOnly =
      readOnly ||
      disabled ||
      field.pattern === "readOnly" ||
      field.pattern === "readPretty" ||
      field.pattern === "disabled" ||
      form.pattern === "readOnly" ||
      form.pattern === "readPretty" ||
      form.pattern === "disabled";
    const interactionDisabled = isDesigner || isReadOnly;
    const allowedFormats = useMemo(
      () => normalizeFileFormats(fileFormat),
      [fileFormat],
    );
    const accept = useMemo(
      () => allowedFormats.map((format) => FILE_FORMAT_TO_ACCEPT[format]).join(","),
      [allowedFormats],
    );
    const maxSize = normalizeFileSizeLimit(fileSizeLimit);
    const linkLabel = String(
      i18n.t("DraftFileOrLink.linkLabel", { lng: locale }),
    );
    const fileLabel = String(
      i18n.t("DraftFileOrLink.fileLabel", { lng: locale }),
    );
    const linkPlaceholder = String(
      i18n.t("DraftFileOrLink.linkPlaceholder", { lng: locale }),
    );
    const passwordPlaceholder = String(
      i18n.t("DraftFileOrLink.passwordPlaceholder", { lng: locale }),
    );
    const localizedUploadPlaceholder = String(
      i18n.t("DraftFileOrLink.uploadPlaceholder", { lng: locale }),
    );
    const invalidUrlMessage = String(
      i18n.t("DraftFileOrLink.invalidUrl", { lng: locale }),
    );
    const localizedInvalidFileTypeMessage = String(
      i18n.t("DraftFileOrLink.invalidFileType", { lng: locale }),
    );
    const uploadPlaceholder =
      uploadPlaceholderProp ?? localizedUploadPlaceholder;
    const invalidFileTypeMessage =
      invalidFileTypeMessageProp ?? localizedInvalidFileTypeMessage;
    const uploadFailedMessage = String(
      i18n.t("DraftFileOrLink.uploadFailed", { lng: locale }),
    );
    const validationContextRef = useRef<ValidationContext>({
      form,
      typePath,
      invalidUrlMessage,
    });
    const urlValidatorRef = useRef<((value: unknown) => string) | undefined>();

    validationContextRef.current = {
      form,
      typePath,
      invalidUrlMessage,
    };

    useEffect(() => {
      if (!isDraftFileOrLinkType(form.getValuesIn(typePath))) {
        form.setValuesIn(typePath, DEFAULT_DRAFT_FILE_OR_LINK_TYPE);
        form.setValuesIn(passwordPath, "");
      }
    }, [form, passwordPath, typePath]);

    if (!urlValidatorRef.current) {
      urlValidatorRef.current = (candidate: unknown) => {
        const context = validationContextRef.current;
        if (context.form.getValuesIn(context.typePath) !== "link") return "";

        const normalized = String(candidate ?? "").trim();
        if (!normalized) return "";
        return isHttpUrl(normalized) ? "" : context.invalidUrlMessage;
      };
    }

    useEffect(() => {
      const originalValidator = field.validator;
      const urlValidator = urlValidatorRef.current;
      if (!urlValidator) return;

      field.setValidator([...toValidatorList(originalValidator), urlValidator]);
      return () => {
        const remainingValidators = toValidatorList(field.validator).filter(
          (validator) => validator !== urlValidator,
        );
        field.setValidator(remainingValidators);
      };
    }, [field]);

    const setMainValue = useCallback(
      (nextValue: string) => {
        if (onChange) {
          onChange(nextValue);
        } else {
          field.setValue(nextValue);
        }
      },
      [field, onChange],
    );

    const handleTypeChange = (event: RadioChangeEvent) => {
      const nextType = event.target.value as DraftFileOrLinkType;
      if (!isDraftFileOrLinkType(nextType) || nextType === selectedType) return;

      form.setValuesIn(typePath, nextType);
      form.setValuesIn(passwordPath, "");
      setMainValue("");
      field.setSelfErrors([]);
      field.modify();
    };

    const handleLinkChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setMainValue(event.target.value.trim());
    };

    const handleLinkBlur = () => {
      const normalized = String(value ?? "").trim();
      if (normalized !== value) {
        setMainValue(normalized);
      }
      void field.validate("onBlur").catch(() => undefined);
    };

    const handlePasswordChange = (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      form.setValuesIn(passwordPath, event.target.value);
      field.modify();
    };

    const handleBeforeUpload = useCallback(
      (file: RcFile) => {
        const extension = file.name.split(".").at(-1)?.toUpperCase() || "";
        if (allowedFormats.includes(extension)) return true;

        CustomMessage.error(invalidFileTypeMessage);
        return false;
      },
      [allowedFormats, invalidFileTypeMessage],
    );

    const handleUpload = useCallback(
      async (options: {
        file: File;
        onSuccess?: (url: string) => void;
        onError?: (error: unknown) => void;
      }) => {
        const formData = new FormData();
        formData.append("files", options.file);
        try {
          const response = await fileUpload(formData);
          const fileUrl = getDocumentUploadResponseUrl(response);
          if (!fileUrl) {
            throw new Error("Upload response did not include a file URL.");
          }
          options.onSuccess?.(fileUrl);
        } catch (error) {
          console.error("DraftFileOrLink upload failed:", error);
          CustomMessage.error(uploadFailedMessage);
          options.onError?.(error);
        }
      },
      [uploadFailedMessage],
    );

    const [passwordCopied, setPasswordCopied] = useState(false);

    const handleCopyPassword = () => {
      void navigator.clipboard.writeText(passwordValue).then(() => {
        setPasswordCopied(true);
        setTimeout(() => setPasswordCopied(false), 2000);
      });
    };

    return (
      <div className="draft-file-or-link">
        {!isReadOnly ? (
          <div className="draft-file-or-link__type-selector">
            <Radio.Group
              value={selectedType}
              disabled={interactionDisabled}
              onChange={handleTypeChange}
            >
              <Radio value="link">{linkLabel}</Radio>
              <Radio value="file">{fileLabel}</Radio>
            </Radio.Group>
          </div>
        ) : null}

        <div className="draft-file-or-link__control">
          {selectedType === "link" ? (
            <div className="draft-file-or-link__link-controls">
              {isReadOnly ? (
                <>
                  {isHttpUrl(value) ? (
                    <a
                      className="draft-file-or-link__readonly-link-field"
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={value}
                      dir="ltr"
                    >
                      <span className="draft-file-or-link__readonly-link">
                        {value}
                      </span>
                    </a>
                  ) : (
                    <div
                      className="draft-file-or-link__readonly-link-field"
                      dir="ltr"
                    >
                      <span
                        className="draft-file-or-link__readonly-link-value"
                        title={value}
                      >
                        {value}
                      </span>
                    </div>
                  )}
                  {passwordValue ? (
                    <Input
                      className="draft-file-or-link__password-input draft-file-or-link__password-input--readonly"
                      value={passwordValue}
                      readOnly
                      dir="ltr"
                      suffix={
                        <span
                          className="draft-file-or-link__copy-btn"
                          onClick={handleCopyPassword}
                          title="Copy"
                        >
                          {passwordCopied ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M7.5 3H14.6C16.8402 3 17.9603 3 18.816 3.43597C19.5686 3.81947 20.1805 4.43139 20.564 5.18404C21 6.03969 21 7.15979 21 9.4V16.5M6.2 21H14.3C15.4201 21 15.9802 21 16.408 20.782C16.7843 20.5903 17.0903 20.2843 17.282 19.908C17.5 19.4802 17.5 18.9201 17.5 17.8V9.7C17.5 8.57989 17.5 8.01984 17.282 7.59202C17.0903 7.21569 16.7843 6.90973 16.408 6.71799C15.9802 6.5 15.4201 6.5 14.3 6.5H6.2C5.0799 6.5 4.51984 6.5 4.09202 6.71799C3.71569 6.90973 3.40973 7.21569 3.21799 7.59202C3 8.01984 3 8.57989 3 9.7V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.0799 21 6.2 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                      }
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <Input
                    className="draft-file-or-link__link-input"
                    value={value}
                    placeholder={linkPlaceholder}
                    maxLength={MAX_LINK_LENGTH}
                    disabled={interactionDisabled}
                    allowClear
                    type="url"
                    dir="ltr"
                    onChange={handleLinkChange}
                    onBlur={handleLinkBlur}
                  />
                  <Input
                    className="draft-file-or-link__password-input"
                    value={passwordValue}
                    placeholder={passwordPlaceholder}
                    disabled={interactionDisabled}
                    allowClear
                    dir="ltr"
                    onChange={handlePasswordChange}
                  />
                </>
              )}
            </div>
          ) : (
            <DocumentViewer
              className="draft-file-or-link__file-viewer"
              value={value}
              onChange={(nextValue) =>
                setMainValue(
                  Array.isArray(nextValue)
                    ? String(nextValue[0] ?? "")
                    : nextValue,
                )
              }
              disabled={interactionDisabled}
              hasView
              hasDownload={isReadOnly}
              hasDelete={!isReadOnly && !isDesigner}
              uploadConfig={
                isReadOnly
                  ? undefined
                  : {
                      maxCount: 1,
                      maxSize,
                      accept,
                      placeholder: uploadPlaceholder,
                      uploadTip,
                      customRequest: handleUpload,
                      beforeUpload: handleBeforeUpload,
                      invalidFileTypeMessage,
                      maxSizeErrorMessage,
                      onUploadSuccess: onFileUploadSuccess,
                    }
              }
            />
          )}
        </div>
      </div>
    );
  },
);
