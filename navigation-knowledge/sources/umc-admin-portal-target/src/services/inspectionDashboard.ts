import request from "@/utils/request";
import type {
  DashboardData,
  DashboardDataParams,
  DashboardDonutCard,
  DashboardMetricCard,
  DashboardRoleVariant,
  DashboardTableAction,
  DashboardTableColumn,
  DashboardTableIconType,
  DashboardTableRow,
  DashboardTableSection,
  DashboardTableTab,
  DashboardTableSortDirection,
  DashboardTaskCard,
  DashboardTaskTab,
  DashboardTimeFilter,
  DashboardTone,
  DashboardTrendChart,
} from "@/pages/Dashboard/type";
import {
  countNumber,
  createDashboardItemKeyFactory,
  createOpenAction,
  dashboardCell,
  formatDateTime,
  formatMinutes,
  formatPercent,
  getFirstActionTarget,
  getSlaTone,
  normalizeDashboardActionTarget,
  normalizeDashboardEntityIconType,
  normalizeStatusTone,
  normalizeTaskSourceType,
  optionalNumber,
  optionalString,
  resolveDashboardDateRange,
  unwrapDashboardResponse,
  withQuery,
  type DashboardApiResult,
} from "./dashboardApiShared";
import { getInspectionDashboardTaskCardTitle } from "./dashboardTaskCardTitle";

export const INSPECTION_DASHBOARD_DEPARTMENT_ID = 6;

const INSPECTION_ROUTE = {
  tasks: "/inspection/tasks",
  taskDetail: "/inspection/tasks/detail",
  taskExecution: "/inspection/tasks/execution",
  teamManagement: "/inspection/tasks?tab=teamMembers",
} as const;
const CUSTOMER_HAPPINESS_TICKETS_ROUTE = "/happiness/tickets";
const CUSTOMER_HAPPINESS_APPEALS_ROUTE = "/happiness/appeals";
const CUSTOMER_HAPPINESS_REFUNDS_ROUTE = "/happiness/refunds";

const INSPECTION_TASK_PAGE_SIZE = 10;
const INSPECTION_MANAGER_TABS = ["inspection", "other"] as const;

type InspectionDashboardSortBy = "Priority" | "DueDate" | "SLA";

type InspectionDashboardTaskListType =
  | "recentAssigned"
  | "needsAttentionInspection"
  | "needsAttentionOther";

interface InspectionDashboardSlaDto {
  displayText?: string | null;
  color?: string | null;
  sortWeight?: number | null;
  remainingMinutes?: number | null;
}
const INSPECTION_TARGET_ICON_BY_TYPE_CODE: Record<
  string,
  DashboardTableIconType
> = {
  establishment: "inspectionTargetCompany",
  government: "inspectionTargetGovernment",
  individual: "inspectionTargetUser",
};

const getInspectionTargetIcon = (targetTypeCode?: string | null) =>
  INSPECTION_TARGET_ICON_BY_TYPE_CODE[
    optionalString(targetTypeCode)?.toLowerCase() || ""
  ];

interface InspectionDashboardActionDto {
  actionCode?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  openMode?: string | null;
}

interface InspectionDashboardRelatedEntityDto {
  name?: string | null;
  type?: string | null;
  iconUrl?: string | null;
}

interface InspectionDashboardTaskCardDto {
  taskId?: number | string | null;
  taskType?: string | null;
  taskNo?: string | null;
  statusBadge?: string | null;
  slaLabel?: InspectionDashboardSlaDto | null;
  taskTitle?: string | null;
  relatedEntity?: InspectionDashboardRelatedEntityDto | null;
  sortTime?: string | null;
  availableActions?: InspectionDashboardActionDto[] | null;
}

interface InspectionDashboardTodoTabDto {
  tabKey?: string | null;
  tabTitle?: string | null;
  todoCount?: number | null;
  cards?: InspectionDashboardTaskCardDto[] | null;
}

interface InspectionDashboardTodoSectionDto {
  tabs?: InspectionDashboardTodoTabDto[] | null;
}

interface InspectionDashboardTaskHubDto {
  inspectionCard?: {
    todoTotal?: number | null;
    todoByPriority?: Record<string, number | null> | null;
    totalTasks?: number | null;
    doneToday?: number | null;
    overdueTasks?: number | null;
  } | null;
  violationCard?: {
    todoTotal?: number | null;
    todoByStatus?: Record<string, number | null> | null;
    totalViolationsFound?: number | null;
    contentViolations?: number | null;
    licenseViolations?: number | null;
  } | null;
}

interface InspectionDashboardPerformanceDto {
  slaComplianceRate?: number | null;
  averageProcessingTime?: string | null;
  averageProcessingTimeMinutes?: number | null;
  accessSuccessfulRate?: number | null;
  overdueTasks?: number | null;
}

interface InspectionDashboardTrendPointDto {
  timeLabel?: string | null;
  slaComplianceRate?: number | null;
  avgProcessingTimeMinutes?: number | null;
  avgProcessingTimeDisplay?: string | null;
  accessSuccessfulRate?: number | null;
}

interface InspectionDashboardTrendDto {
  avgProcessingTimeAxis?: {
    unit?: string | null;
    tickLabels?: string[] | null;
    maxValueMinutes?: number | null;
  } | null;
  dataPoints?: InspectionDashboardTrendPointDto[] | null;
}

interface InspectionDashboardAttentionSummaryTabDto {
  tabKey?: string | null;
  tabTitle?: string | null;
  count?: number | null;
}

interface InspectionDashboardAttentionSummaryDto {
  tabs?: InspectionDashboardAttentionSummaryTabDto[] | null;
  totalCount?: number | null;
}

interface InspectionDashboardTaskDto {
  taskId?: number | string | null;
  taskNo?: string | null;
  isUrgent?: boolean | null;
  inspectionTarget?: string | null;
  targetTypeCode?: string | null;
  inspectionReason?: string | null;
  inspector?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  slaLabel?: InspectionDashboardSlaDto | null;
  status?: string | null;
  emirate?: string | null;
  authority?: string | null;
  assignedTime?: string | null;
  inspectionMethod?: string | null;
  createdBy?: string | null;
  taskCategory?: string | null;
  applyFor?: string | null;
  applyForIconType?: string | null;
  assignedTo?: string | null;
  availableActions?: InspectionDashboardActionDto[] | null;
}

interface InspectionDashboardTaskListDto {
  listType?: InspectionDashboardTaskListType | null;
  totalCount?: number | null;
  pageIndex?: number | null;
  pageSize?: number | null;
  tasks?: InspectionDashboardTaskDto[] | null;
  recentTasks?: InspectionDashboardTaskDto[] | null;
  inspectionTasks?: InspectionDashboardTaskDto[] | null;
  otherTasks?: InspectionDashboardTaskDto[] | null;
}

