import request from "@/utils/request";
import type {
  ContentMetricTile,
  ContentTrendSeries,
  DashboardApiGap,
  DashboardContentWorkloadData,
  DashboardData,
  DashboardDataParams,
  DashboardDisplayValue,
  DashboardLeaveRow,
  DashboardRoleVariant,
  DashboardTableColumn,
  DashboardTableRow,
  DashboardTableSection,
  DashboardTableTab,
  DashboardTaskCard,
  DashboardTaskTab,
  DashboardTimeFilter,
  DashboardTone,
} from "@/pages/Dashboard/type";
import {
  createDashboardWaitingOnCell,
  createDashboardItemKeyFactory,
  createOpenAction,
  dashboardCell,
  formatDateTime,
  formatMinutes,
  formatPercent,
  getFirstActionTarget,
  normalizeDashboardActionTarget,
  normalizeDashboardEntityIconType,
  normalizeStatusTone,
  normalizeTaskSourceType,
  optionalNumber,
  optionalString,
  resolveDashboardAttentionCount,
  resolveDashboardDateRange,
  unwrapDashboardResponse,
  withQuery,
  type DashboardApiResult,
} from "./dashboardApiShared";
import { getDashboardTaskCardTitleFromTaskNo } from "./dashboardTaskCardTitle";

export const CONTENT_DASHBOARD_DEPARTMENT_ID = 2;

const CONTENT_ROUTE = {
  applications: "/content/ContentApplications",
  teamManagement: "/content/team-management",
  violationDetails: "/content/team-management/violationsDetails",
  inspectionViolationDetails: "/inspection/violations/detail",
  tickets: "/happiness/tickets",
  appeals: "/happiness/appeals",
  refunds: "/happiness/refunds",
} as const;

const CONTENT_TODO_TAB_ORDER = [
  "serviceApplication",
  "enquiry",
  "appeal",
  "refund",
] as const;
const CONTENT_STAFF_ATTENTION_TABS = [
  "all",
  "externalApproval",
  "pendingModification",
] as const;
const CONTENT_MANAGER_ATTENTION_TABS = ["urgent", "blocked"] as const;

type ContentTodoTabKey = (typeof CONTENT_TODO_TAB_ORDER)[number];
type ContentDashboardAttentionTabKey =
  | (typeof CONTENT_STAFF_ATTENTION_TABS)[number]
  | (typeof CONTENT_MANAGER_ATTENTION_TABS)[number];
type ContentDashboardTaskListType =
  | "myTasks"
  | "needsYourAttention"
  | "managerAttentionUrgent"
  | "managerAttentionBlocked";

interface ContentDashboardSlaDto {
  displayText?: string | null;
  color?: string | null;
  sortWeight?: number | null;
  remainingMinutes?: number | null;
}

interface ContentDashboardActionDto {
  actionCode?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  openMode?: string | null;
}

interface ContentDashboardRelatedEntityDto {
  name?: string | null;
  type?: string | null;
  iconUrl?: string | null;
}

interface ContentDashboardTaskCardDto {
  sourceType?: string | null;
  sourceId?: string | null;
  taskNo?: string | null;
  statusBadge?: string | null;
  sla?: ContentDashboardSlaDto | null;
  taskTitle?: string | null;
  relatedEntity?: ContentDashboardRelatedEntityDto | null;
  sortTime?: string | null;
  availableActions?: ContentDashboardActionDto[] | null;
}

interface ContentDashboardTodoTabDto {
  tabKey?: string | null;
  tabTitle?: string | null;
  todoCount?: number | null;
  cards?: ContentDashboardTaskCardDto[] | null;
}

interface ContentDashboardTodoSectionDto {
  activeTab?: string | null;
  tabs?: ContentDashboardTodoTabDto[] | null;
}

interface ContentDashboardServiceApplicationCardDto {
  todoCount?: number | null;
  pendingReviewCount?: number | null;
  pendingModificationCount?: number | null;
  externalApprovalCount?: number | null;
  pendingDispositionCount?: number | null;
  dispositionVerificationCount?: number | null;
  totalTasks?: number | null;
  doneToday?: number | null;
  overdueTasks?: number | null;
}

interface ContentDashboardTaskHubDto {
  serviceApplicationCard?: ContentDashboardServiceApplicationCardDto | null;
}

interface ContentDashboardDepartmentTaskDistributionDto {
  serviceApplicationCard?: ContentDashboardServiceApplicationCardDto | null;
}

interface ContentDashboardAiRiskTagDto {
  tagCode?: string | null;
  tagName?: string | null;
  count?: number | null;
  isHighRisk?: boolean | null;
}

interface ContentDashboardAiRiskDetectionDto {
  tags?: ContentDashboardAiRiskTagDto[] | null;
}

interface ContentDashboardPerformanceDto {
  slaComplianceRate?: number | null;
  averageProcessingTime?: string | null;
  averageProcessingTimeMinutes?: number | null;
  approvalRateOfApplication?: number | null;
  overdueTasks?: number | null;
}

interface ContentDashboardTrendPointDto {
  timeLabel?: string | null;
  slaComplianceRate?: number | null;
  avgProcessingTimeMinutes?: number | null;
  avgProcessingTimeDisplay?: string | null;
}

interface ContentDashboardTrendAxisDto {
  unit?: string | null;
  tickLabels?: string[] | null;
  maxValueMinutes?: number | null;
}

interface ContentDashboardPerformanceTrendDto {
  bucketGranularity?: string | null;
  dataPoints?: ContentDashboardTrendPointDto[] | null;
  avgProcessingTimeAxis?: ContentDashboardTrendAxisDto | null;
}

interface ContentDashboardAttentionSummaryTabDto {
  tabKey?: string | null;
  tabTitle?: string | null;
  count?: number | null;
}

interface ContentDashboardAttentionSummaryDto {
  activeTab?: string | null;
  tabs?: ContentDashboardAttentionSummaryTabDto[] | null;
  totalCount?: number | null;
  urgentCount?: number | null;
  blockedCount?: number | null;
}

interface ContentDashboardAttentionTaskDto {
  sourceType?: string | null;
  sourceId?: string | null;
  taskNo?: string | null;
  serviceName?: string | null;
  taskCategory?: string | null;
  taskTitle?: string | null;
  applyFor?: string | null;
  applyForIconType?: string | null;
  waitingOn?: string | null;
  waitingOnIconType?: string | null;
  assignedToUserId?: string | null;
  assignedTo?: string | null;
  sla?: ContentDashboardSlaDto | null;
  statusCode?: string | null;
  statusDisplay?: string | null;
  timeAlertDisplay?: string | null;
  waitingMinutes?: number | null;
  isUrgent?: boolean | null;
  canReassign?: boolean | null;
  detailTarget?: string | null;
  availableActions?: ContentDashboardActionDto[] | null;
}

interface ContentDashboardAttentionListDto {
  totalCount?: number | null;
  pageIndex?: number | null;
  pageSize?: number | null;
  activeTab?: string | null;
  tabs?: ContentDashboardAttentionSummaryTabDto[] | null;
  tasks?: ContentDashboardAttentionTaskDto[] | null;
}

