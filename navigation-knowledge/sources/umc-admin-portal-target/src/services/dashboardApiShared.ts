import moment from "moment";
import type {
  DashboardNavigationTarget,
  DashboardTableAction,
  DashboardTableCell,
  DashboardEntityIconType,
  DashboardTaskSourceType,
  DashboardTimeFilter,
  DashboardTone,
} from "@/pages/Dashboard/type";

export type DashboardApiResult<T> =
  | T
  | {
      isSuccess?: boolean;
      statusCode?: number;
      message?: string;
      data?: T | null;
    };

export interface DashboardDateRange {
  startDate: string;
  endDate: string;
}

const DASHBOARD_DEFAULT_DAYS = 7;
const DASHBOARD_DATE_FORMAT = "YYYY-MM-DD";

export const unwrapDashboardResponse = <T,>(
  response: DashboardApiResult<T>
): T => {
  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    ("isSuccess" in response || "statusCode" in response || "message" in response)
  ) {
    if (response.data === null || response.data === undefined) {
      throw new Error(response.message || "Dashboard API returned empty data");
    }

    return response.data as T;
  }

  return response as T;
};

export const resolveDashboardDateRange = (
  timeFilter?: DashboardTimeFilter,
  daysFallback = DASHBOARD_DEFAULT_DAYS
): DashboardDateRange => {
  if (timeFilter?.startDate && timeFilter.endDate) {
    return {
      startDate: timeFilter.startDate,
      endDate: timeFilter.endDate,
    };
  }

  const days = Math.max(1, Math.round(timeFilter?.days || daysFallback));
  const end = moment();
  const start = end.clone().subtract(days - 1, "days");

  return {
    startDate: start.format(DASHBOARD_DATE_FORMAT),
    endDate: end.format(DASHBOARD_DATE_FORMAT),
  };
};

export const resolveDashboardTrendDateRange = (
  timeFilter?: DashboardTimeFilter,
  daysFallback = 43
): DashboardDateRange => {
  const range = resolveDashboardDateRange(timeFilter);

  if (timeFilter?.startDate && timeFilter.endDate) {
    return range;
  }

  const days = Math.max(1, Math.round(timeFilter?.days || daysFallback));
  const startDate = moment(range.endDate, DASHBOARD_DATE_FORMAT, true)
    .subtract(days - 1, "days")
    .format(DASHBOARD_DATE_FORMAT);

  return {
    startDate,
    endDate: range.endDate,
  };
};

export const optionalString = (value?: unknown) => {
  const text = String(value ?? "").trim();

  return text || undefined;
};

export const normalizeDashboardEntityIconType = (
  value?: unknown
): DashboardEntityIconType | undefined => {
  const normalizedValue = optionalString(value)?.toLowerCase();

  return normalizedValue === "enterprise" || normalizedValue === "personal"
    ? normalizedValue
    : undefined;
};

export const createDashboardItemKeyFactory = (prefix: string) => {
  const seenKeys = new Set<string>();

  return ({
    namespace,
    identityParts,
    index,
  }: {
    namespace?: unknown;
    identityParts: unknown[];
    index: number;
  }) => {
    const namespacePart = optionalString(namespace);
    const identityPart = identityParts.map(optionalString).find(Boolean);
    const baseKey = namespacePart
      ? `${prefix}-${namespacePart}-${identityPart || index + 1}`
      : `${prefix}-${identityPart || index + 1}`;

    if (!seenKeys.has(baseKey)) {
      seenKeys.add(baseKey);
      return baseKey;
    }

    const dedupedKey = `${baseKey}-${index + 1}`;
    seenKeys.add(dedupedKey);
    return dedupedKey;
  };
};

export const optionalNumber = (value?: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : undefined;
};

export const countNumber = (value?: unknown) => optionalNumber(value) ?? 0;

interface DashboardAttentionSummaryCountSource {
  tabs?: Array<{
    tabKey?: unknown;
    count?: unknown;
  }> | null;
  totalCount?: unknown;
  urgentCount?: unknown;
  blockedCount?: unknown;
}