interface InspectionDashboardCoachingMemberDto {
  memberName?: string | null;
  memberId?: string | null;
  overdue?: number | null;
  slaComplianceRate?: number | null;
  avgProcessingTime?: string | null;
}

interface InspectionDashboardCoachingDto {
  members?: InspectionDashboardCoachingMemberDto[] | null;
}

interface InspectionDashboardEmergencyLeaveMemberDto {
  memberId?: string | null;
  memberName?: string | null;
  leaveReason?: string | null;
  returnTime?: string | null;
  todoCount?: number | null;
  todoTaskCount?: number | null;
  avatarUrl?: string | null;
}

interface InspectionDashboardEmergencyLeaveDto {
  totalCount?: number | null;
  members?: InspectionDashboardEmergencyLeaveMemberDto[] | null;
}

interface InspectionDashboardOverviewDto {
  userRole?: string | null;
  departmentId?: number | null;
  todoSection?: InspectionDashboardTodoSectionDto | null;
  todoCards?: InspectionDashboardTodoSectionDto | null;
  taskHub?: InspectionDashboardTaskHubDto | null;
  performance?: InspectionDashboardPerformanceDto | null;
  performanceTrend?: InspectionDashboardTrendDto | null;
  recentTasks?: InspectionDashboardTaskListDto | InspectionDashboardTaskDto[] | null;
  membersNeedingCoaching?: InspectionDashboardCoachingDto | null;
  membersOnEmergencyLeave?: InspectionDashboardEmergencyLeaveDto | null;
  needsAttentionSummary?: InspectionDashboardAttentionSummaryDto | null;
  needsAttentionInspectionList?: InspectionDashboardTaskListDto | InspectionDashboardTaskDto[] | null;
  needsAttentionOtherList?: InspectionDashboardTaskListDto | InspectionDashboardTaskDto[] | null;
  needsAttentionInspectionTasks?: InspectionDashboardTaskListDto | InspectionDashboardTaskDto[] | null;
  needsAttentionOtherTasks?: InspectionDashboardTaskListDto | InspectionDashboardTaskDto[] | null;
}

export interface InspectionDashboardTaskCardsResult {
  tabKey: string;
  count: number;
  cards: DashboardTaskCard[];
}

export interface InspectionDashboardAttentionTabResult {
  tab: DashboardTableTab;
}

export interface InspectionDashboardTaskListParams {
  roleVariant: DashboardRoleVariant;
  tabKey: string;
  pageIndex?: number;
  pageSize?: number;
  timeFilter?: DashboardTimeFilter;
  sortBy?: string;
  sortDirection?: DashboardTableSortDirection;
  signal?: AbortSignal;
}

interface InspectionDashboardInitialTaskLists {
  recentAssigned?: InspectionDashboardTaskListDto | null;
  needsAttentionInspection?: InspectionDashboardTaskListDto | null;
  needsAttentionOther?: InspectionDashboardTaskListDto | null;
}

const isManagerRole = (roleVariant: DashboardRoleVariant) =>
  roleVariant === "manager";

const mapUserRole = (userRole?: string | null): DashboardRoleVariant => {
  const normalizedRole = String(userRole || "").trim().toLowerCase();

  return normalizedRole === "manager" ||
    normalizedRole === "admin" ||
    normalizedRole === "leader"
    ? "manager"
    : "staff";
};

const getOverviewSections = (roleVariant: DashboardRoleVariant) =>
  isManagerRole(roleVariant)
    ? [
        "todoCards",
        "taskHub",
        "performance",
        "membersNeedingCoaching",
        "membersOnEmergencyLeave",
        "needsAttentionSummary",
      ].join(",")
    : [
        "todoCards",
        "taskHub",
        "performance",
        "performanceTrend",
      ].join(",");

const mapTaskCards = (
  cards: InspectionDashboardTaskCardDto[] = [],
  prefix: string
): DashboardTaskCard[] => {
  const getItemKey = createDashboardItemKeyFactory(prefix);

  return cards.map((card, index): DashboardTaskCard => {
    const sourceId = optionalString(card.taskId);
    const sourceType = normalizeTaskSourceType(card.taskType);
    const taskNo = optionalString(card.taskNo);
    const title = getInspectionDashboardTaskCardTitle(sourceType, {
      taskTitle: optionalString(card.taskTitle),
      taskNo,
    });
    const statusText = optionalString(card.statusBadge);
    const target = getFirstActionTarget(card.availableActions, "inspection");

    return {
      key: getItemKey({
        namespace: "inspection",
        identityParts: [sourceId, card.sortTime, title],
        index,
      }),
      statusText,
      statusTone: normalizeStatusTone(statusText),
      alertText: optionalString(card.slaLabel?.displayText),
      title,
      subtitle: optionalString(card.relatedEntity?.name),
      subtitleIcon: normalizeDashboardEntityIconType(card.relatedEntity?.type),
      sourceType,
      sourceId,
      lastUpdatedAt: optionalString(card.sortTime),
      ...target,
    };
  });
};

const mapTodoTabs = (
  todoSection: InspectionDashboardTodoSectionDto | null | undefined,
  roleVariant: DashboardRoleVariant
): DashboardTaskTab[] =>
  (todoSection?.tabs || []).map((tab) => {
    const tabKey = optionalString(tab.tabKey) || "inspections";
    const normalizedTabKey = tabKey.trim().toLowerCase();
    const normalizedTabTitle = optionalString(tab.tabTitle)?.trim().toLowerCase();
    const isEnquiriesTab =
      normalizedTabKey === "enquiries" ||
      normalizedTabKey === "tickets" ||
      normalizedTabTitle?.includes("enquiries") ||
      normalizedTabTitle?.includes("complaints");
    const isAppealsTab =
      normalizedTabKey === "appeal" ||
      normalizedTabKey === "appeals" ||
      normalizedTabTitle?.includes("appeal");
    const isRefundsTab =
      normalizedTabKey === "refund" ||
      normalizedTabKey === "refunds" ||
      normalizedTabTitle?.includes("refund");
    const actionPath = isManagerRole(roleVariant)
      ? isEnquiriesTab
        ? CUSTOMER_HAPPINESS_TICKETS_ROUTE
        : isAppealsTab
          ? CUSTOMER_HAPPINESS_APPEALS_ROUTE
          : isRefundsTab
            ? CUSTOMER_HAPPINESS_REFUNDS_ROUTE
            : INSPECTION_ROUTE.tasks
      : INSPECTION_ROUTE.tasks;
  
    return {
      key: tabKey,
      labelKey: "adminDashboard.tabs.inspections",
      labelText: optionalString(tab.tabTitle),
      count: countNumber(tab.todoCount),
      actionPath,
      actionPermissionPath: INSPECTION_ROUTE.tasks,
      cards: mapTaskCards(tab.cards || [], `inspection-${tabKey}`),
    };
  });

