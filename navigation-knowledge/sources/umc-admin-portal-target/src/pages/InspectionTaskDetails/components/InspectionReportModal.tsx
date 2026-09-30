/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { CustomMessage } from '@/components/common';
import { DetailCardHeader } from '@/pages/InspectionCommon/components/DetailCardHeader';
import { formatDateTime, getLocalizedText } from '@/pages/InspectionCommon/helpers';
import {
  downloadInspectionReportFile,
  hasInspectionReportPdfFile,
} from '@/pages/InspectionCommon/reportDownload';
import InspectionAttachmentGrid, {
  type InspectionAttachmentSource,
} from '@/pages/InspectionStartVisit/components/InspectionAttachmentGrid';

type AnyRecord = Record<string, any>;

type AttachmentItem = {
  key: string;
  name: string;
  type: string;
  url?: string;
  fileUrl?: string;
};

type ReportSectionKey = 'access' | 'checkIn' | 'violations' | 'materials' | 'contact' | 'checkOut';

type ReportField = {
  key: string;
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
};

type ViolationRow = {
  key: string;
  name: string;
  ticketNumber: string;
  code: string;
  category: string;
  notes: string;
  attachments: AttachmentItem[];
  canOpenTicket: boolean;
  raw: AnyRecord;
};

type ViolationGroup = {
  key: string;
  title: string;
  rows: ViolationRow[];
  ticketRow?: ViolationRow;
};

type ViolationCategoryLabels = {
  license: string;
  content: string;
};

type ReportViolationListKey = 'licenseViolations' | 'contentViolations';

type ReportViolationNumberKey = 'licenseViolationNo' | 'contentViolationNo';

type ReportViolationMapOptions = {
  ticketNumber: string;
  category: string;
  keyPrefix: ReportViolationListKey;
};

type MaterialRow = {
  key: string;
  materialType: string;
  materialName: string;
  isbn: string;
  author: string;
  language: string;
  numberOfCopy: string;
};

type ContactData = {
  fullName: string;
  position: string;
  mobilePhone: string;
  emailAddress: string;
  eid: string;
  eidAttachments: AttachmentItem[];
  declarationAttachments: AttachmentItem[];
};

type InspectionReportModalProps = {
  visible: boolean;
  loading?: boolean;
  downloadLoading?: boolean;
  taskDetail?: AnyRecord | null;
  onCancel: () => void;
  onViolationClick?: (violation: AnyRecord) => void;
};

const DEFAULT_SECTIONS: Record<ReportSectionKey, boolean> = {
  access: true,
  checkIn: true,
  violations: true,
  materials: true,
  contact: true,
  checkOut: true,
};

const EMPTY_VALUE = '-';

const ensureArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const isPresent = (value: unknown) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

const getDisplayValue = (value: unknown, fallback = EMPTY_VALUE) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback;
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  const text = String(value ?? '').trim();
  return text || fallback;
};

const getViolationDescriptionValue = (
  records: Array<AnyRecord | null | undefined>,
  fallback = EMPTY_VALUE,
) => {
  const sources = records.filter(Boolean);
  for (const record of sources) {
    const localizedDescription = getLocalizedText(
      record?.violationDescription || record?.violationDescriptionEn,
      record?.violationDescriptionAr,
      '',
    );
    if (localizedDescription && localizedDescription !== EMPTY_VALUE) return localizedDescription;
  }

  const directDescription = sources.map((record) => record?.violationDescription).find(isPresent);
  if (isPresent(directDescription)) return getDisplayValue(directDescription, fallback);

  return fallback;
};

const ACCESS_FAILED_STATUS_CODES = new Set(['accessfailed', 'unabletoaccess']);

const normalizeStatusCode = (value: unknown) =>
  String(value ?? '').trim().replace(/[\s_-]+/g, '').toLowerCase();

const getAccessFailureReason = (records: Array<AnyRecord | null | undefined>) =>
  getDisplayValue(records.map((record) => record?.accessFailedReasonName).find(isPresent));

const getAccessRemark = (records: Array<AnyRecord | null | undefined>) =>
  getDisplayValue(records.map((record) => record?.accessFailedRemark).find(isPresent));

