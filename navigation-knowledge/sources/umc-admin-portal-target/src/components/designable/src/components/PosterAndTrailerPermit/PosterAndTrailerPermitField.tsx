import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Field as FormilyFieldModel } from "@formily/core";
import { observer, useField, useForm } from "@formily/react";
import { Button, Card, Input, Radio, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import type { RcFile } from "antd/lib/upload";
import DocumentViewer from "@/components/common/DocumentViewer";
import CustomMessage from "@/components/common/CustomMessage";
import { fileUpload } from "@/services/media";
import { useTranslation } from "react-i18next";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import "./styles.less";

type TrailerSubmitType = "url" | "upload";

type TrailerItem = {
  submitType: TrailerSubmitType;
  url?: string;
  password?: string;
  fileUrl?: string;
  fileName?: string;
};

type PosterAndTrailerPermitValue = {
  posterFiles: string[];
  trailers: TrailerItem[];
};

type TrailerFieldErrors = {
  url?: string;
  password?: string;
  fileUrl?: string;
};

type ComponentProps = {
  posterTitleEn?: string;
  posterTitleAr?: string;
  trailerTitleEn?: string;
  trailerTitleAr?: string;
  posterMaxCount?: number;
  trailerMaxCount?: number;
  designMode?: boolean;
  disabled?: boolean;
};

const POSTER_ACTIVITY_IDS = new Set(["2062", "2068","2069"]);
const TRAILER_ACTIVITY_IDS = new Set(["2063", "2068","2069"]);
const POSTER_ACCEPT = ".jpg,.jpeg,.png,.pdf";
const TRAILER_ACCEPT = ".mp4";
const POSTER_MAX_SIZE_MB = 10;
const TRAILER_MAX_SIZE_MB = 100;
const DEFAULT_POSTER_MAX_COUNT = 4;
const DEFAULT_TRAILER_MAX_COUNT = 3;
const ACTIVITIES_FIELD_NAME = ["SelectTable", "SelectTableSingle"];
const I18N_PREFIX = "PosterAndTrailerPermit";

type LocalizedCopy = {
  defaultPosterTitle: string;
  defaultTrailerTitle: string;
  requiredMessage: string;
  invalidUrlMessage: string;
  posterTypeMessage: string;
  posterSizeMessage: string;
  trailerTypeMessage: string;
  trailerSizeMessage: string;
  addTrailerButton: string;
  emptyTrailer: string;
  trailerItemTitle: (index: number) => string;
  deleteButton: string;
  submissionMethod: string;
  urlLink: string;
  videoFileUpload: string;
  trailerUrl: string;
  password: string;
  passwordPlaceholder: string;
  videoFile: string;
  uploadPlaceholder: string;
  posterUploadTip: (maxCount: number, maxSize: number) => string;
  trailerUploadTip: (maxSize: number) => string;
};

function isNonEditablePattern(pattern: string | undefined) {
  return (
    pattern === "disabled" ||
    pattern === "readOnly" ||
    pattern === "readPretty"
  );
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && !!item);
  }
  if (typeof value === "string" && value) {
    return [value];
  }
  return [];
}

function normalizeValue(value: unknown): PosterAndTrailerPermitValue {
  const current = value && typeof value === "object" ? (value as Partial<PosterAndTrailerPermitValue>) : {};
  const posterFiles = normalizeStringArray(current.posterFiles);
  const trailers = Array.isArray(current.trailers)
    ? current.trailers
        .filter((item): item is TrailerItem => !!item && typeof item === "object")
        .map((item): TrailerItem => ({
          submitType: item.submitType === "url" ? "url" : "upload",
          url: typeof item.url === "string" ? item.url : undefined,
          password: typeof item.password === "string" ? item.password : undefined,
          fileUrl: typeof item.fileUrl === "string" ? item.fileUrl : undefined,
          fileName: typeof item.fileName === "string" ? item.fileName : undefined,
        }))
    : [];

  return { posterFiles, trailers };
}

function getFileNameFromUrl(value?: string) {
  if (!value) return "";
  const parts = value.split("/");
  return parts[parts.length - 1] || value;
}