const metric = (
  key: string,
  labelKey: string,
  value: string | undefined,
  variant: DashboardMetricCard["variant"],
  tone: DashboardTone,
  infoTooltipKey?: string
): DashboardMetricCard | null =>
  value
    ? {
        key,
        labelKey,
        infoTooltipKey,
        value,
        variant,
        tone,
      }
    : null;

const createMetricCards = (
  performance?: InspectionDashboardPerformanceDto | null,
  roleVariant: DashboardRoleVariant = "staff"
): DashboardMetricCard[] => {
  const tooltipGroup = isManagerRole(roleVariant) ? "manager" : "staff";
  const slaMetric = metric(
    "sla",
    "adminDashboard.metrics.slaCompliance",
    formatPercent(performance?.slaComplianceRate),
    "gauge",
    optionalNumber(performance?.slaComplianceRate) !== undefined &&
      countNumber(performance?.slaComplianceRate) >= 80
      ? "green"
      : "red",
    `adminDashboard.tooltips.${tooltipGroup}.slaCompliance`
  );
  const processingMetric = metric(
    "processing",
    "adminDashboard.metrics.avgProcessingTime",
    optionalString(performance?.averageProcessingTime) ||
      formatMinutes(performance?.averageProcessingTimeMinutes),
    "timer",
    "green",
    `adminDashboard.tooltips.${tooltipGroup}.avgProcessingTime`
  );
  const accessMetric = metric(
    "access",
    "adminDashboard.metrics.accessSuccessfulRate",
    formatPercent(performance?.accessSuccessfulRate),
    "ring",
    "green",
    `adminDashboard.tooltips.${tooltipGroup}.accessSuccessfulRate`
  );
  const overdueMetric = metric(
    "overdue",
    "adminDashboard.metrics.overdueTasks",
    optionalNumber(performance?.overdueTasks) !== undefined
      ? String(performance?.overdueTasks)
      : undefined,
    "alert",
    "red",
    `adminDashboard.tooltips.${tooltipGroup}.overdueTasks`
  );
  const orderedMetrics = isManagerRole(roleVariant)
    ? [slaMetric, processingMetric, overdueMetric, accessMetric]
    : [slaMetric, processingMetric, accessMetric, overdueMetric];

  return orderedMetrics.filter(
    (item): item is DashboardMetricCard => Boolean(item)
  );
};

const mapPerformanceTrend = (
  trend?: InspectionDashboardTrendDto | null
): DashboardTrendChart | undefined => {
  const points = trend?.dataPoints || [];

  if (!points.length) {
    return undefined;
  }

  const series: DashboardTrendChart["series"] = [
    {
      key: "sla",
      labelKey: "adminDashboard.metrics.slaCompliance",
      color: "#A0D5AB",
      axis: "left",
      values: points.map((item) => countNumber(item.slaComplianceRate)),
      unit: "%",
    },
    {
      key: "processing",
      labelKey: "adminDashboard.metrics.avgProcessingTime",
      color: "#D7BC6D",
      axis: "right",
      values: points.map((item) => countNumber(item.avgProcessingTimeMinutes)),
      displayValues: points.map(
        (item) => optionalString(item.avgProcessingTimeDisplay) || ""
      ),
      unit: "time",
    },
  ];

  return series.length
    ? {
        key: "inspection-performance-trend",
        titleKey: "adminDashboard.sections.performanceTrend",
        infoTooltipKey: "adminDashboard.tooltips.performanceTrend",
        smooth: false,
        tooltipVariant: "compact",
        categories: points.map((item) => optionalString(item.timeLabel) || ""),
        leftAxis: {
          unit: "%",
          minValue: 0,
          maxValue: 100,
          tickLabels: ["0%", "20%", "40%", "60%", "80%", "100%"],
        },
        rightAxis: trend?.avgProcessingTimeAxis
          ? {
              unit: optionalString(trend.avgProcessingTimeAxis.unit) || "minutes",
              minValue: 0,
              maxValue: countNumber(trend.avgProcessingTimeAxis.maxValueMinutes),
              tickLabels: trend.avgProcessingTimeAxis.tickLabels || [],
            }
          : undefined,
        series,
      }
    : undefined;
};

const INSPECTION_PRIORITY_LEGENDS = [
  {
    key: "critical",
    labelText: "Critical Priority",
    color: "#FAAAA7",
  },
  {
    key: "high",
    labelText: "High Priority",
    color: "#F5AC7C",
  },
  {
    key: "medium",
    labelText: "Medium Priority",
    color: "#F8CC45",
  },
  {
    key: "low",
    labelText: "Low Priority",
    color: "#A0D5AB",
  },
] as const;

const INSPECTION_VIOLATION_STATUS_LEGENDS = [
  {
    key: "pendingRouting",
    labelText: "Pending Routing",
    color: "#A0D5AB",
  },
  {
    key: "pendingReview",
    labelText: "Pending Review",
    color: "#F8CC45",
  },
  {
    key: "pendingApproval",
    labelText: "Pending Approval",
    color: "#81C1FF",
  },
] as const;

const addLegend = (
  legends: DashboardDonutCard["legends"],
  key: string,
  labelText: string,
  value?: unknown,
  color = "#81C1FF"
) => {
  const numericValue = optionalNumber(value);

  if (numericValue === undefined) {
    return;
  }

  legends.push({
    key,
    labelText,
    value: numericValue,
    color,
  });
};

const addSummaryTile = (
  summaryTiles: DashboardDonutCard["summaryTiles"],
  key: string,
  labelKey: string,
  value?: unknown,
  tone: DashboardTone = "neutral",
  infoTooltipKey?: string
) => {
  const numericValue = optionalNumber(value);

  if (numericValue === undefined) {
    return;
  }

  summaryTiles.push({
    key,
    labelKey,
    infoTooltipKey,
    value: String(numericValue),
    tone,
  });
};

const createInspectionCard = (
  hub?: InspectionDashboardTaskHubDto | null,
  roleVariant: DashboardRoleVariant = "staff"
): DashboardDonutCard | null => {
  const source = hub?.inspectionCard;

  if (!source) {
    return null;
  }

  const legends: DashboardDonutCard["legends"] = [];
  const summaryTiles: DashboardDonutCard["summaryTiles"] = [];
  const tooltipGroup = isManagerRole(roleVariant) ? "manager" : "staff";

  INSPECTION_PRIORITY_LEGENDS.forEach(({ key, labelText, color }) => {
    addLegend(
      legends,
      key,
      labelText,
      source.todoByPriority?.[key],
      color
    );
  });
  addSummaryTile(
    summaryTiles,
    "total",
    "adminDashboard.metrics.totalTasks",
    source.totalTasks,
    "neutral",
    `adminDashboard.tooltips.${tooltipGroup}.totalInspectionTasks`
  );
  addSummaryTile(
    summaryTiles,
    "doneToday",
    "adminDashboard.metrics.doneToday",
    source.doneToday,
    "green"
  );
  addSummaryTile(
    summaryTiles,
    "overdue",
    "adminDashboard.metrics.overdueTasks",
    source.overdueTasks,
    "red"
  );

  return {
    key: "inspection-inspections",
    titleKey: "adminDashboard.tabs.inspections",
    actionPath: INSPECTION_ROUTE.tasks,
    actionPermissionPath: INSPECTION_ROUTE.tasks,
    centerValue:
      optionalNumber(source.todoTotal) !== undefined
        ? String(source.todoTotal)
        : "",
    centerLabelKey: "adminDashboard.labels.toDo",
    legends,
    showLegendPercentage: false,
    summaryTiles,
  };
};

