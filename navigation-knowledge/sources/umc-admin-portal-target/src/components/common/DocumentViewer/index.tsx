import React, { useLayoutEffect, useRef, useState } from "react";
import { useField, useForm } from "@formily/react";
import FileUpload from "../FileUpload";
import EyeIcon from "@/assets/images/Eye.svg";
import TrashIcon from "@/assets/images/Trash.svg";
import DownloadIcon from "@/assets/images/Download.svg";
import FilePdfIcon from "@/assets/images/FilePdf.svg";
import FileJpgIcon from "@/assets/images/FileJpg.svg";
import FilePngIcon from "@/assets/images/FilePng.svg";
import FileJpegIcon from "@/assets/images/FileJpeg.svg";
import FileVideoIcon from "@/assets/images/movies.png";
import PdfScrollPreview from "@/components/common/PdfScrollPreview";
import {
 downloadDocumentFile,
 fileUpload,
 getDocumentUploadResponseUrl,
 getOriginalFileNames,
} from "@/services/media";
import "./index.less";
import { Image, Modal, Input } from "antd";
import "@/utils/urlParsePolyfill";

import {
  MinusOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { PasswordResponses } from "pdfjs-dist";
import {
 isPdfFile,
 resolveDocumentAccessUrl,
 resolvePdfPreviewUrl,
} from "@/utils/pdfPreview";
import { useAuthenticatedDocumentUrl } from "@/hooks/useAuthenticatedDocumentUrl";
import type { RcFile } from "antd/lib/upload";
import CustomMessage from "../CustomMessage";
import CustomButton from "../CustomButton";
import { useTranslation } from "react-i18next";

export type FileType =
  | "PDF"
  | "JPG"
  | "PNG"
  | "JPEG"
  | "pdf"
  | "jpg"
  | "png"
  | "jpeg"
  | "MP4"
  | "MOV"
  | "M4V"
  | "WEBM"
  | "OGV"
  | "AVI"
  | "MKV"
  | "mp4"
  | "mov"
  | "m4v"
  | "webm"
  | "ogv"
  | "avi"
  | "mkv";

interface DocumentViewerUploadRequest {
  file: File;
  onSuccess?: (url: string) => void;
  onError?: (error: unknown) => void;
}

export interface DocumentViewerProps {
  fileName?: string;
  fileUrl?: string;
  fileType?: FileType;
  className?: string;

  hasView?: boolean;
  hasDelete?: boolean;
  /** Replace current file via picker without clearing first (single-file uploads). */
  hasReupload?: boolean;
  hasDownload?: boolean;

  onView?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;

  uploadConfig?: {
    maxSize?: number;
    maxCount?: number;
    accept?: string;
    placeholder?: string;
    uploadTip?: string;
    customRequest?: (options: DocumentViewerUploadRequest) => void;
    onUploadSuccess?: (fileData: { url: string; name: string }[]) => void;
    beforeUpload?: (file: RcFile) => boolean;
    invalidFileTypeMessage?: string;
    maxSizeErrorMessage?: string;
  };

  label?: string;
  required?: boolean;
  disabled?: boolean;

  // Form.Item integration
  value?: string | string[] | DocumentValueObject | DocumentValueObject[];
  onChange?: (value: string | string[]) => void;

  /** Used for native tooltip / accessibility when `hasReupload` is enabled */
  reuploadTooltip?: string;
}

type UploadedFileEntry = {
  url: string;
  name: string;
  fileType?: FileType;
};

export type DocumentValueObject = {
  fileName?: unknown;
  fileType?: unknown;
  fileUrl?: unknown;
  key?: unknown;
  name?: unknown;
  path?: unknown;
  url?: unknown;
  value?: unknown;
};

function isNonEditablePattern(pattern: string | undefined) {
  return (
    pattern === "disabled" ||
    pattern === "readOnly" ||
    pattern === "readPretty"
  );
}

function isReviewPattern(pattern: string | undefined) {
  return pattern === "readOnly" || pattern === "readPretty";
}

const getBasenameFromPath = (name: string) => {
  const parts = name.split(/[/\\]/);
  return parts[parts.length - 1] || name;
};

function isFileType(value: unknown): value is FileType {
  return (
    value === "PDF" ||
    value === "JPG" ||
    value === "PNG" ||
    value === "JPEG" ||
    value === "pdf" ||
    value === "jpg" ||
    value === "png" ||
    value === "jpeg" ||
    value === "MP4" ||
    value === "MOV" ||
    value === "M4V" ||
    value === "WEBM" ||
    value === "OGV" ||
    value === "AVI" ||
    value === "MKV" ||
    value === "mp4" ||
    value === "mov" ||
    value === "m4v" ||
    value === "webm" ||
    value === "ogv" ||
    value === "avi" ||
    value === "mkv"
  );
}

const VIDEO_FILE_PATTERN = /\.(mp4|mov|m4v|webm|ogv|avi|mkv)(?=$|[?#&])/i;

function isVideoFile(fileData: UploadedFileEntry) {
  if (
    VIDEO_FILE_PATTERN.test(fileData.name) ||
    VIDEO_FILE_PATTERN.test(fileData.url)
  ) {
    return true;
  }

  return ["MP4", "MOV", "M4V", "WEBM", "OGV", "AVI", "MKV"].includes(
    fileData.fileType?.toUpperCase() || "",
  );
}

function resolveDocumentValueEntry(
  value: unknown,
  fallbackType: FileType,
  preserved?: UploadedFileEntry,
): UploadedFileEntry | null {
  if (typeof value === "string" && value) {
    return {
      url: value,
      name: preserved?.name ?? getBasenameFromPath(value),
      fileType: preserved?.fileType ?? fallbackType,
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as DocumentValueObject;
  const urlCandidate =
    typeof item.key === "string"
      ? item.key
      : typeof item.url === "string"
        ? item.url
        : typeof item.fileUrl === "string"
        ? item.fileUrl
        : typeof item.fileName === "string"
          ? item.fileName
          : typeof item.value === "string"
            ? item.value
            : typeof item.path === "string"
              ? item.path
              : null;

  if (!urlCandidate) {
    return null;
  }

  const nameCandidate =
    typeof item.name === "string"
      ? item.name
      : typeof item.fileName === "string"
        ? item.fileName
        : preserved?.name ?? getBasenameFromPath(urlCandidate);

  const fileTypeCandidate = isFileType(item.fileType)
    ? item.fileType
    : preserved?.fileType ?? fallbackType;

  return {
    url: urlCandidate,
    name: nameCandidate,
    fileType: fileTypeCandidate,
  };
}

function normalizeDocumentValue(
  value: unknown,
  fallbackType: FileType,
  preservedEntries: UploadedFileEntry[],
): UploadedFileEntry[] {
  const values = Array.isArray(value) ? value : [value];

  return values
    .map((item) => {
      const itemUrl =
        typeof item === "string"
          ? item
          : item && typeof item === "object"
            ? (resolveDocumentValueEntry(item, fallbackType)?.url ?? "")
            : "";
      const preserved = itemUrl
        ? preservedEntries.find((entry) => entry.url === itemUrl)
        : undefined;
      return resolveDocumentValueEntry(item, fallbackType, preserved);
    })
    .filter((item): item is UploadedFileEntry => Boolean(item));
}

/**
 * Display-only lookup cache for storage key -> original upload name.
 * `null` marks a key the backend could not resolve, so it is never requested twice.
 * Module level on purpose: several viewers on one page share the same keys.
 */
const originalFileNameCache = new Map<string, string | null>();
const ORIGINAL_NAME_BATCH_SIZE = 50;

/**
 * A detail page mounts several viewers at once, so keys requested inside the same
 * short window are merged into a single call instead of one call per field.
 * Every in-flight key keeps its own promise, so a viewer always waits for the
 * batch that actually carries its keys and never reads the cache too early.
 */
const ORIGINAL_NAME_BATCH_WINDOW_MS = 16;

const inFlightOriginalNameRequests = new Map<string, Promise<void>>();
let pendingBatchKeys: string[] = [];
let pendingBatchSettled: {
  promise: Promise<void>;
  resolve: () => void;
} | null = null;
let batchTimer: ReturnType<typeof setTimeout> | null = null;

const runOriginalNameBatch = async (keys: string[]) => {
  try {
    const items = await getOriginalFileNames(keys);
    // Results are matched back by key, never by response order, so a viewer
    // cannot pick up a name that belongs to another field.
    const resolved = new Map(
      items.map((item) => [item.key, item.originalFileName || null]),
    );
    keys.forEach((key) => {
      originalFileNameCache.set(key, resolved.get(key) || null);
    });
  } catch {
    // Name resolution is display-only; keep the key basename when it fails.
    keys.forEach((key) => {
      if (!originalFileNameCache.has(key)) {
        originalFileNameCache.set(key, null);
      }
    });
  }
};

const flushOriginalNameBatch = () => {
  batchTimer = null;
  const keys = pendingBatchKeys;
  const settled = pendingBatchSettled;
  pendingBatchKeys = [];
  pendingBatchSettled = null;
  if (!settled) return;

  const chunks: string[][] = [];
  for (let index = 0; index < keys.length; index += ORIGINAL_NAME_BATCH_SIZE) {
    chunks.push(keys.slice(index, index + ORIGINAL_NAME_BATCH_SIZE));
  }

  Promise.all(chunks.map(runOriginalNameBatch)).then(() => {
    keys.forEach((key) => {
      if (inFlightOriginalNameRequests.get(key) === settled.promise) {
        inFlightOriginalNameRequests.delete(key);
      }
    });
    settled.resolve();
  });
};

/**
 * Queues the missing keys onto the shared batch and resolves once every batch
 * holding one of them has written its results into the cache.
 */
const resolveOriginalFileNames = (keys: string[]): Promise<void> => {
  const waits: Promise<void>[] = [];

  keys.forEach((key) => {
    const inFlight = inFlightOriginalNameRequests.get(key);
    if (inFlight) {
      waits.push(inFlight);
      return;
    }

    if (!pendingBatchSettled) {
      let resolveBatch: () => void = () => undefined;
      const promise = new Promise<void>((resolve) => {
        resolveBatch = resolve;
      });
      pendingBatchSettled = { promise, resolve: resolveBatch };
    }

    pendingBatchKeys.push(key);
    inFlightOriginalNameRequests.set(key, pendingBatchSettled.promise);
    waits.push(pendingBatchSettled.promise);
  });

  if (pendingBatchKeys.length > 0 && batchTimer === null) {
    batchTimer = setTimeout(
      flushOriginalNameBatch,
      ORIGINAL_NAME_BATCH_WINDOW_MS,
    );
  }

  return waits.length > 0
    ? Promise.all(waits).then(() => undefined)
    : Promise.resolve();
};

const applyCachedOriginalNames = (
  entries: UploadedFileEntry[],
): UploadedFileEntry[] => {
  let changed = false;
  const next = entries.map((entry) => {
    const cachedName = originalFileNameCache.get(entry.url);
    if (!cachedName || entry.name === cachedName) return entry;
    changed = true;
    return { ...entry, name: cachedName };
  });

  return changed ? next : entries;
};

const FILE_NAME_ELLIPSIS = "....";

/** Probe width is often slightly under real layout (Inter/CJK/subpixel). */
const MEASURE_WIDTH_FUDGE = 1.18;

/** Subpixel / rounding slack vs container clientWidth. */
const TEXT_FIT_WIDTH_SLACK_PX = 6;

/**
 * Measures text using the same layout engine as on-screen text (canvas measureText is often
 * wrong for CJK + Latin mixes, which caused full names to be shown then clipped by overflow).
 */
function measureTextWidthDom(text: string, referenceEl: HTMLElement): number {
  if (!text) return 0;
  const doc = referenceEl.ownerDocument;
  const span = doc.createElement("span");
  span.setAttribute("aria-hidden", "true");
  span.style.cssText = [
    "position:absolute",
    "left:-99999px",
    "top:0",
    "white-space:nowrap",
    "visibility:hidden",
    "pointer-events:none",
  ].join(";");
  const cs = getComputedStyle(referenceEl);
  span.style.font = cs.font;
  span.style.letterSpacing = cs.letterSpacing;
  span.style.fontFeatureSettings = cs.fontFeatureSettings;
  span.style.fontVariantNumeric = cs.fontVariantNumeric;
  doc.body.appendChild(span);
  span.textContent = text;
  const w = span.getBoundingClientRect().width;
  doc.body.removeChild(span);
  return w;
}

/**
 * Fits basename into maxWidthPx using DOM measurement on the real label styles.
 * With an extension, keeps ext and inserts "...." before it.
 */
function fitBasenameToWidth(base: string, maxWidthPx: number, referenceEl: HTMLElement): string {
  if (!base) return "";
  if (maxWidthPx <= 1) return base;

  const budget = Math.max(0, maxWidthPx - TEXT_FIT_WIDTH_SLACK_PX);
  const m = (t: string) =>
    measureTextWidthDom(t, referenceEl) * MEASURE_WIDTH_FUDGE + 1;
  if (m(base) <= budget) return base;

  const lastDot = base.lastIndexOf(".");
  const hasExt = lastDot > 0 && lastDot < base.length - 1;
  const stem = hasExt ? base.slice(0, lastDot) : base;
  const ext = hasExt ? base.slice(lastDot) : "";

  if (hasExt) {
    const suffix = FILE_NAME_ELLIPSIS + ext;
    if (m(suffix) > budget) {
      return m(ext) <= budget ? ext : FILE_NAME_ELLIPSIS;
    }
    let low = 0;
    let high = stem.length;
    let best = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const candidate = stem.slice(0, mid) + suffix;
      if (m(candidate) <= budget) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return stem.slice(0, best) + suffix;
  }

  if (m(FILE_NAME_ELLIPSIS) > budget) return FILE_NAME_ELLIPSIS;
  let low = 0;
  let high = stem.length;
  let best = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const candidate = stem.slice(0, mid) + FILE_NAME_ELLIPSIS;
    if (m(candidate) <= budget) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return stem.slice(0, best) + FILE_NAME_ELLIPSIS;
}

/**
 * File name sits in .file-info; preview/delete live in sibling .file-actions, so layout width
 * for the label already excludes those icons. Uses parent .file-info width when span is not yet sized.
 */
function availableWidthForFileNameLabel(span: HTMLSpanElement): number {
  const w = span.clientWidth;
  if (w >= 2) return Math.floor(w);
  const parent = span.parentElement;
  if (!parent) return 0;
  const icon = parent.querySelector(".file-icon") as HTMLElement | null;
  const iconW = icon?.getBoundingClientRect().width ?? 24;
  const cs = getComputedStyle(parent);
  const gap = parseFloat(cs.columnGap || cs.gap) || 12;
  return Math.max(0, Math.floor(parent.clientWidth - iconW - gap));
}

/** True if text fits in a box of maxWidthPx with same typography as reference (uses scrollWidth). */
function textFitsBox(
  text: string,
  boxWidthPx: number,
  referenceEl: HTMLElement,
): boolean {
  if (!text || boxWidthPx <= 1) return true;
  const span = referenceEl.ownerDocument.createElement("span");
  span.style.cssText = [
    "position:absolute",
    "left:-99999px",
    "visibility:hidden",
    "white-space:nowrap",
    "overflow:hidden",
    `width:${Math.floor(boxWidthPx)}px`,
    "box-sizing:border-box",
  ].join(";");
  const cs = getComputedStyle(referenceEl);
  span.style.font = cs.font;
  span.style.letterSpacing = cs.letterSpacing;
  span.style.fontFeatureSettings = cs.fontFeatureSettings;
  span.style.fontVariantNumeric = cs.fontVariantNumeric;
  span.textContent = text;
  referenceEl.ownerDocument.body.appendChild(span);
  const ok = span.scrollWidth <= span.clientWidth + 1;
  span.remove();
  return ok;
}

function fitBasenameToVisibleMax(
  base: string,
  maxWidthPx: number,
  referenceEl: HTMLElement,
): string {
  let w = Math.max(8, Math.floor(maxWidthPx - TEXT_FIT_WIDTH_SLACK_PX));
  let text = fitBasenameToWidth(base, w, referenceEl);
  for (let i = 0; i < 16 && !textFitsBox(text, maxWidthPx, referenceEl); i++) {
    w = Math.max(8, Math.floor(w * 0.9));
    text = fitBasenameToWidth(base, w, referenceEl);
  }
  return text;
}

const DocumentFileName: React.FC<{ raw: string }> = ({ raw }) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const basename = getBasenameFromPath(raw);
  const [displayText, setDisplayText] = useState(basename);

  useLayoutEffect(() => {
    setDisplayText(basename);
    const el = spanRef.current;
    if (!el) return;

    const apply = () => {
      const w = availableWidthForFileNameLabel(el);
      if (w < 2) return;
      setDisplayText(fitBasenameToVisibleMax(basename, w, el));
    };

    apply();
    const ro = new ResizeObserver(() => apply());
    const observeTarget = el.parentElement ?? el;
    ro.observe(observeTarget);
    return () => ro.disconnect();
  }, [basename]);

  if (!basename) return null;

  return (
    <span ref={spanRef} className="file-name" title={basename}>
      {displayText}
    </span>
  );
};

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  fileName,
  fileUrl,
  fileType = "PDF",
  className,
  hasView = true,
  hasDelete = false,
  hasReupload = false,
  hasDownload = false,
  onView,
  onDelete,
  onDownload,
  uploadConfig,
  disabled = false,
  value,
  onChange,
  reuploadTooltip,
}) => {
  const field = useField<unknown>();
  const form = useForm();
  const { t } = useTranslation();
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  const formPattern = (form as { pattern?: string } | undefined)?.pattern;
  const fieldPattern = (field as { pattern?: string } | undefined)?.pattern;
  const effectiveDisabled =
    disabled ||
    isNonEditablePattern(formPattern) ||
    isNonEditablePattern(fieldPattern);
  const shouldShowDownload =
    hasDownload ||
    effectiveDisabled ||
    isReviewPattern(formPattern) ||
    isReviewPattern(fieldPattern);
  const getInitialFileList = React.useCallback(() => {
    if (fileName || fileUrl) {
      return [{
        url: fileUrl || fileName || "",
        name: fileName || fileUrl || "",
        fileType,
      }];
    }

    return [];
  }, [fileName, fileType, fileUrl]);

  const [uploadedFileList, setUploadedFileList] = useState<
    UploadedFileEntry[]
  >(getInitialFileList);
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [pdfVisible, setPdfVisible] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [videoVisible, setVideoVisible] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [currentFileData, setCurrentFileData] = useState<{
    url?: string;
    name?: string;
  }>({});
  const [scale, setScale] = useState(100);

  // Password handling states
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordCallback, setPasswordCallback] = useState<
    ((password: string) => void) | null
  >(null);
  const previewDisabled = isLoading;
  const downloadDisabled = !shouldShowDownload || isLoading;
  // Browser media elements cannot attach the bearer token, so protected preview
  // sources are streamed through the authenticated client as object URLs.
  const authenticatedPdfUrl = useAuthenticatedDocumentUrl(pdfUrl);
  const authenticatedImageUrl = useAuthenticatedDocumentUrl(imagePreviewUrl);

  React.useEffect(() => {
    if (onChange) {
      const explicitEmpty =
        value === "" ||
        value === null ||
        (Array.isArray(value) && value.length === 0);

      if (value !== undefined && value !== null && value !== "") {
        setUploadedFileList((prev) =>
          normalizeDocumentValue(value, fileType, prev).map((entry) => ({
            ...entry,
            name: entry.name || getFileDisplayName(entry.url),
          })),
        );
      } else if (explicitEmpty) {
        setUploadedFileList([]);
      } else if (value === undefined && (fileName || fileUrl)) {
        setUploadedFileList(getInitialFileList());
      } else if (!fileName && !fileUrl) {
        setUploadedFileList([]);
      }
    } else if (fileName || fileUrl) {
      setUploadedFileList(getInitialFileList());
    } else {
      setUploadedFileList([]);
    }
  }, [value, fileName, fileUrl, onChange, getInitialFileList, fileType]);

  // The stored value only carries the storage key, so a record reopened in a later
  // session falls back to the key basename. Resolve the original upload name for
  // display only: value, onChange payload and the submit path stay untouched.
  // Stable dependency for the lookup below: only entries still showing the storage
  // basename need resolving, so unrelated list updates cannot re-trigger the effect.
  const fallbackNameKeys = Array.from(
    new Set(
      uploadedFileList
        .filter(
          (entry) =>
            Boolean(entry.url) &&
            entry.name === getBasenameFromPath(entry.url),
        )
        .map((entry) => entry.url),
    ),
  ).join("\n");

  React.useEffect(() => {
    let cancelled = false;

    const fallbackKeys = fallbackNameKeys ? fallbackNameKeys.split("\n") : [];

    if (fallbackKeys.some((key) => originalFileNameCache.has(key))) {
      // applyCachedOriginalNames returns the same array reference when nothing
      // changes, so React bails out instead of looping on this effect.
      setUploadedFileList(applyCachedOriginalNames);
    }

    const missingKeys = fallbackKeys.filter(
      (key) => !originalFileNameCache.has(key),
    );

    if (missingKeys.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    resolveOriginalFileNames(missingKeys).then(() => {
      if (cancelled) return;
      setUploadedFileList(applyCachedOriginalNames);
    });

    return () => {
      cancelled = true;
    };
  }, [fallbackNameKeys]);

  const onPassword = (callback: (password: string) => void, reason: number) => {
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
    setPdfVisible(false);
  };

  const handleZoomIn = () => {
    setScale((currentScale) => Math.min(200, currentScale + 10));
  };

  const handleZoomOut = () => {
    setScale((currentScale) => Math.max(50, currentScale - 10));
  };

  // Built-in upload method
  const uploadFile = async (options: DocumentViewerUploadRequest) => {
    const { file, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append("files", file);
    try {
      setIsLoading(true);
      const response = await fileUpload(formData);
      const url = getDocumentUploadResponseUrl(response);
      if (url) {
        onSuccess?.(url);
      } else {
        onError?.(new Error("Upload response did not include a file URL."));
      }
    } catch (error) {
      console.error("Upload failed:", error);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getFileIcon = (fileUrl?: string, type?: FileType) => {
    // If fileUrl exists and is a string, extract file extension from it
    if (fileUrl && typeof fileUrl === "string") {
      const fileName = fileUrl.toLowerCase();
      if (fileName.includes(".pdf")) {
        return FilePdfIcon;
      } else if (fileName.includes(".jpg")) {
        return FileJpgIcon;
      } else if (fileName.includes(".png")) {
        return FilePngIcon;
      } else if (fileName.includes(".jpeg")) {
        return FileJpegIcon;
      } else if (VIDEO_FILE_PATTERN.test(fileName)) {
        return FileVideoIcon;
      }
    }

    // Fallback to the provided fileType prop
    if (type) {
      const upperType = type.toUpperCase();
      switch (upperType) {
        case "PDF":
          return FilePdfIcon;
        case "JPG":
          return FileJpgIcon;
        case "PNG":
          return FilePngIcon;
        case "JPEG":
          return FileJpegIcon;
        case "MP4":
        case "MOV":
        case "M4V":
        case "WEBM":
        case "OGV":
        case "AVI":
        case "MKV":
          return FileVideoIcon;
        default:
          return FilePdfIcon;
      }
    }

    return FilePdfIcon;
  };

  const getFileDisplayName = (name?: string) =>
    name ? getBasenameFromPath(name) : "";

  const getResolvedFileUrl = (url: string) => resolveDocumentAccessUrl(url);

  const handleDelete = (index: number) => {
    if (onDelete) {
      onDelete();
    } else {
      const newFileList = uploadedFileList.filter((_, i) => i !== index);
      setUploadedFileList(newFileList);

      // Update form value
      if (onChange) {
        if (newFileList.length === 0) {
          onChange(maxCount > 1 ? [] : "");
        } else {
          const fileNames = newFileList.map((file) => file.url);
          onChange(maxCount > 1 ? fileNames : fileNames[0]);
        }
      }
    }
  };

  const handleView = async (fileData: UploadedFileEntry) => {
    if (onView) {
      onView();
    } else {
      setCurrentFileData(fileData);
      if (isPdfFile(fileData.name, fileData.url)) {
        setPdfUrl(resolvePdfPreviewUrl(fileData.url));
        setScale(100);
        setPdfPassword("");
        setPasswordError("");
        setPasswordCallback(null);
        setPdfVisible(true);
      } else if (isVideoFile(fileData)) {
        setVideoUrl(getResolvedFileUrl(fileData.url));
        setVideoVisible(true);
      } else {
        setImagePreviewUrl(getResolvedFileUrl(fileData.url));
        setImagePreviewVisible(true);
      }
    }
  };

  const handleDownload = async (fileData: { url: string; name: string }) => {
    if (onDownload) {
      onDownload();
    } else {
      try {
        setIsLoading(true);
        await downloadDocumentFile(fileData.url, fileData.name || "download");
      } catch (error) {
        console.error("Download failed:", error);
        CustomMessage.error(t("common.downloadFailed"));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleUploadSuccess = (fileData: { url: string; name: string }[]) => {
    if (fileData && fileData.length > 0) {
      const newFileList = fileData.map((file) => ({
        ...file,
        fileType,
      }));
      const newlyUploadedFiles = newFileList.filter(
        (file) =>
          !uploadedFileList.some(
            (existingFile) =>
              existingFile.url === file.url && existingFile.name === file.name,
          ),
      );
      setUploadedFileList(newFileList);

      // Update form value
      if (onChange) {
        const fileNames = newFileList.map((file) => file.url);
        onChange(maxCount > 1 ? fileNames : fileNames[0]);
      }

      if (uploadConfig?.onUploadSuccess && newlyUploadedFiles.length > 0) {
        uploadConfig.onUploadSuccess(newlyUploadedFiles);
      }
    }
  };

  const maxCount = uploadConfig?.maxCount || 1;
  const showUploadComponent =
    uploadConfig &&
    (uploadedFileList.length === 0 ||
      (maxCount > 1 && uploadedFileList.length < maxCount));

  const beforeUpload = (file: RcFile) => {
    const allowedMimeTypes: string[] = [];
    const accept =
      uploadConfig?.accept?.replaceAll(".", "") || "pdf,jpg,jpeg,png";
    accept.split(",").forEach((mimeType) => {
      allowedMimeTypes.push(mimeType.trim().toLowerCase());
    });
    if (allowedMimeTypes.includes(file.type?.split("/")[1]?.toLowerCase())) {
      return true;
    } else {
      CustomMessage.error(
        uploadConfig?.invalidFileTypeMessage || t("common.invalidFileType"),
      );
      return false;
    }
  };

  const triggerReuploadPicker = () => {
    if (effectiveDisabled || isLoading || !uploadConfig || !hasReupload) return;
    reuploadInputRef.current?.click();
  };

  const handleReuploadInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    e.target.value = "";
    if (!rawFile || !uploadConfig || effectiveDisabled) return;

    const maxMb = uploadConfig.maxSize || 5;
    if (rawFile.size / 1024 / 1024 > maxMb) {
      CustomMessage.error(
        uploadConfig.maxSizeErrorMessage || `File size exceeds ${maxMb}MB`,
      );
      return;
    }

    const rcFile = rawFile as RcFile;
    const passed = uploadConfig.beforeUpload
      ? uploadConfig.beforeUpload(rcFile)
      : beforeUpload(rcFile);
    if (!passed) return;

    const requestFn = uploadConfig.customRequest || uploadFile;
    requestFn({
      file: rcFile,
      onSuccess: (url: string) => {
        const entry = {
          url,
          name: rawFile.name,
          fileType,
        };
        setUploadedFileList([entry]);
        if (onChange) {
          onChange(url);
        }
        uploadConfig.onUploadSuccess?.([entry]);
      },
      onError: () => undefined,
    });
  };

  return (
    <div className={["document-viewer-wrapper", className].filter(Boolean).join(" ")}>
      {uploadConfig && hasReupload ? (
        <input
          ref={reuploadInputRef}
          type="file"
          accept={uploadConfig.accept || ".pdf"}
          style={{ display: "none" }}
          aria-hidden="true"
          tabIndex={-1}
          onChange={handleReuploadInputChange}
        />
      ) : null}

      {/* Upload component - show when no files or can upload more */}
      {showUploadComponent && (
        <FileUpload
          value={uploadedFileList}
          onChange={handleUploadSuccess}
          maxCount={maxCount}
          maxSize={uploadConfig.maxSize || 5}
          accept={uploadConfig.accept || ".pdf,.jpg,.jpeg,.png"}
          placeholder={uploadConfig.placeholder || t("common.uploadFile")}
          uploadTip={uploadConfig.uploadTip}
          maxSizeErrorMessage={uploadConfig.maxSizeErrorMessage}
          customRequest={uploadConfig.customRequest || uploadFile}
          disabled={effectiveDisabled || uploadedFileList.length >= maxCount}
          beforeUpload={uploadConfig?.beforeUpload || beforeUpload}
          hideFileList
        />
      )}

      {/* File list - show all uploaded files */}
      {uploadedFileList.map((fileData, index) => (
        <div
          key={index}
          className="document-file"
          style={{ marginTop: showUploadComponent ? "10px" : "0" }}
        >
          <div className="file-info">
            <img
              src={getFileIcon(fileData.url, fileData.fileType || fileType)}
              alt={t("common.file")}
              className="file-icon"
            />
            <DocumentFileName raw={fileData.name || fileData.url} />
          </div>
          <div className="file-actions">
            {hasView && (
              <img
                src={EyeIcon}
                alt={t("common.view")}
                className={`action-icon ${isLoading ? "loading" : ""} ${previewDisabled ? "is-disabled" : ""}`}
                onClick={previewDisabled ? undefined : () => handleView(fileData)}
              />
            )}
            {hasReupload && uploadConfig && !effectiveDisabled ? (
              <UploadOutlined
                className={`action-icon ant-document-viewer-reupload ${isLoading ? "loading" : ""}`}
                title={reuploadTooltip || t("common.uploadFile")}
                aria-label={reuploadTooltip || t("common.uploadFile")}
                onClick={triggerReuploadPicker}
              />
            ) : null}
            {shouldShowDownload && (
              <img
                src={DownloadIcon}
                alt={t("common.download")}
                className={`action-icon ${isLoading ? "loading" : ""} ${downloadDisabled ? "is-disabled" : ""}`}
                onClick={downloadDisabled ? undefined : () => handleDownload(fileData)}
              />
            )}
            {hasDelete && !effectiveDisabled && (
              <img
                src={TrashIcon}
                alt={t("common.delete")}
                className="action-icon"
                onClick={() => handleDelete(index)}
              />
            )}
          </div>
        </div>
      ))}

      {/* Show single file view for non-upload mode */}
      {/* {!uploadConfig && fileName && (
        <div className="document-file">
          <div className="file-info">
            <img
              src={getFileIcon(fileUrl, fileType)}
              alt="file"
              className="file-icon"
            />
            <span className="file-name">{getFileDisplayName(fileName)}</span>
          </div>
          <div className="file-actions">
            {hasView && onView && (
              <img
                src={EyeIcon}
                alt="view"
                className={`action-icon ${isLoading ? "loading" : ""}`}
                onClick={onView}
              />
            )}
            {hasDownload && onDownload && (
              <img
                src={DownloadIcon}
                alt="download"
                className={`action-icon ${isLoading ? "loading" : ""}`}
                onClick={onDownload}
              />
            )}
            {hasDelete && !disabled && onDelete && (
              <img
                src={TrashIcon}
                alt="delete"
                className="action-icon"
                onClick={onDelete}
              />
            )}
          </div>
        </div>
      )} */}

      {imagePreviewUrl && authenticatedImageUrl && (
        <Image
          wrapperClassName="document-viewer-hidden-preview"
          src={authenticatedImageUrl}
          preview={{
            visible: imagePreviewVisible,
            src: authenticatedImageUrl,
            onVisibleChange: (value) => {
              setImagePreviewVisible(value);
              if (!value) {
                setImagePreviewUrl("");
              }
            },
          }}
        />
      )}

      <Modal
        title={(
          <div className="document-viewer__modal-title">
            <span className="document-viewer__modal-title-text">
              {currentFileData.name || t("sharedComponents.previewModal.defaultTitle")}
            </span>
            {pdfUrl && currentFileData.url ? (
              <img
                src={DownloadIcon}
                alt={t("common.download")}
                title={t("common.download")}
                className={`document-viewer__pdf-download ${downloadDisabled ? "is-disabled" : ""}`}
                onClick={
                  downloadDisabled
                    ? undefined
                    : () => handleDownload({
                      url: currentFileData.url || "",
                      name: currentFileData.name || "",
                    })
                }
              />
            ) : null}
          </div>
        )}
        visible={pdfVisible}
        onCancel={() => {
          setPdfVisible(false);
          setPasswordVisible(false);
          setPdfPassword("");
          setPasswordError("");
          setPasswordCallback(null);
          setScale(100);
        }}
        width="90vw"
        className="document-viewer-preview-modal"
        style={{ maxWidth: "90%", top: 20 }}
        footer={null}
        centered
        destroyOnClose
      >
        <div className="document-viewer__preview-shell">
          {authenticatedPdfUrl && (
          <div className="document-viewer__pdf-stage">
          <PdfScrollPreview
          file={authenticatedPdfUrl}
                scale={scale}
                className="document-viewer__pdf-preview"
                onDocumentLoadSuccess={() => {
                  setPasswordVisible(false);
                  setPdfPassword("");
                  setPasswordError("");
                  setPasswordCallback(null);
                }}
                onPassword={onPassword}
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
          )}
        </div>
      </Modal>

      <Modal
        title={currentFileData.name || t("sharedComponents.previewModal.defaultTitle")}
        visible={videoVisible}
        onCancel={() => {
          setVideoVisible(false);
          setVideoUrl("");
        }}
        width="90vw"
        className="document-viewer-video-modal"
        footer={null}
        centered
        destroyOnClose
      >
        {videoUrl ? (
          <div className="document-viewer-video-modal__stage">
            <video
              className="document-viewer-video-modal__player"
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        title={t("sharedComponents.previewModal.password.title")}
        visible={passwordVisible}
        onCancel={handlePasswordCancel}
        footer={[
          <CustomButton
            key="cancel"
            text={t("common.cancel")}
            variant="outline"
            size="large"
            onClick={handlePasswordCancel}
          />,
          <CustomButton
            key="submit"
            text={t("common.confirm")}
            variant="primary"
            size="large"
            onClick={handlePasswordSubmit}
          />,
        ]}
        className="document-viewer-password-modal"
        destroyOnClose
        zIndex={1001}
        centered
        closable={false}
        maskClosable={false}
      >
        <div className="document-viewer-password-modal__body">
          <div className="document-viewer-password-modal__message">
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
            className="document-viewer-password-modal__input"
          />
          {passwordError ? (
            <div className="document-viewer-password-modal__error">
              {passwordError}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

export default DocumentViewer;
