import request from "@/utils/request";
import { CustomMessage } from "@/components/common";

/**
 * Service 7 (Ground Photography Permit) external-approval PDF export.
 *
 * The backend exposes a single endpoint that renders one of two forms as a PDF
 * and streams it back:
 *   GET /api/Application/{applicationId}/photography-documents/download
 *       ?documentType=application-form
 *       ?documentType=team-member&memberId=<member id>
 *
 * Success -> 200 application/pdf (binary, taken as a blob).
 * Failure -> 400 with a JSON envelope (also delivered as a blob because we ask
 * for responseType blob), whose `data` field carries a human-readable message
 * and `message` carries a machine error code.
 */

export type PhotographyDocumentType = "application-form" | "team-member";

interface DownloadPhotographyDocumentParams {
  applicationId: number;
  documentType: PhotographyDocumentType;
  /** Required when documentType is "team-member". */
  memberId?: string;
  /** 1-based fallback position, only used when memberId is unavailable. */
  memberIndex?: number;
}

interface PhotographyErrorEnvelope {
  isSuccess?: boolean;
  statusCode?: number;
  message?: string;
  data?: string;
}

const buildDownloadUrl = (applicationId: number): string =>
  `/api/Application/${applicationId}/photography-documents/download`;

const parseFilenameFromDisposition = (
  disposition: string | undefined,
): string | undefined => {
  if (!disposition) return undefined;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const triggerBlobDownload = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

/**
 * The 400 business error is a JSON envelope shipped as a blob. Read it back to
 * text, parse it and surface the backend's human-readable `data` message.
 */
const parseBlobErrorEnvelope = async (
  blob: Blob,
): Promise<PhotographyErrorEnvelope | undefined> => {
  const contentType = blob.type || "";
  if (!contentType.toLowerCase().includes("json")) return undefined;
  try {
    const text = await blob.text();
    return JSON.parse(text) as PhotographyErrorEnvelope;
  } catch {
    return undefined;
  }
};

/**
 * Download a Service 7 photography document as a PDF.
 * Resolves on success (file downloaded). Rejects on failure after showing the
 * backend's human-readable message via CustomMessage.
 */
export const downloadPhotographyDocument = async (
  params: DownloadPhotographyDocumentParams,
): Promise<void> => {
  const { applicationId, documentType, memberId, memberIndex } = params;

  const response = await request.get<Blob>(
    buildDownloadUrl(applicationId),
    { documentType, memberId, memberIndex },
    { responseType: "blob", rawResponse: true, skipErrorMessage: true },
  );

  const rawResponse = response as unknown as {
    data: Blob;
    headers?: Record<string, string | undefined>;
  };
  const blob = rawResponse.data;

  // A PDF stream means success; anything that is not a PDF is the JSON envelope
  // for a business error delivered with a 200-shaped blob body.
  const envelope = await parseBlobErrorEnvelope(blob);
  if (envelope && envelope.isSuccess === false) {
    const humanMessage = envelope.data || envelope.message;
    if (humanMessage) {
      CustomMessage.error(humanMessage);
    }
    throw new Error(envelope.message || "Photography.Document.ExportFailed");
  }

  const fileName =
    parseFilenameFromDisposition(rawResponse.headers?.["content-disposition"]) ||
    "photography-document.pdf";
  triggerBlobDownload(blob, fileName);
};

/** Export the whole Basic Information application form (documentType=application-form). */
export const exportPhotographyApplicationForm = (
  applicationId: number,
): Promise<void> =>
  downloadPhotographyDocument({
    applicationId,
    documentType: "application-form",
  });

/** Export a single filming team member information form (documentType=team-member). */
export const exportPhotographyTeamMember = (
  applicationId: number,
  memberId: string,
): Promise<void> =>
  downloadPhotographyDocument({
    applicationId,
    documentType: "team-member",
    memberId,
  });
