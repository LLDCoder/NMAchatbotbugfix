import React, { useMemo } from 'react';
import RefundAttachments from '@/pages/CustomerRefunds/components/RefundAttachments';
import type { RefundAttachment } from '@/pages/CustomerRefunds/types';
import {
  buildRefundAttachmentAccessUrl,
  normalizeRefundAttachmentFilePath,
} from '@/pages/CustomerRefunds/utils';
import { getDocumentUploadResponseUrl } from '@/services/media';
import './InspectionAttachmentGrid.less';

export type InspectionAttachmentSource = {
  key?: string | number;
  uid?: string;
  id?: string | number;
  attachmentId?: string | number;
  name?: string;
  fileName?: string;
  attachmentFileName?: string;
  originalName?: string;
  title?: string;
  type?: string;
  fileType?: string;
  contentType?: string;
  url?: string;
  fileUrl?: string;
  attachmentFileUrl?: string;
  thumbUrl?: string;
  response?: unknown;
};

type InspectionAttachmentGridProps = {
  attachments: InspectionAttachmentSource[];
  className?: string;
  compact?: boolean;
  onDelete?: (attachment: InspectionAttachmentSource, index: number) => void;
  onDownload?: (attachment: InspectionAttachmentSource, index: number) => void;
  showDownload?: boolean;
};

const getTextValue = (value: unknown) => String(value ?? '').trim();

const isAbsoluteAttachmentUrl = (value?: string | null) => {
  const text = getTextValue(value);
  return /^(https?:)?\/\//i.test(text) || text.startsWith('blob:') || text.startsWith('data:');
};

const getAttachmentName = (item: InspectionAttachmentSource, index: number) => {
  const source = item as Record<string, unknown>;
  const rawUrl = getAttachmentRawUrl(item);
  const normalizedPath = normalizeRefundAttachmentFilePath(rawUrl);
  const urlName = normalizedPath.split(/[/?#]/).filter(Boolean).pop();

  return (
    getTextValue(source.name) ||
    getTextValue(source.fileName) ||
    getTextValue(source.attachmentFileName) ||
    getTextValue(source.originalName) ||
    getTextValue(source.title) ||
    getTextValue(urlName) ||
    `attachment-${index + 1}.pdf`
  );
};

const getAttachmentRawUrl = (item: InspectionAttachmentSource) => {
  const source = item as Record<string, unknown>;
  return (
    getTextValue(source.url) ||
    getTextValue(source.fileUrl) ||
    getTextValue(source.attachmentFileUrl) ||
    getTextValue(source.thumbUrl) ||
    getDocumentUploadResponseUrl(source.response)
  );
};

const normalizeAttachmentType = (item: InspectionAttachmentSource, name: string, rawUrl: string): RefundAttachment['type'] => {
  const source = item as Record<string, unknown>;
  const candidates = [
    source.type,
    source.fileType,
    source.contentType,
    name,
    rawUrl,
  ].map(getTextValue);
  const joined = candidates.join(' ').toLowerCase();

  if (joined.includes('jpeg')) return 'jpeg';
  if (joined.includes('jpg')) return 'jpg';
  if (joined.includes('png')) return 'png';
  if (joined.includes('pdf')) return 'pdf';

  return 'pdf';
};

const mapInspectionAttachment = (
  item: InspectionAttachmentSource,
  index: number,
): RefundAttachment => {
  const source = item as Record<string, unknown>;
  const name = getAttachmentName(item, index);
  const rawUrl = getAttachmentRawUrl(item);
  const isAbsoluteUrl = isAbsoluteAttachmentUrl(rawUrl);
  const accessUrl = rawUrl
    ? (isAbsoluteUrl ? rawUrl : buildRefundAttachmentAccessUrl(rawUrl))
    : '';
  const id = [
    source.uid,
    source.id,
    source.attachmentId,
    source.key,
    rawUrl,
    name,
    index,
  ].map(getTextValue).filter(Boolean).join('-');

  return {
    id: id || `attachment-${index}`,
    name,
    type: normalizeAttachmentType(item, name, rawUrl),
    filePath: rawUrl && accessUrl && !isAbsoluteUrl ? rawUrl : undefined,
    url: accessUrl,
  };
};

const InspectionAttachmentGrid: React.FC<InspectionAttachmentGridProps> = ({
  attachments,
  className,
  compact = false,
  onDelete,
  onDownload,
  showDownload,
}) => {
  const refundAttachments = useMemo(
    () => attachments.map((item, index) => mapInspectionAttachment(item, index)),
    [attachments],
  );

  const handleDelete = onDelete
    ? (attachmentId: string) => {
      const sourceIndex = refundAttachments.findIndex((item) => item.id === attachmentId);
      if (sourceIndex >= 0) {
        onDelete(attachments[sourceIndex], sourceIndex);
      }
    }
    : undefined;

  const handleDownload = onDownload
    ? (attachment: RefundAttachment) => {
      const sourceIndex = refundAttachments.findIndex((item) => item.id === attachment.id);
      if (sourceIndex >= 0) {
        onDownload(attachments[sourceIndex], sourceIndex);
      }
    }
    : undefined;

  return (
    <div
      className={`inspection-attachment-grid ${
        compact ? 'inspection-attachment-grid--compact' : ''
      } ${className ?? ''}`}
    >
      <RefundAttachments
        attachments={refundAttachments}
        compact={compact}
        variant="applicationInfo"
        onDelete={handleDelete}
        onDownload={handleDownload}
        showDownload={showDownload ?? !onDelete}
      />
    </div>
  );
};

export default InspectionAttachmentGrid;
