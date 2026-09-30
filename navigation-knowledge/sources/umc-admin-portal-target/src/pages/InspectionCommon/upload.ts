import {
  getDocumentUploadResponseUrl,
  uploadDocumentFile,
} from '@/services/media';

export type InspectionUploadResult = {
  fileName: string;
  fileUrl: string;
  contentType?: string;
};

export const getInspectionUploadResponseUrl = getDocumentUploadResponseUrl;

export const uploadInspectionFile = async (file: File): Promise<InspectionUploadResult> => {
  const uploadResult = await uploadDocumentFile(file);
  return uploadResult;
};