const getFileNameFromUrl = (url?: string) => {
  const text = String(url || '').trim();
  if (!text) return '';

  try {
    const fileName = new URL(text, 'https://local.invalid').searchParams.get('fileName');
    if (fileName) {
      const decodedFileName = decodeURIComponent(fileName);
      return decodedFileName.split('/').filter(Boolean).pop() || decodedFileName;
    }
  } catch {
    // Fall through to path-based extraction.
  }

  const cleanUrl = text.split(/[?#]/)[0] || text;
  return decodeURIComponent(cleanUrl.split('/').pop() || '');
};

const getAttachmentType = (name: string) => {
  const extension = name.split('.').pop()?.trim().toUpperCase();
  return extension && extension.length <= 6 ? extension : 'FILE';
};

// P8 Plan A: attachments are served same-origin through the gateway.
const getAttachmentApiBaseUrl = () =>
  String(window.location.origin).replace(/\/+$/, '');

const isBlobOrDataUrl = (value: string) => /^(blob|data):/i.test(value);

const getDocumentEndpointFileName = (value: string) => {
  try {
    const parsedUrl = new URL(value, 'https://local.invalid');
    const isDocumentEndpoint = /^\/api\/Document\/(?:Dowload|Download)$/i.test(parsedUrl.pathname);
    const isPdfPreviewEndpoint = /^\/api\/pdf\/preview$/i.test(parsedUrl.pathname);
    if (!isDocumentEndpoint && !isPdfPreviewEndpoint) return '';

    const fileName = parsedUrl.searchParams.get('fileName');
    return fileName ? decodeURIComponent(fileName) : '';
  } catch {
    return '';
  }
};

const isPdfPreviewEndpointUrl = (value: string) => {
  try {
    return /^\/api\/pdf\/preview$/i.test(new URL(value, 'https://local.invalid').pathname);
  } catch {
    return false;
  }
};

const getDeclarationAttachmentAccessUrl = (value?: string) => {
  const rawUrl = String(value || '').trim();
  if (!rawUrl || isBlobOrDataUrl(rawUrl) || isPdfPreviewEndpointUrl(rawUrl)) return rawUrl;

  const documentFileName = getDocumentEndpointFileName(rawUrl);
  if (/^(https?:)?\/\//i.test(rawUrl) && !documentFileName) return rawUrl;

  const fileName = documentFileName || rawUrl;
  const baseUrl = getAttachmentApiBaseUrl();
  return `${baseUrl}/api/pdf/preview?fileName=${encodeURIComponent(fileName)}`;
};

const normalizeAttachmentList = (
  value: unknown,
  fallbackName = 'Attachment',
  getAccessUrl?: (url?: string) => string,
): AttachmentItem[] => {
  const list = Array.isArray(value) ? value : value ? [value] : [];

  return list.map((item: any, index) => {
    const rawUrl = typeof item === 'string'
      ? item
      : item?.fileUrl || item?.url || item?.attachmentFileUrl || item?.filePath;
    const accessUrl = getAccessUrl ? getAccessUrl(rawUrl) : rawUrl;
    const rawName = typeof item === 'string'
      ? getFileNameFromUrl(item)
      : item?.fileName || item?.name || item?.attachmentFileName || item?.originalName || item?.title || getFileNameFromUrl(rawUrl);
    if (!isPresent(rawUrl) && !isPresent(rawName)) {
      return null;
    }
    const name = getDisplayValue(rawName, `${fallbackName} ${index + 1}`);

    return {
      key: String(item?.id || accessUrl || rawUrl || `${fallbackName}-${index}`),
      name,
      type: getAttachmentType(String(item?.contentType || name)),
      url: accessUrl,
      fileUrl: accessUrl,
    };
  }).filter(Boolean) as AttachmentItem[];
};

const collectAttachments = (
  record: AnyRecord | null | undefined,
  keys: string[],
  fallbackName?: string,
  getAccessUrl?: (url?: string) => string,
) => keys.flatMap((key) => normalizeAttachmentList(record?.[key], fallbackName, getAccessUrl));

const dedupeAttachments = (items: AttachmentItem[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = String(item.url || item.fileUrl || item.key || item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getPreviewableAttachments = (items: AttachmentItem[]) =>
  dedupeAttachments(items).filter((item) => isPresent(item.url || item.fileUrl));

const getReportData = (taskDetail?: AnyRecord | null) => taskDetail?.report || {};

const getReportSummary = (taskDetail?: AnyRecord | null) => {
  const reportData = getReportData(taskDetail);
  return reportData?.reportSummary || reportData || {};
};

const getAccessFailedReport = (taskDetail?: AnyRecord | null) => {
  const reportData = getReportData(taskDetail);
  const reportSummary = getReportSummary(taskDetail);

  return (
    reportData?.accessFailedReport ||
    reportSummary?.accessFailedReport ||
    {}
  );
};

const getDownloadFile = (taskDetail?: AnyRecord | null) => {
  const reportData = getReportData(taskDetail);
  const fileName = String(reportData?.pdfFileName || '').trim();
  const fileUrl = String(reportData?.pdfFileUrl || '').trim();
  if (!fileName || !fileUrl) return null;

  return {
    fileName,
    fileUrl,
  };
};

const isAccessFailedReport = (taskDetail?: AnyRecord | null) => {
  const reportData = getReportData(taskDetail);
  const accessFailedReport = getAccessFailedReport(taskDetail);
  const statusCodes = [
    taskDetail?.statusCode,
    taskDetail?.executionResult?.accessOutcomeCode,
    reportData?.reportStatusCode,
    reportData?.outcomeCode,
    accessFailedReport?.accessOutcomeCode,
  ];

  return statusCodes.some((statusCode) => ACCESS_FAILED_STATUS_CODES.has(normalizeStatusCode(statusCode)));
};

const isDigitalReport = (taskDetail?: AnyRecord | null) => {
  const config = taskDetail?.inspectionConfig || {};
  const reportData = getReportData(taskDetail);
  const methodId = Number(reportData?.inspectionMethodId ?? config.inspectionTypeId);
  const methodCode = normalizeStatusCode(reportData?.inspectionMethodCode || config.inspectionTypeCode);

  return Boolean(
    methodId === 2 ||
      methodCode === 'digitalinspection',
  );
};

const getDateValue = (value: unknown) => (isPresent(value) ? formatDateTime(String(value)) : EMPTY_VALUE);

const getReportTimeFields = (taskDetail: AnyRecord | null | undefined, type: 'checkIn' | 'checkOut') => {
  const reportData = getReportData(taskDetail);
  const executionResult = taskDetail?.executionResult || {};
  const isCheckIn = type === 'checkIn';
  const timeValue = isCheckIn
    ? reportData.checkinAt || executionResult.checkinAt
    : reportData.checkoutAt || executionResult.checkoutAt;
  const locationValue = isCheckIn
    ? reportData.checkinAddress
    : reportData.checkoutAddress;

  return {
    time: getDateValue(timeValue),
    location: getDisplayValue(locationValue),
  };
};

const mapReportViolation = (
  item: AnyRecord,
  index: number,
  options: ReportViolationMapOptions,
): ViolationRow => {
  const rawCode = item.checklistCode || item.violationItemCode;
  const baseKey = String(
    item?.id ||
    item?.taskChecklistItemId ||
    item?.violationItemId ||
    rawCode ||
    `report-violation-${index}`,
  );
  const ticketNumber = String(options.ticketNumber || '').trim();

  return {
    key: `${options.keyPrefix}-${baseKey}`,
    name: getViolationDescriptionValue([item]),
    ticketNumber,
    code: getDisplayValue(rawCode, ''),
    category: getDisplayValue(options.category, ''),
    notes: getDisplayValue(item.notes),
    attachments: dedupeAttachments(
      collectAttachments(item, ['attachments']),
    ),
    canOpenTicket: Boolean(ticketNumber),
    raw: {
      ...item,
      violationNo: ticketNumber || undefined,
    },
  };
};

const normalizeReportViolationRows = (
  reportData: AnyRecord,
  listKey: ReportViolationListKey,
  numberKey: ReportViolationNumberKey,
  category: string,
) => {
  const ticketNumber = String(reportData?.[numberKey] || '').trim();

  return ensureArray<AnyRecord>(reportData?.[listKey]).map((item, index) =>
    mapReportViolation(item, index, {
      ticketNumber,
      category,
      keyPrefix: listKey,
    }),
  );
};

const normalizeViolations = (
  taskDetail: AnyRecord | null | undefined,
  labels: ViolationCategoryLabels,
): ViolationRow[] => {
  const reportData = getReportData(taskDetail);

  return [
    ...normalizeReportViolationRows(
      reportData,
      'licenseViolations',
      'licenseViolationNo',
      labels.license,
    ),
    ...normalizeReportViolationRows(
      reportData,
      'contentViolations',
      'contentViolationNo',
      labels.content,
    ),
  ];
};

const groupViolationsByType = (items: ViolationRow[]): ViolationGroup[] => {
  const groups = new Map<string, ViolationGroup>();

  items.forEach((item) => {
    const title = item.category.trim();
    const ticketKey = item.ticketNumber || '';
    const key = [title, ticketKey || 'without-violation-no'].filter(Boolean).join('-').toLowerCase().replace(/\s+/g, '-');
    const existing = groups.get(key);

    if (existing) {
      existing.rows.push(item);
      if (item.ticketNumber && !existing.ticketRow?.ticketNumber) {
        existing.ticketRow = item;
      }
      return;
    }

    groups.set(key, {
      key,
      title,
      rows: [item],
      ticketRow: item.ticketNumber ? item : undefined,
    });
  });

  return Array.from(groups.values());
};

const normalizeMaterials = (taskDetail?: AnyRecord | null): MaterialRow[] => {
  const reportData = getReportData(taskDetail);
  const materials = ensureArray<any>(reportData?.seizedMaterials);

  return materials.map((item, index) => ({
    key: String(item?.id || index),
    materialType: getDisplayValue(item?.materialTypeName),
    materialName: getDisplayValue(item?.title),
    isbn: getDisplayValue(item?.isbn),
    author: getDisplayValue(item?.author),
    language: getDisplayValue(item?.languageId),
    numberOfCopy: getDisplayValue(item?.numberOfCopy),
  }));
};

const normalizeContact = (taskDetail?: AnyRecord | null): ContactData => {
  const reportData = getReportData(taskDetail);
  const contact = reportData?.contactPerson || {};
  const eidAttachments = getPreviewableAttachments([
    ...collectAttachments(contact, ['eidAttachments']),
    ...normalizeAttachmentList(
      contact?.eidAttachmentFileUrl
        ? { fileName: contact?.eidAttachmentFileName, fileUrl: contact?.eidAttachmentFileUrl }
        : null,
    ),
  ]);
  const declarationAttachments = getPreviewableAttachments([
    ...collectAttachments(
      reportData,
      ['declarationDocuments'],
      'Declaration and Acknowledgment',
      getDeclarationAttachmentAccessUrl,
    ),
    ...collectAttachments(
      contact,
      ['declarationDocuments'],
      'Declaration and Acknowledgment',
      getDeclarationAttachmentAccessUrl,
    ),
    ...normalizeAttachmentList(contact?.declarationDocumentFileUrl ? {
      fileName: contact?.declarationDocumentFileName,
      fileUrl: contact?.declarationDocumentFileUrl,
    } : null, 'Declaration and Acknowledgment', getDeclarationAttachmentAccessUrl),
  ]);

  return {
    fullName: getDisplayValue(contact?.fullName),
    position: getDisplayValue(contact?.position),
    mobilePhone: getDisplayValue(contact?.mobile),
    emailAddress: getDisplayValue(contact?.email),
    eid: getDisplayValue(contact?.emiratesId),
    eidAttachments,
    declarationAttachments,
  };
};

const hasContactData = (contact: ContactData) =>
  [contact.fullName, contact.position, contact.mobilePhone, contact.emailAddress, contact.eid].some(
    (value) => value !== EMPTY_VALUE,
  ) || contact.eidAttachments.length > 0 || contact.declarationAttachments.length > 0;

function ReportSection({
  id,
  title,
  open,
  onToggle,
  collapsible = false,
  children,
}: {
  id: ReportSectionKey;
  title: string;
  open: boolean;
  onToggle: (id: ReportSectionKey) => void;
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="inspection-report-modal__section">
      <DetailCardHeader
        title={title}
        open={open}
        onToggle={collapsible ? () => onToggle(id) : undefined}
        rootClassName="inspection-report-modal__section-header"
        titleClassName="inspection-report-modal__section-title"
        actionsClassName="inspection-report-modal__section-actions"
        chevronClassName="inspection-report-modal__section-chevron"
      />
      {open ? <div className="inspection-report-modal__section-body">{children}</div> : null}
    </section>
  );
}

function FieldGrid({ fields }: { fields: ReportField[] }) {
  return (
    <div className="inspection-report-modal__field-grid">
      {fields.map((item) => (
        <FieldBlock
          key={item.key}
          label={item.label}
          value={item.value}
          className={item.fullWidth ? 'inspection-report-modal__field--full' : ''}
        />
      ))}
    </div>
  );
}

function FieldBlock({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`inspection-report-modal__field ${className ?? ''}`.trim()}>
      <div className="inspection-report-modal__field-label">{label}</div>
      <div className="inspection-report-modal__field-value">{value}</div>
    </div>
  );
}

function ViolationTicketBadge({
  row,
  onClick,
}: {
  row: ViolationRow;
  onClick?: (violation: AnyRecord) => void;
}) {
  const canClick = Boolean(row.canOpenTicket && onClick);
  const displayTicketNumber = getDisplayValue(row.ticketNumber);
  const className = `inspection-report-modal__ticket-link ${
    canClick ? '' : 'inspection-report-modal__ticket-link--static'
  }`.trim();

  if (!canClick) {
    return <span className={className}>{displayTicketNumber}</span>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => onClick?.(row.raw)}
    >
      {displayTicketNumber}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="inspection-report-modal__empty">{children}</div>;
}

function ReportAttachmentGrid({
  items,
  className,
}: {
  items: AttachmentItem[];
  className?: string;
}) {
  return (
    <InspectionAttachmentGrid
      attachments={items as InspectionAttachmentSource[]}
      className={`inspection-report-modal__attachment-grid ${className ?? ''}`.trim()}
    />
  );
}

function ContactGrid({ contact }: { contact: ContactData }) {
  const { t } = useTranslation();

  return (
    <div className="inspection-report-modal__contact-grid">
      <FieldBlock label={t('inspection.report.fullName')} value={contact.fullName} />
      <FieldBlock label={t('inspection.report.position')} value={contact.position} />
      <FieldBlock label={t('inspection.report.mobilePhone')} value={contact.mobilePhone} />
      <FieldBlock label={t('inspection.report.emailAddress')} value={contact.emailAddress} />
      <FieldBlock label={t('inspection.report.eid')} value={contact.eid} />
      <FieldBlock
        label={t('inspection.report.eidAttachment')}
        value={<ReportAttachmentGrid items={contact.eidAttachments} />}
      />
      <FieldBlock
        label={t('inspection.report.declarationAcknowledgment')}
        value={<ReportAttachmentGrid items={contact.declarationAttachments} />}
      />
    </div>
  );
}

const InspectionReportModal: React.FC<InspectionReportModalProps> = ({
  visible,
  loading = false,
  downloadLoading = false,
  taskDetail,
  onCancel,
  onViolationClick,
}) => {
  const { t } = useTranslation();
  const [downloadPending, setDownloadPending] = useState(false);
  const [sectionState, setSectionState] = useState<Record<ReportSectionKey, boolean>>(DEFAULT_SECTIONS);
  const [expandedViolations, setExpandedViolations] = useState<Record<string, boolean>>({});

  const reportSummary = useMemo(() => getReportSummary(taskDetail), [taskDetail]);
  const accessFailed = useMemo(() => isAccessFailedReport(taskDetail), [taskDetail]);
  const digitalReport = useMemo(() => isDigitalReport(taskDetail), [taskDetail]);
  const checkIn = useMemo(() => getReportTimeFields(taskDetail, 'checkIn'), [taskDetail]);
  const checkOut = useMemo(() => getReportTimeFields(taskDetail, 'checkOut'), [taskDetail]);
  const violations = useMemo(() => normalizeViolations(taskDetail, {
    license: t('inspection.report.licensingViolation'),
    content: t('inspection.report.contentViolation'),
  }), [taskDetail, t]);
  const violationGroups = useMemo(() => groupViolationsByType(violations), [violations]);
  const materials = useMemo(() => normalizeMaterials(taskDetail), [taskDetail]);
  const contact = useMemo(() => normalizeContact(taskDetail), [taskDetail]);
  const downloadFile = useMemo(() => getDownloadFile(taskDetail), [taskDetail]);
  const downloadButtonInactive = !downloadFile;
  const currentDownloadLoading = downloadLoading || downloadPending;
  const downloadButtonClassName = downloadButtonInactive
    ? 'inspection-report-modal__outline-button inspection-report-modal__outline-button--visual-disabled'
    : 'inspection-report-modal__outline-button';

  const materialColumns = useMemo<ColumnsType<MaterialRow>>(
    () => [
      { title: t('inspection.report.materialType'), dataIndex: 'materialType', key: 'materialType' },
      { title: t('inspection.report.materialName'), dataIndex: 'materialName', key: 'materialName' },
      { title: t('inspection.report.isbn'), dataIndex: 'isbn', key: 'isbn' },
      { title: t('inspection.report.author'), dataIndex: 'author', key: 'author' },
      { title: t('inspection.report.language'), dataIndex: 'language', key: 'language' },
      { title: t('inspection.report.numberOfCopy'), dataIndex: 'numberOfCopy', key: 'numberOfCopy' },
    ],
    [t],
  );

  const toggleSection = (key: ReportSectionKey) => {
    setSectionState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleViolation = (key: string) => {
    setExpandedViolations((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false),
    }));
  };

  useEffect(() => {
    if (!visible) return;
    setExpandedViolations({});
  }, [taskDetail?.taskId, taskDetail?.taskNo, visible]);

  const checkInFields: ReportField[] = digitalReport
    ? [
      { key: 'checkInTime', label: t('inspection.report.checkInTime'), value: checkIn.time },
    ]
    : [
      { key: 'checkInTime', label: t('inspection.report.checkInTime'), value: checkIn.time },
      { key: 'checkInLocation', label: t('inspection.report.checkInLocation'), value: checkIn.location },
    ];
  const checkOutFields: ReportField[] = digitalReport
    ? [
      { key: 'checkOutTime', label: t('inspection.report.checkOutTime'), value: checkOut.time },
    ]
    : [
      { key: 'checkOutTime', label: t('inspection.report.checkOutTime'), value: checkOut.time },
      { key: 'checkOutLocation', label: t('inspection.report.checkOutLocation'), value: checkOut.location },
    ];
  const reportData = getReportData(taskDetail);
  const accessFailedReport = getAccessFailedReport(taskDetail);
  const accessEvidence = dedupeAttachments([
    ...normalizeAttachmentList(reportSummary?.accessAttachments),
    ...collectAttachments(accessFailedReport, [
      'attachments',
      'attachEvidence',
      'accessAttachments',
      'evidenceAttachments',
    ]),
    ...collectAttachments(reportData, ['accessAttachments', 'evidenceAttachments']),
    ...collectAttachments(taskDetail?.executionResult, ['accessAttachments', 'evidenceAttachments']),
  ]);
  const accessFields: ReportField[] = [
    {
      key: 'failureReason',
      label: t('inspection.report.failureReason'),
      value: getAccessFailureReason([accessFailedReport, reportSummary, reportData, taskDetail?.executionResult]),
      fullWidth: true,
    },
    {
      key: 'attachEvidence',
      label: t('inspection.report.attachEvidence'),
      value: <ReportAttachmentGrid items={accessEvidence} className="inspection-report-modal__attachment-grid--two-columns" />,
      fullWidth: true,
    },
    {
      key: 'remark',
      label: t('inspection.report.remark'),
      value: getAccessRemark([accessFailedReport, reportSummary, reportData, taskDetail?.executionResult]),
      fullWidth: true,
    },
  ];

  return (
    <Modal
      visible={visible}
      title={null}
      footer={null}
      closable={false}
      destroyOnClose
      centered
      wrapClassName="inspection-report-modal__wrap"
      className="inspection-report-modal"
      bodyStyle={{ padding: 0 }}
      onCancel={onCancel}
    >
      <div className="inspection-report-modal__shell">
        <div className="inspection-report-modal__header">
          <div className="inspection-report-modal__title">{t('inspection.report.title')}</div>
          <div className="inspection-report-modal__header-actions">
            <Button
              className={downloadButtonClassName}
              loading={currentDownloadLoading}
              aria-disabled={downloadButtonInactive}
              onClick={async () => {
                if (currentDownloadLoading) return;
                if (!hasInspectionReportPdfFile(downloadFile)) {
                  CustomMessage.warning(t('inspection.taskDetail.reportDownloadUnavailable'));
                  return;
                }
                setDownloadPending(true);
                try {
                  const downloaded = await downloadInspectionReportFile(downloadFile);
                  if (!downloaded) {
                    CustomMessage.warning(t('inspection.taskDetail.reportDownloadUnavailable'));
                  }
                } catch {
                  CustomMessage.warning(t('inspection.taskDetail.reportDownloadFailed'));
                } finally {
                  setDownloadPending(false);
                }
              }}
            >
              {t('inspection.common.download')}
            </Button>
            <button
              type="button"
              className="inspection-report-modal__close"
              aria-label={t('inspection.common.cancel')}
              onClick={onCancel}
            >
              <CloseOutlined />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="inspection-report-modal__loading">{t('inspection.common.loading')}</div>
        ) : (
          <div className="inspection-report-modal__content">
            {accessFailed ? (
              <ReportSection
                id="access"
                title={t('inspection.report.unableToAccess')}
                open={sectionState.access}
                onToggle={toggleSection}
                collapsible={false}
              >
                <FieldGrid fields={accessFields} />
              </ReportSection>
            ) : (
              <>
                <ReportSection
                  id="checkIn"
                  title={t('inspection.report.checkIn')}
                  open={sectionState.checkIn}
                  onToggle={toggleSection}
                >
                  <FieldGrid fields={checkInFields} />
                </ReportSection>

                <ReportSection
                  id="violations"
                  title={t('inspection.report.violationsDetails')}
                  open={sectionState.violations}
                  onToggle={toggleSection}
                >
                  {violations.length ? (
                    <div className="inspection-report-modal__violation-list">
                      {violationGroups.map((group) => (
                        <div key={group.key} className="inspection-report-modal__violation-group">
                          {group.title || group.ticketRow ? (
                            <div className="inspection-report-modal__violation-group-header">
                              {group.title ? (
                                <div className="inspection-report-modal__violation-group-title">{group.title}</div>
                              ) : null}
                              {group.ticketRow ? (
                                <ViolationTicketBadge row={group.ticketRow} onClick={onViolationClick} />
                              ) : null}
                            </div>
                          ) : null}
                          {group.rows.map((item) => {
                            const expanded = expandedViolations[item.key] ?? false;

                            return (
                              <article key={item.key} className="inspection-report-modal__violation-card">
                                <div className="inspection-report-modal__violation-header">
                                  <DetailCardHeader
                                    title={item.name}
                                    open={expanded}
                                    onToggle={() => toggleViolation(item.key)}
                                    rootClassName="inspection-report-modal__violation-toggle"
                                    titleClassName="inspection-report-modal__violation-name"
                                    actionsClassName="inspection-report-modal__violation-actions"
                                    chevronClassName="inspection-report-modal__violation-chevron"
                                    chevronOpenClassName="inspection-report-modal__violation-chevron--open"
                                  />
                                </div>
                                {expanded ? (
                                  <div className="inspection-report-modal__violation-body">
                                    <div className="inspection-report-modal__violation-divider" />
                                    <div className="inspection-report-modal__violation-field">
                                      <div className="inspection-report-modal__field-label">
                                        {t('inspection.report.attachments')}
                                      </div>
                                      <ReportAttachmentGrid
                                        items={item.attachments}
                                        className="inspection-report-modal__attachment-grid--violation inspection-report-modal__attachment-grid--two-columns"
                                      />
                                    </div>
                                    <div className="inspection-report-modal__violation-field">
                                      <div className="inspection-report-modal__field-label">
                                        {t('inspection.report.notes')}
                                      </div>
                                      <div className="inspection-report-modal__field-value">{item.notes}</div>
                                    </div>
                                  </div>
                                ) : null}
                              </article>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState>{t('inspection.report.violationNotFound')}</EmptyState>
                  )}
                </ReportSection>

                {!digitalReport ? (
                  <ReportSection
                    id="materials"
                    title={t('inspection.report.seizedMaterials')}
                    open={sectionState.materials}
                    onToggle={toggleSection}
                  >
                    {materials.length ? (
                      <Table
                        className="inspection-report-modal__materials-table"
                        columns={materialColumns}
                        dataSource={materials}
                        rowKey="key"
                        pagination={false}
                      />
                    ) : (
                      <EmptyState>{t('inspection.report.seizedMaterialNotFound')}</EmptyState>
                    )}
                  </ReportSection>
                ) : null}

                <ReportSection
                  id="contact"
                  title={
                    digitalReport || !violations.length
                      ? t('inspection.report.contactPerson')
                      : t('inspection.report.contactPersonConfirmation')
                  }
                  open={sectionState.contact}
                  onToggle={toggleSection}
                >
                  {hasContactData(contact) ? (
                    <ContactGrid contact={contact} />
                  ) : (
                    <EmptyState>{t('inspection.report.contactPersonNotFound')}</EmptyState>
                  )}
                </ReportSection>

                <ReportSection
                  id="checkOut"
                  title={t('inspection.report.checkOut')}
                  open={sectionState.checkOut}
                  onToggle={toggleSection}
                >
                  <FieldGrid fields={checkOutFields} />
                </ReportSection>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default InspectionReportModal;
