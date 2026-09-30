const apiBaseUrl = String(import.meta.env.DEV ? "" : import.meta.env.VITE_API_BASE_URL ?? "")
  .trim()
  .replace(/^['"]|['"]$/g, "");

const buildApiUrl = (path: string) => (
  apiBaseUrl ? `${apiBaseUrl.replace(/\/+$/, "")}${path}` : path
);

const ImageBaseUrl = buildApiUrl("/api/Document/Dowload?fileName=");
const DocumentPreview = buildApiUrl("/api/pdf/preview?fileName=");
export { ImageBaseUrl, DocumentPreview };