const createViolationCard = (
  hub?: InspectionDashboardTaskHubDto | null,
  roleVariant: DashboardRoleVariant = "staff"
): DashboardDonutCard | null => {
  const source = hub?.violationCard;

  if (!source) {
    return null;
  }

  const summaryTiles: DashboardDonutCard["summaryTiles"] = [];
  const legends: DashboardDonutCard["legends"] = [];
  const tooltipGroup = isManagerRole(roleVariant) ? "manager" : "staff";

  const legendPlaceholders = INSPECTION_VIOLATION_STATUS_LEGENDS.map(
    ({ key, labelText, color }) => {
      const numericValue = optionalNumber(source.todoByStatus?.[key]);

      if (numericValue !== undefined) {
        legends.push({
          key,
          labelText,
          value: numericValue,
          color,
        });
      }

      return {
        key,
        labelText,
        color,
        displayValue: numericValue === undefined ? "-" : String(numericValue),
      };
    }
  );

  addSummaryTile(
    summaryTiles,
    "totalViolations",
    "adminDashboard.metrics.totalViolationsFound",
    source.totalViolationsFound,
    "neutral",
    `adminDashboard.tooltips.${tooltipGroup}.totalViolationsFound`
  );
  addSummaryTile(
    summaryTiles,
    "contentViolations",
    "adminDashboard.metrics.contentViolation",
    source.contentViolations,
    "orange",
    `adminDashboard.tooltips.${tooltipGroup}.contentViolation`
  );
  addSummaryTile(
    summaryTiles,
    "licenseViolations",
    "adminDashboard.metrics.licenseViolation",
    source.licenseViolations,
    "red",
    `adminDashboard.tooltips.${tooltipGroup}.licenseViolation`
  );

  return {
    key: "inspection-violations",
    titleKey: "adminDashboard.tabs.violationsFines",
    actionPath: "/inspection/violations",
    actionPermissionPath: "/inspection/violations",
    centerValue:
      optionalNumber(source.todoTotal) !== undefined
        ? String(source.todoTotal)
        : "",
    centerLabelKey: "adminDashboard.labels.toDo",
    legends,
    legendPlaceholders,
    showLegendPercentage: false,
    summaryTiles,
  };
};

const mapDonutCards = (
  hub?: InspectionDashboardTaskHubDto | null,
  roleVariant: DashboardRoleVariant = "staff"
): DashboardDonutCard[] =>
  [
    createInspectionCard(hub, roleVariant),
    createViolationCard(hub, roleVariant),
  ].filter((item): item is DashboardDonutCard => Boolean(item));

const INSPECTION_DASHBOARD_SORT_KEY = {
  priority: "Priority",
  dueDate: "DueDate",
  sla: "SLA",
} as const satisfies Record<string, InspectionDashboardSortBy>;

const getManagerInspectionTaskColumns = (): DashboardTableColumn[] => [
  { key: "taskNo", titleKey: "adminDashboard.table.taskNo", dataIndex: "taskNo", width: 283 },
  { key: "target", titleKey: "adminDashboard.table.inspectionTarget", dataIndex: "target", width: 283 },
  { key: "inspector", titleKey: "adminDashboard.table.inspector", dataIndex: "inspector", width: 283 },
  {
    key: "priority",
    titleKey: "adminDashboard.table.priority",
    dataIndex: "priority",
    width: 103,
    sortKey: INSPECTION_DASHBOARD_SORT_KEY.priority,
  },
  {
    key: "dueDate",
    titleKey: "adminDashboard.table.dueDate",
    dataIndex: "dueDate",
    width: 117,
    sortKey: INSPECTION_DASHBOARD_SORT_KEY.dueDate,
  },
  {
    key: "sla",
    titleKey: "adminDashboard.table.sla",
    dataIndex: "sla",
    width: 123,
    sortKey: INSPECTION_DASHBOARD_SORT_KEY.sla,
  },
  { key: "status", titleKey: "adminDashboard.table.status", dataIndex: "status", width: 133 },
  { key: "emirate", titleKey: "adminDashboard.table.emirate", dataIndex: "emirate", width: 146 },
];

const getOtherTaskColumns = (): DashboardTableColumn[] => [
  { key: "taskNo", titleKey: "adminDashboard.table.taskNo", dataIndex: "taskNo", width: 240 },
  { key: "category", titleKey: "adminDashboard.table.taskCategory", dataIndex: "category", width: 220 },
  { key: "applyFor", titleKey: "adminDashboard.table.applyFor", dataIndex: "applyFor", width: 260 },
  { key: "assignedTo", titleKey: "adminDashboard.table.assignedTo", dataIndex: "assignedTo", width: 260 },
  { key: "sla", titleKey: "adminDashboard.table.sla", dataIndex: "sla", width: 133 },
  { key: "status", titleKey: "adminDashboard.table.status", dataIndex: "status", width: 200 },
  { key: "action", titleKey: "adminDashboard.table.actions", dataIndex: "action", width: 110 },
];

const getRecentTaskColumns = (): DashboardTableColumn[] => [
  { key: "taskNo", titleKey: "adminDashboard.table.taskNo", dataIndex: "taskNo", width: 192 },
  { key: "target", titleKey: "adminDashboard.table.inspectionTarget", dataIndex: "target", width: 267 },
  { key: "reason", titleKey: "adminDashboard.table.inspectionReason", dataIndex: "reason", width: 267 },
  {
    key: "priority",
    titleKey: "adminDashboard.table.priority",
    dataIndex: "priority",
    width: 117,
    sortKey: INSPECTION_DASHBOARD_SORT_KEY.priority,
  },
  {
    key: "dueDate",
    titleKey: "adminDashboard.table.dueDate",
    dataIndex: "dueDate",
    width: 117,
    sortKey: INSPECTION_DASHBOARD_SORT_KEY.dueDate,
  },
  {
    key: "sla",
    titleKey: "adminDashboard.table.sla",
    dataIndex: "sla",
    width: 121,
    sortKey: INSPECTION_DASHBOARD_SORT_KEY.sla,
  },
  { key: "status", titleKey: "adminDashboard.table.status", dataIndex: "status", width: 267 },
  { key: "action", titleKey: "adminDashboard.table.actions", dataIndex: "action", width: 210 },
];