interface DashboardAttentionListCountSource {
  totalCount?: unknown;
}

const dashboardAttentionRootCountKeyByTab: Record<
  string,
  keyof DashboardAttentionSummaryCountSource
> = {
  all: "totalCount",
  urgent: "urgentCount",
  blocked: "blockedCount",
};

export const resolveDashboardAttentionCount = (
  summary: DashboardAttentionSummaryCountSource | null | undefined,
  tabKey: string,
  list?: DashboardAttentionListCountSource | null
) => {
  const listCount = optionalNumber(list?.totalCount);

  if (listCount !== undefined) {
    return listCount;
  }

  const rootCountKey = dashboardAttentionRootCountKeyByTab[tabKey];
  const rootCount = rootCountKey
    ? optionalNumber(summary?.[rootCountKey])
    : undefined;

  if (rootCount !== undefined) {
    return rootCount;
  }

  return optionalNumber(
    (summary?.tabs || []).find((item) => String(item.tabKey || "") === tabKey)
      ?.count
  );
};

export const formatCompactNumber = (value: number, fractionDigits = 1) => {
  const rounded = Number(value.toFixed(fractionDigits));

  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(fractionDigits);
};

export const formatPercent = (value?: unknown, ratioValue = false) => {
  const numericValue = optionalNumber(value);

  if (numericValue === undefined) {
    return undefined;
  }

  const percentValue = ratioValue ? numericValue * 100 : numericValue;

  return `${formatCompactNumber(percentValue, 1)}%`;
};

export const formatMinutes = (value?: unknown) => {
  const minutes = optionalNumber(value);

  if (minutes === undefined) {
    return undefined;
  }

  if (minutes < 60) {
    return `${formatCompactNumber(minutes, 0)}m`;
  }

  if (minutes < 24 * 60) {
    return `${formatCompactNumber(minutes / 60, 1)}h`;
  }

  return `${formatCompactNumber(minutes / (24 * 60), 1)}d`;
};

export const formatDateTime = (value?: unknown) => {
  const text = optionalString(value);

  if (!text) {
    return undefined;
  }

  const dateValue = moment(text);

  return dateValue.isValid() ? dateValue.format("DD/MM/YYYY HH:mm") : text;
};

export const dashboardCell = (
  text?: string,
  options: Omit<DashboardTableCell, "text"> = {}
): DashboardTableCell => ({
  text,
  ...options,
});

export const dashboardLabelCell = (
  textKey: string,
  options: Omit<DashboardTableCell, "textKey"> = {}
): DashboardTableCell => ({
  textKey,
  ...options,
});

export const createDashboardWaitingOnCell = (
  waitingOn?: unknown,
  waitingOnIconType?: unknown
): DashboardTableCell => {
  const icon = normalizeDashboardEntityIconType(waitingOnIconType);
  const normalizedValue = optionalString(waitingOn)?.toLowerCase();

  if (normalizedValue === "customer") {
    return dashboardLabelCell("adminDashboard.table.customer", {
      icon,
    });
  }

  if (normalizedValue === "department") {
    return dashboardLabelCell("adminDashboard.table.department", {
      icon,
    });
  }

  return dashboardCell(optionalString(waitingOn), {
    icon,
  });
};

export const getSlaTone = (color?: unknown, displayText?: unknown): DashboardTone => {
  const normalizedColor = String(color || "").toLowerCase();
  const normalizedText = String(displayText || "").toLowerCase();

  if (
    normalizedColor === "danger" ||
    normalizedColor === "red" ||
    normalizedText.includes("overdue")
  ) {
    return "red";
  }

  if (normalizedColor === "warning" || normalizedColor === "yellow") {
    return "yellow";
  }

  return "default";
};

