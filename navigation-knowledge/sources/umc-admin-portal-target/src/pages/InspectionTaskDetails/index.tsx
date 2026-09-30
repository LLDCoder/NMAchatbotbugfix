import { msUntil } from "@/utils/gstTime";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Modal } from 'antd';
import i18next from 'i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CustomMessage,
  DEFAULT_OVERVIEW_QUICK_NAV_TARGET,
  createOverviewQuickNavTarget,
  type OverviewQuickNavTarget as SharedOverviewQuickNavTarget,
} from '@/components/common';
import { KEEP_ALIVE_RESTORE_STATE_KEY } from '@/components/KeepAlive/constants';
import {
  createDashboardReturnLocation,
  readDashboardReturnState,
} from '@/pages/Dashboard/dashboardReturnState';
import {
  assignInspectionTask,
  cancelInspectionTask,
  duplicateInspectionTask,
  getInspectionTaskDetail,
  isInspectionDataMissingError,
  normalizeInspectionExecutionStep,
  type InspectionTaskAttachmentPayload,
  type InspectionTaskTimelineItem,
} from '@/services/inspection';
import FullScreen from '@/components/common/ApplicationOverviewCards/FullScreen/FullScreen';
import type { SelfMonitorProgramInfo } from '@/components/common/SelfMonitorBadge';
import type { ViolationFineItem } from '@/pages/CustomerDetails/types';
import {
  getUserEstablishmentByID,
  profileAndApplicant,
  type IEstablishmentOverview,
  type IUserIndividualProfile,
} from '@/services/userProfile';
import { inspectionFigmaAssets } from '../InspectionCommon/assets';
import { DetailCardHeader } from '../InspectionCommon/components/DetailCardHeader';
import { AiRiskInsightCard } from '../InspectionCommon/components/AiRiskInsightCard';
import {
  buildInspectionPath,
  buildTaskTimeline,
  formatDate,
  formatDateTime,
  getAssigneeName,
  getCurrentLanguage,
  getInspectionCreatorLabel,
  getLocalizedText,
  getPriorityClassName,
  getPriorityLabel,
  getStatusClassName,
  getTaskStatusLabel,
  normalizeTaskStatus,
} from '../InspectionCommon/helpers';
import { INSPECTION_PATHS, INSPECTION_QUERY_KEYS } from '../InspectionCommon/constants';
import { hasAnyInspectionRole, useInspectionAccess } from '../InspectionCommon/access';
import {
  INSPECTION_TASK_ACTION_ORDER,
  getInspectionTaskActionGroup,
  getInspectionTaskActionKeys,
  type InspectionTaskActionKey,
} from '../InspectionCommon/taskActions';
import {
  getTargetOverviewStatusTone,
  TargetOverviewCard,
  type TargetOverviewData,
} from '../InspectionCommon/components/TargetOverviewCard';
import { resolveInspectionOverviewIdentity } from '../InspectionCommon/inspectionOverviewIdentity';
import AssignTaskModal from '../InspectionTaskManagement/components/AssignTaskModal';
import CancelTaskModal from '../InspectionTaskManagement/components/CancelTaskModal';
import CreateTaskModal, { type TaskModalMode } from '../InspectionTaskManagement/components/CreateTaskModal';
import DuplicateTaskWarningModal from '../InspectionTaskManagement/components/DuplicateTaskWarningModal';
import {
  duplicateWarningReasonKeys,
  getInspectionTaskEmirateLabel,
} from '../InspectionTaskManagement/taskConfig';
import InspectionAttachmentGrid from '../InspectionStartVisit/components/InspectionAttachmentGrid';
import InspectionReportModal from './components/InspectionReportModal';
import {
  TeamTaskDetailReassignAction,
  useTeamTaskDetailContext,
} from '@/pages/TeamManagement/components/TeamTaskDetailReassignAction';
import '../InspectionTaskManagement/index.less';
import './index.less';

const unwrapPayload = <T,>(response: any): T => response?.data ?? response;

type MainSectionKey = 'taskInfo' | 'execution' | 'lastInspection' | 'reinspectionTask';
type SideSectionKey = 'inspectionOutcome' | 'aiRiskInsight' | 'targetOverview' | 'taskTimeline';
type PreviewSectionKey = Exclude<SideSectionKey, 'taskTimeline'>;
type TimelineIconKey =
  | 'user'
  | 'calendar'
  | 'clock'
  | 'action'
  | 'system'
  | 'result'
  | 'location'
  | 'reason'
  | 'attachment';

type TimelineEventKind =
  | 'completed'
  | 'started'
  | 'assigned'
  | 'reassigned'
  | 'queued'
  | 'created'
  | 'accessFailed'
  | 'cancelled'
  | 'unknown';

type DetailItem = {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
  multiline?: boolean;
  valueClassName?: string;
};

type ReinspectionTaskSummary = {
  taskNumber?: string | null;
  dueDate?: string | null;
  inspector?: string | null;
  status?: string | null;
};

type AttachmentItem = {
  key: string | number;
  name: string;
  url?: string;
  type: string;
};

type InspectionOutcomeTicket = {
  key: 'licensing' | 'content';
  label: string;
  value: string;
  record?: Record<string, any> | null;
  canOpen: boolean;
};

type TargetOverviewFullScreenType = 'Individual' | 'Commercial';

type TargetOverviewQuickNavTarget = SharedOverviewQuickNavTarget;

type DuplicateTaskWarningState = {
  visible: boolean;
  message: string;
  loading: boolean;
  onConfirm?: () => void | Promise<void>;
};

type LoadReportDetailOptions = {
  force?: boolean;
  showError?: boolean;
};

const DEFAULT_TARGET_OVERVIEW_QUICK_NAV: TargetOverviewQuickNavTarget = {
  ...DEFAULT_OVERVIEW_QUICK_NAV_TARGET,
};

const createClosedDuplicateTaskWarningState = (): DuplicateTaskWarningState => ({
  visible: false,
  message: '',
  loading: false,
  onConfirm: undefined,
});

function TimelineMetaRow({
  icon,
  children,
  className,
}: {
  icon: TimelineIconKey;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;

  return (
    <div className={`inspection-task-details__timeline-meta-row ${className || ''}`.trim()}>
      <img src={inspectionFigmaAssets.timelineIcons[icon]} alt="" aria-hidden="true" />
      <div className="inspection-task-details__timeline-meta-text">{children}</div>
    </div>
  );
}

function TimelineAttachmentBar({
  count,
  label,
  onClick,
}: {
  count: number;
  label: string;
  onClick?: () => void;
}) {
  if (!count) return null;

  return (
    <button
      type="button"
      className="inspection-task-details__timeline-attachment-bar"
      onClick={onClick}
    >
      <div className="inspection-task-details__timeline-attachment-label">
        <img src={inspectionFigmaAssets.timelineIcons.attachment} alt="" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <span className="inspection-task-details__timeline-attachment-count">{count}</span>
    </button>
  );
}

const ensureArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const hasReportPreviewPayload = (task?: Record<string, any> | null) => {
  const report = task?.report;
  if (!report || typeof report !== 'object') return false;

  const reportSummary = report.reportSummary;
  const hasReportSummary = Boolean(
    reportSummary &&
      typeof reportSummary === 'object' &&
      Object.keys(reportSummary).length,
  );

  return Boolean(
    report.reportNo ||
      report.pdfFileUrl ||
      report.submittedOn ||
      report.accessFailedReport ||
      hasReportSummary ||
      ensureArray(report.checklistItems).length ||
      ensureArray(report.checklistViolations).length ||
      ensureArray(report.reportAttachments).length,
  );
};

const getDisplayValue = (value?: string | number | null, fallback = '-') => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback;
  }

  const text = String(value ?? '').trim();
  return text || fallback;
};

const getReportViolationNo = (record: Record<string, any>) => {
  return record.violationNo || '';
};

const getViolationNavigationValues = (record?: Record<string, any> | null) => {
  const violationId = record?.violationId;
  const violationNo = getReportViolationNo(record || {});

  return { violationId, violationNo };
};

const buildViolationListNavigationPatch = (record?: Record<string, any> | null) => {
  const { violationId, violationNo } = getViolationNavigationValues(record);

  return {
    [INSPECTION_QUERY_KEYS.from]: 'tasks',
    [INSPECTION_QUERY_KEYS.tab]: null,
    [INSPECTION_QUERY_KEYS.teamTab]: null,
    [INSPECTION_QUERY_KEYS.taskId]: null,
    [INSPECTION_QUERY_KEYS.taskNo]: null,
    [INSPECTION_QUERY_KEYS.visitId]: null,
    [INSPECTION_QUERY_KEYS.step]: null,
    [INSPECTION_QUERY_KEYS.mode]: null,
    [INSPECTION_QUERY_KEYS.reportNo]: null,
    [INSPECTION_QUERY_KEYS.violationId]: violationId === undefined || violationId === null || violationId === ''
      ? null
      : String(violationId),
    [INSPECTION_QUERY_KEYS.violationNo]: violationNo ? String(violationNo) : null,
    [INSPECTION_QUERY_KEYS.type]: null,
    [INSPECTION_QUERY_KEYS.status]: null,
  };
};

const getViolationRecordCode = (record?: Record<string, any> | null) => (
  String(record?.typeCode || '').trim().toUpperCase()
);

const getViolationRecordText = (record?: Record<string, any> | null) => [
  record?.typeName,
  record?.typeCode,
].filter(Boolean).join(' ').toLowerCase();

const isPositiveViolationFlag = (value: unknown) => {
  if (value === true) return true;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;

  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1'].includes(normalized);
};

const isViolationOutcomeValue = (value: unknown) => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();
  if (!normalized) return false;
  if (
    normalized.includes('no violation') ||
    normalized.includes('not found') ||
    normalized.includes('notfound') ||
    normalized.includes('compliant')
  ) {
    return false;
  }
  return normalized.includes('violation') || normalized.includes('violation found');
};

type TaskDetailTranslate = (key: string, options?: Record<string, unknown>) => string;

const getSlaText = (
  taskDetail: Record<string, any> | null | undefined,
  t: TaskDetailTranslate,
) => {
  const rawMinutes = Number(taskDetail?.inspectionConfig?.slaMinutes);
  if (Number.isFinite(rawMinutes) && rawMinutes > 0) {
    if (rawMinutes % 1440 === 0) {
      return t('inspection.taskDetail.slaDaysRemaining', { count: rawMinutes / 1440 });
    }
    if (rawMinutes % 60 === 0) {
      return t('inspection.taskDetail.slaHoursRemaining', { count: rawMinutes / 60 });
    }
    return t('inspection.taskDetail.slaMinutesRemaining', { count: rawMinutes });
  }

  const dueDate = taskDetail?.inspectionConfig?.dueDate;
  if (!dueDate) return '-';

  const remainingMs = msUntil(dueDate);
  if (remainingMs === null) return formatDate(dueDate);

  const diffDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  if (diffDays > 0) return t('inspection.taskDetail.slaDaysRemaining', { count: diffDays });
  if (diffDays === 0) return t('inspection.taskDetail.slaDueToday');
  return t('inspection.taskDetail.slaDaysOverdue', { count: Math.abs(diffDays) });
};

