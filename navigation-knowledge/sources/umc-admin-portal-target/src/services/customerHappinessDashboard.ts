import moment from "moment";
import request from "@/utils/request";
import type { ApiResponse } from "./userManagement";
import {
  getTeamManagementMembers,
  reassignTeamManagementTasks,
} from "./teamManagement";
import type {
  DashboardData,
  DashboardDataParams,
  DashboardDonutCard,
  DashboardMetricCard,
  DashboardNavigationTarget,
  DashboardAvailableAction,
  DashboardReassignTask,
  DashboardRoleVariant,
  DashboardTableCell,
  DashboardTableColumn,
  DashboardTableRow,
  DashboardTableTab,
  DashboardTaskCard,
  DashboardTaskSourceType,
  DashboardTaskTab,
  DashboardTimeFilter,
  DashboardTrendChart,
  DashboardTone,
} from "@/pages/Dashboard/type";
import {
  createDashboardWaitingOnCell,
  createDashboardItemKeyFactory,
  normalizeDashboardEntityIconType,
  optionalString,
  resolveDashboardAttentionCount,
} from "./dashboardApiShared";
import { getDashboardTaskCardTitleFromTaskNo } from "./dashboardTaskCardTitle";

export const CUSTOMER_HAPPINESS_DASHBOARD_DEPARTMENT_ID = 8;

const CUSTOMER_ROUTE = {
  tickets: "/happiness/tickets",
  ticketDetail: "/happiness/tickets/tickets-details",
  refunds: "/happiness/refunds",
  refundDetail: "/happiness/refunds/refundsDetails",
  appeals: "/happiness/appeals",
  appealDetail: "/happiness/appeals/appealsDetails",
  teamManagement: "/happiness/team-management",
  teamManagementRefundDetail: "/happiness/team-management/refundsDetails",
  teamManagementAppealDetail: "/happiness/team-management/appealsDetails",
} as const;

const CUSTOMER_TAB_ORDER = ["enquiries", "appeals", "refunds"] as const;
const CUSTOMER_STAFF_ATTENTION_TABS = [
  "all",
  "pendingCustomer",
  "departmentProcessing",
] as const;
const CUSTOMER_MANAGER_ATTENTION_TABS = ["urgent", "blocked"] as const;

type CustomerDashboardApiResult<T> = T | ApiResponse<T>;
type CustomerDashboardCategoryKey =
  | (typeof CUSTOMER_TAB_ORDER)[number]
  | (string & {});
export type CustomerDashboardAttentionTabKey =
  | (typeof CUSTOMER_STAFF_ATTENTION_TABS)[number]
  | (typeof CUSTOMER_MANAGER_ATTENTION_TABS)[number];
export type CustomerDashboardTaskListType =
  | "myTasks"
  | "needsYourAttention"
  | "managerAttentionUrgent"
  | "managerAttentionBlocked";

interface CustomerDashboardSlaDto {
  displayText?: string | null;
  color?: string | null;
  sortWeight?: number | null;
  remainingMinutes?: number | null;
}

interface CustomerDashboardActionDto {
  actionCode?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  openMode?: string | null;
}

interface CustomerDashboardRelatedEntityDto {
  name?: string | null;
  type?: string | null;
  iconUrl?: string | null;
}

interface CustomerDashboardTaskCardDto {
  sourceType?: string | null;
  sourceId?: string | null;
  taskNo?: string | null;
  statusBadge?: string | null;
  sla?: CustomerDashboardSlaDto | null;
  taskTitle?: string | null;
  relatedEntity?: CustomerDashboardRelatedEntityDto | null;
  sortTime?: string | null;
  availableActions?: CustomerDashboardActionDto[] | null;
}

interface CustomerDashboardTodoTabDto {
  tabKey?: string | null;
  tabTitle?: string | null;
  todoCount?: number | null;
  cards?: CustomerDashboardTaskCardDto[] | null;
}

interface CustomerDashboardTodoSectionDto {
  activeTab?: string | null;
  tabs?: CustomerDashboardTodoTabDto[] | null;
}

interface CustomerDashboardDistributionCardDto {
  categoryKey?: CustomerDashboardCategoryKey | null;
  categoryTitle?: string | null;
  todoCount?: number | null;
  openCount?: number | null;
  pendingCustomerCount?: number | null;
  departmentProcessingCount?: number | null;
  departmentProcessedCount?: number | null;
  totalTasks?: number | null;
  doneToday?: number | null;
  overdueTasks?: number | null;
}

interface CustomerDashboardDistributionDto {
  cards?: CustomerDashboardDistributionCardDto[] | null;
}

interface CustomerDashboardPerformanceDto {
  slaComplianceRate?: number | null;
  averageProcessingTime?: string | null;
  averageProcessingTimeMinutes?: number | null;
  reopenRate?: number | null;
  overdueTasks?: number | null;
}

interface CustomerDashboardTrendPointDto {
  timeLabel?: string | null;
  slaComplianceRate?: number | null;
  avgProcessingTimeMinutes?: number | null;
  avgProcessingTimeDisplay?: string | null;
  reopenRate?: number | null;
}

interface CustomerDashboardPerformanceTrendDto {
  dataPoints?: CustomerDashboardTrendPointDto[] | null;
  avgProcessingTimeAxis?: {
    unit?: string | null;
    tickLabels?: string[] | null;
    maxValueMinutes?: number | null;
  } | null;
}

interface CustomerDashboardAttentionSummaryTabDto {
  tabKey?: string | null;
  tabTitle?: string | null;
  count?: number | null;
}

interface CustomerDashboardAttentionSummaryDto {
  activeTab?: string | null;
  tabs?: CustomerDashboardAttentionSummaryTabDto[] | null;
  totalCount?: number | null;
  urgentCount?: number | null;
  blockedCount?: number | null;
}

interface CustomerDashboardAttentionTaskDto {
  sourceType?: string | null;
  sourceId?: string | null;
  taskNo?: string | null;
  taskCategory?: string | null;
  taskTitle?: string | null;
  applyFor?: string | null;
  applyForIconType?: string | null;
  waitingOn?: string | null;
  waitingOnIconType?: string | null;
  assignedToUserId?: string | null;
  assignedTo?: string | null;
  sla?: CustomerDashboardSlaDto | null;
  statusCode?: string | null;
  statusDisplay?: string | null;
  timeAlertDisplay?: string | null;
  waitingMinutes?: number | null;
  isUrgent?: boolean | null;
  canReassign?: boolean | null;
  detailTarget?: string | null;
  availableActions?: CustomerDashboardActionDto[] | null;
}