export const normalizeStatusTone = (status?: unknown): DashboardTone => {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedStatusCode = normalizedStatus.replace(/[\s_-]+/g, "");

  if (
    normalizedStatusCode === "departmentprocessing" ||
    normalizedStatusCode === "departmentprocessed" ||
    normalizedStatusCode === "pendingcustomer" ||
    normalizedStatusCode === "pendingrefund"
  ) {
    return "orange";
  }

  if (
    normalizedStatusCode === "refunded" ||
    normalizedStatus.includes("approved") ||
    normalizedStatus.includes("resolved")
  ) {
    return "green";
  }

  if (
    normalizedStatus.includes("overdue") ||
    normalizedStatus.includes("rejected") ||
    normalizedStatus.includes("failed")
  ) {
    return "red";
  }

  if (normalizedStatus.includes("pending") || normalizedStatus.includes("progress")) {
    return "orange";
  }

  return "default";
};

export const normalizeTaskSourceType = (
  sourceType?: unknown
): DashboardTaskSourceType | undefined => {
  const normalizedType = String(sourceType || "").trim().toLowerCase();

  if (
    normalizedType.includes("application") ||
    normalizedType.includes("service")
  ) {
    return "application";
  }

  if (normalizedType.includes("profile")) {
    return "profile";
  }

  if (normalizedType.includes("enquiry") || normalizedType.includes("enq")) {
    return "enquiry";
  }

  if (normalizedType.includes("refund")) {
    return "refund";
  }

  if (normalizedType.includes("appeal")) {
    return "appeal";
  }

  if (normalizedType.includes("inspection")) {
    return "inspection";
  }

  if (normalizedType.includes("violation")) {
    return "violation";
  }

  if (normalizedType.includes("content")) {
    return "content";
  }

  if (normalizedType.includes("license")) {
    return "license";
  }

  if (normalizedType.includes("ticket")) {
    return "ticket";
  }

  return undefined;
};

export const withQuery = (
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

  return `${suffix ? `${basePath}?${suffix}` : basePath}${hash}`;
};

const normalizeInspectionTaskDetailTarget = (path: string) => {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const pathWithoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const [basePath, query = ""] = pathWithoutHash.split("?");
  const params = new URLSearchParams(query);
  const legacyId = params.get("id");

  if (legacyId && !params.get("taskId")) {
    params.set("taskId", legacyId);
    params.delete("id");
  }

  const suffix = params.toString();

  return `${suffix ? `${basePath}?${suffix}` : basePath}${hash}`;
};

const normalizeApplicationDetailTarget = (path: string) => {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const pathWithoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const [basePath, query = ""] = pathWithoutHash.split("?");
  const params = new URLSearchParams(query);
  const id = params.get("id");

  if (id && !params.get("taskId")) {
    params.set("taskId", id);
    params.delete("id");
  }

  const suffix = params.toString();

  return `${suffix ? `${basePath}?${suffix}` : basePath}${hash}`;
};

const isNumericPathValue = (value: string) => /^\d+$/.test(value.trim());

