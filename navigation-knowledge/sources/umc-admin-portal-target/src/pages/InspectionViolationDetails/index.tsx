import { msUntil } from "@/utils/gstTime";
import formatMoney from '@/utils/formatMoney';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Empty, Tooltip } from 'antd';
import { useHistory, useLocation } from 'react-router-dom';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  CustomMessage,
  DEFAULT_OVERVIEW_QUICK_NAV_TARGET,
  createOverviewQuickNavTarget,
  type OverviewQuickNavTarget as SharedOverviewQuickNavTarget,
} from '@/components/common';
import {
  TeamTaskDetailReassignAction,
  useTeamTaskDetailContext,
} from '@/pages/TeamManagement/components/TeamTaskDetailReassignAction';
import { getTeamManagementScopeConfigByScope } from '@/pages/TeamManagement/taskConfig';
import { KEEP_ALIVE_RESTORE_STATE_KEY } from '@/components/KeepAlive/constants';
import { readTeamManagementReturnLocation } from '@/pages/TeamManagement/teamManagementReturnState';
import {
  createDashboardReturnLocation,
  readDashboardReturnState,
} from '@/pages/Dashboard/dashboardReturnState';
import {
  approveInspectionViolation,
  type DecideInspectionViolationAttachmentPayload,
  getInspectionChecklistTemplateItems,
  getInspectionViolationDetail,
  getInspectionViolationDetailOptionalData,
  isInspectionDataMissingError,
  updateInspectionViolationStatus,
  type DecideInspectionViolationItemPayload,
  type InspectionChecklistTemplateCatalogItem,
  type InspectionTaskAttachmentPayload,
  type InspectionViolationAppealDetails,
  type InspectionViolationCommitteeDecision,
  type InspectionViolationFineDetailItem,
  type InspectionViolationFineDetails,
  type InspectionViolationPaymentDetails,
  type InspectionViolationRelatedAppeal,
  type InspectionViolationRelatedReinspection,
  type InspectionViolationStatus,
  type InspectionViolationTimelineItem,
  type ViolationDetailData,
} from '@/services/inspection';
import {
  getUserEstablishmentByID,
  profileAndApplicant,
  type IEstablishmentOverview,
  type IProfileAndApplicantResponse,
  type IUserIndividualProfile,
} from '@/services/userProfile';
import FullScreen from '@/components/common/ApplicationOverviewCards/FullScreen/FullScreen';
import AedIcon from '@/assets/icons/Aed';
import cardHeaderCollapseIcon from '@/pages/CustomerRefundsDetails/assets/icons/card_header_collapse.svg';
import { DetailCardHeader } from '../InspectionCommon/components/DetailCardHeader';
import InspectionAttachmentGrid from '../InspectionStartVisit/components/InspectionAttachmentGrid';
import {
  getTargetOverviewStatusTone,
  TargetOverviewCard,
  type TargetOverviewData,
} from '../InspectionCommon/components/TargetOverviewCard';
import { resolveInspectionOverviewIdentity } from '../InspectionCommon/inspectionOverviewIdentity';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  buildInspectionPath,
  getInspectionQuery,
  getLocalizedText,
  normalizeInspectionCode,
  getViolationStatusLabel,
  normalizeViolationStatus,
  violationStatusLabelMap,
} from '../InspectionCommon/helpers';
import { InspectionViolationStatusTag } from '../InspectionCommon/components';
import { INSPECTION_PATHS, INSPECTION_QUERY_KEYS } from '../InspectionCommon/constants';
import { inspectionFigmaAssets } from '../InspectionCommon/assets';
import {
  normalizeInspectionViolationAction,
  normalizeInspectionViolationActions,
  type InspectionViolationAction,
} from '../InspectionCommon/access';
import { downloadInspectionViolationReport } from '../InspectionCommon/reportDownload';
import InspectionViolationApproveSuccessModal from '../InspectionCommon/components/InspectionViolationApproveSuccessModal';
import ReviewDecideModal from './components/ReviewDecideModal';
import SubmitReportModal, { type SubmitReportPayload } from './components/SubmitReportModal';
import ModifyViolationModal from './components/ModifyViolationModal';
import DeselectViolationConfirmModal from './components/DeselectViolationConfirmModal';
import CancelViolationModal, { type CancelViolationPayload } from './components/CancelViolationModal';
import {
  buildViolationTimeline,
  getTimelineEventTime,
  getTimelineRelatedInspectionTaskNo,
  isViolationCreatedTimelineEvent,
  isWarningIssuedTimelineEvent,
  normalizeTimelineCode,
  shouldRenderTimelineRelatedInspectionRow,
} from './timeline';
import { loadProgressiveDetail } from './progressiveDetail';
import './index.less';

const unwrapPayload = <T,>(response: any): T => response?.data ?? response;

type SectionKey =
  | 'violationInformation'
  | 'reportedViolations'
  | 'contentReviewReport'
  | 'fineDetails';
type SideSectionKey = 'violatorOverview' | 'relatedAppeal' | 'relatedReinspection' | 'violationTimeline';
type TimelineActorType = 'system' | 'user' | 'violator';
type PreviewSectionKey = 'violatorOverview';
type ViolatorOverviewFullScreenType = 'Individual' | 'Commercial';
type ViolatorOverviewTarget = {
  targetType?: 1 | 2;
  establishmentId?: string | number;
  individualId?: string | number;
  profileId?: string | number;
  userId?: string | number;
};

type ViolatorOverviewQuickNavTarget = SharedOverviewQuickNavTarget;

type DetailItem = {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  primary?: boolean;
};

type AttachmentItem = {
  key?: string | number;
  name: string;
  url?: string;
  type?: string;
  category?: string;
};

type ReportedViolationItem = {
  key: string;
  title: string;
  status?: string;
  statusLabel?: string;
  violationDescription?: string | null;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  attachments?: AttachmentItem[];
  reviewAttachments?: InspectionTaskAttachmentPayload[];
  notes?: string;
  violationItemId?: string | number | null;
  violationItemCode?: string | null;
  violationItemName?: string | null;
  violationTypeId?: number | string | null;
  checklistCode?: string | null;
  sourceChecklistItemId?: string | number | null;
  displayOrder?: number | null;
  degreeOptions?: FineDegreeOption[];
  fineAmount?: number | string | null;
  beforeAppealAdjustedFineAmount?: number | string | null;
  degree?: number | string | null;
  oldDegree?: number | string | null;
  newDegree?: number | string | null;
  appealResult?: number | string | null;
  appealResultCode?: string | null;
  warningCount?: string | number;
  countLabel?: string;
  warningCountLabel?: string;
  countPeriod?: string;
  decisionTypeId?: number | string | null;
  decision?: string;
  punishment?: string;
  severity?: string;
  severityNameEn?: string;
  severityNameAr?: string;
  reported?: boolean | null;
  committeeReview?: boolean | null;
};

type ReviewItemNotes = Record<string, string>;
type ReviewItemAttachments = Record<string, InspectionTaskAttachmentPayload[]>;
type ReviewItemUploading = Record<string, boolean>;
type RawViolationNoteField = 'notes' | 'committeeNote';
type ReviewReportAttachmentRecord = {
  fileName?: string | null;
  fileUrl?: string | null;
  contentType?: string | null;
  attachmentCategory?: string | null;
};
type ReviewChecklistViolationRow = {
  id?: string | number | null;
  checklistCode?: string | null;
  violationDescription?: string | null;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  notes?: string | null;
  reportAttachment?: ReviewReportAttachmentRecord[] | null;
  appealNote?: string | null;
  appealAttachment?: ReviewReportAttachmentRecord[] | null;
  violationItemId?: string | number | null;
  violationItemCode?: string | null;
  violationItemName?: string | null;
  violationTypeId?: string | number | null;
};

const REPORTED_VIOLATION_ATTACHMENT_CATEGORIES = ['ChecklistEvidence'];
const COMMITTEE_DECISION_ATTACHMENT_CATEGORIES = ['CommitteeDecision'];

type FineDegreeValue = 1 | 2 | 3 | 4;

type FineDegreeOption = {
  value: FineDegreeValue;
  label: string;
  labelKey: string;
  amount: number;
};

type ChecklistTemplateFineAmountSource = Pick<
  InspectionChecklistTemplateCatalogItem,
  'degree1FineAmount' | 'degree2FineAmount' | 'degree3FineAmount' | 'degree4FineAmount'
>;

type ContentReviewReport = {
  summary?: string;
  attachments?: AttachmentItem[];
};

type CommitteeDecisionDetails = InspectionViolationCommitteeDecision;

type PaymentDetails = InspectionViolationPaymentDetails;

type AppealDetails = InspectionViolationAppealDetails;

type FineDetails = InspectionViolationFineDetails | InspectionViolationFineDetailItem[] | null;

type FineDetailRow = {
  key: string;
  violation: string;
  count?: string | number | null;
  severity: string;
  decision: string;
  fineAmount?: number | string | null;
};

type CommitteeDecisionRow = ReportedViolationItem & {
  key: string;
  title: string;
  amount?: number | string | null;
  degree?: number | string | null;
  oldDegree?: number | string | null;
  newDegree?: number | string | null;
  cancelled: boolean;
  added: boolean;
  modified: boolean;
  deleted?: boolean;
  maintained?: boolean;
};

type CommitteeDecisionTabKey = 'appeal' | 'committee' | 'reported';
type ReportedViolationHeaderSpacing = 'compact' | 'default';
type ReportedViolationDisplayConfig = {
  hideMarker: boolean;
  headerSpacing: ReportedViolationHeaderSpacing;
};

type CommitteeDecisionMeta = {
  note: string;
  action: string;
  actionBy: string;
};

type TopSummaryItem = {
  label: string;
  value: React.ReactNode;
  icon: string;
  status?: string;
};

type ViolatorOverviewField = {
  label: string;
  value: string;
  secondary?: string;
};

type ViolatorOverviewData = {
  profileType?: string;
  statusLabel?: string;
  fields?: ViolatorOverviewField[];
};

type ViolatorOverviewProfileAndApplicantData = IProfileAndApplicantResponse;

type ViolatorOverviewEstablishmentData = IEstablishmentOverview & {
  emiratesInfo?: {
    id?: number | string | null;
    code?: string | null;
    name?: string | null;
  } | null;
};

type RelatedReinspection = InspectionViolationRelatedReinspection;

type RelatedAppeal = InspectionViolationRelatedAppeal;

type TimelineIconKey = keyof typeof inspectionFigmaAssets.timelineIcons;

type TimelineDetailVariant = 'text' | 'relatedInspection';

type TimelineRelatedInspectionTarget = RelatedReinspection & {
  taskNo: string;
};

type TimelineDetailRow = {
  key: string;
  icon: TimelineIconKey;
  label?: string;
  value: React.ReactNode;
  variant?: TimelineDetailVariant;
  clamp?: boolean;
  showIcon?: boolean;
  relatedInspection?: TimelineRelatedInspectionTarget;
};

type ViolationTimelineItem = InspectionViolationTimelineItem;

type DetailRecord = ViolationDetailData & {
  availableActions?: InspectionViolationAction[] | string[];
  contentReviewReport?: ContentReviewReport | null;
  committeeDecision?: CommitteeDecisionDetails | null;
  paymentDetails?: PaymentDetails | null;
  appealDetails?: AppealDetails | null;
  fineDetails?: FineDetails;
  violatorOverview?: ViolatorOverviewData;
  relatedAppeal?: RelatedAppeal | null;
  relatedReinspection?: RelatedReinspection | null;
  violationTimeline?: ViolationTimelineItem[];
};

const DEFAULT_VIOLATOR_OVERVIEW_QUICK_NAV: ViolatorOverviewQuickNavTarget = {
  ...DEFAULT_OVERVIEW_QUICK_NAV_TARGET,
};

const SLA_VISIBLE_STATUSES = new Set([
  'PENDING_ROUTING',
  'PENDING_CONTENT_REPORT',
  'PENDING_REVIEW',
  'PENDING_COMMITTEE_DECISION',
]);

const FINE_DETAILS_STATUSES = new Set([
  'PENDING_APPROVAL',
  'PENDING_PAYMENT',
  'UNDER_APPEAL',
  'PAID',
]);
const CONDITIONAL_FINE_DETAILS_STATUSES = new Set([
  'CANCELLED',
]);
const FINE_DETAIL_SOURCE_STATUSES = new Set([
  ...FINE_DETAILS_STATUSES,
  ...CONDITIONAL_FINE_DETAILS_STATUSES,
]);
const REPORTED_VIOLATION_MARKER_HIDDEN_STATUSES = new Set([
  'PENDING_ROUTING',
  'PENDING_CONTENT_REPORT',
  'PENDING_REVIEW',
  'PENDING_COMMITTEE_DECISION',
]);
const REPORTED_VIOLATION_COMPACT_HEADER_STATUSES = new Set([
  'PENDING_ROUTING',
  'PENDING_CONTENT_REPORT',
]);

const DETAIL_ACTION_LABEL_KEYS: Record<InspectionViolationAction, string> = {
  transfer_content: 'inspection.violation.actions.transferToContent',
  submit_report: 'inspection.violation.actions.submitReport',
  transfer_committee: 'inspection.violation.actions.transferToCommittee',
  review_decide: 'inspection.violation.actions.reviewDecide',
  approve: 'inspection.violation.actions.approve',
  modify: 'inspection.violation.actions.modify',
  cancel: 'inspection.violation.actions.cancel',
  download_report: 'inspection.violation.actions.downloadReport',
};

const DETAIL_MODE_ACTIONS = new Set<InspectionViolationAction>([
  'submit_report',
  'review_decide',
  'modify',
  'cancel',
  'download_report',
]);

const DETAIL_ACTION_REMARKS: Record<InspectionViolationAction, string> = {
  transfer_content: 'Transfer to Content Team',
  submit_report: 'Submit Report',
  transfer_committee: 'Transfer to Committee',
  review_decide: 'Review & Decide',
  approve: 'Approve',
  modify: 'Modify Violation',
  cancel: 'Cancel Violation',
  download_report: 'Download Report',
};

const COMMITTEE_DECISION_LABEL_KEYS = {
  title: 'inspection.violation.detail.committeeReviewDecision',
  appealTitle: 'inspection.violation.detail.committeeDecisionOnAppeal',
  note: 'inspection.violation.detail.note',
  action: 'inspection.violation.detail.action',
  actionBy: 'inspection.violation.detail.actionBy',
  modified: 'inspection.violation.detail.violationModified',
  confirmed: 'inspection.violation.detail.violationConfirmed',
  cancelled: 'inspection.violation.detail.cancelled',
  deleted: 'inspection.violation.detail.canceled',
  new: 'inspection.violation.detail.new',
  maintained: 'inspection.violation.detail.maintained',
};

const COMMITTEE_DECISION_DEFAULT_LABELS = {
  appealTitle: 'Committee Decision on Appeal',
  maintained: 'Maintained',
};

const DEGREE_LABELS: Record<FineDegreeValue, string> = {
  1: 'First Degree',
  2: 'Second Degree',
  3: 'Third Degree',
  4: 'Fourth Degree',
};

const DEGREE_LABEL_KEYS: Record<FineDegreeValue, string> = {
  1: 'inspection.violation.review.degree1',
  2: 'inspection.violation.review.degree2',
  3: 'inspection.violation.review.degree3',
  4: 'inspection.violation.review.degree4',
};

const LICENSING_VIOLATION_TYPE_ID = 1;
const CONTENT_VIOLATION_TYPE_ID = 2;
const DEGREE_VALUES: FineDegreeValue[] = [1, 2, 3, 4];

const KNOWN_DEGREE_LABEL_KEYS = Object.entries(DEGREE_LABELS).reduce<Record<string, string>>((result, [degree, label]) => {
  result[label.toLowerCase()] = DEGREE_LABEL_KEYS[Number(degree) as FineDegreeValue];
  result[String(degree)] = DEGREE_LABEL_KEYS[Number(degree) as FineDegreeValue];
  return result;
}, {});

const translateViolation = (key: string, options?: Record<string, unknown>) => (
  i18next.t(`inspection.violation.${key}`, options)
);

const getDisplayValue = (value?: unknown, fallback = '-') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const hasDisplayValue = (value: unknown) => (
  value !== undefined && value !== null && String(value).trim() !== ''
);

const getOwnRawValue = (
  record: Record<string, any> | undefined | null,
  keys: readonly string[],
) => {
  if (!record) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }

  return undefined;
};

const normalizeDisplayTextKey = (value?: unknown) => (
  String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
);

const getKnownViolationStatusLabel = (value?: unknown) => {
  const rawStatus = String(value ?? '').trim();
  if (!rawStatus) return '';
  const normalizedStatus = normalizeViolationStatus(rawStatus);
  return violationStatusLabelMap[normalizedStatus] ? getViolationStatusLabel(rawStatus) : '';
};

const getReportedViolationStatusLabel = (item: ReportedViolationItem) => (
  getKnownViolationStatusLabel(item.status) || item.statusLabel || getViolationStatusLabel(item.status)
);

const localizeKnownStatusText = (value?: unknown) => (
  getKnownViolationStatusLabel(value) || getDisplayValue(value)
);

const getKnownDegreeLabel = (value?: unknown) => {
  const normalized = normalizeDisplayTextKey(value);
  const key = KNOWN_DEGREE_LABEL_KEYS[normalized];
  return key ? i18next.t(key) : '';
};

const localizeFineSeverity = (value?: unknown) => (
  getKnownDegreeLabel(value) || getDisplayValue(value)
);

const getKnownViolationTypeLabel = (value?: unknown) => {
  const normalized = normalizeDisplayTextKey(value);
  if (!normalized) return '';
  if (normalized === 'content violation' || normalized === 'content') {
    return translateViolation('filters.contentViolation');
  }
  if (normalized === 'license violation' || normalized === 'licensing') {
    return translateViolation('filters.licenseViolation');
  }
  return '';
};

const normalizeViolationTypeMatch = (value?: unknown) => (
  String(value ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
);

const isLicensingViolationValue = (value?: unknown) => {
  const normalized = normalizeViolationTypeMatch(value);
  return normalized === '1' || normalized.includes('licens');
};

const isLicensingViolationDetail = (detail: DetailRecord | null, queryType?: string) => {
  const record = detail as Record<string, any> | null;
  return [
    detail?.violationType,
    detail?.categoryName,
    detail?.violationTypeCode,
    detail?.violationTypeId,
    record?.violationTypeName,
    record?.violationType?.code,
    record?.violationType?.id,
    record?.violationTypeInfo?.code,
    record?.violationTypeInfo?.id,
    queryType,
  ].some(isLicensingViolationValue);
};

const localizeProfileTypeLabel = (value?: unknown) => {
  const normalized = normalizeDisplayTextKey(value);
  if (normalized.includes('commercial')) return translateViolation('detail.commercial');
  if (normalized.includes('individual') || normalized.includes('person')) return translateViolation('detail.individual');
  return getDisplayValue(value, translateViolation('detail.commercial'));
};

const localizeProfileStatusLabel = (value?: unknown) => {
  const normalized = normalizeDisplayTextKey(value);
  if (normalized === 'approved') return translateViolation('detail.approved');
  return getKnownViolationStatusLabel(value) || getDisplayValue(value);
};

const getFineAmountLabel = (value?: number | string | null) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '-';
  return formatNumber(amount);
};

const getFineTableAmountLabel = (value?: number | string | null) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return '-';
  return formatMoney(amount);
};

const getCompactAmountLabel = (value?: number | string | null) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return '-';
  return formatMoney(amount);
};

const getOrdinalLabel = (value?: unknown) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return getDisplayValue(value);

  const rounded = Math.round(numberValue);
  const remainder = rounded % 100;
  if (remainder >= 11 && remainder <= 13) return `${rounded}th`;

  switch (rounded % 10) {
    case 1:
      return `${rounded}st`;
    case 2:
      return `${rounded}nd`;
    case 3:
      return `${rounded}rd`;
    default:
      return `${rounded}th`;
  }
};

