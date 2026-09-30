import { toApi, msUntil } from "@/utils/gstTime";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Input, Menu, Select, Table, Tabs } from 'antd';
import type { ColumnsType, TableProps } from 'antd/lib/table';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AedIcon from '@/assets/icons/Aed';
import { CustomMessage, PermissionGuard } from '@/components/common';
import { PERMISSION_CODES } from '@/constants/permissionCodes';
import PaginationTotal from '@/components/common/PaginationTotal';
import useKeepAliveActivated from '@/components/KeepAlive/useKeepAliveActivated';
import useKeepAliveRouteState from '@/components/KeepAlive/useKeepAliveRouteState';
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from '@/hooks/useResponsiveActionColumnWidth';
import { pxToRemValue } from '@/utils/rem';
import {
  approveInspectionViolation,
  exportInspectionViolations,
  getInspectionViolationReasonSummary,
  getInspectionViolationStats,
  getInspectionInspectors,
  getInspectionViolations,
  isInspectionDataMissingError,
  routeInspectionViolation,
  updateInspectionViolationStatus,
  type InspectionViolationRouteTargetCode,
  type InspectionViolationItem,
  type InspectionViolationStatus,
  type ViolationListData,
  type ViolationListParams,
  type ViolationSummaryMap,
} from '@/services/inspection';
import {
  buildInspectionPath,
  formatDateTime,
  formatNumber,
  getLocalizedText,
  getInspectionQuery,
  getViolationStatusLabel,
  normalizeViolationStatus,
} from '../InspectionCommon/helpers';
import { InspectionViolationStatusTag } from '../InspectionCommon/components';
import { INSPECTION_PATHS, INSPECTION_QUERY_KEYS, VIOLATION_STATUSES } from '../InspectionCommon/constants';
import { inspectionFigmaAssets } from '../InspectionCommon/assets';
import FilterCountBadge, {
  countAppliedFilters,
} from '@/components/common/FilterCountBadge';
import { getInspectionTargetIcon } from '../InspectionCommon/targetIcon';
import {
  hasAnyInspectionRole,
  INSPECTION_VIOLATION_ACTION_CONFIG,
  normalizeInspectionViolationActions,
  useInspectionAccess,
  type InspectionRole,
  type InspectionViolationAction,
} from '../InspectionCommon/access';
import InspectionViolationApproveSuccessModal from '../InspectionCommon/components/InspectionViolationApproveSuccessModal';
import { downloadBlobFile } from '../InspectionCommon/csvExport';
import { downloadInspectionViolationReport } from '../InspectionCommon/reportDownload';
import ViolationFilterModal, {
  type ViolationFilterOption,
  type ViolationFilterState,
} from './components/ViolationFilterModal';
import ViolationWorkflowModal, { type ViolationWorkflowModalValues } from './components/ViolationWorkflowModal';
import {
  getAvailableViolationWorkTabs,
  isViolationWorkTab,
  resolveViolationWorkTab,
  type ViolationWorkTab,
} from './workTabs';
import { useButtonPermission } from '@/routes/access';
import './index.less';

const unwrapPayload = <T,>(response: any): T => response?.data ?? response;
const getSelectPopupContainer = () => document.body;

const shouldIgnoreViolationRowClick = (event: React.MouseEvent<HTMLElement>) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;

  if (target.closest([
    'a',
    'button',
    'input',
    'textarea',
    'select',
    '[role="button"]',
    '.ant-dropdown-trigger',
    '.ant-select',
    '.inspection-violations__actions-cell',
    '.inspection-violations__action-trigger',
    '.inspection-violations__actions-column',
    '.inspection-violations__source-task-button',
    '.inspection-violations__source-task-column',
    '.ant-dropdown',
    '.ant-dropdown-menu',
    '.ant-dropdown-menu-item',
    '.ant-dropdown-menu-title-content',
    '.inspection-violations__action-dropdown',
  ].join(','))) {
    return true;
  }

  const cell = target.closest('td');
  return Boolean(
    cell?.classList.contains('inspection-violations__actions-column') ||
    cell?.classList.contains('inspection-violations__source-task-column') ||
    cell?.classList.contains('ant-table-cell-fix-right'),
  );
};

const renderSelectOptionText = (label: string) => (
  <span className="inspection-violations__select-option-text" title={label}>
    {label}
  </span>
);

const renderFineAmountTitle = (label: string) => (
  <span className="inspection-violations__column-title inspection-violations__column-title--fine-amount">
    <span>{label}</span>
    <AedIcon className="inspection-violations__column-title-currency-icon" aria-label="AED" />
  </span>
);

type WorkflowAction = Exclude<InspectionViolationAction, 'download_report'>;
type ViolationActionColumnKey = InspectionViolationAction | 'transferTrigger' | 'downArrow';
type WorkTab = ViolationWorkTab;
type ViolationListFilters = NonNullable<ViolationListParams['filters']>;
type InspectionSortDirection = 'asc' | 'desc';
type ViolationSortBy = 'ViolationNo' | 'StatusId' | 'SlaDeadlineAt' | 'CreatedOn' | 'LastUpdatedOn';
type ViolationSortState = { sortBy: ViolationSortBy; sortDirection: InspectionSortDirection };
type SourceTaskNavigationTarget = { taskId?: string | number; taskNo?: string };

type ViolationActionsCellProps = {
  record: InspectionViolationItem;
  translate: (key: string) => string;
  visibleDropdownKey: string | null;
  approvingViolationId: string | null;
  downloadingReportViolationId: string | null;
  onDropdownVisibleChange: (dropdownKey: string, visible: boolean) => void;
  onRunAction: (action: InspectionViolationAction, violation: InspectionViolationItem) => void;
};

type ViolationActionMenuClickEvent = {
  key: React.Key;
  domEvent: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>;
};

type StatItem = {
  labelKey: string;
  statuses: string[];
  icon: string;
  tone: string;
};

type ViolationColumnWidthConfig = {
  violationNo: number;
  type: number;
  violator: number;
  fineAmount: number;
  status: number;
  sla: number;
  sourceTask: number;
  reportedBy: number;
  creationTime: number;
  actions: number;
};

const EMPTY_ADVANCED_FILTERS: ViolationFilterState = {};
const CLEAR_VIOLATION_NAVIGATION_QUERY_PATCH: Record<string, string | null> = {
  [INSPECTION_QUERY_KEYS.view]: null,
  [INSPECTION_QUERY_KEYS.role]: null,
  [INSPECTION_QUERY_KEYS.scope]: null,
  [INSPECTION_QUERY_KEYS.from]: null,
  [INSPECTION_QUERY_KEYS.violationId]: null,
  [INSPECTION_QUERY_KEYS.violationNo]: null,
  [INSPECTION_QUERY_KEYS.type]: null,
  [INSPECTION_QUERY_KEYS.status]: null,
  [INSPECTION_QUERY_KEYS.mode]: null,
};

const statusOptions = Array.from(new Set<string>([
  ...VIOLATION_STATUSES,
  'RECTIFICATION',
  'RESOLVED',
]));

const hiddenStatusFilterOptions = new Set([
  'REPORT_SUBMITTED',
  'RECTIFICATION',
  'RESOLVED',
]);

const violationWorkTabLabelKeys: Record<WorkTab, string> = {
  todo: 'inspection.tasks.tabs.todo',
  completed: 'inspection.tasks.tabs.completed',
};

const actionConfig = INSPECTION_VIOLATION_ACTION_CONFIG;
const VIOLATION_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<ViolationActionColumnKey> =
  {
    downArrow: { default: 12, compact: 12 },
  };
