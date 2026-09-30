import request from "@/utils/request";
import type { AxiosRequestConfig } from "axios";

type RawBlobResponse = {
    data: Blob;
};

export type DocumentUploadResult = {
    fileName: string;
    fileUrl: string;
    contentType?: string;
};

export const fileUpload = (files: FormData, config: AxiosRequestConfig = {}) => {
    return request.post("/api/Document/Upload", files, {
        ...config,
        headers: {
            ...config.headers,
            "Content-Type": "multipart/form-data",
        }
    }
    );
};

const getTextValue = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    return "";
};

export const getDocumentUploadResponseUrl = (response: unknown): string => {
    if (!response) return "";

    const directText = getTextValue(response);
    if (directText) return directText;

    if (Array.isArray(response)) {
        return response.map(getDocumentUploadResponseUrl).find(Boolean) || "";
    }

    if (typeof response !== "object") return "";

    const payload = response as Record<string, unknown>;
    return (
        getDocumentUploadResponseUrl(payload.key) ||
        getDocumentUploadResponseUrl(payload.url) ||
        getDocumentUploadResponseUrl(payload.fileUrl) ||
        getDocumentUploadResponseUrl(payload.filePath) ||
        getDocumentUploadResponseUrl(payload.data)
    );
};

export const uploadDocumentFile = async (file: File): Promise<DocumentUploadResult> => {
    const formData = new FormData();
    formData.append("files", file);

    const response = await fileUpload(formData);
    const fileUrl = getDocumentUploadResponseUrl(response);

    if (!fileUrl) {
        throw new Error("Upload response did not include a file URL.");
    }

    return {
        fileName: file.name,
        fileUrl,
        contentType: file.type || undefined,
    };
};

export interface FileOriginalNameDto {
    key: string;
    originalFileName: string | null;
}

type FileOriginalNamesResponse =
    | FileOriginalNameDto[]
    | { data?: FileOriginalNameDto[] };

// Display-only lookup: resolves storage keys back to the original upload names.
// Failures must stay silent so the caller can keep the key basename fallback.
export const getOriginalFileNames = async (
    keys: string[],
): Promise<FileOriginalNameDto[]> => {
    const response = await request.post<
        FileOriginalNamesResponse,
        FileOriginalNamesResponse
    >(
        "/api/Document/OriginalNames",
        { keys },
        { skipErrorMessage: true },
    );

    if (Array.isArray(response)) return response;
    return Array.isArray(response?.data) ? response.data : [];
};

export const fileDowload = (fileName:string) => {
    return request.get(`/api/Document/Dowload?fileName=${fileName}`);
};

const DOCUMENT_DOWNLOAD_PATH = /^\/api\/Document\/(?:Dowload|Download)$/i;
const PDF_PREVIEW_PATH = /^\/api\/pdf\/preview$/i;

const DOCUMENT_DOWNLOAD_ENDPOINT = "/api/Document/Dowload";
const PDF_PREVIEW_ENDPOINT = "/api/pdf/preview";

type ProtectedDocumentTarget = {
    endpoint: string;
    fileName: string;
};

const parseDocumentUrl = (value: string) => {
    try {
        const baseUrl = typeof window === "undefined"
            ? "https://local.invalid"
            : window.location.origin;
        return new URL(value, baseUrl);
    } catch {
        return null;
    }
};

// Both the download and the pdf preview endpoints are token protected, so a
// caller reference is mapped back to the endpoint that actually serves it.
const getProtectedDocumentTarget = (
    fileReference: string,
): ProtectedDocumentTarget | null => {
    const value = fileReference.trim();
    if (!value) return null;

    const parsedUrl = parseDocumentUrl(value);
    if (!parsedUrl) return null;

    const isPdfPreview = PDF_PREVIEW_PATH.test(parsedUrl.pathname);
    if (!isPdfPreview && !DOCUMENT_DOWNLOAD_PATH.test(parsedUrl.pathname)) {
        return null;
    }

    return {
        endpoint: isPdfPreview ? PDF_PREVIEW_ENDPOINT : DOCUMENT_DOWNLOAD_ENDPOINT,
        fileName: parsedUrl.searchParams.get("fileName")?.trim() || "",
    };
};

const isExternalDocumentUrl = (fileReference: string) => {
    const value = fileReference.trim();
    if (!/^(https?:)?\/\//i.test(value)) return false;

    const parsedUrl = parseDocumentUrl(value);
    if (!parsedUrl) return true;

    return (
        !DOCUMENT_DOWNLOAD_PATH.test(parsedUrl.pathname) &&
        !PDF_PREVIEW_PATH.test(parsedUrl.pathname)
    );
};

const triggerDownload = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "download";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const ensureDownloadBlob = async (blob: Blob) => {
    if (!blob || blob.size === 0) {
        throw new Error("Download response was empty.");
    }

    if (!blob.type.toLowerCase().includes("json")) return;

    const responseText = await blob.text();
    if (!responseText) {
        throw new Error("Download failed.");
    }

    try {
        const payload = JSON.parse(responseText) as { message?: unknown };
        const message = getTextValue(payload.message);
        throw new Error(message || "Download failed.");
    } catch (error) {
        if (error instanceof Error && error.message !== "Unexpected end of JSON input") {
            throw error;
        }
        throw new Error("Download failed.");
    }
};

export const downloadDocumentFile = async (
    fileReference: string,
    displayName: string,
) => {
    const value = fileReference.trim();
    if (!value) {
        throw new Error("Document reference is required.");
    }

    const protectedTarget = getProtectedDocumentTarget(value);
    if (!protectedTarget && isExternalDocumentUrl(value)) {
        triggerDownload(value, displayName);
        return;
    }

    const endpoint = protectedTarget?.endpoint || DOCUMENT_DOWNLOAD_ENDPOINT;
    const fileName = protectedTarget ? protectedTarget.fileName : value;
    if (!fileName) {
        throw new Error("Document reference is required.");
    }

    const response = await request.get<Blob, RawBlobResponse>(
        endpoint,
        { fileName },
        {
            rawResponse: true,
            responseType: "blob",
            skipErrorMessage: true,
        },
    );
    const blob = response.data;
    await ensureDownloadBlob(blob);

    const downloadUrl = URL.createObjectURL(blob);
    try {
        triggerDownload(downloadUrl, displayName);
    } finally {
        URL.revokeObjectURL(downloadUrl);
    }
};