interface ContentDashboardCoachingMemberDto {
  memberId?: string | null;
  memberName?: string | null;
  overdueTasks?: number | null;
  slaComplianceRate?: number | null;
  avgProcessingTime?: string | null;
}

interface ContentDashboardCoachingDto {
  members?: ContentDashboardCoachingMemberDto[] | null;
}

interface ContentDashboardEmergencyLeaveMemberDto {
  memberId?: string | null;
  memberName?: string | null;
  leaveReason?: string | null;
  returnTime?: string | null;
  todoCount?: number | null;
  avatarUrl?: string | null;
}

interface ContentDashboardEmergencyLeaveDto {
  totalCount?: number | null;
  members?: ContentDashboardEmergencyLeaveMemberDto[] | null;
}

interface ContentDashboardOverviewDto {
  userRole?: string | null;
  todoSection?: ContentDashboardTodoSectionDto | null;
  taskHub?: ContentDashboardTaskHubDto | null;
  performance?: ContentDashboardPerformanceDto | null;
  performanceTrend?: ContentDashboardPerformanceTrendDto | null;
  teamPerformance?: ContentDashboardPerformanceDto | null;
  departmentTaskDistribution?:
    | ContentDashboardDepartmentTaskDistributionDto
    | null;
  aiRiskDetection?: ContentDashboardAiRiskDetectionDto | null;
  membersNeedingCoaching?: ContentDashboardCoachingDto | null;
  membersOnEmergencyLeave?: ContentDashboardEmergencyLeaveDto | null;
  needsYourAttentionSummary?: ContentDashboardAttentionSummaryDto | null;
  needsYourAttentionList?: ContentDashboardAttentionListDto | null;
  needsManagerAttentionSummary?: ContentDashboardAttentionSummaryDto | null;
  needsManagerAttentionUrgentList?: ContentDashboardAttentionListDto | null;
  needsManagerAttentionBlockedList?: ContentDashboardAttentionListDto | null;
}

interface ContentDashboardTaskListDto {
  listType?: ContentDashboardTaskListType | null;
  activeTab?: string | null;
  totalCount?: number | null;
  pageIndex?: number | null;
  pageSize?: number | null;
  myTasks?: ContentDashboardTaskCardDto[] | null;
  attentionTasks?: ContentDashboardAttentionTaskDto[] | null;
  blockedTasks?: ContentDashboardAttentionTaskDto[] | null;
  coachingMembers?: ContentDashboardCoachingMemberDto[] | null;
  membersOnLeave?: ContentDashboardEmergencyLeaveMemberDto[] | null;
}

export interface ContentDashboardTaskCardsResult {
  tabKey: string;
  count: number;
  cards: DashboardTaskCard[];
}

export interface ContentDashboardAttentionTabResult {
  tab: DashboardTableTab;
}

export interface ContentDashboardTaskListParams {
  roleVariant: DashboardRoleVariant;
  tabKey: ContentDashboardAttentionTabKey | string;
  pageIndex?: number;
  pageSize?: number;
  timeFilter?: DashboardTimeFilter;
  signal?: AbortSignal;
}

const CONTENT_SERVICE_APPLICATION_EXPECTED_SHAPE =
  "{ todoCount, pendingReviewCount, pendingModificationCount, externalApprovalCount, pendingDispositionCount, dispositionVerificationCount, totalTasks, doneToday, overdueTasks }";
const CONTENT_STAFF_PERFORMANCE_EXPECTED_SHAPE =
  "{ slaComplianceRate, averageProcessingTime, averageProcessingTimeMinutes, approvalRateOfApplication, overdueTasks }";
const CONTENT_MANAGER_PERFORMANCE_EXPECTED_SHAPE =
  "{ slaComplianceRate, averageProcessingTime, averageProcessingTimeMinutes, approvalRateOfApplication, overdueTasks }";
const CONTENT_PERFORMANCE_TREND_EXPECTED_SHAPE =
  "{ bucketGranularity, dataPoints:[{ timeLabel, slaComplianceRate, avgProcessingTimeMinutes, avgProcessingTimeDisplay }], avgProcessingTimeAxis:{ unit, tickLabels, maxValueMinutes } }";
const CONTENT_RISK_EXPECTED_SHAPE =
  "{ tags:[{ tagCode, tagName, count, isHighRisk }] }";
const CONTENT_COACHING_EXPECTED_SHAPE =
  "{ members:[{ memberId, memberName, overdueTasks, slaComplianceRate, avgProcessingTime }] }";
const CONTENT_LEAVE_EXPECTED_SHAPE =
  "{ totalCount, members:[{ memberId, memberName, leaveReason, returnTime, todoCount }] }";

const CONTENT_STAFF_TOTAL_TASKS_TOOLTIP =
  "Total application tasks assigned to you within the selected period.";
const CONTENT_MANAGER_TOTAL_TASKS_TOOLTIP =
  "Total assigned application tasks accross the department within the selected period.";
const CONTENT_STAFF_TREND_TOOLTIP =
  "Trend of SLA Compliance and Average Processing Time within the selected period and across all assigned tasks.";
const CONTENT_MANAGER_COACHING_TOOLTIP =
  "Team members who may need additional guidance or follow-up based on the performance within the selected period.";
const CONTENT_STAFF_AI_RISK_TOOLTIP =
  "Distribution of AI-tagged labels across your assigned applications. Each label is counted once per application.";
const CONTENT_MANAGER_AI_RISK_TOOLTIP =
  "Distribution of AI-tagged labels across department-assigned applications. Each label is counted once per application.";

const CONTENT_STAFF_METRIC_TOOLTIP_BY_KEY = {
  approvalRate:
    "Percentage of Approve decisions among all final decisions made at this approval step within the selected period",
  avgProcessingTime:
    "Average time taken to complete tasks within the selected period and across all assigned tasks.",
  overdueTasks:
    "Number of open tasks that exceeded the SLA deadline within the selected period and across all assigned tasks.",
  slaCompliance:
    "Percentage of completed tasks that met the SLA within the selected period and across all assigned tasks.",
} as const;

const CONTENT_MANAGER_METRIC_TOOLTIP_BY_KEY = {
  approvalRate:
    "Percentage of Approve decisions among all final decisions made on Service Applications within the selected period.",
  avgProcessingTime:
    "Average time taken to complete all department tasks within the selected period.",
  overdueTasks:
    "Number of open department tasks that exceeded the SLA deadline within the selected period.",
  slaCompliance:
    "Percentage of all completed department tasks that met the SLA within the selected period.",
} as const;

const CONTENT_SERVICE_APPLICATION_LEGENDS = [
  {
    color: "#FAD44F",
    key: "pendingReview",
    labelText: "Pending Review",
  },
  {
    color: "#F5AC7C",
    key: "pendingModification",
    labelText: "Pending Modification",
  },
  {
    color: "#81C1FF",
    key: "externalApproval",
    labelText: "External Approval",
  },
  {
    color: "#F0ABFC",
    key: "pendingDisposition",
    labelText: "Pending Disposition",
  },
  {
    color: "#A0D5AB",
    key: "dispositionVerification",
    labelText: "Disposition Verification",
  },
] as const;

