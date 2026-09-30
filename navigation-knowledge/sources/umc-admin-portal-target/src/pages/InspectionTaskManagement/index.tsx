/* eslint-disable @typescript-eslint/no-explicit-any */
import { fromApi } from "@/utils/gstTime";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Select,
  Table,
  Tabs,
  Tag,
} from 'antd';
import type { ColumnsType, TableProps } from 'antd/lib/table';
import i18next from 'i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CustomMessage, PermissionGuard } from '@/components/common';
import { PERMISSION_CODES } from '@/constants/permissionCodes';
import PaginationTotal from '@/components/common/PaginationTotal';
import EmptyBox from '@/components/common/EmptyBox/EmptyBox';
import AdaptiveActionGroup, {
  type AdaptiveActionItem,
} from '@/components/common/AdaptiveActionGroup';
import { resolveAdaptiveActionLayout } from '@/components/common/AdaptiveActionGroup/layout';
import { useFilter } from '@/components/common/FilterTable';
import useKeepAliveActivated from '@/components/KeepAlive/useKeepAliveActivated';
import useKeepAliveRouteState from '@/components/KeepAlive/useKeepAliveRouteState';
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from '@/hooks/useResponsiveActionColumnWidth';
import { pxToRemValue } from '@/utils/rem';
import {
  assignInspectionTask,
  batchAssignInspectionTasks,
  cancelInspectionTask,
  duplicateInspectionTask,
  exportInspectionTasks,
  getInspectionCreatedByUsers,
  getInspectionEmirates,
  getInspectionCampaignFilterOptions,
  getInspectionMethods,
  getInspectionPriorities,
  getInspectionReasons,
  getInspectionTaskDetail,
  getInspectionTaskStatuses,
  getInspectionTaskList,
  isInspectionDataMissingError,
  normalizeInspectionExecutionStep,
  type InspectionGeoLookupOption,
  type InspectionLookupOption,
  type InspectionPriorityLookupOption,
  type InspectionReasonLookupOption,
} from '@/services/inspection';
import {
  getInspectionTeamManagementSummary,
  type InspectionTeamManagementSummaryDto,
} from '@/services/inspectionTeamManagement';
import {
  buildInspectionPath,
  getAssigneeName,
  getInspectionCreatorLabel,
  getInspectionQuery,
  getPriorityClassName,
  getPriorityLabel,
  getStatusClassName,
  getTaskEmirateName,
  getTaskStatusLabel,
  getTaskTargetName,
  normalizeTaskStatus,
} from '../InspectionCommon/helpers';
import {
  INSPECTION_PATHS,
  INSPECTION_QUERY_KEYS,
  INSPECTION_ROUTE_STATE_KEYS,
  TASK_STATUSES,
} from '../InspectionCommon/constants';
import { inspectionFigmaAssets } from '../InspectionCommon/assets';
import {
  isInspectionTaskRole,
  useInspectionAccess,
  type InspectionRole,
} from '../InspectionCommon/access';
import { getInspectionTargetIcon } from '../InspectionCommon/targetIcon';
import {
  getInspectionTaskActionKeys,
  type InspectionTaskActionKey,
} from '../InspectionCommon/taskActions';
import { useButtonPermission } from '@/routes/access';
import { downloadBlobFile, downloadCsvFile } from '../InspectionCommon/csvExport';
import refundFilterFunnelIcon from '../CustomerRefunds/assets/icons/filter_funnel_stroke.svg';
import refundSearchStrokeHandleIcon from '../CustomerRefunds/assets/icons/search_stroke_1.svg';
import refundSearchStrokeBodyIcon from '../CustomerRefunds/assets/icons/search_stroke_2.svg';
import AssignTaskModal from './components/AssignTaskModal';
import CancelTaskModal from './components/CancelTaskModal';
import CreateTaskModal, { type TaskModalMode } from './components/CreateTaskModal';
import DuplicateTaskWarningModal from './components/DuplicateTaskWarningModal';
import TaskFilterModal, { type TaskFilterState } from './components/TaskFilterModal';
import InspectionReportModal from '../InspectionTaskDetails/components/InspectionReportModal';
import { TeamManagementContent } from '../TeamManagement';
import InspectionTeamTasksPanel from '../TeamManagement/components/InspectionTeamTasksPanel';
import type {
  TeamManagementControlledTaskPanelConfig,
  TeamManagementTaskSourceOption,
} from '../TeamManagement/type';
import {
  duplicateWarningReasonKeys,
} from './taskConfig';
import '../InspectionTaskDetails/index.less';
import FilterCountBadge from '@/components/common/FilterCountBadge';
import './index.less';

type TaskRecord = Record<string, any>;
type TaskRole = Extract<InspectionRole, 'inspector' | 'manager'>;
type TaskActionColumnKey =
  | 'assign'
  | 'start'
  | 'continue'
  | 'edit'
  | 'cancel'
  | 'duplicate'
  | 'report'
  | 'more';
type TaskSummaryCardKey = 'queued' | 'pendingVisit' | 'inProgress' | 'accessFailed' | 'completed' | 'cancelled';
type TeamTaskView = 'todo' | 'completed';
type TeamTaskSource = 'inspection' | 'other';
type InspectionSortDirection = 'asc' | 'desc';
type TaskSortBy = 'DueDate' | 'CreatedOn' | 'AssignedOn' | 'LastUpdatedOn' | 'Priority' | 'SLA';
type TaskSortState = { sortBy?: TaskSortBy; sortDirection?: InspectionSortDirection };
type TaskFilterOption = { value: string; label: string };
type TaskReasonFilterValue = string | 'all';
type InspectionTeamTaskSummaryStats = {
  queuedCount: number;
  pendingVisitCount: number;
  inProgressCount: number;
  accessFailedCount: number;
  completedCount: number;
  cancelledCount: number;
};
type PermissionTaskTabKey = 'queued' | 'todo' | 'completed' | 'teamTasks' | 'teamMembers';
type PermissionTaskTab = {
  key: PermissionTaskTabKey;
  labelKey: string;
  permissionCode: string;
};

const getReportViolationNo = (record: Record<string, any>) => record?.violationNo;

const TEAM_TASK_SOURCE_OPTIONS: TeamManagementTaskSourceOption[] = [
  {
    key: 'inspection',
    labelKey: 'teamManagement.taskSources.inspectionTask',
    renderMode: 'default',
  },
  {
    key: 'other',
    labelKey: 'teamManagement.taskSources.otherTask',
    renderMode: 'default',
  },
];

const permissionTaskTabs: PermissionTaskTab[] = [
  {
    key: 'queued',
    labelKey: 'inspection.tasks.tabs.queued',
    permissionCode: 'Inspection.TaskManagement.Queued',
  },
  {
    key: 'todo',
    labelKey: 'inspection.tasks.tabs.todo',
    permissionCode: 'Inspection.TaskManagement.ToDo',
  },
  {
    key: 'completed',
    labelKey: 'inspection.tasks.tabs.completed',
    permissionCode: 'Inspection.TaskManagement.Completed',
  },
  {
    key: 'teamTasks',
    labelKey: 'inspection.tasks.tabs.teamTasks',
    permissionCode: 'Inspection.TaskManagement.TeamTasks',
  },
  {
    key: 'teamMembers',
    labelKey: 'inspection.tasks.tabs.teamMembers',
    permissionCode: 'Inspection.TaskManagement.TeamMembers',
  },
];

const isTeamManagementPermissionTab = (tabKey?: string | null) => (
  tabKey === 'teamTasks' || tabKey === 'teamMembers'
);

const TASK_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<TaskActionColumnKey> =
  {
    more: { default: 20, compact: 20 },
  };
const TASK_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 128,
  maxWidth: 280,
};
const TASK_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 112,
  maxWidth: 260,
};
const TASK_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: '500 16px Inter, sans-serif',
  narrowFont: '500 14px Inter, sans-serif',
  textPadding: 0,
};

type TaskAction = AdaptiveActionItem<TaskActionColumnKey>;

type DuplicateTaskWarningState = {
  visible: boolean;
  message: string;
  loading: boolean;
  onConfirm?: () => void | Promise<void>;
};

const createClosedDuplicateTaskWarningState = (): DuplicateTaskWarningState => ({
  visible: false,
  message: '',
  loading: false,
  onConfirm: undefined,
});

const unwrapPayload = <T,>(response: any): T => response?.data ?? response;
const getSelectPopupContainer = () => document.body;
const getTaskRecordKey = (record?: TaskRecord | null) => String(record?.taskId || record?.taskNo || '');
const getOptionalBooleanFlag = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
};
const DEFAULT_TASK_SORT: TaskSortState = {
  sortBy: 'DueDate',
  sortDirection: 'asc',
};
const DEFAULT_ASSIGNED_TASK_SORT: TaskSortState = {
  sortBy: undefined,
  sortDirection: undefined,
};
const DEFAULT_COMPLETED_TASK_SORT: TaskSortState = {
  sortBy: 'LastUpdatedOn',
  sortDirection: 'desc',
};
const TASK_TIMELINE_SORT_FIELDS = new Set<TaskSortBy>(['CreatedOn', 'AssignedOn', 'LastUpdatedOn']);
const getDefaultTaskSort = (tab: string): TaskSortState => {
  if (tab === 'completed') return DEFAULT_COMPLETED_TASK_SORT;
  if (tab === 'todo') return DEFAULT_ASSIGNED_TASK_SORT;
  return DEFAULT_TASK_SORT;
};
const getTaskSortTab = (tab: string) => (tab === 'teamTasks' ? 'todo' : tab);
const getInspectionReasonLabel = (option?: InspectionReasonLookupOption | null) =>
  String(option?.nameEn || option?.name || option?.code || option?.id || '').trim();
