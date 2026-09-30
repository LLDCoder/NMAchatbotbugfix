import { DocumentPreview, ImageBaseUrl } from "@/utils/url";

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isProtocolRelativeUrl(value: string) {
  return /^\/\//.test(value);
}

function isRootRelativeUrl(value: string) {
  return value.startsWith("/") && !isProtocolRelativeUrl(value);
}

function isBlobOrDataUrl(value: string) {
  return value.startsWith("blob:") || value.startsWith("data:");
}

function encodePreviewFilePath(value: string) {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

function buildDocumentDownloadUrl(filePath: string) {
  return `${ImageBaseUrl}${encodePreviewFilePath(filePath)}`;
}

function buildPdfPreviewUrl(filePath: string) {
  return `${DocumentPreview}${encodePreviewFilePath(filePath)}`;
}

function getUrlFileName(value: string) {
  try {
    const parsedUrl = new URL(value, "https://local.invalid");
    const fileName = parsedUrl.searchParams.get("fileName");
    if (!fileName) return "";

    try {
      return decodeURIComponent(fileName);
    } catch {
      return fileName;
    }
  } catch {
    return "";
  }
}

function isDocumentDownloadUrl(value?: string) {
  const text = String(value ?? "").trim();
  if (!text) return false;

  try {
    return /\/api\/Document\/(?:Dowload|Download)$/i.test(
      new URL(text, "https://local.invalid").pathname,
    );
  } catch {
    return false;
  }
}

function isPdfPreviewUrl(value?: string) {
  const text = String(value ?? "").trim();
  if (!text) return false;

  try {
    return /\/api\/pdf\/preview$/i.test(
      new URL(text, "https://local.invalid").pathname,
    );
  } catch {
    return false;
  }
}

function isInvalidInspectionDeclarationMockFileUrl(value?: string) {
  const text = String(value ?? "").trim();
  if (!text) return false;

  try {
    return /^\/api\/admin\/inspection\/mock-files\/declarations\/.+\.pdf$/i.test(
      new URL(text, "https://local.invalid").pathname,
    );
  } catch {
    return false;
  }
}

function normalizePreviewFilePath(value?: string) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (isInvalidInspectionDeclarationMockFileUrl(text)) return "";
  if (isBlobOrDataUrl(text) || isPdfPreviewUrl(text)) return text;
  if (isDocumentDownloadUrl(text)) return getUrlFileName(text) || text;
  if (ImageBaseUrl && text.startsWith(ImageBaseUrl)) {
    return decodeURIComponent(text.slice(ImageBaseUrl.length));
  }
  if (DocumentPreview && text.startsWith(DocumentPreview)) {
    return decodeURIComponent(text.slice(DocumentPreview.length));
  }

  return text;
}

function isDirectPreviewUrl(value?: string) {
  const text = String(value ?? "").trim();
  if (!text || isDocumentDownloadUrl(text)) return false;

  return (
    isHttpUrl(text) ||
    isProtocolRelativeUrl(text) ||
    isRootRelativeUrl(text) ||
    isBlobOrDataUrl(text) ||
    isPdfPreviewUrl(text)
  );
}

export function resolveDocumentAccessUrl(value?: string) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (isDocumentDownloadUrl(text) || isDirectPreviewUrl(text)) {
    return text;
  }

  return buildDocumentDownloadUrl(normalizePreviewFilePath(text));
}

export function resolvePdfPreviewUrl(value?: string, filePath?: string) {
  const fallbackPath =
    normalizePreviewFilePath(filePath) ||
    normalizePreviewFilePath(value);
  if (!fallbackPath) return "";
  if (isDirectPreviewUrl(fallbackPath)) return fallbackPath;

  return buildPdfPreviewUrl(fallbackPath);
}

function hasPdfExtension(value?: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .split(/[?#]/)[0]
    .endsWith(".pdf");
}

export function isPdfFile(...values: Array<string | undefined>) {
  return values.some((value) => {
    const text = String(value ?? "").trim();
    if (!text) return false;

    return (
      hasPdfExtension(text) ||
      hasPdfExtension(getUrlFileName(text)) ||
      hasPdfExtension(normalizePreviewFilePath(text))
    );
  });
}