const VIOLATION_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 4,
  padding: 32,
  minWidth: 100,
  maxWidth: 320,
};
const VIOLATION_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 4,
  padding: 32,
  minWidth: 100,
  maxWidth: 300,
};
const VIOLATION_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: '500 16px Inter, sans-serif',
  narrowFont: '500 14px Inter, sans-serif',
  textPadding: 0,
};

const INSPECTION_STAT_ITEMS: StatItem[] = [
  { labelKey: 'inspection.violation.status.warningIssued', statuses: ['WARNING_ISSUED'], icon: inspectionFigmaAssets.violationStatIcons.warningIssued, tone: 'notice' },
  { labelKey: 'inspection.violation.status.reviewInProgress', statuses: ['PENDING_ROUTING', 'PENDING_REVIEW', 'PENDING_CONTENT_REPORT', 'REPORT_SUBMITTED', 'PENDING_COMMITTEE_DECISION', 'PENDING_APPROVAL'], icon: inspectionFigmaAssets.violationStatIcons.reviewProgress, tone: 'warning' },
  { labelKey: 'inspection.violation.status.pendingPayment', statuses: ['PENDING_PAYMENT'], icon: inspectionFigmaAssets.violationStatIcons.pendingPayment, tone: 'notice' },
  { labelKey: 'inspection.violation.status.underAppeal', statuses: ['UNDER_APPEAL'], icon: inspectionFigmaAssets.violationStatIcons.underAppeal, tone: 'danger' },
  { labelKey: 'inspection.violation.status.paid', statuses: ['PAID', 'RESOLVED'], icon: inspectionFigmaAssets.violationStatIcons.paid, tone: 'success' },
  { labelKey: 'inspection.violation.status.cancelled', statuses: ['CANCELLED'], icon: inspectionFigmaAssets.violationStatIcons.cancelled, tone: 'muted' },
];

const CONTENT_STAT_ITEMS: StatItem[] = [
  { labelKey: 'inspection.tasks.tabs.todo', statuses: ['PENDING_CONTENT_REPORT'], icon: inspectionFigmaAssets.violationStatIcons.reviewProgress, tone: 'warning' },
  { labelKey: 'inspection.violation.status.reviewInProgress', statuses: ['REPORT_SUBMITTED', 'PENDING_COMMITTEE_DECISION', 'PENDING_APPROVAL'], icon: inspectionFigmaAssets.violationStatIcons.reviewProgress, tone: 'warning' },
  { labelKey: 'inspection.violation.status.pendingPayment', statuses: ['PENDING_PAYMENT'], icon: inspectionFigmaAssets.violationStatIcons.pendingPayment, tone: 'notice' },
  { labelKey: 'inspection.violation.status.underAppeal', statuses: ['UNDER_APPEAL'], icon: inspectionFigmaAssets.violationStatIcons.underAppeal, tone: 'danger' },
  { labelKey: 'inspection.violation.status.paid', statuses: ['PAID', 'RESOLVED'], icon: inspectionFigmaAssets.violationStatIcons.paid, tone: 'success' },
  { labelKey: 'inspection.violation.status.cancelled', statuses: ['CANCELLED'], icon: inspectionFigmaAssets.violationStatIcons.cancelled, tone: 'muted' },
];

const COMMITTEE_STAT_ITEMS: StatItem[] = [
  { labelKey: 'inspection.violation.status.pendingReview', statuses: ['PENDING_COMMITTEE_DECISION'], icon: inspectionFigmaAssets.violationStatIcons.reviewProgress, tone: 'warning' },
  { labelKey: 'inspection.violation.status.pendingPayment', statuses: ['PENDING_PAYMENT'], icon: inspectionFigmaAssets.violationStatIcons.pendingPayment, tone: 'notice' },
  { labelKey: 'inspection.violation.status.underAppeal', statuses: ['UNDER_APPEAL'], icon: inspectionFigmaAssets.violationStatIcons.underAppeal, tone: 'danger' },
  { labelKey: 'inspection.violation.status.paid', statuses: ['PAID', 'RESOLVED'], icon: inspectionFigmaAssets.violationStatIcons.paid, tone: 'success' },
  { labelKey: 'inspection.violation.status.cancelled', statuses: ['CANCELLED'], icon: inspectionFigmaAssets.violationStatIcons.cancelled, tone: 'muted' },
];

const completedStatusByRole: Record<'content' | 'committee', string[]> = {
  content: ['WARNING_ISSUED', 'PENDING_REVIEW', 'PENDING_COMMITTEE_DECISION', 'PENDING_APPROVAL', 'PENDING_PAYMENT', 'UNDER_APPEAL', 'PAID', 'CANCELLED'],
  committee: ['WARNING_ISSUED', 'PENDING_APPROVAL', 'PENDING_PAYMENT', 'UNDER_APPEAL', 'PAID', 'CANCELLED'],
};

const DEFAULT_COLUMN_WIDTHS: ViolationColumnWidthConfig = {
  violationNo: 224,
  type: 177,
  violator: 216,
  fineAmount: 131,
  status: 227,
  sla: 118,
  sourceTask: 184,
  reportedBy: 282,
  creationTime: 148,
  actions: 205,
};

const CONTENT_COLUMN_WIDTHS: ViolationColumnWidthConfig = {
  ...DEFAULT_COLUMN_WIDTHS,
  violator: 228,
  fineAmount: 142,
  status: 244,
  sourceTask: 184,
  reportedBy: 132,
  actions: 148,
};

const COMMITTEE_COLUMN_WIDTHS: ViolationColumnWidthConfig = {
  ...DEFAULT_COLUMN_WIDTHS,
  violator: 219,
  fineAmount: 142,
  status: 233,
  sourceTask: 184,
  reportedBy: 159,
  actions: 100,
};

const EMPTY_FINE_STATUSES = new Set(['WARNING_ISSUED', 'PENDING_CONTENT_REPORT', 'REPORT_SUBMITTED', 'PENDING_REVIEW']);