const getInspectionReasonFilterValue = (option?: InspectionReasonLookupOption | null) =>
  String(option?.code ?? '').trim();
const getInspectionPriorityLabel = (option?: InspectionPriorityLookupOption | null) =>
  String(option?.nameEn || option?.name || option?.code || option?.id || '').trim();
const getInspectionLookupLabel = (option?: InspectionLookupOption | null) =>
  String(option?.nameEn || option?.name || option?.code || option?.id || '').trim();
const toFilterOption = (option: InspectionLookupOption): TaskFilterOption | null => {
  const value = String(option.id || '').trim();
  const label = getInspectionLookupLabel(option);
  return value && label ? { value, label } : null;
};
const toFilterOptions = (options: InspectionLookupOption[]): TaskFilterOption[] => (
  options.map(toFilterOption).filter((item): item is TaskFilterOption => Boolean(item))
);
const queuedStatusFilterCodes = new Set(['QUEUED']);
const todoStatusFilterCodes = new Set(['PENDING_VISIT', 'IN_PROGRESS']);
const completedStatusFilterCodes = new Set(['ACCESS_FAILED', 'COMPLETED', 'CANCELLED']);
const allFilteredStatusCodes = new Set([
  ...Array.from(queuedStatusFilterCodes),
  ...Array.from(todoStatusFilterCodes),
  ...Array.from(completedStatusFilterCodes),
]);

const getAllowedStatusFilterCodes = (
  activeTab: string,
  activeTeamTaskView: TeamTaskView,
): ReadonlySet<string> | undefined => {
  const tabKey = activeTab === 'teamTasks' ? activeTeamTaskView : activeTab;
  if (tabKey === 'queued') return queuedStatusFilterCodes;
  if (tabKey === 'todo') return todoStatusFilterCodes;
  if (tabKey === 'completed') return completedStatusFilterCodes;
  return undefined;
};

const getInspectionStatusFilterCode = (option: InspectionLookupOption) => {
  const candidates = [option.code, option.nameEn, option.name, option.id];
  for (const candidate of candidates) {
    const rawStatus = String(candidate || '').trim();
    if (!rawStatus) continue;

    const statusCode = normalizeTaskStatus(rawStatus);
    if (allFilteredStatusCodes.has(statusCode)) return statusCode;
  }
  return '';
};

const EMPTY_INSPECTION_TEAM_TASK_SUMMARY_STATS: InspectionTeamTaskSummaryStats = {
  queuedCount: 0,
  pendingVisitCount: 0,
  inProgressCount: 0,
  accessFailedCount: 0,
  completedCount: 0,
  cancelledCount: 0,
};

const normalizeInspectionTeamSummaryKey = (value?: string | null) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
);

const applyInspectionTeamSummaryStatusCount = (
  summary: InspectionTeamTaskSummaryStats,
  normalizedKey: string,
  count: number,
) => {
  if (!Number.isFinite(count)) return;

  if (normalizedKey === 'queued') summary.queuedCount = count;
  if (normalizedKey === 'pendingvisit') summary.pendingVisitCount = count;
  if (normalizedKey === 'inprogress') summary.inProgressCount = count;
  if (normalizedKey === 'accessfailed') summary.accessFailedCount = count;
  if (normalizedKey === 'completed') summary.completedCount = count;
  if (normalizedKey === 'cancelled' || normalizedKey === 'canceled') {
    summary.cancelledCount = count;
  }
};

const mapInspectionTeamManagementSummaryToInspectionStats = (
  summary?: InspectionTeamManagementSummaryDto | null,
): InspectionTeamTaskSummaryStats => {
  const nextSummary = {
    ...EMPTY_INSPECTION_TEAM_TASK_SUMMARY_STATS,
  };
  const rawSummary = summary as InspectionTeamManagementSummaryDto & Record<string, any>;

  nextSummary.queuedCount = Number(rawSummary?.queuedCount ?? rawSummary?.queued ?? 0);
  nextSummary.pendingVisitCount = Number(rawSummary?.pendingVisitCount ?? rawSummary?.pendingVisit ?? 0);
  nextSummary.inProgressCount = Number(rawSummary?.inProgressCount ?? rawSummary?.inProgress ?? 0);
  nextSummary.accessFailedCount = Number(rawSummary?.accessFailedCount ?? rawSummary?.accessFailed ?? 0);
  nextSummary.completedCount = Number(rawSummary?.completedCount ?? rawSummary?.completed ?? 0);
  nextSummary.cancelledCount = Number(rawSummary?.cancelledCount ?? rawSummary?.cancelled ?? 0);

  (summary?.categories || []).forEach((item) => {
    const normalizedKey = normalizeInspectionTeamSummaryKey(
      item?.categoryDisplay || item?.category,
    );
    const count = Number(
      item?.todoCount ??
        item?.completedCount ??
        (item as Record<string, any>)?.count ??
        0,
    );
    applyInspectionTeamSummaryStatusCount(nextSummary, normalizedKey, count);
  });

  (summary?.statusCards || []).forEach((item) => {
    const normalizedKey = normalizeInspectionTeamSummaryKey(
      item?.code,
    );
    const count = Number(item?.count ?? 0);
    applyInspectionTeamSummaryStatusCount(nextSummary, normalizedKey, count);
  });

  return nextSummary;
};

const shouldIgnoreTaskRowClick = (event: React.MouseEvent<HTMLElement>) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;

  if (target.closest([
    'a',
    'button',
    'input',
    'textarea',
    'select',
    '[role="button"]',
    '.ant-checkbox',
    '.ant-checkbox-wrapper',
    '.ant-dropdown-trigger',
    '.ant-select',
    '.inspection-task-management__actions',
    '.inspection-task-management__actions-column',
  ].join(','))) {
    return true;
  }

  const cell = target.closest('td');
  return Boolean(
    cell?.classList.contains('ant-table-selection-column') ||
    cell?.classList.contains('inspection-task-management__actions-column') ||
    cell?.classList.contains('ant-table-cell-fix-right'),
  );
};

const renderSelectOptionText = (label: string) => (
  <span className="inspection-task-management__select-option-text" title={label}>
    {label}
  </span>
);

const taskSummaryIconClassNames: Record<TaskSummaryCardKey, string> = {
  queued: 'inspection-task-management__stat-icon--queued',
  pendingVisit: 'inspection-task-management__stat-icon--pending-visit',
  inProgress: 'inspection-task-management__stat-icon--in-progress',
  accessFailed: 'inspection-task-management__stat-icon--access-failed',
  completed: 'inspection-task-management__stat-icon--completed',
  cancelled: 'inspection-task-management__stat-icon--cancelled',
};

const getTaskRoles = (roles: readonly InspectionRole[]) => (
  roles.filter(isInspectionTaskRole)
);

const getTaskRequestRole = (
  activeTab: string,
  roles: readonly TaskRole[],
): TaskRole | null => {
  if (activeTab === 'todo' || activeTab === 'completed') {
    return roles.includes('inspector') ? 'inspector' : roles[0] || null;
  }

  return roles.find((role) => role === 'manager') || roles[0] || null;
};

const sanitizeTaskFiltersForRole = (
  filters: TaskFilterState,
  canFilterInspector: boolean,
): TaskFilterState => {
  if (canFilterInspector || !filters.assignedInspector) return filters;

  return {
    ...filters,
    assignedInspector: undefined,
  };
};

const getCreatedByLabel = (record?: TaskRecord) => {
  const creatorName = getInspectionCreatorLabel(record?.createdByName || record?.createdBy);
  if (creatorName) return creatorName;
  const sourceCode = String(record?.taskSource?.sourceTypeCode || '').toUpperCase();
  if (sourceCode === 'AUTO') return i18next.t('inspection.tasks.creators.autoGenerated');
  if (sourceCode === 'BATCH') return i18next.t('inspection.tasks.creators.batchGenerated');
  if (sourceCode === 'MANUAL') return record?.taskSource?.sourceTypeNameEn || i18next.t('inspection.tasks.creators.manual');
  return record?.taskSource?.sourceTypeNameEn || '-';
};

const getAuthorityName = (record?: TaskRecord) => {
  return record?.inspectionTarget?.address?.authorityNameEn || '-';
};

const getAreaName = (record?: TaskRecord) => {
  return record?.inspectionTarget?.address?.areaNameEn
    || record?.inspectionTarget?.address?.communityNameEn
    || '-';
};

const getInspectionMethodName = (record?: TaskRecord) => {
  return record?.inspectionConfig?.inspectionTypeNameEn ||
    record?.inspectionConfig?.inspectionTypeCode ||
    '-';
};