function isValidUrl(value?: string) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return /^https?:$/.test(parsed.protocol);
  } catch {
    return false;
  }
}

function getActivityIds(rawValue: unknown): string[] {
  if (rawValue && typeof rawValue === "object") {
    const current = rawValue as Record<string, unknown>;
    if (Array.isArray(current.selectedKey)) {
      return current.selectedKey.map((item) => String(item)).filter(Boolean);
    }
    if (current.selectedKey !== undefined && current.selectedKey !== null && current.selectedKey !== "") {
      return [String(current.selectedKey)];
    }
  }

  if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
    return [String(rawValue)];
  }

  return [];
}

function collectSelectedActivityIds(values: unknown[]): string[] {
  return values.flatMap((value) => getActivityIds(value));
}

function isSameStringArray(prev: string[], next: string[]) {
  if (prev.length !== next.length) return false;
  return prev.every((item, index) => item === next[index]);
}

function validateValue(
  value: PosterAndTrailerPermitValue,
  showPoster: boolean,
  showTrailer: boolean,
  copy: Pick<LocalizedCopy, "requiredMessage" | "invalidUrlMessage">
) {
  const errors: {
    poster?: string;
    trailers?: string;
    trailerItems: TrailerFieldErrors[];
  } = {
    trailerItems: value.trailers.map(() => ({})),
  };

  if (showPoster && value.posterFiles.length === 0) {
    errors.poster = copy.requiredMessage;
  }

  if (showTrailer) {
    if (value.trailers.length === 0) {
      errors.trailers = copy.requiredMessage;
    }

    value.trailers.forEach((trailer, index) => {
      if (trailer.submitType === "url") {
        if (!isValidUrl((trailer.url || "").trim())) {
          errors.trailerItems[index].url = copy.invalidUrlMessage;
        }
        return;
      }

      if (!String(trailer.fileUrl || "").trim()) {
        errors.trailerItems[index].fileUrl = copy.requiredMessage;
      }
    });
  }

  const firstTrailerItemError = errors.trailerItems.find(
    (item) => item.url || item.password || item.fileUrl
  );

  const firstError =
    errors.poster ||
    errors.trailers ||
    firstTrailerItemError?.url ||
    firstTrailerItemError?.password ||
    firstTrailerItemError?.fileUrl ||
    "";

  return {
    errors,
    firstError,
  };
}

function uploadMedia(options: {
  file: File;
  onSuccess?: (url: string) => void;
  onError?: (error: unknown) => void;
  signal?: AbortSignal;
}) {
  const { file, onSuccess, onError, signal } = options;
  const formData = new FormData();
  formData.append("files", file as Blob);
  fileUpload(formData, { timeout: 0, signal })
    .then((res) => {
      const normalized = res as { data?: string[] };
      if (normalized.data && normalized.data.length > 0) {
        onSuccess?.(normalized.data[0]);
        return;
      }
      onError?.(new Error("Upload response is empty"));
    })
    .catch((error) => {
      onError?.(error);
    });
}