const getFineLabel = (value?: number | string | null, status?: string | null) => {
  if (EMPTY_FINE_STATUSES.has(normalizeViolationStatus(status))) return '-';
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return '-';
  return formatNumber(normalized);
};
const getViolationSlaLabel = (
  record: InspectionViolationItem,
  translate: (key: string, options?: Record<string, unknown>) => string,
) => {
  const sla = record.sla;
  const directLabel = record.slaLabel || sla?.displayText;
  if (directLabel) return directLabel;

  const dueDate = record.slaDeadlineAt || sla?.dueOn;
  if (!dueDate) return '-';

  const remainingMs = msUntil(dueDate);
  if (remainingMs === null) return formatDateTime(dueDate, '-');

  const diffDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  if (diffDays > 0) return translate('inspection.violation.detail.slaDaysRemaining', { count: diffDays });
  if (diffDays === 0) return translate('inspection.violation.detail.slaDueToday');
  return translate('inspection.violation.detail.slaDaysOverdue', { count: Math.abs(diffDays) });
};
const getRecordId = (record: InspectionViolationItem) => (
  String(record.id || '')
);
const getRecordActionKey = (record: InspectionViolationItem) => (
  getRecordId(record) || record.violationNo || ''
);
const getViolationReason = (record: InspectionViolationItem) => {
  const localizedDescription = getLocalizedText(
    record.violationDescription || record.violationDescriptionEn,
    record.violationDescriptionAr,
    '',
  );
  return localizedDescription || record.violationDescription || '-';
};
const shouldEnrichViolationReason = (record: InspectionViolationItem) => {
  void record;
  return false;
};
const mergeViolationReasonFromDetail = (
  record: InspectionViolationItem,
  detail?: InspectionViolationItem | null,
) => {
  if (!detail || getViolationReason(detail) === '-') return record;
  return {
    ...record,
    violationDescription: detail.violationDescription,
    violationDescriptionEn: detail.violationDescriptionEn,
    violationDescriptionAr: detail.violationDescriptionAr,
  };
};
const getTypeFilterValues = (value: string) => (
  value === 'licensing'
    ? ['License Violation']
    : [value]
);
const getViolationTypeLabel = (record: InspectionViolationItem) => (
  record.violationTypeName || '-'
);
const getCreatedAtLabel = (record: InspectionViolationItem) => (
  formatDateTime(record.createdOn, '-')
);
const getRowKey = (record: InspectionViolationItem) => (
  getRecordId(record) || `${record.violationNo || 'violation'}-${record.taskNo || 'task'}`
);
const isAutoGeneratedViolation = (record: InspectionViolationItem) => {
  return Boolean(record.isAutoGenerated);
};
const getSourceTaskLabel = (record: InspectionViolationItem) => {
  const sourceTask = record.taskNo || '';
  if (sourceTask) return sourceTask;
  if (record.taskId) return String(record.taskId);
  return isAutoGeneratedViolation(record) ? 'Auto-generated' : '-';
};
const getSourceTaskNavigationTarget = (record: InspectionViolationItem): SourceTaskNavigationTarget | null => {
  const taskId = record.taskId as string | number | null | undefined;
  const rawTaskNo = record.taskNo || '';
  const taskNo = String(rawTaskNo).trim();
  const hasNavigableTaskNo = Boolean(taskNo && taskNo.toLowerCase() !== 'auto-generated');

  if (taskId === undefined || taskId === null || taskId === '') {
    return hasNavigableTaskNo ? { taskNo } : null;
  }

  return {
    taskId,
    taskNo: hasNavigableTaskNo ? taskNo : undefined,
  };
};
const isViolationAction = (value: string): value is InspectionViolationAction => (
  Object.prototype.hasOwnProperty.call(actionConfig, value)
);
const getRecordAvailableActions = (
  record: InspectionViolationItem,
) => {
  return normalizeInspectionViolationActions(record.availableActions);
};
const getActionTitleKey = (action: InspectionViolationAction) => (
  action === 'review_decide' ? 'inspection.violation.actions.review' : actionConfig[action].titleKey
);
const getActionTriggerLabelKey = (action: InspectionViolationAction) => (
  action.startsWith('transfer') ? 'inspection.violation.actions.transfer' : getActionTitleKey(action)
);
const transferRouteTargetByAction: Partial<Record<InspectionViolationAction, InspectionViolationRouteTargetCode>> = {
  transfer_content: 'Content',
  transfer_committee: 'Committee',
};
const waitForDropdownClose = () => new Promise<void>((resolve) => window.setTimeout(resolve, 300));
const getPascalStatusKey = (status: string) => (
  normalizeViolationStatus(status)
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')
);
const getSummaryCount = (summary: ViolationSummaryMap, statuses: string[]) => (
  statuses.reduce((count, status) => {
    const normalizedStatus = normalizeViolationStatus(status);
    return count + Number(
      summary[normalizedStatus]
      || summary[normalizedStatus.toUpperCase()]
      || summary[getPascalStatusKey(status)]
      || summary[status]
      || 0,
    );
  }, 0)
);
const uniqueStrings = (items: string[]) => Array.from(new Set(items));
const mergeStatItems = (items: StatItem[]) => {
  const itemMap = new Map<string, StatItem>();
  items.forEach((item) => {
    const existing = itemMap.get(item.labelKey);
    if (existing) {
      itemMap.set(item.labelKey, {
        ...existing,
        statuses: uniqueStrings([...existing.statuses, ...item.statuses]),
      });
      return;
    }
    itemMap.set(item.labelKey, item);
  });
  return Array.from(itemMap.values());
};

const ViolationActionsCell: React.FC<ViolationActionsCellProps> = ({
  record,
  translate,
  visibleDropdownKey,
  approvingViolationId,
  downloadingReportViolationId,
  onDropdownVisibleChange,
  onRunAction,
}) => {
  const actions = getRecordAvailableActions(record);
  const recordId = getRecordId(record);
  const recordActionKey = getRecordActionKey(record);
  const dropdownVisible = Boolean(recordId && visibleDropdownKey === recordId);
  const isApproveLoading = Boolean(approvingViolationId && recordId === approvingViolationId);
  const isDownloadLoading = Boolean(downloadingReportViolationId && recordActionKey === downloadingReportViolationId);

  const stopActionPropagation = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  const handleRunAction = useCallback((action: InspectionViolationAction) => {
    if (action === 'approve' && isApproveLoading) return;
    if (action === 'download_report' && isDownloadLoading) return;
    onRunAction(action, record);
  }, [isApproveLoading, isDownloadLoading, onRunAction, record]);

  const handleMenuItemMouseDown = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDropdownVisibleChange = useCallback((visible: boolean) => {
    if (!recordId) return;
    onDropdownVisibleChange(recordId, visible);
  }, [onDropdownVisibleChange, recordId]);

  const handleMenuClick = useCallback(({ key, domEvent }: ViolationActionMenuClickEvent) => {
    domEvent.preventDefault();
    domEvent.stopPropagation();
    const action = String(key);
    if (!isViolationAction(action)) return;
    window.setTimeout(() => {
      handleDropdownVisibleChange(false);
      handleRunAction(action);
    }, 0);
  }, [handleDropdownVisibleChange, handleRunAction]);

  if (!actions.length) {
    return <span className="inspection-violations__actions-empty">-</span>;
  }

  const firstAction = actions[0];

  if (actions.length > 1) {
    const triggerLabelKey = firstAction === 'review_decide'
      ? 'inspection.violation.actions.review'
      : getActionTriggerLabelKey(firstAction);
    const actionMenu = (
      <Menu
        selectable={false}
        onClick={handleMenuClick}
        items={actions.map((action) => ({
          key: action,
          disabled: (action === 'approve' && isApproveLoading) ||
            (action === 'download_report' && isDownloadLoading),
          label: (
            <span onMouseDown={handleMenuItemMouseDown}>
              {translate(getActionTitleKey(action))}
            </span>
          ),
        }))}
      />
    );

    return (
      <Dropdown
        visible={dropdownVisible}
        onVisibleChange={handleDropdownVisibleChange}
        overlay={actionMenu}
        trigger={['click']}
        destroyPopupOnHide
        overlayClassName="inspection-violations__action-dropdown"
      >
        <span
          className="inspection-violations__action-trigger"
          onClick={stopActionPropagation}
          onMouseDown={stopActionPropagation}
        >
          <Button
            type="link"
            className="inspection-violations__action-button inspection-violations__action-button--trigger"
          >
            {translate(triggerLabelKey)}
          </Button>
          <span className="inspection-violations__down-arrow" />
        </span>
      </Dropdown>
    );
  }

  return (
    <div
      className="inspection-violations__actions-cell"
      onClick={stopActionPropagation}
      onMouseDown={stopActionPropagation}
    >
      <Button
        type="link"
        className="inspection-violations__action-button inspection-violations__action-button--single"
        disabled={(firstAction === 'approve' && isApproveLoading) ||
          (firstAction === 'download_report' && isDownloadLoading)}
        loading={(firstAction === 'approve' && isApproveLoading) ||
          (firstAction === 'download_report' && isDownloadLoading)}
        onClick={(event) => {
          event.stopPropagation();
          handleRunAction(firstAction);
        }}
      >
        {translate(getActionTitleKey(firstAction))}
      </Button>
    </div>
  );
};

