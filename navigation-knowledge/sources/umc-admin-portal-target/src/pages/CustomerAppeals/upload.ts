import { useCallback, useRef, useState } from "react";
import { uploadDocumentFile } from "@/services/media";
import { UPLOAD_LIMITS } from "@/constants/uploadLimits";
import type { AppealAttachment } from "./types";
import { buildAppealAttachmentAccessUrl } from "./utils";

export const APPEAL_ATTACHMENT_ACCEPT = ".jpg,.jpeg,.png,.pdf";
export const APPEAL_ATTACHMENT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"];
export const APPEAL_ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024;
export const APPEAL_ATTACHMENT_MAX_COUNT = UPLOAD_LIMITS.MULTI_ATTACHMENT;
export const APPEAL_MESSAGE_ATTACHMENT_MAX_COUNT =
  UPLOAD_LIMITS.CUSTOMER_APPEAL_MESSAGE_ATTACHMENT;

export type AppealAttachmentValidationError = "format" | "size" | "limit" | "";

type AppealAttachmentUploadLockedFile = File & {
  __appealAttachmentUploadLockId?: number;
};

export const useAppealAttachmentUploadLock = () => {
  const activeUploadIdRef = useRef<number | null>(null);
  const uploadSequenceRef = useRef(0);
  const [attachmentUploading, setAttachmentUploading] = useState(false);

  const isAttachmentUploading = useCallback(
    () => activeUploadIdRef.current !== null,
    [],
  );

  const reserveAttachmentUpload = useCallback((file: File) => {
    if (activeUploadIdRef.current !== null) {
      return false;
    }

    const uploadId = uploadSequenceRef.current + 1;
    uploadSequenceRef.current = uploadId;
    activeUploadIdRef.current = uploadId;
    (file as AppealAttachmentUploadLockedFile).__appealAttachmentUploadLockId = uploadId;
    setAttachmentUploading(true);
    return true;
  }, []);

  const releaseAttachmentUpload = useCallback((file: File) => {
    const uploadId = (file as AppealAttachmentUploadLockedFile).__appealAttachmentUploadLockId;

    if (!uploadId || activeUploadIdRef.current !== uploadId) {
      return;
    }

    activeUploadIdRef.current = null;
    delete (file as AppealAttachmentUploadLockedFile).__appealAttachmentUploadLockId;
    setAttachmentUploading(false);
  }, []);

  const resetAttachmentUploadLock = useCallback(() => {
    activeUploadIdRef.current = null;
    setAttachmentUploading(false);
  }, []);

  return {
    attachmentUploading,
    isAttachmentUploading,
    reserveAttachmentUpload,
    releaseAttachmentUpload,
    resetAttachmentUploadLock,
  };
};

export const getAppealAttachmentExtension = (fileName?: unknown) => {
  const text = String(fileName || "").trim();
  const dotIndex = text.lastIndexOf(".");
  return dotIndex >= 0 ? text.slice(dotIndex).toLowerCase() : "";
};

export const getAppealAttachmentValidationError = (
  file: File,
  currentCount: number,
  maxCount: number = APPEAL_ATTACHMENT_MAX_COUNT,
): AppealAttachmentValidationError => {
  if (!APPEAL_ATTACHMENT_EXTENSIONS.includes(getAppealAttachmentExtension(file.name))) {
    return "format";
  }
  if (file.size > APPEAL_ATTACHMENT_MAX_SIZE) {
    return "size";
  }
  if (currentCount >= maxCount) {
    return "limit";
  }
  return "";
};

export const uploadAppealAttachmentFile = async (
  file: File & { uid?: string },
): Promise<AppealAttachment> => {
  const uploadResult = await uploadDocumentFile(file);
  const extension = getAppealAttachmentExtension(file.name).replace(".", "") as AppealAttachment["type"];

  return {
    id: `${file.uid || file.name}-${Date.now()}`,
    name: file.name,
    type: extension,
    filePath: uploadResult.fileUrl,
    url: buildAppealAttachmentAccessUrl(uploadResult.fileUrl),
    contentType: uploadResult.contentType,
  };
};