const CONTENT_RISK_ICON_BY_CODE = {
  "1": "politicalSensitivity",
  "2": "religiousContent",
  "3": "lgbtContent",
  "4": "adultContent",
  "5": "violenceHateSpeech",
  "6": "childProtection",
  "7": "prohibitedWords",
  "8": "prohibitedWords",
} as const;

const CONTENT_SERVICE_APPLICATION_STAFF_TARGET = withQuery(
  CONTENT_ROUTE.applications,
  {
    tab: "myTasks",
  }
);
const CONTENT_SERVICE_APPLICATION_MANAGER_TARGET = withQuery(
  CONTENT_ROUTE.applications,
  {
    tab: "teamTasks",
  }
);
const CONTENT_MY_TASKS_TARGET = withQuery(CONTENT_ROUTE.applications, {
  tab: "myTasks",
});
const CONTENT_TEAM_MEMBERS_TARGET = withQuery(CONTENT_ROUTE.teamManagement, {
  tab: "teamMembers",
});
const CONTENT_APPEALS_TARGET = withQuery(CONTENT_ROUTE.appeals, {
  tab: "todo",
  viewRole: "department",
  pageTitleKey: "menu.appeals",
  breadcrumbRootKey: "menu.customer",
});

const isManagerRole = (roleVariant: DashboardRoleVariant) =>
  roleVariant === "manager";

const mapContentUserRole = (
  userRole?: string | null
): DashboardRoleVariant => {
  const normalizedRole = String(userRole || "").trim().toLowerCase();

  if (
    normalizedRole.includes("manager") ||
    normalizedRole.includes("head") ||
    normalizedRole.includes("leader")
  ) {
    return "manager";
  }

  return "staff";
};

const stringifyGapValue = (value: unknown) => {
  try {
    const text = JSON.stringify(value);

    if (!text) {
      return "null";
    }

    return text.length > 600 ? `${text.slice(0, 597)}...` : text;
  } catch (error) {
    return String(error || value);
  }
};

const pushGap = (
  apiGaps: DashboardApiGap[],
  {
    actualValue,
    cardTitle,
    endpoint,
    expectedShape,
    roleVariant,
  }: Omit<DashboardApiGap, "actualValue" | "key"> & {
    actualValue: unknown;
  }
) => {
  const key = `${roleVariant}:${cardTitle}:${endpoint}`;

  if (apiGaps.some((item) => item.key === key)) {
    return;
  }

  apiGaps.push({
    key,
    roleVariant,
    cardTitle,
    endpoint,
    expectedShape,
    actualValue: stringifyGapValue(actualValue),
  });
};

const createUnavailableValue = (): DashboardDisplayValue => ({
  text: "-",
  available: false,
});

const createCountDisplayValue = (value?: unknown): DashboardDisplayValue => {
  const numericValue = optionalNumber(value);

  if (numericValue === undefined) {
    return createUnavailableValue();
  }

  return {
    text: numericValue.toLocaleString("en-US", {
      maximumFractionDigits: Number.isInteger(numericValue) ? 0 : 1,
    }),
    available: true,
  };
};

const createPercentDisplayValue = (value?: unknown): DashboardDisplayValue => {
  const text = formatPercent(value);

  return text
    ? {
        text,
        available: true,
      }
    : createUnavailableValue();
};

const createTimeDisplayValue = (
  displayValue?: unknown,
  minutesValue?: unknown
): DashboardDisplayValue => {
  const text = optionalString(displayValue) || formatMinutes(minutesValue);

  return text
    ? {
        text,
        available: true,
      }
    : createUnavailableValue();
};

const hasNamedNumericKeys = (
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[]
) => keys.every((key) => optionalNumber(source?.[key]) !== undefined);

const getContentTodoTabLabelKey = (tabKey: ContentTodoTabKey) => {
  if (tabKey === "serviceApplication") {
    return "adminDashboard.tabs.serviceApplication";
  }

  if (tabKey === "enquiry") {
    return "adminDashboard.tabs.enquiriesComplaints";
  }

  if (tabKey === "refund") {
    return "adminDashboard.tabs.refunds";
  }

  return "adminDashboard.tabs.appeals";
};