const getStatItemsByRoles = (roles: readonly InspectionRole[]) => {
  if (hasAnyInspectionRole(roles, ['inspector', 'manager'])) {
    return INSPECTION_STAT_ITEMS;
  }

  const roleItems = [
    ...(roles.includes('content') ? CONTENT_STAT_ITEMS : []),
    ...(roles.includes('committee') ? COMMITTEE_STAT_ITEMS : []),
  ];

  return roleItems.length ? mergeStatItems(roleItems) : INSPECTION_STAT_ITEMS;
};

const getStatGridClassName = (roles: readonly InspectionRole[]) => {
  if (roles.length === 1 && roles[0] === 'committee') {
    return 'inspection-violations__stats-row inspection-violations__stats-row--five';
  }
  return 'inspection-violations__stats-row';
};

const getColumnWidthConfig = (roles: readonly InspectionRole[]): ViolationColumnWidthConfig => {
  if (roles.length === 1 && roles[0] === 'content') return CONTENT_COLUMN_WIDTHS;
  if (roles.length === 1 && roles[0] === 'committee') return COMMITTEE_COLUMN_WIDTHS;
  return DEFAULT_COLUMN_WIDTHS;
};

const getTableScrollX = (widths: ViolationColumnWidthConfig, includeActions: boolean) => (
  widths.violationNo
  + widths.type
  + widths.violator
  + widths.fineAmount
  + widths.status
  + widths.sla
  + widths.sourceTask
  + widths.reportedBy
  + widths.creationTime
  + (includeActions ? widths.actions : 0)
);

const hasAdvancedFilterValue = (filters: ViolationFilterState) => Boolean(
  filters.reportedBy || filters.createdOnRange,
);

const getViolatorName = (record: InspectionViolationItem) => (
  record.violatorName || '-'
);

const getReportedBy = (record: InspectionViolationItem) => (
  record.reportedByName || '-'
);

const getWorkTabStatusOptions = (
  roles: readonly InspectionRole[],
  activeTab: WorkTab | null,
) => {
  if (!activeTab) return statusOptions;
  if (hasAnyInspectionRole(roles, ['inspector', 'manager'])) {
    return statusOptions;
  }

  const options = [
    ...(roles.includes('content')
      ? activeTab === 'todo'
        ? ['PENDING_CONTENT_REPORT']
        : completedStatusByRole.content
      : []),
    ...(roles.includes('committee')
      ? activeTab === 'todo'
        ? ['PENDING_COMMITTEE_DECISION']
        : completedStatusByRole.committee
      : []),
  ];

  return options.length ? uniqueStrings(options) : statusOptions;
};

const getVisibleStatusFilterOptions = (
  roles: readonly InspectionRole[],
  activeTab: WorkTab | null,
) => getWorkTabStatusOptions(roles, activeTab).filter(
  (status) => !hiddenStatusFilterOptions.has(normalizeViolationStatus(status)),
);

const getDefaultViolationSort = (roles: readonly InspectionRole[]): ViolationSortState => {
  if (hasAnyInspectionRole(roles, ['content', 'committee'])) {
    return {
      sortBy: 'LastUpdatedOn',
      sortDirection: 'desc',
    };
  }

  return {
    sortBy: 'CreatedOn',
    sortDirection: 'desc',
  };
};

const decodeDispositionFilename = (value: string) => {
  const trimmedValue = value.trim().replace(/^"|"$/g, '');
  try {
    return decodeURIComponent(trimmedValue);
  } catch {
    return trimmedValue;
  }
};

const getFilenameFromContentDisposition = (contentDisposition?: string) => {
  if (!contentDisposition) return '';

  const encodedFilename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encodedFilename) return decodeDispositionFilename(encodedFilename);

  const fallbackFilename = contentDisposition.match(/filename=([^;]+)/i)?.[1];
  return fallbackFilename ? decodeDispositionFilename(fallbackFilename) : '';
};

const padDatePart = (value: number) => String(value).padStart(2, '0');

const buildViolationExportFallbackName = () => {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
    padDatePart(now.getHours()),
    padDatePart(now.getMinutes()),
    padDatePart(now.getSeconds()),
  ].join('');

  return `inspection-violations-export-${timestamp}.csv`;
};