interface CustomerDashboardAttentionListDto {
  totalCount?: number | null;
  pageIndex?: number | null;
  pageSize?: number | null;
  activeTab?: string | null;
  tabs?: CustomerDashboardAttentionSummaryTabDto[] | null;
  tasks?: CustomerDashboardAttentionTaskDto[] | null;
}

interface CustomerDashboardCoachingMemberDto {
  memberId?: string | null;
  memberName?: string | null;
  overdueTasks?: number | null;
  slaComplianceRate?: number | null;
  avgProcessingTime?: string | null;
  reopenRate?: number | null;
}

interface CustomerDashboardCoachingDto {
  members?: CustomerDashboardCoachingMemberDto[] | null;
}

interface CustomerDashboardEmergencyLeaveMemberDto {
  memberId?: string | null;
  memberName?: string | null;
  leaveReason?: string | null;
  returnTime?: string | null;
  todoTaskCount?: number | null;
  avatarUrl?: string | null;
}

interface CustomerDashboardEmergencyLeaveDto {
  totalCount?: number | null;
  members?: CustomerDashboardEmergencyLeaveMemberDto[] | null;
}

interface CustomerDashboardOverviewDto {
  userRole?: string | null;
  todoSection?: CustomerDashboardTodoSectionDto | null;
  taskHub?: CustomerDashboardDistributionDto | null;
  performance?: CustomerDashboardPerformanceDto | null;
  teamPerformance?: CustomerDashboardPerformanceDto | null;
  departmentTaskDistribution?: CustomerDashboardDistributionDto | null;
  performanceTrend?: CustomerDashboardPerformanceTrendDto | null;
  needsYourAttentionSummary?: CustomerDashboardAttentionSummaryDto | null;
  needsYourAttentionList?: CustomerDashboardAttentionListDto | null;
  needsManagerAttentionSummary?: CustomerDashboardAttentionSummaryDto | null;
  needsManagerAttentionUrgentList?: CustomerDashboardAttentionListDto | null;
  needsManagerAttentionBlockedList?: CustomerDashboardAttentionListDto | null;
  membersNeedingCoaching?: CustomerDashboardCoachingDto | null;
  membersOnEmergencyLeave?: CustomerDashboardEmergencyLeaveDto | null;
}

interface CustomerDashboardTaskListDto {
  userRole?: string | null;
  listType?: CustomerDashboardTaskListType | null;
  activeTab?: string | null;
  totalCount?: number | null;
  pageIndex?: number | null;
  pageSize?: number | null;
  myTasks?: CustomerDashboardTaskCardDto[] | null;
  attentionTasks?: CustomerDashboardAttentionTaskDto[] | null;
  blockedTasks?: CustomerDashboardAttentionTaskDto[] | null;
}

export interface CustomerDashboardTaskCardsResult {
  tabKey: string;
  count: number;
  cards: DashboardTaskCard[];
}

export interface CustomerDashboardAttentionTabResult {
  tab: DashboardTableTab;
}

export interface CustomerDashboardTaskListParams {
  roleVariant: DashboardRoleVariant;
  tabKey: CustomerDashboardAttentionTabKey | string;
  pageIndex?: number;
  pageSize?: number;
  timeFilter?: DashboardTimeFilter;
  signal?: AbortSignal;
}

export interface CustomerDashboardAssignableMember {
  label: string;
  value: string;
}

export interface CustomerDashboardReassignPayload {
  assignedUserId: string;
  tasks: DashboardReassignTask[];
}

const withQuery = (
  path: string,
  params: Record<string, string | number | boolean | undefined>
) => {
  const queryString = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }
    queryString.set(key, String(value));
  });

  const suffix = queryString.toString();

  return suffix ? `${path}${path.includes("?") ? "&" : "?"}${suffix}` : path;
};

const appendMissingQuery = (
  path: string,
  defaults: Record<string, string | number | boolean | undefined>
) => {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const pathWithoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const [basePath, query = ""] = pathWithoutHash.split("?");
  const params = new URLSearchParams(query);

  Object.entries(defaults).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && !params.has(key)) {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString();
  const nextPath = suffix ? `${basePath}?${suffix}` : basePath;

  return `${nextPath}${hash}`;
};

const isShortCustomerRoute = (target: string, routeName: string) =>
  target === `/${routeName}` ||
  target.startsWith(`/${routeName}?`) ||
  target.startsWith(`/${routeName}#`);

const expandShortCustomerRoute = (
  target: string,
  routeName: string,
  routePath: string
) => target.replace(new RegExp(`^/${routeName}`, "i"), routePath);

const unwrapCustomerDashboardResponse = <T,>(
  response: CustomerDashboardApiResult<T>
): T => {
  if (
    response &&
    typeof response === "object" &&
    "isSuccess" in response &&
    "statusCode" in response &&
    "data" in response
  ) {
    if (response.data === null || response.data === undefined) {
      throw new Error(response.message || "Dashboard API returned empty data");
    }

    return response.data as T;
  }

  return response as T;
};

const normalizeNumber = (value?: number | null) => {
  const numericValue = Number(value ?? 0);

  return Number.isFinite(numericValue) ? numericValue : 0;
};

const isNumericValuePresent = (value?: number | null) =>
  value !== undefined && value !== null && Number.isFinite(Number(value));

const formatCompactNumber = (value: number, fractionDigits = 1) => {
  const rounded = Number(value.toFixed(fractionDigits));

  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(fractionDigits);
};

const formatPercentValue = (value?: number | null) =>
  isNumericValuePresent(value)
    ? `${formatCompactNumber(normalizeNumber(value), 1)}%`
    : undefined;

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return undefined;
  }

  const dateValue = moment(value);

  return dateValue.isValid() ? dateValue.format("DD/MM/YYYY HH:mm") : value;
};

const resolveCustomerDateRange = (timeFilter?: DashboardTimeFilter) => {
  if (timeFilter?.startDate && timeFilter.endDate) {
    const start = moment(timeFilter.startDate, "YYYY-MM-DD", true);
    const end = moment(timeFilter.endDate, "YYYY-MM-DD", true);

    if (start.isValid() && end.isValid() && !end.isBefore(start, "day")) {
      return {
        startDate: start.startOf("day").format(),
        endDate: end.endOf("day").format(),
      };
    }
  }

  const days = Math.max(1, Math.round(timeFilter?.days || 7));
  const end = moment().endOf("day");

  return {
    startDate: end.clone().subtract(days - 1, "days").startOf("day").format(),
    endDate: end.format(),
  };
};

const mapCustomerUserRole = (userRole?: string | null): DashboardRoleVariant => {
  const normalizedRole = String(userRole || "").trim().toLowerCase();

  return normalizedRole === "admin" ||
    normalizedRole === "manager" ||
    normalizedRole === "leader"
    ? "manager"
    : "staff";
};