const getSlaText = (detail?: DetailRecord | null) => {
  if (detail?.slaLabel) return detail.slaLabel;

  const rawMinutes = Number((detail?.inspectionConfig as Record<string, any> | undefined)?.slaMinutes);
  if (Number.isFinite(rawMinutes) && rawMinutes > 0) {
    if (rawMinutes % 1440 === 0) {
      return translateViolation('detail.slaDaysRemaining', { count: rawMinutes / 1440 });
    }
    if (rawMinutes % 60 === 0) {
      return translateViolation('detail.slaHoursRemaining', { count: rawMinutes / 60 });
    }
    return translateViolation('detail.slaMinutesRemaining', { count: rawMinutes });
  }

  const dueDate = (detail?.inspectionConfig as Record<string, any> | undefined)?.dueDate;
  if (!dueDate) return '-';

  // Parse the backend Dubai wall-clock value in the Dubai timezone so SLA
  // countdowns do not drift on browsers outside UTC+4.
  const remainingMs = msUntil(dueDate);
  if (remainingMs === null) return formatDate(dueDate);

  const diffDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  if (diffDays > 0) return translateViolation('detail.slaDaysRemaining', { count: diffDays });
  if (diffDays === 0) return translateViolation('detail.slaDueToday');
  return translateViolation('detail.slaDaysOverdue', { count: Math.abs(diffDays) });
};

const getViolationTypeLabel = (detail: DetailRecord | null, queryType?: string) => {
  const typeName = getDisplayValue(detail?.violationTypeName, '');
  if (typeName) return typeName;

  const rawType = detail?.violationType || detail?.categoryName || queryType;
  const rawTypeLabel = getDisplayValue(rawType, '');
  if (rawTypeLabel.includes(' ')) return rawTypeLabel;

  return getKnownViolationTypeLabel(rawType) || rawTypeLabel || '-';
};

const getKnownRawValue = (record: Record<string, any>, keys: string[]) => (
  keys
    .map((key) => record?.[key])
    .find(hasDisplayValue)
);

const getOverviewCountDisplayValue = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return '-';
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.round(count)) : '-';
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

const getOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const ensureArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const ROW_WARNING_FALLBACK_DEGREE_FIELDS = [
  'newDegree',
  'degree',
  'oldDegree',
] as const;

const getFirstPositiveNumericValue = (
  record: Record<string, any> | null | undefined,
  keys: readonly string[],
) => {
  if (!record) return undefined;
  for (const key of keys) {
    const numericValue = getOptionalNumber(record[key]);
    if (numericValue !== undefined && numericValue > 0) {
      return numericValue;
    }
  }

  return undefined;
};

const getRowFineAmount = (row?: Record<string, any> | null) => {
  if (!row) return undefined;
  return getKnownRawValue(row, ['fineAmount']);
};

const isExplicitZeroAmountValue = (value: unknown) => (
  value !== undefined &&
  value !== null &&
  String(value).trim() !== '' &&
  getOptionalNumber(value) === 0
);

const hasExplicitZeroRowFineAmount = (row?: Record<string, any> | null) => (
  isExplicitZeroAmountValue(getRowFineAmount(row))
);

const getReportedRowViolationTypeId = (row?: Record<string, any> | null) => {
  const typeId = getOptionalNumber(getKnownRawValue(row || {}, [
    'violationTypeId',
  ]));
  return typeId === undefined ? undefined : Math.round(typeId);
};

const getReportedRowIsLicensingViolation = (
  row: Record<string, any>,
  fallbackIsLicensingViolation: boolean,
) => {
  const violationTypeId = getReportedRowViolationTypeId(row);
  if (violationTypeId === LICENSING_VIOLATION_TYPE_ID) return true;
  if (violationTypeId === CONTENT_VIOLATION_TYPE_ID) return false;
  return fallbackIsLicensingViolation;
};

const getRowDegreeValue = (row?: Record<string, any> | null) => (
  row
    ? getKnownRawValue(row, [
      'newDegree',
      'degree',
      'oldDegree',
    ])
    : undefined
);

const getFineRowCountValue = (
  row?: Record<string, any> | null,
  isLicensingViolation = false,
) => {
  if (!row) return undefined;
  if (isLicensingViolation) return getKnownRawValue(row, ['oldDegree']);
  return getRowDegreeValue(row);
};

const getRowWarningLabel = (
  row: Record<string, any>,
  {
    isLicensing = false,
    preferOldDegree = false,
  }: { isLicensing?: boolean; preferOldDegree?: boolean } = {},
) => {
  const numericWarningCount = getFirstPositiveNumericValue(
    row,
    preferOldDegree || isLicensing ? ['oldDegree'] : ['newDegree', 'degree', 'oldDegree'],
  );
  if (numericWarningCount !== undefined) {
    return `${getOrdinalLabel(numericWarningCount)} Warning`;
  }

  const numericAmount = getOptionalNumber(getRowFineAmount(row));
  if (isLicensing && (numericAmount === undefined || numericAmount <= 0)) {
    const fallbackWarningCount = getFirstPositiveNumericValue(row, ROW_WARNING_FALLBACK_DEGREE_FIELDS);
    if (fallbackWarningCount !== undefined) {
      return `${getOrdinalLabel(fallbackWarningCount)} Warning`;
    }
  }

  return '';
};

const getReportedViolationDisplayConfig = (
  status: string,
  isLicensing: boolean,
): ReportedViolationDisplayConfig => {
  if (!isLicensing && REPORTED_VIOLATION_MARKER_HIDDEN_STATUSES.has(status)) {
    return {
      hideMarker: true,
      headerSpacing: REPORTED_VIOLATION_COMPACT_HEADER_STATUSES.has(status) ? 'compact' : 'default',
    };
  }

  return {
    hideMarker: false,
    headerSpacing: 'default',
  };
};

const getDetailFooterActions = (
  detail: DetailRecord | null,
): InspectionViolationAction[] => {
  return normalizeInspectionViolationActions(detail?.availableActions);
};

const getDetailViolationId = (detail: DetailRecord | null, query: ReturnType<typeof getInspectionQuery>) => (
  getDisplayValue(detail?.id || query.violationId, '')
);

const getDetailViolationTypeId = (detail: DetailRecord | null) => (
  getDisplayValue(detail?.violationTypeId, '')
);

const getReviewStandardsCacheKey = (
  detail: DetailRecord | null,
  query: ReturnType<typeof getInspectionQuery>,
) => {
  const violationId = getDetailViolationId(detail, query);
  if (!violationId) return '';
  return `${violationId}:${getDetailViolationTypeId(detail)}`;
};

const normalizeViolationMatchValue = (value?: unknown) => {
  const text = String(value ?? '').trim();
  return text ? text.toLowerCase() : '';
};

const getChecklistCodeKey = (checklistCode?: unknown) => normalizeViolationMatchValue(checklistCode);

const getViolationDescriptionTitle = (record: Record<string, any> | null | undefined, fallback = '') => {
  const source = record || {};
  const descriptionEn = source.violationDescriptionEn as string | undefined;
  const descriptionAr = source.violationDescriptionAr as string | undefined;
  const description = getKnownRawValue(source, ['violationDescription']) as string | undefined;
  const localizedTitle = getLocalizedText(
    description || descriptionEn,
    descriptionAr,
    '',
  );
  if (localizedTitle && localizedTitle !== '-') return localizedTitle;

  return getDisplayValue(
    description,
    fallback,
  );
};

const getReportedViolationTitle = (
  item: ReportedViolationItem | Record<string, any> | null | undefined,
  fallback = '-',
) => getViolationDescriptionTitle(item as Record<string, any> | null | undefined, fallback);

const getViolationMatchValues = (record: Record<string, any>) => (
  Array.from(new Set([
    record.violationItemId,
    record.sourceChecklistItemId,
    record.taskChecklistItemId,
    record.id,
    record.violationItemCode,
    record.checklistCode,
  ].map(normalizeViolationMatchValue).filter(Boolean)))
);

const hasViolationItemMatch = (
  source: Record<string, any>,
  target: Record<string, any>,
) => {
  const sourceKeys = getViolationMatchValues(source);
  const targetKeys = new Set(getViolationMatchValues(target));
  if (sourceKeys.some((key) => targetKeys.has(key))) return true;

  const sourceTitle = normalizeViolationMatchValue(getViolationDescriptionTitle(source, ''));
  const targetTitle = normalizeViolationMatchValue(getViolationDescriptionTitle(target, ''));
  return Boolean(sourceTitle && targetTitle && sourceTitle === targetTitle);
};

const buildFineDegreeOptions = (
  standard?: ChecklistTemplateFineAmountSource,
): FineDegreeOption[] => {
  if (!standard) return [];

  return DEGREE_VALUES.reduce<FineDegreeOption[]>((options, value) => {
    const rawAmount = standard[
      `degree${value}FineAmount` as keyof ChecklistTemplateFineAmountSource
    ];
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount < 0) return options;

    options.push({
      value,
      label: DEGREE_LABELS[value],
      labelKey: DEGREE_LABEL_KEYS[value],
      amount,
    });
    return options;
  }, []);
};

const getDegreeOption = (
  item: ReportedViolationItem,
  value?: FineDegreeValue,
) => item.degreeOptions?.find((option) => option.value === value);

const getChecklistTemplateItemKey = (
  item: InspectionChecklistTemplateCatalogItem,
) => getChecklistCodeKey(item.checklistCode);

const isPaidViolation = (
  status: string,
  paymentDetails?: PaymentDetails | null,
) => {
  const paymentStatus = String(paymentDetails?.paymentStatus || '').toLowerCase();
  return (
    status === 'PAID' ||
    Boolean(paymentDetails?.paidOn) ||
    paymentStatus === 'paid' ||
    paymentStatus.includes('paid')
  );
};

const getAttachmentFileType = (file: InspectionTaskAttachmentPayload) => {
  const rawType = file.contentType || file.fileName?.split('.').pop();
  return getDisplayValue(rawType, 'PDF').toUpperCase();
};

const getFineDetailsRows = (fineDetails?: FineDetails): InspectionViolationFineDetailItem[] => {
  if (Array.isArray(fineDetails)) return fineDetails;
  return ensureArray<InspectionViolationFineDetailItem>(fineDetails?.rows);
};

const hasExplicitZeroFineAmount = (detail: DetailRecord | null) => (
  getOptionalNumber(detail?.fineAmount) === 0
);

const getFineRowsTotalAmount = (fineDetailRows: FineDetailRow[]) => {
  let total = 0;
  let hasAmount = false;

  fineDetailRows.forEach((row) => {
    const amount = Number(row.fineAmount);
    if (!Number.isFinite(amount) || amount < 0) return;
    hasAmount = true;
    total += amount;
  });

  return hasAmount ? total : undefined;
};

const getFineDetailsTotalAmount = (
  detail: DetailRecord | null,
) => {
  if (hasExplicitZeroFineAmount(detail)) return 0;

  const fineDetails = detail?.fineDetails;
  const fineDetailsRecord = !Array.isArray(fineDetails) && fineDetails
    ? fineDetails as Record<string, any>
    : {};

  const fineAmountRecord = {
    ...fineDetailsRecord,
    detailFineAmount: detail?.fineAmount,
    paymentAmount: detail?.paymentDetails?.amount,
    committeeFineAmount: detail?.committeeDecision?.fineAmount,
  };

  return getKnownRawValue(fineAmountRecord, [
    'detailFineAmount',
    'totalFineAmount',
    'revisedFineAmount',
    'originalFineAmount',
    'paymentAmount',
    'committeeFineAmount',
  ]);
};

type AppealDecisionResult = 'maintained' | 'cancelled' | 'adjustments';

const getAppealDecisionResultFromValue = (value: unknown): AppealDecisionResult | undefined => {
  const numericResult = getOptionalNumber(value);
  if (numericResult === 1) return 'maintained';
  if (numericResult === 2) return 'cancelled';
  if (numericResult === 3) return 'adjustments';

  const normalized = normalizeDisplayTextKey(value).replace(/[_-]+/g, ' ');
  if (normalized.includes('maintain')) return 'maintained';
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('adjust')) return 'adjustments';
  return undefined;
};

const getAppealDecisionResult = (row: Record<string, any>): AppealDecisionResult | undefined => {
  for (const field of ['appealResult', 'appealResultCode']) {
    const result = getAppealDecisionResultFromValue(row[field]);
    if (result) return result;
  }
  return undefined;
};

const shouldShowFineDetailRow = (
  row: Record<string, any>,
  isLicensingViolation = false,
) => {
  if (hasExplicitZeroRowFineAmount(row)) return false;
  if (getAppealDecisionResult(row) === 'cancelled') return false;
  if (isLicensingViolation) return true;
  if (!Object.prototype.hasOwnProperty.call(row, 'committeeReview')) return true;
  return row.committeeReview === true;
};

const getFineRowSeverity = (row: Record<string, any>) => {
  const degree = getRowDegreeValue(row);
  if (degree !== undefined) return getDisplayValue(degree);

  const explicitCount = getKnownRawValue(row, [
    'countLabel',
    'warningCountLabel',
  ]);
  if (explicitCount !== undefined) return getDisplayValue(explicitCount);

  return getLocalizedText(row.severityNameEn || row.severity, row.severityNameAr);
};

const getFineDetailSourceRows = (
  detail: DetailRecord | null,
  reportedViolations: ReportedViolationItem[],
  isLicensingViolation = false,
) => {
  const fineDetailRows = getFineDetailsRows(detail?.fineDetails);
  if (fineDetailRows.length) return fineDetailRows;

  if (isLicensingViolation) return reportedViolations;

  const status = normalizeViolationStatus(detail?.status);
  if (FINE_DETAIL_SOURCE_STATUSES.has(status)) {
    const currentSourceRows = getCommitteeSourceRows(detail) as InspectionViolationFineDetailItem[];
    if (currentSourceRows.length) return currentSourceRows;
  }

  return reportedViolations;
};

const buildFineDetailRows = ({
  detail,
  reportedViolations,
  committeeDecision,
  paymentDetails,
  appealDetails,
  isLicensingViolation,
}: {
  detail: DetailRecord | null;
  reportedViolations: ReportedViolationItem[];
  committeeDecision?: CommitteeDecisionDetails | null;
  paymentDetails?: PaymentDetails | null;
  appealDetails?: AppealDetails | null;
  isLicensingViolation?: boolean;
}): FineDetailRow[] => {
  const sourceRows = getFineDetailSourceRows(detail, reportedViolations, Boolean(isLicensingViolation));

  if (sourceRows.length) {
    const visibleRows = sourceRows.filter((item) => shouldShowFineDetailRow(
      item as Record<string, any>,
      Boolean(isLicensingViolation),
    ));

    return visibleRows.map((item, index) => {
      const row = item as Record<string, any>;
      const rowAmount = getRowFineAmount(row);
      const canUseTotalAmount = sourceRows.length === 1 && rowAmount === undefined;

      return {
        key: getDisplayValue(row.key, `fine-${index}`),
        violation: getViolationDescriptionTitle(row, ''),
        count: getFineRowCountValue(row, Boolean(isLicensingViolation)),
        severity: getFineRowSeverity(row),
        decision: localizeKnownStatusText(
          row.decision ||
            row.punishment ||
            row.statusLabel ||
            committeeDecision?.outcome ||
            committeeDecision?.decision ||
            paymentDetails?.paymentStatus ||
            appealDetails?.appealStatus,
        ),
        fineAmount: rowAmount !== undefined
          ? rowAmount
          : canUseTotalAmount
            ? getFineDetailsTotalAmount(detail)
            : undefined,
      };
    });
  }

  return [
    {
      key: 'fine-summary',
      violation: getViolationDescriptionTitle(detail as Record<string, any> | null, ''),
      count: getFineRowCountValue(detail as Record<string, any> | null, Boolean(isLicensingViolation)),
      severity: localizeFineSeverity(getLocalizedText(detail?.severityNameEn || detail?.severity || detail?.level, (detail as any)?.severityNameAr, '')),
      decision: localizeKnownStatusText(
        committeeDecision?.outcome ||
          committeeDecision?.decision ||
          paymentDetails?.paymentStatus ||
          appealDetails?.appealStatus,
      ),
      fineAmount: getFineDetailsTotalAmount(detail),
    },
  ];
};

const isInspectionTargetIndividual = (target?: Record<string, any> | null) => {
  const targetTypeName = String(
    target?.targetTypeNameEn ||
      target?.targetTypeName ||
      target?.targetTypeCode ||
      target?.targetType ||
      '',
  ).toLowerCase();

  return (
    Number(target?.targetType) === 2 ||
    targetTypeName.includes('individual') ||
    targetTypeName.includes('person')
  );
};

const isProfileAndApplicantIndividual = (profile?: ViolatorOverviewProfileAndApplicantData | null) => {
  const userTypeId = Number(profile?.userTypeId);
  return userTypeId === 1;
};

const isProfileAndApplicantCommercial = (profile?: ViolatorOverviewProfileAndApplicantData | null) => {
  const userTypeId = Number(profile?.userTypeId);
  return Number.isFinite(userTypeId) && userTypeId > 1;
};

const getViolatorOverviewProfileTypeLabel = (targetType: unknown) => {
  const numericTargetType = Number(targetType);
  if (numericTargetType === 1) return 'Commercial';
  if (numericTargetType === 2) return 'Individual';
  return '-';
};

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