const getSlaText = (record?: TaskRecord, t?: (key: string, options?: Record<string, unknown>) => string) => {
  const displayText = String(record?.sla?.displayText || record?.slaLabel || '').trim();
  if (displayText) return displayText;
  const minutes = Number(record?.inspectionConfig?.slaMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return '-';
  const days = Math.max(1, Math.round(minutes / 1440));
  if (!t) return `${days} ${days === 1 ? 'day' : 'days'}`;
  return t(
    days === 1 ? 'inspection.tasks.columns.slaDay' : 'inspection.tasks.columns.slaDays',
    { count: days },
  );
};

const normalizeSlaTone = (value?: unknown) => (
  String(value || '')
    .trim()
    .replace(/[\s_-]+/g, '')
    .toLowerCase()
);

const getSlaColorClassName = (record?: TaskRecord, text?: string) => {
  const color = normalizeSlaTone(record?.sla?.color);
  if (['red', 'danger', 'overdue'].includes(color)) {
    return 'inspection-task-management__sla-cell--red';
  }
  if (['yellow', 'warning', 'duetoday'].includes(color)) {
    return 'inspection-task-management__sla-cell--yellow';
  }
  if (['default', 'normal'].includes(color)) return '';

  const statusCode = normalizeSlaTone(record?.sla?.statusCode);
  const displayText = normalizeSlaTone(text || getSlaText(record));
  if (statusCode.includes('overdue') || displayText.includes('overdue')) {
    return 'inspection-task-management__sla-cell--red';
  }
  if (statusCode.includes('duetoday') || displayText.includes('duetoday')) {
    return 'inspection-task-management__sla-cell--yellow';
  }
  return '';
};

const formatTaskDate = (value?: string) => {
  // Display backend Dubai wall-clock values without browser-timezone shifting.
  const d = value ? fromApi(value) : null;
  return d ? d.format('DD/MM/YYYY') : '-';
};

const formatTaskDateTime = (value?: string) => {
  const d = value ? fromApi(value) : null;
  return d ? d.format('DD/MM/YYYY HH:mm:ss') : '-';
};

const getTaskTimelineValue = (record: TaskRecord, activeTab: string) => {
  if (activeTab === 'completed') return record.lastUpdatedOn;
  if (activeTab === 'queued') return record.createdOn;
  return record.assignedOn;
};

const getTaskTimelineColumnLabel = (activeTab: string) => {
  if (activeTab === 'completed') return 'Last Update';
  if (activeTab === 'queued') return 'Creation Time';
  return 'Assigned Time';
};

const canAssign = (record: TaskRecord) => (
  normalizeTaskStatus(record.status) === 'QUEUED' &&
  record.assignment?.isAssigned === false
);

const buildTaskCsvRows = (tasks: TaskRecord[], activeTab: string) => [
  [
    'Task No.',
    'Inspection Target',
    'Inspection Reason',
    'Priority',
    'Due Date',
    'SLA',
    'Status',
    'Emirate',
    'Area',
    getTaskTimelineColumnLabel(activeTab),
    'Inspector',
    'Inspection Method',
    'Created By',
  ],
  ...tasks.map((task) => [
    task.taskNo,
    getTaskTargetName(task),
    task.inspectionConfig?.inspectionReasonNameEn || '-',
    getPriorityLabel(task.inspectionConfig?.priorityNameEn),
    formatTaskDate(task.inspectionConfig?.dueDate),
    getSlaText(task),
    getTaskStatusLabel(task.status),
    getTaskEmirateName(task),
    getAreaName(task),
    formatTaskDateTime(getTaskTimelineValue(task, activeTab)),
    getAssigneeName(task),
    getInspectionMethodName(task),
    getCreatedByLabel(task),
  ]),
];

const buildTaskSummaryCards = (canManageTasks: boolean, summary: any, t: (key: string) => string) => {
  const values = {
    queued: summary?.queuedCount ?? summary?.pendingAssignmentCount ?? 0,
    pendingVisit: summary?.pendingVisitCount ?? summary?.assignedCount ?? 0,
    inProgress: summary?.inProgressCount ?? 0,
    accessFailed: summary?.accessFailedCount ?? 0,
    completed: summary?.completedCount ?? 0,
    cancelled: summary?.cancelledCount ?? 0,
  };

  const inspectorCards = [
    { key: 'pendingVisit', label: t('inspection.status.task.pendingVisit'), value: values.pendingVisit, icon: inspectionFigmaAssets.taskStatIcons.pendingVisit },
    { key: 'inProgress', label: t('inspection.status.task.inProgress'), value: values.inProgress, icon: inspectionFigmaAssets.taskStatIcons.inProgress },
    { key: 'accessFailed', label: t('inspection.status.task.accessFailed'), value: values.accessFailed, icon: inspectionFigmaAssets.taskStatIcons.accessFailed },
    { key: 'completed', label: t('inspection.status.task.completed'), value: values.completed, icon: inspectionFigmaAssets.taskStatIcons.completed },
    { key: 'cancelled', label: t('inspection.status.task.cancelled'), value: values.cancelled, icon: inspectionFigmaAssets.taskStatIcons.cancelled },
  ];

  if (canManageTasks) {
    return [
      { key: 'queued', label: t('inspection.status.task.queued'), value: values.queued, icon: inspectionFigmaAssets.taskStatIcons.queued },
      ...inspectorCards,
    ];
  }

  return inspectorCards;
};

const TaskActions: React.FC<{ actions: TaskAction[] }> = ({ actions }) => {
  const { t } = useTranslation();
  return (
    <AdaptiveActionGroup
      actions={actions}
      maxInlineActions={2}
      moreLabel={t("common.moreActions")}
      className="inspection-task-management__actions"
      moreIcon={(
        <img
          className="inspection-task-management__more-icon"
          src={inspectionFigmaAssets.moreVerticalIcon}
          alt=""
        />
      )}
    />
  );
};

const InspectionTaskManagementPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation<{ [key: string]: unknown } | undefined>();
  const { t, i18n } = useTranslation();
  const { roles: inspectionRoles, inspectorId: currentInspectorId } = useInspectionAccess();
  const { activated, effectiveSearch } = useKeepAliveRouteState({
    restorePathname: INSPECTION_PATHS.tasks,
    restoreFrom: [
      INSPECTION_PATHS.taskDetail,
      INSPECTION_PATHS.taskExecution,
      INSPECTION_PATHS.report,
    ],
  });
  const query = useMemo(() => getInspectionQuery(effectiveSearch), [effectiveSearch]);
  const taskRoles = useMemo(() => getTaskRoles(inspectionRoles), [inspectionRoles]);
  const { canRenderButton } = useButtonPermission(INSPECTION_PATHS.tasks);
  const hasLegacyRoleQuery = useMemo(() => {
    const searchParams = new URLSearchParams(effectiveSearch);
    return searchParams.has(INSPECTION_QUERY_KEYS.scope) || searchParams.has(INSPECTION_QUERY_KEYS.role);
  }, [effectiveSearch]);
  const canAccessQueuedTab = canRenderButton('Inspection.TaskManagement.Queued');
  const canAccessTodoTab = canRenderButton('Inspection.TaskManagement.ToDo');
  const canAccessCompletedTab = canRenderButton('Inspection.TaskManagement.Completed');
  const canAccessTeamTasksTab = canRenderButton('Inspection.TaskManagement.TeamTasks');
  const canAccessTeamMembersTab = canRenderButton('Inspection.TaskManagement.TeamMembers');
  const canAssignTasks = canRenderButton(PERMISSION_CODES.inspection.task.assign);
  const availableTabs = useMemo(
    () => permissionTaskTabs.filter((tab) => canRenderButton(tab.permissionCode)),
    [canRenderButton],
  );
  const canManageTasks =
    canAccessQueuedTab || canAccessTeamTasksTab || canAccessTeamMembersTab;
  const canInspectAssignedTasks = canAccessTodoTab || canAccessCompletedTab;
  const requestTaskRoles = useMemo<TaskRole[]>(() => {
    const roles = [...taskRoles];
    if (canManageTasks && !roles.includes('manager')) roles.push('manager');
    if (canInspectAssignedTasks && !roles.includes('inspector')) roles.push('inspector');
    return roles;
  }, [canInspectAssignedTasks, canManageTasks, taskRoles]);
  const defaultTab = availableTabs[0]?.key || '';
  const requestedTab = query.tab || defaultTab;
  const activeTab = availableTabs.some((tab) => tab.key === requestedTab) ? requestedTab : defaultTab;
  const activeTeamTaskView: TeamTaskView = query.teamTab === 'completed' ? 'completed' : 'todo';
  const activeTeamTaskSource: TeamTaskSource = query.teamTaskSource === 'other' ? 'other' : 'inspection';
  const requestRole = getTaskRequestRole(activeTab, requestTaskRoles);
  const isTeamManagementTab = isTeamManagementPermissionTab(activeTab);
  const shouldSkipInspectionTaskFetch = isTeamManagementTab;
  const isManagerQueuedView = canManageTasks && activeTab === 'queued';
  const isInspectorSelfCreate = !canManageTasks && taskRoles.includes('inspector');
  const shouldShowSummaryCards = true;
  const effectiveTaskListTab = activeTab === 'teamTasks' ? activeTeamTaskView : activeTab;
  const routeState = useMemo(
    () => (location.state && typeof location.state === 'object' ? location.state as Record<string, unknown> : null),
    [location.state],
  );
  const [otherTodoFilterStore] = useFilter();
  const [otherCompletedFilterStore] = useFilter();
  const shouldResetFiltersOnCompletedReturn = Boolean(
    activated &&
    effectiveTaskListTab === 'completed' &&
    routeState?.[INSPECTION_ROUTE_STATE_KEYS.resetTaskFilters] === true,
  );
  const taskTimelineSortBy: TaskSortBy = effectiveTaskListTab === 'queued'
    ? 'CreatedOn'
    : effectiveTaskListTab === 'completed'
      ? 'LastUpdatedOn'
      : 'AssignedOn';
  const rootClassName = 'inspection-task-management';

  const [keyword, setKeyword] = useState('');
  const [reasonFilter, setReasonFilter] = useState<TaskReasonFilterValue | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [advancedFilters, setAdvancedFilters] = useState<TaskFilterState>({});
  const [taskSortBy, setTaskSortBy] = useState<TaskSortBy | undefined>(() => getDefaultTaskSort(effectiveTaskListTab).sortBy);
  const [taskSortDirection, setTaskSortDirection] = useState<InspectionSortDirection | undefined>(() => getDefaultTaskSort(effectiveTaskListTab).sortDirection);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<TaskRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState<TaskModalMode>('create');
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [inspectionTeamTasksRefreshToken, setInspectionTeamTasksRefreshToken] = useState(0);
  const [assigningTask, setAssigningTask] = useState<TaskRecord | null>(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [cancelTaskModalVisible, setCancelTaskModalVisible] = useState(false);
  const [cancellingTask, setCancellingTask] = useState<TaskRecord | null>(null);
  const [cancelTaskLoading, setCancelTaskLoading] = useState(false);
  const [duplicateTaskWarning, setDuplicateTaskWarning] = useState<DuplicateTaskWarningState>(() => createClosedDuplicateTaskWarningState());
  const [reportLoadingTaskKey, setReportLoadingTaskKey] = useState('');
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTaskDetail, setReportTaskDetail] = useState<TaskRecord | null>(null);
  const duplicateTaskWarningLoading = duplicateTaskWarning.loading;
  const duplicateTaskWarningConfirm = duplicateTaskWarning.onConfirm;
  const [inspectionReasonOptions, setInspectionReasonOptions] = useState<InspectionReasonLookupOption[]>([]);
  const [inspectionStatusOptions, setInspectionStatusOptions] = useState<InspectionLookupOption[]>([]);
  const [inspectionMethodOptions, setInspectionMethodOptions] = useState<InspectionLookupOption[]>([]);
  const [inspectionEmirateOptions, setInspectionEmirateOptions] = useState<InspectionGeoLookupOption[]>([]);
  const [inspectionAreaOptions, setInspectionAreaOptions] = useState<InspectionGeoLookupOption[]>([]);
  const areaFilterRequestRef = useRef(0);
  const [createdByOptions, setCreatedByOptions] = useState<InspectionLookupOption[]>([]);
  const [inspectionPriorityOptions, setInspectionPriorityOptions] = useState<InspectionPriorityLookupOption[]>([]);
  const [completedReturnResetPending, setCompletedReturnResetPending] = useState(false);
  const taskSummaryCards = useMemo(() => buildTaskSummaryCards(canManageTasks, summary, t), [canManageTasks, summary, t]);
  const reasonFilterOptions = useMemo(() => inspectionReasonOptions
    .map((item) => ({
      value: getInspectionReasonFilterValue(item),
      label: getInspectionReasonLabel(item),
    }))
    .filter((item) => item.value && item.label), [inspectionReasonOptions]);
  const allowedStatusFilterCodes = useMemo(
    () => getAllowedStatusFilterCodes(activeTab, activeTeamTaskView),
    [activeTab, activeTeamTaskView],
  );
  const statusFilterOptions = useMemo(() => {
    const filteredStatusOptions = allowedStatusFilterCodes
      ? inspectionStatusOptions.filter((item) => (
        allowedStatusFilterCodes.has(getInspectionStatusFilterCode(item))
      ))
      : inspectionStatusOptions;
    const lookupOptions = toFilterOptions(filteredStatusOptions);
    if (lookupOptions.length) return lookupOptions;
    return TASK_STATUSES
      .filter((status) => !allowedStatusFilterCodes || allowedStatusFilterCodes.has(normalizeTaskStatus(status)))
      .map((status) => ({
        value: status,
        label: getTaskStatusLabel(status),
      }));
  }, [allowedStatusFilterCodes, inspectionStatusOptions]);
  const emirateFilterOptions = useMemo(() => toFilterOptions(inspectionEmirateOptions), [inspectionEmirateOptions]);
  const areaFilterOptions = useMemo(() => toFilterOptions(inspectionAreaOptions), [inspectionAreaOptions]);
  const methodFilterOptions = useMemo(() => toFilterOptions(inspectionMethodOptions), [inspectionMethodOptions]);
  const priorityFilterOptions = useMemo(() => inspectionPriorityOptions
    .map((option) => ({
      value: String(option.code || '').trim(),
      label: getInspectionPriorityLabel(option),
    }))
    .filter((item) => item.value && item.label), [inspectionPriorityOptions]);
  const createdByFilterOptions = useMemo(() => toFilterOptions(createdByOptions), [createdByOptions]);
  const duplicateWarningReasonLabels = useMemo(
    () => duplicateWarningReasonKeys.map((key) => t(`inspection.tasks.reasons.${key}`)),
    [t],
  );
  const roleAwareAdvancedFilters = useMemo(
    () => sanitizeTaskFiltersForRole(advancedFilters, canManageTasks),
    [advancedFilters, canManageTasks],
  );
  const taskFilterModalValue = useMemo(
    () => ({
      ...roleAwareAdvancedFilters,
      reason: reasonFilter,
      status: statusFilter,
    }),
    [reasonFilter, roleAwareAdvancedFilters, statusFilter],
  );
  const activeOtherTaskFilterStore =
    activeTeamTaskView === 'completed'
      ? otherCompletedFilterStore
      : otherTodoFilterStore;

  const getFetchTab = useCallback(() => {
    if (activeTab === 'teamTasks') return activeTeamTaskView;
    return activeTab;
  }, [activeTab, activeTeamTaskView]);

  const fetchTaskSummary = useCallback(async () => {
    if (!canManageTasks) return;

    try {
      const payload = await getInspectionTeamManagementSummary();
      setSummary(mapInspectionTeamManagementSummaryToInspectionStats(payload));
    } catch (error) {
      if (isInspectionDataMissingError(error)) {
        setSummary(null);
        return;
      }
      CustomMessage.error(i18n.t('inspection.tasks.messages.loadFailed'));
    }
  }, [canManageTasks, i18n]);

  const resetOtherTaskView = useCallback((view: TeamTaskView) => {
    const targetFilterStore = view === 'completed'
      ? otherCompletedFilterStore
      : otherTodoFilterStore;
    targetFilterStore.resetFields();
  }, [otherCompletedFilterStore, otherTodoFilterStore]);

  const buildRequestFilters = useCallback(() => {
    const filters: Record<string, any> = {};
    if (reasonFilter !== undefined && reasonFilter !== 'all') filters.inspectionReasonId = reasonFilter;
    if (statusFilter && statusFilter !== 'all') {
      const statusId = Number(statusFilter);
      if (Number.isFinite(statusId)) {
        filters.statusIds = [statusId];
      } else {
        filters.statuses = [statusFilter];
      }
    }
    if (roleAwareAdvancedFilters.emirate) filters.emirates = [roleAwareAdvancedFilters.emirate];
    if (roleAwareAdvancedFilters.area) filters.areaIds = [roleAwareAdvancedFilters.area];
    if (roleAwareAdvancedFilters.inspectionMethod) filters.inspectionMethodIds = [roleAwareAdvancedFilters.inspectionMethod];
    if (roleAwareAdvancedFilters.priority) {
      filters.priorityIds = [roleAwareAdvancedFilters.priority];
    }
    if (roleAwareAdvancedFilters.assignedInspector) filters.inspectorIds = [roleAwareAdvancedFilters.assignedInspector];
    if (roleAwareAdvancedFilters.createdBy) filters.createdBy = roleAwareAdvancedFilters.createdBy;
    if (roleAwareAdvancedFilters.creationTimeRange?.length === 2) {
      filters.dateFrom = roleAwareAdvancedFilters.creationTimeRange[0]?.format?.('YYYY-MM-DD[T]00:00:00');
      filters.dateTo = roleAwareAdvancedFilters.creationTimeRange[1]?.format?.('YYYY-MM-DD[T]23:59:59');
    }
    if (roleAwareAdvancedFilters.dueDateRange?.length === 2) {
      filters.dueDateFrom = roleAwareAdvancedFilters.dueDateRange[0]?.format?.('YYYY-MM-DD[T]00:00:00');
      filters.dueDateTo = roleAwareAdvancedFilters.dueDateRange[1]?.format?.('YYYY-MM-DD[T]23:59:59');
    }
    return filters;
  }, [reasonFilter, roleAwareAdvancedFilters, statusFilter]);

  const fetchTasks = useCallback(async () => {
    if (shouldSkipInspectionTaskFetch) {
      setTableData([]);
      setTotal(0);
      await fetchTaskSummary();
      return;
    }

    if (!activeTab || !requestRole) {
      setTableData([]);
      setTotal(0);
      setSummary(null);
      return;
    }

    setLoading(true);
    try {
      const filters = buildRequestFilters();
      const payload = unwrapPayload<any>(
        await getInspectionTaskList({
          role: requestRole,
          tab: getFetchTab(),
          view: query.view,
          pageIndex,
          pageSize,
          keyword: keyword || undefined,
          filters: Object.keys(filters).length ? filters : undefined,
          sortBy: taskSortBy,
          sortDirection: taskSortDirection,
        } as any),
      );
      setTableData(payload?.items || []);
      setTotal(payload?.total || 0);
      if (canManageTasks) {
      await fetchTaskSummary();
      } else {
      setSummary(payload?.summary || null);
      }
    } catch (error) {
      if (isInspectionDataMissingError(error)) {
        setTableData([]);
        setTotal(0);
        setSummary(null);
        return;
      }
      CustomMessage.error(i18n.t('inspection.tasks.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, buildRequestFilters, fetchTaskSummary, getFetchTab, i18n, keyword, pageIndex, pageSize, query.view, requestRole, shouldSkipInspectionTaskFetch, taskSortBy, taskSortDirection]);

  useEffect(() => {
    if (!activated) return;

    const nextPatch: Record<string, string | null | undefined> = {
      [INSPECTION_QUERY_KEYS.role]: null,
      [INSPECTION_QUERY_KEYS.scope]: null,
    };
    let shouldReplace = hasLegacyRoleQuery;
    let resolvedTab = query.tab || defaultTab;

    if (!query.tab && defaultTab) {
      nextPatch.tab = defaultTab;
      resolvedTab = defaultTab;
      shouldReplace = true;
    }

    if (query.tab && !availableTabs.some((item) => item.key === query.tab)) {
      nextPatch.tab = defaultTab || null;
      resolvedTab = defaultTab;
      shouldReplace = true;
    }

    if (query.teamTab && resolvedTab !== 'teamTasks') {
      nextPatch[INSPECTION_QUERY_KEYS.teamTab] = null;
      shouldReplace = true;
    }

    if (query.teamTaskSource && resolvedTab !== 'teamTasks') {
      nextPatch[INSPECTION_QUERY_KEYS.teamTaskSource] = null;
      shouldReplace = true;
    }

    if (shouldReplace) {
      history.replace(buildInspectionPath(INSPECTION_PATHS.tasks, effectiveSearch, nextPatch));
    }
  }, [activated, availableTabs, defaultTab, effectiveSearch, hasLegacyRoleQuery, history, query.tab, query.teamTab, query.teamTaskSource]);

  useEffect(() => {
    setAdvancedFilters((previous) => sanitizeTaskFiltersForRole(previous, canManageTasks));
  }, [canManageTasks]);

  useEffect(() => {
    if (!statusFilter) return;
    if (statusFilter === 'all') return;

    const hasSelectedStatusOption = statusFilterOptions.some((item) => item.value === statusFilter);
    if (!hasSelectedStatusOption) {
      setStatusFilter(undefined);
      setPageIndex(1);
    }
  }, [statusFilter, statusFilterOptions]);

  useEffect(() => {
    setSelectedRowKeys([]);
    setPageIndex(1);
  }, [activeTab, activeTeamTaskView]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getInspectionReasons().catch(() => []),
      getInspectionTaskStatuses().catch(() => []),
      getInspectionMethods().catch(() => []),
      getInspectionEmirates().catch(() => []),
      getInspectionPriorities().catch(() => []),
    ]).then(([reasonOptions, statusOptions, methodOptions, emirateOptions, priorityOptions]) => {
      if (!cancelled) {
        setInspectionReasonOptions(reasonOptions);
        setInspectionStatusOptions(statusOptions);
        setInspectionMethodOptions(methodOptions);
        setInspectionEmirateOptions(emirateOptions);
        setInspectionPriorityOptions(priorityOptions);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (shouldResetFiltersOnCompletedReturn || completedReturnResetPending) return;
    fetchTasks();
  }, [completedReturnResetPending, fetchTasks, shouldResetFiltersOnCompletedReturn]);

  useKeepAliveActivated({
    onActivated: () => {
      if (shouldResetFiltersOnCompletedReturn || completedReturnResetPending) return;
      void fetchTasks();
    },
    onDeactivated: () => {
      setTaskModalVisible(false);
      setEditingTask(null);
      setAssignModalVisible(false);
      setAssigningTask(null);
      setFilterModalVisible(false);
      setCancelTaskModalVisible(false);
      setCancellingTask(null);
      setCancelTaskLoading(false);
      setDuplicateTaskWarning(createClosedDuplicateTaskWarningState());
      setReportModalVisible(false);
      setReportTaskDetail(null);
      setReportLoadingTaskKey('');
      setSelectedRowKeys([]);
    },
  });

  const navigateTo = useCallback((pathname: string, patch: Record<string, string | number | null | undefined>) => {
    history.push(buildInspectionPath(pathname, effectiveSearch, {
      [INSPECTION_QUERY_KEYS.role]: null,
      [INSPECTION_QUERY_KEYS.scope]: null,
      ...patch,
    }));
  }, [effectiveSearch, history]);

  const navigateToTaskDetail = useCallback((record: TaskRecord) => {
    navigateTo(INSPECTION_PATHS.taskDetail, {
      taskId: record.taskId,
      taskNo: record.taskNo,
      from: 'tasks',
      tab: null,
      visitId: null,
      step: null,
      mode: null,
      reportNo: null,
      [INSPECTION_QUERY_KEYS.teamTab]: null,
    });
  }, [navigateTo]);

  const getRecordExecutionStep = useCallback((record: TaskRecord) => (
    normalizeInspectionExecutionStep(
      record.executionState?.currentStepKey ||
      record.executionState?.currentStepCode ||
      record.executionState?.currentStep ||
      record.currentStepKey ||
      record.currentStepCode ||
      record.currentStep,
      record.executionState?.currentStepId || record.currentStepId,
    )
  ), []);

  const getExecutionNavigationStep = useCallback((record: TaskRecord, mode: 'start' | 'continue') => (
    mode === 'start' ? 'targetAccess' : getRecordExecutionStep(record)
  ), [getRecordExecutionStep]);

  const navigateToExecution = useCallback((record: TaskRecord, mode: 'start' | 'continue') => {
    const step = getExecutionNavigationStep(record, mode);
    navigateTo(INSPECTION_PATHS.taskExecution, {
      from: 'tasks',
      taskId: record.taskId,
      taskNo: record.taskNo,
      visitId: record.visitId || `VIS-${record.taskId}`,
      step,
      mode,
      reportNo: null,
    });
  }, [getExecutionNavigationStep, navigateTo]);

  const handleViewReport = useCallback(async (record: TaskRecord) => {
    const taskKey = getTaskRecordKey(record);
    if (!record.taskId && !record.taskNo) return;

    setReportLoadingTaskKey(taskKey);
    setReportTaskDetail(record);
    setReportModalVisible(true);
    try {
      const payload = unwrapPayload<any>(await getInspectionTaskDetail({
        taskId: record.taskId,
        taskNo: record.taskNo,
      } as any, { includeFragments: ['report'] }));
      setReportTaskDetail(payload || record);
    } catch (error) {
      if (!isInspectionDataMissingError(error)) {
        CustomMessage.error(t('inspection.taskDetail.detailsUnavailable'));
      }
    } finally {
      setReportLoadingTaskKey((currentKey) => (currentKey === taskKey ? '' : currentKey));
    }
  }, [t]);

  const closeReportModal = useCallback(() => {
    setReportModalVisible(false);
    setReportTaskDetail(null);
  }, []);

  const handleReportViolationClick = useCallback((record: Record<string, any>) => {
    const violationId = record.violationId;
    const violationNo = getReportViolationNo(record);

    if (!violationId && !violationNo) return;

    navigateTo(INSPECTION_PATHS.violationDetail, {
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
      [INSPECTION_QUERY_KEYS.type]: record.violationTypeName as string | number | null | undefined,
      [INSPECTION_QUERY_KEYS.status]: (record.statusCode || record.statusName) as string | number | null | undefined,
    });
  }, [navigateTo]);

  const resetFilters = useCallback((tab = activeTab) => {
    const defaultSort = getDefaultTaskSort(getTaskSortTab(tab));

    setKeyword('');
    setReasonFilter(undefined);
    setStatusFilter(undefined);
    setAdvancedFilters({});
    setTaskSortBy(defaultSort.sortBy);
    setTaskSortDirection(defaultSort.sortDirection);
    setPageIndex(1);
  }, [activeTab]);

  const isTaskFilterStateReset = useMemo(() => {
    const defaultCompletedSort = getDefaultTaskSort('completed');
    return (
      keyword === '' &&
      reasonFilter === undefined &&
      statusFilter === undefined &&
      Object.keys(advancedFilters).length === 0 &&
      taskSortBy === defaultCompletedSort.sortBy &&
      taskSortDirection === defaultCompletedSort.sortDirection &&
      pageIndex === 1
    );
  }, [
    advancedFilters,
    keyword,
    pageIndex,
    reasonFilter,
    statusFilter,
    taskSortBy,
    taskSortDirection,
  ]);

  const clearCompletedReturnResetFlag = useCallback(() => {
    if (!routeState?.[INSPECTION_ROUTE_STATE_KEYS.resetTaskFilters]) return;

    const nextState = { ...routeState };
    delete nextState[INSPECTION_ROUTE_STATE_KEYS.resetTaskFilters];

    history.replace(
      `${location.pathname}${location.search}${location.hash || ''}`,
      Object.keys(nextState).length ? nextState : undefined,
    );
  }, [history, location.hash, location.pathname, location.search, routeState]);

  useEffect(() => {
    if (!shouldResetFiltersOnCompletedReturn || completedReturnResetPending) return;

    setCompletedReturnResetPending(true);
    resetFilters('completed');
  }, [completedReturnResetPending, resetFilters, shouldResetFiltersOnCompletedReturn]);

  useEffect(() => {
    if (!completedReturnResetPending || !isTaskFilterStateReset) return;

    clearCompletedReturnResetFlag();
    setCompletedReturnResetPending(false);
  }, [clearCompletedReturnResetFlag, completedReturnResetPending, isTaskFilterStateReset]);

  const updateTab = useCallback((tab: string) => {
    resetFilters(tab);
    if (tab === 'teamTasks') {
      resetOtherTaskView('todo');
    }
    history.push(buildInspectionPath(INSPECTION_PATHS.tasks, effectiveSearch, {
      [INSPECTION_QUERY_KEYS.role]: null,
      [INSPECTION_QUERY_KEYS.scope]: null,
      tab,
      [INSPECTION_QUERY_KEYS.teamTab]: tab === 'teamTasks' ? 'todo' : null,
      [INSPECTION_QUERY_KEYS.teamTaskSource]: tab === 'teamTasks' ? 'inspection' : null,
    }));
  }, [effectiveSearch, history, resetFilters, resetOtherTaskView]);

  const updateTeamTaskView = useCallback((teamTab: string) => {
    resetFilters(teamTab);
    resetOtherTaskView(teamTab === 'completed' ? 'completed' : 'todo');
    history.push(buildInspectionPath(INSPECTION_PATHS.tasks, effectiveSearch, {
      [INSPECTION_QUERY_KEYS.role]: null,
      [INSPECTION_QUERY_KEYS.scope]: null,
      tab: 'teamTasks',
      [INSPECTION_QUERY_KEYS.teamTab]: teamTab,
      [INSPECTION_QUERY_KEYS.teamTaskSource]: activeTeamTaskSource,
    }));
  }, [
    activeTeamTaskSource,
    effectiveSearch,
    history,
    resetFilters,
    resetOtherTaskView,
  ]);

  const updateTeamTaskSource = useCallback((teamTaskSource: string) => {
    resetOtherTaskView(activeTeamTaskView);
    history.push(buildInspectionPath(INSPECTION_PATHS.tasks, effectiveSearch, {
      [INSPECTION_QUERY_KEYS.role]: null,
      [INSPECTION_QUERY_KEYS.scope]: null,
      tab: 'teamTasks',
      [INSPECTION_QUERY_KEYS.teamTab]: activeTeamTaskView,
      [INSPECTION_QUERY_KEYS.teamTaskSource]: teamTaskSource,
    }));
  }, [
    activeTeamTaskView,
    effectiveSearch,
    history,
    resetOtherTaskView,
  ]);

  const loadAreaFilterOptions = useCallback(async (emirate?: string) => {
    areaFilterRequestRef.current += 1;
    const requestId = areaFilterRequestRef.current;
    if (!emirate) {
      setInspectionAreaOptions([]);
      return;
    }

    const firstResponse = await getInspectionCampaignFilterOptions({
      emirateIds: [Number(emirate)],
      regionIds: [],
      areaIds: [],
      activityIds: [],
      includeActivities: false,
    }).catch(() => null);
    if (requestId !== areaFilterRequestRef.current) return;
    if (!firstResponse) {
      setInspectionAreaOptions([]);
      return;
    }
    setInspectionAreaOptions(firstResponse.areas);
  }, []);

  const loadCreatedByFilterOptions = useCallback(async () => {
    if (!requestRole) {
      setCreatedByOptions([]);
      return;
    }

    const filters = buildRequestFilters();
    delete filters.createdBy;
    delete filters.createdByTypes;

    const options = await getInspectionCreatedByUsers({
      role: requestRole,
      tab: getFetchTab(),
      view: query.view,
      pageIndex: 1,
      pageSize: pageSize,
      keyword: keyword || undefined,
      filters: Object.keys(filters).length ? filters : undefined,
      sortBy: taskSortBy,
      sortDirection: taskSortDirection,
    }).catch(() => []);
    setCreatedByOptions(options);
  }, [buildRequestFilters, getFetchTab, keyword, pageSize, query.view, requestRole, taskSortBy, taskSortDirection]);

  /**
   * How many attributes the filter modal currently has a value for. The modal
   * edits the whole TaskFilterState, so reason and status count here too even
   * though the toolbar also exposes them inline.
   */
  const appliedFilterCount = useMemo(() => {
    const hasValue = (value: unknown) => {
      if (value === undefined || value === null || value === "") return false;
      if (Array.isArray(value)) {
        return value.some((entry) => entry !== undefined && entry !== null && entry !== "");
      }
      return true;
    };

    return [
      reasonFilter,
      statusFilter,
      ...Object.values(roleAwareAdvancedFilters ?? {}),
    ].filter(hasValue).length;
  }, [reasonFilter, statusFilter, roleAwareAdvancedFilters]);

  const openFilterModal = useCallback(() => {
    setFilterModalVisible(true);
    void loadAreaFilterOptions(roleAwareAdvancedFilters.emirate);
    void loadCreatedByFilterOptions();
  }, [loadAreaFilterOptions, loadCreatedByFilterOptions, roleAwareAdvancedFilters.emirate]);

  const applyFilterModal = useCallback((values: TaskFilterState) => {
    const { reason, status, ...nextAdvancedFilters } = values;

    setReasonFilter(reason);
    setStatusFilter(status);
    setAdvancedFilters(sanitizeTaskFiltersForRole(nextAdvancedFilters, canManageTasks));
    setPageIndex(1);
    setFilterModalVisible(false);
  }, [canManageTasks]);

  const handleTaskModalVisibleChange = useCallback((nextVisible: boolean) => {
    setTaskModalVisible(nextVisible);
    if (!nextVisible) {
      setEditingTask(null);
    }
  }, []);

  const openTaskModal = useCallback((mode: TaskModalMode, task?: TaskRecord) => {
    setTaskModalMode(mode);
    setEditingTask(task || null);
    setTaskModalVisible(true);
  }, []);

  const handleTaskSubmitted = useCallback(async () => {
    await fetchTasks();
    if (activeTab === 'teamTasks' && activeTeamTaskSource === 'inspection') {
      setInspectionTeamTasksRefreshToken((value) => value + 1);
    }
  }, [activeTab, activeTeamTaskSource, fetchTasks]);

  const handleDuplicate = useCallback(async (record: TaskRecord) => {
    const submitDuplicate = async () => {
      await duplicateInspectionTask({ taskId: record.taskId } as any);
      CustomMessage.success(t('inspection.tasks.messages.duplicated'));
      await fetchTasks();
    };

    if (duplicateWarningReasonLabels.includes(record.inspectionConfig?.inspectionReasonNameEn)) {
      setDuplicateTaskWarning({
        visible: true,
        message: t('inspection.tasks.messages.duplicateWarningContent'),
        loading: false,
        onConfirm: submitDuplicate,
      });
      return;
    }

    await submitDuplicate();
  }, [duplicateWarningReasonLabels, fetchTasks, t]);

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

  const handleCancel = useCallback((record: TaskRecord) => {
    setCancellingTask(record);
    setCancelTaskLoading(false);
    setCancelTaskModalVisible(true);
  }, []);

  const closeCancelTaskModal = useCallback(() => {
    if (cancelTaskLoading) return;
    setCancelTaskModalVisible(false);
    setCancellingTask(null);
  }, [cancelTaskLoading]);

  const confirmCancelTask = useCallback(async () => {
    if (!cancellingTask || cancelTaskLoading) return;

    setCancelTaskLoading(true);
    try {
      await cancelInspectionTask({ taskId: cancellingTask.taskId, reason: 'Cancelled from task management.' } as any);
      CustomMessage.success(t('inspection.tasks.messages.cancelled'));
      setCancelTaskModalVisible(false);
      setCancellingTask(null);
      await fetchTasks();
    } catch {
      // Keep the modal open; the request layer handles failure messaging.
    } finally {
      setCancelTaskLoading(false);
    }
  }, [cancelTaskLoading, cancellingTask, fetchTasks, t]);

  const openAssignModal = useCallback((record?: TaskRecord | null) => {
    setAssigningTask(record || null);
    setAssignModalVisible(true);
  }, []);

  const closeAssignModal = useCallback(() => {
    setAssignModalVisible(false);
    setAssigningTask(null);
  }, []);

  const submitAssign = useCallback(async (inspectorIds: string[]) => {
    const keys = assigningTask ? [assigningTask.taskId] : selectedRowKeys;
    if (!keys.length) return;
    if (keys.length > 1) {
      await batchAssignInspectionTasks(keys.map((taskId) => Number(taskId)), inspectorIds);
    } else {
      await assignInspectionTask({
        taskId: Number(keys[0]),
        inspectorIds,
        reason: 'Assigned from task management queue',
      } as any);
    }
    CustomMessage.success(t('inspection.tasks.messages.assignmentSaved'));
    closeAssignModal();
    setSelectedRowKeys([]);
    fetchTasks();
  }, [assigningTask, closeAssignModal, fetchTasks, selectedRowKeys, t]);

  const handleExport = useCallback(async () => {
    if (!requestRole) {
      CustomMessage.warning(t('inspection.tasks.messages.noRecordsFound'));
      return;
    }

    try {
      const filters = buildRequestFilters();
      const exportPayload = {
        role: requestRole,
        tab: getFetchTab(),
        view: query.view,
        pageIndex: 1,
        pageSize: 5000,
        keyword: keyword || undefined,
        filters: Object.keys(filters).length ? filters : undefined,
        sortBy: taskSortBy,
        sortDirection: taskSortDirection,
      } as any;
      try {
        const file = await exportInspectionTasks(exportPayload);
        if (file instanceof Blob && file.size > 0) {
          downloadBlobFile('inspection-tasks.csv', file);
          // CustomMessage.success(t('inspection.tasks.messages.exportReady'));
          return;
        }
      } catch {
        // Fall back to CSV with the current page adapter data.
      }
      const payload = unwrapPayload<any>(
        await getInspectionTaskList(exportPayload),
      );
      const tasks = payload?.items || [];
      if (!tasks.length) {
        CustomMessage.warning(t('inspection.tasks.messages.noRecordsFound'));
        return;
      }
      downloadCsvFile('inspection-tasks.csv', buildTaskCsvRows(tasks, getFetchTab()));
      // CustomMessage.success(t('inspection.tasks.messages.exportReady'));
    } catch (error) {
      if (!isInspectionDataMissingError(error)) {
        CustomMessage.error(t('inspection.tasks.messages.loadFailed'));
      }
    }
  }, [buildRequestFilters, getFetchTab, keyword, query.view, requestRole, t, taskSortBy, taskSortDirection]);

  const buildTaskActions = useCallback((record: TaskRecord) => {
    const actions: TaskAction[] = [];
    const actionKeys = getInspectionTaskActionKeys({ role: taskRoles, task: record, currentInspectorId });
    const isInspectorTodoPendingVisit =
      requestRole === 'inspector' &&
      effectiveTaskListTab === 'todo' &&
      normalizeTaskStatus(record.status) === 'PENDING_VISIT';
    const cancelView = getOptionalBooleanFlag(record.cancelView);
    const todoBaseActionKeys =
      isInspectorTodoPendingVisit && cancelView === false
        ? actionKeys.filter((actionKey) => actionKey !== 'edit' && actionKey !== 'cancel')
        : actionKeys;
    const todoCancelActionKeys =
      isInspectorTodoPendingVisit && cancelView === true
        ? [
          ...todoBaseActionKeys,
          ...(['edit', 'cancel'] as InspectionTaskActionKey[]).filter(
            (actionKey) => !todoBaseActionKeys.includes(actionKey),
          ),
        ]
        : todoBaseActionKeys;
    const visibleActionKeys: InspectionTaskActionKey[] = isManagerQueuedView
      ? canAssign(record)
        ? canAssignTasks
          ? ['assign']
          : []
        : []
      : todoCancelActionKeys;

    const actionConfig: Record<InspectionTaskActionKey, TaskAction> = {
      assign: {
        key: 'assign',
        label: t('inspection.tasks.actions.assignNow'),
        priority: 10,
        onClick: () => openAssignModal(record),
      },
      startVisit: {
        key: 'start',
        label: t('inspection.tasks.actions.startVisit'),
        priority: 10,
        onClick: () => navigateToExecution(record, 'start'),
      },
      continueVisit: {
        key: 'continue',
        label: t('inspection.common.continue'),
        priority: 10,
        onClick: () => navigateToExecution(record, 'continue'),
      },
      edit: {
        key: 'edit',
        label: t('inspection.common.edit'),
        priority: 30,
        onClick: () => openTaskModal('edit', record),
      },
      cancel: {
        key: 'cancel',
        label: t('inspection.common.cancel'),
        priority: 40,
        onClick: () => handleCancel(record),
      },
      duplicate: {
        key: 'duplicate',
        label: t('inspection.common.duplicate'),
        priority: 20,
        onClick: () => handleDuplicate(record),
      },
      viewReport: {
        key: 'report',
        label: t('inspection.common.viewReport'),
        priority: 10,
        loading: reportLoadingTaskKey === getTaskRecordKey(record),
        onClick: () => handleViewReport(record),
      },
    };

    visibleActionKeys.forEach((actionKey) => {
      const action = actionConfig[actionKey];
      actions.push(action);
    });

    return actions;
  }, [
    currentInspectorId,
    effectiveTaskListTab,
    handleCancel,
    handleDuplicate,
    handleViewReport,
    isManagerQueuedView,
    navigateToExecution,
    canAssignTasks,
    openAssignModal,
    openTaskModal,
    reportLoadingTaskKey,
    requestRole,
    taskRoles,
    t,
  ]);

  const resolveTaskSortOrder = useCallback((sortBy: TaskSortBy) => {
    if (taskSortBy !== sortBy || !taskSortDirection) return null;
    return taskSortDirection === 'asc' ? 'ascend' : 'descend';
  }, [taskSortBy, taskSortDirection]);

  const taskActionColumnWidth = useResponsiveActionColumnWidth<
    TaskRecord,
    TaskActionColumnKey
  >({
    rows: tableData,
    buttonWidthMap: TASK_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: (record) => {
      const layout = resolveAdaptiveActionLayout(buildTaskActions(record), {
        maxInlineActions: 2,
      });
      const visibleActions = layout.inlineActions.map((action) => action.key);

      if (layout.overflowActions.length > 0) {
        visibleActions.push('more');
      }

      return visibleActions;
    },
    getActionLabel: (actionKey) => {
      switch (actionKey) {
        case 'assign':
          return t('inspection.tasks.actions.assignNow');
        case 'start':
          return t('inspection.tasks.actions.startVisit');
        case 'continue':
          return t('inspection.common.continue');
        case 'edit':
          return t('inspection.common.edit');
        case 'cancel':
          return t('inspection.common.cancel');
        case 'duplicate':
          return t('inspection.common.duplicate');
        case 'report':
          return t('inspection.common.viewReport');
        default:
          return undefined;
      }
    },
    desktopConfig: TASK_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: TASK_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: TASK_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });
  const taskTableScrollX =
    (requestRole === 'inspector' ? 1900 : 2200) -
    (isManagerQueuedView ? 150 : 240) +
    taskActionColumnWidth;

  const handleTaskTableChange: TableProps<TaskRecord>['onChange'] = useCallback((_pagination, _filters, sorter, extra) => {
    if (extra?.action !== 'sort') return;

    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const order = activeSorter?.order;
    const nextSortBy = typeof activeSorter?.columnKey === 'string'
      ? activeSorter.columnKey as TaskSortBy
      : undefined;

    if (!order || !nextSortBy) {
      setTaskSortBy(undefined);
      setTaskSortDirection(undefined);
      setPageIndex(1);
      return;
    }

    setTaskSortBy(nextSortBy);
    setTaskSortDirection(order === 'ascend' ? 'asc' : 'desc');
    setPageIndex(1);
  }, []);

  useEffect(() => {
    if (!taskSortBy || !TASK_TIMELINE_SORT_FIELDS.has(taskSortBy) || taskSortBy === taskTimelineSortBy) return;

    const defaultSort = getDefaultTaskSort(effectiveTaskListTab);
    setTaskSortBy(defaultSort.sortBy);
    setTaskSortDirection(defaultSort.sortDirection);
  }, [effectiveTaskListTab, taskSortBy, taskTimelineSortBy]);

  const taskColumns = useMemo<ColumnsType<TaskRecord>>(() => {
    const baseColumns: ColumnsType<TaskRecord> = [
      {
        title: t('inspection.tasks.columns.taskNo'),
        dataIndex: 'taskNo',
        width: pxToRemValue(192),
        render: (value) => (
          <span className="inspection-task-management__task-no">{value || '-'}</span>
        ),
      },
      {
        title: t('inspection.tasks.columns.inspectionTarget'),
        width: pxToRemValue(235),
        render: (_, record) => {
          const targetName = getTaskTargetName(record);

          return (
            <div className="inspection-task-management__target-cell">
              <img className="inspection-task-management__target-icon" src={getInspectionTargetIcon(record)} alt="" />
              <span title={targetName}>{targetName}</span>
            </div>
          );
        },
      },
      {
        title: t('inspection.tasks.columns.inspectionReason'),
        width: pxToRemValue(235),
        render: (_, record) => record.inspectionConfig?.inspectionReasonNameEn || '-',
      },
      {
        title: t('inspection.tasks.columns.priority'),
        key: 'Priority',
        width: pxToRemValue(98),
        sorter: true,
        sortOrder: resolveTaskSortOrder('Priority'),
        render: (_, record) => (
          <Tag className={`inspection-task-management__priority-tag ${getPriorityClassName(record.inspectionConfig?.priorityNameEn)}`}>
            {getPriorityLabel(record.inspectionConfig?.priorityNameEn)}
          </Tag>
        ),
      },
      {
        title: t('inspection.tasks.columns.dueDate'),
        key: 'DueDate',
        width: pxToRemValue(125),
        sorter: true,
        sortOrder: resolveTaskSortOrder('DueDate'),
        render: (_, record) => (
          <span className="inspection-task-management__date-cell">
            {formatTaskDate(record.inspectionConfig?.dueDate)}
          </span>
        ),
      },
      {
        title: t('inspection.tasks.columns.sla'),
        key: 'SLA',
        width: pxToRemValue(128),
        sorter: true,
        sortOrder: resolveTaskSortOrder('SLA'),
        render: (_, record) => {
          const slaText = getSlaText(record, t);
          const slaColorClassName = getSlaColorClassName(record, slaText);
          return (
            <span className={['inspection-task-management__sla-cell', slaColorClassName].filter(Boolean).join(' ')}>
              {slaText}
            </span>
          );
        },
      },
      {
        title: t('inspection.tasks.columns.status'),
        width: pxToRemValue(133),
        render: (_, record) => (
          <span className={`inspection-task-management__status-label ${getStatusClassName(record.status)}`}>
            {getTaskStatusLabel(record.status)}
          </span>
        ),
      },
      {
        title: t('inspection.tasks.columns.emirate'),
        width: pxToRemValue(125),
        render: (_, record) => getTaskEmirateName(record),
      },
      {
        title: t('inspection.tasks.columns.area'),
        width: pxToRemValue(180),
        render: (_, record) => getAreaName(record),
      },
      {
        title: effectiveTaskListTab === 'queued'
          ? t('inspection.tasks.columns.creationTime')
          : effectiveTaskListTab === 'completed'
            ? t('inspection.tasks.columns.lastUpdate')
            : t('inspection.tasks.columns.assignedTime'),
        key: taskTimelineSortBy,
        width: pxToRemValue(197),
        sorter: true,
        sortOrder: resolveTaskSortOrder(taskTimelineSortBy),
        render: (_, record) => formatTaskDateTime(getTaskTimelineValue(record, effectiveTaskListTab)),
      },
    ];

    if (requestRole !== 'inspector') {
      baseColumns.push({
        title: t('inspection.tasks.columns.inspector'),
        width: pxToRemValue(203),
        render: (_, record) => getAssigneeName(record),
      });
    }

    baseColumns.push(
      {
        title: t('inspection.tasks.columns.inspectionMethod'),
        width: pxToRemValue(160),
        render: (_, record) => getInspectionMethodName(record),
      },
      {
        title: t('inspection.tasks.columns.createdBy'),
        width: pxToRemValue(170),
        render: (_, record) => getCreatedByLabel(record),
      },
      {
        title: t('inspection.tasks.columns.action'),
        className: 'inspection-task-management__actions-column',
        width: pxToRemValue(taskActionColumnWidth),
        fixed: 'right',
        render: (_, record) => <TaskActions actions={buildTaskActions(record)} />,
      },
    );

    return baseColumns;
  }, [buildTaskActions, effectiveTaskListTab, requestRole, resolveTaskSortOrder, t, taskActionColumnWidth, taskTimelineSortBy]);

  const taskToolbarAndTable = (
    <>
      <div className={`inspection-task-management__toolbar${activeTab === 'teamTasks' ? ' inspection-task-management__team-toolbar' : ''}`}>
        <div className="inspection-task-management__toolbar-left">
          <div className="inspection-task-management__search-wrap responsive-filter-toolbar__field--single-visible-search">
            <span className="inspection-task-management__search-icon">
              <img src={refundSearchStrokeHandleIcon} alt="" />
              <img src={refundSearchStrokeBodyIcon} alt="" />
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
              onPressEnter={fetchTasks}
            />
          </div>
          <Select
            allowClear
            value={reasonFilter}
            placeholder={t('inspection.tasks.filters.allReasons')}
            className="inspection-task-management__filter-select"
            dropdownClassName="inspection-task-management__toolbar-select-dropdown"
            getPopupContainer={getSelectPopupContainer}
            optionLabelProp="label"
            onChange={(value: TaskReasonFilterValue | undefined) => {
              setReasonFilter(value);
              setPageIndex(1);
            }}
            onClear={() => {
              setReasonFilter(undefined);
              setPageIndex(1);
            }}
          >
            <Select.Option
              key="all"
              value="all"
              label={t('inspection.tasks.filters.allReasons')}
              title={t('inspection.tasks.filters.allReasons')}
            >
              {renderSelectOptionText(t('inspection.tasks.filters.allReasons'))}
            </Select.Option>
            {reasonFilterOptions.map(({ value, label }) => {
              return (
                <Select.Option key={value} value={value} label={label} title={label}>
                  {renderSelectOptionText(label)}
                </Select.Option>
              );
            })}
          </Select>
          <Select
            allowClear
            value={statusFilter}
            placeholder={t('inspection.tasks.filters.allStatuses')}
            className="inspection-task-management__filter-select"
            dropdownClassName="inspection-task-management__toolbar-select-dropdown"
            getPopupContainer={getSelectPopupContainer}
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
            <Select.Option
              value="all"
              key="all"
              label={t('inspection.tasks.filters.allStatuses')}
              title={t('inspection.tasks.filters.allStatuses')}
            >
              {renderSelectOptionText(t('inspection.tasks.filters.allStatuses'))}
            </Select.Option>
            {statusFilterOptions.map(({ value, label }) => {
              return (
                <Select.Option value={value} key={value} label={label} title={label}>
                  {renderSelectOptionText(label)}
                </Select.Option>
              );
            })}
          </Select>
          <div className="inspection-task-management__filter-actions">
            <Button className="inspection-task-management__toolbar-button inspection-task-management__outline-button inspection-task-management__filter-trigger" onClick={openFilterModal}>
              <span>{t('inspection.common.filter')}</span>
              <span className="inspection-task-management__filter-icon">
                <img src={refundFilterFunnelIcon} alt="" />
              </span>
              <FilterCountBadge count={appliedFilterCount} />
            </Button>
            <Button className="inspection-task-management__toolbar-button inspection-task-management__outline-button inspection-task-management__reset-button" onClick={resetFilters}>
              {t('inspection.common.reset')}
            </Button>
          </div>
        </div>
        <div className="inspection-task-management__toolbar-right">
          <PermissionGuard
            permissionCode={PERMISSION_CODES.inspection.task.export}
            routePath={INSPECTION_PATHS.tasks}
          >
            <Button className="inspection-task-management__toolbar-button inspection-task-management__outline-button" onClick={handleExport}>
              {t('inspection.common.export')}
            </Button>
          </PermissionGuard>
          <Button className="inspection-task-management__toolbar-button inspection-task-management__primary-button" onClick={() => openTaskModal('create')}>
            {t('inspection.tasks.createTask')}
          </Button>
        </div>
      </div>

      {isManagerQueuedView && canAssignTasks && selectedRowKeys.length > 0 ? (
        <div className="inspection-task-management__selection-bar">
          <div className="inspection-task-management__selection-count">
            {t('inspection.tasks.messages.selectedCount', { count: selectedRowKeys.length })}
          </div>
          <Button className="inspection-task-management__primary-button inspection-task-management__selection-assign" onClick={() => openAssignModal(null)}>
            {t('inspection.tasks.actions.assign')}
          </Button>
        </div>
      ) : null}

      <Table
        className="inspection-task-management__table admin-table"
        rowKey="taskId"
        loading={loading}
        columns={taskColumns}
        dataSource={tableData}
        scroll={{ x: pxToRemValue(taskTableScrollX) }}
        showSorterTooltip={false}
        onChange={handleTaskTableChange}
        onRow={(record) => ({
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            if (shouldIgnoreTaskRowClick(event)) return;
            navigateToTaskDetail(record);
          },
        })}
        rowSelection={isManagerQueuedView ? {
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          getCheckboxProps: (record: any) => ({ disabled: !canAssign(record) }),
        } : undefined}
        locale={{
          emptyText: (
            <EmptyBox title={t('inspection.tasks.messages.noRecordsFound')} />
          ),
        }}
        pagination={{
          size: "default",
          current: pageIndex,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          position: ['bottomCenter'],
          showTotal: (totalValue: number) => <PaginationTotal label={t("common.total")} total={totalValue} current={pageIndex} pageSize={pageSize} />,
          onChange: (nextPage, nextSize) => {
            setPageIndex(nextPage);
            setPageSize(nextSize || 10);
          },
        }}
      />
    </>
  );

  const teamTaskSourcePanelConfigs = useMemo<Record<string, TeamManagementControlledTaskPanelConfig>>(() => ({
    inspection: {
      customContent: (
        <InspectionTeamTasksPanel
          taskTab={activeTeamTaskView}
          effectiveSearch={effectiveSearch}
          createTaskText={t('teamManagement.actions.createTask')}
          refreshToken={inspectionTeamTasksRefreshToken}
          onCreateTask={() => openTaskModal('create')}
          onTaskChanged={fetchTaskSummary}
        />
      ),
    },
    other: {
      filterStore: activeOtherTaskFilterStore,
    },
  }), [
    activeOtherTaskFilterStore,
    activeTeamTaskView,
    effectiveSearch,
    fetchTaskSummary,
    inspectionTeamTasksRefreshToken,
    openTaskModal,
    t,
  ]);

  const teamManagementContent = isTeamManagementTab ? (
    <div className="inspection-task-management__shared-team-management">
      <TeamManagementContent
        scope="inspection"
        forcedMainTab={activeTab === 'teamMembers' ? 'teamMembers' : 'teamTasks'}
        layoutMode="embedded"
        renderMainTabs={false}
        renderSummaryCards={false}
        renderTaskToggle={false}
        skipAccessCheck
        taskTab={activeTeamTaskView}
        onTaskTabChange={(nextTab) => updateTeamTaskView(nextTab)}
        taskSources={activeTab === 'teamTasks' ? TEAM_TASK_SOURCE_OPTIONS : undefined}
        activeTaskSourceKey={activeTab === 'teamTasks' ? activeTeamTaskSource : undefined}
        onTaskSourceChange={activeTab === 'teamTasks' ? updateTeamTaskSource : undefined}
        taskSourcePanelConfigs={activeTab === 'teamTasks' ? teamTaskSourcePanelConfigs : undefined}
      />
    </div>
  ) : null;

  return (
    <div className={rootClassName} dir={i18n.resolvedLanguage === 'ar' ? 'rtl' : 'ltr'}>
      {shouldShowSummaryCards ? (
        <div className={`inspection-task-management__stats-row${canManageTasks ? ' inspection-task-management__stats-row--manager' : ''}`}>
          {taskSummaryCards.map((item) => (
            <div className="inspection-task-management__stat-card" key={item.key}>
              <span className={`inspection-task-management__stat-icon ${taskSummaryIconClassNames[item.key as TaskSummaryCardKey]}`}>
                <img src={item.icon} alt="" />
              </span>
              <div className="inspection-task-management__stat-content">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Card bordered={false} className="inspection-task-management__tabs-panel">
        <Tabs activeKey={activeTab} onChange={updateTab} className="inspection-task-management__tabs">
          {availableTabs.map((tab) => <Tabs.TabPane key={tab.key} tab={t(tab.labelKey)} />)}
        </Tabs>
      </Card>

      {teamManagementContent ? teamManagementContent : activeTab ? (
        <Card bordered={false} className="inspection-task-management__panel">
          {taskToolbarAndTable}
        </Card>
      ) : null}

      <CreateTaskModal
        visible={taskModalVisible}
        mode={taskModalMode}
        editingTask={editingTask}
        isInspectorSelfCreate={isInspectorSelfCreate}
        currentInspectorId={currentInspectorId}
        getAuthorityName={getAuthorityName}
        onVisibleChange={handleTaskModalVisibleChange}
        onSubmitted={handleTaskSubmitted}
      />

      <TaskFilterModal
        visible={filterModalVisible}
        value={taskFilterModalValue}
        reasonOptions={reasonFilterOptions}
        statusOptions={statusFilterOptions}
        emirateOptions={emirateFilterOptions}
        areaOptions={areaFilterOptions}
        inspectionMethodOptions={methodFilterOptions}
        priorityOptions={priorityFilterOptions}
        createdByOptions={createdByFilterOptions}
        showInspectorFilter={canManageTasks}
        onCancel={() => setFilterModalVisible(false)}
        onApply={applyFilterModal}
        onEmirateChange={loadAreaFilterOptions}
      />

      <CancelTaskModal
        visible={cancelTaskModalVisible && Boolean(cancellingTask)}
        title={t('inspection.tasks.actions.cancelTask')}
        content={t('inspection.tasks.messages.cancelConfirm')}
        cancelText={t('inspection.common.no')}
        confirmText={t('inspection.common.yes')}
        loading={cancelTaskLoading}
        onCancel={closeCancelTaskModal}
        onConfirm={confirmCancelTask}
      />

      <AssignTaskModal
        visible={assignModalVisible}
        onCancel={closeAssignModal}
        onSubmit={submitAssign}
      />

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
        loading={Boolean(reportLoadingTaskKey)}
        taskDetail={reportTaskDetail}
        onCancel={closeReportModal}
        onViolationClick={handleReportViolationClick}
      />
    </div>
  );
};

export default InspectionTaskManagementPage;