const isManagerRole = (roleVariant: DashboardRoleVariant) =>
  roleVariant === "manager";

const getCustomerOverviewSections = (roleVariant: DashboardRoleVariant) =>
  isManagerRole(roleVariant)
    ? [
        "todoSection",
        "teamPerformance",
        "departmentTaskDistribution",
        "membersNeedingCoaching",
        "membersOnEmergencyLeave",
        "needsManagerAttentionSummary",
      ].join(",")
    : [
        "todoSection",
        "taskHub",
        "performance",
        "performanceTrend",
        "needsYourAttentionSummary",
      ].join(",");

const getCategoryLabelKey = (categoryKey?: string | null) => {
  const normalizedKey = String(categoryKey || "").trim();

  if (normalizedKey === "appeals") {
    return "adminDashboard.tabs.appeals";
  }

  if (normalizedKey === "refunds") {
    return "adminDashboard.tabs.refunds";
  }

  if (normalizedKey === "enquiries" || normalizedKey === "tickets") {
    return "adminDashboard.tabs.enquiriesComplaints";
  }

  return undefined;
};

const getAttentionLabelKey = (tabKey?: string | null) => {
  const normalizedKey = String(tabKey || "").trim();

  if (normalizedKey === "pendingCustomer") {
    return "adminDashboard.status.pendingCustomer";
  }

  if (normalizedKey === "departmentProcessing") {
    return "adminDashboard.status.departmentProcessing";
  }

  if (normalizedKey === "urgent") {
    return "adminDashboard.tabs.urgent";
  }

  if (normalizedKey === "blocked") {
    return "adminDashboard.tabs.blocked";
  }

  return "adminDashboard.tabs.all";
};

const getCustomerCategoryActionTarget = (
  categoryKey: string
): DashboardNavigationTarget => {
  if (categoryKey === "appeals") {
    return {
      targetPath: withQuery(CUSTOMER_ROUTE.appeals, {
        viewRole: "department",
        tab: "todo",
        pageTitleKey: "menu.appeals",
        breadcrumbRootKey: "menu.customer",
      }),
      permissionPath: CUSTOMER_ROUTE.appeals,
    };
  }

  if (categoryKey === "refunds") {
    return {
      targetPath: CUSTOMER_ROUTE.refunds,
      permissionPath: CUSTOMER_ROUTE.refunds,
    };
  }

  if (categoryKey === "enquiries" || categoryKey === "tickets") {
    return {
      targetPath: CUSTOMER_ROUTE.tickets,
      permissionPath: CUSTOMER_ROUTE.tickets,
    };
  }

  return {};
};

const normalizeCustomerSourceType = (
  sourceType?: string | null
): DashboardTaskSourceType | undefined => {
  const normalizedType = String(sourceType || "").trim().toLowerCase();

  if (normalizedType.includes("enquiry") || normalizedType.includes("enq")) {
    return "enquiry";
  }

  if (normalizedType.includes("refund")) {
    return "refund";
  }

  if (normalizedType.includes("appeal")) {
    return "appeal";
  }

  if (normalizedType.includes("ticket")) {
    return "ticket";
  }

  return undefined;
};

const isNumericPathValue = (value: string) => /^\d+$/.test(value.trim());

