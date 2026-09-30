import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload } from 'antd';
import type { RcFile } from 'antd/lib/upload';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { useTranslation } from 'react-i18next';
import { CustomMessage } from '@/components/common';
import { UPLOAD_LIMITS } from '@/constants/uploadLimits';
import InspectionAttachmentGrid from '@/pages/InspectionStartVisit/components/InspectionAttachmentGrid';
import type { InspectionAttachmentSource } from '@/pages/InspectionStartVisit/components/InspectionAttachmentGrid';
import type { InspectionTaskAttachmentPayload } from '@/services/inspection';
import { inspectionFigmaAssets } from '../assets';
import { formatInspectionAttachmentFileTypes } from '../constants';
import { uploadInspectionFile } from '../upload';
import './InspectionAttachmentUpload.less';

const DEFAULT_ACCEPTED_ATTACHMENT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const DEFAULT_ACCEPTED_ATTACHMENT_TYPES = '.jpg,.jpeg,.png,.pdf';
const DEFAULT_MAX_ATTACHMENT_COUNT = UPLOAD_LIMITS.MULTI_ATTACHMENT;
const DEFAULT_MAX_ATTACHMENT_SIZE_MB = 5;
const DEFAULT_ATTACHMENT_CATEGORY = 'TaskAttachment';

type InspectionAttachmentUploadProps = {
  value?: InspectionTaskAttachmentPayload[];
  uploadText: string;
  uploadingText?: string;
  disabled?: boolean;
  maxCount?: number;
  maxSizeMB?: number;
  accept?: string;
  acceptedExtensions?: string[];
  attachmentCategory?: string;
  className?: string;
  attachmentGridClassName?: string;
  onChange: (attachments: InspectionTaskAttachmentPayload[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
};

const getFileExtension = (fileName: string) => {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
};

const InspectionAttachmentUpload: React.FC<InspectionAttachmentUploadProps> = ({
  value,
  uploadText,
  uploadingText,
  disabled,
  maxCount = DEFAULT_MAX_ATTACHMENT_COUNT,
  maxSizeMB = DEFAULT_MAX_ATTACHMENT_SIZE_MB,
  accept = DEFAULT_ACCEPTED_ATTACHMENT_TYPES,
  acceptedExtensions = DEFAULT_ACCEPTED_ATTACHMENT_EXTENSIONS,
  attachmentCategory = DEFAULT_ATTACHMENT_CATEGORY,
  className,
  attachmentGridClassName,
  onChange,
  onUploadingChange,
}) => {
  const { t, i18n } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const attachments = useMemo(() => value || [], [value]);
  const reachedMaxCount = attachments.length >= maxCount;
  const uploadDisabled = disabled || uploading || reachedMaxCount;
  const effectiveUploadingText = uploadingText || t('inspection.tasks.messages.attachmentUploading');

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [onUploadingChange, uploading]);

  const beforeUpload = useCallback((file: RcFile) => {
    const extension = getFileExtension(file.name);

    if (!acceptedExtensions.includes(extension)) {
      const fileTypes = formatInspectionAttachmentFileTypes(acceptedExtensions, i18n.language);
      const messageKey = acceptedExtensions.length === 1
        ? 'inspection.tasks.messages.invalidAttachmentFileTypeSingle'
        : 'inspection.tasks.messages.invalidAttachmentFileType';
      CustomMessage.error(t(messageKey, { fileType: fileTypes, fileTypes }));
      return Upload.LIST_IGNORE;
    }

    if (file.size / 1024 / 1024 > maxSizeMB) {
      CustomMessage.error(t('inspection.tasks.messages.attachmentFileSizeExceeded', { maxSize: maxSizeMB }));
      return Upload.LIST_IGNORE;
    }

    if (attachments.length >= maxCount) {
      CustomMessage.error(t(
        maxCount === 1
          ? 'inspection.tasks.messages.attachmentUploadLimitSingle'
          : 'inspection.tasks.messages.attachmentUploadLimit',
        { maxCount },
      ));
      return Upload.LIST_IGNORE;
    }

    return true;
  }, [acceptedExtensions, attachments.length, i18n.language, maxCount, maxSizeMB, t]);

  const handleUpload = useCallback(async (options: UploadRequestOption) => {
    const file = options.file as RcFile;
    setUploading(true);

    try {
      const uploadResult = await uploadInspectionFile(file);

      const nextAttachment: InspectionTaskAttachmentPayload = {
        fileName: uploadResult.fileName,
        fileUrl: uploadResult.fileUrl,
        contentType: uploadResult.contentType,
        attachmentCategory,
      };

      onChange([...attachments, nextAttachment]);
      options.onSuccess?.(nextAttachment);
    } catch (error) {
      CustomMessage.error(t('inspection.tasks.messages.attachmentUploadFailed'));
      options.onError?.(error as Error);
    } finally {
      setUploading(false);
    }
  }, [attachmentCategory, attachments, onChange, t]);

  const handleRemove = useCallback((_attachment: InspectionAttachmentSource, index: number) => {
    onChange(attachments.filter((_item, itemIndex) => itemIndex !== index));
  }, [attachments, onChange]);

  const rootClassName = [
    'inspection-common-attachment-upload',
    className,
  ].filter(Boolean).join(' ');
  const triggerClassName = [
    'inspection-common-attachment-upload__trigger',
    uploadDisabled ? 'inspection-common-attachment-upload__trigger--disabled' : '',
  ].filter(Boolean).join(' ');
  const gridClassName = [
    'inspection-common-attachment-upload__attachment-grid',
    attachmentGridClassName,
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <Upload
        accept={accept}
        beforeUpload={beforeUpload}
        customRequest={handleUpload}
        disabled={uploadDisabled}
        maxCount={maxCount}
        showUploadList={false}
        className="inspection-common-attachment-upload__wrapper"
      >
        <div className={triggerClassName}>
          <img
            className="inspection-common-attachment-upload__trigger-icon"
            src={inspectionFigmaAssets.createTask.uploadIcon}
            alt=""
          />
          <span className="inspection-common-attachment-upload__trigger-text">
            {uploading ? effectiveUploadingText : uploadText}
          </span>
        </div>
      </Upload>
      {attachments.length ? (
        <InspectionAttachmentGrid
          attachments={attachments}
          className={gridClassName}
          onDelete={handleRemove}
          showDownload={false}
        />
      ) : null}
    </div>
  );
};

export default InspectionAttachmentUpload;