const InspectionViolationsPage: React.FC = () => {
  const history = useHistory();
  const { t, i18n } = useTranslation();
  const { roles } = useInspectionAccess();
  const { canRenderButton } = useButtonPermission(INSPECTION_PATHS.violations);
  const { activated, effectiveSearch } = useKeepAliveRouteState({
    restorePathname: INSPECTION_PATHS.violations,
    restoreFrom: [INSPECTION_PATHS.violationDetail],
  });
  const query = useMemo(() => getInspectionQuery(effectiveSearch), [effectiveSearch]);
  const availableWorkTabs = useMemo(
    () => getAvailableViolationWorkTabs(canRenderButton),
    [canRenderButton],
  );
  const showWorkTabs = availableWorkTabs.length > 0;
  const resolvedWorkTab = useMemo(
    () => resolveViolationWorkTab(query.tab, availableWorkTabs),
    [availableWorkTabs, query.tab],
  );
  const activeWorkTab = resolvedWorkTab;
  const routeViolationKeyword = query.violationNo;
  const statItems = useMemo(() => getStatItemsByRoles(roles), [roles]);
  const hasLegacyRoleQuery = useMemo(() => {
    const searchParams = new URLSearchParams(effectiveSearch);
    return (
      searchParams.has(INSPECTION_QUERY_KEYS.view) ||
      searchParams.has(INSPECTION_QUERY_KEYS.role) ||
      searchParams.has(INSPECTION_QUERY_KEYS.scope)
    );
  }, [effectiveSearch]);
  const defaultViolationSort = useMemo(() => getDefaultViolationSort(roles), [roles]);
  const previousDefaultViolationSortRef = useRef(defaultViolationSort);
  const [keyword, setKeyword] = useState(routeViolationKeyword);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [advancedFilters, setAdvancedFilters] = useState<ViolationFilterState>(EMPTY_ADVANCED_FILTERS);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [reportedByOptions, setReportedByOptions] = useState<ViolationFilterOption[]>([]);
  const [summary, setSummary] = useState<ViolationSummaryMap>({});
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [violationSortBy, setViolationSortBy] = useState<ViolationSortBy | undefined>(() => defaultViolationSort.sortBy);
  const [violationSortDirection, setViolationSortDirection] = useState<InspectionSortDirection | undefined>(() => defaultViolationSort.sortDirection);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [violations, setViolations] = useState<InspectionViolationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [workflowAction, setWorkflowAction] = useState<WorkflowAction | null>(null);
  const [currentViolation, setCurrentViolation] = useState<InspectionViolationItem | null>(null);
  const [workflowSubmitting, setWorkflowSubmitting] = useState(false);
  const [approvingViolationId, setApprovingViolationId] = useState<string | null>(null);
  const [downloadingReportViolationId, setDownloadingReportViolationId] = useState<string | null>(null);
  const [approveSuccessModalVisible, setApproveSuccessModalVisible] = useState(false);
  const [visibleActionDropdownKey, setVisibleActionDropdownKey] = useState<string | null>(null);
  const violationReasonCacheRef = useRef(new Map<string, InspectionViolationItem>());
  const violationFetchRequestRef = useRef(0);
  const typeFilterOptions = [
    { value: 'all', label: t('inspection.violation.filters.allTypes') },
    { value: 'Content Violation', label: t('inspection.violation.filters.contentViolation') },
    { value: 'licensing', label: t('inspection.violation.filters.licenseViolation') },
  ];
  const availableStatusOptions = useMemo(
    () => getVisibleStatusFilterOptions(roles, activeWorkTab),
    [activeWorkTab, roles],
  );
  const statusFilterOptions = useMemo(
    () => [
      {
        value: 'all',
        label: t('inspection.violation.filters.allStatuses'),
      },
      ...availableStatusOptions.map((status) => ({
        value: status,
        label: getViolationStatusLabel(status),
      })),
    ],
    [availableStatusOptions, t],
  );
  const workflowNextStatus = workflowAction ? actionConfig[workflowAction].nextStatus || '' : '';
  const workflowStatusOptions = useMemo(() => (
    workflowNextStatus ? [workflowNextStatus] : []
  ), [workflowNextStatus]);
  const columnWidths = useMemo(() => getColumnWidthConfig(roles), [roles]);
  const violationActionColumnWidth = useResponsiveActionColumnWidth<
    InspectionViolationItem,
    ViolationActionColumnKey
  >({
    rows: violations,
    buttonWidthMap: VIOLATION_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: (record) => {
      const actions = getRecordAvailableActions(record);

      if (!actions.length) {
        return [];
      }

      const firstAction = actions[0];
      const visibleActions: ViolationActionColumnKey[] = [
        actions.length > 1 && firstAction.startsWith('transfer') ? 'transferTrigger' : firstAction,
      ];

      if (actions.length > 1) {
        visibleActions.push('downArrow');
      }

      return visibleActions;
    },
    getActionLabel: (actionKey) => {
      if (actionKey === 'downArrow') {
        return undefined;
      }
      if (actionKey === 'transferTrigger') {
        return t('inspection.violation.actions.transfer');
      }
      return t(getActionTitleKey(actionKey));
    },
    desktopConfig: VIOLATION_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: VIOLATION_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: VIOLATION_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });
  const activeColumnWidths = useMemo(
    () => ({
      ...columnWidths,
      actions: violationActionColumnWidth,
    }),
    [columnWidths, violationActionColumnWidth],
  );
  const workflowInitialValues = useMemo<ViolationWorkflowModalValues>(() => ({
    status: workflowNextStatus,
    reason: currentViolation
      ? getViolationReason(currentViolation)
      : '',
    remark: '',
  }), [currentViolation, workflowNextStatus]);
  const hasAdvancedFilters = useMemo(() => hasAdvancedFilterValue(advancedFilters), [advancedFilters]);
  // The modal edits the advanced fields plus type and status.
  const appliedFilterCount = useMemo(
    () => countAppliedFilters([
      ...Object.values(advancedFilters ?? {}),
      typeFilter,
      statusFilter,
    ]),
    [advancedFilters, typeFilter, statusFilter],
  );
  const violationFilterModalValue = useMemo(
    () => ({
      ...advancedFilters,
      type: typeFilter,
      status: statusFilter,
    }),
    [advancedFilters, statusFilter, typeFilter],
  );
  const tableScrollX = useMemo(() => pxToRemValue(getTableScrollX(activeColumnWidths, true)), [activeColumnWidths]);
  const applyCachedViolationReasons = useCallback((items: InspectionViolationItem[]) => (
    items.map((item) => {
      const cachedReason = violationReasonCacheRef.current.get(getRecordId(item));
      return cachedReason ? mergeViolationReasonFromDetail(item, cachedReason) : item;
    })
  ), []);
  const enrichVisibleViolationReasons = useCallback((items: InspectionViolationItem[], requestId: number) => {
    const targetMap = items.reduce<Map<string, InspectionViolationItem>>((map, item) => {
      const recordId = getRecordId(item);
      if (!shouldEnrichViolationReason(item) || !recordId || violationReasonCacheRef.current.has(recordId)) {
        return map;
      }
      map.set(recordId, item);
      return map;
    }, new Map());

    if (!targetMap.size) return;

    void Promise.all(Array.from(targetMap.entries()).map(async ([recordId, item]) => {
      try {
        const detailResponse = await getInspectionViolationReasonSummary({
          violationId: recordId,
          violationNo: item.violationNo,
        });
        const detail = unwrapPayload<InspectionViolationItem | null>(detailResponse);
        if (detail && getViolationReason(detail) !== '-') {
          violationReasonCacheRef.current.set(recordId, detail);
        }
      } catch {
        // Keep the list usable when the optional reason enrichment fails.
      }
    })).then(() => {
      if (violationFetchRequestRef.current !== requestId) return;
      setViolations((current) => applyCachedViolationReasons(current));
    });
  }, [applyCachedViolationReasons]);
  const buildViolationListFilters = useCallback(() => {
    const filters: ViolationListFilters = {};
    if (typeFilter && typeFilter !== 'all') filters.typeList = getTypeFilterValues(typeFilter);
    if (statusFilter && statusFilter !== 'all') filters.statusList = [statusFilter];
    if (advancedFilters.reportedBy) filters.reportBy = advancedFilters.reportedBy;
    if (advancedFilters.createdOnRange) {
      filters.createdOnFrom = toApi(advancedFilters.createdOnRange[0].clone().startOf('day'));
      filters.createdOnTo = toApi(advancedFilters.createdOnRange[1].clone().endOf('day'));
    }
    return Object.keys(filters).length ? filters : undefined;
  }, [advancedFilters, statusFilter, typeFilter]);
  const navigateToViolationDetail = useCallback((violation: InspectionViolationItem, mode?: InspectionViolationAction) => {
    history.push(buildInspectionPath(INSPECTION_PATHS.violationDetail, effectiveSearch, {
      [INSPECTION_QUERY_KEYS.view]: null,
      [INSPECTION_QUERY_KEYS.role]: null,
      [INSPECTION_QUERY_KEYS.scope]: null,
      [INSPECTION_QUERY_KEYS.from]: 'violations',
      violationNo: violation.violationNo,
      violationId: getRecordId(violation),
      status: violation.statusCode || violation.statusName,
      type: violation.violationTypeName || violation.violationTypeCode,
      mode,
    }));
  }, [effectiveSearch, history]);
  const navigateToSourceTaskDetail = useCallback((violation: InspectionViolationItem) => {
    const sourceTaskTarget = getSourceTaskNavigationTarget(violation);
    if (!sourceTaskTarget) return;

    history.push(buildInspectionPath(INSPECTION_PATHS.taskDetail, effectiveSearch, {
      [INSPECTION_QUERY_KEYS.view]: null,
      [INSPECTION_QUERY_KEYS.role]: null,
      [INSPECTION_QUERY_KEYS.scope]: null,
      [INSPECTION_QUERY_KEYS.from]: 'violations',
      [INSPECTION_QUERY_KEYS.taskId]: sourceTaskTarget.taskId,
      [INSPECTION_QUERY_KEYS.taskNo]: sourceTaskTarget.taskNo,
      [INSPECTION_QUERY_KEYS.visitId]: null,
      [INSPECTION_QUERY_KEYS.step]: null,
      [INSPECTION_QUERY_KEYS.mode]: null,
      [INSPECTION_QUERY_KEYS.reportNo]: null,
      [INSPECTION_QUERY_KEYS.violationId]: null,
      [INSPECTION_QUERY_KEYS.violationNo]: null,
      [INSPECTION_QUERY_KEYS.status]: null,
      [INSPECTION_QUERY_KEYS.type]: null,
    }));
  }, [effectiveSearch, history]);

  useEffect(() => {
    if (!activated) return;

    const nextPatch: Record<string, string | null> = {
      [INSPECTION_QUERY_KEYS.view]: null,
      [INSPECTION_QUERY_KEYS.role]: null,
      [INSPECTION_QUERY_KEYS.scope]: null,
    };
    let shouldReplace = hasLegacyRoleQuery;

    if (showWorkTabs) {
      if (resolvedWorkTab && query.tab !== resolvedWorkTab) {
        nextPatch.tab = resolvedWorkTab;
        shouldReplace = true;
      }
    } else if (query.tab) {
      nextPatch.tab = null;
      shouldReplace = true;
    }

    if (!shouldReplace) return;

    history.replace(buildInspectionPath(INSPECTION_PATHS.violations, effectiveSearch, nextPatch));
  }, [activated, effectiveSearch, hasLegacyRoleQuery, history, query.tab, resolvedWorkTab, showWorkTabs]);

  useEffect(() => {
    if (!statusFilter || statusFilter === 'all' || availableStatusOptions.includes(statusFilter)) return;
    setStatusFilter(undefined);
    setPageIndex(1);
  }, [availableStatusOptions, statusFilter]);

  useEffect(() => {
    const previousDefaultSort = previousDefaultViolationSortRef.current;
    previousDefaultViolationSortRef.current = defaultViolationSort;

    const shouldUseDefaultSort =
      violationSortBy === previousDefaultSort.sortBy &&
      violationSortDirection === previousDefaultSort.sortDirection;

    if (!shouldUseDefaultSort) return;
    setViolationSortBy(defaultViolationSort.sortBy);
    setViolationSortDirection(defaultViolationSort.sortDirection);
  }, [defaultViolationSort, violationSortBy, violationSortDirection]);

  const resetFilterState = useCallback(() => {
    setKeyword('');
    setTypeFilter(undefined);
    setStatusFilter(undefined);
    setAdvancedFilters(EMPTY_ADVANCED_FILTERS);
    setViolationSortBy(defaultViolationSort.sortBy);
    setViolationSortDirection(defaultViolationSort.sortDirection);
    setPageIndex(1);
  }, [defaultViolationSort]);

  const resetFilters = useCallback(() => {
    resetFilterState();
    history.replace(buildInspectionPath(
      INSPECTION_PATHS.violations,
      effectiveSearch,
      CLEAR_VIOLATION_NAVIGATION_QUERY_PATCH,
    ));
  }, [effectiveSearch, history, resetFilterState]);

  const updateWorkTab = useCallback((tab: string) => {
    if (!isViolationWorkTab(tab) || !availableWorkTabs.includes(tab)) return;
    resetFilterState();
    history.push(buildInspectionPath(INSPECTION_PATHS.violations, effectiveSearch, {
      ...CLEAR_VIOLATION_NAVIGATION_QUERY_PATCH,
      tab,
    }));
  }, [availableWorkTabs, effectiveSearch, history, resetFilterState]);

  useEffect(() => {
    if (!routeViolationKeyword) return;
    setKeyword(routeViolationKeyword);
    setTypeFilter(undefined);
    setStatusFilter(undefined);
    setAdvancedFilters(EMPTY_ADVANCED_FILTERS);
    setPageIndex(1);
  }, [routeViolationKeyword]);

  const fetchViolations = useCallback(async () => {
    const requestId = violationFetchRequestRef.current + 1;
    violationFetchRequestRef.current = requestId;
    setLoading(true);
    try {
      const filters = buildViolationListFilters();
      const listParams: ViolationListParams = {
        role: roles.join(','),
        tab: activeWorkTab ? activeWorkTab : 'all',
        pageIndex,
        pageSize,
        keyword: keyword || undefined,
        filters,
        sortBy: violationSortBy,
        sortDirection: violationSortDirection,
      };
      const [listResponse, statsResponse] = await Promise.all([
        getInspectionViolations(listParams),
        getInspectionViolationStats().catch(() => null),
      ]);
      const payload = unwrapPayload<ViolationListData>(listResponse);
      const stats = statsResponse ? unwrapPayload<ViolationSummaryMap>(statsResponse) : undefined;
      const nextItems = payload?.items || [];
      const visibleItems = applyCachedViolationReasons(nextItems);

      if (violationFetchRequestRef.current !== requestId) return;
      setViolations(visibleItems);
      setTotal(payload?.total || 0);
      setSummary(stats || payload?.summary || {});
      enrichVisibleViolationReasons(nextItems, requestId);
    } catch (error) {
      if (violationFetchRequestRef.current !== requestId) return;
      if (isInspectionDataMissingError(error)) {
        setViolations([]);
        setTotal(0);
        setSummary({});
        return;
      }
      CustomMessage.error(i18n.t('inspection.violation.messages.loadFailed'));
    } finally {
      if (violationFetchRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [
    activeWorkTab,
    applyCachedViolationReasons,
    buildViolationListFilters,
    enrichVisibleViolationReasons,
    i18n,
    keyword,
    pageIndex,
    pageSize,
    roles,
    violationSortBy,
    violationSortDirection,
  ]);

  useEffect(() => {
    fetchViolations();
  }, [fetchViolations]);

  useEffect(() => {
    let cancelled = false;

    getInspectionInspectors()
      .then((inspectors) => {
        if (cancelled) return;

        const inspectorIds = new Set<string>();
        const options = inspectors.reduce<ViolationFilterOption[]>((items, inspector) => {
          const value = String(inspector.id || "").trim();
          if (!value || inspectorIds.has(value)) return items;

          inspectorIds.add(value);
          items.push({
            value,
            label: getLocalizedText(
              inspector.nameEn,
              inspector.nameAr,
              inspector.name || value,
            ),
          });
          return items;
        }, []);

        setReportedByOptions(options);
      })
      .catch(() => {
        if (!cancelled) setReportedByOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  useKeepAliveActivated({
    onActivated: () => {
      void fetchViolations();
    },
    onDeactivated: () => {
      setFilterModalVisible(false);
      setWorkflowAction(null);
      setCurrentViolation(null);
      setWorkflowSubmitting(false);
      setApprovingViolationId(null);
      setApproveSuccessModalVisible(false);
      setVisibleActionDropdownKey(null);
    },
  });

  const handleExport = useCallback(async () => {
    if (exportLoading) return;

    setExportLoading(true);
    try {
      const response = await exportInspectionViolations({
        role: roles.join(','),
        tab: activeWorkTab ? activeWorkTab : 'all',
        keyword: keyword || undefined,
        filters: buildViolationListFilters(),
        sortBy: violationSortBy,
        sortDirection: violationSortDirection,
      });
      const filename = getFilenameFromContentDisposition(response.headers['content-disposition'])
        || buildViolationExportFallbackName();
      downloadBlobFile(filename, response.data);
      // CustomMessage.success(t('inspection.tasks.messages.exportReady'));
    } catch (error) {
      if (isInspectionDataMissingError(error)) {
        CustomMessage.warning(t('inspection.common.none'));
        return;
      }
      CustomMessage.error(t('inspection.violation.messages.loadFailed'));
    } finally {
      setExportLoading(false);
    }
  }, [activeWorkTab, buildViolationListFilters, exportLoading, keyword, roles, t, violationSortBy, violationSortDirection]);

  const handleApplyAdvancedFilters = useCallback(async (value: ViolationFilterState) => {
    const { type, status, ...nextAdvancedFilters } = value;

    setTypeFilter(type);
    setStatusFilter(status);
    setAdvancedFilters(nextAdvancedFilters);
    setFilterModalVisible(false);
    setPageIndex(1);
  }, []);

  const runViolationAction = useCallback(async (action: InspectionViolationAction, violation: InspectionViolationItem) => {
    if (action === 'download_report') {
      const violationId = getRecordActionKey(violation) || 'download_report';
      if (downloadingReportViolationId) return;

      if (!violation.violationReportUrl) {
        CustomMessage.error(t('inspection.violation.messages.reportUnavailable'));
        return;
      }

      setDownloadingReportViolationId(String(violationId));
      try {
        const downloaded = await downloadInspectionViolationReport(violation.violationReportUrl);
        if (!downloaded) {
          CustomMessage.error(t('inspection.violation.messages.reportUnavailable'));
        }
      } catch {
        CustomMessage.error(t('inspection.violation.messages.reportDownloadFailed'));
      } finally {
        setDownloadingReportViolationId(null);
      }
      return;
    }

    const routeTargetCode = transferRouteTargetByAction[action];
    if (routeTargetCode) {
      const violationId = getRecordId(violation);
      if (!violationId) return;

      try {
        await routeInspectionViolation({ violationId, routeTargetCode });
        CustomMessage.success(t('inspection.violation.messages.workflowSaved', { action: t(getActionTitleKey(action)) }));
        await waitForDropdownClose();
        fetchViolations();
      } catch {
        // Request middleware handles the visible API error message.
      }
      return;
    }

    if (action === 'approve') {
      const violationId = getRecordId(violation);
      if (!violationId || approvingViolationId) return;

      setApprovingViolationId(violationId);
      try {
        await approveInspectionViolation(violationId);
        setApproveSuccessModalVisible(true);
        await fetchViolations();
      } catch {
        // Request middleware handles the visible API error message.
      } finally {
        setApprovingViolationId(null);
      }
      return;
    }

    navigateToViolationDetail(violation, action);
  }, [approvingViolationId, downloadingReportViolationId, fetchViolations, navigateToViolationDetail, t]);

  const handleActionDropdownVisibleChange = useCallback((dropdownKey: string, visible: boolean) => {
    setVisibleActionDropdownKey((currentKey) => {
      if (visible) return dropdownKey;
      return currentKey === dropdownKey ? null : currentKey;
    });
  }, []);

  const closeWorkflow = useCallback(() => {
    setWorkflowAction(null);
    setCurrentViolation(null);
  }, []);

  const closeApproveSuccessModal = useCallback(() => {
    setApproveSuccessModalVisible(false);
  }, []);

  const submitWorkflow = async (values: ViolationWorkflowModalValues) => {
    if (!workflowAction || !currentViolation) return;
    const violationId = getRecordId(currentViolation);
    if (!violationId) return;

    const nextStatus = actionConfig[workflowAction].nextStatus as InspectionViolationStatus;
    const isApproveAction = workflowAction === 'approve';

    setWorkflowSubmitting(true);
    try {
      if (isApproveAction) {
        await approveInspectionViolation(violationId);
        setApproveSuccessModalVisible(true);
      } else {
        await updateInspectionViolationStatus({ violationId, status: nextStatus, remark: values.remark || values.reason });
        CustomMessage.success(t('inspection.violation.messages.workflowSaved', { action: t(getActionTitleKey(workflowAction)) }));
      }
      closeWorkflow();
      fetchViolations();
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  const resolveViolationSortOrder = useCallback((sortBy: ViolationSortBy) => {
    if (violationSortBy !== sortBy || !violationSortDirection) return null;
    return violationSortDirection === 'asc' ? 'ascend' : 'descend';
  }, [violationSortBy, violationSortDirection]);

  const handleViolationTableChange: TableProps<InspectionViolationItem>['onChange'] = useCallback((_pagination, _filters, sorter, extra) => {
    if (extra?.action !== 'sort') return;

    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const order = activeSorter?.order;
    const nextSortBy = typeof activeSorter?.columnKey === 'string'
      ? activeSorter.columnKey as ViolationSortBy
      : undefined;

    if (!order || !nextSortBy) {
      setViolationSortBy(undefined);
      setViolationSortDirection(undefined);
      setPageIndex(1);
      return;
    }

    setViolationSortBy(nextSortBy);
    setViolationSortDirection(order === 'ascend' ? 'asc' : 'desc');
    setPageIndex(1);
  }, []);

  const columns: ColumnsType<InspectionViolationItem> = useMemo(() => {
    const baseColumns: ColumnsType<InspectionViolationItem> = [
      {
        title: t('inspection.violation.columns.violationNo'),
        key: 'ViolationNo',
        dataIndex: 'violationNo',
        width: pxToRemValue(activeColumnWidths.violationNo),
        fixed: 'left',
        sorter: true,
        sortOrder: resolveViolationSortOrder('ViolationNo'),
        render: (value) => (
          <span className="inspection-violations__violation-no">{value || '-'}</span>
        ),
      },
      { title: t('inspection.violation.columns.type'), dataIndex: 'violationType', width: pxToRemValue(activeColumnWidths.type), render: (_, record) => getViolationTypeLabel(record) },
      {
        title: t('inspection.violation.columns.violator'),
        width: pxToRemValue(activeColumnWidths.violator),
        render: (_, record) => {
          const violatorName = getViolatorName(record);

          return (
            <span className="inspection-violations__violator-name">
              <img className="inspection-violations__violator-icon" src={getInspectionTargetIcon(record)} alt="" />
              <span className="inspection-violations__violator-text" title={violatorName}>
                {violatorName}
              </span>
            </span>
          );
        },
      },
      {
        title: renderFineAmountTitle(t('inspection.violation.columns.fineAmount')),
        dataIndex: 'fineAmount',
        width: pxToRemValue(activeColumnWidths.fineAmount),
        render: (value, record) => getFineLabel(value, record.status),
      },
      {
        title: t('inspection.violation.columns.status'),
        key: 'StatusId',
        dataIndex: 'status',
        width: pxToRemValue(activeColumnWidths.status),
        sorter: true,
        sortOrder: resolveViolationSortOrder('StatusId'),
        render: (value) => <InspectionViolationStatusTag status={value} />,
      },
      {
        title: t('inspection.violation.columns.sla'),
        key: 'SlaDeadlineAt',
        width: pxToRemValue(activeColumnWidths.sla),
        sorter: true,
        sortOrder: resolveViolationSortOrder('SlaDeadlineAt'),
        render: (_, record) => {
          const slaLabel = getViolationSlaLabel(record, t);
          return <span className="inspection-violations__sla-text" title={slaLabel}>{slaLabel}</span>;
        },
      },
      {
        title: t('inspection.violation.columns.sourceTask'),
        dataIndex: 'taskNo',
        className: 'inspection-violations__source-task-column',
        width: pxToRemValue(activeColumnWidths.sourceTask),
        render: (_, record) => {
          const sourceTask = getSourceTaskLabel(record);
          const sourceTaskTarget = getSourceTaskNavigationTarget(record);

          if (!sourceTaskTarget) {
            return <span className="inspection-violations__source-task" title={sourceTask}>{sourceTask}</span>;
          }

          return (
            <Button
              type="link"
              className="inspection-violations__source-task-button"
              title={sourceTask}
              onClick={(event) => {
                event.stopPropagation();
                navigateToSourceTaskDetail(record);
              }}
            >
              <span className="inspection-violations__source-task" title={sourceTask}>{sourceTask}</span>
            </Button>
          );
        },
      },
      {
        title: t('inspection.violation.columns.reportedBy'),
        width: pxToRemValue(activeColumnWidths.reportedBy),
        render: (_, record) => {
          const reportedBy = getReportedBy(record);
          return <span className="inspection-violations__reported-by" title={reportedBy}>{reportedBy}</span>;
        },
      },
      {
        title: t('inspection.violation.columns.creationTime'),
        key: 'CreatedOn',
        width: pxToRemValue(activeColumnWidths.creationTime),
        sorter: true,
        sortOrder: resolveViolationSortOrder('CreatedOn'),
        render: (_, record) => getCreatedAtLabel(record),
      },
    ];

    const actionColumn: ColumnsType<InspectionViolationItem>[number] = {
      title: t('inspection.violation.columns.actions'),
      key: 'actions',
      className: 'inspection-violations__actions-column',
      width: violationActionColumnWidth,
      fixed: 'right',
      render: (_, record) => {
          return (
            <ViolationActionsCell
              record={record}
              translate={t}
              visibleDropdownKey={visibleActionDropdownKey}
              approvingViolationId={approvingViolationId}
              downloadingReportViolationId={downloadingReportViolationId}
              onDropdownVisibleChange={handleActionDropdownVisibleChange}
              onRunAction={runViolationAction}
            />
          );
      },
    };

    return [
      ...baseColumns,
      actionColumn,
    ];
  }, [approvingViolationId, activeColumnWidths, downloadingReportViolationId, handleActionDropdownVisibleChange, navigateToSourceTaskDetail, resolveViolationSortOrder, runViolationAction, t, violationActionColumnWidth, visibleActionDropdownKey]);

  return (
    <div className="inspection-violations" dir={i18n.resolvedLanguage === 'ar' ? 'rtl' : 'ltr'}>
      <div className={getStatGridClassName(roles)}>
        {statItems.map((item) => (
          <div className="inspection-violations__stat-card" key={item.labelKey}>
            <span className={`inspection-violations__stat-icon inspection-violations__stat-icon--${item.tone}`}>
              <img src={item.icon} alt="" />
            </span>
            <span className="inspection-violations__stat-copy">
              <strong>{formatNumber(getSummaryCount(summary, item.statuses))}</strong>
              <em>{t(item.labelKey)}</em>
            </span>
          </div>
        ))}
      </div>

      <div className={`inspection-violations__panel${showWorkTabs ? ' inspection-violations__panel--with-tabs' : ' inspection-violations__panel--plain'}`}>
        {showWorkTabs && activeWorkTab ? (
          <Tabs activeKey={activeWorkTab} onChange={updateWorkTab} className="inspection-violations__tabs">
            {availableWorkTabs.map((tab) => (
              <Tabs.TabPane
                key={tab}
                tab={t(violationWorkTabLabelKeys[tab])}
              />
            ))}
          </Tabs>
        ) : null}
        <div className="inspection-violations__toolbar">
          <div className="inspection-violations__toolbar-left">
            <div className="inspection-violations__search-wrap responsive-filter-toolbar__field--single-visible-search">
              <span className="inspection-violations__search-icon">
                <img src={inspectionFigmaAssets.violationSearchIcons.strokeA} alt="" />
                <img src={inspectionFigmaAssets.violationSearchIcons.strokeB} alt="" />
              </span>
              <Input
                allowClear
                bordered={false}
                placeholder={t('inspection.common.search')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPageIndex(1);
                }}
                onPressEnter={() => {
                  setPageIndex(1);
                  fetchViolations();
                }}
              />
            </div>
            <Select
              allowClear
              value={typeFilter}
              placeholder={t('inspection.violation.filters.allTypes')}
              className="inspection-violations__filter-select"
              dropdownClassName="inspection-violations__toolbar-select-dropdown"
              getPopupContainer={getSelectPopupContainer}
              optionLabelProp="label"
              onChange={(value: string | undefined) => {
                setTypeFilter(value);
                setPageIndex(1);
              }}
              onClear={() => {
                setTypeFilter(undefined);
                setPageIndex(1);
              }}
            >
              {typeFilterOptions.map(({ value, label }) => (
                <Select.Option key={value} value={value} label={label} title={label}>
                  {renderSelectOptionText(label)}
                </Select.Option>
              ))}
            </Select>
            <Select
              allowClear
              value={statusFilter}
              placeholder={t('inspection.violation.filters.allStatuses')}
              className="inspection-violations__filter-select"
              dropdownClassName="inspection-violations__toolbar-select-dropdown"
              getPopupContainer={getSelectPopupContainer}
              listHeight={360}
              optionLabelProp="label"
              onChange={(value: string | undefined) => {
                setStatusFilter(value);
                setPageIndex(1);
              }}
              onClear={() => {
                setStatusFilter(undefined);
                setPageIndex(1);
              }}
            >
              {statusFilterOptions.map(({ value, label }) => (
                <Select.Option value={value} key={value} label={label} title={label}>
                  {renderSelectOptionText(label)}
                </Select.Option>
              ))}
            </Select>
            <div className="inspection-violations__filter-actions">
              <Button
                className={[
                  'inspection-violations__toolbar-button',
                  'inspection-violations__outline-button',
                  'inspection-violations__filter-trigger',
                  hasAdvancedFilters ? 'inspection-violations__outline-button--active' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setFilterModalVisible(true)}
              >
                <span>{t('inspection.common.filter')}</span>
                <span className="inspection-violations__filter-icon">
                  <img src={inspectionFigmaAssets.violationFilterIcons.funnel} alt="" />
                </span>
                <FilterCountBadge count={appliedFilterCount} />
              </Button>
              <Button
                className="inspection-violations__toolbar-button inspection-violations__outline-button inspection-violations__reset-button"
                onClick={resetFilters}
              >
                {t('inspection.common.reset')}
              </Button>
            </div>
          </div>
          <div className="inspection-violations__toolbar-right">
            <PermissionGuard
              permissionCode={PERMISSION_CODES.inspection.violation.export}
              routePath={INSPECTION_PATHS.violations}
            >
              <Button
                className="inspection-violations__toolbar-button inspection-violations__outline-button"
                loading={exportLoading}
                disabled={exportLoading}
                onClick={handleExport}
              >
                {t('inspection.common.export')}
              </Button>
            </PermissionGuard>
          </div>
        </div>

        <Table
          className="inspection-violations__table admin-table"
          rowKey={getRowKey}
          loading={loading}
          columns={columns}
          dataSource={violations}
          tableLayout={showWorkTabs ? 'fixed' : undefined}
          scroll={{ x: tableScrollX }}
          showSorterTooltip={false}
          onChange={handleViolationTableChange}
          onRow={(record) => ({
            onClick: (event: React.MouseEvent<HTMLElement>) => {
              if (shouldIgnoreViolationRowClick(event)) return;
              navigateToViolationDetail(record);
            },
          })}
          pagination={{
            size: "default",
            current: pageIndex,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: false,
            pageSizeOptions: ['10', '20', '50'],
            position: ['bottomCenter'],
            showTotal: (totalValue: number) => <PaginationTotal label={t("common.total")} total={totalValue} current={pageIndex} pageSize={pageSize} />,
            onChange: (nextPage, nextSize) => {
              setPageIndex(nextPage);
              setPageSize(nextSize || 10);
            },
          }}
        />
      </div>

      <ViolationFilterModal
        visible={filterModalVisible}
        value={violationFilterModalValue}
        typeOptions={typeFilterOptions}
        statusOptions={statusFilterOptions}
        reportedByOptions={reportedByOptions}
        onCancel={() => setFilterModalVisible(false)}
        onApply={handleApplyAdvancedFilters}
      />

      <ViolationWorkflowModal
        title={workflowAction ? t(getActionTitleKey(workflowAction)) : t('inspection.violation.detail.workflow')}
        visible={Boolean(workflowAction)}
        loading={workflowSubmitting}
        confirmText={workflowAction ? t(getActionTitleKey(workflowAction)) : t('inspection.common.save')}
        initialValues={workflowInitialValues}
        statusOptions={workflowStatusOptions}
        getStatusLabel={getViolationStatusLabel}
        onCancel={closeWorkflow}
        onSubmit={submitWorkflow}
      />

      <InspectionViolationApproveSuccessModal
        visible={approveSuccessModalVisible}
        onOk={closeApproveSuccessModal}
        onCancel={closeApproveSuccessModal}
      />
    </div>
  );
};

export default InspectionViolationsPage;
