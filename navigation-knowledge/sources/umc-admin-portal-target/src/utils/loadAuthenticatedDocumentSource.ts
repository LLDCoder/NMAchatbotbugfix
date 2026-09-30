import request from "@/utils/request";
import { getAllowedOrigins } from "@/utils/allowedOrigins";
import {
  maskProtectedDocumentHtmlSources,
  parseProtectedDocumentTarget,
} from "@/utils/protectedDocumentTarget";

type RawBlobResponse = {
  data: Blob;
};

export type AuthenticatedDocumentSource = {
  source: string;
  objectUrl?: string;
  data?: ArrayBuffer;
};

const DOCUMENT_DOWNLOAD_ENDPOINT = "/api/Document/Dowload";

const getProtectedDocumentOrigins = () => {
  return getAllowedOrigins(window.location.origin, [
    String(import.meta.env.VITE_API_BASE_URL ?? ""),
    String(import.meta.env.VITE_ALLOWED_DOCUMENT_ORIGINS ?? ""),
  ]);
};

const isDirectBrowserSource = (value: string) =>
  /^(https?:|\/|data:|blob:)/i.test(value);

export const getProtectedDocumentTarget = (reference: string) =>
  parseProtectedDocumentTarget(
    reference,
    window.location.origin,
    getProtectedDocumentOrigins(),
  );

export const maskAuthenticatedDocumentHtmlSources = (html: string) =>
  maskProtectedDocumentHtmlSources(
    html,
    window.location.origin,
    getProtectedDocumentOrigins(),
  );

export const loadAuthenticatedDocumentSource = async (
  fileReference: string,
  signal?: AbortSignal,
): Promise<AuthenticatedDocumentSource> => {
  const reference = fileReference.trim();
  if (!reference) return { source: "" };

  const protectedTarget = getProtectedDocumentTarget(reference);

  if (!protectedTarget && isDirectBrowserSource(reference)) {
    return { source: reference };
  }

  const response = await request.get(
    protectedTarget?.endpoint || DOCUMENT_DOWNLOAD_ENDPOINT,
    { fileName: protectedTarget?.fileName || reference },
    {
      rawResponse: true,
      responseType: "blob",
      signal,
      skipErrorMessage: true,
    },
  ) as RawBlobResponse;

  const objectUrl = URL.createObjectURL(response.data);
  const data = await response.data.arrayBuffer();
  return { source: objectUrl, objectUrl, data };
};