const mapTaskCards = (
  cards: ContentDashboardTaskCardDto[] = [],
  prefix: string
): DashboardTaskCard[] => {
  const getItemKey = createDashboardItemKeyFactory(prefix);

  return cards.map((card, index): DashboardTaskCard => {
    const sourceId = optionalString(card.sourceId);
    const taskNo = optionalString(card.taskNo);
    const sourceType = normalizeTaskSourceType(card.sourceType);
    const target =
      sourceType === "violation" && sourceId
        ? {
            targetPath: withQuery(CONTENT_ROUTE.violationDetails, {
              violationId: sourceId,
            }),
            permissionPath: CONTENT_ROUTE.teamManagement,
            // Content roles without team management permission (Content Supervisor,
            // Content Officer) reach the same violation details page through the
            // inspection module instead.
            fallbackTargets: [
              {
                targetPath: withQuery(
                  CONTENT_ROUTE.inspectionViolationDetails,
                  {
                    from: "violations",
                    violationId: sourceId,
                  }
                ),
                permissionPath: CONTENT_ROUTE.inspectionViolationDetails,
              },
            ],
          }
        : getFirstActionTarget(card.availableActions, "content");
    const statusText = optionalString(card.statusBadge);

    return {
      key: getItemKey({
        namespace: sourceType,
        identityParts: [sourceId, taskNo, card.sortTime],
        index,
      }),
      statusText,
      statusTone: normalizeStatusTone(statusText),
      alertText: optionalString(card.sla?.displayText),
      title: getDashboardTaskCardTitleFromTaskNo(sourceType, {
        taskTitle: optionalString(card.taskTitle),
        taskNo,
      }),
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
  todoSection?: ContentDashboardTodoSectionDto | null
): DashboardTaskTab[] => {
  const sourceTabs = todoSection?.tabs || [];
  const tabsByKey = new Map(
    sourceTabs.map((tab) => [String(tab.tabKey || ""), tab])
  );
  const configuredTabs = CONTENT_TODO_TAB_ORDER.map((tabKey) => {
    const sourceTab = tabsByKey.get(tabKey);
    const actionTarget =
      tabKey === "enquiry"
        ? {
            actionPath: CONTENT_ROUTE.tickets,
            actionPermissionPath: CONTENT_ROUTE.tickets,
          }
        : tabKey === "appeal"
        ? {
            actionPath: CONTENT_APPEALS_TARGET,
            actionPermissionPath: CONTENT_ROUTE.appeals,
          }
        : tabKey === "refund"
        ? {
            actionPath: CONTENT_ROUTE.refunds,
            actionPermissionPath: CONTENT_ROUTE.refunds,
          }
        : {
            actionPath: CONTENT_MY_TASKS_TARGET,
            actionPermissionPath: CONTENT_ROUTE.applications,
          };
    return {
      key: tabKey,
      labelKey: getContentTodoTabLabelKey(tabKey),
      count: optionalNumber(sourceTab?.todoCount) ?? 0,
      cards: mapTaskCards(sourceTab?.cards || [], `content-${tabKey}-overview`),
      ...actionTarget,
    };
  });
  const additionalTab = sourceTabs[4];
  const additionalTabKey = optionalString(additionalTab?.tabKey);
  const hasDuplicateAdditionalTabKey =
    Boolean(additionalTabKey) &&
    sourceTabs
      .slice(0, 4)
      .some((tab) => optionalString(tab.tabKey) === additionalTabKey);
  const isConfiguredTabKey =
    Boolean(additionalTabKey) &&
    CONTENT_TODO_TAB_ORDER.includes(additionalTabKey as ContentTodoTabKey);

  if (!additionalTabKey || hasDuplicateAdditionalTabKey || isConfiguredTabKey) {
    return configuredTabs;
  }

  return [
    ...configuredTabs,
    {
      key: additionalTabKey,
      labelText: optionalString(additionalTab.tabTitle),
      count: optionalNumber(additionalTab.todoCount) ?? 0,
      cards: mapTaskCards(
        additionalTab.cards || [],
        `content-${additionalTabKey}-overview`
      ),
      actionPath: CONTENT_MY_TASKS_TARGET,
      actionPermissionPath: CONTENT_ROUTE.applications,
    },
  ];
};

const createPerformanceTiles = ({
  performance,
  roleVariant,
}: {
  performance?: ContentDashboardPerformanceDto | null;
  roleVariant: DashboardRoleVariant;
}): ContentMetricTile[] => {
  const metricTooltipByKey = isManagerRole(roleVariant)
    ? CONTENT_MANAGER_METRIC_TOOLTIP_BY_KEY
    : CONTENT_STAFF_METRIC_TOOLTIP_BY_KEY;
  const approvalTile: ContentMetricTile = {
    key: "approvalRate",
    labelText: isManagerRole(roleVariant)
      ? "Approval Rate"
      : "Approval Rate of Application",
    value: createPercentDisplayValue(performance?.approvalRateOfApplication),
    icon: "approvalRate",
    showInfo: true,
    infoTooltipText: metricTooltipByKey.approvalRate,
  };
  const overdueTile: ContentMetricTile = {
    key: "overdueTasks",
    labelText: "Overdue Tasks",
    value: createCountDisplayValue(performance?.overdueTasks),
    icon: "overdueTasks",
    showInfo: true,
    infoTooltipText: metricTooltipByKey.overdueTasks,
  };

  return isManagerRole(roleVariant)
    ? [
        {
          key: "slaCompliance",
          labelText: "SLA Compliance",
          value: createPercentDisplayValue(performance?.slaComplianceRate),
          icon: "slaCompliance",
          showInfo: true,
          infoTooltipText: metricTooltipByKey.slaCompliance,
        },
        {
          key: "avgProcessingTime",
          labelText: "Avg. Processing Time",
          value: createTimeDisplayValue(
            performance?.averageProcessingTime,
            performance?.averageProcessingTimeMinutes
          ),
          icon: "avgProcessingTime",
          showInfo: true,
          infoTooltipText: metricTooltipByKey.avgProcessingTime,
        },
        overdueTile,
        approvalTile,
      ]
    : [
        {
          key: "slaCompliance",
          labelText: "SLA Compliance",
          value: createPercentDisplayValue(performance?.slaComplianceRate),
          icon: "slaCompliance",
          showInfo: true,
          infoTooltipText: metricTooltipByKey.slaCompliance,
        },
        {
          key: "avgProcessingTime",
          labelText: "Avg. Processing Time",
          value: createTimeDisplayValue(
            performance?.averageProcessingTime,
            performance?.averageProcessingTimeMinutes
          ),
          icon: "avgProcessingTime",
          showInfo: true,
          infoTooltipText: metricTooltipByKey.avgProcessingTime,
        },
        approvalTile,
        overdueTile,
      ];
};

const createPerformanceCard = ({
  apiGaps,
  performance,
  roleVariant,
}: {
  apiGaps: DashboardApiGap[];
  performance?: ContentDashboardPerformanceDto | null;
  roleVariant: DashboardRoleVariant;
}) => {
  const performanceRecord = performance as Record<string, unknown> | undefined;
  const hasExpectedShape =
    hasNamedNumericKeys(performanceRecord, [
      "slaComplianceRate",
      "averageProcessingTimeMinutes",
      "approvalRateOfApplication",
      "overdueTasks",
    ]) && Boolean(optionalString(performance?.averageProcessingTime));

  if (!hasExpectedShape) {
    pushGap(apiGaps, {
      roleVariant,
      cardTitle: isManagerRole(roleVariant)
        ? "Team Performance"
        : "My Performance",
      endpoint: "/api/Content/Dashboard/Overview",
      expectedShape: isManagerRole(roleVariant)
        ? CONTENT_MANAGER_PERFORMANCE_EXPECTED_SHAPE
        : CONTENT_STAFF_PERFORMANCE_EXPECTED_SHAPE,
      actualValue: performance || null,
    });
  }

  return {
    key: "content-performance",
    titleText: isManagerRole(roleVariant)
      ? "Team Performance"
      : "My Performance",
    tiles: createPerformanceTiles({
      performance,
      roleVariant,
    }),
  };
};

const createServiceApplicationCard = ({
  apiGaps,
  roleVariant,
  source,
}: {
  apiGaps: DashboardApiGap[];
  roleVariant: DashboardRoleVariant;
  source?: ContentDashboardServiceApplicationCardDto | null;
}) => {
  const cardRecord = source as Record<string, unknown> | undefined;
  const hasBaseShape = hasNamedNumericKeys(cardRecord, [
    "todoCount",
    "pendingReviewCount",
    "pendingModificationCount",
    "externalApprovalCount",
    "pendingDispositionCount",
    "dispositionVerificationCount",
    "totalTasks",
    "doneToday",
    "overdueTasks",
  ]);
  if (!hasBaseShape) {
    pushGap(apiGaps, {
      roleVariant,
      cardTitle: "Service Application",
      endpoint: "/api/Content/Dashboard/Overview",
      expectedShape: CONTENT_SERVICE_APPLICATION_EXPECTED_SHAPE,
      actualValue: source || null,
    });
  }

  type LegendCountKey =
    | "pendingReviewCount"
    | "pendingModificationCount"
    | "externalApprovalCount"
    | "pendingDispositionCount"
    | "dispositionVerificationCount";

  const legends = CONTENT_SERVICE_APPLICATION_LEGENDS.map((item) => ({
    key: item.key,
    labelText: item.labelText,
    color: item.color,
    value: hasBaseShape
      ? createCountDisplayValue(
          source?.[(item.key + "Count") as LegendCountKey]
        )
      : createUnavailableValue(),
  }));

  return {
    key: "content-service-application",
    titleText: "Service Application",
    targetPath: isManagerRole(roleVariant)
      ? CONTENT_SERVICE_APPLICATION_MANAGER_TARGET
      : CONTENT_SERVICE_APPLICATION_STAFF_TARGET,
    permissionPath: CONTENT_ROUTE.applications,
    centerValue: hasBaseShape
      ? createCountDisplayValue(source?.todoCount)
      : createUnavailableValue(),
    centerLabelText: "To Do",
    legends,
    footerStats: [
      {
        key: "totalTasks",
        labelText: "Total Tasks",
        value: hasBaseShape
          ? createCountDisplayValue(source?.totalTasks)
          : createUnavailableValue(),
        showInfo: true,
        infoTooltipText: isManagerRole(roleVariant)
          ? CONTENT_MANAGER_TOTAL_TASKS_TOOLTIP
          : CONTENT_STAFF_TOTAL_TASKS_TOOLTIP,
      },
      {
        key: "doneToday",
        labelText: "Done Today",
        value: hasBaseShape
          ? createCountDisplayValue(source?.doneToday)
          : createUnavailableValue(),
        tone: "green" as const,
      },
      {
        key: "overdueTasks",
        labelText: "Overdue Tasks",
        value: hasBaseShape
          ? createCountDisplayValue(source?.overdueTasks)
          : createUnavailableValue(),
        tone: "red" as const,
      },
    ],
    chartSegments: hasBaseShape
      ? CONTENT_SERVICE_APPLICATION_LEGENDS.map((item) => ({
          key: item.key,
          color: item.color,
          value:
            optionalNumber(
              source?.[(item.key + "Count") as LegendCountKey]
            ) ?? 0,
        }))
      : [],
  };
};

const createAiRiskCard = ({
  apiGaps,
  riskDetection,
  roleVariant,
}: {
  apiGaps: DashboardApiGap[];
  riskDetection?: ContentDashboardAiRiskDetectionDto | null;
  roleVariant: DashboardRoleVariant;
}) => {
  const sourceTags = Array.isArray(riskDetection?.tags) ? riskDetection?.tags || [] : [];
  const hasExpectedShape =
    sourceTags.length > 0 &&
    sourceTags.every(
      (tag) =>
        Boolean(optionalString(tag.tagCode) || optionalString(tag.tagName)) &&
        optionalNumber(tag.count) !== undefined
    );
  const items = sourceTags.map((tag, index) => {
    const numericCount = optionalNumber(tag.count);
    const tagCode = optionalString(tag.tagCode);
    const tagName = optionalString(tag.tagName);
    const key = tagCode || tagName || `risk-tag-${index}`;
    return {
      key,
      labelText: tagName || "",
      icon:
        CONTENT_RISK_ICON_BY_CODE[
          tagCode as keyof typeof CONTENT_RISK_ICON_BY_CODE
        ] || ("prohibitedWords" as const),
      value:
        numericCount === undefined
          ? createUnavailableValue()
          : createCountDisplayValue(numericCount),
      highlight: Boolean(tag.isHighRisk) && (numericCount || 0) > 0,
    };
  });
  if (!hasExpectedShape) {
    pushGap(apiGaps, {
      roleVariant,
      cardTitle: "AI Content Risk Detection",
      endpoint: "/api/Content/Dashboard/Overview",
      expectedShape: CONTENT_RISK_EXPECTED_SHAPE,
      actualValue: sourceTags.map((tag) => ({
        tagCode: tag.tagCode,
        tagName: tag.tagName,
        count: tag.count,
        isHighRisk: tag.isHighRisk,
      })),
    });
  }

  return {
    key: "content-ai-risk",
    titleText: "AI Content Risk Detection",
    items,
    showInfo: true,
    infoTooltipText: isManagerRole(roleVariant)
      ? CONTENT_MANAGER_AI_RISK_TOOLTIP
      : CONTENT_STAFF_AI_RISK_TOOLTIP,
  };
};

const mapTrendAxisUnit = (
  unit?: unknown
): "minutes" | "hours" | "days" => {
  const normalizedUnit = String(unit || "").trim().toLowerCase();

  if (normalizedUnit.startsWith("day")) {
    return "days";
  }

  if (normalizedUnit.startsWith("hour")) {
    return "hours";
  }

  return "minutes";
};

const createTrendCard = ({
  apiGaps,
  trend,
}: {
  apiGaps: DashboardApiGap[];
  trend?: ContentDashboardPerformanceTrendDto | null;
}) => {
  const points = trend?.dataPoints || [];
  const axis = trend?.avgProcessingTimeAxis;
  const normalizedPoints = points
    .map((point) => {
      const label = optionalString(point.timeLabel);
      const slaComplianceRate = optionalNumber(point.slaComplianceRate);
      const avgProcessingTimeMinutes = optionalNumber(
        point.avgProcessingTimeMinutes
      );

      if (
        !label ||
        slaComplianceRate === undefined ||
        avgProcessingTimeMinutes === undefined
      ) {
        return null;
      }

      return {
        label,
        slaComplianceRate,
        avgProcessingTimeDisplay:
          optionalString(point.avgProcessingTimeDisplay) ||
          formatMinutes(avgProcessingTimeMinutes) ||
          "0m",
        avgProcessingTimeMinutes,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const hasValidAxis =
    Array.isArray(axis?.tickLabels) &&
    axis.tickLabels.length > 0 &&
    optionalNumber(axis?.maxValueMinutes) !== undefined;
  const hasExpectedShape =
    normalizedPoints.length > 0 &&
    normalizedPoints.length === points.length &&
    hasValidAxis;

  if (!hasExpectedShape) {
    pushGap(apiGaps, {
      roleVariant: "staff",
      cardTitle: "Performance Trend",
      endpoint: "/api/Content/Dashboard/Overview",
      expectedShape: CONTENT_PERFORMANCE_TREND_EXPECTED_SHAPE,
      actualValue: trend || null,
    });
  }

  const series: ContentTrendSeries[] = hasExpectedShape
    ? [
        {
          key: "slaCompliance",
          labelText: "SLA Compliance",
          color: "#A0D5AB",
          axis: "left",
          unit: "%",
          values: normalizedPoints.map((point) => point.slaComplianceRate),
          available: true,
        },
        {
          key: "avgProcessingTime",
          labelText: "Avg. Processing Time",
          color: "#D7BC6D",
          axis: "right",
          unit: "time",
          values: normalizedPoints.map((point) => point.avgProcessingTimeMinutes),
          displayValues: normalizedPoints.map(
            (point) => point.avgProcessingTimeDisplay
          ),
          available: true,
        },
      ]
    : [
        {
          key: "slaCompliance",
          labelText: "SLA Compliance",
          color: "#A0D5AB",
          axis: "left",
          unit: "%",
          values: [],
          available: false,
        },
        {
          key: "avgProcessingTime",
          labelText: "Avg. Processing Time",
          color: "#D7BC6D",
          axis: "right",
          unit: "time",
          values: [],
          available: false,
        },
      ];

  return {
    key: "content-performance-trend",
    titleText: "Performance Trend",
    categories: hasExpectedShape
      ? normalizedPoints.map((point) => point.label)
      : [],
    series,
    avgProcessingTimeAxis: hasExpectedShape
      ? {
          unit: mapTrendAxisUnit(axis?.unit),
          tickLabels: axis?.tickLabels || [],
          maxValueMinutes: optionalNumber(axis?.maxValueMinutes) || 0,
        }
      : undefined,
    showInfo: true,
    infoTooltipText: CONTENT_STAFF_TREND_TOOLTIP,
  };
};

const parseDurationToMinutes = (value?: string | null) => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!normalizedValue) {
    return Number.NaN;
  }

  if (normalizedValue === "0m" || normalizedValue === "0min") {
    return 0;
  }

  const dayMatch = normalizedValue.match(/(\d+(?:\.\d+)?)\s*d/);
  const hourMatch = normalizedValue.match(/(\d+(?:\.\d+)?)\s*h/);
  const minuteMatch = normalizedValue.match(/(\d+(?:\.\d+)?)\s*m(?:in)?/);
  const days = dayMatch ? Number(dayMatch[1]) : 0;
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;

  if (days || hours || minutes || /\d/.test(normalizedValue)) {
    return days * 24 * 60 + hours * 60 + minutes;
  }

  return Number.NaN;
};

const createCoachingCard = ({
  apiGaps,
  coaching,
}: {
  apiGaps: DashboardApiGap[];
  coaching?: ContentDashboardCoachingDto | null;
}) => {
  const sourceMembers = Array.isArray(coaching?.members) ? coaching?.members || [] : [];
  const hasInvalidShape = sourceMembers.some(
    (member) =>
      !optionalString(member.memberId) ||
      !optionalString(member.memberName) ||
      optionalNumber(member.overdueTasks) === undefined ||
      optionalNumber(member.slaComplianceRate) === undefined ||
      !optionalString(member.avgProcessingTime)
  );

  if (!Array.isArray(coaching?.members) || hasInvalidShape) {
    pushGap(apiGaps, {
      roleVariant: "manager",
      cardTitle: "Members Needing Coaching",
      endpoint: "/api/Content/Dashboard/Overview",
      expectedShape: CONTENT_COACHING_EXPECTED_SHAPE,
      actualValue: coaching || null,
    });
  }

  const getRowKey = createDashboardItemKeyFactory("content-coaching");
  const rows = [...sourceMembers]
    .sort((left, right) => {
      const overdueDelta =
        (optionalNumber(right.overdueTasks) || 0) -
        (optionalNumber(left.overdueTasks) || 0);

      if (overdueDelta !== 0) {
        return overdueDelta;
      }

      const slaDelta =
        (optionalNumber(left.slaComplianceRate) ?? Number.POSITIVE_INFINITY) -
        (optionalNumber(right.slaComplianceRate) ?? Number.POSITIVE_INFINITY);

      if (slaDelta !== 0) {
        return slaDelta;
      }

      return (
        (parseDurationToMinutes(right.avgProcessingTime) || Number.NEGATIVE_INFINITY) -
        (parseDurationToMinutes(left.avgProcessingTime) || Number.NEGATIVE_INFINITY)
      );
    })
    .slice(0, 5)
    .map((member, index) => ({
      key: getRowKey({
        namespace: "member",
        identityParts: [member.memberId, member.memberName],
        index,
      }),
      member: optionalString(member.memberName) || "-",
      overdue: optionalNumber(member.overdueTasks) ?? Number.NaN,
      slaCompliance: formatPercent(member.slaComplianceRate),
      avgProcessingTime: optionalString(member.avgProcessingTime) || undefined,
    }));

  return {
    key: "content-members-needing-coaching",
    titleText: "Members Needing Coaching",
    targetPath: CONTENT_TEAM_MEMBERS_TARGET,
    permissionPath: CONTENT_ROUTE.teamManagement,
    rows,
    showInfo: true,
    infoTooltipText: CONTENT_MANAGER_COACHING_TOOLTIP,
  };
};

const createLeaveCard = ({
  apiGaps,
  leave,
}: {
  apiGaps: DashboardApiGap[];
  leave?: ContentDashboardEmergencyLeaveDto | null;
}) => {
  const sourceMembers = Array.isArray(leave?.members) ? leave?.members || [] : [];
  const totalCount = optionalNumber(leave?.totalCount);
  const hasInvalidShape = sourceMembers.some(
    (member) =>
      !optionalString(member.memberId) ||
      !optionalString(member.memberName) ||
      !optionalString(member.leaveReason) ||
      !optionalString(member.returnTime) ||
      optionalNumber(member.todoCount) === undefined
  );

  if (
    totalCount === undefined ||
    !Array.isArray(leave?.members) ||
    hasInvalidShape
  ) {
    pushGap(apiGaps, {
      roleVariant: "manager",
      cardTitle: "Members on Emergency Leave",
      endpoint: "/api/Content/Dashboard/Overview",
      expectedShape: CONTENT_LEAVE_EXPECTED_SHAPE,
      actualValue: leave || null,
    });
  }

  const getRowKey = createDashboardItemKeyFactory("content-leave");
  const rows: DashboardLeaveRow[] = [...sourceMembers]
    .sort(
      (left, right) =>
        (optionalNumber(right.todoCount) || 0) - (optionalNumber(left.todoCount) || 0)
    )
    .map((member, index) => ({
      key: getRowKey({
        namespace: "member",
        identityParts: [member.memberId, member.memberName, member.returnTime],
        index,
      }),
      name: optionalString(member.memberName) || "-",
      reasonKey: "adminDashboard.leave.medicalEmergency",
      reason: optionalString(member.leaveReason) || "-",
      returnAt: formatDateTime(member.returnTime),
      todoCount: optionalNumber(member.todoCount) ?? Number.NaN,
      avatar: optionalString(member.avatarUrl),
    }));

  return {
    key: "content-members-on-emergency-leave",
    titleText: "Members on Emergency Leave",
    targetPath: CONTENT_ROUTE.teamManagement,
    permissionPath: CONTENT_ROUTE.teamManagement,
    totalCount,
    rows,
  };
};

const getAttentionLabelKey = (tabKey: string) => {
  if (tabKey === "pendingModification") {
    return "adminDashboard.tabs.pendingModification";
  }

  if (tabKey === "externalApproval") {
    return "adminDashboard.tabs.externalApproval";
  }

  if (tabKey === "urgent") {
    return "adminDashboard.tabs.urgent";
  }

  if (tabKey === "blocked") {
    return "adminDashboard.tabs.blocked";
  }

  return "adminDashboard.tabs.all";
};

const getTimeAlertTone = (
  task: ContentDashboardAttentionTaskDto
): DashboardTone => {
  const timeAlert = String(task.timeAlertDisplay || "").toLowerCase();
  const waitingMinutes = optionalNumber(task.waitingMinutes) || 0;

  if (timeAlert.includes("overdue") || waitingMinutes >= 24 * 60) {
    return "red";
  }

  return "default";
};

const getAttentionColumns = (
  roleVariant: DashboardRoleVariant,
  tabKey: string
): DashboardTableColumn[] => {
  if (isManagerRole(roleVariant) && tabKey === "blocked") {
    return [
      {
        key: "taskNo",
        titleKey: "adminDashboard.table.taskNo",
        dataIndex: "taskNo",
        width: 220,
      },
      {
        key: "serviceName",
        titleKey: "adminDashboard.table.serviceName",
        dataIndex: "serviceName",
        width: 400,
      },
      {
        key: "waitingOn",
        titleKey: "adminDashboard.table.waitingOn",
        dataIndex: "waitingOn",
        width: 220,
      },
      {
        key: "assignedTo",
        titleKey: "adminDashboard.table.assignedTo",
        dataIndex: "assignedTo",
        width: 220,
      },
      {
        key: "status",
        titleKey: "adminDashboard.table.status",
        dataIndex: "status",
        width: 220,
      },
      {
        key: "timeAlert",
        titleKey: "adminDashboard.table.timeAlert",
        dataIndex: "timeAlert",
        width: 180,
      },
    ];
  }

  if (isManagerRole(roleVariant)) {
    return [
      {
        key: "taskNo",
        titleKey: "adminDashboard.table.taskNo",
        dataIndex: "taskNo",
        width: 200,
      },
      {
        key: "category",
        titleKey: "adminDashboard.table.taskCategory",
        dataIndex: "category",
        width: 220,
      },
      {
        key: "applyFor",
        titleKey: "adminDashboard.table.applyFor",
        dataIndex: "applyFor",
        width: 220,
      },
      {
        key: "assignedTo",
        titleKey: "adminDashboard.table.assignedTo",
        dataIndex: "assignedTo",
        width: 220,
      },
      {
        key: "sla",
        titleKey: "adminDashboard.table.sla",
        dataIndex: "sla",
        width: 160,
      },
      {
        key: "status",
        titleKey: "adminDashboard.table.status",
        dataIndex: "status",
        width: 180,
      },
      {
        key: "action",
        titleKey: "adminDashboard.table.action",
        dataIndex: "action",
        width: 120,
      },
    ];
  }

  return [
    {
      key: "taskNo",
      titleKey: "adminDashboard.table.taskNo",
      dataIndex: "taskNo",
      width: 220,
    },
    {
      key: "serviceName",
      titleKey: "adminDashboard.table.serviceName",
      dataIndex: "serviceName",
      width: 240,
    },
    {
      key: "waitingOn",
      titleKey: "adminDashboard.table.waitingOn",
      dataIndex: "waitingOn",
      width: 220,
    },
    {
      key: "status",
      titleKey: "adminDashboard.table.status",
      dataIndex: "status",
      width: 220,
    },
    {
      key: "timeAlert",
      titleKey: "adminDashboard.table.timeAlert",
      dataIndex: "timeAlert",
      width: 180,
    },
  ];
};

const mapAttentionRow = (
  task: ContentDashboardAttentionTaskDto,
  index: number,
  roleVariant: DashboardRoleVariant,
  tabKey: string,
  getItemKey: ReturnType<typeof createDashboardItemKeyFactory>
): DashboardTableRow => {
  const sourceType = normalizeTaskSourceType(task.sourceType);
  const sourceId = optionalString(task.sourceId);
  const taskNo = optionalString(task.taskNo);
  const detailTarget = normalizeDashboardActionTarget(task.detailTarget, "content");
  const actionTarget = getFirstActionTarget(
    task.availableActions,
    "content"
  );
  const rowTarget = detailTarget.targetPath ? detailTarget : actionTarget;
  const statusText = optionalString(task.statusDisplay);
  const row: DashboardTableRow = {
    key: getItemKey({
      namespace: sourceType,
      identityParts: [
        sourceId,
        taskNo,
        task.detailTarget,
        statusText,
        task.serviceName,
        task.taskCategory,
      ],
      index,
    }),
    sourceType,
    sourceId,
    ...rowTarget,
    taskNo: dashboardCell(taskNo, {
      urgent: Boolean(task.isUrgent),
    }),
    serviceName: dashboardCell(optionalString(task.serviceName)),
    category: dashboardCell(optionalString(task.taskCategory)),
    applyFor: dashboardCell(optionalString(task.applyFor), {
      icon: normalizeDashboardEntityIconType(task.applyForIconType),
    }),
    waitingOn: createDashboardWaitingOnCell(
      task.waitingOn,
      task.waitingOnIconType
    ),
    assignedTo: dashboardCell(optionalString(task.assignedTo)),
    sla: dashboardCell(optionalString(task.sla?.displayText), {
      tone:
        String(task.sla?.color || "").toLowerCase() === "danger"
          ? "red"
          : "default",
    }),
    status: dashboardCell(statusText, {
      tone: normalizeStatusTone(statusText),
    }),
    timeAlert: dashboardCell(optionalString(task.timeAlertDisplay), {
      tone: getTimeAlertTone(task),
    }),
  };

  if (
    isManagerRole(roleVariant) &&
    tabKey !== "blocked" &&
    task.canReassign &&
    sourceType &&
    sourceId
  ) {
    row.reassignTask = {
      sourceType,
      sourceId,
      userId: task.assignedToUserId,
      assignedTo: task.assignedTo,
      assignedToUserId: task.assignedToUserId,
    };
    row.actions = [
      {
        key: "reassign",
        labelKey: "adminDashboard.actions.reassign",
        tone: "gold",
      },
    ];

    return row;
  }

  const openAction = createOpenAction(actionTarget);

  if (openAction) {
    row.actions = [openAction];
  }

  return row;
};

const mapAttentionTab = ({
  count,
  pageIndex,
  pageSize,
  roleVariant,
  tabKey,
  tasks,
}: {
  count?: number | null;
  pageIndex?: number | null;
  pageSize?: number | null;
  roleVariant: DashboardRoleVariant;
  tabKey: string;
  tasks?: ContentDashboardAttentionTaskDto[] | null;
}): DashboardTableTab => {
  const getItemKey = createDashboardItemKeyFactory(`content-${tabKey}`);

  return {
    key: tabKey,
    labelKey: getAttentionLabelKey(tabKey),
    count: optionalNumber(count) ?? 0,
    columns: getAttentionColumns(roleVariant, tabKey),
    rows: (tasks || []).map((task, index) =>
      mapAttentionRow(task, index, roleVariant, tabKey, getItemKey)
    ),
    selectable: isManagerRole(roleVariant) && tabKey === "urgent",
    pageIndex: optionalNumber(pageIndex) || 1,
    pageSize: optionalNumber(pageSize) || 10,
    totalCount: optionalNumber(count) ?? 0,
  };
};

const mapStaffAttentionTable = (
  summary?: ContentDashboardAttentionSummaryDto | null,
  list?: ContentDashboardAttentionListDto | null
): DashboardTableSection => ({
  key: "content-staff-attention",
  titleKey: "adminDashboard.sections.needsYourAttention",
  tabs: CONTENT_STAFF_ATTENTION_TABS.map((tabKey) => {
    const activeList = String(list?.activeTab || "all") === tabKey ? list : null;

    return mapAttentionTab({
      roleVariant: "staff",
      tabKey,
      count: resolveDashboardAttentionCount(summary, tabKey, activeList),
      tasks: activeList?.tasks || [],
      pageIndex: activeList?.pageIndex,
      pageSize: activeList?.pageSize,
    });
  }),
});

const mapManagerAttentionTable = (
  summary?: ContentDashboardAttentionSummaryDto | null,
  urgentList?: ContentDashboardAttentionListDto | null,
  blockedList?: ContentDashboardAttentionListDto | null
): DashboardTableSection => ({
  key: "content-manager-attention",
  titleKey: "adminDashboard.sections.needsManagerAttention",
  tabs: CONTENT_MANAGER_ATTENTION_TABS.map((tabKey) => {
    const activeList = tabKey === "blocked" ? blockedList : urgentList;

    return mapAttentionTab({
      roleVariant: "manager",
      tabKey,
      count: resolveDashboardAttentionCount(summary, tabKey, activeList),
      tasks: activeList?.tasks || [],
      pageIndex: activeList?.pageIndex,
      pageSize: activeList?.pageSize,
    });
  }),
});

const getContentOverviewSections = (roleVariant: DashboardRoleVariant) =>
  isManagerRole(roleVariant)
    ? [
        "todoSection",
        "teamPerformance",
        "departmentTaskDistribution",
        "aiRiskDetection",
        "membersNeedingCoaching",
        "membersOnEmergencyLeave",
        "needsManagerAttentionSummary",
      ].join(",")
    : [
        "todoSection",
        "taskHub",
        "aiRiskDetection",
        "performance",
        "performanceTrend",
        "needsYourAttentionSummary",
      ].join(",");

const getContentDashboardOverview = (
  params: DashboardDataParams,
  roleVariant: DashboardRoleVariant
) =>
  request
    .get<
      DashboardApiResult<ContentDashboardOverviewDto>,
      DashboardApiResult<ContentDashboardOverviewDto>
    >(
      "/api/Content/Dashboard/Overview",
      {
        departmentId: CONTENT_DASHBOARD_DEPARTMENT_ID,
        ...resolveDashboardDateRange(params.timeFilter),
        sections: getContentOverviewSections(roleVariant),
        todoTab: "serviceApplication",
        attentionTab: isManagerRole(roleVariant) ? "urgent" : "all",
        attentionPageIndex: 1,
        attentionPageSize: 10,
      },
      {
        skipErrorMessage: true,
        signal: params.signal,
      }
    )
    .then(unwrapDashboardResponse);

const getContentDashboardTaskList = (params: {
  listType: ContentDashboardTaskListType;
  pageIndex?: number;
  pageSize?: number;
  tab?: string;
  timeFilter?: DashboardTimeFilter;
  signal?: AbortSignal;
}) =>
  request
    .get<
      DashboardApiResult<ContentDashboardTaskListDto>,
      DashboardApiResult<ContentDashboardTaskListDto>
    >(
      "/api/Content/Dashboard/TaskList",
      {
        departmentId: CONTENT_DASHBOARD_DEPARTMENT_ID,
        listType: params.listType,
        tab: params.tab,
        ...resolveDashboardDateRange(params.timeFilter),
        pageIndex: params.pageIndex || 1,
        pageSize: params.pageSize || 20,
      },
      {
        skipErrorMessage: true,
        signal: params.signal,
      }
    )
    .then(unwrapDashboardResponse);

const mapOverviewToDashboardData = (
  overview: ContentDashboardOverviewDto,
  fallbackRoleVariant: DashboardRoleVariant
): DashboardContentWorkloadData => {
  const roleVariant = overview.userRole
    ? mapContentUserRole(overview.userRole)
    : fallbackRoleVariant;
  const apiGaps: DashboardApiGap[] = [];
  const performance = isManagerRole(roleVariant)
    ? overview.teamPerformance
    : overview.performance;

  return {
    type: "workload",
    layout: "content",
    department: "content",
    roleVariant,
    taskTabs: mapTodoTabs(overview.todoSection),
    attentionTable: isManagerRole(roleVariant)
      ? mapManagerAttentionTable(overview.needsManagerAttentionSummary)
      : mapStaffAttentionTable(overview.needsYourAttentionSummary),
    performanceCard: createPerformanceCard({
      apiGaps,
      performance,
      roleVariant,
    }),
    serviceApplicationCard: createServiceApplicationCard({
      apiGaps,
      roleVariant,
      source: isManagerRole(roleVariant)
        ? overview.departmentTaskDistribution?.serviceApplicationCard
        : overview.taskHub?.serviceApplicationCard,
    }),
    aiRiskCard: createAiRiskCard({
      apiGaps,
      riskDetection: overview.aiRiskDetection,
      roleVariant,
    }),
    trendCard: isManagerRole(roleVariant)
      ? undefined
      : createTrendCard({
          apiGaps,
          trend: overview.performanceTrend,
        }),
    coachingCard: isManagerRole(roleVariant)
      ? createCoachingCard({
          apiGaps,
          coaching: overview.membersNeedingCoaching,
        })
      : undefined,
    leaveCard: isManagerRole(roleVariant)
      ? createLeaveCard({
          apiGaps,
          leave: overview.membersOnEmergencyLeave,
        })
      : undefined,
    apiGaps,
  };
};

export const getContentDashboardData = async (
  params: DashboardDataParams
): Promise<DashboardData> => {
  const overviewByInitialRole = await getContentDashboardOverview(
    params,
    params.roleVariant
  );
  const responseRoleVariant = overviewByInitialRole.userRole
    ? mapContentUserRole(overviewByInitialRole.userRole)
    : params.roleVariant;
  const overview =
    responseRoleVariant === params.roleVariant
      ? overviewByInitialRole
      : await getContentDashboardOverview(params, responseRoleVariant);

  const dashboardData = mapOverviewToDashboardData(overview, responseRoleVariant);
  const attentionTab = await getContentDashboardAttentionTab({
    roleVariant: dashboardData.roleVariant,
    tabKey: isManagerRole(dashboardData.roleVariant) ? "urgent" : "all",
    pageIndex: 1,
    pageSize: 10,
    timeFilter: params.timeFilter,
    signal: params.signal,
  });

  return {
    ...dashboardData,
    attentionTable: {
      ...dashboardData.attentionTable,
      tabs: dashboardData.attentionTable.tabs.map((tab) =>
        tab.key === attentionTab.tab.key
          ? {
              ...tab,
              ...attentionTab.tab,
              labelText: attentionTab.tab.labelText || tab.labelText,
            }
          : tab
      ),
    },
  };
};

export const getContentDashboardTaskCards = async ({
  tabKey,
  pageSize = 20,
  timeFilter,
  signal,
}: {
  tabKey: string;
  pageSize?: number;
  timeFilter?: DashboardTimeFilter;
  signal?: AbortSignal;
}): Promise<ContentDashboardTaskCardsResult> => {
  const response = await getContentDashboardTaskList({
    listType: "myTasks",
    pageIndex: 1,
    pageSize,
    tab: tabKey,
    timeFilter,
    signal,
  });

  return {
    tabKey: response.activeTab || tabKey,
    count: optionalNumber(response.totalCount) ?? 0,
    cards: mapTaskCards(response.myTasks || [], `content-${tabKey}-task-list`),
  };
};

export const getContentDashboardAttentionTab = async ({
  roleVariant,
  tabKey,
  pageIndex = 1,
  pageSize = 10,
  timeFilter,
  signal,
}: ContentDashboardTaskListParams): Promise<ContentDashboardAttentionTabResult> => {
  const listType: ContentDashboardTaskListType = isManagerRole(roleVariant)
    ? tabKey === "blocked"
      ? "managerAttentionBlocked"
      : "managerAttentionUrgent"
    : "needsYourAttention";
  const response = await getContentDashboardTaskList({
    listType,
    tab: isManagerRole(roleVariant) ? undefined : tabKey,
    pageIndex,
    pageSize,
    timeFilter,
    signal,
  });
  const tasks =
    listType === "managerAttentionBlocked"
      ? response.blockedTasks
      : response.attentionTasks;

  return {
    tab: mapAttentionTab({
      roleVariant,
      tabKey,
      count: response.totalCount,
      tasks: tasks || [],
      pageIndex: response.pageIndex,
      pageSize: response.pageSize,
    }),
  };
};
