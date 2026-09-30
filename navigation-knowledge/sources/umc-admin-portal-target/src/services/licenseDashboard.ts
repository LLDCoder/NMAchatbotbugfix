import request from "@/utils/request";
import type {
  DashboardCoachingRow,
  DashboardData,
  DashboardDataParams,
  DashboardLeaveRow,
  DashboardLicenseWorkloadData,
  DashboardNavigationTarget,
  DashboardRoleVariant,
  DashboardTableColumn,
  DashboardTableRow,
  DashboardTableSection,
  DashboardTableTab,
  DashboardTaskCard,
  DashboardTaskTab,
  DashboardTone,
  DashboardTimeFilter,
  LicenseApiGap,
  LicenseDisplayValue,
  LicenseDonutStatusCard,
  LicenseMetricTile,
  LicenseStatusGridCard,
  LicenseStatusGridTile,
  LicenseSummaryCard,
  LicenseTrendCard,
  LicenseTrendSeries,
} from "@/pages/Dashboard/type";
import {
  countNumber,
  createDashboardWaitingOnCell,
  createDashboardItemKeyFactory,
  dashboardCell,
  formatDateTime,
  formatMinutes,
  formatPercent,
  getSlaTone,
  normalizeDashboardActionTarget,
  normalizeDashboardEntityIconType,
  normalizeStatusTone,
  optionalNumber,
  optionalString,
  resolveDashboardDateRange,
  resolveDashboardTrendDateRange,
  unwrapDashboardResponse,
  withQuery,
  type DashboardApiResult,
} from "./dashboardApiShared";
import {
  getLicenseDashboardTaskCardActionTarget,
  getLicenseDashboardTaskCardSubtitle,
  getLicenseDashboardTaskCardTitle,
  type LicenseDashboardTaskCardSourceType,
} from "./licenseDashboardTaskCard";
import {
  buildTeamManagementTaskDetailNavigation,
  getTeamManagementTaskCategoryKey,
} from "./teamManagement";

const LICENSE_ROUTE = {
  applications: "/licensing/applications",
  applicationDetail: "/licensing/applications/applicationsDetails",
  profile: "/licensing/profile",
  profileDetail: "/licensing/Profile/ProfileDetails",
  tickets: "/happiness/tickets",
  ticketDetail: "/happiness/tickets/tickets-details",
  refunds:
    "/happiness/refunds",
  refundDetail:
    "/happiness/refunds/refundsDetails",
  appeals:
    "/happiness/appeals",
  appealDetail:
    "/happiness/appeals/appealsDetails",
  teamManagement: "/licensing/team-management",
} as const;

const LICENSE_TASK_CATEGORIES = [
  {
    key: "serviceApplication",
    labelKey: "adminDashboard.tabs.serviceApplication",
    cardKey: "serviceApplicationCard",
    taskCategory: 0,
  },
  {
    key: "profileVerification",
    labelKey: "adminDashboard.tabs.profileVerification",
    cardKey: "profileVerificationCard",
    taskCategory: 1,
  },
  {
    key: "enquiries",
    labelKey: "adminDashboard.tabs.enquiriesComplaints",
    cardKey: "enquiryCard",
    taskCategory: 2,
  },
  {
    key: "refunds",
    labelKey: "adminDashboard.tabs.refunds",
    cardKey: "refundCard",
    taskCategory: 3,
  },
  {
    key: "appeals",
    labelKey: "adminDashboard.tabs.appeals",
    cardKey: "appealCard",
    taskCategory: 4,
  },
] as const;

type LicenseTaskTabKey = (typeof LICENSE_TASK_CATEGORIES)[number]["key"];
const LICENSE_STAFF_ATTENTION_TABS = [
  "all",
  "externalApproval",
  "pendingModification",
] as const;
const LICENSE_MANAGER_ATTENTION_TABS = ["urgent", "blocked"] as const;

type LicenseStaffAttentionTabKey =
  (typeof LICENSE_STAFF_ATTENTION_TABS)[number];
type LicenseManagerAttentionTabKey =
  (typeof LICENSE_MANAGER_ATTENTION_TABS)[number];
type LicenseAttentionTabKey =
  | LicenseStaffAttentionTabKey
  | LicenseManagerAttentionTabKey;

const licenseAttentionQueryTabByKey: Record<LicenseAttentionTabKey, string> = {
  all: "All",
  externalApproval: "ExternalApproval",
  pendingModification: "PendingModification",
  urgent: "Urgent",
  blocked: "Blocked",
};

const licenseAttentionCountKeyByTab: Record<LicenseAttentionTabKey, string> = {
  all: "all",
  externalApproval: "externalApproval",
  pendingModification: "pendingModification",
  urgent: "urgent",
  blocked: "blocked",
};

type LicenseAttentionSourceType =
  | "application"
  | "enquiry"
  | "refund"
  | "appeal";
type LicenseAttentionTaskSource = {
  sourceType: LicenseAttentionSourceType;
  sourceId: string;
};

const licenseAttentionSourceTypeByValue: Record<
  string,
  LicenseAttentionSourceType
> = {
  application: "application",
  serviceapplication: "application",
  enquiry: "enquiry",
  refund: "refund",
  appeal: "appeal",
};

const getAttentionLabelKey = (tabKey: LicenseAttentionTabKey) => {
  if (tabKey === "externalApproval") {
    return "adminDashboard.tabs.externalApproval";
  }

  if (tabKey === "pendingModification") {
    return "adminDashboard.tabs.pendingModification";
  }

  if (tabKey === "urgent") {
    return "adminDashboard.tabs.urgent";
  }

  if (tabKey === "blocked") {
    return "adminDashboard.tabs.blocked";
  }

  return "adminDashboard.tabs.all";
};

const isLicenseStaffAttentionTabKey = (
  tabKey: string
): tabKey is LicenseStaffAttentionTabKey =>
  LICENSE_STAFF_ATTENTION_TABS.includes(tabKey as LicenseStaffAttentionTabKey);

const isLicenseManagerAttentionTabKey = (
  tabKey: string
): tabKey is LicenseManagerAttentionTabKey =>
  LICENSE_MANAGER_ATTENTION_TABS.includes(
    tabKey as LicenseManagerAttentionTabKey
  );

interface LicenseDashboardSlaDto {
  displayText?: string | null;
  statusCode?: number | null;
  remainingMinutes?: number | null;
  deadline?: string | null;
  dueOn?: string | null;
  isOverdue?: boolean | null;
  createdOn?: string | null;
}

interface LicenseDashboardActionDto {
  actionCode?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  openMode?: string | null;
}

interface LicenseDashboardTaskDto {
  taskType?: number | null;
  taskId?: number | string | null;
  applicationId?: number | string | null;
  applicationNumber?: string | null;
  workflowTaskId?: string | null;
  applicationDetailId?: number | string | null;
  referenceNumber?: string | null;
  title?: string | null;
  status?: string | null;
  sla?: LicenseDashboardSlaDto | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  createdOn?: string | null;
  urgencyScore?: number | null;
  flags?: string[] | null;
  overdueHours?: number | null;
  rejectionCount?: number | null;
  applyFor?: string | null;
  applyForIconType?: string | null;
  availableActions?: LicenseDashboardActionDto[] | null;
}

interface LicenseDashboardOverviewCardDto {
  slaComplianceRate?: number | null;
  totalCount?: number | null;
  totalTasks?: number | null;
  doneToday?: number | null;
  overdueTasks?: number | null;
  distribution?: Record<string, number | null> | null;
  statusBreakdown?: Record<string, number | null> | null;
  slaDistribution?: Record<string, number | null> | null;
}