const INSPECTION_DASHBOARD_TASK_ACTION_CODES = new Set([
  "startvisit",
  "duplicate",
  "edit",
  "cancel",
]);
const INSPECTION_DASHBOARD_TASK_ACTION_ORDER = [
  "startvisit",
  "duplicate",
  "edit",
  "cancel",
] as const;
const INSPECTION_DASHBOARD_MENU_ACTION_CODES = new Set(["edit", "cancel"]);
const INSPECTION_DASHBOARD_TASK_ACTION_LABEL_KEYS: Record<string, string> = {
  startvisit: "inspection.tasks.actions.startVisit",
  duplicate: "inspection.common.duplicate",
  edit: "inspection.common.edit",
  cancel: "inspection.common.cancel",
};
const INSPECTION_DASHBOARD_REASSIGN_ACTION_CODE = "reassign";
const INSPECTION_DASHBOARD_OTHER_TASK_SOURCE_TYPE = "enquiry";
const INSPECTION_DASHBOARD_NAVIGATION_ACTION_CODES = new Set([
  "open",
  "view",
  "message",
]);

const normalizeInspectionDashboardActionCode = (value?: unknown) =>
  optionalString(value)?.toLowerCase();

const getInspectionDashboardTaskIdFromActionUrl = (value?: unknown) => {
  let target = optionalString(value);

  if (!target) {
    return undefined;
  }

  if (/^https?:\/\//i.test(target)) {
    try {
      const targetUrl = new URL(target);

      target = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
    } catch {
      return undefined;
    }
  }

  const normalizedTarget = target.startsWith("/") ? target : `/${target}`;
  const pathTaskId = normalizedTarget.match(
    /^\/inspection\/tasks\/([^/?#]+)/i
  )?.[1];
  const query = normalizedTarget.split("?")[1]?.split("#")[0] || "";
  const queryTaskId = new URLSearchParams(query).get("taskId");

  return optionalString(pathTaskId) || optionalString(queryTaskId);
};

const createInspectionDashboardStartVisitTarget = (
  taskId: string,
  taskNo?: string
) => ({
  targetPath: withQuery(INSPECTION_ROUTE.taskExecution, {
    from: "tasks",
    taskId,
    taskNo,
    visitId: `VIS-${taskId}`,
    step: "targetAccess",
    mode: "start",
  }),
  permissionPath: INSPECTION_ROUTE.taskExecution,
});

const createInspectionDashboardTaskDetailTarget = (
  taskId?: string,
  taskNo?: string
) => {
  if (!taskId && !taskNo) {
    return {};
  }

  return {
    targetPath: withQuery(INSPECTION_ROUTE.taskDetail, {
      from: "tasks",
      taskId,
      taskNo,
    }),
    permissionPath: INSPECTION_ROUTE.taskDetail,
  };
};

const mapInspectionDashboardAction = (
  action: InspectionDashboardActionDto | null | undefined,
  index: number,
  rowTaskId?: string,
  rowTaskNo?: string
): DashboardTableAction | undefined => {
  const actionCode = normalizeInspectionDashboardActionCode(action?.actionCode);
  const actionUrl = optionalString(action?.actionUrl);
  const openMode = optionalString(action?.openMode);

  if (!actionCode) {
    return undefined;
  }

  if (INSPECTION_DASHBOARD_TASK_ACTION_CODES.has(actionCode)) {
    const taskId =
      rowTaskId || getInspectionDashboardTaskIdFromActionUrl(actionUrl);

    if (!taskId) {
      return undefined;
    }

    return {
      key: `inspection-${actionCode}-${taskId}-${index + 1}`,
      labelKey: INSPECTION_DASHBOARD_TASK_ACTION_LABEL_KEYS[actionCode],
      mode: INSPECTION_DASHBOARD_MENU_ACTION_CODES.has(actionCode)
        ? "menu"
        : "inline",
      actionCode,
      sourceActionUrl: actionUrl,
      openMode,
      taskId,
      tone: actionCode === "cancel" ? "red" : "gold",
      ...(actionCode === "startvisit"
        ? createInspectionDashboardStartVisitTarget(taskId, rowTaskNo)
        : {}),
    };
  }

  if (!INSPECTION_DASHBOARD_NAVIGATION_ACTION_CODES.has(actionCode)) {
    return undefined;
  }

  const actionLabel = optionalString(action?.actionLabel);
  const taskId = rowTaskId || getInspectionDashboardTaskIdFromActionUrl(actionUrl);
  const target = normalizeDashboardActionTarget(actionUrl, "inspection");

  if (!actionLabel || !taskId || !target.targetPath) {
    return undefined;
  }

  return {
    key: `inspection-${actionCode}-${target.targetPath}-${index + 1}`,
    labelText: actionLabel,
    actionCode,
    sourceActionUrl: actionUrl,
    openMode,
    taskId,
    tone: "gold",
    targetPath: target.targetPath,
    permissionPath: target.permissionPath,
    allowedInspectionRoles: target.allowedInspectionRoles,
  };
};

const mapInspectionDashboardActions = (
  actions: InspectionDashboardActionDto[] | null | undefined,
  rowTaskId?: string,
  rowTaskNo?: string
) => {
  const actionByCode = new Map<string, InspectionDashboardActionDto>();
  const navigationActions: InspectionDashboardActionDto[] = [];

  (actions || []).forEach((action) => {
    const actionCode = normalizeInspectionDashboardActionCode(action?.actionCode);

    if (!actionCode) {
      return;
    }

    if (INSPECTION_DASHBOARD_TASK_ACTION_CODES.has(actionCode)) {
      if (!actionByCode.has(actionCode)) {
        actionByCode.set(actionCode, action);
      }
      return;
    }

    if (INSPECTION_DASHBOARD_NAVIGATION_ACTION_CODES.has(actionCode)) {
      navigationActions.push(action);
    }
  });

  return [
    ...INSPECTION_DASHBOARD_TASK_ACTION_ORDER.map((actionCode) =>
      actionByCode.get(actionCode)
    ).filter((action): action is InspectionDashboardActionDto => Boolean(action)),
    ...navigationActions,
  ]
    .map((action, index) =>
      mapInspectionDashboardAction(action, index, rowTaskId, rowTaskNo)
    )
    .filter((action): action is DashboardTableAction => Boolean(action));
};

const getInspectionDashboardReassignAction = (
  actions: InspectionDashboardActionDto[] | null | undefined,
  sourceId?: string
): DashboardTableAction | undefined => {
  if (!sourceId) {
    return undefined;
  }

  const action = (actions || []).find(
    (item) =>
      normalizeInspectionDashboardActionCode(item?.actionCode) ===
      INSPECTION_DASHBOARD_REASSIGN_ACTION_CODE
  );

  if (!action) {
    return undefined;
  }

  return {
    key: INSPECTION_DASHBOARD_REASSIGN_ACTION_CODE,
    labelKey: "adminDashboard.actions.reassign",
    actionCode: INSPECTION_DASHBOARD_REASSIGN_ACTION_CODE,
    sourceActionUrl: optionalString(action?.actionUrl),
    openMode: optionalString(action?.openMode),
    taskId: sourceId,
    tone: "gold",
  };
};

const mapInspectionRow = (
  task: InspectionDashboardTaskDto,
  index: number,
  getItemKey: ReturnType<typeof createDashboardItemKeyFactory>
): DashboardTableRow => {
  const sourceId = optionalString(task.taskId);
  const taskNo = optionalString(task.taskNo);

  const rowTarget = createInspectionDashboardTaskDetailTarget(sourceId, taskNo);
  const statusText = optionalString(task.status);
  const row: DashboardTableRow = {
    key: getItemKey({
      namespace: "inspection",
      identityParts: [
        sourceId,
        taskNo,
        task.dueDate,
        statusText,
        task.inspectionTarget,
      ],
      index,
    }),
    sourceType: "inspection",
    sourceId,
    ...rowTarget,
    taskNo: dashboardCell(taskNo, { urgent: Boolean(task.isUrgent) }),
    target: dashboardCell(optionalString(task.inspectionTarget), {
      icon: getInspectionTargetIcon(task.targetTypeCode),
    }),
    reason: dashboardCell(optionalString(task.inspectionReason)),
    priority: dashboardCell(optionalString(task.priority)),
    dueDate: dashboardCell(formatDateTime(task.dueDate)),
    sla: dashboardCell(optionalString(task.slaLabel?.displayText), {
      tone: getSlaTone(task.slaLabel?.color, task.slaLabel?.displayText),
    }),
    status: dashboardCell(statusText, {
      tone: normalizeStatusTone(statusText),
    }),
    inspector: dashboardCell(optionalString(task.inspector)),
    emirate: dashboardCell(optionalString(task.emirate)),
    authority: dashboardCell(optionalString(task.authority)),
    assignedTime: dashboardCell(formatDateTime(task.assignedTime)),
    method: dashboardCell(optionalString(task.inspectionMethod)),
    createdBy: dashboardCell(optionalString(task.createdBy)),
  };
  const actions = mapInspectionDashboardActions(task.availableActions, sourceId, taskNo);

  if (actions.length) {
    row.actions = actions;
  }

  return row;
};

const mapOtherRow = (
  task: InspectionDashboardTaskDto,
  index: number,
  getItemKey: ReturnType<typeof createDashboardItemKeyFactory>
): DashboardTableRow => {
  const sourceId = optionalString(task.taskId);
  const taskNo = optionalString(task.taskNo);

  const rowTarget = getFirstActionTarget(task.availableActions, "inspection");
  const statusText = optionalString(task.status);
  const row: DashboardTableRow = {
    key: getItemKey({
      namespace: "inspection",
      identityParts: [
        sourceId,
        taskNo,
        statusText,
        task.taskCategory,
        task.applyFor,
      ],
      index,
    }),
    sourceType: "inspection",
    sourceId,
    ...rowTarget,
    taskNo: dashboardCell(taskNo, { urgent: Boolean(task.isUrgent) }),
    category: dashboardCell(optionalString(task.taskCategory)),
    applyFor: dashboardCell(optionalString(task.applyFor), {
      icon: normalizeDashboardEntityIconType(task.applyForIconType),
    }),
    assignedTo: dashboardCell(optionalString(task.assignedTo)),
    sla: dashboardCell(optionalString(task.slaLabel?.displayText), {
      tone: getSlaTone(task.slaLabel?.color, task.slaLabel?.displayText),
    }),
    status: dashboardCell(statusText, {
      tone: normalizeStatusTone(statusText),
    }),
  };
  const openAction = createOpenAction(rowTarget);
  const reassignAction = getInspectionDashboardReassignAction(
    task.availableActions,
    sourceId
  );

  if (reassignAction && sourceId) {
    row.reassignTask = {
      sourceType: INSPECTION_DASHBOARD_OTHER_TASK_SOURCE_TYPE,
      sourceId,
      assignedTo: optionalString(task.assignedTo),
    };
    row.actions = [reassignAction];
  } else if (openAction) {
    row.actions = [openAction];
  }

  return row;
};

type InspectionTaskListSource =
  | InspectionDashboardTaskListDto
  | InspectionDashboardTaskDto[]
  | null
  | undefined;

const getInspectionTaskListRows = (
  list: InspectionTaskListSource,
  keys: Array<keyof InspectionDashboardTaskListDto>
) => {
  if (Array.isArray(list)) {
    return list;
  }

  return (
    keys
      .map((key) => list?.[key])
      .find((value): value is InspectionDashboardTaskDto[] =>
        Array.isArray(value)
      ) || []
  );
};

const getTaskListTotalCount = (list: InspectionTaskListSource) =>
  Array.isArray(list) ? list.length : countNumber(list?.totalCount);

const getTaskListPageIndex = (list: InspectionTaskListSource) =>
  Array.isArray(list) ? 1 : countNumber(list?.pageIndex) || 1;

const getTaskListPageSize = (
  list: InspectionTaskListSource,
  fallbackPageSize: number
) =>
  Array.isArray(list)
    ? fallbackPageSize
    : countNumber(list?.pageSize) || fallbackPageSize;

const getRecentTaskRows = (list?: InspectionTaskListSource) =>
  getInspectionTaskListRows(list, ["recentTasks", "tasks"]);

const getInspectionAttentionRows = (
  list?: InspectionTaskListSource
) => getInspectionTaskListRows(list, ["inspectionTasks", "tasks"]);

const getOtherAttentionRows = (list?: InspectionTaskListSource) =>
  getInspectionTaskListRows(list, ["otherTasks", "tasks"]);

const mapRecentAttentionTable = (
  list?: InspectionTaskListSource,
  sortState: {
    sortBy?: string;
    sortDirection?: DashboardTableSortDirection;
  } = {}
): DashboardTableSection => {
  const getItemKey = createDashboardItemKeyFactory("inspection-recent");

  return {
    key: "inspection-staff-recent",
    titleKey: "adminDashboard.sections.recentlyAssignedTasks",
    tabs: [
      {
        key: "recentAssigned",
        labelKey: "adminDashboard.tabs.recentlyAssignedTasks",
        count: getTaskListTotalCount(list),
        columns: getRecentTaskColumns(),
        rows: getRecentTaskRows(list).map((task, index) =>
          mapInspectionRow(task, index, getItemKey)
        ),
        pageIndex: getTaskListPageIndex(list),
        pageSize: getTaskListPageSize(list, INSPECTION_TASK_PAGE_SIZE),
        totalCount: getTaskListTotalCount(list),
        sortBy: sortState.sortBy,
        sortDirection: sortState.sortDirection,
      },
    ],
  };
};

const getSummaryTab = (
  summary: InspectionDashboardAttentionSummaryDto | null | undefined,
  tabKey: string
) => (summary?.tabs || []).find((item) => String(item.tabKey || "") === tabKey);

const resolveAttentionTabCount = (
  summary: InspectionDashboardAttentionSummaryDto | null | undefined,
  tabKey: string,
  list?: InspectionTaskListSource
) =>
  !Array.isArray(list) && optionalNumber(list?.totalCount) !== undefined
    ? countNumber(list?.totalCount)
    : countNumber(getSummaryTab(summary, tabKey)?.count);

const mapManagerAttentionTable = (
  summary?: InspectionDashboardAttentionSummaryDto | null,
  inspectionList?: InspectionTaskListSource,
  otherList?: InspectionTaskListSource,
  sortStateByTab: Partial<
    Record<
      (typeof INSPECTION_MANAGER_TABS)[number],
      {
        sortBy?: string;
        sortDirection?: DashboardTableSortDirection;
      }
    >
  > = {}
): DashboardTableSection => ({
  key: "inspection-manager-attention",
  titleKey: "adminDashboard.sections.needsManagerAttention",
  tabs: INSPECTION_MANAGER_TABS.map((tabKey) => {
    const list = tabKey === "other" ? otherList : inspectionList;
    const summaryTab = getSummaryTab(summary, tabKey);
    const getItemKey = createDashboardItemKeyFactory(
      tabKey === "other" ? "inspection-manager-other" : "inspection-manager-task"
    );
    const rows =
      tabKey === "other"
        ? getOtherAttentionRows(list).map((task, index) =>
            mapOtherRow(task, index, getItemKey)
          )
        : getInspectionAttentionRows(list).map((task, index) =>
            mapInspectionRow(task, index, getItemKey)
          );

    return {
      key: tabKey,
      labelKey:
        tabKey === "other"
          ? "adminDashboard.tabs.otherTasks"
          : "adminDashboard.tabs.inspectionTasks",
      labelText: optionalString(summaryTab?.tabTitle),
      count: resolveAttentionTabCount(summary, tabKey, list),
      columns:
        tabKey === "other"
          ? getOtherTaskColumns()
          : getManagerInspectionTaskColumns(),
      rows,
      selectable: tabKey === "other",
      pageIndex: getTaskListPageIndex(list),
      pageSize: getTaskListPageSize(list, INSPECTION_TASK_PAGE_SIZE),
      totalCount: resolveAttentionTabCount(summary, tabKey, list),
      sortBy: sortStateByTab[tabKey]?.sortBy,
      sortDirection: sortStateByTab[tabKey]?.sortDirection,
    };
  }),
});

const mapCoachingRows = (coaching?: InspectionDashboardCoachingDto | null) => {
  const getItemKey = createDashboardItemKeyFactory("inspection-coaching");

  return (coaching?.members || []).map((item, index) => ({
    key: getItemKey({
      namespace: "member",
      identityParts: [item.memberId, item.memberName],
      index,
    }),
    member: optionalString(item.memberName),
    overdue: optionalNumber(item.overdue) ?? Number.NaN,
    slaCompliance: formatPercent(item.slaComplianceRate),
    avgProcessingTime: optionalString(item.avgProcessingTime),
  }));
};

const mapLeaveRows = (leave?: InspectionDashboardEmergencyLeaveDto | null) => {
  const getItemKey = createDashboardItemKeyFactory("inspection-leave");

  return (leave?.members || []).map((item, index) => ({
    key: getItemKey({
      namespace: "member",
      identityParts: [item.memberId, item.memberName, item.returnTime],
      index,
    }),
    name: optionalString(item.memberName),
    reasonKey: "adminDashboard.leave.medicalEmergency",
    reason: optionalString(item.leaveReason),
    returnAt: formatDateTime(item.returnTime),
    todoCount: optionalNumber(item.todoCount) ?? Number.NaN,
    avatar: optionalString(item.avatarUrl),
  }));
};

const mapOverviewToDashboardData = (
  overview: InspectionDashboardOverviewDto,
  fallbackRoleVariant: DashboardRoleVariant,
  initialTaskLists: InspectionDashboardInitialTaskLists = {}
): DashboardData => {
  const roleVariant = overview.userRole
    ? mapUserRole(overview.userRole)
    : fallbackRoleVariant;
  const recentTasks = initialTaskLists.recentAssigned;
  const needsAttentionInspection = initialTaskLists.needsAttentionInspection;
  const needsAttentionOther = initialTaskLists.needsAttentionOther;

  return {
    type: "workload",
    department: "inspection",
    roleVariant,
    taskTabs: mapTodoTabs(overview.todoCards, roleVariant),
    performanceTitleKey: isManagerRole(roleVariant)
      ? "adminDashboard.sections.teamPerformance"
      : "adminDashboard.sections.myPerformance",
    performanceMetrics: createMetricCards(overview.performance, roleVariant),
    donutCards: mapDonutCards(overview.taskHub, roleVariant),
    trendChart: mapPerformanceTrend(overview.performanceTrend),
    supportAction: isManagerRole(roleVariant)
      ? {
          targetPath: INSPECTION_ROUTE.teamManagement,
          permissionPath: INSPECTION_ROUTE.tasks,
        }
      : undefined,
    coachingRows: isManagerRole(roleVariant)
      ? mapCoachingRows(overview.membersNeedingCoaching)
      : undefined,
    leaveRows: isManagerRole(roleVariant)
      ? mapLeaveRows(overview.membersOnEmergencyLeave)
      : undefined,
    leaveTotalCount: isManagerRole(roleVariant)
      ? countNumber(overview.membersOnEmergencyLeave?.totalCount)
      : undefined,
    coachingInfoTooltipKey: isManagerRole(roleVariant)
      ? "adminDashboard.tooltips.membersNeedingCoaching"
      : undefined,
    attentionTable: isManagerRole(roleVariant)
      ? mapManagerAttentionTable(
          overview.needsAttentionSummary,
          needsAttentionInspection,
          needsAttentionOther
        )
      : mapRecentAttentionTable(recentTasks),
  };
};

const getInspectionDashboardOverview = (
  params: DashboardDataParams,
  roleVariant: DashboardRoleVariant
) =>
  request
    .get<
      DashboardApiResult<InspectionDashboardOverviewDto>,
      DashboardApiResult<InspectionDashboardOverviewDto>
    >(
      "/api/Inspection/Dashboard/Overview",
      {
        departmentId: INSPECTION_DASHBOARD_DEPARTMENT_ID,
        ...resolveDashboardDateRange(params.timeFilter),
        sections: getOverviewSections(roleVariant),
        recentPageIndex: 1,
        recentPageSize: INSPECTION_TASK_PAGE_SIZE,
        attentionPageIndex: 1,
        attentionPageSize: INSPECTION_TASK_PAGE_SIZE,
      },
      {
        skipErrorMessage: true,
        signal: params.signal,
      }
    )
    .then(unwrapDashboardResponse);

const getInspectionDashboardTaskList = (params: {
  listType: InspectionDashboardTaskListType;
  pageIndex?: number;
  pageSize?: number;
  timeFilter?: DashboardTimeFilter;
  sortBy?: string;
  sortDirection?: DashboardTableSortDirection;
  signal?: AbortSignal;
}) =>
  request
    .get<
      DashboardApiResult<InspectionDashboardTaskListDto>,
      DashboardApiResult<InspectionDashboardTaskListDto>
    >(
      "/api/Inspection/Dashboard/TaskList",
      {
        departmentId: INSPECTION_DASHBOARD_DEPARTMENT_ID,
        listType: params.listType,
        pageIndex: params.pageIndex || 1,
        pageSize: params.pageSize || INSPECTION_TASK_PAGE_SIZE,
        sortBy: params.sortBy,
        sortDirection: params.sortDirection,
        ...resolveDashboardDateRange(params.timeFilter),
      },
      {
        skipErrorMessage: true,
        signal: params.signal,
      }
    )
    .then(unwrapDashboardResponse);

const createEmptyInspectionTaskList = ({
  listType,
  pageIndex = 1,
  pageSize,
}: {
  listType: InspectionDashboardTaskListType;
  pageIndex?: number;
  pageSize?: number;
}): InspectionDashboardTaskListDto => ({
  listType,
  totalCount: 0,
  pageIndex,
  pageSize: pageSize || INSPECTION_TASK_PAGE_SIZE,
  tasks: [],
});

const isAbortError = (error: unknown) => {
  const abortError = error as { code?: string; name?: string };

  return (
    abortError?.code === "ERR_CANCELED" ||
    abortError?.name === "CanceledError" ||
    abortError?.name === "AbortError"
  );
};

const getInitialInspectionTaskList = (
  params: Parameters<typeof getInspectionDashboardTaskList>[0]
) =>
  getInspectionDashboardTaskList(params).catch((error) => {
    if (isAbortError(error)) {
      throw error;
    }

    return createEmptyInspectionTaskList({
      listType: params.listType,
      pageIndex: params.pageIndex || 1,
      pageSize: params.pageSize || INSPECTION_TASK_PAGE_SIZE,
    });
  });

export const getInspectionDashboardData = async (
  params: DashboardDataParams
): Promise<DashboardData> => {
  const overviewByInitialRole = await getInspectionDashboardOverview(
    params,
    params.roleVariant
  );
  const responseRoleVariant = overviewByInitialRole.userRole
    ? mapUserRole(overviewByInitialRole.userRole)
    : params.roleVariant;
  const overview =
    responseRoleVariant === params.roleVariant
      ? overviewByInitialRole
      : await getInspectionDashboardOverview(params, responseRoleVariant);
  const initialTaskLists = isManagerRole(responseRoleVariant)
    ? await Promise.all([
        getInitialInspectionTaskList({
          listType: "needsAttentionInspection",
          pageIndex: 1,
          pageSize: INSPECTION_TASK_PAGE_SIZE,
          timeFilter: params.timeFilter,
          signal: params.signal,
        }),
        getInitialInspectionTaskList({
          listType: "needsAttentionOther",
          pageIndex: 1,
          pageSize: INSPECTION_TASK_PAGE_SIZE,
          timeFilter: params.timeFilter,
          signal: params.signal,
        }),
      ]).then(([needsAttentionInspection, needsAttentionOther]) => ({
        needsAttentionInspection,
        needsAttentionOther,
      }))
    : {
        recentAssigned: await getInitialInspectionTaskList({
          listType: "recentAssigned",
          pageIndex: 1,
          pageSize: INSPECTION_TASK_PAGE_SIZE,
          timeFilter: params.timeFilter,
          signal: params.signal,
        }),
      };

  return mapOverviewToDashboardData(
    overview,
    responseRoleVariant,
    initialTaskLists
  );
};

export const getInspectionDashboardTaskCards = async ({
  roleVariant,
  tabKey,
  timeFilter,
  signal,
}: {
  roleVariant: DashboardRoleVariant;
  tabKey: string;
  pageSize?: number;
  timeFilter?: DashboardTimeFilter;
  signal?: AbortSignal;
}): Promise<InspectionDashboardTaskCardsResult> => {
  const overview = await getInspectionDashboardOverview(
    {
      department: "inspection",
      roleVariant,
      timeFilter:
        timeFilter || {
          preset: "last7",
          days: 7,
        },
      signal,
    },
    roleVariant
  );
  const todoSection = overview.todoCards;
  const tab = (todoSection?.tabs || []).find(
    (item) => String(item.tabKey || "") === tabKey
  );

  return {
    tabKey,
    count: countNumber(tab?.todoCount),
    cards: mapTaskCards(tab?.cards || [], `inspection-${tabKey}`),
  };
};

export const getInspectionDashboardAttentionTab = async ({
  roleVariant,
  tabKey,
  pageIndex = 1,
  pageSize,
  timeFilter,
  sortBy,
  sortDirection,
  signal,
}: InspectionDashboardTaskListParams): Promise<InspectionDashboardAttentionTabResult> => {
  const listType: InspectionDashboardTaskListType = isManagerRole(roleVariant)
    ? tabKey === "other"
      ? "needsAttentionOther"
      : "needsAttentionInspection"
    : "recentAssigned";
  const resolvedPageSize = pageSize || INSPECTION_TASK_PAGE_SIZE;
  const response = await getInspectionDashboardTaskList({
    listType,
    pageIndex,
    pageSize: resolvedPageSize,
    timeFilter,
    sortBy,
    sortDirection,
    signal,
  }).catch((error) => {
    if (isAbortError(error)) {
      throw error;
    }

    return createEmptyInspectionTaskList({
      listType,
      pageIndex,
      pageSize: resolvedPageSize,
    });
  });

  if (!isManagerRole(roleVariant)) {
    return {
      tab: mapRecentAttentionTable(response, {
        sortBy,
        sortDirection,
      }).tabs[0],
    };
  }

  return {
    tab:
      tabKey === "other"
        ? mapManagerAttentionTable(undefined, undefined, response).tabs[1]
        : mapManagerAttentionTable(undefined, response, undefined, {
            inspection: {
              sortBy,
              sortDirection,
            },
          }).tabs[0],
  };
};