export const PosterAndTrailerPermitField: React.FC<ComponentProps> = observer((props) => {
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { t, i18n: i18nReact } = useTranslation();
  const field = useField<FormilyFieldModel>();
  const form = useForm();
  const {
    posterTitleEn,
    posterTitleAr,
    trailerTitleEn,
    trailerTitleAr,
    posterMaxCount = DEFAULT_POSTER_MAX_COUNT,
    trailerMaxCount = DEFAULT_TRAILER_MAX_COUNT,
    designMode: designModeProp,
    disabled,
  } = props;
  const designMode = Boolean(
    designModeProp ?? field.designable ?? host === "designer"
  );
  const trailerUploadControllersRef = useRef(new Map<number, AbortController>());

  useEffect(() => {
    return () => {
      trailerUploadControllersRef.current.forEach((controller) => controller.abort());
      trailerUploadControllersRef.current.clear();
    };
  }, []);
  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);

  const copy = useMemo<LocalizedCopy>(
    () => ({
      defaultPosterTitle: t(`${I18N_PREFIX}.defaultPosterTitle`, { lng: previewLang }),
      defaultTrailerTitle: t(`${I18N_PREFIX}.defaultTrailerTitle`, { lng: previewLang }),
      requiredMessage: t(`${I18N_PREFIX}.requiredMessage`, { lng: previewLang }),
      invalidUrlMessage: t(`${I18N_PREFIX}.invalidUrlMessage`, { lng: previewLang }),
      posterTypeMessage: t(`${I18N_PREFIX}.posterTypeMessage`, { lng: previewLang }),
      posterSizeMessage: t(`${I18N_PREFIX}.posterSizeMessage`, {
        lng: previewLang,
        size: POSTER_MAX_SIZE_MB,
      }),
      trailerTypeMessage: t(`${I18N_PREFIX}.trailerTypeMessage`, { lng: previewLang }),
      trailerSizeMessage: t(`${I18N_PREFIX}.trailerSizeMessage`, {
        lng: previewLang,
        size: TRAILER_MAX_SIZE_MB,
      }),
      addTrailerButton: t(`${I18N_PREFIX}.addTrailerButton`, { lng: previewLang }),
      emptyTrailer: t(`${I18N_PREFIX}.emptyTrailer`, { lng: previewLang }),
      trailerItemTitle: (index: number) =>
        t(`${I18N_PREFIX}.trailerItemTitle`, { lng: previewLang, index: index + 1 }),
      deleteButton: t(`${I18N_PREFIX}.deleteButton`, { lng: previewLang }),
      submissionMethod: t(`${I18N_PREFIX}.submissionMethod`, { lng: previewLang }),
      urlLink: t(`${I18N_PREFIX}.urlLink`, { lng: previewLang }),
      videoFileUpload: t(`${I18N_PREFIX}.videoFileUpload`, { lng: previewLang }),
      trailerUrl: t(`${I18N_PREFIX}.trailerUrl`, { lng: previewLang }),
      password: t(`${I18N_PREFIX}.password`, { lng: previewLang }),
      passwordPlaceholder: t(`${I18N_PREFIX}.passwordPlaceholder`, { lng: previewLang }),
      videoFile: t(`${I18N_PREFIX}.videoFile`, { lng: previewLang }),
      uploadPlaceholder: t(`${I18N_PREFIX}.uploadPlaceholder`, { lng: previewLang }),
      posterUploadTip: (maxCount: number, maxSize: number) =>
        t(`${I18N_PREFIX}.posterUploadTip`, {
          lng: previewLang,
          maxCount,
          maxSize,
        }),
      trailerUploadTip: (maxSize: number) =>
        t(`${I18N_PREFIX}.trailerUploadTip`, { lng: previewLang, maxSize }),
    }),
    [previewLang, t]
  );

  const posterTitle = getBilingualValueByLang({
    lang: previewLang,
    host,
    en: posterTitleEn,
    ar: posterTitleAr,
    fallback: copy.defaultPosterTitle,
  });
  const trailerTitle = getBilingualValueByLang({
    lang: previewLang,
    host,
    en: trailerTitleEn,
    ar: trailerTitleAr,
    fallback: copy.defaultTrailerTitle,
  });

  const currentValue = normalizeValue(field.value);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>(() => {
    const activityValue = designMode
      ? ["2062", "2063"]
      : ACTIVITIES_FIELD_NAME.map((name) => form.getValuesIn(name));
    return collectSelectedActivityIds(activityValue);
  });

  useEffect(() => {
    if (designMode) {
      setSelectedActivityIds((prev) => {
        const next = ["2062", "2063"];
        return isSameStringArray(prev, next) ? prev : next;
      });
      return;
    }

    const syncSelectedActivities = () => {
      const next = collectSelectedActivityIds(
        ACTIVITIES_FIELD_NAME.map((name) => form.getValuesIn(name))
      );
      setSelectedActivityIds((prev) => (isSameStringArray(prev, next) ? prev : next));
    };

    syncSelectedActivities();

    const subscriptionId = form.subscribe((event: unknown) => {
      const formEvent = event as {
        type?: string;
        payload?: { path?: { toString?: () => string } };
      };
      if (
        formEvent?.type !== "onFieldInputValueChange" &&
        formEvent?.type !== "onFieldValueChange"
      ) {
        return;
      }

      const path = formEvent?.payload?.path?.toString?.() || "";
      if (
        !ACTIVITIES_FIELD_NAME.includes(path) &&
        !ACTIVITIES_FIELD_NAME.some((name) => path.endsWith(`.${name}`))
      ) {
        return;
      }

      syncSelectedActivities();
    });

    return () => {
      form.unsubscribe(subscriptionId);
    };
  }, [designMode, form]);

  const showPoster = designMode || selectedActivityIds.some((id) => POSTER_ACTIVITY_IDS.has(id));
  const showTrailer = designMode || selectedActivityIds.some((id) => TRAILER_ACTIVITY_IDS.has(id));
  const isDisabled = disabled || isNonEditablePattern(field.pattern);

  const validationResult = useMemo(
    () => validateValue(currentValue, showPoster, showTrailer, copy),
    [copy, currentValue, showPoster, showTrailer]
  );
  const fieldErrors = validationResult.errors;
  const showValidationHints = field.selfInvalid;

  useEffect(() => {
    field.setValidator((nextValue: unknown) => {
      return validateValue(
        normalizeValue(nextValue),
        showPoster,
        showTrailer,
        copy
      ).firstError;
    });
  }, [copy, field, showPoster, showTrailer]);

  useEffect(() => {
    if (designMode || isDisabled) return;

    const nextValue: Partial<PosterAndTrailerPermitValue> = {
      ...(showPoster ? { posterFiles: currentValue.posterFiles } : {}),
      ...(showTrailer ? { trailers: currentValue.trailers } : {}),
    };

    const shouldUpdate =
      (showPoster
        ? false
        : Object.prototype.hasOwnProperty.call(field.value || {}, "posterFiles")) ||
      (showTrailer
        ? false
        : Object.prototype.hasOwnProperty.call(field.value || {}, "trailers"));

    if (shouldUpdate) {
      field.setValue(nextValue);
    }
  }, [
    currentValue,
    designMode,
    field,
    isDisabled,
    showPoster,
    showTrailer,
  ]);

  const triggerValidate = () => {
    field.validate?.();
  };

  const updateValue = (patch: Partial<PosterAndTrailerPermitValue>) => {
    field.setValue({
      ...currentValue,
      ...patch,
    });
  };

  const handlePosterChange = (nextValue: string | string[] | undefined) => {
    updateValue({
      posterFiles: normalizeStringArray(nextValue),
    });
    triggerValidate();
  };

  const handleTrailerChange = (index: number, patch: Partial<TrailerItem>) => {
    const nextTrailers = currentValue.trailers.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      return {
        ...item,
        ...patch,
      };
    });
    updateValue({ trailers: nextTrailers });
  };

  const handleTrailerTypeChange = (index: number, submitType: TrailerSubmitType) => {
    trailerUploadControllersRef.current.get(index)?.abort();
    trailerUploadControllersRef.current.delete(index);
    const nextTrailers = currentValue.trailers.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      return {
        submitType,
        url: undefined,
        password: undefined,
        fileUrl: undefined,
        fileName: undefined,
      };
    });
    updateValue({ trailers: nextTrailers });
    triggerValidate();
  };

  const addTrailer = () => {
    if (isDisabled || currentValue.trailers.length >= trailerMaxCount) return;
    updateValue({
      trailers: [...currentValue.trailers, { submitType: "url" }],
    });
  };

  const removeTrailer = (index: number) => {
    if (isDisabled) return;
    trailerUploadControllersRef.current.forEach((controller) => controller.abort());
    trailerUploadControllersRef.current.clear();
    updateValue({
      trailers: currentValue.trailers.filter((_, itemIndex) => itemIndex !== index),
    });
    triggerValidate();
  };

  const validatePosterBeforeUpload = (file: RcFile) => {
    const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
    if (!POSTER_ACCEPT.split(",").includes(extension)) {
      CustomMessage.error(copy.posterTypeMessage);
      return false;
    }
    if (file.size / 1024 / 1024 > POSTER_MAX_SIZE_MB) {
      CustomMessage.error(copy.posterSizeMessage);
      return false;
    }
    return true;
  };

  const createTrailerBeforeUpload = () => (file: RcFile) => {
    const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
    if (extension !== ".mp4") {
      CustomMessage.error(copy.trailerTypeMessage);
      return false;
    }
    if (file.size / 1024 / 1024 > TRAILER_MAX_SIZE_MB) {
      CustomMessage.error(copy.trailerSizeMessage);
      return false;
    }
    return true;
  };

  const createTrailerUploadRequest = (index: number) =>
    (options: { file: File; onSuccess?: (url: string) => void; onError?: (error: unknown) => void }) => {
      trailerUploadControllersRef.current.get(index)?.abort();
      const controller = new AbortController();
      trailerUploadControllersRef.current.set(index, controller);

      uploadMedia({
        ...options,
        signal: controller.signal,
        onSuccess: (url) => {
          if (controller.signal.aborted) return;
          if (trailerUploadControllersRef.current.get(index) !== controller) return;
          const latestTrailer = normalizeValue(field.value).trailers[index];
          if (!latestTrailer || latestTrailer.submitType !== "upload") return;
          trailerUploadControllersRef.current.delete(index);
          options.onSuccess?.(url);
        },
        onError: (error) => {
          if (trailerUploadControllersRef.current.get(index) === controller) {
            trailerUploadControllersRef.current.delete(index);
          }
          if (controller.signal.aborted) return;
          options.onError?.(error);
        },
      });
    };

  if (!showPoster && !showTrailer && !designMode) {
    return null;
  }

  return (
    <div className="poster-trailer-permit">
      {showPoster && (
        <Card title={posterTitle} className="poster-trailer-permit__card">
          <DocumentViewer
            value={currentValue.posterFiles}
            onChange={handlePosterChange}
            hasDelete
            disabled={isDisabled}
            uploadConfig={
              isDisabled
                ? undefined
                : {
                    maxCount: posterMaxCount,
                    maxSize: POSTER_MAX_SIZE_MB,
                    accept: POSTER_ACCEPT,
                    placeholder: copy.uploadPlaceholder,
                        customRequest: uploadMedia,
                    beforeUpload: validatePosterBeforeUpload,
                    uploadTip: copy.posterUploadTip(
                      posterMaxCount,
                      POSTER_MAX_SIZE_MB
                    ),
                  }
            }
          />
          {showValidationHints && fieldErrors.poster ? (
            <div className="poster-trailer-permit__error">{fieldErrors.poster}</div>
          ) : null}
        </Card>
      )}

      {showTrailer && (
        <Card
          title={trailerTitle}
          className="poster-trailer-permit__card"
          extra={
            !isDisabled ? (
              <Button
                className="custom-button-primary"
                type="primary"
                onClick={addTrailer}
                disabled={currentValue.trailers.length >= trailerMaxCount}
              >
                {copy.addTrailerButton}
              </Button>
            ) : undefined
          }
        >
          {currentValue.trailers.length === 0 ? (
            <div className="poster-trailer-permit__empty">{copy.emptyTrailer}</div>
          ) : null}

          {currentValue.trailers.map((trailer, index) => {
            const trailerErrors = fieldErrors.trailerItems[index] || {};
            return (
              <div key={`trailer-${index}`} className="poster-trailer-permit__trailer-item">
                <div className="poster-trailer-permit__trailer-header">
                  <div className="poster-trailer-permit__trailer-title">
                    {copy.trailerItemTitle(index)}
                  </div>
                  {!isDisabled ? (
                    <Button danger type="link" onClick={() => removeTrailer(index)}>
                      {copy.deleteButton}
                    </Button>
                  ) : null}
                </div>

                {isDisabled ? null : <div className="poster-trailer-permit__field">
                  <div className="poster-trailer-permit__label">
                    {copy.submissionMethod} <span className="poster-trailer-permit__required">*</span>
                  </div>
                  <Radio.Group
                    value={trailer.submitType}
                    onChange={(event) => handleTrailerTypeChange(index, event.target.value)}
                    disabled={isDisabled}
                  >
                    <Radio value="url">{copy.urlLink}</Radio>
                    <Radio value="upload">{copy.videoFileUpload}</Radio>
                  </Radio.Group>
                </div>}

                {trailer.submitType === "url" ? (
                  <div className="poster-trailer-permit__url-fields">
                    <div className="poster-trailer-permit__field">
                      <div className="poster-trailer-permit__label">
                        {copy.trailerUrl} <span className="poster-trailer-permit__required">*</span>
                      </div>
                      <Input
                        value={trailer.url}
                        placeholder="https://"
                        disabled={isDisabled}
                        onChange={(event) =>
                          handleTrailerChange(index, {
                            url: event.target.value,
                            fileUrl: undefined,
                            fileName: undefined,
                          })
                        }
                        onBlur={triggerValidate}
                        status={showValidationHints && trailerErrors.url ? "error" : ""}
                        className="poster-trailer-permit__text-input"
                      />
                      {showValidationHints && trailerErrors.url ? (
                        <div className="poster-trailer-permit__error">{trailerErrors.url}</div>
                      ) : null}
                    </div>

                    <div className="poster-trailer-permit__field">
                      <div className="poster-trailer-permit__label">{copy.password}</div>
                      <Input
                        value={trailer.password}
                        placeholder={copy.passwordPlaceholder}
                        disabled={isDisabled}
                        className="poster-trailer-permit__text-input"
                        onChange={(event) => {
                          handleTrailerChange(index, {
                            password: event.target.value,
                            fileUrl: undefined,
                            fileName: undefined,
                          });
                        }}
                        onBlur={triggerValidate}
                        status={showValidationHints && trailerErrors.password ? "error" : ""}
                      />
                      {showValidationHints && trailerErrors.password ? (
                        <div className="poster-trailer-permit__error">{trailerErrors.password}</div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="poster-trailer-permit__field">
                    <div className="poster-trailer-permit__label">
                      {copy.videoFile} <span className="poster-trailer-permit__required">*</span>
                      <Tooltip
                        title={copy.trailerUploadTip(TRAILER_MAX_SIZE_MB)}
                        trigger={["hover", "focus"]}
                      >
                        <QuestionCircleOutlined
                          aria-label={copy.trailerUploadTip(TRAILER_MAX_SIZE_MB)}
                          className="poster-trailer-permit__tooltip-icon"
                          tabIndex={0}
                        />
                      </Tooltip>
                    </div>
                    <DocumentViewer
                      value={trailer.fileUrl}
                      onChange={(nextValue) => {
                        const nextFileUrl = normalizeStringArray(nextValue)[0];
                        handleTrailerChange(index, {
                          fileUrl: nextFileUrl,
                          fileName: nextFileUrl ? getFileNameFromUrl(nextFileUrl) : undefined,
                          url: undefined,
                          password: undefined,
                        });
                        triggerValidate();
                      }}
                      hasDelete
                      disabled={isDisabled}
                      uploadConfig={
                        isDisabled
                          ? undefined
                          : {
                              maxCount: 1,
                              maxSize: TRAILER_MAX_SIZE_MB,
                              accept: TRAILER_ACCEPT,
                              placeholder: copy.uploadPlaceholder,
                              uploadTip: "",
                              customRequest: createTrailerUploadRequest(index),
                              beforeUpload: createTrailerBeforeUpload(),
                              onUploadSuccess: (uploadedFiles) => {
                                const uploaded = uploadedFiles[0];
                                handleTrailerChange(index, {
                                  fileUrl: uploaded?.url,
                                  fileName: uploaded?.name || getFileNameFromUrl(uploaded?.url),
                                  url: undefined,
                                  password: undefined,
                                });
                              },
                            }
                      }
                    />
                    {showValidationHints && trailerErrors.fileUrl ? (
                      <div className="poster-trailer-permit__error">{trailerErrors.fileUrl}</div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}

          {showValidationHints && fieldErrors.trailers ? (
            <div className="poster-trailer-permit__error">{fieldErrors.trailers}</div>
          ) : null}
        </Card>
      )}
    </div>
  );
});

export default PosterAndTrailerPermitField;
