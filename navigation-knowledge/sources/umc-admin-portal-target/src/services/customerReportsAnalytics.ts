import { nowGst, toApiDate } from "@/utils/gstTime";
import i18n from "@/localization/config";
import request from "@/utils/request";
import saveFileWithAxios from "@/utils/saveFileWithAxios";
import type {
  AnalyticsTimeFilter,
  CustomerInsightsSummaryData,
  OperationalInsightsSummaryData,
  TopCustomerRow,
  TopProfileRow,
  ServiceSatisfactionRow,
  CustomerTeamPerformanceRow,
  PaginatedResult,
  ServiceSatisfactionParams,
  TeamPerformanceParams,
  DonutChartData,
  HorizontalBarData,
  TrendChartData,
  TeamPerformanceTrendData,
  OverviewData,
} from "@/pages/CustomerReportsAnalytics/type";

const COLORS = [
  "#A0D5AB",
  "#D7BC6D",
  "#FAAAA7",
  "#C3C6CB",
  "#FAD44F",
  "#81C1FF",
  "#75DBFF",
  "#F0ABFC",
  "#F5AC7C",
];

const getColor = (index: number) => COLORS[index % COLORS.length];

type ChartItem = {
  code: string;
  labelEn: string;
  labelAr: string;
  count: number;
  percentage: number;
};

const getLabel = (item: ChartItem) =>
  i18n.resolvedLanguage === "ar" ? (item.labelAr || item.labelEn) : item.labelEn;

const buildDonutFromChartItems = (items: ChartItem[]): DonutChartData => ({
  total: items.reduce((sum, item) => sum + Number(item.count ?? 0), 0),
  legends: items.map((item, index) => ({
    label: getLabel(item),
    value: Number(item.count ?? 0),
    percentage: Number(item.percentage ?? 0),
    color: getColor(index),
  })),
});

const buildBarsFromChartItems = (items: ChartItem[], color = COLORS[0]): HorizontalBarData => ({
  color,
  items: items.map((item) => ({
    label: getLabel(item),
    value: Number(item.count ?? 0),
    percentage: Number(item.percentage ?? 0),
  })),
});

const buildGrowthTrend = (
  items: Array<{ period: string; newUsers: number; newApprovedProfiles: number }>,
): TrendChartData => ({
  categories: items.map((item) => item.period),
  series: [
    {
      name: "New Users",
      nameKey: "customerReportsAnalytics.kpi.newUsers",
      color: COLORS[0],
      values: items.map((item) => Number(item.newUsers ?? 0)),
    },
    {
      name: "Newly Approved Profiles",
      nameKey: "customerReportsAnalytics.kpi.newlyApprovedProfiles",
      color: COLORS[1],
      values: items.map((item) => Number(item.newApprovedProfiles ?? 0)),
    },
  ],
});

const buildCsatTrend = (
  items: Array<{ period: string; satisfiedRate: number; neutralRate: number; dissatisfiedRate: number }>,
): TrendChartData => ({
  categories: items.map((item) => item.period),
  series: [
    {
      name: "Satisfied (4-5)",
      nameKey: "customerReportsAnalytics.csat.satisfied45",
      color: COLORS[0],
      values: items.map((item) => Number(item.satisfiedRate ?? 0)),
    },
    {
      name: "Neutral (3)",
      nameKey: "customerReportsAnalytics.csat.neutral3",
      color: COLORS[1],
      values: items.map((item) => Number(item.neutralRate ?? 0)),
    },
    {
      name: "Dissatisfied (1-2)",
      nameKey: "customerReportsAnalytics.csat.dissatisfied12",
      color: COLORS[3],
      values: items.map((item) => Number(item.dissatisfiedRate ?? 0)),
    },
  ],
  yAxisSuffix: "%",
});

const buildOverviewData = (raw: {
  total: number;
  statusDistribution: ChartItem[];
}): OverviewData => ({
  total: Number(raw.total ?? 0),
  statusDistribution: buildDonutFromChartItems(raw.statusDistribution ?? []),
});