const resolveViolatorOverviewTargetType = (
  detail?: DetailRecord | null,
): 1 | 2 | undefined => {
  const record = detail as Record<string, any> | null;
  const target =
    record?.inspectionTarget && typeof record.inspectionTarget === 'object'
      ? record.inspectionTarget as Record<string, any>
      : {};
  const targetTypeCandidates = [
    target.targetType,
    target.targetTypeId,
    record?.targetType,
    record?.targetTypeId,
  ];
  const userTypeCandidates = [
    target.userTypeId,
    record?.userTypeId,
  ];
  const textCandidates = [
    target.targetTypeCode,
    target.targetTypeName,
    target.targetTypeNameEn,
    target.userTypeName,
    target.userTypeNameEn,
    record?.targetTypeCode,
    record?.violatorType,
    record?.violatorTypeName,
  ];

  for (const value of targetTypeCandidates) {
    const numericValue = Number(value);
    if (numericValue === 1 || numericValue === 2) return numericValue;
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

const getViolatorOverviewTarget = (
  detail?: DetailRecord | null,
): ViolatorOverviewTarget | null => {
  const record = detail as Record<string, any> | null;
  const target =
    record?.inspectionTarget && typeof record.inspectionTarget === 'object'
      ? record.inspectionTarget as Record<string, any>
      : {};
  const targetType = resolveViolatorOverviewTargetType(detail);
  const establishmentId = normalizePositiveNumericId(
    target.establishmentId ?? record?.establishmentId,
  );
  const individualId = normalizePositiveNumericId(
    target.individualId ?? record?.individualId,
  );
  const profileId = normalizePositiveNumericId(
    target.userProfileId ?? target.profileId ?? record?.userProfileId ?? record?.profileId,
  );
  const userId = normalizeOptionalId(target.userId ?? record?.userId);

  if (targetType === 2) {
    if (!individualId && !profileId && !userId) return null;

    return {
      targetType: 2,
      individualId,
      profileId,
      userId,
    };
  }

  if (targetType === 1 && establishmentId) {
    return {
      targetType: 1,
      establishmentId,
      profileId,
      userId,
    };
  }

  if (individualId && !establishmentId) {
    return {
      targetType: 2,
      individualId,
      profileId,
      userId,
    };
  }

  if (establishmentId) {
    return {
      targetType: 1,
      establishmentId,
      profileId,
      userId,
    };
  }

  if (profileId) {
    return {
      targetType,
      profileId,
      userId,
    };
  }

  return null;
};

const getViolatorOverviewRecordKey = (target?: Record<string, any> | null) => {
  const targetType = normalizeOptionalId(target?.targetType);
  const targetId = Number(targetType) === 1
    ? normalizeOptionalId(target?.establishmentId)
    : Number(targetType) === 2
      ? normalizeOptionalId(target?.individualId) || normalizeOptionalId(target?.profileId)
      : undefined;

  return [targetType, targetId, normalizeOptionalId(target?.profileId)].filter(Boolean).join(':');
};

const getDetailStatus = (detail: DetailRecord | null, queryStatus?: string) => (
  normalizeViolationStatus(detail?.status || queryStatus) as InspectionViolationStatus
);

const hasContentReviewReportData = (report?: ContentReviewReport | null) => {
  if (!report) return false;

  const attachments = Array.isArray(report.attachments) ? report.attachments : [];
  return hasDisplayValue(report.summary) ||
    attachments.some((attachment) => hasDisplayValue(attachment?.url) || hasDisplayValue(attachment?.name));
};

const shouldShowContentReviewReport = (detail: DetailRecord | null) => {
  return hasContentReviewReportData(detail?.contentReviewReport);
};

const hasFineDetailAmount = (
  detail: DetailRecord | null,
  fineDetailRows: FineDetailRow[],
  isLicensingViolation = false,
) => {
  if (!isLicensingViolation && hasExplicitZeroFineAmount(detail)) return false;

  const rowsTotalAmount = getFineRowsTotalAmount(fineDetailRows);
  if (rowsTotalAmount !== undefined && rowsTotalAmount > 0) return true;
  if (isLicensingViolation) return false;

  const totalAmount = Number(getFineDetailsTotalAmount(detail));
  if (Number.isFinite(totalAmount) && totalAmount > 0) return true;

  return fineDetailRows.some((row) => {
    const rowAmount = Number(row.fineAmount);
    return Number.isFinite(rowAmount) && rowAmount > 0;
  });
};

const shouldShowFineDetails = (
  detail: DetailRecord | null,
  queryStatus: string | undefined,
  fineDetailRows: FineDetailRow[],
  isLicensingViolation = false,
) => {
  if (!fineDetailRows.length) return false;
  if (!isLicensingViolation && hasExplicitZeroFineAmount(detail)) return false;

  const status = getDetailStatus(detail, queryStatus);
  if (fineDetailRows.length && hasFineDetailAmount(detail, fineDetailRows, isLicensingViolation)) return true;
  if (FINE_DETAILS_STATUSES.has(status)) return true;
  if (CONDITIONAL_FINE_DETAILS_STATUSES.has(status)) {
    return hasFineDetailAmount(detail, fineDetailRows, isLicensingViolation);
  }
  return false;
};

const getRawViolationAttachmentCategory = (attachment: Record<string, any>) => (
  getDisplayValue(attachment.attachmentCategory, '')
);

const getRawViolationAttachments = (
  record: Record<string, any>,
  categories?: string[],
) => {
  const attachments = ensureArray<Record<string, any>>(record.attachments);
  if (!categories?.length) return attachments;

  const categorySet = new Set(categories);
  return attachments.filter((attachment) => (
    categorySet.has(getRawViolationAttachmentCategory(attachment))
  ));
};

const getRawViolationNotes = (
  record: Record<string, any>,
  noteField: RawViolationNoteField = 'notes',
) => {
  const notes = getDisplayValue(record[noteField], '');
  if (notes) return notes;
  return '';
};

const normalizeReviewReportAttachment = (
  attachment: ReviewReportAttachmentRecord,
): InspectionTaskAttachmentPayload | null => {
  const fileName = getDisplayValue(attachment.fileName, '');
  const fileUrl = getDisplayValue(attachment.fileUrl, '');
  if (!fileName || !fileUrl) return null;

  return {
    fileName,
    fileUrl,
    contentType: getDisplayValue(attachment.contentType, '') || undefined,
    attachmentCategory: getDisplayValue(attachment.attachmentCategory, '') || undefined,
  };
};

const getReviewReportAttachments = (
  record: ReviewChecklistViolationRow,
): InspectionTaskAttachmentPayload[] => (
  ensureArray<ReviewReportAttachmentRecord>(record.reportAttachment)
    .map((item) => normalizeReviewReportAttachment(item))
    .filter(Boolean) as InspectionTaskAttachmentPayload[]
);

const getAppealDecisionAttachments = (
  record: ReviewChecklistViolationRow,
): AttachmentItem[] => (
  ensureArray<ReviewReportAttachmentRecord>(record.appealAttachment)
    .map((item) => {
      const fileName = getDisplayValue(item.fileName, '');
      const fileUrl = getDisplayValue(item.fileUrl, '');
      if (!fileName || !fileUrl) return null;

      return {
        name: fileName,
        url: fileUrl,
        type: getDisplayValue(item.contentType, '') || undefined,
        category: getDisplayValue(item.attachmentCategory, '') || undefined,
      };
    })
    .filter(Boolean) as AttachmentItem[]
);

const mapRawViolationItem = (
  value: unknown,
  index: number,
  defaultStatus?: string,
  options: {
    noteField?: RawViolationNoteField;
    attachmentCategories?: string[];
  } = {},
): ReportedViolationItem => {
  const record = value && typeof value === 'object'
    ? value as Record<string, any>
    : { title: value };
  const title = getViolationDescriptionTitle(record, '');
  const key = getDisplayValue(
    getKnownRawValue(record, [
      'sourceChecklistItemId',
      'taskChecklistItemId',
      'violationItemId',
      'id',
      'violationItemCode',
      'checklistCode',
    ]),
    `violation-${index}`,
  );
  const attachments = getRawViolationAttachments(record, options.attachmentCategories).map((item, attachmentIndex) => ({
    key: item.id || item.fileUrl || attachmentIndex,
    name: getDisplayValue(
      item.fileName,
      translateViolation('detail.violationProofFile', { number: attachmentIndex + 1 }),
    ),
    url: item.fileUrl as string | undefined,
    type: item.contentType as string | undefined,
    category: getRawViolationAttachmentCategory(item),
  }));
  const statusLabel = getLocalizedText(
    getKnownRawValue(record, [
      'statusName',
      'businessStatusNameEn',
      'businessStatusName',
      'internalStatusName',
    ]) as string | undefined,
    undefined,
    '',
  ) || record.statusLabel;
  const inheritedStatusLabel = getKnownViolationStatusLabel(defaultStatus) || getDisplayValue(defaultStatus, '');

  return {
    key,
    title,
    status: getDisplayValue(
      getKnownRawValue(record, [
        'statusCode',
        'businessStatusCode',
        'internalStatusCode',
      ]) || defaultStatus,
      '',
    ),
    statusLabel: getDisplayValue(statusLabel || inheritedStatusLabel),
    violationDescription: (getKnownRawValue(record, ['violationDescription']) as string | null | undefined) || title || undefined,
    violationDescriptionEn: getKnownRawValue(record, ['violationDescriptionEn']) as string | null | undefined,
    violationDescriptionAr: getKnownRawValue(record, ['violationDescriptionAr']) as string | null | undefined,
    attachments,
    notes: getRawViolationNotes(record, options.noteField),
    violationItemId: getKnownRawValue(record, ['violationItemId']),
    violationItemCode: getDisplayValue(getKnownRawValue(record, ['violationItemCode']), ''),
    violationItemName: title || undefined,
    violationTypeId: getKnownRawValue(record, ['violationTypeId']),
    checklistCode: getDisplayValue(getKnownRawValue(record, ['checklistCode']), ''),
    sourceChecklistItemId: getKnownRawValue(record, [
      'sourceChecklistItemId',
      'taskChecklistItemId',
      'id',
    ]),
    displayOrder: getOptionalNumber(record.displayOrder),
    fineAmount: getKnownRawValue(record, ['fineAmount']),
    beforeAppealAdjustedFineAmount: getKnownRawValue(record, ['beforeAppealAdjustedFineAmount']),
    degree: getKnownRawValue(record, ['degree']),
    oldDegree: getKnownRawValue(record, ['oldDegree']),
    newDegree: getKnownRawValue(record, ['newDegree']),
    appealResult: getKnownRawValue(record, ['appealResult']),
    appealResultCode: getKnownRawValue(record, ['appealResultCode']) as string | null | undefined,
    decision: getKnownRawValue(record, ['appealResultCode', 'appealResult']) as string | undefined,
    reported: getOwnRawValue(record, ['reported']) as ReportedViolationItem['reported'],
    committeeReview: getOwnRawValue(record, ['committeeReview']) as ReportedViolationItem['committeeReview'],
  };
};

const dedupeViolationItems = (items: ReportedViolationItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const uniqueKey = getViolationMatchValues(item as Record<string, any>)[0] ||
      normalizeViolationMatchValue(item.title) ||
      item.key;
    if (seen.has(uniqueKey)) return false;
    seen.add(uniqueKey);
    return true;
  });
};

const buildDetailReportedViolations = (
  detail: DetailRecord | null,
  isLicensingViolation = false,
): ReportedViolationItem[] => {
  if (!detail) return [];
  const record = detail as Record<string, any>;
  const reportedItems = ensureArray<Record<string, any>>(record.reportedItems);
  const checklistReportedItems = ensureArray<Record<string, any>>(record.checklistViolations)
    .filter((item) => item.reported === true);
  const sourceItems = isLicensingViolation && reportedItems.length
    ? reportedItems
    : checklistReportedItems;

  return dedupeViolationItems(sourceItems.map((item, index) => (
    mapRawViolationItem(item, index, detail.status, {
      attachmentCategories: REPORTED_VIOLATION_ATTACHMENT_CATEGORIES,
    })
  )));
};

