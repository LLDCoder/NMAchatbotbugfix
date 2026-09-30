export type ProtectedDocumentTarget = {
  endpoint: string;
  fileName: string;
};

const DOCUMENT_DOWNLOAD_PATHS = new Set([
  "/api/document/dowload",
  "/api/document/download",
]);

const PDF_PREVIEW_PATH = "/api/pdf/preview";

const DOCUMENT_DOWNLOAD_ENDPOINT = "/api/Document/Dowload";
const PDF_PREVIEW_ENDPOINT = "/api/pdf/preview";
const PROTECTED_DOCUMENT_PLACEHOLDER_PREFIX =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=#protected-document:";

export const createProtectedDocumentPlaceholder = (source: string) =>
  `${PROTECTED_DOCUMENT_PLACEHOLDER_PREFIX}${encodeURIComponent(source)}`;

export const parseProtectedDocumentPlaceholder = (source: string) => {
  if (!source.startsWith(PROTECTED_DOCUMENT_PLACEHOLDER_PREFIX)) return null;

  try {
    return decodeURIComponent(
      source.slice(PROTECTED_DOCUMENT_PLACEHOLDER_PREFIX.length),
    );
  } catch {
    return null;
  }
};

const RICH_TEXT_MEDIA_SOURCE_PATTERN =
  /(<(?:img|video|source)\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2/gi;

export const maskProtectedDocumentHtmlSources = (
  html: string,
  baseOrigin: string,
  allowedOrigins: ReadonlySet<string>,
) =>
  html.replace(
    RICH_TEXT_MEDIA_SOURCE_PATTERN,
    (match, prefix: string, quote: string, source: string) => {
      if (!parseProtectedDocumentTarget(source, baseOrigin, allowedOrigins)) {
        return match;
      }

      return `${prefix}${quote}${createProtectedDocumentPlaceholder(source)}${quote}`;
    },
  );

export const restoreProtectedDocumentHtmlSources = (html: string) =>
  html.replace(
    RICH_TEXT_MEDIA_SOURCE_PATTERN,
    (match, prefix: string, quote: string, source: string) => {
      const restoredSource = parseProtectedDocumentPlaceholder(source);
      return restoredSource
        ? `${prefix}${quote}${restoredSource}${quote}`
        : match;
    },
  );

export const parseProtectedDocumentTarget = (
  value: string,
  baseOrigin: string,
  allowedOrigins: ReadonlySet<string>,
): ProtectedDocumentTarget | null => {
  try {
    const url = new URL(value, baseOrigin);
    if (!allowedOrigins.has(url.origin)) return null;

    const pathname = url.pathname.toLowerCase();
    const isPdfPreview = pathname === PDF_PREVIEW_PATH;
    if (!DOCUMENT_DOWNLOAD_PATHS.has(pathname) && !isPdfPreview) {
      return null;
    }

    const fileName = url.searchParams.get("fileName")?.trim() || "";
    if (!fileName) return null;

    return {
      endpoint: isPdfPreview
        ? PDF_PREVIEW_ENDPOINT
        : DOCUMENT_DOWNLOAD_ENDPOINT,
      fileName,
    };
  } catch {
    return null;
  }
};