const buildTicketVolumeTrend = (
  items: Array<{
    period: string;
    enquiriesAndComplaints: number;
    refunds: number;
    violationAppeals: number;
    inquiry: number;
    complaint: number;
    suggestion: number;
  }>,
): TrendChartData => ({
  categories: items.map((item) => item.period),
  series: [
    {
      name: "Enquiries & Complaints",
      nameKey: "customerReportsAnalytics.charts.enquiriesAndComplaints",
      color: "#FAD44F",
      lineType: "solid",
      values: items.map((item) => Number(item.enquiriesAndComplaints ?? 0)),
    },
    {
      name: "Refunds",
      nameKey: "customerReportsAnalytics.charts.refunds",
      color: "#75DBFF",
      lineType: "solid",
      values: items.map((item) => Number(item.refunds ?? 0)),
    },
    {
      name: "Violation Appeals",
      nameKey: "customerReportsAnalytics.charts.violationAppeals",
      color: "#F0ABFC",
      lineType: "solid",
      values: items.map((item) => Number(item.violationAppeals ?? 0)),
    },
    {
      name: "Complaint",
      nameKey: "customerReportsAnalytics.charts.complaint",
      color: "#FAAAA7",
      lineType: "dashed",
      values: items.map((item) => Number(item.complaint ?? 0)),
    },
    {
      name: "Suggestion",
      nameKey: "customerReportsAnalytics.charts.suggestion",
      color: "#81C1FF",
      lineType: "dashed",
      values: items.map((item) => Number(item.suggestion ?? 0)),
    },
    {
      name: "Inquiry",
      nameKey: "customerReportsAnalytics.charts.inquiry",
      color: "#A0D5AB",
      lineType: "dashed",
      values: items.map((item) => Number(item.inquiry ?? 0)),
    },
  ],
});

const buildTeamPerfTrend = (
  items: Array<Record<string, any>>,
): TeamPerformanceTrendData => {
  const resolveAvgTime = (item: Record<string, any>): number => {
    // Object form: avgProcessingTime: { value, unit, display }
    if (item.avgProcessingTime != null && typeof item.avgProcessingTime === "object") {
      return Number(item.avgProcessingTime.value ?? 0);
    }
    // Flat form: avgProcessingTimeMinutes (convert to hours for display)
    if (item.avgProcessingTimeMinutes != null) {
      return Number(item.avgProcessingTimeMinutes) / 60;
    }
    return 0;
  };
  const resolveUnit = (item: Record<string, any>): string => {
    if (item.avgProcessingTime?.unit) return String(item.avgProcessingTime.unit);
    if (item.avgProcessingTimeMinutes != null) return "h";
    return "min";
  };
  return {
    categories: items.map((item) => String(item.label ?? item.period ?? "")),
    slaComplianceValues: items.map((item) => Number(item.slaCompliance ?? item.slaComplianceRate ?? 0)),
    avgProcessingTimeValues: items.map(resolveAvgTime),
    avgProcessingTimeUnit: items.length > 0 ? resolveUnit(items[0]) : "min",
  };
};

const resolveTimeBody = (filter?: AnalyticsTimeFilter): Record<string, unknown> => {
  if (filter?.startDate && filter?.endDate) {
    return { startDate: filter.startDate, endDate: filter.endDate };
  }
  if (filter?.days) {
    // Use the Dubai calendar date — toISOString() takes the UTC date, which is
    // yesterday during 00:00–04:00 Dubai time.
    const end = nowGst();
    const start = end.subtract(Math.max(filter.days - 1, 0), "day");
    return {
      startDate: toApiDate(start),
      endDate: toApiDate(end),
    };
  }
  return {};
};

const BASE = "/api/customer-happiness-analytics";

export const getCustomerInsightsSummary = async (
  filter: AnalyticsTimeFilter,
): Promise<CustomerInsightsSummaryData> => {
  const response = await request.post<any, any>(
    `${BASE}/customer-insights/summary`,
    resolveTimeBody(filter),
  );
  const d = response?.data ?? response ?? {};
  return {
    totalRegisteredUsers: Number(d.totalRegisteredUsers ?? 0),
    totalApprovedProfiles: Number(d.totalApprovedProfiles ?? 0),
    newUsersInRange: Number(d.newUsersInRange ?? 0),
    newApprovedProfilesInRange: Number(d.newApprovedProfilesInRange ?? 0),
    customerAgeDistribution: buildDonutFromChartItems(d.customerAgeDistribution ?? []),
    profileTypeDistribution: buildDonutFromChartItems(d.profileTypeDistribution ?? []),
    profilesByEmirate: buildBarsFromChartItems(d.profilesByEmirate ?? [], "#D7BC6D"),
    customerGrowthTrend: buildGrowthTrend(d.customerGrowthTrend ?? []),
    csat: {
      totalResponses: Number(d.csat?.totalResponses ?? 0),
      avgRating: Number(d.csat?.avgRating ?? 0),
      overallSatisfactionRate: Number(d.csat?.overallSatisfactionRate ?? 0),
      satisfiedCount: Number(d.csat?.satisfiedCount ?? 0),
      satisfiedRate: Number(d.csat?.satisfiedRate ?? 0),
      neutralCount: Number(d.csat?.neutralCount ?? 0),
      neutralRate: Number(d.csat?.neutralRate ?? 0),
      dissatisfiedCount: Number(d.csat?.dissatisfiedCount ?? 0),
      dissatisfiedRate: Number(d.csat?.dissatisfiedRate ?? 0),
      csatTrend: buildCsatTrend(d.csat?.csatTrend ?? []),
    },
  };
};