const getAttachmentType = (fileName: string) => {
  const extension = fileName.split('.').pop()?.trim().toUpperCase();
  return extension && extension.length <= 5 ? extension : 'FILE';
};

const getAttachmentItems = (taskDetail?: Record<string, any> | null): AttachmentItem[] => {
  const rawList = taskDetail?.attachments || taskDetail?.report?.reportAttachments || [];

  return ensureArray<any>(rawList).slice(0, 6).map((item, index) => {
    const name = item?.fileName || `Attachment ${index + 1}`;
    return {
      key: item?.id || item?.fileUrl || index,
      name,
      url: item?.fileUrl,
      type: getAttachmentType(name),
    };
  });
};

const getAuthorityName = (record?: Record<string, any> | null) => {
  return getDisplayValue(record?.inspectionTarget?.address?.authorityNameEn);
};

type TargetOverviewProfileAndApplicantData = {
  userId?: string | null;
  personalName?: string | null;
  userName?: string | null;
  emiratesId?: string | null;
  passportNumber?: string | null;
  uid?: string | null;
  isVip?: boolean;
  selfMonitorProgram?: SelfMonitorProgramInfo | null;
  profileStatusObj?: {
    id?: number | string | null;
    nameEn?: string | null;
    nameAr?: string | null;
  } | null;
};

type TargetOverviewEstablishmentData = IEstablishmentOverview & {
  emiratesInfo?: {
    id?: number | string | null;
    code?: string | null;
    name?: string | null;
  } | null;
};

const normalizeOverviewComparisonText = (value?: string | number | null) => (
  String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
);

const getDifferentSecondaryOverviewText = (
  primaryValue: string,
  secondaryValue?: string | number | null,
) => {
  const secondaryText = getDisplayValue(secondaryValue, '');
  if (!secondaryText) return undefined;

  return normalizeOverviewComparisonText(primaryValue) === normalizeOverviewComparisonText(secondaryText)
    ? undefined
    : secondaryText;
};

const getTargetOverviewProfileTypeLabel = (targetType: unknown) => {
  const numericTargetType = Number(targetType);
  if (numericTargetType === 1) return i18next.t('inspection.violation.detail.commercial');
  if (numericTargetType === 2) return i18next.t('inspection.violation.detail.individual');
  return '-';
};

const getInspectionMethodName = (record?: Record<string, any> | null) => {
  return getDisplayValue(record?.inspectionConfig?.inspectionTypeNameEn);
};

const isSuccessfulInspectionRecord = (record?: Record<string, any> | null) => {
  if (!record) return false;
  const accessResult = String(record.accessResult || record.reportSummary?.accessResult || '').toUpperCase();
  if (accessResult === 'UNABLE_TO_ACCESS') return false;

  const status = normalizeTaskStatus(record.status || record.result || record.reportSummary?.result);
  if (status === 'ACCESS_FAILED' || status === 'CANCELLED') return false;
  if (status === 'COMPLETED') return true;

  return Boolean(record.completionTime);
};

const getLastSuccessfulInspection = (taskDetail?: Record<string, any> | null) => {
  return isSuccessfulInspectionRecord(taskDetail?.lastInspection)
    ? taskDetail?.lastInspection
    : null;
};

const getReinspectionTask = (taskDetail?: Record<string, any> | null): ReinspectionTaskSummary | null => {
  const value = taskDetail?.reinspectionTask;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const reinspectionTask = value as ReinspectionTaskSummary;
  return [
    reinspectionTask.taskNumber,
    reinspectionTask.dueDate,
    reinspectionTask.inspector,
    reinspectionTask.status,
  ].some((item) => String(item ?? '').trim())
    ? reinspectionTask
    : null;
};

const isContentViolationRecord = (record?: Record<string, any> | null) => {
  const code = getViolationRecordCode(record);
  const text = getViolationRecordText(record);

  return text.includes('content') || /^C\d+/.test(code) || code.includes('-CNT-') || code.includes('CONTENT');
};

const isLicensingViolationRecord = (record?: Record<string, any> | null) => {
  const code = getViolationRecordCode(record);
  const text = getViolationRecordText(record);

  return (
    text.includes('license') ||
    text.includes('licensing') ||
    /^L\d+/.test(code) ||
    code.includes('-LIC-') ||
    code.includes('LICENSING')
  );
};

const getCountValue = (...values: unknown[]) => {
  const matched = values.find(
    (value) => value !== undefined && value !== null && String(value).trim() !== '',
  );
  const count = Number(matched);
  return Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
};

const getTargetOverviewCountDisplayValue = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return '-';
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.round(count)) : '-';
};

const getFiniteNumber = (value: unknown, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const getOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const formatTargetOverviewFineAmount = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return '0';
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? String(numberValue) : String(value);
};

const mapTargetOverviewViolationFineItem = (
  record: Record<string, any>,
  index: number,
  taskDetail?: Record<string, any> | null,
  sourcePrefix = 'violation',
): ViolationFineItem => {
  const rawId = record.id || record.violationNo;
  const taskNo = getDisplayValue(taskDetail?.taskNo || taskDetail?.taskId);

  return {
    id: String(rawId || `${sourcePrefix}-${index + 1}`),
    fineNo: getDisplayValue(record.violationNo),
    inspectionNo: getDisplayValue(record.sourceTaskNo || record.taskNo, taskNo),
    violationType: getDisplayValue(record.violationTypeName || record.violationType),
    fineAmount: formatTargetOverviewFineAmount(record.fineAmount),
    status: getDisplayValue(record.statusName || record.businessStatusName || record.internalStatusName),
    issueDate: getDisplayValue(record.createdOn, ''),
    paymentDate: getDisplayValue(record.paymentDate, ''),
  };
};

const isInspectionTargetIndividual = (target?: Record<string, any> | null) => {
  return resolveInspectionTaskTargetType(target) === 2;
};

const getTargetExplicitUserId = (target?: Record<string, any> | null) => (
  target?.userId
);

const getTargetExplicitProfileId = (target?: Record<string, any> | null) => (
  target?.userProfileId ?? target?.profileId
);

const normalizeOptionalId = (value: unknown): string | number | undefined => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  return typeof value === 'number' ? value : String(value);
};

const normalizePositiveNumericId = (value: unknown): string | number | undefined => {
  const normalizedValue = normalizeOptionalId(value);
  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return undefined;
  return normalizedValue;
};

const resolveInspectionTaskTargetType = (
  target?: Record<string, any> | null,
): 1 | 2 | undefined => {
  const targetTypeCandidates = [
    target?.targetType,
    target?.targetTypeId,
  ];
  const userTypeCandidates = [
    target?.userTypeId,
    target?.userType?.id,
  ];
  const textCandidates = [
    target?.targetTypeCode,
    target?.targetTypeName,
    target?.targetTypeNameEn,
    target?.userTypeName,
    target?.userTypeNameEn,
    target?.typeName,
  ];

  for (const value of targetTypeCandidates) {
    const numericValue = Number(value);
    if (numericValue === 1 || numericValue === 3) return 1;
    if (numericValue === 2) return 2;
  }

  for (const value of textCandidates) {
    const text = String(value ?? '').trim().toLowerCase();
    if (!text) continue;
    if (text.includes('individual') || text.includes('person')) return 2;
    if (
      text.includes('establishment') ||
      text.includes('commercial') ||
      text.includes('company')
    ) {
      return 1;
    }
  }

  for (const value of userTypeCandidates) {
    const numericValue = Number(value);
    if (numericValue === 1) return 2;
    if (Number.isFinite(numericValue) && numericValue > 1) return 1;
  }

  return undefined;
};

const getTargetOverviewRecordKey = (target?: Record<string, any> | null) => {
  const targetType = normalizeOptionalId(
    resolveInspectionTaskTargetType(target) ?? target?.targetType,
  );
  const targetId = Number(targetType) === 1
    ? normalizeOptionalId(target?.establishmentId)
    : normalizeOptionalId(getTargetExplicitProfileId(target) ?? target?.individualId);

  return [targetType, targetId, normalizeOptionalId(getTargetExplicitProfileId(target))]
    .filter(Boolean)
    .join(':');
};

const buildTargetIndividualProfile = (
  target: Record<string, any>,
  documentsCount: number,
  profile?: TargetOverviewProfileAndApplicantData | null,
): IUserIndividualProfile => {
  const address = target.address || {};
  const identity = resolveInspectionOverviewIdentity(profile);
  const profileId = getOptionalNumber(getTargetExplicitProfileId(target));
  const emirateId = getFiniteNumber(address.emirateId, 0);
  const emirateNameEn = getDisplayValue(address.emirateNameEn, '');
  const emirateNameAr = getDisplayValue(address.emirateNameAr, emirateNameEn);
  const communityName = getDisplayValue(address.communityNameEn || address.regionNameEn || address.areaNameEn, '');

  return {
    type: identity?.field === 'emiratesId'
      ? 1
      : identity?.field === 'passportNumber'
        ? 3
        : getFiniteNumber(target.targetType, 2),
    profileCode: getDisplayValue(target.profileCode, ''),
    userId: getDisplayValue(getTargetExplicitUserId(target), ''),
    proFileId: profileId as any,
    rejectReason: null,
    dateOfBirth: getDisplayValue(target.dateOfBirth || target.dateBirth, ''),
    passportNumber: identity?.field === 'passportNumber' ? identity.value : '',
    uid: identity?.field === 'uid' ? identity.value : '',
    email: getDisplayValue(target.email || target.personalEmail, ''),
    mobileNumber: getDisplayValue(target.mobileNumber || target.mobile || target.personalMobile || target.phoneNumber, ''),
    emiratesId: identity?.field === 'emiratesId' ? identity.value : '',
    fullNameAr: getDisplayValue(target.fullNameAr || target.establishmentNameAr || target.nameAr, ''),
    fullNameEn: getDisplayValue(target.fullName || target.fullNameEn || target.establishmentNameEn || target.nameEn, ''),
    nationalityId: getFiniteNumber(target.nationalityId, 0),
    nationalityInfo: target.nationalityInfo || { id: 0, code: '', nameEn: '', nameAr: '' },
    genderId: getFiniteNumber(target.genderId, 0),
    genderInfo: target.genderInfo || { id: 0, code: '', nameEn: '', nameAr: '' },
    passportExpiryDate: getDisplayValue(target.passportExpiryDate, ''),
    emiratesIdexpiryDate: getDisplayValue(target.emiratesIdexpiryDate, ''),
    occupation: getDisplayValue(target.occupation, ''),
    personalPhotoUrl: getDisplayValue(target.personalPhotoUrl, ''),
    passportCopyUrl: getDisplayValue(target.passportCopyUrl || target.passportUrl, ''),
    emiratesIdCopyUrl: getDisplayValue(target.emiratesIdCopyUrl || target.emiratesIdurl, ''),
    visaCopyUrl: getDisplayValue(target.visaCopyUrl || target.visaUrl, ''),
    visaExpiryDate: getDisplayValue(target.visaExpiryDate, ''),
    emirateId,
    emirateInfo: target.emirateInfo || { id: emirateId, code: '', nameEn: emirateNameEn, nameAr: emirateNameAr },
    regionId: getFiniteNumber(address.regionId || address.communityId, 0),
    regionInfo: target.regionInfo || { id: 0, code: '', nameEn: communityName, nameAr: '' },
    areaId: getFiniteNumber(address.areaId, 0),
    areaInfo: target.areaInfo || { id: 0, code: '', nameEn: getDisplayValue(address.areaNameEn, communityName), nameAr: '' },
    street: getDisplayValue(address.street, ''),
    proFileStatus: target.proFileStatus || {
      id: getFiniteNumber(target.profileStatusId || target.statusId, 0),
      code: getDisplayValue(target.profileStatusCode || target.status, ''),
      nameEn: getDisplayValue(target.profileStatusNameEn || target.statusNameEn || target.statusName, ''),
      nameAr: getDisplayValue(target.profileStatusNameAr || target.statusNameAr, ''),
    },
    documents: documentsCount,
  };
};

