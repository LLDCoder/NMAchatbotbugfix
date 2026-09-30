import request from "@/utils/request";
import { getAllowedOrigins } from "@/utils/allowedOrigins";
import {
  getInspectionTaskReportPdfFile,
  type GetInspectionReportPreviewParams,
  type InspectionReportPdfFile,
} from "@/services/inspection";
import { DocumentPreview } from "@/utils/url";

const DOCUMENT_DOWNLOAD_PATH = /^\/api\/Document\/(?:Dowload|Download)$/i;
const PDF_PREVIEW_PATH = /^\/api\/pdf\/preview$/i;

const getResponseData = <T,>(response: unknown): T => {
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data: T }).data;
  }
  return response as T;
};

const isSpecialBrowserUrl = (value: string) => /^(?:blob|data):/i.test(value);
const isAbsoluteUrl = (value: string) => /^[a-z][a-z0-9+.-]*:/i.test(value);

const getEndpointFileName = (value: string) => {
  try {
    const parsedUrl = new URL(value, window.location.origin);
    if (!DOCUMENT_DOWNLOAD_PATH.test(parsedUrl.pathname) && !PDF_PREVIEW_PATH.test(parsedUrl.pathname)) return "";
    return parsedUrl.searchParams.get("fileName")?.trim() || "";
  } catch {
    return "";
  }
};

const getFileNameFromPath = (path: string) => {
  const fileName = path.split(/[?#]/)[0].split("/").filter(Boolean).pop()?.trim();
  if (!fileName) return "";

  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
};

const buildPdfPreviewUrl = (filePath: string) => (
  `${DocumentPreview}${encodeURIComponent(filePath.replace(/^\/+/, ""))}`
);

const getApiBaseOrigins = () => {
  return getAllowedOrigins(window.location.origin, [
    String(import.meta.env.VITE_ALLOWED_DOCUMENT_ORIGINS ?? ""),
  ]);
};

const getReportFilePath = (value: string) => {
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

const resolveReportDownloadUrl = (fileUrl: string) => {
  const value = fileUrl.trim();
  if (!value || isSpecialBrowserUrl(value)) return value;

  const filePath = getReportFilePath(value);
  if (!filePath) return "";
  if (isAbsoluteUrl(filePath)) return filePath;

  return buildPdfPreviewUrl(filePath);
};

export const hasInspectionReportPdfFile = (
  file?: Partial<InspectionReportPdfFile> | null,
): file is InspectionReportPdfFile => Boolean(
  file?.fileName?.trim() && file?.fileUrl?.trim(),
);

const triggerDownload = (downloadUrl: string, fileName: string) => {
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName.trim();
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
      throw new Error(payload.message || "Report download failed.");
    }
  } catch (error) {
    if (error instanceof Error) throw error;
  }
};

const fetchReportBlob = (downloadUrl: string) => (
  request.get<Blob, Blob>(
    downloadUrl,
    undefined,
    {
      responseType: "blob",
      skipErrorMessage: true,
    },
  )
);

const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const downloadUrl = URL.createObjectURL(blob);
  try {
    triggerDownload(downloadUrl, fileName);
  } finally {
    URL.revokeObjectURL(downloadUrl);
  }
};

export const downloadInspectionReportFile = async (file: InspectionReportPdfFile) => {
  if (!hasInspectionReportPdfFile(file)) return false;

  const downloadUrl = resolveReportDownloadUrl(file.fileUrl);
  if (!downloadUrl) return false;

  if (isSpecialBrowserUrl(downloadUrl)) {
    triggerDownload(downloadUrl, file.fileName);
    return true;
  }

  const blob = await fetchReportBlob(downloadUrl);
  await parseJsonBlobError(blob);
  triggerBlobDownload(blob, file.fileName);
  return true;
};

export const getInspectionViolationReportFile = (
  violationReportUrl?: string | null,
): InspectionReportPdfFile | null => {
  const fileUrl = violationReportUrl?.trim();
  if (!fileUrl) return null;

  return {
    fileName: getFileNameFromPath(fileUrl) || "Violation Report.pdf",
    fileUrl,
  };
};

export const downloadInspectionViolationReport = async (
  violationReportUrl?: string | null,
) => {
  const file = getInspectionViolationReportFile(violationReportUrl);
  if (!file) return false;

  return downloadInspectionReportFile(file);
};

export const downloadInspectionTaskReportPdf = async (
  params: GetInspectionReportPreviewParams,
) => {
  const response = await getInspectionTaskReportPdfFile(params);
  const file = getResponseData<InspectionReportPdfFile | null>(response);
  if (!hasInspectionReportPdfFile(file)) return false;

  return downloadInspectionReportFile(file);
};