const createRefundDetailTarget = (
  refundReference: string
): DashboardNavigationTarget => ({
  targetPath: withQuery(
    "/happiness/refunds/refundsDetails",
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
  permissionPath: "/happiness/refunds/refundsDetails",
});

export const normalizeDashboardActionTarget = (
  rawTarget?: unknown,
  department?: "license" | "content" | "inspection" | "customer"
): DashboardNavigationTarget => {
  let target = optionalString(rawTarget);

  if (!target) {
    return {};
  }

  if (/^https?:\/\//i.test(target)) {
    try {
      const targetUrl = new URL(target);

      target = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
    } catch {
      return {};
    }
  }

  const normalizedTarget = target.startsWith("/") ? target : `/${target}`;
  const applicationMatch = normalizedTarget.match(/^\/applications\/([^/?#]+)/i);
  const enquiryMatch = normalizedTarget.match(/^\/enquiries\/([^/?#]+)/i);
  const ticketMatch = normalizedTarget.match(/^\/tickets\/([^/?#]+)/i);
  const refundMatch = normalizedTarget.match(/^\/refunds\/([^/?#]+)/i);
  const financeRefundMatch = normalizedTarget.match(
    /^\/finance\/refunds\/([^/?#]+)/i
  );
  const appealMatch = normalizedTarget.match(/^\/appeals\/([^/?#]+)/i);
  const inspectionTaskMatch = normalizedTarget.match(/^\/inspection\/tasks\/([^/?#]+)/i);
  const inspectionViolationMatch = normalizedTarget.match(
    /^\/inspection\/violations\/([^/?#]+)/i
  );

  if (applicationMatch?.[1]) {
    const taskId =
      new URLSearchParams(normalizedTarget.split("?")[1] || "").get("taskId") ||
      undefined;

    if (!taskId) {
      return {};
    }

    const contentTarget =
      department === "content" || department === "inspection"
        ? "/content/ContentApplications/ContentApplicationsDetails"
        : "/licensing/applications/applicationsDetails";

    return {
      targetPath: withQuery(contentTarget, {
        id: applicationMatch[1],
        taskId,
      }),
      permissionPath: contentTarget,
    };
  }

  if (ticketMatch?.[1]) {
    return {
      targetPath: withQuery("/happiness/tickets/tickets-details", {
        id: ticketMatch[1],
      }),
      permissionPath: "/happiness/tickets/tickets-details",
    };
  }

  if (enquiryMatch?.[1]) {
    return {
      targetPath: withQuery("/happiness/tickets/tickets-details", {
        id: enquiryMatch[1],
      }),
      permissionPath: "/happiness/tickets/tickets-details",
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
      targetPath: withQuery("/happiness/appeals/appealsDetails", {
        appealId: appealMatch[1],
        viewRole: "department",
        tab: "todo",
        pageTitleKey: "menu.appealsDetails",
        breadcrumbRootKey: "menu.customer",
      }),
      permissionPath: "/happiness/appeals/appealsDetails",
    };
  }

  if (inspectionTaskMatch?.[1]) {
    return {
      targetPath: withQuery("/inspection/tasks/detail", {
        taskId: inspectionTaskMatch[1],
      }),
      permissionPath: "/inspection/tasks/detail",
    };
  }

  if (inspectionViolationMatch?.[1]) {
    return {
      targetPath: withQuery("/inspection/violations/detail", {
        from: "violations",
        violationId: inspectionViolationMatch[1],
      }),
      permissionPath: "/inspection/violations/detail",
    };
  }

  const lowerTarget = normalizedTarget.toLowerCase();

  if (lowerTarget.startsWith("/content/contentapplications")) {
    return {
      targetPath: normalizedTarget,
      permissionPath: lowerTarget.startsWith(
        "/content/contentapplications/contentapplicationsdetails"
      )
        ? "/content/ContentApplications/ContentApplicationsDetails"
        : "/content/ContentApplications",
    };
  }

  if (lowerTarget.startsWith("/licensing/applications/details")) {
    const targetPath = normalizedTarget.replace(
      /^\/licensing\/applications\/details/i,
      "/licensing/applications/applicationsDetails"
    );

    return {
      targetPath: normalizeApplicationDetailTarget(targetPath),
      permissionPath: "/licensing/applications/applicationsDetails",
    };
  }

  if (lowerTarget.startsWith("/licensing/applications")) {
    return {
      targetPath: normalizedTarget,
      permissionPath: lowerTarget.startsWith(
        "/licensing/applications/applicationsdetails"
      )
        ? "/licensing/applications/applicationsDetails"
        : "/licensing/applications",
    };
  }

  if (lowerTarget.startsWith("/licensing/profile/profiledetails")) {
    return {
      targetPath: normalizedTarget,
      permissionPath: "/licensing/Profile/ProfileDetails",
    };
  }

  if (lowerTarget.startsWith("/licensing/profile")) {
    return {
      targetPath: normalizedTarget,
      permissionPath: "/licensing/profile",
    };
  }

  if (lowerTarget.startsWith("/happiness/refunds/refundsdetails")) {
    return {
      targetPath: appendMissingQuery(normalizedTarget, {
        viewRole: "business_department",
        pageTitleKey: "menu.refundsDetails",
        breadcrumbRootKey: "menu.customer",
      }),
      permissionPath: "/happiness/refunds/refundsDetails",
    };
  }

  if (lowerTarget.startsWith("/happiness/refunds")) {
    return {
      targetPath: appendMissingQuery(normalizedTarget, {
        viewRole: "business_department",
        pageTitleKey: "menu.refunds",
        breadcrumbRootKey: "menu.customer",
      }),
      permissionPath: "/happiness/refunds",
    };
  }

  if (lowerTarget.startsWith("/happiness/appeals/appealsdetails")) {
    return {
      targetPath: appendMissingQuery(normalizedTarget, {
        viewRole: "department",
        tab: "todo",
        pageTitleKey: "menu.appealsDetails",
        breadcrumbRootKey: "menu.customer",
      }),
      permissionPath: "/happiness/appeals/appealsDetails",
    };
  }

  if (lowerTarget.startsWith("/happiness/appeals")) {
    return {
      targetPath: appendMissingQuery(normalizedTarget, {
        viewRole: "department",
        tab: "todo",
        pageTitleKey: "menu.appeals",
        breadcrumbRootKey: "menu.customer",
      }),
      permissionPath: "/happiness/appeals",
    };
  }

  if (lowerTarget.startsWith("/happiness/tickets/tickets-details")) {
    return {
      targetPath: normalizedTarget,
      permissionPath: "/happiness/tickets/tickets-details",
    };
  }

  if (lowerTarget.startsWith("/happiness/tickets")) {
    return {
      targetPath: normalizedTarget,
      permissionPath: "/happiness/tickets",
    };
  }

  if (lowerTarget.startsWith("/inspection/tasks/detail")) {
    return {
      targetPath: normalizeInspectionTaskDetailTarget(normalizedTarget),
      permissionPath: "/inspection/tasks/detail",
    };
  }

  if (lowerTarget.startsWith("/inspection/tasks/execution")) {
    return {
      targetPath: normalizedTarget,
      permissionPath: "/inspection/tasks/execution",
    };
  }

  if (lowerTarget.startsWith("/inspection/tasks/report")) {
    return {
      targetPath: normalizedTarget,
      permissionPath: "/inspection/tasks/report",
    };
  }

  if (lowerTarget.startsWith("/inspection/tasks")) {
    return {
      targetPath: normalizedTarget,
      permissionPath: "/inspection/tasks",
    };
  }

  if (lowerTarget.startsWith("/inspection/violations/detail")) {
    return {
      targetPath: normalizedTarget,
      permissionPath: "/inspection/violations/detail",
    };
  }

  if (lowerTarget.startsWith("/inspection/violations")) {
    return {
      targetPath: normalizedTarget,
      permissionPath: "/inspection/violations",
    };
  }

  return {};
};

export const getFirstActionTarget = (
  actions?: Array<{ actionCode?: string | null; actionUrl?: string | null }> | null,
  department?: "license" | "content" | "inspection" | "customer"
) => {
  const openAction = (actions || []).find((action) => {
    const actionCode = String(action?.actionCode || "").toLowerCase();

    return actionCode === "open" || actionCode === "view" || actionCode === "message";
  });

  return normalizeDashboardActionTarget(openAction?.actionUrl, department);
};

export const createOpenAction = (
  target: DashboardNavigationTarget,
  labelKey = "adminDashboard.actions.open"
): DashboardTableAction | undefined =>
  target.targetPath
    ? {
        key: "open",
        labelKey,
        tone: "gold",
        targetPath: target.targetPath,
        permissionPath: target.permissionPath,
        allowedInspectionRoles: target.allowedInspectionRoles,
      }
    : undefined;