const getTimelineLocalizedText = (
  language: string,
  enValue?: string | null,
  arValue?: string | null,
  fallback = '-',
) => {
  const primary = language === 'ar' ? arValue : enValue;
  const secondary = language === 'ar' ? enValue : arValue;
  return getDisplayValue(primary || secondary, fallback);
};

const normalizeTimelineCode = (value?: unknown) => String(value ?? '')
  .trim()
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[\s-]+/g, '_')
  .toUpperCase();

const getTimelineEventKind = (item: InspectionTaskTimelineItem): TimelineEventKind => {
  const normalizedValues = [
    item.eventType,
    item.eventCode,
    item.displayTitle,
    item.title,
    item.titleEn,
    item.label,
  ]
    .map(normalizeTimelineCode)
    .filter(Boolean)
    .join(' ');

  if (normalizedValues.includes('REASSIGN')) return 'reassigned';
  if (normalizedValues.includes('ACCESS_FAILED') || (normalizedValues.includes('ACCESS') && normalizedValues.includes('FAILED'))) {
    return 'accessFailed';
  }
  if (normalizedValues.includes('CANCELLED') || normalizedValues.includes('CANCELED')) return 'cancelled';
  if (
    normalizedValues.includes('INSPECTION_COMPLETED') ||
    normalizedValues.includes('REPORT_SUBMITTED') ||
    normalizedValues.includes('CHECK_OUT')
  ) {
    return 'completed';
  }
  if (normalizedValues.includes('INSPECTION_STARTED') || normalizedValues.includes('CHECK_IN')) return 'started';
  if (normalizedValues.includes('ASSIGNED')) return 'assigned';
  if (normalizedValues.includes('QUEUED') || normalizedValues.includes('PENDING_ASSIGNMENT')) return 'queued';
  if (normalizedValues.includes('CREATED')) return 'created';
  return 'unknown';
};

const getTimelineTitleLabel = (item: InspectionTaskTimelineItem, language: string) => (
  getTimelineLocalizedText(
    language,
    item.displayTitle || item.title || item.titleEn || item.label,
    item.titleAr,
  )
);

const getTimelineActorLabel = (item: InspectionTaskTimelineItem) => (
  getDisplayValue(
    item.displayActor || item.operatorName || item.actualActorName || item.actor,
    '-',
  )
);

const getTimelineDetailLabel = (item: InspectionTaskTimelineItem, language: string) => (
  getTimelineLocalizedText(
    language,
    item.displayDetails || item.descriptionEn,
    item.descriptionAr,
  )
);

const getTimelineEventTimeLabel = (item: InspectionTaskTimelineItem) => {
  if (item.displayTime) {
    return formatDateTime(item.displayTime, item.displayTime);
  }
  return formatDateTime(item.createdOn || item.time || '');
};

const getTimelineActorIcon = (
  kind: TimelineEventKind,
  actorLabel: string,
): TimelineIconKey => {
  const normalizedActor = normalizeTimelineCode(actorLabel);
  if (
    normalizedActor.includes('AUTOMATED') ||
    normalizedActor.includes('AI_GENERATED') ||
    normalizedActor.includes('SYSTEM')
  ) {
    return 'system';
  }
  if (actorLabel === '-' && ['queued', 'created'].includes(kind)) {
    return 'system';
  }
  return 'user';
};

const getTimelineResultTone = (item: InspectionTaskTimelineItem) => {
  if (item.resultTone) return `is-${item.resultTone}`;
  const normalizedResult = String(item.result || '').toLowerCase();
  if (
    normalizedResult.includes('access') ||
    normalizedResult.includes('failed') ||
    normalizedResult.includes('violation')
  ) {
    return 'is-danger';
  }
  if (normalizedResult.includes('pending')) return 'is-warning';
  if (normalizedResult.includes('compliant') || normalizedResult.includes('completed')) return 'is-success';
  return 'is-neutral';
};

const getTimelineAttachments = (item?: InspectionTaskTimelineItem | null) => (
  ensureArray<InspectionTaskAttachmentPayload>(item?.attachments)
);

const getTimelineAttachmentCount = (item: InspectionTaskTimelineItem) => {
  const attachments = getTimelineAttachments(item);
  return attachments.length;
};

const hasTimelineAttachments = (item: InspectionTaskTimelineItem) => (
  getTimelineAttachmentCount(item) > 0
);

const InspectionTaskDetailsPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const teamTaskDetailContext = useTeamTaskDetailContext();
  const { t, i18n } = useTranslation();
  const { roles, inspectorId: currentInspectorId } = useInspectionAccess();
  const isManagerRole = hasAnyInspectionRole(roles, ['manager']);
  const isInspectorSelfCreate = !isManagerRole && roles.includes('inspector');
  const params = new URLSearchParams(location.search);
  const taskId = params.get('taskId') || '';
  const taskNo = params.get('taskNo') || '';
  const routeMode = params.get(INSPECTION_QUERY_KEYS.mode) || '';
  const routeFrom = params.get(INSPECTION_QUERY_KEYS.from) || '';
  const routeViolationId = params.get(INSPECTION_QUERY_KEYS.violationId) || '';
  const routeViolationNo = params.get(INSPECTION_QUERY_KEYS.violationNo) || '';
  const routeViolationStatus = params.get(INSPECTION_QUERY_KEYS.status) || '';
  const routeViolationType = params.get(INSPECTION_QUERY_KEYS.type) || '';

  const [loading, setLoading] = useState(false);
  const [taskDetail, setTaskDetail] = useState<Record<string, any> | null>(null);
  const [mainSectionState, setMainSectionState] = useState<Record<MainSectionKey, boolean>>({
    taskInfo: true,
    execution: true,
    lastInspection: true,
    reinspectionTask: true,
  });
  const [sideSectionState, setSideSectionState] = useState<Record<SideSectionKey, boolean>>({
    inspectionOutcome: true,
    aiRiskInsight: true,
    targetOverview: true,
    taskTimeline: true,
  });
  const [expandedPreview, setExpandedPreview] = useState<PreviewSectionKey | null>(null);
  const [targetOverviewQuickNav, setTargetOverviewQuickNav] = useState<TargetOverviewQuickNavTarget>(
    DEFAULT_TARGET_OVERVIEW_QUICK_NAV,
  );
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState<TaskModalMode>('edit');
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [cancelTaskModalVisible, setCancelTaskModalVisible] = useState(false);
  const [cancelTaskLoading, setCancelTaskLoading] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateTaskWarning, setDuplicateTaskWarning] = useState<DuplicateTaskWarningState>(() => createClosedDuplicateTaskWarningState());
  const duplicateTaskWarningLoading = duplicateTaskWarning.loading;
  const duplicateTaskWarningConfirm = duplicateTaskWarning.onConfirm;
  const [reportDetailLoading, setReportDetailLoading] = useState(false);
  const [reportDetailLoadedKey, setReportDetailLoadedKey] = useState('');
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<InspectionTaskTimelineItem | null>(null);
  const [targetOverviewEstablishment, setTargetOverviewEstablishment] =
    useState<TargetOverviewEstablishmentData | null>(null);
  const [targetOverviewProfileAndApplicant, setTargetOverviewProfileAndApplicant] =
    useState<TargetOverviewProfileAndApplicantData | null>(null);
  const [targetOverviewProfileKey, setTargetOverviewProfileKey] = useState('');

  const fetchDetail = useCallback(async () => {
    if (!taskId && !taskNo) return;
    setLoading(true);
    try {
      const payload = unwrapPayload<any>(await getInspectionTaskDetail({ taskId, taskNo } as any));
      setTaskDetail(payload || null);
      if (payload?.taskId && String(payload.taskId) !== String(taskId || '')) {
        history.replace(
          buildInspectionPath(location.pathname, location.search, {
            [INSPECTION_QUERY_KEYS.tab]: null,
            [INSPECTION_QUERY_KEYS.teamTab]: null,
            [INSPECTION_QUERY_KEYS.taskId]: String(payload.taskId),
            [INSPECTION_QUERY_KEYS.taskNo]: payload.taskNo || taskNo || null,
          }),
          location.state,
        );
      }
    } catch (error) {
      setTaskDetail(null);
      if (isInspectionDataMissingError(error)) {
        return;
      }
      CustomMessage.error(i18n.t('inspection.taskDetail.detailsUnavailable'));
    } finally {
      setLoading(false);
    }
  }, [history, i18n, location.pathname, location.search, location.state, taskId, taskNo]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    let isCurrent = true;
    const target = taskDetail?.inspectionTarget;
    const targetKey = getTargetOverviewRecordKey(target);

    const loadTargetOverviewProfile = async () => {
      if (!target) {
        setTargetOverviewEstablishment(null);
        setTargetOverviewProfileAndApplicant(null);
        setTargetOverviewProfileKey('');
        return;
      }

      setTargetOverviewEstablishment(null);
      setTargetOverviewProfileAndApplicant(null);
      setTargetOverviewProfileKey(targetKey);

      let nextEstablishment: TargetOverviewEstablishmentData | null = null;
      let nextProfileAndApplicant: TargetOverviewProfileAndApplicantData | null = null;
      const establishmentId = normalizePositiveNumericId(target.establishmentId);
      const profileId = normalizePositiveNumericId(
        getTargetExplicitProfileId(target) ?? target.individualId,
      );
      const targetType = resolveInspectionTaskTargetType(target);

      if (targetType === 1 && establishmentId) {
        try {
          nextEstablishment =
            unwrapPayload<TargetOverviewEstablishmentData>(await getUserEstablishmentByID(String(establishmentId))) ||
            null;
        } catch {
          nextEstablishment = null;
        }

        const establishmentProfileId =
          normalizePositiveNumericId(nextEstablishment?.userProfileId) ||
          profileId;

        if (establishmentProfileId) {
          try {
            const numericProfileId = Number(establishmentProfileId);
            nextProfileAndApplicant =
              unwrapPayload<TargetOverviewProfileAndApplicantData>(await profileAndApplicant(numericProfileId)) ||
              null;
          } catch {
            nextProfileAndApplicant = null;
          }
        }
      } else if (targetType === 2 && profileId) {
        try {
          nextProfileAndApplicant =
            unwrapPayload<TargetOverviewProfileAndApplicantData>(await profileAndApplicant(Number(profileId))) ||
            null;
        } catch {
          nextProfileAndApplicant = null;
        }
      }

      if (!isCurrent) return;
      setTargetOverviewEstablishment(nextEstablishment);
      setTargetOverviewProfileAndApplicant(nextProfileAndApplicant);
      setTargetOverviewProfileKey(targetKey);
    };

    loadTargetOverviewProfile();

    return () => {
      isCurrent = false;
    };
  }, [taskDetail]);

  useEffect(() => {
    setReportDetailLoadedKey('');
  }, [taskId, taskNo]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hasListTabState =
      searchParams.has(INSPECTION_QUERY_KEYS.tab) ||
      searchParams.has(INSPECTION_QUERY_KEYS.teamTab);
    if (!hasListTabState) return;

    history.replace(
      buildInspectionPath(location.pathname, location.search, {
        [INSPECTION_QUERY_KEYS.tab]: null,
        [INSPECTION_QUERY_KEYS.teamTab]: null,
      }),
      location.state,
    );
  }, [history, location.pathname, location.search, location.state]);

  const timelineItems = useMemo(() => buildTaskTimeline(taskDetail || {}), [taskDetail]);
  const selectedTimelineAttachments = useMemo(
    () => getTimelineAttachments(selectedTimelineItem),
    [selectedTimelineItem],
  );
  const reportSummary = useMemo(() => taskDetail?.report?.reportSummary || taskDetail?.report || {}, [taskDetail]);
  const normalizedStatus = normalizeTaskStatus(taskDetail?.status);
  const statusLabel = getTaskStatusLabel(taskDetail?.status);
  const statusTone = `is-${getStatusClassName(taskDetail?.status)}`;
  const inspectorName = getAssigneeName(taskDetail) || '-';
  const priorityRaw =
    taskDetail?.inspectionConfig?.priorityCode ||
    taskDetail?.inspectionConfig?.priorityNameEn ||
    taskDetail?.inspectionConfig?.priorityName ||
    taskDetail?.priority;
  const priorityLabel = getPriorityLabel(priorityRaw);
  const priorityTone = `is-${getPriorityClassName(priorityRaw)}`;
  const shouldShowSla = ['PENDING_VISIT', 'IN_PROGRESS'].includes(normalizedStatus);
  const attachments = useMemo(() => getAttachmentItems(taskDetail), [taskDetail]);
  const showInspectionOutcome = normalizedStatus === 'COMPLETED';

  const loadReportDetail = useCallback(async ({
    force = false,
    showError = reportModalVisible,
  }: LoadReportDetailOptions = {}) => {
    const reportTaskId = taskDetail?.taskId || taskId;
    const reportTaskNo = taskDetail?.taskNo || taskNo;
    if (!reportTaskId && !reportTaskNo) return;

    const reportKey = `${reportTaskId || ''}:${reportTaskNo || ''}`;
    if (reportDetailLoading || (!force && reportDetailLoadedKey === reportKey)) return;

    setReportDetailLoading(true);
    try {
      const payload = unwrapPayload<any>(await getInspectionTaskDetail(
        { taskId: reportTaskId, taskNo: reportTaskNo } as any,
        { includeFragments: ['report'] },
      ));
      if (payload) {
        setTaskDetail((current) => ({
          ...(current || {}),
          report: Object.prototype.hasOwnProperty.call(payload, 'report')
            ? payload.report
            : current?.report,
        }));
      }
      setReportDetailLoadedKey(reportKey);
    } catch (error) {
      if (isInspectionDataMissingError(error)) {
        setReportDetailLoadedKey(reportKey);
        return;
      }
      if (showError) {
        CustomMessage.error(t('inspection.taskDetail.detailsUnavailable'));
      }
    } finally {
      setReportDetailLoading(false);
    }
  }, [
    reportDetailLoadedKey,
    reportDetailLoading,
    reportModalVisible,
    taskDetail,
    taskId,
    taskNo,
    t,
  ]);

  useEffect(() => {
    if (!taskDetail) return;
    if (!reportModalVisible && !showInspectionOutcome) return;
    if (hasReportPreviewPayload(taskDetail)) return;
    loadReportDetail();
  }, [loadReportDetail, reportModalVisible, showInspectionOutcome, taskDetail]);

  const reinspectionTask = useMemo(() => getReinspectionTask(taskDetail), [taskDetail]);
  const lastSuccessfulInspection = useMemo(() => getLastSuccessfulInspection(taskDetail), [taskDetail]);
  const actionKeys = useMemo(
    () => getInspectionTaskActionKeys({ role: roles, task: taskDetail, currentInspectorId }),
    [currentInspectorId, roles, taskDetail],
  );
  const duplicateWarningReasonLabels = useMemo(
    () => duplicateWarningReasonKeys.map((key) => t(`inspection.tasks.reasons.${key}`)),
    [t],
  );

  const inspectionOutcomeViolations = useMemo(() => {
    const executionResult = taskDetail?.executionResult || {};
    const sourceRows = ensureArray<Record<string, any>>(executionResult.violationTickets);
    const seenKeys = new Set<string>();

    return sourceRows.filter((record, index) => {
      const key = String(record.violationId || record.violationNo || `inspection-outcome-violation-${index}`);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
  }, [taskDetail]);

  const inspectionOutcomeTickets = useMemo<InspectionOutcomeTicket[]>(() => {
    const licensingViolation = inspectionOutcomeViolations.find((item: any) => isLicensingViolationRecord(item));
    const contentViolation = inspectionOutcomeViolations.find((item: any) => isContentViolationRecord(item));
    const licensingNavigation = getViolationNavigationValues(licensingViolation);
    const contentNavigation = getViolationNavigationValues(contentViolation);
    const licensingValue = getReportViolationNo(licensingViolation || {});
    const contentValue = getReportViolationNo(contentViolation || {});

    return [
      {
        key: 'licensing',
        label: t('inspection.taskDetail.licensingViolationNumber'),
        value: getDisplayValue(licensingValue),
        record: licensingViolation || null,
        canOpen: Boolean(licensingNavigation.violationId || licensingNavigation.violationNo),
      },
      {
        key: 'content',
        label: t('inspection.taskDetail.contentViolationNumber'),
        value: getDisplayValue(contentValue),
        record: contentViolation || null,
        canOpen: Boolean(contentNavigation.violationId || contentNavigation.violationNo),
      },
    ];
  }, [inspectionOutcomeViolations, t]);

  const hasInspectionOutcomeViolation = useMemo(() => {
    const executionResult = taskDetail?.executionResult || {};
    return (
      inspectionOutcomeTickets.some((item) => item.value !== '-') ||
      inspectionOutcomeViolations.length > 0 ||
      isPositiveViolationFlag(reportSummary.hasViolationFound) ||
      isPositiveViolationFlag(reportSummary.hasViolation) ||
      isPositiveViolationFlag(taskDetail?.report?.hasViolationFound) ||
      isPositiveViolationFlag(executionResult.hasViolationFound) ||
      getCountValue(executionResult.violationCount, reportSummary.violationCount) > 0 ||
      [
        reportSummary.outcomeCode,
        reportSummary.outcomeName,
        executionResult.outcomeCode,
        executionResult.outcomeName,
      ].some(isViolationOutcomeValue)
    );
  }, [inspectionOutcomeTickets, inspectionOutcomeViolations.length, reportSummary, taskDetail]);

  const inspectionReason = getDisplayValue(taskDetail?.inspectionReasonName);

  const taskInfoItems = useMemo<DetailItem[]>(
    () => [
      { label: t('inspection.taskDetail.inspectionReason'), value: inspectionReason },
      { label: t('inspection.tasks.columns.createdBy'), value: getDisplayValue(getInspectionCreatorLabel(taskDetail?.createdByName)) },
    ],
    [inspectionReason, taskDetail, t],
  );

  const renderLinkValue = useCallback((value: string, onClick: () => void) => (
    <button type="button" className="inspection-task-details__detail-link" onClick={onClick}>
      {value}
    </button>
  ), []);

  const executionItems = useMemo<DetailItem[]>(() => {
    const items: DetailItem[] = [
      { label: t('inspection.taskDetail.inspectionMethod'), value: getDisplayValue(getInspectionMethodName(taskDetail)) },
      { label: t('inspection.taskDetail.dueDate'), value: formatDate(taskDetail?.inspectionConfig?.dueDate) },
      { label: t('inspection.tasks.columns.inspector'), value: inspectorName },
      {
        label: t('inspection.taskDetail.remarks'),
        value: getDisplayValue(reportSummary.overallComment || taskDetail?.description),
        multiline: true,
      },
    ];

    if (reportSummary.checkInAt || reportSummary.checkOutAt) {
      items.push(
        { label: t('inspection.taskDetail.checkInTime'), value: formatDateTime(String(reportSummary.checkInAt || '')) },
        { label: t('inspection.taskDetail.checkOutTime'), value: formatDateTime(String(reportSummary.checkOutAt || '')) },
      );
    }

    if (normalizedStatus === 'ACCESS_FAILED' || taskDetail?.accessOutcomeCode) {
      items.push(
        {
          label: t('inspection.taskDetail.accessOutcome'),
          value: getDisplayValue(taskDetail?.accessOutcomeName),
        },
        {
          label: t('inspection.taskDetail.accessReason'),
          value: getDisplayValue(taskDetail?.accessFailedReasonName),
        },
        {
          label: t('inspection.taskDetail.accessRemark'),
          value: getDisplayValue(taskDetail?.accessFailedRemark),
          fullWidth: true,
          multiline: true,
        },
      );
    }

    return items;
  }, [inspectorName, normalizedStatus, reportSummary, taskDetail, t]);

  const lastInspectionItems = useMemo<DetailItem[]>(() => {
    if (!lastSuccessfulInspection) return [];

    const lastTaskId = lastSuccessfulInspection.taskId;
    const lastTaskNumber = getDisplayValue(lastSuccessfulInspection.taskNumber);
    const lastTaskNoParam = lastSuccessfulInspection.taskNumber;
    const violationId = lastSuccessfulInspection.violationId;
    const violationNo = getDisplayValue(lastSuccessfulInspection.violationNo, 'None');
    const canOpenLastTask = lastTaskNumber !== '-';
    const canOpenViolation = violationNo !== 'None';

    return [
      {
        label: t('inspection.taskDetail.taskNumber'),
        value: canOpenLastTask
          ? renderLinkValue(lastTaskNumber, () => {
            history.push(buildInspectionPath(INSPECTION_PATHS.taskDetail, location.search, {
              [INSPECTION_QUERY_KEYS.from]: 'tasks',
              [INSPECTION_QUERY_KEYS.tab]: null,
              [INSPECTION_QUERY_KEYS.teamTab]: null,
              [INSPECTION_QUERY_KEYS.taskId]: lastTaskId ? String(lastTaskId) : null,
              [INSPECTION_QUERY_KEYS.taskNo]: lastTaskNoParam ? String(lastTaskNoParam) : lastTaskNumber,
              [INSPECTION_QUERY_KEYS.visitId]: null,
              [INSPECTION_QUERY_KEYS.step]: null,
              [INSPECTION_QUERY_KEYS.violationId]: null,
              [INSPECTION_QUERY_KEYS.violationNo]: null,
            }));
          })
          : lastTaskNumber,
        valueClassName: canOpenLastTask ? 'is-link' : undefined,
      },
      {
        label: t('inspection.tasks.columns.inspector'),
        value: getDisplayValue(lastSuccessfulInspection.inspector),
      },
      {
        label: t('inspection.taskDetail.completionTime'),
        value: formatDateTime(String(lastSuccessfulInspection.completionTime || '')),
      },
      {
        label: t('inspection.taskDetail.violationFound'),
        value: canOpenViolation
          ? renderLinkValue(violationNo, () => {
            history.push(buildInspectionPath(
              INSPECTION_PATHS.violations,
              location.search,
              buildViolationListNavigationPatch({ violationId, violationNo }),
            ));
          })
          : violationNo,
        valueClassName: canOpenViolation ? 'is-link' : undefined,
      },
    ];
  }, [history, lastSuccessfulInspection, location.search, renderLinkValue, t]);

  const reinspectionItems = useMemo<DetailItem[]>(() => {
    if (!reinspectionTask) return [];

    const reinspectionTaskNumber = getDisplayValue(reinspectionTask.taskNumber);
    const reinspectionStatus = getDisplayValue(reinspectionTask.status, '');
    const canOpenReinspectionTask = reinspectionTaskNumber !== '-';

    return [
      {
        label: t('inspection.taskDetail.taskNumber'),
        value: canOpenReinspectionTask
          ? renderLinkValue(reinspectionTaskNumber, () => {
            history.push(buildInspectionPath(INSPECTION_PATHS.taskDetail, location.search, {
              [INSPECTION_QUERY_KEYS.from]: 'tasks',
              [INSPECTION_QUERY_KEYS.tab]: null,
              [INSPECTION_QUERY_KEYS.teamTab]: null,
              [INSPECTION_QUERY_KEYS.taskId]: null,
              [INSPECTION_QUERY_KEYS.taskNo]: reinspectionTaskNumber,
              [INSPECTION_QUERY_KEYS.visitId]: null,
              [INSPECTION_QUERY_KEYS.step]: null,
              [INSPECTION_QUERY_KEYS.violationId]: null,
              [INSPECTION_QUERY_KEYS.violationNo]: null,
            }));
          })
          : reinspectionTaskNumber,
        valueClassName: canOpenReinspectionTask ? 'is-link' : undefined,
      },
      {
        label: t('inspection.tasks.columns.inspector'),
        value: getDisplayValue(reinspectionTask.inspector),
      },
      {
        label: t('inspection.taskDetail.dueDate'),
        value: formatDate(reinspectionTask.dueDate),
      },
      {
        label: t('inspection.tasks.columns.status'),
        value: reinspectionStatus ? getTaskStatusLabel(reinspectionStatus) : '-',
      },
    ];
  }, [history, location.search, reinspectionTask, renderLinkValue, t]);

  const targetOverviewCurrentProfileKey = useMemo(
    () => getTargetOverviewRecordKey(taskDetail?.inspectionTarget),
    [taskDetail],
  );
  const canUseTargetOverviewProfileData = Boolean(targetOverviewCurrentProfileKey) &&
    targetOverviewProfileKey === targetOverviewCurrentProfileKey;
  const activeTargetOverviewEstablishment = canUseTargetOverviewProfileData
    ? targetOverviewEstablishment
    : null;
  const activeTargetOverviewProfileAndApplicant = canUseTargetOverviewProfileData
    ? targetOverviewProfileAndApplicant
    : null;

  const targetOverviewData = useMemo<TargetOverviewData>(() => {
    const target = taskDetail?.inspectionTarget || {};
    const targetOverview = taskDetail?.targetOverview;
    const establishment = activeTargetOverviewEstablishment;
    const profileAndApplicant = activeTargetOverviewProfileAndApplicant;
    const targetStatusLabel = getDisplayValue(profileAndApplicant?.profileStatusObj?.nameEn);
    const targetType = resolveInspectionTaskTargetType(target);

    if (targetType === 2) {
      const identity = resolveInspectionOverviewIdentity(profileAndApplicant);
      const identityLabels = {
        'applicationOverviewCards.emiratesId': t('applicationOverviewCards.emiratesId'),
        'applicationOverviewCards.passport': t('applicationOverviewCards.passport'),
        'applicationOverviewCards.uid': t('applicationOverviewCards.uid'),
      };

      return {
        profileType: getTargetOverviewProfileTypeLabel(targetType),
        selfMonitorProgram: profileAndApplicant?.selfMonitorProgram,
        statusLabel: targetStatusLabel,
        statusCode: profileAndApplicant?.profileStatusObj?.id,
        statusTone: getTargetOverviewStatusTone(targetStatusLabel),
        fields: [
          {
            label: t('applicationOverviewCards.fullName'),
            value: getDisplayValue(
              profileAndApplicant?.personalName ??
                profileAndApplicant?.userName ??
                target.fullName ??
                target.fullNameEn ??
                target.nameEn,
            ),
          },
          ...(identity ? [{ label: identityLabels[identity.labelKey], value: identity.value }] : []),
        ],
        statistics: [],
        alerts: [
          {
            key: 'warnings',
            label: t('inspection.taskDetail.warningsViolations'),
            count: getTargetOverviewCountDisplayValue(targetOverview?.violationCount),
            tone: 'danger',
          },
          {
            key: 'fines',
            label: t('inspection.taskDetail.unpaidFines'),
            count: getTargetOverviewCountDisplayValue(targetOverview?.unpayCount),
            tone: 'warning',
          },
        ],
      };
    }

    const targetName = getLocalizedText(establishment?.nameEn, establishment?.nameAr, '-');
    const targetNameSecondarySource = getCurrentLanguage() === 'ar'
      ? establishment?.nameEn
      : establishment?.nameAr;

    return {
      profileType: getTargetOverviewProfileTypeLabel(targetType ?? target.targetType),
      selfMonitorProgram: profileAndApplicant?.selfMonitorProgram,
      statusLabel: targetStatusLabel,
      statusCode: profileAndApplicant?.profileStatusObj?.id,
      statusTone: getTargetOverviewStatusTone(targetStatusLabel),
      fields: [
        {
          label: t('inspection.taskDetail.establishmentName'),
          value: targetName,
          secondary: getDifferentSecondaryOverviewText(targetName, targetNameSecondarySource),
        },
        {
          label: t('inspection.taskDetail.commercialLicenseNumber'),
          value: getDisplayValue(establishment?.licenseNumber),
        },
        {
          label: t('inspection.tasks.columns.emirate'),
          value: getInspectionTaskEmirateLabel(establishment?.emiratesInfo?.name || undefined, t) || '-',
        },
      ],
      statistics: [
        {
          key: 'documents',
          icon: 'documents',
          label: t('inspection.taskDetail.documents'),
          count: getTargetOverviewCountDisplayValue(establishment?.documentsCount),
        },
        {
          key: 'partners',
          icon: 'partners',
          label: t('inspection.taskDetail.partners'),
          count: getTargetOverviewCountDisplayValue(establishment?.partnersCount),
        },
      ],
      alerts: [
        {
          key: 'warnings',
          label: t('inspection.taskDetail.warningsViolations'),
          count: getTargetOverviewCountDisplayValue(targetOverview?.violationCount),
          tone: 'danger',
        },
        {
          key: 'fines',
          label: t('inspection.taskDetail.unpaidFines'),
          count: getTargetOverviewCountDisplayValue(targetOverview?.unpayCount),
          tone: 'warning',
        },
      ],
    };
  }, [
    activeTargetOverviewEstablishment,
    activeTargetOverviewProfileAndApplicant,
    taskDetail,
    t,
  ]);

  const targetOverviewDocumentsCount = getCountValue(activeTargetOverviewEstablishment?.documentsCount);

  const targetOverviewViolationFineRows = useMemo<ViolationFineItem[]>(() => {
    const executionResult = taskDetail?.executionResult || taskDetail?.executionState || {};
    const sourceRows = [
      ...ensureArray<Record<string, any>>(executionResult.violationTickets),
      ...ensureArray<Record<string, any>>(taskDetail?.violations),
      ...ensureArray<Record<string, any>>(reportSummary.checklistViolations),
    ];
    const rows: ViolationFineItem[] = [];
    const seenKeys = new Set<string>();

    sourceRows.forEach((record, index) => {
      const row = mapTargetOverviewViolationFineItem(record, index, taskDetail, 'target-overview-violation');
      const uniqueKey = row.fineNo !== '-' ? row.fineNo : row.id;
      if (seenKeys.has(uniqueKey)) return;
      seenKeys.add(uniqueKey);
      rows.push(row);
    });

    return rows;
  }, [reportSummary.checklistViolations, taskDetail]);

  const targetOverviewFullScreenType = useMemo<TargetOverviewFullScreenType>(
    () => (isInspectionTargetIndividual(taskDetail?.inspectionTarget) ? 'Individual' : 'Commercial'),
    [taskDetail],
  );

  const targetOverviewEstablishmentData = useMemo(
    () => activeTargetOverviewEstablishment || undefined,
    [activeTargetOverviewEstablishment],
  );

  const targetOverviewApplicantData = useMemo(
    () => buildTargetIndividualProfile(
      taskDetail?.inspectionTarget || {},
      targetOverviewDocumentsCount,
      activeTargetOverviewProfileAndApplicant,
    ),
    [activeTargetOverviewProfileAndApplicant, targetOverviewDocumentsCount, taskDetail],
  );

  const targetOverviewProfileAndApplicantData = useMemo(() => {
    const profileAndApplicant = activeTargetOverviewProfileAndApplicant;
    return {
      isVip: Boolean(profileAndApplicant?.isVip),
      profileStatusObj: {
        id: getFiniteNumber(profileAndApplicant?.profileStatusObj?.id, 0),
        nameEn: getDisplayValue(profileAndApplicant?.profileStatusObj?.nameEn),
        nameAr: getDisplayValue(profileAndApplicant?.profileStatusObj?.nameAr),
      },
    };
  }, [activeTargetOverviewProfileAndApplicant]);

  const targetOverviewUserId = useMemo(() => {
    const target = taskDetail?.inspectionTarget || {};
    return normalizeOptionalId(activeTargetOverviewProfileAndApplicant?.userId) ||
      normalizeOptionalId(getTargetExplicitUserId(target));
  }, [activeTargetOverviewProfileAndApplicant, taskDetail]);

  const targetOverviewProfileId = useMemo(() => {
    const target = taskDetail?.inspectionTarget;
    if (resolveInspectionTaskTargetType(target) === 2) {
      return normalizeOptionalId(
        getTargetExplicitProfileId(target) ?? target?.individualId,
      );
    }

    return normalizeOptionalId(activeTargetOverviewEstablishment?.userProfileId) ||
      normalizeOptionalId(getTargetExplicitProfileId(target));
  }, [activeTargetOverviewEstablishment, taskDetail]);

  const targetOverviewEstablishmentId = useMemo(() => {
    const target = taskDetail?.inspectionTarget;
    if (resolveInspectionTaskTargetType(target) !== 1) return undefined;
    return normalizeOptionalId(target?.establishmentId);
  }, [taskDetail]);

  const targetOverviewIndividualId = useMemo(() => {
    const target = taskDetail?.inspectionTarget;
    if (resolveInspectionTaskTargetType(target) !== 2) return undefined;
    return normalizeOptionalId(target?.individualId);
  }, [taskDetail]);

  const targetOverviewTaskId = useMemo(
    () => normalizeOptionalId(taskDetail?.taskId || taskId),
    [taskDetail, taskId],
  );

  const topSummaryItems = useMemo(() => {
    const items = [
      {
        label: t('inspection.taskDetail.taskNumber'),
        value: getDisplayValue(taskDetail?.taskNo),
        icon: inspectionFigmaAssets.topSummaryIcons[0],
      },
      {
        label: t('inspection.tasks.columns.status'),
        value: statusLabel,
        tone: statusTone,
        icon: inspectionFigmaAssets.topSummaryIcons[1],
      },
      {
        label: t('inspection.tasks.columns.inspector'),
        value: inspectorName,
        icon: inspectionFigmaAssets.topSummaryIcons[2],
      },
      {
        label: t('inspection.tasks.columns.priority'),
        value: priorityLabel,
        tone: priorityTone,
        icon: inspectionFigmaAssets.topSummaryIcons[3],
      },
    ];

    if (shouldShowSla) {
      items.push({
        label: t('inspection.tasks.columns.sla'),
        value: getSlaText(taskDetail, t),
        icon: inspectionFigmaAssets.topSummaryIcons[4],
      });
    }

    return items;
  }, [
    inspectorName,
    priorityLabel,
    priorityTone,
    shouldShowSla,
    statusLabel,
    statusTone,
    t,
    taskDetail,
  ]);

  const previewTitleMap: Record<PreviewSectionKey, string> = useMemo(
    () => ({
      inspectionOutcome: t('inspection.taskDetail.inspectionOutcome'),
      aiRiskInsight: t('inspection.taskDetail.aiRiskInsight'),
      targetOverview: t('inspection.taskDetail.targetOverview'),
    }),
    [t],
  );

  const actionLabelMap: Record<InspectionTaskActionKey, string> = useMemo(
    () => ({
      assign: t('inspection.tasks.actions.assignNow'),
      startVisit: t('inspection.tasks.actions.startVisit'),
      continueVisit: t('inspection.common.continue'),
      edit: t('inspection.common.edit'),
      cancel: t('inspection.common.cancel'),
      duplicate: t('inspection.common.duplicate'),
      viewReport: t('inspection.common.viewReport'),
    }),
    [t],
  );

  const navigateBack = useCallback(() => {
    const dashboardReturnState = readDashboardReturnState(location.state);

    if (dashboardReturnState) {
      history.push(createDashboardReturnLocation(dashboardReturnState));
      return;
    }

    if (routeFrom === 'violationDetail' && (routeViolationId || routeViolationNo)) {
      history.push(buildInspectionPath(INSPECTION_PATHS.violationDetail, '', {
        [INSPECTION_QUERY_KEYS.from]: 'violations',
        [INSPECTION_QUERY_KEYS.violationId]: routeViolationId || null,
        [INSPECTION_QUERY_KEYS.violationNo]: routeViolationNo || null,
        [INSPECTION_QUERY_KEYS.status]: routeViolationStatus || null,
        [INSPECTION_QUERY_KEYS.type]: routeViolationType || null,
      }));
      return;
    }

    history.push(INSPECTION_PATHS.tasks, {
      [KEEP_ALIVE_RESTORE_STATE_KEY]: true,
    });
  }, [
    history,
    location.state,
    routeFrom,
    routeViolationId,
    routeViolationNo,
    routeViolationStatus,
    routeViolationType,
  ]);

  const navigateToExecution = useCallback((mode: 'start' | 'continue') => {
    const step = mode === 'start'
      ? 'targetAccess'
      : normalizeInspectionExecutionStep(
          taskDetail?.executionState?.currentStepKey ||
          taskDetail?.executionState?.currentStepCode ||
          taskDetail?.executionState?.currentStep,
          taskDetail?.executionState?.currentStepId,
        );

    history.push(buildInspectionPath(INSPECTION_PATHS.taskExecution, location.search, {
      [INSPECTION_QUERY_KEYS.role]: null,
      [INSPECTION_QUERY_KEYS.scope]: null,
      taskId: taskDetail?.taskId || taskId,
      taskNo: taskDetail?.taskNo || taskNo,
      visitId: taskDetail?.visitId || `VIS-${taskDetail?.taskId || taskId || taskNo}`,
      step,
      mode,
      reportNo: null,
    }));
  }, [history, location.search, taskDetail, taskId, taskNo]);

  const navigateToViolationRecord = useCallback((record?: Record<string, any> | null) => {
    const { violationId, violationNo } = getViolationNavigationValues(record);

    if (!violationId && !violationNo) return;

    history.push(buildInspectionPath(
      INSPECTION_PATHS.violations,
      location.search,
      buildViolationListNavigationPatch(record),
    ));
  }, [history, location.search]);

  const handleReportViolationClick = useCallback((record: Record<string, any>) => {
    navigateToViolationRecord(record);
  }, [navigateToViolationRecord]);

  useEffect(() => {
    if (routeMode !== 'report' || (!taskDetail && !taskId && !taskNo)) return;

    setReportModalVisible(true);
    history.replace(
      buildInspectionPath(location.pathname, location.search, {
        [INSPECTION_QUERY_KEYS.mode]: null,
      }),
      location.state,
    );
  }, [
    history,
    location.pathname,
    location.search,
    location.state,
    routeMode,
    taskDetail,
    taskId,
    taskNo,
  ]);

  const handleTaskModalVisibleChange = useCallback((nextVisible: boolean) => {
    setTaskModalVisible(nextVisible);
  }, []);

  const handleDuplicate = useCallback(async () => {
    if (!taskDetail?.taskId || duplicateLoading) return;

    const submitDuplicate = async () => {
      setDuplicateLoading(true);
      try {
        await duplicateInspectionTask({ taskId: taskDetail.taskId } as any);
        CustomMessage.success(t('inspection.tasks.messages.duplicated'));
      } finally {
        setDuplicateLoading(false);
      }
    };

    if (duplicateWarningReasonLabels.includes(taskDetail.inspectionConfig?.inspectionReasonNameEn)) {
      setDuplicateTaskWarning({
        visible: true,
        message: t('inspection.tasks.messages.duplicateWarningContent'),
        loading: false,
        onConfirm: submitDuplicate,
      });
      return;
    }

    await submitDuplicate();
  }, [duplicateLoading, duplicateWarningReasonLabels, taskDetail, t]);

  const closeDuplicateTaskWarning = useCallback(() => {
    if (duplicateTaskWarningLoading) return;
    setDuplicateTaskWarning(createClosedDuplicateTaskWarningState());
  }, [duplicateTaskWarningLoading]);

  const confirmDuplicateTaskWarning = useCallback(async () => {
    if (duplicateTaskWarningLoading || !duplicateTaskWarningConfirm) return;

    setDuplicateTaskWarning((previous) => ({ ...previous, loading: true }));
    try {
      await duplicateTaskWarningConfirm();
      setDuplicateTaskWarning(createClosedDuplicateTaskWarningState());
    } catch {
      setDuplicateTaskWarning((previous) => ({ ...previous, loading: false }));
    }
  }, [duplicateTaskWarningConfirm, duplicateTaskWarningLoading]);

  const submitAssign = useCallback(async (inspectorIds: string[]) => {
    if (!taskDetail?.taskId) return;

    await assignInspectionTask({
      taskId: Number(taskDetail.taskId),
      inspectorIds,
      reason: 'Assigned from task detail.',
    } as any);
    CustomMessage.success(t('inspection.tasks.messages.assignmentSaved'));
    setAssignModalVisible(false);
    await fetchDetail();
  }, [fetchDetail, taskDetail, t]);

  const closeCancelTaskModal = useCallback(() => {
    if (cancelTaskLoading) return;
    setCancelTaskModalVisible(false);
  }, [cancelTaskLoading]);

  const confirmCancelTask = useCallback(async () => {
    if (!taskDetail?.taskId || cancelTaskLoading) return;

    setCancelTaskLoading(true);
    try {
      await cancelInspectionTask({
        taskId: Number(taskDetail.taskId),
        reason: 'Cancelled from task detail.',
      } as any);
      CustomMessage.success(t('inspection.tasks.messages.cancelled'));
      setCancelTaskModalVisible(false);
      await fetchDetail();
    } catch {
      // Keep the modal open; the request layer handles failure messaging.
    } finally {
      setCancelTaskLoading(false);
    }
  }, [cancelTaskLoading, fetchDetail, taskDetail, t]);

  const runTaskAction = useCallback((actionKey: InspectionTaskActionKey) => {
    if (actionKey === 'assign') {
      setAssignModalVisible(true);
      return;
    }

    if (actionKey === 'startVisit' || actionKey === 'continueVisit') {
      navigateToExecution(actionKey === 'continueVisit' ? 'continue' : 'start');
      return;
    }

    if (actionKey === 'edit') {
      setTaskModalMode('edit');
      setTaskModalVisible(true);
      return;
    }

    if (actionKey === 'cancel') {
      setCancelTaskLoading(false);
      setCancelTaskModalVisible(true);
      return;
    }

    if (actionKey === 'duplicate') {
      handleDuplicate();
      return;
    }

    if (actionKey === 'viewReport') {
      setReportModalVisible(true);
      loadReportDetail({ force: true, showError: true });
    }
  }, [handleDuplicate, loadReportDetail, navigateToExecution]);

  const toggleMainSection = useCallback((key: MainSectionKey) => {
    setMainSectionState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const toggleSideSection = useCallback((key: SideSectionKey) => {
    setSideSectionState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const closeExpandedPreview = useCallback(() => {
    setExpandedPreview(null);
    setTargetOverviewQuickNav(DEFAULT_TARGET_OVERVIEW_QUICK_NAV);
  }, []);

  const openTargetOverviewFullScreen = useCallback((target?: Partial<TargetOverviewQuickNavTarget>) => {
    setTargetOverviewQuickNav(
      createOverviewQuickNavTarget(
        target,
        DEFAULT_TARGET_OVERVIEW_QUICK_NAV.initialTab,
      ),
    );
    setExpandedPreview('targetOverview');
  }, []);

  const openPreviewFullScreen = useCallback((key: PreviewSectionKey) => {
    if (key === 'targetOverview') {
      openTargetOverviewFullScreen();
      return;
    }

    setExpandedPreview(key);
  }, [openTargetOverviewFullScreen]);

  const handleTargetOverviewStatisticClick = useCallback(
    (key: string) => {
      if (key === 'documents') {
        openTargetOverviewFullScreen({
          initialTab: 'basic-information',
          scrollToDocuments: true,
        });
        return;
      }

      if (key === 'partners') {
        openTargetOverviewFullScreen({
          initialTab: 'basic-information',
          scrollToPartners: true,
        });
        return;
      }

      openTargetOverviewFullScreen();
    },
    [openTargetOverviewFullScreen],
  );

  const handleTargetOverviewAlertClick = useCallback(
    (key: string) => {
      if (key === 'warnings' || key === 'fines') {
        openTargetOverviewFullScreen({
          initialTab: 'violations-fines',
        });
        return;
      }

      openTargetOverviewFullScreen();
    },
    [openTargetOverviewFullScreen],
  );

  const renderDetailGrid = useCallback((items: DetailItem[], className: string) => (
    <div className={className}>
      {items.map((item) => (
        <div
          key={item.label}
          className={`inspection-task-details__detail-block ${item.fullWidth ? 'is-full-width' : ''}`}
        >
          <div className="inspection-task-details__detail-label">{item.label}</div>
          <div className={`inspection-task-details__detail-value ${item.multiline ? 'is-multiline' : ''} ${item.valueClassName || ''}`}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  ), []);

  const renderInspectionOutcomeContent = useCallback(
    (isExpanded = false) => {
      return (
        <div
          className={`inspection-task-details__outcome ${hasInspectionOutcomeViolation ? 'inspection-task-details__outcome--violation' : 'inspection-task-details__outcome--empty'} ${isExpanded ? 'inspection-task-details__outcome--expanded' : ''}`}
        >
          <div className="inspection-task-details__outcome-status-card">
            <span className="inspection-task-details__outcome-icon">
              <img
                src={
                  hasInspectionOutcomeViolation
                    ? inspectionFigmaAssets.inspectionOutcomeIcons.violationFound
                    : inspectionFigmaAssets.inspectionOutcomeIcons.violationNotFound
                }
                alt=""
              />
            </span>
            <strong>{hasInspectionOutcomeViolation ? t('inspection.taskDetail.violationFound') : t('inspection.taskDetail.noViolationFound')}</strong>
          </div>
          {hasInspectionOutcomeViolation ? (
            <div className="inspection-task-details__outcome-field-list">
              {inspectionOutcomeTickets.map((item) => (
                <div key={item.key} className="inspection-task-details__outcome-field">
                  <span className="inspection-task-details__outcome-field-label">{item.label}</span>
                  {item.canOpen && item.value !== '-' ? (
                    <button
                      type="button"
                      className="inspection-task-details__outcome-field-value inspection-task-details__outcome-field-link"
                      onClick={() => navigateToViolationRecord(item.record)}
                    >
                      {item.value}
                    </button>
                  ) : (
                    <span className="inspection-task-details__outcome-field-value">{item.value}</span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );
    },
    [hasInspectionOutcomeViolation, inspectionOutcomeTickets, navigateToViolationRecord, t],
  );

  const renderAiRiskInsightContent = useCallback(
    (isExpanded = false) => (
      <AiRiskInsightCard
        riskProfile={taskDetail?.riskProfile}
        fallbackInsight={taskDetail?.aiRiskInsight}
        isExpanded={isExpanded}
      />
    ),
    [taskDetail],
  );

  const renderTargetOverviewContent = useCallback(
    (isExpanded = false) => (
      <TargetOverviewCard
        data={targetOverviewData}
        isExpanded={isExpanded}
        onStatisticClick={handleTargetOverviewStatisticClick}
        onAlertClick={handleTargetOverviewAlertClick}
      />
    ),
    [handleTargetOverviewAlertClick, handleTargetOverviewStatisticClick, targetOverviewData],
  );

  const renderTimelineContent = useCallback(
    () => {
      if (!timelineItems.length) {
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="-" />;
      }

      const hasCurrentStatusEvent = timelineItems.some(
        (timelineItem) => typeof timelineItem.isCurrentStatusEvent === 'boolean',
      );

      const renderedTimelineItems = timelineItems.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === timelineItems.length - 1;
        const isActiveEvent = hasCurrentStatusEvent ? Boolean(item.isCurrentStatusEvent) : isFirst;
        const eventKind = getTimelineEventKind(item);
        const title = getTimelineTitleLabel(item, i18n.language);
        const details = getTimelineDetailLabel(item, i18n.language);
        const locationLabel = getDisplayValue(item.displayLocation, '-');
        const actorLabel = getTimelineActorLabel(item);
        const resultLabel = getDisplayValue(item.result, '-');
        const timelineAttachments = getTimelineAttachments(item);
        const attachmentCount = getTimelineAttachmentCount(item);
        const shouldRenderInlineAttachments =
          timelineAttachments.length > 0 && timelineAttachments.length < 3;
        const actorIcon = getTimelineActorIcon(eventKind, actorLabel);

        const renderEventSpecificRows = () => {
          const sharedRows = (
            <>
              <TimelineMetaRow icon={actorIcon}>
                {actorLabel}
              </TimelineMetaRow>
              <TimelineMetaRow icon="calendar">
                {getTimelineEventTimeLabel(item)}
              </TimelineMetaRow>
            </>
          );

          switch (eventKind) {
            case 'completed':
              return (
                <>
                  {sharedRows}
                  <TimelineMetaRow icon="result">
                    <span className="inspection-task-details__timeline-result-label">
                      {t('inspection.timeline.inspectionResult')}:
                    </span>
                    <span
                      className={`inspection-task-details__timeline-result ${getTimelineResultTone(item)}`}
                    >
                      {resultLabel}
                    </span>
                  </TimelineMetaRow>
                  <TimelineMetaRow icon="location">
                    {`${t('inspection.report.checkOutLocation')}: ${locationLabel}`}
                  </TimelineMetaRow>
                </>
              );
            case 'started':
              return (
                <>
                  {sharedRows}
                  <TimelineMetaRow icon="location">
                    {`${t('inspection.report.checkInLocation')}: ${locationLabel}`}
                  </TimelineMetaRow>
                </>
              );
            case 'assigned':
            case 'reassigned':
              return (
                <>
                  {sharedRows}
                  <TimelineMetaRow icon="action">
                    {details}
                  </TimelineMetaRow>
                </>
              );
            case 'queued':
            case 'created':
              return sharedRows;
            case 'accessFailed':
            case 'cancelled':
              return (
                <>
                  {sharedRows}
                  <TimelineMetaRow icon="reason">
                    {`${t('inspection.tasks.fields.reason')}: ${details}`}
                  </TimelineMetaRow>
                </>
              );
            default:
              return (
                <>
                  {sharedRows}
                  {details !== '-' ? (
                    <TimelineMetaRow icon="action">
                      {details}
                    </TimelineMetaRow>
                  ) : null}
                </>
              );
          }
        };

        return (
          <div
            key={`${item.id}-${item.eventType}-${index}`}
            className="inspection-task-details__timeline-item"
          >
            <div className="inspection-task-details__timeline-marker">
              {!isFirst ? <span className="inspection-task-details__timeline-marker-line is-top" /> : null}
              <span
                className={`inspection-task-details__timeline-marker-dot ${isActiveEvent ? 'is-active' : ''}`}
              />
              {!isLast ? <span className="inspection-task-details__timeline-marker-line is-bottom" /> : null}
            </div>
            <div className="inspection-task-details__timeline-content">
              <div className="inspection-task-details__timeline-title">{title}</div>
              <div className="inspection-task-details__timeline-meta-stack">
                {renderEventSpecificRows()}
                {shouldRenderInlineAttachments ? (
                  <InspectionAttachmentGrid
                    attachments={timelineAttachments}
                    className="inspection-task-details__timeline-inline-attachments inspection-attachment-grid--single"
                    compact
                  />
                ) : hasTimelineAttachments(item) ? (
                  <TimelineAttachmentBar
                    count={attachmentCount}
                    label={t('inspection.execution.attachments')}
                    onClick={() => setSelectedTimelineItem(item)}
                  />
                ) : null}
              </div>
            </div>
          </div>
        );
      });

      return (
        <div className="inspection-task-details__timeline-list">
          {renderedTimelineItems}
        </div>
      );
    },
    [i18n.language, t, timelineItems],
  );

  const renderExpandedPreview = useCallback(() => {
    if (!expandedPreview) return null;

    if (expandedPreview === 'targetOverview') {
      return (
        <div className="inspection-task-details__fullscreen-wrap inspection-task-details__fullscreen-wrap--target-overview">
          <div className="inspection-task-details__target-overview-fullscreen">
            <FullScreen
              type={targetOverviewFullScreenType}
              applicant={targetOverviewApplicantData}
              establishment={targetOverviewEstablishmentData}
              userId={targetOverviewUserId}
              profileId={targetOverviewProfileId}
              targetEstablishmentId={targetOverviewEstablishmentId}
              targetIndividualId={targetOverviewIndividualId}
              targetTaskId={targetOverviewTaskId}
              profileAndApplicantData={targetOverviewProfileAndApplicantData}
              quickNav={targetOverviewQuickNav}
              violationsFines={targetOverviewViolationFineRows}
              visualVariant="figmaOverview"
              preserveApplicantIdentity
              onClose={closeExpandedPreview}
            />
          </div>
        </div>
      );
    }

    let content: React.ReactNode = null;
    if (expandedPreview === 'inspectionOutcome') {
      content = renderInspectionOutcomeContent(true);
    } else if (expandedPreview === 'aiRiskInsight') {
      content = renderAiRiskInsightContent(true);
    }

    return (
      <div className="inspection-task-details__fullscreen-wrap">
        <section className="inspection-task-details__preview-card inspection-task-details__preview-card--fullscreen">
          <DetailCardHeader
            title={previewTitleMap[expandedPreview]}
            open={true}
            showChevron={false}
            showShrinkIcon
            onShrink={closeExpandedPreview}
            rootClassName="inspection-task-details__preview-fullscreen-header"
            shrinkButtonAriaLabel={`${previewTitleMap[expandedPreview]} close`}
          />
          <div className="inspection-task-details__preview-fullscreen-body">{content}</div>
        </section>
      </div>
    );
  }, [
    expandedPreview,
    closeExpandedPreview,
    previewTitleMap,
    renderAiRiskInsightContent,
    renderInspectionOutcomeContent,
    targetOverviewApplicantData,
    targetOverviewEstablishmentData,
    targetOverviewFullScreenType,
    targetOverviewEstablishmentId,
    targetOverviewTaskId,
    targetOverviewProfileAndApplicantData,
    targetOverviewProfileId,
    targetOverviewIndividualId,
    targetOverviewQuickNav,
    targetOverviewUserId,
    targetOverviewViolationFineRows,
  ]);

  const sortedActionKeys = useMemo(
    () => INSPECTION_TASK_ACTION_ORDER.filter((actionKey) => actionKeys.includes(actionKey)),
    [actionKeys],
  );

  const sideCards = [
    showInspectionOutcome ? (
      <section key="inspection-outcome" className="inspection-task-details__preview-card inspection-task-details__side-card--outcome">
        <DetailCardHeader
          title={t('inspection.taskDetail.inspectionOutcome')}
          open={sideSectionState.inspectionOutcome}
          onToggle={() => toggleSideSection('inspectionOutcome')}
          isPreview
        />
        {sideSectionState.inspectionOutcome ? (
          <div className="inspection-task-details__preview-body">
            {renderInspectionOutcomeContent()}
          </div>
        ) : null}
      </section>
    ) : null,
    <section key="ai-risk-insight" className="inspection-task-details__preview-card inspection-task-details__side-card--risk">
      <DetailCardHeader
        title={t('inspection.taskDetail.aiRiskInsight')}
        open={sideSectionState.aiRiskInsight}
        onToggle={() => toggleSideSection('aiRiskInsight')}
        showExpandIcon={false}
        onExpand={() => openPreviewFullScreen('aiRiskInsight')}
        expandButtonAriaLabel={`${t('inspection.taskDetail.aiRiskInsight')} expand`}
      />
      {sideSectionState.aiRiskInsight ? (
        <div className="inspection-task-details__preview-body">
          {renderAiRiskInsightContent()}
        </div>
      ) : null}
    </section>,
    <section key="target-overview" className="inspection-task-details__preview-card inspection-task-details__side-card--target">
      <DetailCardHeader
        title={t('inspection.taskDetail.targetOverview')}
        open={sideSectionState.targetOverview}
        onToggle={() => toggleSideSection('targetOverview')}
        showExpandIcon
        onExpand={() => openPreviewFullScreen('targetOverview')}
        isPreview
        expandButtonAriaLabel={`${t('inspection.taskDetail.targetOverview')} expand`}
      />
      {sideSectionState.targetOverview ? (
        <div className="inspection-task-details__preview-body">
          {renderTargetOverviewContent()}
        </div>
      ) : null}
    </section>,
    <section key="task-timeline" className="inspection-task-details__preview-card inspection-task-details__side-card--timeline">
      <DetailCardHeader
        title={t('inspection.taskDetail.taskTimeline')}
        open={sideSectionState.taskTimeline}
        onToggle={() => toggleSideSection('taskTimeline')}
        isPreview
      />
      {sideSectionState.taskTimeline ? (
        <div className="inspection-task-details__preview-body">
          {renderTimelineContent()}
        </div>
      ) : null}
    </section>,
  ].filter((card): card is React.ReactElement => Boolean(card));

  return (
    <div className="inspection-task-details" dir={i18n.resolvedLanguage === 'ar' ? 'rtl' : 'ltr'}>
      {taskDetail ? (
        <>
          <div className="inspection-task-details__scroll">
            <div className="inspection-task-details__top-card">
              <div className="inspection-task-details__top-strip">
                {topSummaryItems.map((item) => (
                  <div key={item.label} className="inspection-task-details__top-item">
                    <div className="inspection-task-details__top-icon">
                      <img
                        src={item.icon}
                        alt={`${item.label} icon`}
                        className="inspection-task-details__top-icon-image"
                      />
                    </div>
                    <div className="inspection-task-details__top-copy">
                      <div className="inspection-task-details__top-label">{item.label}</div>
                      <div className={`inspection-task-details__top-value ${item.tone || ''}`}>{item.value || '-'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {expandedPreview ? (
              renderExpandedPreview()
            ) : (
              <div className="inspection-task-details__layout">
                <div className="inspection-task-details__main">
                  <section
                    className={`inspection-task-details__card inspection-task-details__card--task-info ${mainSectionState.taskInfo ? 'is-open' : ''}`}
                  >
                    <DetailCardHeader
                      title={t('inspection.taskDetail.taskInformation')}
                      open={mainSectionState.taskInfo}
                      onToggle={() => toggleMainSection('taskInfo')}
                    />
                    {mainSectionState.taskInfo ? (
                      <div className="inspection-task-details__card-content">
                        {renderDetailGrid(taskInfoItems, 'inspection-task-details__task-grid')}
                      </div>
                    ) : null}
                  </section>

                  <section
                    className={`inspection-task-details__card inspection-task-details__card--execution ${mainSectionState.execution ? 'is-open' : ''}`}
                  >
                    <DetailCardHeader
                      title={t('inspection.taskDetail.executionTimeline')}
                      open={mainSectionState.execution}
                      onToggle={() => toggleMainSection('execution')}
                    />
                    {mainSectionState.execution ? (
                      <div className="inspection-task-details__card-content">
                        {renderDetailGrid(executionItems, 'inspection-task-details__execution-grid')}
                        <div className="inspection-task-details__attachments-section">
                          <div className="inspection-task-details__detail-label">{t('inspection.tasks.fields.attachments')}</div>
                          {attachments.length ? (
                            <InspectionAttachmentGrid
                              attachments={attachments}
                              className="inspection-task-details__attachment-grid inspection-attachment-grid--two-columns"
                            />
                          ) : (
                            <div className="inspection-task-details__empty-text">-</div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </section>

                  <section
                    className={`inspection-task-details__card inspection-task-details__card--last-inspection ${mainSectionState.lastInspection ? 'is-open' : ''}`}
                  >
                    <DetailCardHeader
                      title={t('inspection.taskDetail.lastInspection')}
                      open={mainSectionState.lastInspection}
                      onToggle={() => toggleMainSection('lastInspection')}
                    />
                    {mainSectionState.lastInspection ? (
                      <div className="inspection-task-details__card-content">
                        {lastInspectionItems.length ? (
                          renderDetailGrid(lastInspectionItems, 'inspection-task-details__task-grid')
                        ) : (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('inspection.taskDetail.noLastInspection')} />
                        )}
                      </div>
                    ) : null}
                  </section>

                  {reinspectionItems.length ? (
                    <section
                      className={`inspection-task-details__card inspection-task-details__card--reinspection-task ${mainSectionState.reinspectionTask ? 'is-open' : ''}`}
                    >
                      <DetailCardHeader
                        title={t('inspection.taskDetail.reinspectionTask')}
                        open={mainSectionState.reinspectionTask}
                        onToggle={() => toggleMainSection('reinspectionTask')}
                      />
                      {mainSectionState.reinspectionTask ? (
                        <div className="inspection-task-details__card-content">
                          {renderDetailGrid(reinspectionItems, 'inspection-task-details__task-grid')}
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </div>

                <aside className="inspection-task-details__side">
                  <div className="inspection-task-details__side-column inspection-task-details__side-column--primary">
                    {sideCards.filter((_, index) => index % 2 === 0)}
                  </div>

                  <div className="inspection-task-details__side-column inspection-task-details__side-column--secondary">
                    {sideCards.filter((_, index) => index % 2 === 1)}
                  </div>
                </aside>
              </div>
            )}
          </div>

          {(teamTaskDetailContext.shouldHideDefaultActions || sortedActionKeys.length > 0) && (
            <div className="inspection-task-details__footer detail-action-footer">
              <Button className="inspection-task-details__action inspection-task-details__action--back" onClick={navigateBack}>
                {t('inspection.common.back')}
              </Button>
              <div className="inspection-task-details__footer-actions">
                {teamTaskDetailContext.shouldHideDefaultActions ? (
                  <TeamTaskDetailReassignAction
                    renderTrigger={({ onClick, text }) => (
                      <Button
                        type="primary"
                        className="inspection-task-details__action inspection-task-details__action--primary"
                        onClick={onClick}
                      >
                        {text}
                      </Button>
                    )}
                  />
                ) : (
                  sortedActionKeys.map((actionKey) => {
                    const actionGroup = getInspectionTaskActionGroup(actionKey);
                    return (
                      <Button
                        key={actionKey}
                        type={actionGroup === 'primary' ? 'primary' : 'default'}
                        className={`inspection-task-details__action inspection-task-details__action--${actionGroup}`}
                        disabled={(actionKey === 'startVisit' || actionKey === 'continueVisit') && !taskId && !taskNo}
                        loading={actionKey === 'duplicate' && duplicateLoading}
                        onClick={() => runTaskAction(actionKey)}
                      >
                        {actionLabelMap[actionKey]}
                      </Button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <Modal
            visible={Boolean(selectedTimelineItem)}
            title={t('inspection.execution.attachments')}
            onCancel={() => setSelectedTimelineItem(null)}
            footer={null}
            width={960}
            centered
            destroyOnClose
            className="inspection-task-details__timeline-attachments-modal"
          >
            {selectedTimelineAttachments.length ? (
              <InspectionAttachmentGrid
                attachments={selectedTimelineAttachments}
                className="inspection-task-details__attachment-grid inspection-task-details__timeline-attachments-grid inspection-attachment-grid--two-columns"
              />
            ) : (
              <div className="inspection-task-details__timeline-attachments-empty">
                <Empty description="-" />
              </div>
            )}
          </Modal>

          {taskModalVisible ? (
            <CreateTaskModal
              visible={taskModalVisible}
              mode={taskModalMode}
              editingTask={taskDetail}
              isInspectorSelfCreate={isInspectorSelfCreate}
              currentInspectorId={currentInspectorId}
              getAuthorityName={getAuthorityName}
              onVisibleChange={handleTaskModalVisibleChange}
              onSubmitted={fetchDetail}
            />
          ) : null}
          {assignModalVisible ? (
            <AssignTaskModal
              visible={assignModalVisible}
              onCancel={() => setAssignModalVisible(false)}
              onSubmit={submitAssign}
            />
          ) : null}
          {cancelTaskModalVisible ? (
            <CancelTaskModal
              visible={cancelTaskModalVisible}
              title={t('inspection.tasks.actions.cancelTask')}
              content={t('inspection.tasks.messages.cancelConfirm')}
              cancelText={t('inspection.common.no')}
              confirmText={t('inspection.common.yes')}
              loading={cancelTaskLoading}
              onCancel={closeCancelTaskModal}
              onConfirm={confirmCancelTask}
            />
          ) : null}
          <DuplicateTaskWarningModal
            visible={duplicateTaskWarning.visible}
            title={t('inspection.tasks.messages.duplicateWarningTitle')}
            message={duplicateTaskWarning.message}
            cancelText={t('inspection.common.no')}
            confirmText={t('inspection.common.continue')}
            confirmLoading={duplicateTaskWarning.loading}
            onCancel={closeDuplicateTaskWarning}
            onConfirm={confirmDuplicateTaskWarning}
          />
          <InspectionReportModal
            visible={reportModalVisible}
            loading={loading || reportDetailLoading}
            taskDetail={taskDetail}
            onCancel={() => setReportModalVisible(false)}
            onViolationClick={handleReportViolationClick}
          />
        </>
      ) : loading ? (
        <Card bordered={false} loading={loading} className="inspection-task-details__loading-card" />
      ) : (
        <div className="inspection-task-details__card inspection-task-details__empty-card">
          <Empty description={taskId || taskNo ? t('inspection.taskDetail.detailsUnavailable') : t('inspection.taskDetail.taskMissing')} />
        </div>
      )}
    </div>
  );
};

export default InspectionTaskDetailsPage;