const getCustomerDetailReference = (
  rawTarget: string | null | undefined,
  sourceType: "refund" | "appeal"
) => {
  const trimmedTarget = String(rawTarget || "").trim();

  if (!trimmedTarget) {
    return undefined;
  }

  try {
    const targetUrl = new URL(trimmedTarget, "https://dashboard.local");
    const queryReference =
      sourceType === "refund"
        ? targetUrl.searchParams.get("refundId") ||
          targetUrl.searchParams.get("refundNo")
        : targetUrl.searchParams.get("appealId");

    if (queryReference) {
      return optionalString(queryReference);
    }

    const pathPattern =
      sourceType === "refund"
        ? /^\/(?:finance\/)?refunds\/([^/?#]+)/i
        : /^\/appeals\/([^/?#]+)/i;
    const pathReference = targetUrl.pathname.match(pathPattern)?.[1];

    if (!pathReference) {
      return undefined;
    }

    try {
      return optionalString(decodeURIComponent(pathReference));
    } catch {
      return optionalString(pathReference);
    }
  } catch {
    return undefined;
  }
};

const createRefundDetailTarget = (
  refundReference: string
): DashboardNavigationTarget => ({
  targetPath: withQuery(
    CUSTOMER_ROUTE.refundDetail,
    isNumericPathValue(refundReference)
      ? {
          refundId: refundReference,
          viewRole: "business_department",
          pageTitleKey: "menu.refundsDetails",
          breadcrumbRootKey: "menu.customer",
        }
      : {
          refundNo: refundReference,
          viewRole: "business_department",
          pageTitleKey: "menu.refundsDetails",
          breadcrumbRootKey: "menu.customer",
        }
  ),
  permissionPath: CUSTOMER_ROUTE.refundDetail,
});

const createTeamManagementRefundDetailTarget = (
  refundReference: string,
  sourceId?: string,
  canReassign?: boolean | null
): DashboardNavigationTarget => ({
  targetPath: withQuery(CUSTOMER_ROUTE.teamManagementRefundDetail, {
    sourcePage: "teamManagement",
    breadcrumbMode: "teamManagementTask",
    teamManagementScope: "customer",
    pageTitleKey: "menu.taskDetails",
    returnTo: "dashboard",
    canReassign: canReassign === true ? "true" : "false",
    teamTaskSourceType: "refund",
    teamTaskSourceId: sourceId,
    refundId: isNumericPathValue(refundReference)
      ? refundReference
      : undefined,
    refundNo: isNumericPathValue(refundReference)
      ? undefined
      : refundReference,
    viewRole: "customer_happiness",
  }),
  permissionPath: CUSTOMER_ROUTE.teamManagement,
});

const createTeamManagementAppealDetailTarget = (
  sourceId: string,
  canReassign?: boolean | null
): DashboardNavigationTarget => ({
  targetPath: withQuery(CUSTOMER_ROUTE.teamManagementAppealDetail, {
    sourcePage: "teamManagement",
    breadcrumbMode: "teamManagementTask",
    teamManagementScope: "customer",
    pageTitleKey: "menu.taskDetails",
    returnTo: "dashboard",
    canReassign: canReassign === true ? "true" : "false",
    teamTaskSourceType: "appeal",
    teamTaskSourceId: sourceId,
    appealId: sourceId,
    viewRole: "customer_happiness",
  }),
  permissionPath: CUSTOMER_ROUTE.teamManagement,
});

const normalizeCustomerTarget = (
  rawTarget?: string | null
): DashboardNavigationTarget => {
  let trimmedTarget = String(rawTarget || "").trim();

  if (!trimmedTarget) {
    return {};
  }

  if (/^https?:\/\//i.test(trimmedTarget)) {
    try {
      const targetUrl = new URL(trimmedTarget);

      trimmedTarget = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
    } catch {
      return {};
    }
  }

  const normalizedTarget = trimmedTarget.startsWith("/")
    ? trimmedTarget
    : `/${trimmedTarget}`;
  const lowerTarget = normalizedTarget.toLowerCase();
  const ticketMatch = normalizedTarget.match(/^\/tickets\/([^/?#]+)/i);
  const refundMatch = normalizedTarget.match(/^\/refunds\/([^/?#]+)/i);
  const financeRefundMatch = normalizedTarget.match(
    /^\/finance\/refunds\/([^/?#]+)/i
  );
  const appealMatch = normalizedTarget.match(/^\/appeals\/([^/?#]+)/i);

  if (ticketMatch?.[1]) {
    return {
      targetPath: withQuery(CUSTOMER_ROUTE.ticketDetail, {
        id: ticketMatch[1],
      }),
      permissionPath: CUSTOMER_ROUTE.ticketDetail,
    };
  }

  if (refundMatch?.[1]) {
    return createRefundDetailTarget(refundMatch[1]);
  }

  if (financeRefundMatch?.[1]) {
    return createRefundDetailTarget(financeRefundMatch[1]);
  }

  if (appealMatch?.[1]) {
    return {
      targetPath: withQuery(CUSTOMER_ROUTE.appealDetail, {
        appealId: appealMatch[1],
        viewRole: "department",
        tab: "todo",
        pageTitleKey: "menu.appealsDetails",
        breadcrumbRootKey: "menu.customer",
      }),
      permissionPath: CUSTOMER_ROUTE.appealDetail,
    };
  }

  if (isShortCustomerRoute(lowerTarget, "tickets")) {
    return {
      targetPath: expandShortCustomerRoute(
        normalizedTarget,
        "tickets",
        CUSTOMER_ROUTE.tickets
      ),
      permissionPath: CUSTOMER_ROUTE.tickets,
    };
  }

  if (isShortCustomerRoute(lowerTarget, "refunds")) {
    return {
      targetPath: appendMissingQuery(
        expandShortCustomerRoute(
          normalizedTarget,
          "refunds",
          CUSTOMER_ROUTE.refunds
        ),
        {
          viewRole: "business_department",
          pageTitleKey: "menu.refunds",
          breadcrumbRootKey: "menu.customer",
        }
      ),
      permissionPath: CUSTOMER_ROUTE.refunds,
    };
  }

  if (isShortCustomerRoute(lowerTarget, "appeals")) {
    return {
      targetPath: appendMissingQuery(
        expandShortCustomerRoute(
          normalizedTarget,
          "appeals",
          CUSTOMER_ROUTE.appeals
        ),
        {
          viewRole: "department",
          tab: "todo",
          pageTitleKey: "menu.appeals",
          breadcrumbRootKey: "menu.customer",
        }
      ),
      permissionPath: CUSTOMER_ROUTE.appeals,
    };
  }

  if (isShortCustomerRoute(lowerTarget, "team-management")) {
    return {
      targetPath: expandShortCustomerRoute(
        normalizedTarget,
        "team-management",
        CUSTOMER_ROUTE.teamManagement
      ),
      permissionPath: CUSTOMER_ROUTE.teamManagement,
    };
  }

  if (lowerTarget.startsWith(CUSTOMER_ROUTE.ticketDetail.toLowerCase())) {
    return {
      targetPath: normalizedTarget,
      permissionPath: CUSTOMER_ROUTE.ticketDetail,
    };
  }

  if (lowerTarget.startsWith(CUSTOMER_ROUTE.tickets.toLowerCase())) {
    return {
      targetPath: normalizedTarget,
      permissionPath: CUSTOMER_ROUTE.tickets,
    };
  }

  if (lowerTarget.startsWith(CUSTOMER_ROUTE.refundDetail.toLowerCase())) {
    return {
      targetPath: appendMissingQuery(normalizedTarget, {
        viewRole: "business_department",
        pageTitleKey: "menu.refundsDetails",
        breadcrumbRootKey: "menu.customer",
      }),
      permissionPath: CUSTOMER_ROUTE.refundDetail,
    };
  }

  if (lowerTarget.startsWith(CUSTOMER_ROUTE.refunds.toLowerCase())) {
    return {
      targetPath: appendMissingQuery(normalizedTarget, {
        viewRole: "business_department",
        pageTitleKey: "menu.refunds",
        breadcrumbRootKey: "menu.customer",
      }),
      permissionPath: CUSTOMER_ROUTE.refunds,
    };
  }

  if (lowerTarget.startsWith(CUSTOMER_ROUTE.appealDetail.toLowerCase())) {
    return {
      targetPath: appendMissingQuery(normalizedTarget, {
        viewRole: "department",
        tab: "todo",
        pageTitleKey: "menu.appealsDetails",
        breadcrumbRootKey: "menu.customer",
      }),
      permissionPath: CUSTOMER_ROUTE.appealDetail,
    };
  }

  if (lowerTarget.startsWith(CUSTOMER_ROUTE.appeals.toLowerCase())) {
    return {
      targetPath: appendMissingQuery(normalizedTarget, {
        viewRole: "department",
        tab: "todo",
        pageTitleKey: "menu.appeals",
        breadcrumbRootKey: "menu.customer",
      }),
      permissionPath: CUSTOMER_ROUTE.appeals,
    };
  }

  if (lowerTarget.startsWith(CUSTOMER_ROUTE.teamManagement.toLowerCase())) {
    return {
      targetPath: normalizedTarget,
      permissionPath: CUSTOMER_ROUTE.teamManagement,
    };
  }

  return {};
};

const getFirstOpenActionTarget = (
  actions?: CustomerDashboardActionDto[] | null
) => {
  const openAction = (actions || []).find((action) => {
    const actionCode = String(action?.actionCode || "").toLowerCase();

    return actionCode === "open" || actionCode === "message";
  });

  return normalizeCustomerTarget(openAction?.actionUrl);
};

const normalizeStatusToken = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const getStatusConfig = (
  status?: {
    statusCode?: string | null;
    statusDisplay?: string | null;
  } | string | null
): {
  statusKey?: string;
  statusText?: string;
  tone: DashboardTone;
} => {
  const statusCode = typeof status === "string" ? undefined : status?.statusCode;
  const statusDisplay =
    typeof status === "string" ? status : status?.statusDisplay;
  const normalizedStatusCode = normalizeStatusToken(statusCode);
  const normalizedStatusDisplay = normalizeStatusToken(statusDisplay);
  const normalizedStatus = normalizedStatusCode || normalizedStatusDisplay;

  if (normalizedStatus === "open") {
    return {
      statusKey: "adminDashboard.status.open",
      tone: "red",
    };
  }

  if (
    normalizedStatus === "departmentprocessed" ||
    normalizedStatus === "deptprocessed"
  ) {
    return {
      statusKey: "adminDashboard.status.departmentProcessed",
      tone: "orange",
    };
  }

  if (
    normalizedStatus === "departmentprocessing" ||
    normalizedStatus === "deptprocessing"
  ) {
    return {
      statusKey: "adminDashboard.status.departmentProcessing",
      tone: "orange",
    };
  }

  if (
    normalizedStatus === "pendingcustomer" ||
    normalizedStatus === "customerpending"
  ) {
    return {
      statusKey: "adminDashboard.status.pendingCustomer",
      tone: "orange",
    };
  }

  if (normalizedStatus === "resolved") {
    return {
      statusKey: "adminDashboard.status.resolved",
      tone: "green",
    };
  }

  return {
    statusText: optionalString(statusDisplay),
    tone: "default",
  };
};

const getSlaTone = (sla?: CustomerDashboardSlaDto | null): DashboardTone => {
  const color = String(sla?.color || "").toLowerCase();
  const text = String(sla?.displayText || "").toLowerCase();

  if (color === "danger" || text.includes("overdue")) {
    return "red";
  }

  return "default";
};

const mapCustomerTaskCards = (
  cards: CustomerDashboardTaskCardDto[] = [],
  prefix: string
): DashboardTaskCard[] => {
  const getItemKey = createDashboardItemKeyFactory(prefix);

  return cards.map((card, index) => {
    const status = getStatusConfig(card.statusBadge);
    const target = getFirstOpenActionTarget(card.availableActions);
    const sourceId = optionalString(card.sourceId);
    const sourceNamespace = optionalString(card.sourceType);
    const sourceType = normalizeCustomerSourceType(card.sourceType);
    const taskNo = optionalString(card.taskNo);

    return {
      key: getItemKey({
        namespace: sourceNamespace,
        identityParts: [sourceId, taskNo, card.sortTime],
        index,
      }),
      statusKey: status.statusKey,
      statusText: status.statusText,
      statusTone: status.tone,
      alertText: card.sla?.displayText || undefined,
      title: getDashboardTaskCardTitleFromTaskNo(sourceType, {
        taskTitle: optionalString(card.taskTitle),
        taskNo,
      }),
      subtitle: optionalString(card.relatedEntity?.name),
      subtitleIcon: normalizeDashboardEntityIconType(card.relatedEntity?.type),
      sourceType,
      sourceId,
      lastUpdatedAt: card.sortTime || undefined,
      ...target,
    };
  });
};

const mapTodoTabs = (
  todoSection?: CustomerDashboardTodoSectionDto | null
): DashboardTaskTab[] => {
  const tabsByKey = new Map(
    (todoSection?.tabs || []).map((tab) => [String(tab.tabKey || ""), tab])
  );

  return CUSTOMER_TAB_ORDER.map((tabKey) => {
    const sourceTab = tabsByKey.get(tabKey);
    const actionTarget = getCustomerCategoryActionTarget(tabKey);

    return {
      key: tabKey,
      labelKey: getCategoryLabelKey(tabKey),
      labelText: sourceTab?.tabTitle || undefined,
      count: isNumericValuePresent(sourceTab?.todoCount)
        ? normalizeNumber(sourceTab?.todoCount)
        : "-",
      cards: mapCustomerTaskCards(
        sourceTab?.cards || [],
        `customer-${tabKey}-overview`
      ),
      actionPath: actionTarget.targetPath,
      actionPermissionPath: actionTarget.permissionPath,
    };
  });
};

const createMetricCards = (
  performance?: CustomerDashboardPerformanceDto | null,
  roleVariant: DashboardRoleVariant = "staff"
): DashboardMetricCard[] => {
  if (!performance) {
    return [];
  }

  const tooltipGroup = isManagerRole(roleVariant) ? "manager" : "staff";
  const slaMetric: DashboardMetricCard = {
    key: "sla",
    labelKey: "adminDashboard.metrics.slaCompliance",
    infoTooltipKey: `adminDashboard.tooltips.${tooltipGroup}.slaCompliance`,
    value: formatPercentValue(performance.slaComplianceRate),
    tone: isNumericValuePresent(performance.slaComplianceRate)
      ? normalizeNumber(performance.slaComplianceRate) >= 80
        ? "green"
        : "red"
      : "neutral",
    variant: "gauge",
  };
  const processingMetric: DashboardMetricCard = {
    key: "processing",
    labelKey: "adminDashboard.metrics.avgProcessingTime",
    infoTooltipKey: `adminDashboard.tooltips.${tooltipGroup}.avgProcessingTime`,
    value: optionalString(performance.averageProcessingTime),
    tone: "green",
    variant: "timer",
  };
  const reopenMetric: DashboardMetricCard = {
    key: "reopen",
    labelKey: "adminDashboard.metrics.reopenRate",
    infoTooltipKey: `adminDashboard.tooltips.${tooltipGroup}.reopenRate`,
    value: formatPercentValue(performance.reopenRate) || "-",
    tone:
      isNumericValuePresent(performance.reopenRate) &&
      normalizeNumber(performance.reopenRate) !== 0
        ? "green"
        : "neutral",
    variant: "ring",
  };
  const overdueMetric: DashboardMetricCard = {
    key: "overdue",
    labelKey: "adminDashboard.metrics.overdueTasks",
    infoTooltipKey: `adminDashboard.tooltips.${tooltipGroup}.overdueTasks`,
    value: String(normalizeNumber(performance.overdueTasks)),
    tone: "red",
    variant: "alert",
  };

  if (isManagerRole(roleVariant)) {
    return [slaMetric, processingMetric, overdueMetric, reopenMetric];
  }

  return [slaMetric, processingMetric, reopenMetric, overdueMetric];
};

const mapPerformanceTrend = (
  trend?: CustomerDashboardPerformanceTrendDto | null
): DashboardTrendChart | undefined => {
  const points = trend?.dataPoints || [];

  if (!points.length) {
    return undefined;
  }

  return {
    key: "customer-performance-trend",
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
          maxValue: normalizeNumber(
            trend.avgProcessingTimeAxis.maxValueMinutes
          ),
          tickLabels: trend.avgProcessingTimeAxis.tickLabels || [],
        }
      : undefined,
    series: [
      {
        key: "sla",
        labelKey: "adminDashboard.metrics.slaCompliance",
        color: "#A0D5AB",
        axis: "left",
        values: points.map((item) => normalizeNumber(item.slaComplianceRate)),
        unit: "%",
      },
      {
        key: "processing",
        labelKey: "adminDashboard.metrics.avgProcessingTime",
        color: "#D7BC6D",
        axis: "right",
        values: points.map((item) =>
          normalizeNumber(item.avgProcessingTimeMinutes)
        ),
        displayValues: points.map(
          (item) => optionalString(item.avgProcessingTimeDisplay) || ""
        ),
        unit: "time",
      },
    ],
  };
};

const getDistributionCardData = (
  distribution?: CustomerDashboardDistributionDto | null,
  categoryKey?: string
) =>
  (distribution?.cards || []).find(
    (item) => String(item.categoryKey || "") === categoryKey
  );

const createDistributionCard = (
  sourceCard: CustomerDashboardDistributionCardDto | undefined,
  categoryKey: (typeof CUSTOMER_TAB_ORDER)[number]
): DashboardDonutCard => {
  const actionTarget = getCustomerCategoryActionTarget(categoryKey);
  const openCount = normalizeNumber(sourceCard?.openCount);
  const pendingCustomerCount = normalizeNumber(sourceCard?.pendingCustomerCount);
  const departmentProcessingCount = normalizeNumber(
    sourceCard?.departmentProcessingCount
  );
  const departmentProcessedCount = normalizeNumber(
    sourceCard?.departmentProcessedCount
  );
  const legends = [
    ...(categoryKey === "enquiries"
      ? [
          {
            key: "open",
            labelKey: "adminDashboard.status.open",
            value: openCount,
            color: "#FAAAA7",
          },
        ]
      : []),
    {
      key: "departmentProcessing",
      labelKey: "adminDashboard.status.departmentProcessing",
      value: departmentProcessingCount,
      color: "#A0D5AB",
    },
    {
      key: "departmentProcessed",
      labelKey: "adminDashboard.status.departmentProcessed",
      value: departmentProcessedCount,
      color: "#F5AC7C",
    },
    {
      key: "pendingCustomer",
      labelKey: "adminDashboard.status.pendingCustomer",
      value: pendingCustomerCount,
      color: "#81C1FF",
    },
  ];

  return {
    key: `customer-${categoryKey}`,
    titleKey: getCategoryLabelKey(categoryKey),
    actionPath: actionTarget.targetPath,
    actionPermissionPath: actionTarget.permissionPath,
    centerValue: String(normalizeNumber(sourceCard?.todoCount)),
    centerLabelKey: "adminDashboard.labels.toDo",
    legends,
    showLegendPercentage: false,
    summaryTiles: [
      {
        key: "total",
        labelKey: "adminDashboard.metrics.totalTasks",
        value: String(normalizeNumber(sourceCard?.totalTasks)),
        tone: "neutral",
        infoTooltipKey: "adminDashboard.tooltips.totalTasks",
      },
      {
        key: "doneToday",
        labelKey: "adminDashboard.metrics.doneToday",
        value: String(normalizeNumber(sourceCard?.doneToday)),
        tone: "green",
      },
      {
        key: "overdue",
        labelKey: "adminDashboard.metrics.overdueTasks",
        value: String(normalizeNumber(sourceCard?.overdueTasks)),
        tone: "red",
      },
    ],
  };
};

const mapDistributionCards = (
  distribution?: CustomerDashboardDistributionDto | null
): DashboardDonutCard[] =>
  CUSTOMER_TAB_ORDER.map((categoryKey) =>
    createDistributionCard(getDistributionCardData(distribution, categoryKey), categoryKey)
  );

const dashboardCell = (
  text?: string,
  options: Omit<DashboardTableCell, "text"> = {}
): DashboardTableCell => ({
  text,
  ...options,
});

const dashboardLabelCell = (
  textKey: string,
  options: Omit<DashboardTableCell, "textKey"> = {}
): DashboardTableCell => ({
  textKey,
  ...options,
});

const getTimeAlertTone = (
  task: CustomerDashboardAttentionTaskDto
): DashboardTone => {
  const waitingOn = String(task.waitingOn || "").toLowerCase();
  const timeAlert = String(task.timeAlertDisplay || "").toLowerCase();
  const waitingMinutes = normalizeNumber(task.waitingMinutes);
  const remainingMinutes = Number(task.sla?.remainingMinutes ?? 0);

  if (waitingOn === "customer") {
    return waitingMinutes >= 24 * 60 || timeAlert.includes("overdue")
      ? "red"
      : "neutral";
  }

  if (waitingOn === "department") {
    return timeAlert.includes("overdue") || remainingMinutes < 0
      ? "red"
      : "neutral";
  }

  return timeAlert.includes("overdue") ? "red" : "neutral";
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
        key: "category",
        titleKey: "adminDashboard.table.taskCategory",
        dataIndex: "category",
        width: 240,
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
        width: 180,
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
        width: 200,
      },
      {
        key: "action",
        titleKey: "adminDashboard.table.actions",
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
      key: "category",
      titleKey: "adminDashboard.table.category",
      dataIndex: "category",
      width: 260,
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
    {
      key: "action",
      titleKey: "adminDashboard.table.action",
      dataIndex: "action",
      width: 120,
    },
  ];
};

const getCustomerActionTarget = (
  task: CustomerDashboardAttentionTaskDto,
  actionCode: string
) => {
  const action = (task.availableActions || []).find(
    (item) =>
      String(item.actionCode || "").trim().toLowerCase() ===
      actionCode.toLowerCase()
  );

  return normalizeCustomerTarget(action?.actionUrl);
};

const getCustomerDetailActionTarget = (
  task: CustomerDashboardAttentionTaskDto
) => {
  const action = (task.availableActions || []).find((item) => {
    const actionCode = String(item.actionCode || "").trim().toLowerCase();

    return actionCode === "open" || actionCode === "view";
  });

  return normalizeCustomerTarget(action?.actionUrl);
};

const getCustomerRowTarget = (task: CustomerDashboardAttentionTaskDto) => {
  const sourceType =
    normalizeCustomerSourceType(task.sourceType) ||
    normalizeCustomerSourceType(task.taskCategory) ||
    normalizeCustomerSourceType(task.detailTarget);
  const sourceId = optionalString(task.sourceId);

  if (sourceType === "refund") {
    const refundReference =
      sourceId ||
      getCustomerDetailReference(task.detailTarget, "refund") ||
      optionalString(task.taskNo);

    if (refundReference) {
      return createTeamManagementRefundDetailTarget(
        refundReference,
        sourceId,
        task.canReassign
      );
    }
  }

  if (sourceType === "appeal") {
    const appealReference =
      sourceId || getCustomerDetailReference(task.detailTarget, "appeal");

    if (appealReference) {
      return createTeamManagementAppealDetailTarget(
        appealReference,
        task.canReassign
      );
    }
  }

  const detailTarget = normalizeCustomerTarget(task.detailTarget);

  return detailTarget.targetPath ? detailTarget : getCustomerDetailActionTarget(task);
};

const mapCustomerAvailableActions = (
  actions?: CustomerDashboardActionDto[] | null
): DashboardAvailableAction[] => {
  return (actions || []).map((action) => ({
    actionCode: optionalString(action?.actionCode),
    actionLabel: optionalString(action?.actionLabel),
    actionUrl: optionalString(action?.actionUrl),
    openMode: optionalString(action?.openMode),
  }));
};

const mapAttentionRow = (
  task: CustomerDashboardAttentionTaskDto,
  index: number,
  roleVariant: DashboardRoleVariant,
  tabKey: string,
  getItemKey: ReturnType<typeof createDashboardItemKeyFactory>
): DashboardTableRow => {
  const sourceType =
    normalizeCustomerSourceType(task.sourceType) ||
    normalizeCustomerSourceType(task.taskCategory) ||
    normalizeCustomerSourceType(task.detailTarget);
  const sourceId = optionalString(task.sourceId);
  const taskNo = optionalString(task.taskNo);
  const rowTarget = getCustomerRowTarget(task);
  const status = getStatusConfig(task.statusDisplay);
  const timeAlertText = optionalString(task.timeAlertDisplay);
  const row: DashboardTableRow = {
    key: getItemKey({
      namespace: sourceType,
      identityParts: [
        sourceId,
        taskNo,
        task.detailTarget,
        task.statusDisplay,
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
      tone: getSlaTone(task.sla),
    }),
    status: status.statusText
      ? dashboardCell(status.statusText, { tone: status.tone })
      : status.statusKey
        ? dashboardLabelCell(status.statusKey, { tone: status.tone })
        : dashboardCell(undefined, { tone: status.tone }),
    timeAlert: dashboardCell(timeAlertText, {
      tone: getTimeAlertTone(task),
    }),
    availableActions: mapCustomerAvailableActions(task.availableActions),
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
  }

  if (!isManagerRole(roleVariant)) {
    const messageTarget = getCustomerActionTarget(task, "message");

    if (messageTarget.targetPath) {
      row.actions = [
        {
          key: "message",
          labelKey: "adminDashboard.actions.message",
          tone: "gold",
          targetPath: messageTarget.targetPath,
          permissionPath: messageTarget.permissionPath,
        },
      ];
    }
  }

  return row;
};

const mapAttentionTab = ({
  roleVariant,
  tabKey,
  tabTitle,
  count,
  tasks,
  pageIndex,
  pageSize,
}: {
  roleVariant: DashboardRoleVariant;
  tabKey: string;
  tabTitle?: string | null;
  count?: number | null;
  tasks?: CustomerDashboardAttentionTaskDto[] | null;
  pageIndex?: number | null;
  pageSize?: number | null;
}): DashboardTableTab => {
  const getItemKey = createDashboardItemKeyFactory(`customer-${tabKey}`);

  return {
    key: tabKey,
    labelKey: getAttentionLabelKey(tabKey),
    labelText: tabTitle || undefined,
    count: normalizeNumber(count),
    columns: getAttentionColumns(roleVariant, tabKey),
    rows: (tasks || []).map((task, index) =>
      mapAttentionRow(task, index, roleVariant, tabKey, getItemKey)
    ),
    selectable: isManagerRole(roleVariant) && tabKey === "urgent",
    pageIndex: normalizeNumber(pageIndex) || 1,
    pageSize: normalizeNumber(pageSize) || 10,
    totalCount: normalizeNumber(count),
  };
};

const mapStaffAttentionTable = (
  summary?: CustomerDashboardAttentionSummaryDto | null,
  list?: CustomerDashboardAttentionListDto | null
) => ({
  key: "customer-staff-attention",
  titleKey: "adminDashboard.sections.needsYourAttention",
  tabs: CUSTOMER_STAFF_ATTENTION_TABS.map((tabKey) => {
    const activeList = String(list?.activeTab || "all") === tabKey ? list : null;

    return mapAttentionTab({
      roleVariant: "staff",
      tabKey,
      tabTitle: (summary?.tabs || []).find(
        (item) => String(item.tabKey || "") === tabKey
      )?.tabTitle,
      count: resolveDashboardAttentionCount(summary, tabKey, activeList),
      tasks: activeList?.tasks || [],
      pageIndex: activeList?.pageIndex,
      pageSize: activeList?.pageSize,
    });
  }),
});

const mapManagerAttentionTable = (
  summary?: CustomerDashboardAttentionSummaryDto | null,
  urgentList?: CustomerDashboardAttentionListDto | null,
  blockedList?: CustomerDashboardAttentionListDto | null
) => ({
  key: "customer-manager-attention",
  titleKey: "adminDashboard.sections.needsManagerAttention",
  tabs: CUSTOMER_MANAGER_ATTENTION_TABS.map((tabKey) => {
    const list = tabKey === "blocked" ? blockedList : urgentList;

    return mapAttentionTab({
      roleVariant: "manager",
      tabKey,
      tabTitle: (summary?.tabs || []).find(
        (item) => String(item.tabKey || "") === tabKey
      )?.tabTitle,
      count: resolveDashboardAttentionCount(summary, tabKey, list),
      tasks: list?.tasks,
      pageIndex: list?.pageIndex,
      pageSize: list?.pageSize,
    });
  }),
});

const mapCoachingRows = (coaching?: CustomerDashboardCoachingDto | null) => {
  const getItemKey = createDashboardItemKeyFactory("customer-coaching");

  return (coaching?.members || []).map((item, index) => ({
    key: getItemKey({
      namespace: "member",
      identityParts: [item.memberId, item.memberName],
      index,
    }),
    member: optionalString(item.memberName),
    overdue: normalizeNumber(item.overdueTasks),
    slaCompliance: formatPercentValue(item.slaComplianceRate),
    avgProcessingTime: optionalString(item.avgProcessingTime),
    reopenRate: formatPercentValue(item.reopenRate) || "-",
  }));
};

const mapLeaveRows = (leave?: CustomerDashboardEmergencyLeaveDto | null) => {
  const getItemKey = createDashboardItemKeyFactory("customer-leave");

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
    todoCount: normalizeNumber(item.todoTaskCount),
    avatar: item.avatarUrl || undefined,
  }));
};

const mapOverviewToDashboardData = (
  overview: CustomerDashboardOverviewDto,
  fallbackRoleVariant: DashboardRoleVariant
): DashboardData => {
  const roleVariant = overview.userRole
    ? mapCustomerUserRole(overview.userRole)
    : fallbackRoleVariant;
  const performance = isManagerRole(roleVariant)
    ? overview.teamPerformance || overview.performance
    : overview.performance;
  const attentionTable = isManagerRole(roleVariant)
    ? mapManagerAttentionTable(overview.needsManagerAttentionSummary)
    : mapStaffAttentionTable(overview.needsYourAttentionSummary);
  const distribution = isManagerRole(roleVariant)
    ? overview.departmentTaskDistribution
    : overview.taskHub;

  return {
    type: "workload",
    department: "customer",
    roleVariant,
    taskTabs: mapTodoTabs(overview.todoSection),
    performanceTitleKey: isManagerRole(roleVariant)
      ? "adminDashboard.sections.teamPerformance"
      : "adminDashboard.sections.myPerformance",
    performanceMetrics: createMetricCards(performance, roleVariant),
    donutCards: mapDistributionCards(distribution),
    trendChart: mapPerformanceTrend(overview.performanceTrend),
    supportAction: isManagerRole(roleVariant)
      ? {
          targetPath: withQuery(CUSTOMER_ROUTE.teamManagement, {
            tab: "teamMembers",
          }),
          permissionPath: CUSTOMER_ROUTE.teamManagement,
        }
      : undefined,
    coachingInfoTooltipKey: isManagerRole(roleVariant)
      ? "adminDashboard.tooltips.membersNeedingCoaching"
      : undefined,
    coachingRows: isManagerRole(roleVariant)
      ? mapCoachingRows(overview.membersNeedingCoaching)
      : undefined,
    leaveRows: isManagerRole(roleVariant)
      ? mapLeaveRows(overview.membersOnEmergencyLeave)
      : undefined,
    leaveTotalCount: isManagerRole(roleVariant)
      ? normalizeNumber(overview.membersOnEmergencyLeave?.totalCount)
      : undefined,
    attentionTable,
  };
};

const getCustomerDashboardOverview = (
  params: DashboardDataParams,
  roleVariant: DashboardRoleVariant
) =>
  request
    .get<
      CustomerDashboardApiResult<CustomerDashboardOverviewDto>,
      CustomerDashboardApiResult<CustomerDashboardOverviewDto>
    >(
      "/api/CustomerHappiness/Dashboard/Overview",
      {
        departmentId: CUSTOMER_HAPPINESS_DASHBOARD_DEPARTMENT_ID,
        ...resolveCustomerDateRange(params.timeFilter),
        sections: getCustomerOverviewSections(roleVariant),
        todoTab: "enquiries",
        attentionTab: isManagerRole(roleVariant) ? "urgent" : "all",
        attentionPageIndex: 1,
        attentionPageSize: 10,
      },
      {
        skipErrorMessage: true,
        signal: params.signal,
      }
    )
    .then(unwrapCustomerDashboardResponse);

const getCustomerDashboardTaskList = (
  params: {
    listType: CustomerDashboardTaskListType;
    tab?: string;
    pageIndex?: number;
    pageSize?: number;
    timeFilter?: DashboardTimeFilter;
    signal?: AbortSignal;
  }
) =>
  request
    .get<
      CustomerDashboardApiResult<CustomerDashboardTaskListDto>,
      CustomerDashboardApiResult<CustomerDashboardTaskListDto>
    >(
      "/api/CustomerHappiness/Dashboard/TaskList",
      {
        departmentId: CUSTOMER_HAPPINESS_DASHBOARD_DEPARTMENT_ID,
        listType: params.listType,
        tab: params.tab,
        pageIndex: params.pageIndex || 1,
        pageSize: params.pageSize || 10,
        ...resolveCustomerDateRange(params.timeFilter),
      },
      {
        skipErrorMessage: true,
        signal: params.signal,
      }
    )
    .then(unwrapCustomerDashboardResponse);

export const getCustomerHappinessDashboardData = async (
  params: DashboardDataParams
): Promise<DashboardData> => {
  const overviewByInitialRole = await getCustomerDashboardOverview(
    params,
    params.roleVariant
  );
  const responseRoleVariant = overviewByInitialRole.userRole
    ? mapCustomerUserRole(overviewByInitialRole.userRole)
    : params.roleVariant;
  const overview =
    responseRoleVariant === params.roleVariant
      ? overviewByInitialRole
      : await getCustomerDashboardOverview(params, responseRoleVariant);

  const dashboardData = mapOverviewToDashboardData(overview, responseRoleVariant);
  const attentionTab = await getCustomerHappinessDashboardAttentionTab({
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

export const getCustomerHappinessDashboardTaskCards = async ({
  tabKey,
  pageSize = 10,
  timeFilter,
  signal,
}: {
  tabKey: string;
  pageSize?: number;
  timeFilter?: DashboardTimeFilter;
  signal?: AbortSignal;
}): Promise<CustomerDashboardTaskCardsResult> => {
  const response = await getCustomerDashboardTaskList({
    listType: "myTasks",
    tab: tabKey,
    pageIndex: 1,
    pageSize,
    timeFilter,
    signal,
  });

  return {
    tabKey: response.activeTab || tabKey,
    count: normalizeNumber(response.totalCount),
    cards: mapCustomerTaskCards(response.myTasks || [], `customer-${tabKey}`),
  };
};

export const getCustomerHappinessDashboardAttentionTab = async ({
  roleVariant,
  tabKey,
  pageIndex = 1,
  pageSize = 10,
  timeFilter,
  signal,
}: CustomerDashboardTaskListParams): Promise<CustomerDashboardAttentionTabResult> => {
  const listType: CustomerDashboardTaskListType = isManagerRole(roleVariant)
    ? tabKey === "blocked"
      ? "managerAttentionBlocked"
      : "managerAttentionUrgent"
    : "needsYourAttention";
  const response = await getCustomerDashboardTaskList({
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
      tabKey: response.activeTab || tabKey,
      count: response.totalCount,
      tasks,
      pageIndex: response.pageIndex || pageIndex,
      pageSize: response.pageSize || pageSize,
    }),
  };
};

export const getCustomerDashboardAssignableMembers = async (): Promise<
  CustomerDashboardAssignableMember[]
> =>
  getTeamManagementMembers({
    scope: "customer",
    assignableOnly: true,
  });

export const reassignCustomerDashboardTasks = (
  payload: CustomerDashboardReassignPayload
) =>
  reassignTeamManagementTasks({
    scope: "customer",
    assignedUserId: payload.assignedUserId,
    tasks: payload.tasks.map((task) => ({
      sourceType: task.sourceType,
      sourceId: task.sourceId,
    })),
  });