interface LicenseDashboardOverviewDto {
  taskTabCounts?: Record<string, number | null> | null;
  priorityCards?: LicenseDashboardTaskDto[] | null;
  serviceApplicationCard?: LicenseDashboardOverviewCardDto | null;
  profileVerificationCard?: LicenseDashboardOverviewCardDto | null;
  enquiryCard?: LicenseDashboardOverviewCardDto | null;
  refundCard?: LicenseDashboardOverviewCardDto | null;
  appealCard?: LicenseDashboardOverviewCardDto | null;
}

interface LicenseDistributionDto {
  totalCount?: number | null;
  statusDistribution?: Record<string, number | null> | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface LicensePerformanceDto {
  summary?: {
    totalCompletedTasks?: number | null;
    averageHandlingTimeMinutes?: number | null;
    averageProcessingTime?: number | null;
    slaComplianceRate?: number | null;
    rejectionRate?: number | null;
    approvalRateOfApplication?: number | null;
    overdueTasks?: number | null;
  } | null;
  taskTypeBreakdown?: unknown[] | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface LicensePerformanceTrendDto {
  bucketType?: string | null;
  dataPoints?: Array<{
    bucketDate?: string | null;
    label?: string | null;
    taskCounts?: Record<string, number | null> | null;
    totalCount?: number | null;
  }> | null;
  series?: Array<{
    name?: string | null;
    taskType?: string | null;
    values?: number[] | null;
    total?: number | null;
  }> | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface LicenseCoachingDto {
  members?: Array<{
    member?: string | null;
    userId?: string | null;
    userName?: string | null;
    memberId?: string | null;
    memberName?: string | null;
    email?: string | null;
    totalCompletedTasks?: number | null;
    averageHandlingTimeMinutes?: number | null;
    avgProcessingTime?: string | null;
    slaCompliance?: string | null;
    slaComplianceRate?: number | null;
    overdue?: number | null;
    onTimeCount?: number | null;
    lateCount?: number | null;
    overdueTasks?: number | null;
  }> | null;
  departmentAverages?: unknown;
  thresholds?: unknown;
}

interface LicenseLeaveDto {
  members?: Array<{
    userId?: string | null;
    userName?: string | null;
    email?: string | null;
    leaveTypeCode?: string | null;
    leaveTypeNameEn?: string | null;
    leaveTypeNameAr?: string | null;
    briefDescription?: string | null;
    expectedReturnDate?: string | null;
    leaveStartDate?: string | null;
    daysUntilReturn?: number | null;
    todoTaskCount?: number | null;
  }> | null;
  totalCount?: number | null;
}

interface LicenseNeedsAttentionDto {
  tasks?: LicenseNeedsAttentionTaskDto[] | null;
  urgentTasks?: LicenseNeedsAttentionTaskDto[] | null;
  totalCount?: number | null;
  tabCounts?: Record<string, number | null> | null;
  urgentCount?: number | null;
  asOfDate?: string | null;
}

interface LicenseNeedsAttentionTaskDto {
  sourceType?: string | null;
  sourceId?: number | string | null;
  taskNo?: string | null;
  serviceName?: string | null;
  taskCategory?: string | null;
  taskCategoryCode?: string | null;
  taskCategoryDisplay?: string | null;
  applyFor?: string | null;
  applyForIconType?: string | null;
  waitingOn?: string | null;
  waitingOnIconType?: string | null;
  assignedToUserId?: string | null;
  assignedTo?: string | null;
  sla?: LicenseDashboardSlaDto | null;
  status?: string | null;
  statusCode?: string | null;
  statusDisplay?: string | null;
  timeAlert?: string | null;
  waitingMinutes?: number | null;
  isUrgent?: boolean | null;
  canReassign?: boolean | null;
  detailTarget?: string | null;
  lastUpdatedOn?: string | null;
  applicationId?: number | string | null;
  taskId?: number | string | null;
}

export interface LicenseDashboardTaskCardsResult {
  tabKey: string;
  count: number;
  cards: DashboardTaskCard[];
}

export interface LicenseDashboardAttentionTabResult {
  tab: DashboardTableTab;
}

export interface LicenseDashboardTaskListParams {
  roleVariant: DashboardRoleVariant;
  tabKey: string;
  pageIndex?: number;
  pageSize?: number;
  timeFilter?: DashboardTimeFilter;
  signal?: AbortSignal;
}

const isManagerRole = (roleVariant: DashboardRoleVariant) =>
  roleVariant === "manager";

const getScope = (roleVariant: DashboardRoleVariant) =>
  isManagerRole(roleVariant) ? 1 : 0;

const getCategoryConfig = (tabKey: string) =>
  LICENSE_TASK_CATEGORIES.find((item) => item.key === tabKey);

const getCategoryConfigByTaskType = (taskType?: number | null) =>
  LICENSE_TASK_CATEGORIES.find(
    (item) => item.taskCategory === Number(taskType)
  );

const countKeyByCategory: Record<LicenseTaskTabKey, string> = {
  serviceApplication: "ServiceApplication",
  profileVerification: "ProfileVerification",
  enquiries: "Enquiries",
  refunds: "Refunds",
  appeals: "Appeals",
};

const LICENSE_DISTRIBUTION_STATUS_STYLE_BY_LABEL: Record<
  string,
  Pick<LicenseStatusGridTile, "icon" | "tone">
> = {
  active: {
    icon: "certificate",
    tone: "green",
  },
  cancelled: {
    icon: "fileX",
    tone: "neutral",
  },
  canceled: {
    icon: "fileX",
    tone: "neutral",
  },
  completed: {
    icon: "certificate",
    tone: "green",
  },
  draft: {
    icon: "fileX",
    tone: "neutral",
  },
  "pending payment": {
    icon: "warning",
    tone: "orange",
  },
  rejected: {
    icon: "prohibit",
    tone: "red",
  },
  expired: {
    icon: "warning",
    tone: "orange",
  },
  suspended: {
    icon: "prohibit",
    tone: "red",
  },
  "under review": {
    icon: "warning",
    tone: "orange",
  },
};
const LICENSE_DISTRIBUTION_DEFAULT_STATUS_STYLE: Pick<
  LicenseStatusGridTile,
  "icon" | "tone"
> = {
  icon: "fileX",
  tone: "neutral",
};

const LICENSE_PERFORMANCE_EXPECTED_SHAPE =
  "{ slaComplianceRate, averageHandlingTimeMinutes, approvalRateOfApplication, overdueTasks }";
const LICENSE_TASK_HUB_EXPECTED_SHAPE =
  "{ totalCount, totalTasks, doneToday, overdueTasks, slaDistribution/statusBreakdown/distribution } for Service/Profile cards";
const LICENSE_DISTRIBUTION_EXPECTED_SHAPE =
  "{ totalCount, statusDistribution }";
const LICENSE_TREND_EXPECTED_SHAPE =
  "{ dataPoints:[{ label }], series:[{ name, values }] }";
const LICENSE_MANAGER_METRIC_TOOLTIP_BY_KEY = {
  approvalRate:
    "Percentage of Approve decisions among all final decisions made on Service Applications within the selected period.",
  avgProcessingTime:
    "Average time taken to complete all department tasks within the selected period.",
  overdueTasks:
    "Number of open department tasks that exceeded the SLA deadline within the selected period.",
  slaCompliance:
    "Percentage of all completed department tasks that met the SLA within the selected period.",
} as const;
const LICENSE_STAFF_METRIC_TOOLTIP_BY_KEY = {
  approvalRate:
    "Percentage of Approve decisions among all final decisions made at this approval step within the selected period",
  avgProcessingTime:
    "Average time taken to complete tasks within the selected period and across all assigned tasks.",
  overdueTasks:
    "Number of open tasks that exceeded the SLA deadline within the selected period and across all assigned tasks.",
  slaCompliance:
    "Percentage of completed tasks that met the SLA within the selected period and across all assigned tasks.",
} as const;
const LICENSE_PERFORMANCE_TREND_TOOLTIP =
  "Trend of SLA Compliance and Average Processing Time within the selected period and across all assigned tasks.";
const LICENSE_COACHING_TOOLTIP =
  "Team members who may need additional guidance or follow-up based on the performance within the selected period.";
const LICENSE_TREND_SERIES_COLORS = [
  "#FAD44F",
  "#81C1FF",
  "#A0D5AB",
  "#F5AC7C",
  "#FAAAA7",
  "#92722A",
] as const;

const getLicenseTaskSourceType = (
  taskType?: number | null
): LicenseDashboardTaskCardSourceType | undefined => {
  const category = getCategoryConfigByTaskType(taskType)?.key;

  if (category === "profileVerification") {
    return "profile";
  }

  if (category === "enquiries") {
    return "enquiry";
  }

  if (category === "refunds") {
    return "refund";
  }

  if (category === "appeals") {
    return "appeal";
  }

  if (category === "serviceApplication") {
    return "application";
  }

  return undefined;
};

const mapTaskCards = (
  cards: LicenseDashboardTaskDto[] = [],
  prefix: string
): DashboardTaskCard[] => {
  const getItemKey = createDashboardItemKeyFactory(prefix);

  return cards.map((card, index): DashboardTaskCard => {
    const sourceType = getLicenseTaskSourceType(card.taskType);
    const sourceId =
      sourceType === "application"
        ? optionalString(card.applicationId)
        : optionalString(card.taskId);
    const referenceNumber = optionalString(card.referenceNumber);
    const statusText = optionalString(card.status);
    const target = normalizeDashboardActionTarget(
      getLicenseDashboardTaskCardActionTarget(
        sourceType,
        sourceId,
        card.availableActions,
      ),
      "license",
    );

    return {
      key: getItemKey({
        namespace: sourceType,
        identityParts: [sourceId, referenceNumber, card.createdOn],
        index,
      }),
      statusText,
      statusTone: normalizeStatusTone(statusText),
      alertText: optionalString(card.sla?.displayText),
      title: getLicenseDashboardTaskCardTitle(sourceType, {
        title: optionalString(card.title),
        applyFor: optionalString(card.applyFor),
        referenceNumber,
      }),
      subtitle: getLicenseDashboardTaskCardSubtitle(sourceType, {
        title: optionalString(card.title),
        applyFor: optionalString(card.applyFor),
      }),
      subtitleIcon: normalizeDashboardEntityIconType(card.applyForIconType),
      sourceType,
      sourceId,
      lastUpdatedAt: optionalString(card.createdOn),
      ...target,
    };
  });
};

const mapTodoTabs = (
  overview: LicenseDashboardOverviewDto,
  activeTabKey: string,
  activeCards: DashboardTaskCard[]
): DashboardTaskTab[] =>
  LICENSE_TASK_CATEGORIES.map((category) => {
    const categoryKey = category.key;
    const countKey = countKeyByCategory[categoryKey];
    const count = countNumber(overview.taskTabCounts?.[countKey]);

    return {
      key: categoryKey,
      labelKey: category.labelKey,
      count,
      actionPath: getCategoryActionTarget(categoryKey).targetPath,
      actionPermissionPath: getCategoryActionTarget(categoryKey).permissionPath,
      cards: categoryKey === activeTabKey ? activeCards : [],
    };
  });

const getCategoryActionTarget = (categoryKey: LicenseTaskTabKey) => {
  if (categoryKey === "serviceApplication") {
    return {
      targetPath: LICENSE_ROUTE.applications,
      permissionPath: LICENSE_ROUTE.applications,
    };
  }

  if (categoryKey === "profileVerification") {
    return {
      targetPath: LICENSE_ROUTE.profile,
      permissionPath: LICENSE_ROUTE.profile,
    };
  }

  if (categoryKey === "enquiries") {
    return {
      targetPath: LICENSE_ROUTE.tickets,
      permissionPath: LICENSE_ROUTE.tickets,
    };
  }

  if (categoryKey === "refunds") {
    return {
      targetPath: LICENSE_ROUTE.refunds,
      permissionPath: "/happiness/refunds",
    };
  }

  return {
    targetPath: LICENSE_ROUTE.appeals,
    permissionPath: "/happiness/appeals",
  };
};

const stringifyGapValue = (value: unknown) => {
  try {
    const text = JSON.stringify(value);

    if (!text) {
      return "null";
    }

    return text.length > 400 ? `${text.slice(0, 397)}...` : text;
  } catch (error) {
    return String(error || value);
  }
};

const pushGap = (
  apiGaps: LicenseApiGap[],
  {
    actualValue,
    cardTitle,
    endpoint,
    expectedShape,
    roleVariant,
  }: Omit<LicenseApiGap, "actualValue" | "key"> & {
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

const createUnavailableValue = (): LicenseDisplayValue => ({
  text: "-",
  available: false,
});

const createCountDisplayValue = (value?: unknown): LicenseDisplayValue => {
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

const formatLicensePercent = (value?: unknown) => {
  const numericValue = optionalNumber(value);

  if (numericValue === undefined) {
    return undefined;
  }

  return formatPercent(numericValue, numericValue <= 1);
};

const createPercentDisplayValue = (value?: unknown): LicenseDisplayValue => {
  const text = formatLicensePercent(value);

  return text
    ? {
        text,
        available: true,
      }
    : createUnavailableValue();
};

const createMinutesDisplayValue = (value?: unknown): LicenseDisplayValue => {
  const text = formatMinutes(value);

  return text
    ? {
        text,
        available: true,
      }
    : createUnavailableValue();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasNamedNumericKeys = (
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[]
) => keys.every((key) => optionalNumber(source?.[key]) !== undefined);

type LicenseOverviewCardKey =
  | "serviceApplicationCard"
  | "profileVerificationCard"
  | "enquiryCard"
  | "refundCard"
  | "appealCard";

const getOverviewCard = (
  overview: LicenseDashboardOverviewDto,
  key: LicenseOverviewCardKey
) =>
  overview[key] as LicenseDashboardOverviewCardDto | undefined | null;

const getDistributionCount = (
  distribution: Record<string, number | null> | null | undefined,
  key: string
) =>
  optionalNumber(distribution?.[key]) ??
  optionalNumber(
    distribution?.[`${key.charAt(0).toUpperCase()}${key.slice(1)}`]
  );

const hasLegendDistributionCounts = (
  distribution: Record<string, number | null> | null | undefined,
  legends: readonly { key: string }[]
) =>
  isRecord(distribution) &&
  legends.every(
    (item) => getDistributionCount(distribution, item.key) !== undefined
  );

const getDistributionStatusStyle = (label: string) =>
  LICENSE_DISTRIBUTION_STATUS_STYLE_BY_LABEL[label.trim().toLowerCase()] ||
  LICENSE_DISTRIBUTION_DEFAULT_STATUS_STYLE;

const createDistributionStatusTileKey = (label: string, index: number) => {
  const normalizedKey = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalizedKey || "status"}-${index + 1}`;
};

const LICENSE_TASK_HUB_CARD_CONFIGS: Array<{
  cardKey: LicenseOverviewCardKey;
  categoryKey: LicenseTaskTabKey;
  titleText: string;
  totalLabelText: string;
}> = [
  {
    cardKey: "serviceApplicationCard",
    categoryKey: "serviceApplication",
    titleText: "Service Application",
    totalLabelText: "Total",
  },
  {
    cardKey: "profileVerificationCard",
    categoryKey: "profileVerification",
    titleText: "Profile Verification",
    totalLabelText: "Total",
  },
  {
    cardKey: "enquiryCard",
    categoryKey: "enquiries",
    titleText: "Enquiries & Complaints",
    totalLabelText: "Total",
  },
  {
    cardKey: "refundCard",
    categoryKey: "refunds",
    titleText: "Refunds",
    totalLabelText: "Total",
  },
  {
    cardKey: "appealCard",
    categoryKey: "appeals",
    titleText: "Appeals",
    totalLabelText: "Total",
  },
];

const LICENSE_SUMMARY_CARD_CONFIGS = LICENSE_TASK_HUB_CARD_CONFIGS.slice(0, 2);

const LICENSE_SERVICE_APPLICATION_LEGENDS = [
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
] as const;

const LICENSE_PROFILE_VERIFICATION_LEGENDS = [
  {
    color: "#FAD44F",
    key: "pendingReview",
    labelText: "Pending Review",
  },
  {
    color: "#A0D5AB",
    key: "approved",
    labelText: "Approved",
  },
  {
    color: "#FAAAA7",
    key: "rejected",
    labelText: "Rejected",
  },
] as const;

const createTaskHubDonutCard = ({
  actionTarget,
  apiGaps,
  cardKey,
  overview,
  roleVariant,
  titleText,
  totalLabelText,
}: {
  actionTarget: ReturnType<typeof getCategoryActionTarget>;
  apiGaps: LicenseApiGap[];
  cardKey: LicenseOverviewCardKey;
  overview: LicenseDashboardOverviewDto;
  roleVariant: DashboardRoleVariant;
  titleText: string;
  totalLabelText: string;
}): LicenseDonutStatusCard => {
  const sourceCard = getOverviewCard(overview, cardKey);
  const legends =
    cardKey === "profileVerificationCard"
      ? LICENSE_PROFILE_VERIFICATION_LEGENDS
      : LICENSE_SERVICE_APPLICATION_LEGENDS;
  const distributions =
    cardKey === "profileVerificationCard"
      ? [sourceCard?.statusBreakdown, sourceCard?.distribution]
      : [sourceCard?.slaDistribution];
  const distribution = distributions.find((item) =>
    hasLegendDistributionCounts(item, legends)
  );
  const hasTaskHubShape =
    optionalNumber(sourceCard?.totalCount) !== undefined &&
    optionalNumber(sourceCard?.totalTasks) !== undefined &&
    optionalNumber(sourceCard?.doneToday) !== undefined &&
    optionalNumber(sourceCard?.overdueTasks) !== undefined &&
    Boolean(distribution);

  if (!hasTaskHubShape) {
    pushGap(apiGaps, {
      roleVariant,
      cardTitle: titleText,
      endpoint: "/api/license/dashboard/overview",
      expectedShape: LICENSE_TASK_HUB_EXPECTED_SHAPE,
      actualValue: sourceCard
        ? {
            totalCount: sourceCard.totalCount,
            totalTasks: sourceCard.totalTasks,
            doneToday: sourceCard.doneToday,
            overdueTasks: sourceCard.overdueTasks,
            distribution: sourceCard.distribution,
            statusBreakdown: sourceCard.statusBreakdown,
            slaDistribution: sourceCard.slaDistribution,
          }
        : null,
    });
  }

  return {
    key: `license-${cardKey}`,
    variant: "donutStatus",
    titleText,
    targetPath: actionTarget.targetPath,
    permissionPath: actionTarget.permissionPath,
    centerValue: hasTaskHubShape
      ? createCountDisplayValue(sourceCard?.totalCount)
      : createUnavailableValue(),
    centerLabelText:
      cardKey === "profileVerificationCard" ? totalLabelText : "To Do",
    legends: legends.map((item) => ({
      key: item.key,
      labelText: item.labelText,
      color: item.color,
      value: hasTaskHubShape
        ? createCountDisplayValue(getDistributionCount(distribution, item.key))
        : createUnavailableValue(),
    })),
    footerStats: [
      {
        key: "totalTasks",
        labelText: "Total Tasks",
        value: hasTaskHubShape
          ? createCountDisplayValue(sourceCard?.totalTasks)
          : createUnavailableValue(),
        showInfo: true,
        infoTooltipText:
          "Number of tasks in the selected category within the selected period.",
      },
      {
        key: "doneToday",
        labelText: "Done Today",
        tone: "green",
        value: hasTaskHubShape
          ? createCountDisplayValue(sourceCard?.doneToday)
          : createUnavailableValue(),
      },
      {
        key: "overdueTasks",
        labelText: "Overdue Tasks",
        tone: "red",
        value: hasTaskHubShape
          ? createCountDisplayValue(sourceCard?.overdueTasks)
          : createUnavailableValue(),
      },
    ],
    chartSegments: hasTaskHubShape
      ? legends.map((item) => ({
          key: item.key,
          color: item.color,
          value: getDistributionCount(distribution, item.key) ?? 0,
        }))
      : [],
  };
};

const createDistributionStatusCard = ({
  apiGaps,
  distribution,
  roleVariant,
}: {
  apiGaps: LicenseApiGap[];
  distribution?: LicenseDistributionDto | null;
  roleVariant: DashboardRoleVariant;
}): LicenseStatusGridCard => {
  const statusDistribution = isRecord(distribution?.statusDistribution)
    ? distribution?.statusDistribution
    : undefined;
  const statusEntries = Object.entries(statusDistribution || {}).map(
    ([label, value], index) => ({
      key: createDistributionStatusTileKey(label, index),
      labelText: label,
      rawValue: value,
      style: getDistributionStatusStyle(label),
    })
  );
  const hasExpectedDistributionShape =
    optionalNumber(distribution?.totalCount) !== undefined &&
    Boolean(statusDistribution) &&
    statusEntries.every(
      (item) => optionalNumber(item.rawValue) !== undefined
    );

  if (!hasExpectedDistributionShape) {
    pushGap(apiGaps, {
      roleVariant,
      cardTitle: "License Distribution by Status",
      endpoint: "/api/license/dashboard/license-distribution",
      expectedShape: LICENSE_DISTRIBUTION_EXPECTED_SHAPE,
          actualValue: distribution
        ? {
            totalCount: distribution.totalCount,
            statusDistribution: distribution.statusDistribution,
          }
        : null,
    });
  }

  return {
    key: "license-distribution",
    variant: "statusGrid",
    titleText: "License Distribution by Status",
    targetPath: LICENSE_ROUTE.applications,
    permissionPath: LICENSE_ROUTE.applications,
    totalValue: createCountDisplayValue(distribution?.totalCount),
    totalLabelText: "Total",
    tiles: statusEntries.map((item) => ({
      key: item.key,
      labelText: item.labelText,
      tone: item.style.tone,
      icon: item.style.icon,
      value: createCountDisplayValue(item.rawValue),
    })),
  };
};

const createPerformanceTiles = ({
  performance,
  roleVariant,
}: {
  performance?: LicensePerformanceDto | null;
  roleVariant: DashboardRoleVariant;
}): LicenseMetricTile[] => {
  const summary = performance?.summary;
  const metricTooltipByKey =
    roleVariant === "manager"
      ? LICENSE_MANAGER_METRIC_TOOLTIP_BY_KEY
      : LICENSE_STAFF_METRIC_TOOLTIP_BY_KEY;
  const approvalTile: LicenseMetricTile = {
    key: "approvalRate",
    labelText:
      roleVariant === "manager"
        ? "Approval Rate"
        : "Approval Rate of Application",
    value: createPercentDisplayValue(summary?.approvalRateOfApplication),
    icon: "approvalRate",
    showInfo: true,
    infoTooltipText: metricTooltipByKey.approvalRate,
  };
  const overdueTile: LicenseMetricTile = {
    key: "overdueTasks",
    labelText: "Overdue Tasks",
    value: createCountDisplayValue(summary?.overdueTasks),
    icon: "overdueTasks",
    showInfo: true,
    infoTooltipText: metricTooltipByKey.overdueTasks,
  };

  return roleVariant === "manager"
    ? [
        {
          key: "slaCompliance",
          labelText: "SLA Compliance",
          value: createPercentDisplayValue(summary?.slaComplianceRate),
          icon: "slaCompliance",
          showInfo: true,
          infoTooltipText: metricTooltipByKey.slaCompliance,
        },
        {
          key: "avgProcessingTime",
          labelText: "Avg. Processing Time",
          value: createMinutesDisplayValue(summary?.averageHandlingTimeMinutes),
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
          value: createPercentDisplayValue(summary?.slaComplianceRate),
          icon: "slaCompliance",
          showInfo: true,
          infoTooltipText: metricTooltipByKey.slaCompliance,
        },
        {
          key: "avgProcessingTime",
          labelText: "Avg. Processing Time",
          value: createMinutesDisplayValue(summary?.averageHandlingTimeMinutes),
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
  apiGaps: LicenseApiGap[];
  performance?: LicensePerformanceDto | null;
  roleVariant: DashboardRoleVariant;
}) => {
  const summary = performance?.summary;
  const hasExpectedPerformanceShape = hasNamedNumericKeys(
    summary as unknown as Record<string, unknown>,
    [
      "slaComplianceRate",
      "averageHandlingTimeMinutes",
      "approvalRateOfApplication",
      "overdueTasks",
    ]
  );

  if (!hasExpectedPerformanceShape) {
    pushGap(apiGaps, {
      roleVariant,
      cardTitle: roleVariant === "manager" ? "Team Performance" : "My Performance",
      endpoint: "/api/license/dashboard/performance",
      expectedShape: LICENSE_PERFORMANCE_EXPECTED_SHAPE,
      actualValue: summary,
    });
  }

  return {
    key: "license-performance",
    titleText: roleVariant === "manager" ? "Team Performance" : "My Performance",
    tiles: createPerformanceTiles({
      performance,
      roleVariant,
    }),
  };
};

const createTrendCard = ({
  apiGaps,
  roleVariant,
  trend,
}: {
  apiGaps: LicenseApiGap[];
  roleVariant: DashboardRoleVariant;
  trend?: LicensePerformanceTrendDto | null;
}): LicenseTrendCard => {
  const points = trend?.dataPoints || [];
  const categories = points
    .map((point) => optionalString(point.label))
    .filter((label): label is string => Boolean(label));
  const apiSeries = trend?.series || [];
  const normalizedSeries = apiSeries
    .map((item, index): LicenseTrendSeries | null => {
      const labelText = optionalString(item.name);
      const taskType = optionalString(item.taskType);
      const values = Array.isArray(item.values)
        ? item.values
            .map((value) => optionalNumber(value))
            .filter((value): value is number => value !== undefined)
        : [];

      if (
        !labelText ||
        !taskType ||
        !Array.isArray(item.values) ||
        values.length !== item.values.length ||
        values.length !== categories.length
      ) {
        return null;
      }

      return {
        key: `task-${taskType}`,
        labelText,
        color: LICENSE_TREND_SERIES_COLORS[
          index % LICENSE_TREND_SERIES_COLORS.length
        ],
        axis: "left",
        unit: "count",
        values,
        available: categories.length > 0 && values.length === categories.length,
      };
    })
    .filter((item): item is LicenseTrendSeries => Boolean(item));
  const hasSeriesTrendShape =
    Array.isArray(trend?.dataPoints) &&
    Array.isArray(trend?.series) &&
    categories.length === points.length &&
    normalizedSeries.length === apiSeries.length;

  if (!hasSeriesTrendShape) {
    pushGap(apiGaps, {
      roleVariant,
      cardTitle: "Performance Trend",
      endpoint: "/api/license/dashboard/performance-trend",
      expectedShape: LICENSE_TREND_EXPECTED_SHAPE,
      actualValue: trend
        ? {
            dataPoints: trend.dataPoints?.slice(0, 6),
            series: trend.series?.slice(0, 6),
          }
        : null,
    });
  }

  return {
    key: "license-performance-trend",
    titleText: "Performance Trend",
    categories: hasSeriesTrendShape ? categories : [],
    series: hasSeriesTrendShape ? normalizedSeries : [],
    showInfo: true,
    infoTooltipText: LICENSE_PERFORMANCE_TREND_TOOLTIP,
  };
};

const createManagerSummaryCards = ({
  apiGaps,
  distribution,
  overview,
  roleVariant,
}: {
  apiGaps: LicenseApiGap[];
  distribution?: LicenseDistributionDto | null;
  overview: LicenseDashboardOverviewDto;
  roleVariant: DashboardRoleVariant;
}): LicenseSummaryCard[] => [
  ...LICENSE_SUMMARY_CARD_CONFIGS.map((config) =>
    createTaskHubDonutCard({
      actionTarget:
        roleVariant === "manager" && config.categoryKey === "serviceApplication"
          ? {
              targetPath: LICENSE_ROUTE.teamManagement,
              permissionPath: LICENSE_ROUTE.teamManagement,
            }
          : getCategoryActionTarget(config.categoryKey),
      apiGaps,
      cardKey: config.cardKey,
      overview,
      roleVariant,
      titleText: config.titleText,
      totalLabelText: config.totalLabelText,
    })
  ),
  createDistributionStatusCard({
    apiGaps,
    distribution,
    roleVariant,
  }),
];

const createStaffSummaryCards = createManagerSummaryCards;

const getStaffAttentionColumns = (): DashboardTableColumn[] => [
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
    width: 300,
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

const getManagerBlockedAttentionColumns = (): DashboardTableColumn[] => [
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

const getManagerUrgentAttentionColumns = (): DashboardTableColumn[] => [
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

const getAttentionColumns = (
  roleVariant: DashboardRoleVariant,
  tabKey: LicenseAttentionTabKey
): DashboardTableColumn[] => {
  if (isManagerRole(roleVariant) && tabKey === "urgent") {
    return getManagerUrgentAttentionColumns();
  }

  if (isManagerRole(roleVariant) && tabKey === "blocked") {
    return getManagerBlockedAttentionColumns();
  }

  return getStaffAttentionColumns();
};

const getLicenseTimeAlertTone = (
  task: LicenseNeedsAttentionTaskDto
): DashboardTone => {
  const waitingMinutes = optionalNumber(task.waitingMinutes);

  if (waitingMinutes === undefined) {
    return "default";
  }

  if (waitingMinutes >= 24 * 60) {
    return "red";
  }

  if (waitingMinutes >= 60) {
    return "orange";
  }

  return "default";
};

const getLicenseSlaTone = (
  sla?: LicenseDashboardSlaDto | null
): DashboardTone => {
  const remainingMinutes = optionalNumber(sla?.remainingMinutes);

  if (
    sla?.isOverdue ||
    optionalNumber(sla?.statusCode) === 1 ||
    (remainingMinutes !== undefined && remainingMinutes < 0)
  ) {
    return "red";
  }

  return getSlaTone(undefined, sla?.displayText);
};

const getLicenseAttentionSourceType = (
  value?: unknown
): LicenseAttentionSourceType | undefined => {
  const normalizedValue = optionalString(value)
    ?.replace(/[\s_-]+/g, "")
    .toLowerCase();

  return normalizedValue
    ? licenseAttentionSourceTypeByValue[normalizedValue]
    : undefined;
};

const getLicenseUrgentTaskSource = (
  task: LicenseNeedsAttentionTaskDto
): LicenseAttentionTaskSource | undefined => {
  const sourceType = getLicenseAttentionSourceType(task.sourceType);

  if (!sourceType) {
    return undefined;
  }

  const sourceId = optionalString(task.sourceId);

  return sourceId ? { sourceType, sourceId } : undefined;
};

const getLicenseApplicationTaskSource = (
  task: LicenseNeedsAttentionTaskDto
): LicenseAttentionTaskSource | undefined => {
  const sourceId = optionalString(task.applicationId);

  return sourceId
    ? {
        sourceType: "application",
        sourceId,
      }
    : undefined;
};

const getLicenseAttentionApplicationTarget = (
  task: LicenseNeedsAttentionTaskDto
): DashboardNavigationTarget => {
  const taskId = optionalString(task.taskId);

  if (!taskId || taskId === "0") {
    return {};
  }

  return {
    targetPath: withQuery(LICENSE_ROUTE.applicationDetail, {
      taskId,
    }),
    permissionPath: LICENSE_ROUTE.applicationDetail,
  };
};

const getLicenseAttentionRowTarget = (
  task: LicenseNeedsAttentionTaskDto,
  roleVariant: DashboardRoleVariant,
  tabKey: LicenseAttentionTabKey
): DashboardNavigationTarget => {
  if (isManagerRole(roleVariant) && tabKey === "urgent") {
    const taskCategory =
      getTeamManagementTaskCategoryKey(task.taskCategoryCode) ||
      getTeamManagementTaskCategoryKey(task.taskCategoryDisplay) ||
      getTeamManagementTaskCategoryKey(task.taskCategory);

    if (!taskCategory) {
      return {};
    }

    const detailNavigation = buildTeamManagementTaskDetailNavigation({
      scope: "licensing",
      taskCategory,
      sourceType: optionalString(task.sourceType),
      sourceId: optionalString(task.sourceId),
      taskNo: optionalString(task.taskNo),
      canReassign: task.canReassign === true,
      detailTarget: task.detailTarget,
    });
    const detailPath =
      detailNavigation.detailTarget || detailNavigation.detailRoutePath;

    if (!detailPath) {
      return {};
    }

    const detailRouteQuery: Record<
      string,
      string | number | boolean | undefined
    > = {};
    Object.entries(detailNavigation.detailRouteQuery || {}).forEach(
      ([key, value]) => {
        detailRouteQuery[key] = value == null ? undefined : value;
      }
    );

    return {
      targetPath: withQuery(detailPath, detailRouteQuery),
      permissionPath: LICENSE_ROUTE.teamManagement,
    };
  }

  if (tabKey !== "urgent") {
    return getLicenseAttentionApplicationTarget(task);
  }

  const detailTarget = normalizeDashboardActionTarget(
    task.detailTarget,
    "license"
  );

  return detailTarget.targetPath ? detailTarget : {};
};

const mapNeedsAttentionRow = (
  task: LicenseNeedsAttentionTaskDto,
  index: number,
  roleVariant: DashboardRoleVariant,
  tabKey: LicenseAttentionTabKey,
  getItemKey: ReturnType<typeof createDashboardItemKeyFactory>
): DashboardTableRow => {
  const taskNo = optionalString(task.taskNo);
  const statusText =
    tabKey === "urgent"
      ? optionalString(task.statusDisplay)
      : optionalString(task.status);
  const timeAlertText = optionalString(task.timeAlert);
  const categoryText =
    tabKey === "urgent" ? optionalString(task.taskCategoryDisplay) : undefined;
  const source =
    tabKey === "urgent"
      ? getLicenseUrgentTaskSource(task)
      : getLicenseApplicationTaskSource(task);
  const rowTarget = getLicenseAttentionRowTarget(task, roleVariant, tabKey);
  const row: DashboardTableRow = {
    key: getItemKey({
      namespace: source?.sourceType,
      identityParts: [
        taskNo,
        task.sourceId,
        task.applicationId,
        task.taskId,
        task.detailTarget,
        task.lastUpdatedOn,
        task.timeAlert,
        statusText,
        task.serviceName,
        task.taskCategory,
      ],
      index,
    }),
    sourceType: source?.sourceType,
    sourceId: source?.sourceId,
    ...rowTarget,
    taskNo: dashboardCell(taskNo, {
      urgent: isManagerRole(roleVariant) && tabKey === "urgent" && Boolean(task.isUrgent),
    }),
    serviceName: dashboardCell(optionalString(task.serviceName)),
    category: dashboardCell(categoryText),
    applyFor: dashboardCell(optionalString(task.applyFor), {
      icon: normalizeDashboardEntityIconType(task.applyForIconType),
    }),
    waitingOn: createDashboardWaitingOnCell(
      task.waitingOn,
      task.waitingOnIconType
    ),
    assignedTo: dashboardCell(optionalString(task.assignedTo)),
    sla: dashboardCell(optionalString(task.sla?.displayText), {
      tone: getLicenseSlaTone(task.sla),
    }),
    status: dashboardCell(statusText, {
      tone: normalizeStatusTone(statusText),
    }),
    timeAlert: dashboardCell(timeAlertText, {
      tone: getLicenseTimeAlertTone(task),
    }),
  };

  if (
    isManagerRole(roleVariant) &&
    tabKey === "urgent" &&
    source &&
    task.canReassign === true
  ) {
    row.reassignTask = {
      sourceType: source.sourceType,
      sourceId: source.sourceId,
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
  }

  return row;
};

const mapNeedsAttentionRows = (
  tasks: LicenseNeedsAttentionTaskDto[] | undefined,
  prefix: string,
  roleVariant: DashboardRoleVariant,
  tabKey: LicenseAttentionTabKey
): DashboardTableRow[] => {
  const getItemKey = createDashboardItemKeyFactory(prefix);

  return (tasks || []).map((task, index) =>
    mapNeedsAttentionRow(task, index, roleVariant, tabKey, getItemKey)
  );
};

const resolveLicenseAttentionCount = ({
  countSource,
  responseTabKey,
  tabKey,
}: {
  countSource?: LicenseNeedsAttentionDto | null;
  responseTabKey?: LicenseAttentionTabKey;
  tabKey: LicenseAttentionTabKey;
}) => {
  const countKey = licenseAttentionCountKeyByTab[tabKey];
  const tabCount = optionalNumber(countSource?.tabCounts?.[countKey]);

  if (tabCount !== undefined) {
    return tabCount;
  }

  if (tabKey === "urgent") {
    const urgentCount = optionalNumber(countSource?.urgentCount);

    if (urgentCount !== undefined) {
      return urgentCount;
    }
  }

  if (responseTabKey === tabKey) {
    return countNumber(countSource?.totalCount);
  }

  return 0;
};

const mapNeedsAttentionTab = ({
  countSource,
  listSource,
  pageIndex = 1,
  pageSize = 10,
  responseTabKey,
  roleVariant,
  tabKey,
}: {
  countSource?: LicenseNeedsAttentionDto | null;
  listSource?: LicenseNeedsAttentionDto | null;
  pageIndex?: number;
  pageSize?: number;
  responseTabKey?: LicenseAttentionTabKey;
  roleVariant: DashboardRoleVariant;
  tabKey: LicenseAttentionTabKey;
}): DashboardTableTab => {
  const count = resolveLicenseAttentionCount({
    countSource,
    responseTabKey,
    tabKey,
  });
  const sourceTasks =
    tabKey === "urgent"
      ? Array.isArray(listSource?.urgentTasks)
        ? listSource?.urgentTasks
        : undefined
      : Array.isArray(listSource?.tasks)
      ? listSource?.tasks
      : undefined;
  const rows = mapNeedsAttentionRows(
    sourceTasks,
    `license-${tabKey}-attention`,
    roleVariant,
    tabKey
  );

  return {
    key: tabKey,
    labelKey: getAttentionLabelKey(tabKey),
    count,
    columns: getAttentionColumns(roleVariant, tabKey),
    rows,
    selectable:
      isManagerRole(roleVariant) &&
      tabKey === "urgent" &&
      rows.some((row) => Boolean(row.reassignTask)),
    pageIndex,
    pageSize,
    totalCount: count,
  };
};

const mapStaffAttentionTable = (
  needsAttention?: LicenseNeedsAttentionDto | null,
  activeTabKey: LicenseStaffAttentionTabKey = "all",
  pageIndex = 1,
  pageSize = 10
): DashboardTableSection => ({
  key: "license-staff-attention",
  titleKey: "adminDashboard.sections.needsYourAttention",
  tabs: LICENSE_STAFF_ATTENTION_TABS.map((tabKey) =>
    mapNeedsAttentionTab({
      countSource: needsAttention,
      listSource: tabKey === activeTabKey ? needsAttention : undefined,
      pageIndex: tabKey === activeTabKey ? pageIndex : 1,
      pageSize,
      responseTabKey: activeTabKey,
      roleVariant: "staff",
      tabKey,
    })
  ),
});

const mapManagerAttentionTable = (
  urgentAttention?: LicenseNeedsAttentionDto | null,
  blockedAttention?: LicenseNeedsAttentionDto | null,
  pageSize = 10
): DashboardTableSection => {
  return {
    key: "license-manager-attention",
    titleKey: "adminDashboard.sections.needsManagerAttention",
    tabs: LICENSE_MANAGER_ATTENTION_TABS.map((tabKey) => {
      const source = tabKey === "blocked" ? blockedAttention : urgentAttention;

      return mapNeedsAttentionTab({
        countSource: source,
        listSource: source,
        pageIndex: 1,
        pageSize,
        responseTabKey: tabKey,
        roleVariant: "manager",
        tabKey,
      });
    }),
  };
};

const mapCoachingRows = (
  coaching?: LicenseCoachingDto | null
): DashboardCoachingRow[] => {
  const getItemKey = createDashboardItemKeyFactory("license-coaching");

  return (coaching?.members || []).map((item, index) => ({
    key: getItemKey({
      namespace: "member",
      identityParts: [
        item.memberId,
        item.userId,
        item.member,
        item.memberName,
        item.userName,
        item.email,
      ],
      index,
    }),
    member:
      optionalString(item.member) ||
      optionalString(item.memberName) ||
      optionalString(item.userName),
    overdue:
      optionalNumber(item.overdue ?? item.overdueTasks ?? item.lateCount) ??
      Number.NaN,
    slaCompliance:
      optionalString(item.slaCompliance) ||
      formatLicensePercent(item.slaComplianceRate),
    avgProcessingTime:
      optionalString(item.avgProcessingTime) ||
      formatMinutes(item.averageHandlingTimeMinutes),
  }));
};

const mapLeaveRows = (leave?: LicenseLeaveDto | null): DashboardLeaveRow[] => {
  const getItemKey = createDashboardItemKeyFactory("license-leave");

  return (leave?.members || []).map((item, index) => ({
    key: getItemKey({
      namespace: "member",
      identityParts: [item.userId, item.userName, item.expectedReturnDate],
      index,
    }),
    name: optionalString(item.userName),
    reasonKey: "adminDashboard.leave.medicalEmergency",
    reason: optionalString(item.briefDescription),
    returnAt: formatDateTime(item.expectedReturnDate),
    todoCount: optionalNumber(item.todoTaskCount) ?? Number.NaN,
  }));
};

const createCoachingCard = (
  rows: DashboardCoachingRow[]
): DashboardLicenseWorkloadData["coachingCard"] => ({
  key: "license-coaching",
  titleText: "Members Needing Coaching",
  targetPath: LICENSE_ROUTE.teamManagement,
  permissionPath: LICENSE_ROUTE.teamManagement,
  rows,
  showInfo: true,
  infoTooltipText: LICENSE_COACHING_TOOLTIP,
});

const createLeaveCard = ({
  rows,
  totalCount,
}: {
  rows: DashboardLeaveRow[];
  totalCount?: number;
}): DashboardLicenseWorkloadData["leaveCard"] => ({
  key: "license-leave",
  titleText: "Members on Emergency Leave",
  targetPath: LICENSE_ROUTE.teamManagement,
  permissionPath: LICENSE_ROUTE.teamManagement,
  rows,
  totalCount,
});

const isAbortError = (error: unknown) => {
  const abortError = error as { code?: string; name?: string };

  return (
    abortError?.code === "ERR_CANCELED" ||
    abortError?.name === "CanceledError" ||
    abortError?.name === "AbortError"
  );
};

const optionalLicenseDashboardRequest = <T,>(
  requestPromise: Promise<T>
): Promise<T | null> =>
  requestPromise.catch((error) => {
    if (isAbortError(error)) {
      throw error;
    }

    return null;
  });

const getLicenseOverview = (params: {
  taskCategory: number;
  scope: number;
  priorityCardCount?: number;
  timeFilter?: DashboardTimeFilter;
  signal?: AbortSignal;
}): Promise<LicenseDashboardOverviewDto | null> =>
  optionalLicenseDashboardRequest(
    request
      .get<
        DashboardApiResult<LicenseDashboardOverviewDto>,
        DashboardApiResult<LicenseDashboardOverviewDto>
      >(
        "/api/license/dashboard/overview",
        {
          taskCategory: params.taskCategory,
          scope: params.scope,
          priorityCardCount: params.priorityCardCount || 10,
          ...resolveDashboardDateRange(params.timeFilter),
        },
        {
          skipErrorMessage: true,
          signal: params.signal,
        }
      )
      .then(unwrapDashboardResponse)
  );

const getLicenseDistribution = (
  timeFilter?: DashboardTimeFilter,
  signal?: AbortSignal
) =>
  optionalLicenseDashboardRequest(
    request
      .get<
        DashboardApiResult<LicenseDistributionDto>,
        DashboardApiResult<LicenseDistributionDto>
      >(
        "/api/license/dashboard/license-distribution",
        resolveDashboardDateRange(timeFilter),
        {
          skipErrorMessage: true,
          signal,
        }
      )
      .then(unwrapDashboardResponse)
  );

const getLicensePerformance = (
  scope: number,
  timeFilter?: DashboardTimeFilter,
  signal?: AbortSignal
): Promise<LicensePerformanceDto | null> =>
  optionalLicenseDashboardRequest(
    request
      .get<
        DashboardApiResult<LicensePerformanceDto>,
        DashboardApiResult<LicensePerformanceDto>
      >(
        "/api/license/dashboard/performance",
        {
          scope,
          ...resolveDashboardDateRange(timeFilter),
        },
        {
          skipErrorMessage: true,
          signal,
        }
      )
      .then(unwrapDashboardResponse)
  );

const getLicensePerformanceTrend = (
  scope: number,
  timeFilter?: DashboardTimeFilter,
  signal?: AbortSignal
) =>
  optionalLicenseDashboardRequest(
    request
      .get<
        DashboardApiResult<LicensePerformanceTrendDto>,
        DashboardApiResult<LicensePerformanceTrendDto>
      >(
        "/api/license/dashboard/performance-trend",
        {
          scope,
          ...resolveDashboardTrendDateRange(timeFilter),
        },
        {
          skipErrorMessage: true,
          signal,
        }
      )
      .then(unwrapDashboardResponse)
  );

const getLicenseCoaching = (
  timeFilter?: DashboardTimeFilter,
  signal?: AbortSignal
) =>
  optionalLicenseDashboardRequest(
    request
      .get<
        DashboardApiResult<LicenseCoachingDto>,
        DashboardApiResult<LicenseCoachingDto>
      >(
        "/api/license/dashboard/members-needing-coaching",
        {
          ...resolveDashboardDateRange(timeFilter),
          slaComplianceThreshold: 0.7,
          avgHandlingTimeMultiplier: 1.5,
        },
        {
          skipErrorMessage: true,
          signal,
        }
      )
      .then(unwrapDashboardResponse)
  );

const getLicenseLeave = (
  timeFilter?: DashboardTimeFilter,
  signal?: AbortSignal
) =>
  optionalLicenseDashboardRequest(
    request
      .get<
        DashboardApiResult<LicenseLeaveDto>,
        DashboardApiResult<LicenseLeaveDto>
      >(
        "/api/license/dashboard/members-on-leave",
        resolveDashboardDateRange(timeFilter),
        {
          skipErrorMessage: true,
          signal,
        }
      )
      .then(unwrapDashboardResponse)
  );

const getLicenseNeedsAttention = ({
  pageIndex = 1,
  pageSize = 10,
  roleVariant,
  tabKey,
  timeFilter,
  signal,
}: {
  pageIndex?: number;
  pageSize?: number;
  roleVariant: DashboardRoleVariant;
  tabKey: LicenseAttentionTabKey;
  timeFilter?: DashboardTimeFilter;
  signal?: AbortSignal;
}) =>
  optionalLicenseDashboardRequest(
    request
      .get<
        DashboardApiResult<LicenseNeedsAttentionDto>,
        DashboardApiResult<LicenseNeedsAttentionDto>
      >(
        "/api/license/dashboard/needs-attention",
        {
          scope: isManagerRole(roleVariant) ? "Department" : "Personal",
          tab: licenseAttentionQueryTabByKey[tabKey],
          ...resolveDashboardDateRange(timeFilter),
          pageIndex,
          pageSize,
        },
        {
          skipErrorMessage: true,
          signal,
        }
      )
      .then(unwrapDashboardResponse)
  );

export const getLicenseDashboardData = async (
  params: DashboardDataParams
): Promise<DashboardData> => {
  const scope = getScope(params.roleVariant);
  const defaultCategory = LICENSE_TASK_CATEGORIES[0];
  const apiGaps: LicenseApiGap[] = [];
  const [
    overviewResponse,
    performance,
    performanceTrend,
    distribution,
    coaching,
    leave,
    staffNeedsAttention,
    urgentNeedsAttention,
    blockedNeedsAttention,
  ] = await Promise.all([
    getLicenseOverview({
      taskCategory: defaultCategory.taskCategory,
      scope,
      priorityCardCount: 10,
      timeFilter: params.timeFilter,
      signal: params.signal,
    }),
    getLicensePerformance(scope, params.timeFilter, params.signal),
    getLicensePerformanceTrend(scope, params.timeFilter, params.signal),
    getLicenseDistribution(params.timeFilter, params.signal),
    isManagerRole(params.roleVariant)
      ? getLicenseCoaching(params.timeFilter, params.signal)
      : Promise.resolve<LicenseCoachingDto | null>(null),
    isManagerRole(params.roleVariant)
      ? getLicenseLeave(params.timeFilter, params.signal)
      : Promise.resolve<LicenseLeaveDto | null>(null),
    isManagerRole(params.roleVariant)
      ? Promise.resolve<LicenseNeedsAttentionDto | null>(null)
      : getLicenseNeedsAttention({
          roleVariant: params.roleVariant,
          tabKey: "all",
          pageIndex: 1,
          pageSize: 10,
          timeFilter: params.timeFilter,
          signal: params.signal,
        }),
    isManagerRole(params.roleVariant)
      ? getLicenseNeedsAttention({
          roleVariant: params.roleVariant,
          tabKey: "urgent",
          pageIndex: 1,
          pageSize: 10,
          timeFilter: params.timeFilter,
          signal: params.signal,
        })
      : Promise.resolve<LicenseNeedsAttentionDto | null>(null),
    isManagerRole(params.roleVariant)
      ? getLicenseNeedsAttention({
          roleVariant: params.roleVariant,
          tabKey: "blocked",
          pageIndex: 1,
          pageSize: 10,
          timeFilter: params.timeFilter,
          signal: params.signal,
        })
      : Promise.resolve<LicenseNeedsAttentionDto | null>(null),
  ]);
  const overview = overviewResponse || {};
  const taskCards = mapTaskCards(
    overview.priorityCards || [],
    `license-${defaultCategory.key}`
  );
  const coachingRows = isManagerRole(params.roleVariant)
    ? mapCoachingRows(coaching)
    : [];
  const leaveRows = isManagerRole(params.roleVariant) ? mapLeaveRows(leave) : [];
  const dashboardData: DashboardLicenseWorkloadData = {
    type: "workload",
    layout: "license",
    department: "license",
    roleVariant: params.roleVariant,
    taskTabs: mapTodoTabs(overview, defaultCategory.key, taskCards),
    performanceCard: createPerformanceCard({
      apiGaps,
      performance,
      roleVariant: params.roleVariant,
    }),
    summaryCards: isManagerRole(params.roleVariant)
      ? createManagerSummaryCards({
          apiGaps,
          distribution,
          overview,
          roleVariant: params.roleVariant,
        })
      : createStaffSummaryCards({
          apiGaps,
          distribution,
          overview,
          roleVariant: params.roleVariant,
        }),
    trendCard: isManagerRole(params.roleVariant)
      ? undefined
      : createTrendCard({
          apiGaps,
          roleVariant: params.roleVariant,
          trend: performanceTrend,
        }),
    coachingCard: isManagerRole(params.roleVariant)
      ? createCoachingCard(coachingRows)
      : undefined,
    leaveCard: isManagerRole(params.roleVariant)
      ? createLeaveCard({
          rows: leaveRows,
          totalCount: countNumber(leave?.totalCount),
        })
      : undefined,
    attentionTable: isManagerRole(params.roleVariant)
      ? mapManagerAttentionTable(urgentNeedsAttention, blockedNeedsAttention)
      : mapStaffAttentionTable(staffNeedsAttention),
    apiGaps,
  };

  return dashboardData;
};

export const getLicenseDashboardTaskCards = async ({
  roleVariant,
  tabKey,
  pageSize = 10,
  timeFilter,
  signal,
}: {
  roleVariant: DashboardRoleVariant;
  tabKey: string;
  pageSize?: number;
  timeFilter?: DashboardTimeFilter;
  signal?: AbortSignal;
}): Promise<LicenseDashboardTaskCardsResult> => {
  const category = getCategoryConfig(tabKey);

  if (!category) {
    throw new Error(`Unsupported license dashboard tab: ${tabKey}`);
  }

  const response =
    (await getLicenseOverview({
      taskCategory: category.taskCategory,
      scope: getScope(roleVariant),
      priorityCardCount: pageSize,
      timeFilter,
      signal,
    })) || {};

  return {
    tabKey: category.key,
    count: countNumber(response.taskTabCounts?.[countKeyByCategory[category.key]]),
    cards: mapTaskCards(response.priorityCards || [], `license-${category.key}`),
  };
};

export const getLicenseDashboardAttentionTab = async ({
  roleVariant,
  tabKey,
  pageIndex = 1,
  pageSize = 10,
  timeFilter,
  signal,
}: LicenseDashboardTaskListParams): Promise<LicenseDashboardAttentionTabResult> => {
  if (isManagerRole(roleVariant)) {
    if (!isLicenseManagerAttentionTabKey(tabKey)) {
      throw new Error(`Unsupported license dashboard attention tab: ${tabKey}`);
    }

    const response = await getLicenseNeedsAttention({
      roleVariant,
      tabKey,
      pageIndex,
      pageSize,
      timeFilter,
      signal,
    });

    return {
      tab: mapNeedsAttentionTab({
        countSource: response,
        listSource: response,
        pageIndex,
        pageSize,
        responseTabKey: tabKey,
        roleVariant,
        tabKey,
      }),
    };
  }

  if (!isLicenseStaffAttentionTabKey(tabKey)) {
    throw new Error(`Unsupported license dashboard attention tab: ${tabKey}`);
  }

  const response = await getLicenseNeedsAttention({
    roleVariant,
    tabKey,
    pageIndex,
    pageSize,
    timeFilter,
    signal,
  });

  return {
    tab: mapNeedsAttentionTab({
      countSource: response,
      listSource: response,
      pageIndex,
      pageSize,
      responseTabKey: tabKey,
      roleVariant,
      tabKey,
    }),
  };
};