export const getTopCustomers = async (
  filter: AnalyticsTimeFilter,
): Promise<TopCustomerRow[]> => {
  const response = await request.post<any, any>(
    `${BASE}/customer-insights/top-customers`,
    resolveTimeBody(filter),
  );
  const d = response?.data ?? response ?? {};
  return (d.rows ?? []).map((row: any) => ({
    rank: Number(row.rank ?? 0),
    userId: row.userId ?? row.customerId ?? row.id,
    accountNo: String(row.accountNo ?? ""),
    fullName: String(row.fullName ?? ""),
    email: String(row.email ?? ""),
    mobileNumber: String(row.mobileNumber ?? ""),
    emirate: String(row.emirate ?? ""),
    complaintsCount: Number(row.complaintsCount ?? 0),
    refundsCount: Number(row.refundsCount ?? 0),
    appealsCount: Number(row.appealsCount ?? 0),
    total: Number(row.total ?? 0),
  }));
};

export const getTopProfiles = async (
  filter: AnalyticsTimeFilter,
): Promise<TopProfileRow[]> => {
  const response = await request.post<any, any>(
    `${BASE}/customer-insights/top-profiles`,
    resolveTimeBody(filter),
  );
  const d = response?.data ?? response ?? {};
  return (d.rows ?? []).map((row: any) => ({
    rank: Number(row.rank ?? 0),
    profileId: row.profileId ?? row.id,
    mediaFileNo: String(row.mediaFileNo ?? ""),
    isVip: Boolean(row.isVip),
    profileType: String(row.profileType ?? ""),
    profileName: String(row.profileName ?? ""),
    accountHolder: String(row.accountHolder ?? ""),
    emirate: String(row.emirate ?? ""),
    complaintsCount: Number(row.complaintsCount ?? 0),
    refundsCount: Number(row.refundsCount ?? 0),
    appealsCount: Number(row.appealsCount ?? 0),
    total: Number(row.total ?? 0),
  }));
};

export const getOperationalInsightsSummary = async (
  filter: AnalyticsTimeFilter,
): Promise<OperationalInsightsSummaryData> => {
  const response = await request.post<any, any>(
    `${BASE}/operational-insights/summary`,
    resolveTimeBody(filter),
  );
  const d = response?.data ?? response ?? {};
  const tpt = d.teamPerformanceTrend;
  const tptIsObj = tpt && !Array.isArray(tpt) && typeof tpt === "object";
  const tptKpis = tptIsObj && tpt.kpis ? tpt.kpis : null;
  const tptItems: Array<Record<string, any>> = Array.isArray(tpt)
    ? tpt
    : Array.isArray(tpt?.buckets)
    ? tpt.buckets
    : [];
  return {
    inProgressCount: Number(d.inProgressCount ?? 0),
    avgProcessingTime:
      tptKpis?.avgProcessingTime ??
      d.avgProcessingTime ??
      { value: 0, unit: "min", display: "0min" },
    slaComplianceRate: Number(tptKpis?.slaCompliance ?? d.slaComplianceRate ?? 0),
    slaBreachesCount: Number(tptKpis?.slaBreached ?? d.slaBreachesCount ?? 0),
    reopenRate: Number(d.reopenRate ?? 0),
    enquiriesOverview: buildOverviewData(d.enquiriesOverview ?? { total: 0, statusDistribution: [] }),
    refundsOverview: buildOverviewData(d.refundsOverview ?? { total: 0, statusDistribution: [] }),
    appealsOverview: buildOverviewData(d.appealsOverview ?? { total: 0, statusDistribution: [] }),
    volumeByTicketType: buildDonutFromChartItems(d.volumeByTicketType ?? []),
    volumeByEnquiryType: buildDonutFromChartItems(d.volumeByEnquiryType ?? []),
    enquiriesChannelBars: buildBarsFromChartItems(d.enquiriesChannelDistribution ?? [], "#FAAAA7"),
    ticketVolumeTrend: buildTicketVolumeTrend(d.ticketVolumeTrend ?? []),
    enquiriesChannelDistribution: buildDonutFromChartItems(d.enquiriesChannelDistribution ?? []),
    teamPerformanceTrend: buildTeamPerfTrend(tptItems),
  };
};