const buildReviewViolationItems = (
  checklistItems: InspectionChecklistTemplateCatalogItem[],
): ReportedViolationItem[] => {
  const visibleItems = ensureArray<InspectionChecklistTemplateCatalogItem>(checklistItems)
    .filter((item) => item.isActive !== false && item.isVisibleInChecklist !== false)
    .reduce<ReportedViolationItem[]>((items, item) => {
      const key = getChecklistTemplateItemKey(item);
      const violationItemCode = getDisplayValue(item.violationItemCode, '');
      const violationDescription = getViolationDescriptionTitle(item as Record<string, any>, '');
      const degreeOptions = buildFineDegreeOptions(item);

      if (!key || !violationItemCode || !violationDescription || degreeOptions.length !== DEGREE_VALUES.length) {
        return items;
      }

      items.push({
        key,
        title: violationDescription,
        violationDescription,
        violationDescriptionEn: item.violationDescriptionEn,
        violationDescriptionAr: item.violationDescriptionAr,
        violationItemId: item.violationItemId,
        violationItemCode,
        violationItemName: violationDescription,
        checklistCode: getDisplayValue(item.checklistCode, ''),
        sourceChecklistItemId: item.id,
        displayOrder: item.displayOrder ?? null,
        degreeOptions,
      });
      return items;
    }, []);

  return dedupeReviewViolationItems(visibleItems).sort((left, right) => {
    const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
};

const dedupeReviewViolationItems = (items: ReportedViolationItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getChecklistCodeKey(item.checklistCode);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getReviewStandardByChecklistCode = (
  reviewItems: ReportedViolationItem[],
) => new Map(reviewItems.map((item) => [getChecklistCodeKey(item.checklistCode), item]));

const getReviewDetailViolationTitle = (row: ReviewChecklistViolationRow) => {
  const localizedTitle = getLocalizedText(
    row.violationDescription || row.violationDescriptionEn || undefined,
    row.violationDescriptionAr || undefined,
    '',
  );
  if (localizedTitle && localizedTitle !== '-') return localizedTitle;
  return getDisplayValue(row.violationDescription, '');
};

const buildReviewDetailViolationItems = (
  detail: DetailRecord | null,
  reviewItems: ReportedViolationItem[],
): ReportedViolationItem[] => {
  if (!detail || !reviewItems.length) return [];

  const record = detail as Record<string, any>;
  const reviewStandardMap = getReviewStandardByChecklistCode(reviewItems);
  const seenKeys = new Set<string>();

  return ensureArray<ReviewChecklistViolationRow>(record.checklistViolations).reduce<ReportedViolationItem[]>((items, row) => {
    const checklistCode = getDisplayValue(row.checklistCode, '');
    const key = getChecklistCodeKey(checklistCode);
    if (!key || seenKeys.has(key)) return items;

    const standard = reviewStandardMap.get(key);
    if (!standard || (standard.degreeOptions || []).length !== DEGREE_VALUES.length) return items;

    const title = getReviewDetailViolationTitle(row);
    if (!title) return items;
    const reviewAttachments = getReviewReportAttachments(row);

    seenKeys.add(key);
    items.push({
      ...standard,
      key,
      title,
      violationDescription: row.violationDescription,
      violationDescriptionEn: row.violationDescriptionEn,
      violationDescriptionAr: row.violationDescriptionAr,
      violationItemId: row.violationItemId,
      violationItemCode: getDisplayValue(row.violationItemCode, ''),
      violationItemName: getDisplayValue(row.violationItemName, ''),
      violationTypeId: row.violationTypeId,
      checklistCode,
      sourceChecklistItemId: row.id,
      displayOrder: standard.displayOrder,
      degreeOptions: standard.degreeOptions,
      notes: getDisplayValue(row.notes, ''),
      reviewAttachments,
    });
    return items;
  }, []);
};

const getSelectedReviewViolationRows = (
  reviewItems: ReportedViolationItem[],
  reviewDetailItems: ReportedViolationItem[],
  selectedKeys: string[],
) => {
  const itemMap = new Map(reviewItems.map((item) => [item.key, item]));
  const detailItemMap = new Map(reviewDetailItems.map((item) => [item.key, item]));
  return selectedKeys.reduce<ReportedViolationItem[]>((rows, key) => {
    const item = detailItemMap.get(key) || itemMap.get(key);
    if (item) rows.push(item);
    return rows;
  }, []);
};

const getInitialSelectedViolationKeys = (
  reviewDetailItems: ReportedViolationItem[],
) => reviewDetailItems.map((item) => item.key);

const buildReviewInitialItemNotes = (
  reviewDetailItems: ReportedViolationItem[],
) => reviewDetailItems.reduce<ReviewItemNotes>((notes, item) => {
  notes[item.key] = item.notes || '';
  return notes;
}, {});

const buildReviewInitialItemAttachments = (
  reviewDetailItems: ReportedViolationItem[],
) => reviewDetailItems.reduce<ReviewItemAttachments>((attachments, item) => {
  if (item.reviewAttachments?.length) {
    attachments[item.key] = item.reviewAttachments;
  }
  return attachments;
}, {});

const pickReviewRecordByKeys = <T,>(
  record: Record<string, T>,
  keys: string[],
) => keys.reduce<Record<string, T>>((next, key) => {
  if (record[key] !== undefined) {
    next[key] = record[key];
  }
  return next;
}, {});

const buildDecisionAttachmentPayload = (
  attachments: InspectionTaskAttachmentPayload[] = [],
): DecideInspectionViolationAttachmentPayload[] => attachments
  .map((attachment) => ({
    fileName: String(attachment.fileName || '').trim(),
    fileUrl: String(attachment.fileUrl || '').trim(),
    contentType: attachment.contentType,
  }))
  .filter((attachment) => attachment.fileName && attachment.fileUrl);

const buildDecisionItemPayload = (
  item: ReportedViolationItem,
  degree: FineDegreeValue,
  committeeNote: string,
  attachments: InspectionTaskAttachmentPayload[],
): DecideInspectionViolationItemPayload | null => {
  const option = getDegreeOption(item, degree);
  if (!option) return null;
  const violationItemId = item.violationItemId;
  const violationItemCode = getDisplayValue(item.violationItemCode, '');
  const violationItemName = getDisplayValue(item.violationItemName, '');
  const trimmedCommitteeNote = committeeNote.trim();
  const sanitizedAttachments = buildDecisionAttachmentPayload(attachments);

  if (
    violationItemId === undefined ||
    violationItemId === null ||
    !String(violationItemId).trim() ||
    !violationItemCode ||
    !violationItemName ||
    !trimmedCommitteeNote ||
    !sanitizedAttachments.length
  ) {
    return null;
  }

  return {
    violationItemId,
    violationItemCode,
    violationItemName,
    decisionTypeId: 2,
    degree: option.value,
    fineAmount: option.amount,
    committeeNote: trimmedCommitteeNote,
    attachments: sanitizedAttachments,
  };
};

const getTimelineTitle = (item: ViolationTimelineItem) => {
  const rawTitle = getDisplayValue(
    item.displayTitle ||
      item.label ||
      item.eventType,
    translateViolation('timeline.violationUpdated'),
  );

  return localizeKnownStatusText(rawTitle);
};

const getTimelineActorLabel = (item: ViolationTimelineItem) => {
  const rawActor = getDisplayValue(
    item.displayActor ||
      item.actor ||
      item.operatorName ||
      item.handlerUserName,
    '',
  );
  const actorCode = normalizeTimelineCode(rawActor);

  if (actorCode === 'AUTOMATED') return translateViolation('timeline.automated');
  if (actorCode === 'CUSTOMER') return translateViolation('timeline.customer');
  if (actorCode === 'SYSTEM') return translateViolation('timeline.system');

  return rawActor;
};

const getTimelineActorType = (item: ViolationTimelineItem): TimelineActorType => {
  if (item.actorType) return item.actorType;

  const actorCode = normalizeTimelineCode(
    getTimelineActorLabel(item) ||
      item.handlerUserName,
  );
  if (
    actorCode.includes('SYSTEM') ||
    actorCode.includes('AUTOMATED') ||
    actorCode.includes('AI_GENERATED')
  ) {
    return 'system';
  }
  if (actorCode.includes('CUSTOMER') || actorCode.includes('VIOLATOR')) {
    return 'violator';
  }

  const eventCode = normalizeTimelineCode(item.eventType || item.label || item.displayTitle);
  if (
    eventCode.includes('CREATED') ||
    eventCode.includes('WARNING') ||
    eventCode.includes('FINE_GENERATED') ||
    eventCode.includes('PAYMENT')
  ) {
    return 'system';
  }

  return 'user';
};

const getTimelineDisplayDetails = (item: ViolationTimelineItem) => (
  getDisplayValue(item.displayDetails, '')
);

const shouldShowTimelineActor = (item: ViolationTimelineItem) => {
  if (!getTimelineActorLabel(item)) return false;

  const eventCode = normalizeTimelineCode(
    item.eventType ||
      item.label ||
      item.displayTitle,
  );
  const titleCode = normalizeTimelineCode(getTimelineTitle(item));
  const statusCode = normalizeTimelineCode(
    item.displayStatusCode ||
      item.displayStatusName ||
      item.internalStatusCode ||
      item.internalStatusName,
  );
  const combinedCode = `${eventCode}_${titleCode}_${statusCode}`;

  return !(
    combinedCode.includes('FINE_PAID') ||
    combinedCode.includes('VIOLATION_CANCELLED') ||
    combinedCode.includes('APPEAL_SUBMITTED') ||
    combinedCode.includes('UNDER_APPEAL')
  );
};

const normalizeTimelineText = (value?: unknown) => (
  String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
);

const isDuplicateTimelineText = (
  rows: TimelineDetailRow[],
  value?: unknown,
) => {
  const normalizedValue = normalizeTimelineText(value);
  if (!normalizedValue) return true;

  return rows.some((row) => {
    const rowValue = normalizeTimelineText(row.value);
    return rowValue === normalizedValue || rowValue.includes(normalizedValue) || normalizedValue.includes(rowValue);
  });
};

const getTimelineMainDetails = (item: ViolationTimelineItem) => {
  return getTimelineDisplayDetails(item);
};

const normalizeTimelineTaskNo = (value?: unknown) => (
  String(value || '').trim().toLowerCase()
);

const getTimelineRelatedInspectionTarget = (
  taskNo: string,
  relatedReinspection?: RelatedReinspection | null,
): TimelineRelatedInspectionTarget => {
  const matchedTaskNo = normalizeTimelineTaskNo(relatedReinspection?.taskNo);
  const currentTaskNo = normalizeTimelineTaskNo(taskNo);

  if (matchedTaskNo && matchedTaskNo === currentTaskNo) {
    return {
      taskNo,
      taskId: relatedReinspection?.taskId,
    };
  }

  return { taskNo };
};

const buildTimelineDetailRows = (
  item: ViolationTimelineItem,
  relatedReinspection?: RelatedReinspection | null,
): TimelineDetailRow[] => {
  const rows: TimelineDetailRow[] = [];
  const addTextRow = (
    key: string,
    icon: TimelineIconKey,
    label: string,
    value?: unknown,
    options: Pick<TimelineDetailRow, 'variant' | 'clamp' | 'showIcon'> = {},
  ) => {
    const text = getDisplayValue(value, '');
    if (text && !isDuplicateTimelineText(rows, text)) {
      rows.push({
        key,
        icon,
        label,
        value: text,
        variant: options.variant || 'text',
        clamp: options.clamp,
        showIcon: options.showIcon,
      });
    }
  };

  if (!isWarningIssuedTimelineEvent(item)) {
    const mainDetails = getTimelineMainDetails(item);
    const relatedInspectionTaskNo = getTimelineRelatedInspectionTaskNo(item, mainDetails);

    if (isViolationCreatedTimelineEvent(item)) {
      if (shouldRenderTimelineRelatedInspectionRow(item, mainDetails)) {
        rows.push({
          key: 'related-inspection',
          icon: 'relatedInspection',
          label: translateViolation('timeline.relatedInspection'),
          value: relatedInspectionTaskNo,
          variant: 'relatedInspection',
          relatedInspection: getTimelineRelatedInspectionTarget(
            relatedInspectionTaskNo,
            relatedReinspection,
          ),
        });
      }
    } else {
      addTextRow(
        'description',
        'action',
        '',
        mainDetails,
        { clamp: true },
      );
    }
  }

  return rows;
};

const getCommitteeDecisionTypeRawValue = (detail: DetailRecord | null) => {
  return detail?.committeeDecisionTypeId;
};

const getCommitteeDecisionTypeId = (detail: DetailRecord | null) => (
  getOptionalNumber(getCommitteeDecisionTypeRawValue(detail))
);

const hasAppealDecisionRows = (detail: DetailRecord | null) => {
  const record = detail as Record<string, any> | null;
  return ensureArray<Record<string, any>>(record?.checklistViolations)
    .some((row) => Boolean(getAppealDecisionResult(row)));
};

const shouldShowCommitteeReviewDecision = (
  detail: DetailRecord | null,
  isLicensingViolation = false,
) => (
  !isLicensingViolation && hasDisplayValue(getCommitteeDecisionTypeRawValue(detail))
);

const shouldShowCommitteeDecisionOnAppeal = (detail: DetailRecord | null) => (
  hasAppealDecisionRows(detail)
);

const getCommitteeChecklistRows = (detail: DetailRecord | null) => {
  const record = detail as Record<string, any> | null;
  return ensureArray<Record<string, any>>(record?.checklistViolations)
    .filter((row) => row.committeeReview === true || (row.reported === true && row.committeeReview !== true));
};

const getCommitteeChecklistRowState = (row: Record<string, any>) => {
  const reported = row.reported === true;
  const committeeReview = row.committeeReview === true;
  const cancelled = reported && !committeeReview;
  const added = !cancelled && !reported && committeeReview;

  return {
    added,
    cancelled,
    modified: false,
    maintained: false,
  };
};

const getCommitteeSourceRows = (detail: DetailRecord | null) => {
  const record = detail as Record<string, any> | null;
  return ensureArray<Record<string, any>>(record?.checklistViolations);
};

const getCommitteeEvidenceRows = (detail: DetailRecord | null) => {
  const record = detail as Record<string, any> | null;
  return ensureArray<Record<string, any>>(record?.checklistViolations);
};

const getMatchedEvidenceRow = (
  detail: DetailRecord | null,
  row?: Record<string, any> | null,
) => {
  if (!row) return undefined;
  return getCommitteeEvidenceRows(detail).find((candidate) => (
    hasViolationItemMatch(row, candidate)
  ));
};

const mapEvidenceItem = (
  detail: DetailRecord | null,
  row: Record<string, any>,
  index: number,
) => mapRawViolationItem(row, index, detail?.status);

const mapCommitteeEvidenceItem = (
  detail: DetailRecord | null,
  row: Record<string, any>,
  index: number,
) => mapRawViolationItem(row, index, detail?.status, {
  noteField: 'committeeNote',
  attachmentCategories: COMMITTEE_DECISION_ATTACHMENT_CATEGORIES,
});

const mergeEvidenceIntoViolation = <T extends ReportedViolationItem>(
  item: T,
  evidence?: ReportedViolationItem,
): T => ({
  ...item,
  title: getReportedViolationTitle(item, '') || getReportedViolationTitle(evidence, ''),
  violationDescription: item.violationDescription || evidence?.violationDescription,
  violationDescriptionEn: item.violationDescriptionEn || evidence?.violationDescriptionEn,
  violationDescriptionAr: item.violationDescriptionAr || evidence?.violationDescriptionAr,
  attachments: evidence?.attachments?.length ? evidence.attachments : item.attachments,
  notes: hasDisplayValue(evidence?.notes) ? evidence?.notes : item.notes,
  violationItemId: item.violationItemId ?? evidence?.violationItemId,
  violationItemCode: item.violationItemCode || evidence?.violationItemCode,
  violationTypeId: item.violationTypeId ?? evidence?.violationTypeId,
  checklistCode: item.checklistCode || evidence?.checklistCode,
  sourceChecklistItemId: item.sourceChecklistItemId ?? evidence?.sourceChecklistItemId,
  reported: item.reported !== undefined ? item.reported : evidence?.reported,
  committeeReview: item.committeeReview !== undefined
    ? item.committeeReview
    : evidence?.committeeReview,
});

const getCommitteeRowTitle = (
  sourceRow?: Record<string, any> | null,
  reasonRow?: Record<string, any> | null,
) => (
  getViolationDescriptionTitle(reasonRow, '') ||
  getViolationDescriptionTitle(sourceRow, '')
);

const orderCommitteeDecisionRows = (rows: CommitteeDecisionRow[]) => (
  rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftAdded = left.row.added ? 1 : 0;
      const rightAdded = right.row.added ? 1 : 0;
      if (leftAdded !== rightAdded) return leftAdded - rightAdded;
      return left.index - right.index;
    })
    .map(({ row }) => row)
);

const buildCommitteeDecisionRows = (
  detail: DetailRecord | null,
): CommitteeDecisionRow[] => {
  const checklistRows = getCommitteeChecklistRows(detail);
  return orderCommitteeDecisionRows(checklistRows.map((sourceRow, index) => {
    const sourceItem = mapCommitteeEvidenceItem(detail, sourceRow, index);
    const rowState = getCommitteeChecklistRowState(sourceRow);
    const oldDegree = getKnownRawValue(sourceRow, ['oldDegree']);

    return {
      ...sourceItem,
      key: `committee-checklist-${index}-${getDisplayValue(
        sourceRow.id ||
          sourceRow.violationItemId ||
          sourceRow.taskChecklistItemId ||
          sourceItem.key,
        String(index),
      )}`,
      title: getCommitteeRowTitle(sourceRow, undefined),
      amount: getOwnRawValue(sourceRow, ['beforeAppealAdjustedFineAmount']),
      degree: oldDegree,
      oldDegree,
      newDegree: getKnownRawValue(sourceRow, ['newDegree']),
      decisionTypeId: getKnownRawValue(sourceRow, ['decisionTypeId']),
      cancelled: rowState.cancelled,
      deleted: false,
      added: rowState.added,
      modified: rowState.modified,
      maintained: rowState.maintained,
    };
  }));
};

const getAppealDecisionChecklistRows = (detail: DetailRecord | null) => {
  if (!shouldShowCommitteeDecisionOnAppeal(detail)) return [];

  const record = detail as Record<string, any> | null;
  return ensureArray<Record<string, any>>(record?.checklistViolations)
    .filter((row) => Boolean(getAppealDecisionResult(row)));
};

const getAppealRowTitle = (row: Record<string, any>) => (
  getViolationDescriptionTitle(row, '')
);

const buildAppealDecisionRows = (detail: DetailRecord | null): CommitteeDecisionRow[] => {
  const sourceRows = getAppealDecisionChecklistRows(detail);
  if (!sourceRows.length) return [];

  return sourceRows.map((sourceRow, index) => {
    const rowItem = mapEvidenceItem(detail, sourceRow, index);
    const evidenceRow = getMatchedEvidenceRow(detail, sourceRow);
    const evidenceItem = evidenceRow ? mapEvidenceItem(detail, evidenceRow, index) : undefined;
    const oldDegree = getKnownRawValue(sourceRow, ['oldDegree']);
    const newDegree = getKnownRawValue(sourceRow, ['newDegree']);
    const appealResult = getAppealDecisionResult(sourceRow);
    const modified = appealResult === 'adjustments';
    const cancelled = appealResult === 'cancelled';
    const maintained = appealResult === 'maintained';
    const appealAttachments = getAppealDecisionAttachments(sourceRow);
    const appealNote = getDisplayValue(sourceRow.appealNote, '');

    const mergedRow = mergeEvidenceIntoViolation({
      ...rowItem,
      key: `appeal-decision-${getDisplayValue(sourceRow.key || sourceRow.id || sourceRow.violationItemId || index, String(index))}`,
      title: getAppealRowTitle(sourceRow),
      amount: getRowFineAmount(sourceRow),
      degree: getRowDegreeValue(sourceRow),
      oldDegree,
      newDegree,
      decisionTypeId: getKnownRawValue(sourceRow, ['decisionTypeId']),
      cancelled,
      added: false,
      modified,
      maintained,
    }, evidenceItem);

    return {
      ...mergedRow,
      attachments: appealAttachments,
      notes: appealNote,
    };
  });
};

const getAppealCommitteeNotes = (detail: DetailRecord | null) => {
  return getDisplayValue(
    detail?.appealDecisionNote,
  );
};

const getAppealActionBy = (detail: DetailRecord | null) => {
  return getDisplayValue(detail?.appealDecidedByName);
};

const getAppealDecisionAction = (detail: DetailRecord | null) => (
  getLocalizedText(
    detail?.appealDecisionTypeName,
    detail?.appealDecisionTypeNameAr,
    '',
  ) || getDisplayValue(detail?.appealDecisionTypeName)
);

const getCommitteeDecisionActionFallback = (
  detail: DetailRecord | null,
  rows: CommitteeDecisionRow[],
) => {
  const committeeDecisionTypeId = getCommitteeDecisionTypeId(detail);
  if (committeeDecisionTypeId === 3) return i18next.t(COMMITTEE_DECISION_LABEL_KEYS.cancelled);
  if (rows.some((row) => row.added || row.cancelled || row.deleted || row.modified)) {
    return i18next.t(COMMITTEE_DECISION_LABEL_KEYS.modified);
  }
  return i18next.t(COMMITTEE_DECISION_LABEL_KEYS.confirmed);
};

const getCommitteeDecisionAction = (
  detail: DetailRecord | null,
  rows: CommitteeDecisionRow[],
) => {
  const localizedDecisionType = getLocalizedText(
    detail?.committeeDecisionTypeName,
    detail?.committeeDecisionTypeNameAr,
    '',
  );
  return localizedDecisionType || getCommitteeDecisionActionFallback(detail, rows);
};

const getCommitteeDecisionNote = (detail: DetailRecord | null) => (
  getDisplayValue(
    (detail as Record<string, any> | null)?.committeeDecisionNote,
    '',
  )
);

const getCommitteeDecisionBy = (detail: DetailRecord | null) => (
  getDisplayValue(
    (detail as Record<string, any> | null)?.committeeDecidedByName,
  )
);

function ViolationDetailCardHeader({
  title,
  expanded,
  onToggle,
  showExpandIcon = false,
  onExpand,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  showExpandIcon?: boolean;
  onExpand?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <DetailCardHeader
      title={title}
      open={expanded}
      onToggle={onToggle}
      showExpandIcon={showExpandIcon}
      onExpand={onExpand}
      rootClassName="inspection-violation-details__section-header"
      titleClassName="inspection-violation-details__section-title"
      actionsClassName="inspection-violation-details__section-actions"
      chevronClassName="inspection-violation-details__section-chevron"
      expandClassName="inspection-violation-details__section-expand"
      expandButtonAriaLabel={showExpandIcon ? t('inspection.violation.detail.expandSection', { title }) : undefined}
    />
  );
}

function DetailField({ item }: { item: DetailItem }) {
  return (
    <div className="inspection-violation-details__detail-field">
      <div className="inspection-violation-details__detail-label">{item.label}</div>
      <div
        className={`inspection-violation-details__detail-value ${
          item.primary ? 'inspection-violation-details__detail-value--primary' : ''
        }`}
      >
        {item.value || '-'}
      </div>
    </div>
  );
}

function DetailGrid({ items, className }: { items: DetailItem[]; className?: string }) {
  const gridClassName = className
    ? `inspection-violation-details__detail-grid ${className}`
    : 'inspection-violation-details__detail-grid';

  return (
    <div className={gridClassName}>
      {items.map((item) => (
        <DetailField key={item.key} item={item} />
      ))}
    </div>
  );
}

function FineAmountAedLabel() {
  const { t } = useTranslation();

  return (
    <span className="inspection-violation-details__fine-amount-label">
      <span>{t('inspection.violation.columns.fineAmount')}</span>
      <AedIcon className="inspection-violation-details__fine-amount-label-icon" aria-label="AED" />
    </span>
  );
}

function TopSummaryCard({ items }: { items: TopSummaryItem[] }) {
  return (
    <div className="inspection-violation-details__top-card">
      <div className="inspection-violation-details__top-scroll">
        <div
          className="inspection-violation-details__top-strip"
          style={{
            "--inspection-violation-summary-count": items.length,
          } as React.CSSProperties}
        >
          {items.map((item) => (
            <div key={item.label} className="inspection-violation-details__top-item">
              <div className="inspection-violation-details__top-icon">
                <img
                  src={item.icon}
                  alt=""
                  aria-hidden="true"
                  className="inspection-violation-details__top-icon-image"
                />
              </div>
              <div className="inspection-violation-details__top-copy">
                <div className="inspection-violation-details__top-label">{item.label}</div>
                <div className="inspection-violation-details__top-value">
                  {item.status ? (
                    <InspectionViolationStatusTag status={item.status} label={item.value} />
                  ) : (
                    item.value || '-'
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FineDetailsTable({
  rows,
  totalAmount,
  showCountColumn = false,
}: {
  rows: FineDetailRow[];
  totalAmount?: number | string | null;
  showCountColumn?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="inspection-violation-details__fine-table-wrap">
      <table className="inspection-violation-details__fine-table">
        <colgroup>
          <col className="inspection-violation-details__fine-table-col inspection-violation-details__fine-table-col--violation" />
          <col className="inspection-violation-details__fine-table-col inspection-violation-details__fine-table-col--degree" />
          <col className="inspection-violation-details__fine-table-col inspection-violation-details__fine-table-col--amount" />
        </colgroup>
        <thead>
          <tr>
            <th>{t('inspection.violation.detail.violation')}</th>
            <th>{t(showCountColumn ? 'inspection.violation.detail.count' : 'inspection.violation.detail.degree')}</th>
            <th>
              <span className="inspection-violation-details__fine-table-header-amount">
                <span>{t('inspection.violation.detail.amount')}</span>
                <AedIcon className="inspection-violation-details__fine-table-aed" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.violation || '-'}</td>
              <td>{showCountColumn ? getDisplayValue(row.count) : row.severity || '-'}</td>
              <td>{getFineTableAmountLabel(row.fineAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inspection-violation-details__fine-total">
        <span>{t('inspection.violation.detail.total')}</span>
        <span className="inspection-violation-details__fine-total-amount">
          <AedIcon
            withParentheses={false}
            className="inspection-violation-details__fine-total-aed"
          />
          <span>{getFineTableAmountLabel(totalAmount)}</span>
        </span>
      </div>
    </div>
  );
}

function AttachmentGrid({
  attachments,
  compact = false,
}: {
  attachments: AttachmentItem[];
  compact?: boolean;
}) {
  const className = compact
    ? 'inspection-violation-details__attachment-grid inspection-violation-details__attachment-grid--single'
    : 'inspection-violation-details__attachment-grid';

  return (
    <InspectionAttachmentGrid attachments={attachments} className={className} />
  );
}

function StatusPill({ label, status }: { label: React.ReactNode; status?: string | null }) {
  return (
    <InspectionViolationStatusTag
      status={status}
      label={label}
      className="inspection-violation-details__status-pill"
    />
  );
}

function AedAmountPill({
  amount,
  className,
  iconClassName,
}: {
  amount?: number | string | null;
  className: string;
  iconClassName: string;
}) {
  return (
    <span className={className}>
      <AedIcon withParentheses={false} className={iconClassName} />
      <span>{getCompactAmountLabel(amount)}</span>
    </span>
  );
}

function ReportedViolationMarker({
  item,
  displayConfig,
  isLicensingViolation,
}: {
  item: ReportedViolationItem;
  displayConfig: ReportedViolationDisplayConfig;
  isLicensingViolation: boolean;
}) {
  const row = item as Record<string, any>;
  const isRowLicensingViolation = getReportedRowIsLicensingViolation(row, isLicensingViolation);
  if (displayConfig.hideMarker && !isRowLicensingViolation) return null;

  if (isRowLicensingViolation) {
    const rowFineAmount = getRowFineAmount(row);
    const numericFineAmount = getOptionalNumber(rowFineAmount);
    if (numericFineAmount !== undefined && numericFineAmount > 0) {
      return (
        <AedAmountPill
          amount={numericFineAmount}
          className="inspection-violation-details__reported-amount"
          iconClassName="inspection-violation-details__reported-amount-icon"
        />
      );
    }

    const warningLabel = getRowWarningLabel(row, {
      isLicensing: true,
      preferOldDegree: true,
    });
    if (warningLabel) {
      return (
        <span className="inspection-violation-details__reported-warning">
          {warningLabel}
        </span>
      );
    }
    return null;
  }

  return (
    <StatusPill
      status={item.status}
      label={getReportedViolationStatusLabel(item)}
    />
  );
}

function ExpandableViolationRow({
  item,
  expanded,
  onToggle,
  marker,
  titleExtra,
  cancelled = false,
  headerSpacing = 'default',
}: {
  item: ReportedViolationItem;
  expanded: boolean;
  onToggle: () => void;
  marker: React.ReactNode;
  titleExtra?: React.ReactNode;
  cancelled?: boolean;
  headerSpacing?: ReportedViolationHeaderSpacing;
}) {
  const { t } = useTranslation();
  const attachments = item.attachments || [];
  const displayTitle = getReportedViolationTitle(item);
  const className = [
    'inspection-violation-details__violation-row',
    expanded ? 'is-open' : '',
    cancelled ? 'inspection-violation-details__violation-row--cancelled' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <button
        type="button"
        className={[
          'inspection-violation-details__violation-row-header',
          headerSpacing === 'compact'
            ? 'inspection-violation-details__violation-row-header--compact'
            : '',
        ].filter(Boolean).join(' ')}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className={`inspection-violation-details__violation-row-chevron ${expanded ? 'is-open' : ''}`}>
          <img src={cardHeaderCollapseIcon} alt="" aria-hidden="true" />
        </span>
        <span className="inspection-violation-details__violation-row-title-wrap">
          <span className="inspection-violation-details__violation-row-title">{displayTitle}</span>
          {titleExtra}
        </span>
        {marker}
      </button>
      {expanded ? (
        <div className="inspection-violation-details__violation-row-body">
          <div className="inspection-violation-details__violation-row-divider" />
          <div className="inspection-violation-details__reported-label">
            {t('inspection.violation.detail.attachments')}
          </div>
          {attachments.length ? (
            <AttachmentGrid attachments={attachments} />
          ) : (
            <div className="inspection-violation-details__empty-text">-</div>
          )}
          <div className="inspection-violation-details__reported-label">
            {t('inspection.violation.detail.notes')}
          </div>
          <div className="inspection-violation-details__reported-notes">
            {hasDisplayValue(item.notes) ? item.notes : '-'}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const getInlineDegreeLabel = (degree?: number | string | null) => {
  if (degree === undefined || degree === null || String(degree).trim() === '') return '';
  return getDisplayValue(translateViolation('detail.degreeStatus', { degree })).replace(/:\s*$/, '');
};

const getInlineWarningLabel = (count?: number | string | null) => {
  if (count === undefined || count === null || String(count).trim() === '') return '';
  return `${getOrdinalLabel(count)} Warning`;
};

function CommitteeDegreeChangePill({
  row,
  isLicensingViolation,
}: {
  row: CommitteeDecisionRow;
  isLicensingViolation: boolean;
}) {
  if (!hasDisplayValue(row.oldDegree) || !hasDisplayValue(row.newDegree)) return null;
  const oldLabel = isLicensingViolation
    ? getInlineWarningLabel(row.oldDegree)
    : getInlineDegreeLabel(row.oldDegree);
  const newLabel = isLicensingViolation
    ? getInlineWarningLabel(row.newDegree)
    : getInlineDegreeLabel(row.newDegree);

  return (
    <span className="inspection-violation-details__committee-degree-change">
      <span className="inspection-violation-details__committee-degree-old">
        {oldLabel}
      </span>
      <span>{`→ ${newLabel}`}</span>
    </span>
  );
}

function CommitteeDecisionAmount({
  row,
  hideDegreeLabel = false,
}: {
  row: CommitteeDecisionRow;
  hideDegreeLabel?: boolean;
}) {
  const amount = row.amount;
  const displayAmount = hasDisplayValue(amount) ? amount : undefined;
  const hasAmount = amount !== undefined;
  const hasDegree = row.degree !== undefined && row.degree !== null && String(row.degree).trim() !== '';
  if (!hasAmount && !hasDegree) return null;

  return (
    <span className="inspection-violation-details__committee-decision-chip">
      {!hideDegreeLabel && hasDegree ? (
        <span>{translateViolation('detail.degreeStatus', { degree: row.degree })}</span>
      ) : null}
      {hasAmount ? (
        <AedAmountPill
          amount={displayAmount}
          className="inspection-violation-details__committee-amount"
          iconClassName="inspection-violation-details__committee-amount-icon"
        />
      ) : null}
    </span>
  );
}

function CommitteeDecisionMarker({
  row,
  isLicensingViolation,
  hideDefaultAmountDegreeLabel = false,
}: {
  row: CommitteeDecisionRow;
  isLicensingViolation: boolean;
  hideDefaultAmountDegreeLabel?: boolean;
}) {
  const { t } = useTranslation();
  const isRowLicensingViolation = getReportedRowIsLicensingViolation(
    row as unknown as Record<string, any>,
    isLicensingViolation,
  );

  if (row.deleted) {
    return (
      <span className="inspection-violation-details__committee-deleted">
        {t(COMMITTEE_DECISION_LABEL_KEYS.deleted)}
      </span>
    );
  }

  if (row.cancelled) {
    return (
      <span className="inspection-violation-details__committee-cancelled">
        {t(COMMITTEE_DECISION_LABEL_KEYS.cancelled)}
      </span>
    );
  }

  if (row.modified && hasDisplayValue(row.oldDegree) && hasDisplayValue(row.newDegree)) {
    return (
      <CommitteeDegreeChangePill
        row={row}
        isLicensingViolation={isRowLicensingViolation}
      />
    );
  }

  if (row.maintained) {
    return (
      <span className="inspection-violation-details__committee-maintained">
        {t(COMMITTEE_DECISION_LABEL_KEYS.maintained, {
          defaultValue: COMMITTEE_DECISION_DEFAULT_LABELS.maintained,
        })}
      </span>
    );
  }

  return (
    <CommitteeDecisionAmount
      row={row}
      hideDegreeLabel={hideDefaultAmountDegreeLabel && isRowLicensingViolation}
    />
  );
}

function CommitteeReviewDecisionModule({
  rows,
  appealRows,
  reportedRows,
  reportedDisplayConfig,
  isLicensingViolation,
  showCommitteeReviewTab = false,
  showAppealTab = false,
  note,
  actionLabel,
  actionBy,
  appealNote,
  appealActionLabel,
  appealActionBy,
  hideDefaultAmountDegreeLabels = false,
}: {
  rows: CommitteeDecisionRow[];
  appealRows: CommitteeDecisionRow[];
  reportedRows: ReportedViolationItem[];
  reportedDisplayConfig: ReportedViolationDisplayConfig;
  isLicensingViolation: boolean;
  showCommitteeReviewTab?: boolean;
  showAppealTab?: boolean;
  note: string;
  actionLabel: string;
  actionBy: string;
  appealNote: string;
  appealActionLabel: string;
  appealActionBy: string;
  hideDefaultAmountDegreeLabels?: boolean;
}) {
  const { t } = useTranslation();
  const tabs = useMemo(() => {
    const items: Array<{ key: CommitteeDecisionTabKey; label: string }> = [];
    if (showAppealTab) {
      items.push({
        key: 'appeal',
        label: t(COMMITTEE_DECISION_LABEL_KEYS.appealTitle, {
          defaultValue: COMMITTEE_DECISION_DEFAULT_LABELS.appealTitle,
        }),
      });
    }
    if (showCommitteeReviewTab) {
      items.push({ key: 'committee', label: t(COMMITTEE_DECISION_LABEL_KEYS.title) });
    }
    items.push({ key: 'reported', label: t('inspection.violation.detail.reportedViolations') });
    return items;
  }, [showAppealTab, showCommitteeReviewTab, t]);
  const [activeTab, setActiveTab] = useState<CommitteeDecisionTabKey>(
    tabs[0]?.key || 'reported',
  );
  const userSelectedTabRef = useRef(false);
  const [openRowKeys, setOpenRowKeys] = useState<Record<CommitteeDecisionTabKey, string[]>>({
    appeal: [],
    committee: [],
    reported: [],
  });
  const activeRows = activeTab === 'appeal'
    ? appealRows
    : activeTab === 'committee'
      ? rows
      : reportedRows;
  const showDecisionMeta = activeTab !== 'reported';
  const currentMeta: CommitteeDecisionMeta = activeTab === 'appeal'
    ? {
      note: appealNote,
      action: appealActionLabel,
      actionBy: appealActionBy,
    }
    : {
      note,
      action: actionLabel,
      actionBy,
    };

  useEffect(() => {
    const defaultTab = tabs[0]?.key || 'reported';
    if (!tabs.some((item) => item.key === activeTab)) {
      userSelectedTabRef.current = false;
      setActiveTab(defaultTab);
      return;
    }
    if (!userSelectedTabRef.current && activeTab !== defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, tabs]);

  const toggleRow = (tabKey: CommitteeDecisionTabKey, key: string) => {
    setOpenRowKeys((current) => {
      const currentKeys = current[tabKey] || [];
      return {
        ...current,
        [tabKey]: currentKeys.includes(key)
          ? currentKeys.filter((item) => item !== key)
          : [...currentKeys, key],
      };
    });
  };

  return (
    <section
      className={`inspection-violation-details__card inspection-violation-details__committee-card inspection-violation-details__committee-card--${activeTab}-active ${
        tabs.length >= 2 ? 'inspection-violation-details__committee-card--multiple-tabs' : ''
      }`}
    >
      <div className="inspection-violation-details__committee-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`inspection-violation-details__committee-tab ${
              activeTab === tab.key ? 'inspection-violation-details__committee-tab--active' : ''
            }`}
            onClick={() => {
              userSelectedTabRef.current = true;
              setActiveTab(tab.key);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="inspection-violation-details__committee-list">
        {activeRows.map((item) => {
          const row = item as CommitteeDecisionRow;
          const isDecisionRow = activeTab !== 'reported';
          return (
            <ExpandableViolationRow
              key={item.key}
              item={item}
              expanded={(openRowKeys[activeTab] || []).includes(item.key)}
              onToggle={() => toggleRow(activeTab, item.key)}
              cancelled={isDecisionRow && (row.cancelled || row.deleted)}
              titleExtra={isDecisionRow && row.added && !row.cancelled ? (
                <span className="inspection-violation-details__committee-new">
                  {t(COMMITTEE_DECISION_LABEL_KEYS.new)}
                </span>
              ) : null}
              marker={isDecisionRow ? (
                <CommitteeDecisionMarker
                  row={row}
                  isLicensingViolation={isLicensingViolation}
                  hideDefaultAmountDegreeLabel={hideDefaultAmountDegreeLabels}
                />
              ) : (
                <ReportedViolationMarker
                  item={item}
                  displayConfig={reportedDisplayConfig}
                  isLicensingViolation={isLicensingViolation}
                />
              )}
              headerSpacing={isDecisionRow ? 'default' : reportedDisplayConfig.headerSpacing}
            />
          );
        })}
      </div>
      {showDecisionMeta ? (
        <>
          <div className="inspection-violation-details__committee-meta">
            <div className="inspection-violation-details__committee-meta-field">
              <div className="inspection-violation-details__committee-label">
                {t(COMMITTEE_DECISION_LABEL_KEYS.action)}
              </div>
              <div className="inspection-violation-details__committee-meta-value">{currentMeta.action}</div>
            </div>
            <div className="inspection-violation-details__committee-meta-field">
              <div className="inspection-violation-details__committee-label">
                {t(COMMITTEE_DECISION_LABEL_KEYS.actionBy)}
              </div>
              <div className="inspection-violation-details__committee-meta-value">{currentMeta.actionBy}</div>
            </div>
          </div>
          {currentMeta.note ? (
            <div className="inspection-violation-details__committee-note">
              <div className="inspection-violation-details__committee-label">
                {t(COMMITTEE_DECISION_LABEL_KEYS.note)}
              </div>
              <div className="inspection-violation-details__committee-note-text">{currentMeta.note}</div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function RelatedReinspectionCard({
  data,
  onOpenTask,
}: {
  data: RelatedReinspection;
  onOpenTask: (data: RelatedReinspection) => void;
}) {
  const { t } = useTranslation();
  const canOpenTask = Boolean(data.taskId && data.taskNo);
  const statusClassName = data.status
    ? [
      'inspection-shared-status-tag',
      `status-${normalizeInspectionCode(data.status).toLowerCase()}`,
      'inspection-violation-details__reinspection-status',
    ].join(' ')
    : '';

  return (
    <div className="inspection-violation-details__reinspection-card">
      <div className="inspection-violation-details__reinspection-top">
        {data.taskNo && canOpenTask ? (
          <button
            type="button"
            className="inspection-violation-details__reinspection-number inspection-violation-details__reinspection-number-button"
            aria-label={`Open related reinspection task ${data.taskNo}`}
            onClick={() => onOpenTask(data)}
          >
            {data.taskNo}
          </button>
        ) : data.taskNo ? (
          <span className="inspection-violation-details__reinspection-number">{data.taskNo}</span>
        ) : null}
        {data.status ? (
          <span className={statusClassName} title={data.status}>
            {data.status}
          </span>
        ) : null}
      </div>
      {data.inspector ? (
        <div className="inspection-violation-details__reinspection-field">
          <span>{t('inspection.violation.detail.inspector')}</span>
          <strong>{data.inspector}</strong>
        </div>
      ) : null}
      {data.dueDate ? (
        <div className="inspection-violation-details__reinspection-field">
          <span>{t('inspection.violation.detail.dueDate')}</span>
          <strong>{formatDate(data.dueDate, data.dueDate)}</strong>
        </div>
      ) : null}
    </div>
  );
}

type RelatedAppealStatusTone = 'success' | 'warning' | 'danger' | 'neutral';

const RELATED_APPEAL_STATUS_TONE_MAP: Record<string, RelatedAppealStatusTone> = {
  pending: 'warning',
  resolved: 'success',
  departmentprocessing: 'warning',
  departmentprocessed: 'warning',
  pendingcustomer: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
  underreview: 'warning',
  pendingreview: 'warning',
  pendingapproval: 'warning',
  appealsubmitted: 'warning',
  appealapproved: 'success',
  appealrejected: 'danger',
};

const normalizeRelatedAppealStatusKey = (status?: string | null) => (
  String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
);

const getRelatedAppealStatusTone = (status?: string | null): RelatedAppealStatusTone => {
  const statusKey = normalizeRelatedAppealStatusKey(status);
  const mappedTone = RELATED_APPEAL_STATUS_TONE_MAP[statusKey];

  if (!statusKey) return 'neutral';
  if (mappedTone) return mappedTone;
  if (statusKey.includes('reject') || statusKey.includes('declin')) return 'danger';
  if (
    statusKey.includes('approv') ||
    statusKey.includes('accept') ||
    statusKey.includes('resolv')
  ) {
    return 'success';
  }
  if (
    statusKey.includes('review') ||
    statusKey.includes('pending') ||
    statusKey.includes('process') ||
    statusKey.includes('progress') ||
    statusKey.includes('submitted')
  ) {
    return 'warning';
  }

  return 'neutral';
};

function RelatedAppealCard({ data }: { data: RelatedAppeal }) {
  const { t } = useTranslation();
  const statusTone = getRelatedAppealStatusTone(data.status);
  const statusClassName = [
    'inspection-violation-details__related-appeal-status',
    statusTone !== 'neutral' ? `inspection-violation-details__related-appeal-status--${statusTone}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="inspection-violation-details__related-appeal-card">
      <div className="inspection-violation-details__related-appeal-top">
        <OverflowTooltipText
          className="inspection-violation-details__related-appeal-number"
          title={data.appealNo || '-'}
        >
          {data.appealNo || '-'}
        </OverflowTooltipText>
        <OverflowTooltipText
          className={statusClassName}
          title={data.status || '-'}
        >
          {data.status || '-'}
        </OverflowTooltipText>
      </div>
      <div className="inspection-violation-details__related-appeal-field">
        <span>{t('inspection.violation.detail.submittedOn')}</span>
        <strong>{formatDateTime(data.submittedOn, '-')}</strong>
      </div>
      <div className="inspection-violation-details__related-appeal-field">
        <span>{t('inspection.violation.detail.slaDueDate')}</span>
        <strong>{formatDate(data.slaDueOn, data.slaDueOn || '-')}</strong>
      </div>
    </div>
  );
}

function OverflowTooltipText({
  className,
  children,
  title,
  overlayClassName,
  component = 'div',
}: {
  className: string;
  children: React.ReactNode;
  title?: React.ReactNode;
  overlayClassName?: string;
  component?: 'div' | 'span';
}) {
  const textRef = useRef<HTMLElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const setTextElement = useCallback((element: HTMLElement | null) => {
    textRef.current = element;
  }, []);

  const measureOverflow = useCallback(() => {
    const element = textRef.current;
    if (!element) return;

    setIsOverflowing(
      element.scrollWidth > element.clientWidth ||
      element.scrollHeight > element.clientHeight,
    );
  }, []);

  useEffect(() => {
    measureOverflow();

    const element = textRef.current;
    if (!element) return undefined;

    let frameId = 0;
    const scheduleMeasure = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measureOverflow);
    };

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(scheduleMeasure);
      observer.observe(element);
      if (element.parentElement) observer.observe(element.parentElement);

      return () => {
        if (frameId) window.cancelAnimationFrame(frameId);
        observer.disconnect();
      };
    }

    window.addEventListener('resize', scheduleMeasure);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [children, measureOverflow, title]);

  return (
    <Tooltip
      title={isOverflowing ? title ?? children : undefined}
      overlayClassName={overlayClassName}
    >
      {component === 'span' ? (
        <span ref={setTextElement} className={className}>{children}</span>
      ) : (
        <div ref={setTextElement} className={className}>{children}</div>
      )}
    </Tooltip>
  );
}

function TimelineMetaRow({
  icon,
  children,
  className,
  variant = 'text',
  clamp = false,
  showIcon = true,
  tooltipOnOverflow = false,
  tooltipTitle,
  onClick,
  ariaLabel,
}: {
  icon: TimelineIconKey;
  children?: React.ReactNode;
  className?: string;
  variant?: TimelineDetailVariant;
  clamp?: boolean;
  showIcon?: boolean;
  tooltipOnOverflow?: boolean;
  tooltipTitle?: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  if (!children) return null;

  const rowClassName = [
    'inspection-violation-details__timeline-meta-row',
    variant === 'relatedInspection' ? 'inspection-violation-details__timeline-meta-row--related-inspection' : '',
    variant === 'relatedInspection' && !onClick ? 'inspection-violation-details__timeline-meta-row--related-inspection-disabled' : '',
    className || '',
  ].filter(Boolean).join(' ');
  const textClassName = [
    'inspection-violation-details__timeline-meta-text',
    clamp ? 'inspection-violation-details__timeline-meta-text--clamp' : '',
  ].filter(Boolean).join(' ');

  const iconNode = showIcon ? (
    <img
      className="inspection-violation-details__timeline-meta-icon"
      src={inspectionFigmaAssets.timelineIcons[icon]}
      alt=""
      aria-hidden="true"
    />
  ) : null;

  if (variant === 'relatedInspection' && onClick) {
    return (
      <button
        type="button"
        className={rowClassName}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {iconNode}
        <OverflowTooltipText
          className={textClassName}
          title={tooltipTitle}
          overlayClassName="inspection-violation-details__timeline-tooltip"
          component="span"
        >
          {children}
        </OverflowTooltipText>
      </button>
    );
  }

  return (
    <div className={rowClassName}>
      {iconNode}
      {tooltipOnOverflow || variant === 'relatedInspection' ? (
        <OverflowTooltipText
          className={textClassName}
          title={tooltipTitle}
          overlayClassName="inspection-violation-details__timeline-tooltip"
          component={variant === 'relatedInspection' ? 'span' : 'div'}
        >
          {children}
        </OverflowTooltipText>
      ) : (
        <div className={textClassName}>{children}</div>
      )}
    </div>
  );
}

function ViolationTimeline({
  items,
  relatedReinspection,
  onOpenRelatedInspection,
}: {
  items: ViolationTimelineItem[];
  relatedReinspection?: RelatedReinspection | null;
  onOpenRelatedInspection?: (target: RelatedReinspection) => void;
}) {
  const { t } = useTranslation();

  if (!items.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('inspection.violation.timeline.noEvents')}
      />
    );
  }

  return (
    <div className="inspection-violation-details__timeline-list">
      {items.map((item, index) => {
        const isLatest = index === 0;
        const isLast = index === items.length - 1;
        const title = getTimelineTitle(item);
        const actorLabel = getTimelineActorLabel(item);
        const showActor = shouldShowTimelineActor(item);
        const detailRows = buildTimelineDetailRows(item, relatedReinspection);

        return (
          <div key={item.key || `${title}-${index}`} className="inspection-violation-details__timeline-item">
            <div className="inspection-violation-details__timeline-marker">
              {!isLatest ? <span className="inspection-violation-details__timeline-line inspection-violation-details__timeline-line--top" /> : null}
              <span className="inspection-violation-details__timeline-dot-wrap">
                <span className={`inspection-violation-details__timeline-dot ${isLatest ? 'is-active' : ''}`} />
              </span>
              {!isLast ? <span className="inspection-violation-details__timeline-line inspection-violation-details__timeline-line--bottom" /> : null}
            </div>
            <div className="inspection-violation-details__timeline-content">
              <div className="inspection-violation-details__timeline-title">{title}</div>
              <div className="inspection-violation-details__timeline-meta">
                {showActor ? (
                  <TimelineMetaRow icon={getTimelineActorType(item) === 'system' ? 'system' : 'user'}>
                    {actorLabel}
                  </TimelineMetaRow>
                ) : null}
                <TimelineMetaRow icon="calendar">{formatDateTime(getTimelineEventTime(item), '-')}</TimelineMetaRow>
                {detailRows.map((row) => {
                  const relatedInspection = row.relatedInspection;
                  const rowLabel = getDisplayValue(row.label, '');
                  const rowValue = getDisplayValue(row.value, '');

                  return (
                    <TimelineMetaRow
                      key={row.key}
                      icon={row.icon}
                      variant={row.variant}
                      clamp={row.clamp}
                      showIcon={row.showIcon}
                      tooltipOnOverflow={Boolean(row.clamp)}
                      tooltipTitle={rowLabel ? `${rowLabel}: ${rowValue}` : rowValue}
                      ariaLabel={
                        relatedInspection?.taskNo
                          ? (rowLabel ? `${rowLabel}: ${rowValue}` : rowValue)
                          : undefined
                      }
                      onClick={
                        relatedInspection && onOpenRelatedInspection
                          ? () => onOpenRelatedInspection(relatedInspection)
                          : undefined
                      }
                    >
                      {row.label ? (
                        <span className="inspection-violation-details__timeline-detail-label">
                          {`${row.label}: `}
                        </span>
                      ) : null}
                      <span
                        className={
                          row.variant === 'relatedInspection'
                            ? 'inspection-violation-details__timeline-detail-value'
                            : undefined
                        }
                        dir={row.variant === 'relatedInspection' ? 'auto' : undefined}
                      >
                        {row.value}
                      </span>
                    </TimelineMetaRow>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailFooter({
  actions,
  actionContent,
  submitting,
  onBack,
  onAction,
}: {
  actions: InspectionViolationAction[];
  actionContent?: React.ReactNode;
  submitting: boolean;
  onBack: () => void;
  onAction: (action: InspectionViolationAction) => void;
}) {
  const { t } = useTranslation();

  const getButtonClassName = (index: number) => {
    const variantClass = index === actions.length - 1
      ? 'inspection-violation-details__footer-button--primary'
      : 'inspection-violation-details__footer-button--outline';
    return `inspection-violation-details__footer-button ${variantClass}`;
  };

  return (
    <div className="inspection-violation-details__footer detail-action-footer">
      <Button
        className="inspection-violation-details__footer-back"
        onClick={onBack}
        disabled={submitting}
      >
        {t('inspection.violation.detail.back')}
      </Button>
      <div className="inspection-violation-details__footer-actions">
        {actionContent ?? actions.map((action, index) => (
          <Button
            key={action}
            className={getButtonClassName(index)}
            onClick={() => onAction(action)}
            loading={submitting}
            disabled={submitting}
          >
            {t(DETAIL_ACTION_LABEL_KEYS[action])}
          </Button>
        ))}
      </div>
    </div>
  );
}

const InspectionViolationDetailsPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const teamTaskDetailContext = useTeamTaskDetailContext();
  const { t, i18n } = useTranslation();
  const query = useMemo(() => getInspectionQuery(location.search), [location.search]);
  const openedActionModeRef = useRef('');
  const actionSubmittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [detail, setDetail] = useState<DetailRecord | null>(null);
  const [violatorOverviewEstablishmentProfile, setViolatorOverviewEstablishmentProfile] =
    useState<ViolatorOverviewEstablishmentData | null>(null);
  const [violatorOverviewProfile, setViolatorOverviewProfile] =
    useState<ViolatorOverviewProfileAndApplicantData | null>(null);
  const [violatorOverviewProfileKey, setViolatorOverviewProfileKey] = useState('');
  const [mainSectionState, setMainSectionState] = useState<Record<SectionKey, boolean>>({
    violationInformation: true,
    reportedViolations: true,
    contentReviewReport: true,
    fineDetails: true,
  });
  const [sideSectionState, setSideSectionState] = useState<Record<SideSectionKey, boolean>>({
    violatorOverview: true,
    relatedAppeal: true,
    relatedReinspection: true,
    violationTimeline: true,
  });
  const [expandedPreview, setExpandedPreview] = useState<PreviewSectionKey | null>(null);
  const [violatorOverviewQuickNav, setViolatorOverviewQuickNav] = useState<ViolatorOverviewQuickNavTarget>(
    DEFAULT_VIOLATOR_OVERVIEW_QUICK_NAV,
  );
  const [submitReportVisible, setSubmitReportVisible] = useState(false);
  const [reviewDecideVisible, setReviewDecideVisible] = useState(false);
  const [modifyViolationVisible, setModifyViolationVisible] = useState(false);
  const [cancelViolationVisible, setCancelViolationVisible] = useState(false);
  const [deselectConfirmVisible, setDeselectConfirmVisible] = useState(false);
  const [approveSuccessModalVisible, setApproveSuccessModalVisible] = useState(false);
  const [pendingDeselectKey, setPendingDeselectKey] = useState<string | null>(null);
  const [selectedViolationKeys, setSelectedViolationKeys] = useState<string[]>([]);
  const [modifyDraftKeys, setModifyDraftKeys] = useState<string[]>([]);
  const [degreeSelections, setDegreeSelections] = useState<Record<string, FineDegreeValue>>({});
  const [reviewItemNotes, setReviewItemNotes] = useState<ReviewItemNotes>({});
  const [reviewItemAttachments, setReviewItemAttachments] = useState<ReviewItemAttachments>({});
  const [reviewItemUploading, setReviewItemUploading] = useState<ReviewItemUploading>({});
  const [reviewChecklistItems, setReviewChecklistItems] = useState<InspectionChecklistTemplateCatalogItem[]>([]);
  const [reviewStandardsLoading, setReviewStandardsLoading] = useState(false);
  const [reviewStandardsLoadedKey, setReviewStandardsLoadedKey] = useState('');
  const pendingReviewSelectionResetRef = useRef(false);
  const reviewStandardsRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  const loadViolationDetailPayload = useCallback(async () => {
    if (!query.violationId && !query.violationNo) return null;

    const payload = unwrapPayload<DetailRecord>(
      await getInspectionViolationDetail({
        violationId: query.violationId,
        violationNo: query.violationNo,
      }),
    );
    return payload || null;
  }, [query.violationId, query.violationNo]);

  const fetchDetail = useCallback(async () => {
    if (!query.violationId && !query.violationNo) return null;

    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setLoading(true);
    try {
      const payload = await loadProgressiveDetail<DetailRecord>({
        loadCore: loadViolationDetailPayload,
        loadOptional: async (core) => {
          const optionalResponse = await getInspectionViolationDetailOptionalData(
            {
              violationId: query.violationId,
              violationNo: query.violationNo,
            },
            core.violationTimeline,
          );
          return unwrapPayload<Partial<DetailRecord>>(optionalResponse);
        },
        publishCore: (nextDetail) => {
          if (requestId === detailRequestRef.current) {
            setDetail(nextDetail);
          }
        },
        publishOptional: (optionalDetail) => {
          if (requestId === detailRequestRef.current) {
            setDetail((currentDetail) => (
              currentDetail
                ? { ...currentDetail, ...optionalDetail }
                : currentDetail
            ));
          }
        },
      });
      return payload || null;
    } catch (error) {
      if (requestId !== detailRequestRef.current) return null;
      setDetail(null);
      if (isInspectionDataMissingError(error)) return null;
      CustomMessage.error(i18n.t('inspection.violation.messages.detailLoadFailed'));
      return null;
    } finally {
      if (requestId === detailRequestRef.current) {
        setLoading(false);
      }
    }
  }, [i18n, loadViolationDetailPayload, query.violationId, query.violationNo]);

  useEffect(() => {
    fetchDetail();
    return () => {
      detailRequestRef.current += 1;
    };
  }, [fetchDetail]);

  const violatorOverviewSourceTarget = useMemo(
    () => getViolatorOverviewTarget(detail),
    [detail],
  );

  useEffect(() => {
    let isCurrent = true;
    const target = violatorOverviewSourceTarget;
    const targetKey = getViolatorOverviewRecordKey(target);

    const loadTargetOverviewProfile = async () => {
      if (!target || !targetKey) {
        setViolatorOverviewEstablishmentProfile(null);
        setViolatorOverviewProfile(null);
        setViolatorOverviewProfileKey('');
        return;
      }

      setViolatorOverviewEstablishmentProfile(null);
      setViolatorOverviewProfile(null);
      setViolatorOverviewProfileKey(targetKey);

      let nextEstablishment: ViolatorOverviewEstablishmentData | null = null;
      let nextProfile: ViolatorOverviewProfileAndApplicantData | null = null;
      const establishmentId = normalizePositiveNumericId(target.establishmentId);
      const individualId = normalizePositiveNumericId(target.individualId);
      const profileId = normalizePositiveNumericId(target.profileId) || individualId;
      const targetType = Number(target.targetType);

      if (targetType === 1 && establishmentId) {
        try {
          nextEstablishment =
            unwrapPayload<ViolatorOverviewEstablishmentData>(await getUserEstablishmentByID(String(establishmentId))) ||
            null;
        } catch {
          nextEstablishment = null;
        }

        const establishmentProfileId =
          normalizePositiveNumericId(nextEstablishment?.userProfileId) ||
          normalizePositiveNumericId(target.profileId);

        if (establishmentProfileId) {
          try {
            nextProfile =
              unwrapPayload<ViolatorOverviewProfileAndApplicantData>(await profileAndApplicant(Number(establishmentProfileId))) ||
              null;
          } catch {
            nextProfile = null;
          }
        }
      } else if (profileId) {
        try {
          nextProfile =
            unwrapPayload<ViolatorOverviewProfileAndApplicantData>(await profileAndApplicant(Number(profileId))) ||
            null;
        } catch {
          nextProfile = null;
        }
      }

      if (!isCurrent) return;
      setViolatorOverviewEstablishmentProfile(nextEstablishment);
      setViolatorOverviewProfile(nextProfile);
      setViolatorOverviewProfileKey(targetKey);
    };

    loadTargetOverviewProfile();

    return () => {
      isCurrent = false;
    };
  }, [violatorOverviewSourceTarget]);

  const reviewStandardsKey = useMemo(
    () => getReviewStandardsCacheKey(detail, query),
    [detail, query],
  );

  useEffect(() => {
    setReviewChecklistItems([]);
    setReviewStandardsLoadedKey('');
  }, [reviewStandardsKey]);

  const loadReviewDecisionData = useCallback(async (options: { force?: boolean } = {}) => {
    const violationId = getDetailViolationId(detail, query);
    const forceReload = options.force === true;
    if ((!violationId && !query.violationNo) || (!forceReload && reviewStandardsLoading)) return;
    if (
      !forceReload &&
      reviewStandardsLoadedKey === reviewStandardsKey
    ) {
      return;
    }

    const requestId = reviewStandardsRequestRef.current + 1;
    reviewStandardsRequestRef.current = requestId;
    if (forceReload) {
      setReviewChecklistItems([]);
      setReviewStandardsLoadedKey('');
    }
    setReviewStandardsLoading(true);
    try {
      const nextDetail = forceReload ? await loadViolationDetailPayload() : detail;
      if (requestId !== reviewStandardsRequestRef.current) return;

      const effectiveDetail = nextDetail || detail;
      if (forceReload) {
        setDetail(nextDetail || null);
      }

      const violationTypeId = getDisplayValue(getDetailViolationTypeId(effectiveDetail), '');
      const checklistResponse = violationTypeId
        ? await getInspectionChecklistTemplateItems({ violationTypeId, includeInactive: false })
        : [];
      const nextChecklistItems = ensureArray<InspectionChecklistTemplateCatalogItem>(
        unwrapPayload<InspectionChecklistTemplateCatalogItem[]>(checklistResponse),
      );

      if (requestId !== reviewStandardsRequestRef.current) return;
      setReviewChecklistItems(nextChecklistItems);
      setReviewStandardsLoadedKey(getReviewStandardsCacheKey(effectiveDetail, query));
    } catch {
      if (requestId !== reviewStandardsRequestRef.current) return;
      CustomMessage.error(t('inspection.violation.messages.standardsLoadFailed'));
    } finally {
      if (requestId === reviewStandardsRequestRef.current) {
        setReviewStandardsLoading(false);
      }
    }
  }, [
    detail,
    loadViolationDetailPayload,
    query,
    reviewStandardsKey,
    reviewStandardsLoadedKey,
    reviewStandardsLoading,
    t,
  ]);

  const normalizedStatus = getDetailStatus(detail, query.status);
  const isLicensingViolation = useMemo(
    () => isLicensingViolationDetail(detail, query.type),
    [detail, query.type],
  );
  const reportedViolations = useMemo(
    () => buildDetailReportedViolations(detail, isLicensingViolation),
    [detail, isLicensingViolation],
  );
  const reviewViolationItems = useMemo(
    () => buildReviewViolationItems(reviewChecklistItems),
    [reviewChecklistItems],
  );
  const reviewDetailViolationItems = useMemo(
    () => buildReviewDetailViolationItems(detail, reviewViolationItems),
    [detail, reviewViolationItems],
  );
  const selectedReviewViolationRows = useMemo(
    () => getSelectedReviewViolationRows(reviewViolationItems, reviewDetailViolationItems, selectedViolationKeys),
    [reviewDetailViolationItems, reviewViolationItems, selectedViolationKeys],
  );
  const showContentReviewReport = shouldShowContentReviewReport(detail);
  const violatorOverview = useMemo<ViolatorOverviewData>(
    () => detail?.violatorOverview || {
      fields: [
        {
          label: translateViolation('detail.establishmentName'),
          value: getDisplayValue(detail?.violatorName, ''),
        },
        {
          label: translateViolation('detail.commercialLicenseNumber'),
          value: getDisplayValue(detail?.violatorIdentifier, ''),
        },
      ].filter((field) => field.value),
    },
    [detail],
  );
  const violatorOverviewSourceTargetKey = useMemo(
    () => getViolatorOverviewRecordKey(violatorOverviewSourceTarget),
    [violatorOverviewSourceTarget],
  );
  const canUseViolatorOverviewProfileData = Boolean(violatorOverviewSourceTargetKey) &&
    violatorOverviewProfileKey === violatorOverviewSourceTargetKey;
  const activeViolatorOverviewEstablishment = canUseViolatorOverviewProfileData
    ? violatorOverviewEstablishmentProfile
    : null;
  const activeViolatorOverviewProfile = canUseViolatorOverviewProfileData
    ? violatorOverviewProfile
    : null;
  const violatorOverviewData = useMemo<TargetOverviewData>(() => {
    const target = (violatorOverviewSourceTarget || {}) as Partial<ViolatorOverviewTarget>;
    const targetOverview = (detail?.targetOverview || {}) as Record<string, any>;
    const targetStatusLabel = getDisplayValue(activeViolatorOverviewProfile?.profileStatusObj?.nameEn);
    const isIndividualTarget = isProfileAndApplicantIndividual(activeViolatorOverviewProfile) ||
      (!isProfileAndApplicantCommercial(activeViolatorOverviewProfile) && isInspectionTargetIndividual(target));

    if (isIndividualTarget) {
      const targetName = getDisplayValue(
        activeViolatorOverviewProfile?.personalName ?? detail?.violatorName,
      );
      const identity = resolveInspectionOverviewIdentity(activeViolatorOverviewProfile);
      const identityLabels = {
        'applicationOverviewCards.emiratesId': t('applicationOverviewCards.emiratesId'),
        'applicationOverviewCards.passport': t('applicationOverviewCards.passport'),
        'applicationOverviewCards.uid': t('applicationOverviewCards.uid'),
      };

      return {
        profileType: localizeProfileTypeLabel(getViolatorOverviewProfileTypeLabel(target.targetType || 2)),
        selfMonitorProgram: activeViolatorOverviewProfile?.selfMonitorProgram,
        statusLabel: localizeProfileStatusLabel(targetStatusLabel),
        statusCode: activeViolatorOverviewProfile?.profileStatusObj?.id,
        statusTone: getTargetOverviewStatusTone(targetStatusLabel),
        fields: [
          {
            label: t('applicationOverviewCards.fullName'),
            value: targetName,
            secondary: getDifferentSecondaryOverviewText(targetName, activeViolatorOverviewProfile?.personalNameAr),
          },
          ...(identity ? [{ label: identityLabels[identity.labelKey], value: identity.value }] : []),
        ],
        statistics: [
          {
            key: 'documents',
            icon: 'documents',
            label: t('applicationOverviewCards.documents'),
            count: getOverviewCountDisplayValue(activeViolatorOverviewProfile?.documentCount),
          },
        ],
        alerts: [
          {
            key: 'warnings',
            label: translateViolation('detail.warningsViolations'),
            count: getOverviewCountDisplayValue(targetOverview.violationCount),
            tone: 'danger',
          },
          {
            key: 'fines',
            label: translateViolation('detail.unpaidFines'),
            count: getOverviewCountDisplayValue(targetOverview.unpayCount),
            tone: 'warning',
          },
        ],
      };
    }

    const targetName = getDisplayValue(
      activeViolatorOverviewProfile?.establishmentName ??
        activeViolatorOverviewEstablishment?.nameEn ??
        detail?.violatorName,
    );

    return {
      profileType: localizeProfileTypeLabel(getViolatorOverviewProfileTypeLabel(target.targetType || 1)),
      selfMonitorProgram: activeViolatorOverviewProfile?.selfMonitorProgram,
      statusLabel: localizeProfileStatusLabel(targetStatusLabel),
      statusCode: activeViolatorOverviewProfile?.profileStatusObj?.id,
      statusTone: getTargetOverviewStatusTone(targetStatusLabel),
      fields: [
        {
          label: translateViolation('detail.establishmentName'),
          value: targetName,
          secondary: getDifferentSecondaryOverviewText(targetName, activeViolatorOverviewEstablishment?.nameAr),
        },
        {
          label: translateViolation('detail.commercialLicenseNumber'),
          value: getDisplayValue(
            activeViolatorOverviewProfile?.licenseNumber ??
              activeViolatorOverviewEstablishment?.licenseNumber ??
              detail?.violatorIdentifier,
          ),
        },
      ],
      statistics: [
        {
          key: 'documents',
          icon: 'documents',
          label: translateViolation('detail.documents'),
          count: getOverviewCountDisplayValue(activeViolatorOverviewEstablishment?.documentsCount),
        },
        {
          key: 'partners',
          icon: 'partners',
          label: translateViolation('detail.partners'),
          count: getOverviewCountDisplayValue(activeViolatorOverviewEstablishment?.partnersCount),
        },
      ],
      alerts: [
        {
          key: 'warnings',
          label: translateViolation('detail.warningsViolations'),
          count: getOverviewCountDisplayValue(targetOverview.violationCount),
          tone: 'danger',
        },
        {
          key: 'fines',
          label: translateViolation('detail.unpaidFines'),
          count: getOverviewCountDisplayValue(targetOverview.unpayCount),
          tone: 'warning',
        },
      ],
    };
  }, [
    activeViolatorOverviewEstablishment,
    activeViolatorOverviewProfile,
    detail,
    t,
    violatorOverviewSourceTarget,
  ]);
  const violatorOverviewTarget = useMemo<Partial<ViolatorOverviewTarget>>(
    () => violatorOverviewSourceTarget || {},
    [violatorOverviewSourceTarget],
  );
  const violatorOverviewFullScreenType = useMemo<ViolatorOverviewFullScreenType>(
    () => {
      if (isProfileAndApplicantIndividual(activeViolatorOverviewProfile)) return 'Individual';
      if (isProfileAndApplicantCommercial(activeViolatorOverviewProfile)) return 'Commercial';
      return isInspectionTargetIndividual(violatorOverviewTarget) ? 'Individual' : 'Commercial';
    },
    [activeViolatorOverviewProfile, violatorOverviewTarget],
  );
  const violatorOverviewEstablishmentData = useMemo(
    () => activeViolatorOverviewEstablishment || undefined,
    [activeViolatorOverviewEstablishment],
  );
  const violatorOverviewApplicantData = useMemo<IUserIndividualProfile | undefined>(() => {
    if (violatorOverviewFullScreenType !== 'Individual') return undefined;
    const identity = resolveInspectionOverviewIdentity(activeViolatorOverviewProfile);

    return {
      type: identity?.field === 'emiratesId' ? 1 : identity?.field === 'passportNumber' ? 3 : 2,
      profileCode: '',
      userId: String(activeViolatorOverviewProfile?.userId || violatorOverviewTarget.userId || ''),
      proFileId: getOptionalNumber(
        activeViolatorOverviewProfile?.userProfileId ||
          violatorOverviewTarget.profileId ||
          violatorOverviewTarget.individualId,
      ) || 0,
      rejectReason: null,
      dateOfBirth: '',
      passportNumber: identity?.field === 'passportNumber' ? identity.value : '',
      uid: identity?.field === 'uid' ? identity.value : '',
      email: String(
        activeViolatorOverviewProfile?.personalEmail ||
          activeViolatorOverviewProfile?.userEmail ||
          '',
      ),
      mobileNumber: String(
        activeViolatorOverviewProfile?.personalPhoneNumber ||
          activeViolatorOverviewProfile?.phoneNumber ||
          '',
      ),
      emiratesId: identity?.field === 'emiratesId' ? identity.value : '',
      fullNameAr: String(activeViolatorOverviewProfile?.personalNameAr || ''),
      fullNameEn: getDisplayValue(
        activeViolatorOverviewProfile?.personalName ??
          activeViolatorOverviewProfile?.userName ??
          detail?.violatorName,
        '',
      ),
      nationalityId: getOptionalNumber(activeViolatorOverviewProfile?.nationalityObj?.id) || 0,
      nationalityInfo: {
        id: getOptionalNumber(activeViolatorOverviewProfile?.nationalityObj?.id) || 0,
        code: '',
        nameEn: String(activeViolatorOverviewProfile?.nationalityObj?.nameEn || ''),
        nameAr: String(activeViolatorOverviewProfile?.nationalityObj?.nameAr || ''),
      },
      genderId: 0,
      genderInfo: { id: 0, code: '', nameEn: '', nameAr: '' },
      passportExpiryDate: '',
      emiratesIdexpiryDate: '',
      occupation: '',
      personalPhotoUrl: '',
      passportCopyUrl: '',
      emiratesIdCopyUrl: '',
      visaCopyUrl: '',
      visaExpiryDate: '',
      emirateId: 0,
      emirateInfo: { id: 0, code: '', nameEn: '', nameAr: '' },
      regionId: 0,
      regionInfo: { id: 0, code: '', nameEn: '', nameAr: '' },
      areaId: 0,
      areaInfo: { id: 0, code: '', nameEn: '', nameAr: '' },
      street: '',
      proFileStatus: {
        id: getOptionalNumber(activeViolatorOverviewProfile?.profileStatusObj?.id) || 0,
        code: '',
        nameEn: String(activeViolatorOverviewProfile?.profileStatusObj?.nameEn || ''),
        nameAr: String(activeViolatorOverviewProfile?.profileStatusObj?.nameAr || ''),
      },
      documents: getOptionalNumber(activeViolatorOverviewProfile?.documentCount) || 0,
    };
  }, [
    activeViolatorOverviewProfile,
    detail,
    violatorOverviewFullScreenType,
    violatorOverviewTarget,
  ]);
  const violatorOverviewProfileAndApplicantData = useMemo(() => {
    if (activeViolatorOverviewProfile) return activeViolatorOverviewProfile;
    return undefined;
  }, [activeViolatorOverviewProfile]);
  const violatorOverviewUserId = useMemo(
    () => normalizeOptionalId(activeViolatorOverviewProfile?.userId) ||
      normalizeOptionalId(violatorOverviewTarget.userId),
    [activeViolatorOverviewProfile, violatorOverviewTarget],
  );
  const violatorOverviewProfileId = useMemo(() => {
    if (violatorOverviewFullScreenType === 'Individual') {
      return normalizeOptionalId(violatorOverviewTarget.profileId) ||
        normalizeOptionalId(violatorOverviewTarget.individualId);
    }

    return normalizeOptionalId(activeViolatorOverviewEstablishment?.userProfileId) ||
      normalizeOptionalId(violatorOverviewTarget.profileId);
  }, [activeViolatorOverviewEstablishment, violatorOverviewFullScreenType, violatorOverviewTarget]);
  const violatorOverviewEstablishmentId = useMemo(() => {
    if (violatorOverviewFullScreenType === 'Individual') return undefined;
    return normalizeOptionalId(violatorOverviewTarget.establishmentId);
  }, [violatorOverviewFullScreenType, violatorOverviewTarget]);
  const violatorOverviewIndividualId = useMemo(() => {
    if (violatorOverviewFullScreenType !== 'Individual') return undefined;
    return normalizeOptionalId(violatorOverviewTarget.individualId);
  }, [violatorOverviewFullScreenType, violatorOverviewTarget]);
  const relatedReinspection = useMemo(
    () => detail?.relatedReinspection || null,
    [detail],
  );
  const openRelatedReinspectionTask = useCallback((item: RelatedReinspection) => {
    history.push(buildInspectionPath(INSPECTION_PATHS.taskDetail, location.search, {
      [INSPECTION_QUERY_KEYS.from]: 'violationDetail',
      [INSPECTION_QUERY_KEYS.tab]: null,
      [INSPECTION_QUERY_KEYS.teamTab]: null,
      [INSPECTION_QUERY_KEYS.taskId]: item.taskId ? String(item.taskId) : null,
      [INSPECTION_QUERY_KEYS.taskNo]: item.taskNo || null,
      [INSPECTION_QUERY_KEYS.visitId]: null,
      [INSPECTION_QUERY_KEYS.step]: null,
      [INSPECTION_QUERY_KEYS.mode]: null,
      [INSPECTION_QUERY_KEYS.reportNo]: null,
      [INSPECTION_QUERY_KEYS.violationId]: query.violationId || null,
      [INSPECTION_QUERY_KEYS.violationNo]: query.violationNo || null,
      [INSPECTION_QUERY_KEYS.status]: query.status || null,
      [INSPECTION_QUERY_KEYS.type]: query.type || null,
    }));
  }, [history, location.search, query.status, query.type, query.violationId, query.violationNo]);
  const relatedAppeal = useMemo(
    () => detail?.relatedAppeal || null,
    [detail],
  );
  const violationTimeline = useMemo(
    () => buildViolationTimeline(detail),
    [detail],
  );
  const committeeDecision = useMemo(
    () => detail?.committeeDecision || null,
    [detail],
  );
  const committeeDecisionRows = useMemo(
    () => buildCommitteeDecisionRows(detail),
    [detail],
  );
  const showCommitteeReviewDecision = useMemo(
    () => shouldShowCommitteeReviewDecision(detail, isLicensingViolation),
    [detail, isLicensingViolation],
  );
  const showCommitteeDecisionOnAppeal = useMemo(
    () => shouldShowCommitteeDecisionOnAppeal(detail),
    [detail],
  );
  const appealDecisionRows = useMemo(
    () => buildAppealDecisionRows(detail),
    [detail],
  );
  const committeeDecisionNote = useMemo(
    () => getCommitteeDecisionNote(detail),
    [detail],
  );
  const committeeDecisionAction = useMemo(
    () => getCommitteeDecisionAction(detail, committeeDecisionRows),
    [committeeDecisionRows, detail],
  );
  const committeeDecisionBy = useMemo(
    () => getCommitteeDecisionBy(detail),
    [detail],
  );
  const appealCommitteeNotes = useMemo(
    () => getAppealCommitteeNotes(detail),
    [detail],
  );
  const appealDecisionAction = useMemo(
    () => getAppealDecisionAction(detail),
    [detail],
  );
  const appealActionBy = useMemo(
    () => getAppealActionBy(detail),
    [detail],
  );
  const paymentDetails = useMemo(
    () => detail?.paymentDetails || null,
    [detail],
  );
  const appealDetails = useMemo(
    () => detail?.appealDetails || null,
    [detail],
  );
  const fineDetailRows = useMemo(
    () => buildFineDetailRows({
      detail,
      reportedViolations,
      committeeDecision,
      paymentDetails,
      appealDetails,
      isLicensingViolation,
    }),
    [appealDetails, committeeDecision, detail, isLicensingViolation, paymentDetails, reportedViolations],
  );
  const fineDetailsTotalAmount = useMemo(
    () => detail?.fineAmount,
    [detail?.fineAmount],
  );
  const showFineDetails = shouldShowFineDetails(
    detail,
    query.status,
    fineDetailRows,
    isLicensingViolation,
  );
  const showFineCountColumn = isLicensingViolation;
  const hideLicensingFineAmountDegreeLabel = isLicensingViolation && showFineDetails;
  const reportedViolationDisplayConfig = useMemo(
    () => getReportedViolationDisplayConfig(normalizedStatus, isLicensingViolation),
    [isLicensingViolation, normalizedStatus],
  );
  const footerActions = useMemo(
    () => getDetailFooterActions(detail),
    [detail],
  );
  const showDetailFooter = Boolean(
    detail &&
      !expandedPreview,
  );
  const cancelViolationIsPaid = useMemo(
    () => isPaidViolation(normalizedStatus, paymentDetails),
    [normalizedStatus, paymentDetails],
  );
  const originalAssociatedViolationKeys = useMemo(
    () => getInitialSelectedViolationKeys(reviewDetailViolationItems),
    [reviewDetailViolationItems],
  );
  const initialReviewItemNotes = useMemo(
    () => buildReviewInitialItemNotes(reviewDetailViolationItems),
    [reviewDetailViolationItems],
  );
  const initialReviewItemAttachments = useMemo(
    () => buildReviewInitialItemAttachments(reviewDetailViolationItems),
    [reviewDetailViolationItems],
  );
  const syncReviewDecisionSelection = useCallback(() => {
    const keys = originalAssociatedViolationKeys;
    setSelectedViolationKeys(keys);
    setModifyDraftKeys(keys);
    setDegreeSelections({});
    setReviewItemNotes(initialReviewItemNotes);
    setReviewItemAttachments(initialReviewItemAttachments);
    setReviewItemUploading({});
  }, [initialReviewItemAttachments, initialReviewItemNotes, originalAssociatedViolationKeys]);
  const openReviewDecisionModal = useCallback(() => {
    syncReviewDecisionSelection();
    pendingReviewSelectionResetRef.current = true;
    setReviewDecideVisible(true);
    loadReviewDecisionData({ force: true });
  }, [loadReviewDecisionData, syncReviewDecisionSelection]);
  const topSummaryItems = useMemo<TopSummaryItem[]>(() => {
    const items: TopSummaryItem[] = [
      {
        label: t('inspection.violation.detail.violationNumber'),
        value: getDisplayValue(detail?.violationNo || query.violationNo),
        icon: inspectionFigmaAssets.topSummaryIcons[0],
      },
      {
        label: t('inspection.violation.detail.type'),
        value: getViolationTypeLabel(detail, query.type),
        icon: inspectionFigmaAssets.topSummaryIcons[3],
      },
      {
        label: t('inspection.violation.detail.status'),
        value: getViolationStatusLabel(normalizedStatus),
        status: normalizedStatus,
        icon: inspectionFigmaAssets.topSummaryIcons[1],
      },
    ];

    if (SLA_VISIBLE_STATUSES.has(normalizedStatus)) {
      items.push({
        label: t('inspection.violation.detail.sla'),
        value: getSlaText(detail),
        icon: inspectionFigmaAssets.topSummaryIcons[4],
      });
    }

    items.push({
      label: t('inspection.violation.detail.creationTime'),
      value: formatDateTime(detail?.createdOn || detail?.lastUpdatedOn, '-'),
      icon: inspectionFigmaAssets.topSummaryIcons[2],
    });

    return items;
  }, [detail, normalizedStatus, query.type, query.violationNo, t]);

  useEffect(() => {
    if (
      !pendingReviewSelectionResetRef.current ||
      reviewStandardsLoading ||
      reviewStandardsLoadedKey !== reviewStandardsKey
    ) {
      return;
    }

    syncReviewDecisionSelection();
    pendingReviewSelectionResetRef.current = false;
  }, [
    reviewStandardsKey,
    reviewStandardsLoadedKey,
    reviewStandardsLoading,
    syncReviewDecisionSelection,
  ]);

  const violationInfoItems = useMemo<DetailItem[]>(() => {
    const violatorField = violatorOverview.fields?.find((item) => (
      normalizeDisplayTextKey(item.label) === 'establishment name' ||
        normalizeDisplayTextKey(item.label) === normalizeDisplayTextKey(t('inspection.violation.detail.establishmentName'))
    ));
    const violatorName =
      getLocalizedText(violatorField?.value, violatorField?.secondary, '') ||
      detail?.inspectionTarget?.establishmentNameEn ||
      detail?.establishmentNameEn;

    return [
      {
        key: 'violator',
        label: t('inspection.violation.detail.violator'),
        value: getDisplayValue(violatorName),
      },
      {
        key: 'reportedBy',
        label: t('inspection.violation.detail.reportedBy'),
        value: getDisplayValue(detail?.reportedByName),
      },
      {
        key: 'sourceTask',
        label: t('inspection.violation.detail.sourceTask'),
        value: getDisplayValue(detail?.sourceTaskNo || detail?.taskNo),
        primary: true,
      },
      {
        key: 'fineAmount',
        label: <FineAmountAedLabel />,
        value: getFineAmountLabel(detail?.fineAmount),
      },
    ];
  }, [detail, t, violatorOverview.fields]);

  const toggleMainSection = (key: SectionKey) => {
    setMainSectionState((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleSideSection = (key: SideSectionKey) => {
    setSideSectionState((current) => ({ ...current, [key]: !current[key] }));
  };

  const closeExpandedPreview = useCallback(() => {
    setExpandedPreview(null);
    setViolatorOverviewQuickNav(DEFAULT_VIOLATOR_OVERVIEW_QUICK_NAV);
  }, []);

  const openViolatorOverviewFullScreen = useCallback((target?: Partial<ViolatorOverviewQuickNavTarget>) => {
    setViolatorOverviewQuickNav(
      createOverviewQuickNavTarget(
        target,
        DEFAULT_VIOLATOR_OVERVIEW_QUICK_NAV.initialTab,
      ),
    );
    setExpandedPreview('violatorOverview');
  }, []);

  const handleViolatorOverviewStatisticClick = useCallback(
    (key: string) => {
      if (key === 'documents') {
        openViolatorOverviewFullScreen({
          initialTab: 'basic-information',
          scrollToDocuments: true,
        });
        return;
      }

      if (key === 'partners') {
        openViolatorOverviewFullScreen({
          initialTab: 'basic-information',
          scrollToPartners: true,
        });
        return;
      }

      openViolatorOverviewFullScreen();
    },
    [openViolatorOverviewFullScreen],
  );

  const handleViolatorOverviewAlertClick = useCallback(
    (key: string) => {
      if (key === 'warnings' || key === 'unpaidFines' || key === 'fines') {
        openViolatorOverviewFullScreen({
          initialTab: 'violations-fines',
        });
        return;
      }

      openViolatorOverviewFullScreen();
    },
    [openViolatorOverviewFullScreen],
  );

  const renderViolatorOverviewContent = useCallback(() => (
    <TargetOverviewCard
      data={violatorOverviewData}
      onStatisticClick={handleViolatorOverviewStatisticClick}
      onAlertClick={handleViolatorOverviewAlertClick}
    />
  ), [
    handleViolatorOverviewAlertClick,
    handleViolatorOverviewStatisticClick,
    violatorOverviewData,
  ]);

  const beginActionSubmission = useCallback(() => {
    if (actionSubmittingRef.current) return false;
    actionSubmittingRef.current = true;
    setActionSubmitting(true);
    return true;
  }, []);

  const endActionSubmission = useCallback(() => {
    actionSubmittingRef.current = false;
    setActionSubmitting(false);
  }, []);

  const runStatusUpdate = useCallback(async ({
    status,
    successMessage,
    payload,
  }: {
    status: InspectionViolationStatus;
    successMessage: string;
    payload?: Record<string, unknown>;
  }) => {
    const violationId = getDetailViolationId(detail, query);
    if (!violationId) {
      CustomMessage.error(t('inspection.violation.messages.missingViolationId'));
      return false;
    }

    if (!beginActionSubmission()) return false;

    try {
      await updateInspectionViolationStatus({
        violationId,
        status,
        ...(payload || {}),
      });
      await fetchDetail();
      CustomMessage.success(successMessage);
      return true;
    } catch {
      CustomMessage.error(t('inspection.violation.messages.updateFailed'));
      return false;
    } finally {
      endActionSubmission();
    }
  }, [beginActionSubmission, detail, endActionSubmission, fetchDetail, query, t]);

  const handleBack = useCallback(() => {
    const dashboardReturnState = readDashboardReturnState(location.state);

    if (dashboardReturnState) {
      history.push(createDashboardReturnLocation(dashboardReturnState));
      return;
    }

    if (
      teamTaskDetailContext.isTeamManagementSource &&
      teamTaskDetailContext.teamManagementScope
    ) {
      if (readTeamManagementReturnLocation(location.state)) {
        history.goBack();
        return;
      }

      const teamManagementPath = getTeamManagementScopeConfigByScope(
        teamTaskDetailContext.teamManagementScope,
      ).routePath;

      history.push(teamManagementPath, {
        [KEEP_ALIVE_RESTORE_STATE_KEY]: true,
      });
      return;
    }

    if (query.from === 'violations' || !query.from) {
      history.push(INSPECTION_PATHS.violations, {
        [KEEP_ALIVE_RESTORE_STATE_KEY]: true,
      });
      return;
    }

    history.goBack();
  }, [
    history,
    location.state,
    query.from,
    teamTaskDetailContext.isTeamManagementSource,
    teamTaskDetailContext.teamManagementScope,
  ]);

  const handleSubmitReportCancel = useCallback(() => {
    if (actionSubmittingRef.current) return;
    setSubmitReportVisible(false);
  }, []);

  const handleReviewDecideCancel = useCallback(() => {
    if (actionSubmittingRef.current) return;
    setReviewDecideVisible(false);
  }, []);

  const handleSubmitReport = useCallback(async ({ summary, files }: SubmitReportPayload) => {
    const attachments = files.map((file, index) => ({
      key: file.fileUrl || `report-${index}`,
      name: getDisplayValue(file.fileName, `Content_Review_Report_${index + 1}.pdf`),
      url: String(file.fileUrl || ''),
      type: getAttachmentFileType(file),
    }));

    const success = await runStatusUpdate({
      status: 'PENDING_REVIEW',
      successMessage: t('inspection.violation.messages.contentReviewSubmitted'),
      payload: {
        action: 'submit_report',
        remark: summary,
        contentReviewReport: {
          summary,
          attachments,
        },
      },
    });
    if (success) {
      setSubmitReportVisible(false);
    }
  }, [runStatusUpdate, t]);

  const handleDegreeChange = useCallback((key: string, value: FineDegreeValue) => {
    setDegreeSelections((current) => ({ ...current, [key]: value }));
  }, []);

  const handleReviewItemNoteChange = useCallback((key: string, value: string) => {
    setReviewItemNotes((current) => ({ ...current, [key]: value }));
  }, []);

  const handleReviewItemAttachmentsChange = useCallback((
    key: string,
    attachments: InspectionTaskAttachmentPayload[],
  ) => {
    setReviewItemAttachments((current) => ({ ...current, [key]: attachments }));
  }, []);

  const handleReviewItemUploadingChange = useCallback((key: string, uploading: boolean) => {
    setReviewItemUploading((current) => (
      current[key] === uploading ? current : { ...current, [key]: uploading }
    ));
  }, []);

  const handleOpenModifyViolation = useCallback(() => {
    loadReviewDecisionData({ force: true });
    setModifyDraftKeys(selectedViolationKeys);
    setReviewDecideVisible(false);
    setModifyViolationVisible(true);
  }, [loadReviewDecisionData, selectedViolationKeys]);

  const handleCancelModifyViolation = useCallback(() => {
    setModifyDraftKeys(selectedViolationKeys);
    setModifyViolationVisible(false);
    setReviewDecideVisible(true);
  }, [selectedViolationKeys]);

  const handleResetModifyViolation = useCallback(() => {
    setModifyDraftKeys(originalAssociatedViolationKeys);
  }, [originalAssociatedViolationKeys]);

  const handleToggleModifyViolation = useCallback((key: string, checked: boolean) => {
    if (checked) {
      setModifyDraftKeys((current) => (current.includes(key) ? current : [...current, key]));
      return;
    }

    if (originalAssociatedViolationKeys.includes(key)) {
      setPendingDeselectKey(key);
      setDeselectConfirmVisible(true);
      return;
    }

    setModifyDraftKeys((current) => current.filter((item) => item !== key));
  }, [originalAssociatedViolationKeys]);

  const handleConfirmDeselectViolation = useCallback(() => {
    if (pendingDeselectKey) {
      setModifyDraftKeys((current) => current.filter((item) => item !== pendingDeselectKey));
    }
    setPendingDeselectKey(null);
    setDeselectConfirmVisible(false);
  }, [pendingDeselectKey]);

  const handleRejectDeselectViolation = useCallback(() => {
    setPendingDeselectKey(null);
    setDeselectConfirmVisible(false);
  }, []);

  const handleSaveModifyViolation = useCallback(() => {
    if (reviewStandardsLoading) {
      CustomMessage.warning(t('inspection.violation.messages.reasonsLoading'));
      return;
    }
    const reviewViolationKeys = new Set(reviewViolationItems.map((item) => item.key));
    const nextSelectedKeys = modifyDraftKeys.filter((key) => reviewViolationKeys.has(key));
    if (!nextSelectedKeys.length) {
      CustomMessage.warning(t('inspection.violation.messages.selectAtLeastOneReason'));
      return;
    }

    setModifyDraftKeys(nextSelectedKeys);
    setSelectedViolationKeys(nextSelectedKeys);
    setDegreeSelections((current) => nextSelectedKeys.reduce<Record<string, FineDegreeValue>>((next, key) => {
      if (current[key]) {
        next[key] = current[key];
      }
      return next;
    }, {}));
    setReviewItemNotes((current) => pickReviewRecordByKeys(current, nextSelectedKeys));
    setReviewItemAttachments((current) => pickReviewRecordByKeys(current, nextSelectedKeys));
    setReviewItemUploading((current) => pickReviewRecordByKeys(current, nextSelectedKeys));
    setModifyViolationVisible(false);
    setReviewDecideVisible(true);
  }, [modifyDraftKeys, reviewStandardsLoading, reviewViolationItems, t]);

  const handleConfirmReviewDecision = useCallback(async () => {
    if (reviewStandardsLoading) {
      CustomMessage.warning(t('inspection.violation.messages.standardsLoading'));
      return;
    }
    if (!selectedViolationKeys.length) {
      CustomMessage.warning(t('inspection.violation.messages.selectAtLeastOneReason'));
      return;
    }
    const missingDegreeSelection = selectedViolationKeys.some((key) => !degreeSelections[key]);
    if (missingDegreeSelection) {
      CustomMessage.warning(t('inspection.violation.messages.selectDegreeForEachReason'));
      return;
    }
    const selectedViolationRows = selectedReviewViolationRows;
    const hasUploadingAttachments = selectedViolationRows.some((item) => reviewItemUploading[item.key]);
    if (hasUploadingAttachments) {
      CustomMessage.warning(t('inspection.violation.messages.waitForCommitteeAttachments'));
      return;
    }
    const missingCommitteeEvidence = selectedViolationRows.some((item) => (
      !String(reviewItemNotes[item.key] || '').trim() ||
        !(reviewItemAttachments[item.key] || []).length
    ));
    if (missingCommitteeEvidence) {
      CustomMessage.warning(t('inspection.violation.messages.completeCommitteeEvidenceForEachReason'));
      return;
    }
    const decisionItems = selectedViolationRows
      .map((item) => buildDecisionItemPayload(
        item,
        degreeSelections[item.key],
        reviewItemNotes[item.key] || '',
        reviewItemAttachments[item.key] || [],
      ))
      .filter(Boolean) as DecideInspectionViolationItemPayload[];
    if (decisionItems.length !== selectedViolationRows.length) {
      CustomMessage.warning(t('inspection.violation.messages.completeCommitteeEvidenceForEachReason'));
      return;
    }

    const success = await runStatusUpdate({
      status: 'PENDING_APPROVAL',
      successMessage: t('inspection.violation.messages.committeeDecisionSubmitted'),
      payload: {
        action: 'review_decide',
        remark: '',
        committeeDecisionTypeId: 2,
        committeeDecisionNote: '',
        items: decisionItems,
      },
    });
    if (success) {
      setReviewDecideVisible(false);
    }
  }, [
    degreeSelections,
    reviewItemAttachments,
    reviewItemNotes,
    reviewItemUploading,
    reviewStandardsLoading,
    runStatusUpdate,
    selectedReviewViolationRows,
    selectedViolationKeys,
    t,
  ]);

  const handleCancelViolation = useCallback(async ({ note }: CancelViolationPayload) => {
    const success = await runStatusUpdate({
      status: 'CANCELLED',
      successMessage: t('inspection.violation.messages.violationCancelled'),
      payload: {
        action: 'cancel',
        remark: note,
        committeeDecisionTypeId: 3,
        committeeDecisionNote: note,
        items: [],
      },
    });
    if (success) {
      setCancelViolationVisible(false);
      setReviewDecideVisible(false);
    }
  }, [runStatusUpdate, t]);

  const handleApproveViolation = useCallback(async () => {
    const violationId = getDetailViolationId(detail, query);
    if (!violationId) {
      CustomMessage.error(t('inspection.violation.messages.missingViolationId'));
      return;
    }

    if (!beginActionSubmission()) return;

    try {
      await approveInspectionViolation(violationId);
      await fetchDetail();
      setApproveSuccessModalVisible(true);
    } catch {
      CustomMessage.error(t('inspection.violation.messages.updateFailed'));
    } finally {
      endActionSubmission();
    }
  }, [beginActionSubmission, detail, endActionSubmission, fetchDetail, query, t]);

  const handleDownloadViolationReport = useCallback(async () => {
    const reportUrl = detail?.violationReportUrl;
    if (!reportUrl) {
      CustomMessage.error(t('inspection.violation.messages.reportUnavailable'));
      return;
    }

    if (!beginActionSubmission()) return;

    try {
      const downloaded = await downloadInspectionViolationReport(reportUrl);
      if (!downloaded) {
        CustomMessage.error(t('inspection.violation.messages.reportUnavailable'));
      }
    } catch {
      CustomMessage.error(t('inspection.violation.messages.reportDownloadFailed'));
    } finally {
      endActionSubmission();
    }
  }, [beginActionSubmission, detail?.violationReportUrl, endActionSubmission, t]);

  const closeApproveSuccessModal = useCallback(() => {
    setApproveSuccessModalVisible(false);
  }, []);

  const handleFooterAction = useCallback((action: InspectionViolationAction) => {
    if (action === 'download_report') {
      handleDownloadViolationReport();
      return;
    }

    if (action === 'transfer_content') {
      runStatusUpdate({
        status: 'PENDING_CONTENT_REPORT',
        successMessage: t('inspection.violation.messages.transferredToContent'),
        payload: {
          action,
          remark: DETAIL_ACTION_REMARKS[action],
        },
      });
      return;
    }

    if (action === 'transfer_committee') {
      runStatusUpdate({
        status: 'PENDING_COMMITTEE_DECISION',
        successMessage: t('inspection.violation.messages.transferredToCommittee'),
        payload: {
          action,
          remark: DETAIL_ACTION_REMARKS[action],
        },
      });
      return;
    }

    if (action === 'submit_report') {
      setSubmitReportVisible(true);
      return;
    }

    if (action === 'review_decide') {
      openReviewDecisionModal();
      return;
    }

    if (action === 'modify') {
      handleOpenModifyViolation();
      return;
    }

    if (action === 'cancel') {
      setCancelViolationVisible(true);
      return;
    }

    if (action === 'approve') {
      handleApproveViolation();
    }
  }, [handleApproveViolation, handleDownloadViolationReport, handleOpenModifyViolation, openReviewDecisionModal, runStatusUpdate, t]);

  useEffect(() => {
    const modeAction = normalizeInspectionViolationAction(query.mode);
    if (
      !detail ||
      !modeAction ||
      !DETAIL_MODE_ACTIONS.has(modeAction) ||
      !footerActions.includes(modeAction)
    ) {
      return;
    }

    const modeKey = `${getDetailViolationId(detail, query)}:${modeAction}:${normalizedStatus}`;
    if (openedActionModeRef.current === modeKey) {
      return;
    }
    openedActionModeRef.current = modeKey;

    handleFooterAction(modeAction);
    history.replace(
      buildInspectionPath(location.pathname, location.search, {
        [INSPECTION_QUERY_KEYS.mode]: null,
      }),
      location.state,
    );
  }, [
    detail,
    footerActions,
    handleFooterAction,
    history,
    location.pathname,
    location.search,
    location.state,
    normalizedStatus,
    query,
    query.mode,
  ]);

  const renderContentReviewReport = () => {
    const report = detail?.contentReviewReport || {};
    const attachments = report.attachments || [];

    return (
      <section className="inspection-violation-details__card">
        <ViolationDetailCardHeader
          title={t('inspection.violation.detail.contentReviewReport')}
          expanded={mainSectionState.contentReviewReport}
          onToggle={() => toggleMainSection('contentReviewReport')}
        />
        {mainSectionState.contentReviewReport ? (
          <div className="inspection-violation-details__card-content">
            <div className="inspection-violation-details__content-report-label">
              {t('inspection.violation.detail.reportSummary')}
            </div>
            <div className="inspection-violation-details__content-report-summary">
              {report.summary || '-'}
            </div>
            <div className="inspection-violation-details__content-report-label">
              {t('inspection.violation.detail.report')}
            </div>
            {attachments.length ? (
              <AttachmentGrid attachments={attachments} compact />
            ) : (
              <div className="inspection-violation-details__empty-text">-</div>
            )}
          </div>
        ) : null}
      </section>
    );
  };

  const renderFineDetails = () => (
    <section className="inspection-violation-details__card inspection-violation-details__fine-card">
      <h2 className="inspection-violation-details__fine-card-title">
        {t('inspection.violation.detail.fineDetails')}
      </h2>
      <FineDetailsTable
        rows={fineDetailRows}
        totalAmount={fineDetailsTotalAmount}
        showCountColumn={showFineCountColumn}
      />
    </section>
  );

  const renderCommitteeDecision = () => (
    <CommitteeReviewDecisionModule
      rows={committeeDecisionRows}
      appealRows={appealDecisionRows}
      reportedRows={reportedViolations}
      reportedDisplayConfig={reportedViolationDisplayConfig}
      isLicensingViolation={isLicensingViolation}
      showCommitteeReviewTab={showCommitteeReviewDecision}
      showAppealTab={showCommitteeDecisionOnAppeal}
      note={committeeDecisionNote}
      actionLabel={committeeDecisionAction}
      actionBy={committeeDecisionBy}
      appealNote={appealCommitteeNotes}
      appealActionLabel={appealDecisionAction}
      appealActionBy={appealActionBy}
      hideDefaultAmountDegreeLabels={hideLicensingFineAmountDegreeLabel}
    />
  );

  const renderExpandedPreview = useCallback(() => {
    if (expandedPreview !== 'violatorOverview') return null;

    return (
      <div className="inspection-violation-details__fullscreen-wrap inspection-violation-details__fullscreen-wrap--violator-overview">
        <div className="inspection-violation-details__violator-overview-fullscreen">
          <FullScreen
            type={violatorOverviewFullScreenType}
            applicant={violatorOverviewApplicantData}
            establishment={violatorOverviewEstablishmentData}
            userId={violatorOverviewUserId}
            profileId={violatorOverviewProfileId}
            targetEstablishmentId={violatorOverviewEstablishmentId}
            targetIndividualId={violatorOverviewIndividualId}
            targetTaskId={detail?.sourceTaskId || detail?.taskId}
            profileAndApplicantData={violatorOverviewProfileAndApplicantData}
            quickNav={violatorOverviewQuickNav}
            visualVariant="figmaOverview"
            preserveApplicantIdentity
            onClose={closeExpandedPreview}
          />
        </div>
      </div>
    );
  }, [
    closeExpandedPreview,
    detail?.sourceTaskId,
    detail?.taskId,
    expandedPreview,
    violatorOverviewApplicantData,
    violatorOverviewEstablishmentData,
    violatorOverviewEstablishmentId,
    violatorOverviewFullScreenType,
    violatorOverviewIndividualId,
    violatorOverviewProfileAndApplicantData,
    violatorOverviewProfileId,
    violatorOverviewQuickNav,
    violatorOverviewUserId,
  ]);

  return (
    <div
      className="inspection-violation-details"
      dir={i18n.resolvedLanguage === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="inspection-violation-details__scroll">
        {loading && !detail ? (
          <Card bordered={false} loading className="inspection-violation-details__loading-card" />
        ) : null}

        {!loading && !detail ? (
          <div className="inspection-violation-details__card inspection-violation-details__empty-card">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('inspection.violation.detail.noViolationDetail')}
            />
          </div>
        ) : null}

        {detail ? (
          <>
            <TopSummaryCard items={topSummaryItems} />
            {expandedPreview ? (
              renderExpandedPreview()
            ) : (
              <div className="inspection-violation-details__layout">
                <main className="inspection-violation-details__main">
                  <section
                    className="inspection-violation-details__card inspection-violation-details__card--responsive-first"
                  >
                    <ViolationDetailCardHeader
                      title={t('inspection.violation.detail.violationInformation')}
                      expanded={mainSectionState.violationInformation}
                      onToggle={() => toggleMainSection('violationInformation')}
                    />
                    {mainSectionState.violationInformation ? (
                      <div className="inspection-violation-details__card-content">
                        <DetailGrid items={violationInfoItems} />
                      </div>
                    ) : null}
                  </section>

                  {renderCommitteeDecision()}
                  {showFineDetails ? renderFineDetails() : null}
                  {showContentReviewReport ? renderContentReviewReport() : null}
                </main>

              <aside
                className={`inspection-violation-details__side ${
                  !relatedAppeal && !relatedReinspection
                    ? 'inspection-violation-details__side--two-cards'
                    : ''
                }`}
              >
                <div className="inspection-violation-details__side-column inspection-violation-details__side-column--primary">
                  <section
                    className="inspection-violation-details__card inspection-violation-details__card--responsive-second inspection-violation-details__side-card--overview"
                  >
                    <ViolationDetailCardHeader
                      title={t('inspection.violation.detail.violatorOverview')}
                      expanded={sideSectionState.violatorOverview}
                      onToggle={() => toggleSideSection('violatorOverview')}
                      showExpandIcon
                      onExpand={() => openViolatorOverviewFullScreen()}
                    />
                    {sideSectionState.violatorOverview ? (
                      <div className="inspection-violation-details__card-content">
                        {renderViolatorOverviewContent()}
                      </div>
                    ) : null}
                  </section>

                  <section
                    className="inspection-violation-details__card inspection-violation-details__card--responsive-fourth inspection-violation-details__side-card--timeline"
                  >
                    <ViolationDetailCardHeader
                      title={t('inspection.violation.detail.violationTimeline')}
                      expanded={sideSectionState.violationTimeline}
                      onToggle={() => toggleSideSection('violationTimeline')}
                    />
                    {sideSectionState.violationTimeline ? (
                      <div className="inspection-violation-details__card-content">
                        <ViolationTimeline
                          items={violationTimeline}
                          relatedReinspection={relatedReinspection}
                          onOpenRelatedInspection={openRelatedReinspectionTask}
                        />
                      </div>
                    ) : null}
                  </section>
                </div>

                <div className="inspection-violation-details__side-column inspection-violation-details__side-column--secondary">
                  {relatedAppeal ? (
                    <section className="inspection-violation-details__card inspection-violation-details__side-card--appeal">
                      <ViolationDetailCardHeader
                        title={t('inspection.violation.detail.relatedAppeal')}
                        expanded={sideSectionState.relatedAppeal}
                        onToggle={() => toggleSideSection('relatedAppeal')}
                      />
                      {sideSectionState.relatedAppeal ? (
                        <div className="inspection-violation-details__card-content">
                          <RelatedAppealCard data={relatedAppeal} />
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {relatedReinspection ? (
                    <section
                      className="inspection-violation-details__card inspection-violation-details__card--responsive-third inspection-violation-details__side-card--reinspection"
                    >
                      <ViolationDetailCardHeader
                        title={t('inspection.violation.detail.relatedReinspection')}
                        expanded={sideSectionState.relatedReinspection}
                        onToggle={() => toggleSideSection('relatedReinspection')}
                      />
                      {sideSectionState.relatedReinspection ? (
                        <div className="inspection-violation-details__card-content">
                          <RelatedReinspectionCard
                            data={relatedReinspection}
                            onOpenTask={openRelatedReinspectionTask}
                          />
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              </aside>
              </div>
            )}
          </>
        ) : null}
      </div>
      {showDetailFooter ? (
        <DetailFooter
          actions={footerActions}
          actionContent={
            teamTaskDetailContext.shouldHideDefaultActions ? (
              <TeamTaskDetailReassignAction
                renderTrigger={({ onClick, text }) => (
                  <Button
                    type="primary"
                    className="inspection-violation-details__footer-button inspection-violation-details__footer-button--primary"
                    onClick={onClick}
                  >
                    {text}
                  </Button>
                )}
              />
            ) : undefined
          }
          submitting={actionSubmitting}
          onBack={handleBack}
          onAction={handleFooterAction}
        />
      ) : null}
      <SubmitReportModal
        visible={submitReportVisible}
        submitting={actionSubmitting}
        onCancel={handleSubmitReportCancel}
        onSubmit={handleSubmitReport}
      />
      <ReviewDecideModal
        visible={reviewDecideVisible}
        violations={selectedReviewViolationRows}
        degreeSelections={degreeSelections}
        itemNotes={reviewItemNotes}
        itemAttachments={reviewItemAttachments}
        itemUploading={reviewItemUploading}
        loading={reviewStandardsLoading}
        submitting={actionSubmitting}
        onDegreeChange={handleDegreeChange}
        onItemNoteChange={handleReviewItemNoteChange}
        onItemAttachmentsChange={handleReviewItemAttachmentsChange}
        onItemUploadingChange={handleReviewItemUploadingChange}
        onModify={handleOpenModifyViolation}
        onCancelViolation={() => setCancelViolationVisible(true)}
        onCancel={handleReviewDecideCancel}
        onConfirm={handleConfirmReviewDecision}
      />
      <ModifyViolationModal
        visible={modifyViolationVisible}
        reportedViolations={reviewViolationItems}
        draftKeys={modifyDraftKeys}
        loading={reviewStandardsLoading}
        submitting={actionSubmitting}
        onToggle={handleToggleModifyViolation}
        onReset={handleResetModifyViolation}
        onCancel={handleCancelModifyViolation}
        onSave={handleSaveModifyViolation}
      />
      <DeselectViolationConfirmModal
        visible={deselectConfirmVisible}
        onNo={handleRejectDeselectViolation}
        onYes={handleConfirmDeselectViolation}
      />
      <CancelViolationModal
        visible={cancelViolationVisible}
        paid={cancelViolationIsPaid}
        submitting={actionSubmitting}
        onNo={() => setCancelViolationVisible(false)}
        onYes={handleCancelViolation}
      />
      <InspectionViolationApproveSuccessModal
        visible={approveSuccessModalVisible}
        onOk={closeApproveSuccessModal}
        onCancel={closeApproveSuccessModal}
      />
    </div>
  );
};

export default InspectionViolationDetailsPage;