export const getServiceSatisfaction = async (
  params: ServiceSatisfactionParams,
): Promise<PaginatedResult<ServiceSatisfactionRow>> => {
  const body: Record<string, unknown> = {
    ...resolveTimeBody(params),
    page: params.page,
    pageSize: params.pageSize,
  };
  if (params.searchKeyword) body.searchKeyword = params.searchKeyword;
  if (params.sortBy) body.sortBy = params.sortBy;
  if (params.sortDirection) body.sortDirection = params.sortDirection;

  const response = await request.post<any, any>(
    `${BASE}/operational-insights/service-satisfaction`,
    body,
  );
  const d = response?.data ?? response ?? {};
  return {
    totalCount: Number(d.totalItems ?? d.totalCount ?? 0),
    page: Number(d.page ?? params.page),
    pageSize: Number(d.pageSize ?? params.pageSize),
    rows: (d.items ?? d.rows ?? []).map((row: any) => ({
      rank: Number(row.rank ?? 0),
      serviceId: Number(row.serviceId ?? 0),
      serviceNameEn: String(row.serviceNameEn ?? ""),
      serviceNameAr: String(row.serviceNameAr ?? ""),
      satisfactionRate: Number(row.satisfactionRate ?? 0),
      avgRating: Number(row.avgRating ?? 0),
      totalResponses: Number(row.totalResponses ?? 0),
      satisfiedCount: Number(row.satisfiedCount ?? 0),
      neutralCount: Number(row.neutralCount ?? 0),
      dissatisfiedCount: Number(row.dissatisfiedCount ?? 0),
      complaintCount: Number(row.complaintCount ?? 0),
      suggestionCount: Number(row.suggestionCount ?? 0),
      inquiryCount: Number(row.inquiryCount ?? 0),
      refundCount: Number(row.refundCount ?? 0),
      refundRate: Number(row.refundRate ?? 0),
    })),
  };
};

export const getTeamPerformance = async (
  params: TeamPerformanceParams,
): Promise<PaginatedResult<CustomerTeamPerformanceRow>> => {
  const body: Record<string, unknown> = {
    ...resolveTimeBody(params),
    page: params.page,
    pageSize: params.pageSize,
  };
  if (params.departmentId != null) body.departmentId = params.departmentId;
  if (params.searchKeyword) body.searchKeyword = params.searchKeyword;
  if (params.sortBy) body.sortBy = params.sortBy;
  if (params.sortDirection) body.sortDirection = params.sortDirection;

  const response = await request.post<any, any>(
    `${BASE}/operational-insights/team-performance`,
    body,
  );
  const d = response?.data ?? response ?? {};
  return {
    totalCount: Number(d.totalItems ?? d.totalCount ?? 0),
    page: Number(d.page ?? params.page),
    pageSize: Number(d.pageSize ?? params.pageSize),
    rows: (d.items ?? d.rows ?? []).map((row: any) => ({
      rank: Number(row.rank ?? 0),
      employeeId: String(row.employeeId ?? ""),
      employeeName: String(row.employeeName ?? ""),
      totalTasks: Number(row.totalTasks ?? 0),
      complaintsCount: Number(row.enquiries ?? 0),
      refundsCount: Number(row.refunds ?? 0),
      appealsCount: Number(row.appeals ?? 0),
      reopenRate: Number(row.reopenRate ?? 0),
      avgProcessingTime: row.avgResolveTime ?? { value: 0, unit: "min", display: "0min" },
      slaComplianceRate: Number(row.slaComplianceRate ?? 0),
      slaBreachesCount: Number(row.slaBreaches ?? 0),
    })),
  };
};

export const exportServiceSatisfaction = (filter?: AnalyticsTimeFilter) =>
  saveFileWithAxios(
    `${BASE}/operational-insights/service-satisfaction/export`,
    "service-satisfaction.csv",
    resolveTimeBody(filter),
    "post",
  );

export const exportTeamPerformance = (filter?: AnalyticsTimeFilter) =>
  saveFileWithAxios(
    `${BASE}/operational-insights/team-performance/export`,
    "team-performance.csv",
    resolveTimeBody(filter),
    "post",
  );
