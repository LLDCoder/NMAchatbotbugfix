import moment from "moment";
import request from "@/utils/request";
import saveFileWithAxios from "@/utils/saveFileWithAxios";
import type {
  AnalyticsTableParams,
  AnalyticsTimeFilter,
  LicenseAnalyticsData,
  LicenseDistributionRow,
  PaginatedTableResult,
  ProfileAnalyticsData,
  ProfileTeamRow,
  ServiceOperationsAnalyticsData,
  ServicePerformanceOption,
  ServicePerformanceRow,
  TeamPerformanceRow,
  TeamPerformanceSummary,
} from "@/pages/LicenseReportsAnalytics/type";
import {
  licenseDistributionMockRows,
  profileTeamMockRows,
  servicePerformanceMockRows,
  teamPerformanceMockRows,
  teamPerformanceSummaryMock,
} from "@/pages/LicenseReportsAnalytics/data";
import type {
  AnalyticsApiEnvelope,
  AnalyticsUserTypeStats,
  LicenseDistributionListResponse,
  LicenseStatisticsResponse,
  ProfileStatisticsResponse,
  ProfileTeamListResponse,
  ReportsAnalyticsListParams,
  ServicePerformanceListResponse,
  ServiceOperationsStatisticsResponse,
  TeamPerformanceListResponse,
} from "@/pages/LicenseReportsAnalytics/services/contracts";
import {
  licenseAnalyticsFallback,
  mapLicenseAnalyticsResponse,
  mapLicenseDistributionResponse,
  mapProfileAnalyticsResponse,
  mapProfileTeamResponse,
  mapServicePerformanceResponse,
  mapServiceOperationsAnalyticsResponse,
  mapTeamPerformanceResponse,
  profileAnalyticsFallback,
  serviceOperationsAnalyticsFallback,
} from "@/pages/LicenseReportsAnalytics/services/mappers";
import { REPORTS_ANALYTICS_ENABLE_FALLBACK } from "@/pages/LicenseReportsAnalytics/constants";

const DEFAULT_DAYS = 30;
const DEFAULT_SERVICE_PERFORMANCE_OPTION: ServicePerformanceOption =
  "AllCategories";
const DEFAULT_SERVICE_PERFORMANCE_SORT = {
  orderby: "applications",
  sort: "desc" as const,
};
const DEFAULT_TEAM_PERFORMANCE_SORT = {
  orderby: "applicationtasks",
  sort: "desc" as const,
};
const DEFAULT_PROFILE_TEAM_SORT = {
  orderby: "applicationtasks",
  sort: "desc" as const,
};
const DEFAULT_LICENSE_DISTRIBUTION_SORT = {
  orderby: "issued",
  sort: "desc" as const,
};

const paginate = <T>(
  data: T[],
  pageIndex: number,
  pageSize: number,
): PaginatedTableResult<T> => {
  const start = (pageIndex - 1) * pageSize;

  return {
    items: data.slice(start, start + pageSize),
    total: data.length,
    pageIndex,
    pageSize,
  };
};

const includesIgnoreCase = (source: string, keyword?: string) => {
  if (!keyword) {
    return true;
  }

  return source.toLowerCase().includes(keyword.toLowerCase());
};

const fallbackResponse = <T>(data: T) => Promise.resolve({ data });

const handleAnalyticsError = <T>(
  error: unknown,
  fallbackFactory: () => T,
) => {
  if (!REPORTS_ANALYTICS_ENABLE_FALLBACK) {
    throw error;
  }

  return fallbackResponse<T>(fallbackFactory());
};

const SERVICE_ORDERBY_MAP: Record<string, string> = {
  applications: "Applications",
  totalrevenue: "TotalRevenue",
  approvalrate: "ApprovalRate",
  avgprocessingtime: "AvgProcessingTime",
  avgsatisfaction: "AvgSatisfaction",
  refundapplications: "RefundApplications",
  totalrefunds: "TotalRefunds",
  refundrate: "RefundRate",
};

const TEAM_ORDERBY_MAP: Record<string, string> = {
  applicationtasks: "ApplicationTasks",
  approvedapplications: "ApprovedApplications",
  rejectedapplications: "RejectedApplications",
  approvalrate: "ApprovalRate",
  avgprocessingtime: "AvgProcessingTime",
  sla: "SLA",
};

const mapOrderby = (
  orderby: string | undefined,
  mapping?: Record<string, string>,
) => (orderby && mapping ? mapping[orderby] ?? orderby : orderby);

const resolveTimeFilterParams = (
  params?: AnalyticsTimeFilter,
  defaults?: AnalyticsTimeFilter,
) => {
  const startDate = params?.startDate ?? defaults?.startDate;
  const endDate = params?.endDate ?? defaults?.endDate;

  if (startDate && endDate) {
    const start = moment(startDate, "YYYY-MM-DD", true);
    const end = moment(endDate, "YYYY-MM-DD", true);

    return {
      startDate,
      endDate,
      days:
        start.isValid() && end.isValid() && !end.isBefore(start, "day")
          ? end.diff(start, "days") + 1
          : undefined,
    };
  }

  return {
    days: params?.days ?? defaults?.days ?? DEFAULT_DAYS,
  };
};

const toListParams = (
  params: AnalyticsTableParams,
  defaults?: Partial<ReportsAnalyticsListParams>,
): ReportsAnalyticsListParams => ({
  ...resolveTimeFilterParams(params, defaults),
  keyword: params.keyword,
  option: params.option ?? defaults?.option,
  pageIndex: params.pageIndex,
  pageSize: params.pageSize,
  orderby: params.orderby ?? defaults?.orderby,
  sort: params.sort ?? defaults?.sort,
});

const toExportParams = (
  params: Partial<ReportsAnalyticsListParams>,
): ReportsAnalyticsListParams => ({
  ...resolveTimeFilterParams(params),
  keyword: params.keyword,
  option: params.option,
  pageIndex: params.pageIndex,
  pageSize: params.pageSize,
  orderby: params.orderby,
  sort: params.sort,
});

const normalizeUserTypeStats = (
  stats?: Partial<AnalyticsUserTypeStats> | null,
): AnalyticsUserTypeStats => ({
  total: stats?.total ?? 0,
  individual: stats?.individual ?? 0,
  commercial: stats?.commercial ?? 0,
  talentAgency: stats?.talentAgency ?? 0,
  freeZone: stats?.freeZone ?? 0,
  embassy: stats?.embassy ?? 0,
  consulate: stats?.consulate ?? 0,
  culturalClubs: stats?.culturalClubs ?? 0,
  government: stats?.government ?? 0,
});

const normalizeServiceOperationsStatistics = (
  data?: Partial<ServiceOperationsStatisticsResponse> | null,
): ServiceOperationsStatisticsResponse => ({
  totalPublishServices: data?.totalPublishServices ?? 0,
  totalApplications: data?.totalApplications ?? 0,
  totalRevenue: data?.totalRevenue ?? 0,
  totalRefunds: data?.totalRefunds ?? 0,
  refundApplications: data?.refundApplications ?? 0,
  approvalRate: data?.approvalRate ?? 0,
  avgProcessingTime: data?.avgProcessingTime ?? "0m",
  avgSatisfaction: data?.avgSatisfaction ?? 0,
  statusStats: normalizeUserTypeStats(data?.statusStats),
  emirateStats: data?.emirateStats ?? [],
  trendStats: (data?.trendStats ?? []).map((item) => ({
    date: item.date,
    count: item.approvedCount ?? item.count ?? 0,
  })),
  deviceStats: data?.deviceStats ?? [],
  categoryStats: data?.categoryStats ?? [],
  typeStats: data?.typeStats ?? [],
  revenueTrendList: data?.revenueTrendList ?? [],
  applicationStatusDistribution: data?.applicationStatusDistribution ?? [],
  topEconomicActivities: data?.topEconomicActivities ?? [],
  csatAnalysis: data?.csatAnalysis,
  slaPerformance: data?.slaPerformance,
  revenueAnalytics: data?.revenueAnalytics,
});

const normalizeProfileStatistics = (
  data?: Partial<ProfileStatisticsResponse> | null,
): ProfileStatisticsResponse => ({
  statusStats: {
    ...normalizeUserTypeStats(data?.statusStats),
    types: data?.statusStats?.types ?? [],
  },
  emirateStats: data?.emirateStats ?? [],
  trendStats: (data?.trendStats ?? []).map((item) => ({
    date: item.date,
    count: item.approvedCount ?? item.count ?? 0,
  })),
  verificationStats: data?.verificationStats ?? [],
  deviceStats: data?.deviceStats ?? [],
  totalProfileApplications: data?.totalProfileApplications ?? 0,
  verifiedProfiles: data?.verifiedProfiles ?? 0,
  profileVerificationRate: data?.profileVerificationRate ?? 0,
});

const normalizeLicenseStatistics = (
  data?: Partial<LicenseStatisticsResponse> | null,
): LicenseStatisticsResponse => ({
  statusStats: {
    total: data?.statusStats?.total ?? 0,
    active: data?.statusStats?.active ?? 0,
    activePercentage: data?.statusStats?.activePercentage ?? 0,
    expiringSoon: data?.statusStats?.expiringSoon ?? 0,
    expiringSoonPercentage: data?.statusStats?.expiringSoonPercentage ?? 0,
    expired: data?.statusStats?.expired ?? 0,
    expiredPercentage: data?.statusStats?.expiredPercentage ?? 0,
    renewRate: data?.statusStats?.renewRate ?? 0,
  },
  userTypeStats: data?.userTypeStats ?? [],
  emirateStats: data?.emirateStats ?? [],
  trendStats: data?.trendStats ?? [],
});

const normalizeProfileTeamList = (
  data?: Partial<ProfileTeamListResponse> | null,
): ProfileTeamListResponse => ({
  pageIndex: data?.pageIndex ?? 1,
  pageSize: data?.pageSize ?? 10,
  total: data?.total ?? 0,
  items: data?.items ?? [],
});

const normalizeServicePerformanceList = (
  data?: Partial<ServicePerformanceListResponse> | null,
): ServicePerformanceListResponse => ({
  pageIndex: data?.pageIndex ?? 1,
  pageSize: data?.pageSize ?? 10,
  total: data?.total ?? 0,
  items: (data?.items ?? []).map((item) => ({
    serviceCategory: item?.serviceCategory ?? "",
    serviceName: item?.serviceName ?? "",
    applications: item?.applications ?? 0,
    applicationsChange: item?.applicationsChange ?? 0,
    totalRevenue: item?.totalRevenue ?? 0,
    totalRevenueChange: item?.totalRevenueChange ?? 0,
    approvalRate: item?.approvalRate ?? 0,
    approvalRateChange: item?.approvalRateChange ?? 0,
    avgProcessingTime: item?.avgProcessingTime ?? 0,
    avgProcessingTimeChange: item?.avgProcessingTimeChange ?? 0,
    avgSatisfaction: item?.avgSatisfaction ?? 0,
    avgSatisfactionChange: item?.avgSatisfactionChange ?? 0,
    refundApplications: item?.refundApplications ?? 0,
    refundApplicationsChange: item?.refundApplicationsChange ?? 0,
    totalRefunds: item?.totalRefunds ?? 0,
    totalRefundsChange: item?.totalRefundsChange ?? 0,
    refundRate: item?.refundRate ?? 0,
    refundRateChange: item?.refundRateChange ?? 0,
  })),
});

const normalizeTeamPerformanceList = (
  data?: Partial<TeamPerformanceListResponse> | null,
): TeamPerformanceListResponse => ({
  avgSLACompliance: data?.avgSLACompliance ?? 0,
  avgProcessingTime: data?.avgProcessingTime ?? 0,
  avgApprovalRate: data?.avgApprovalRate ?? 0,
  page: {
    pageIndex: data?.page?.pageIndex ?? 1,
    pageSize: data?.page?.pageSize ?? 10,
    total: data?.page?.total ?? 0,
    items: data?.page?.items ?? [],
  },
});

const normalizeLicenseDistributionList = (
  data?: Partial<LicenseDistributionListResponse> | null,
): LicenseDistributionListResponse => ({
  pageIndex: data?.pageIndex ?? 1,
  pageSize: data?.pageSize ?? 10,
  total: data?.total ?? 0,
  items: data?.items ?? [],
});

const parseDisplayNumber = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/,/g, "");
  const multiplier = normalized.endsWith("m")
    ? 1_000_000
    : normalized.endsWith("k")
      ? 1_000
      : 1;
  const numeric = Number(normalized.replace(/[^0-9.-]/g, ""));

  return Number.isFinite(numeric) ? numeric * multiplier : 0;
};

const metricValue = (value: { value: string }) => parseDisplayNumber(value.value);

const compareValues = (
  left: string | number,
  right: string | number,
  sort: AnalyticsTableParams["sort"] = "desc",
) => {
  const direction = sort === "asc" ? 1 : -1;

  if (typeof left === "string" || typeof right === "string") {
    return (
      String(left).localeCompare(String(right), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * direction
    );
  }

  return (left - right) * direction;
};

const sortRows = <T>(
  rows: T[],
  orderby: string | undefined,
  sort: AnalyticsTableParams["sort"],
  getterMap: Record<string, (item: T) => string | number>,
) => {
  const getter = orderby ? getterMap[orderby] : undefined;

  if (!getter) {
    return rows;
  }

  return [...rows].sort((left, right) =>
    compareValues(getter(left), getter(right), sort),
  );
};

const servicePerformanceSortGetters: Record<
  string,
  (item: ServicePerformanceRow) => string | number
> = {
  applications: (item) => metricValue(item.applications),
  totalrevenue: (item) => metricValue(item.totalRevenue),
  approvalrate: (item) => metricValue(item.approvalRate),
  avgprocessingtime: (item) => metricValue(item.avgProcessingTime),
  avgsatisfaction: (item) => metricValue(item.avgSatisfaction),
  refundapplications: (item) => metricValue(item.refundApplications),
  totalrefunds: (item) => metricValue(item.totalRefunds),
  refundrate: (item) => metricValue(item.refundRate),
};

const teamPerformanceSortGetters: Record<
  string,
  (item: TeamPerformanceRow) => string | number
> = {
  applicationtasks: (item) => metricValue(item.applicationTasks),
  approvedapplications: (item) => metricValue(item.approvedApplications),
  rejectedapplications: (item) => metricValue(item.rejectedApplications),
  approvalrate: (item) => metricValue(item.approvalRate),
  avgprocessingtime: (item) => metricValue(item.avgProcessingTime),
  sla: (item) => metricValue(item.sla),
};

const profileTeamSortGetters: Record<
  string,
  (item: ProfileTeamRow) => string | number
> = {
  applicationtasks: (item) => metricValue(item.applicationTasks),
  approvedapplications: (item) => metricValue(item.approvedApplications),
  rejectedapplications: (item) => metricValue(item.rejectedApplications),
  approvalrate: (item) => metricValue(item.approvalRate),
};

const licenseDistributionSortGetters: Record<
  string,
  (item: LicenseDistributionRow) => string | number
> = {
  issued: (item) => parseDisplayNumber(item.issued),
  active: (item) => parseDisplayNumber(item.active),
  expiringsoon: (item) => parseDisplayNumber(item.expiringSoon),
  expired: (item) => parseDisplayNumber(item.expired),
};

const average = (values: number[]) =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const formatAveragedValue = (value: number, suffix = "") =>
  `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;

const fallbackServiceRowsByOption = (
  option: ServicePerformanceOption | undefined,
) => {
  if (option !== "AllCategories") {
    return servicePerformanceMockRows;
  }

  return Object.values(
    servicePerformanceMockRows.reduce<Record<string, ServicePerformanceRow>>(
      (result, item, index) => {
        const existing = result[item.category];

        if (!existing) {
          result[item.category] = {
            ...item,
            id: `service-category-${index + 1}`,
            serviceName: item.category,
          };

          return result;
        }

        const nextApplications =
          metricValue(existing.applications) + metricValue(item.applications);
        const nextRevenue =
          metricValue(existing.totalRevenue) + metricValue(item.totalRevenue);
        const nextRefundApplications =
          metricValue(existing.refundApplications) +
          metricValue(item.refundApplications);
        const nextRefunds =
          metricValue(existing.totalRefunds) + metricValue(item.totalRefunds);

        result[item.category] = {
          ...existing,
          applications: {
            ...existing.applications,
            value: nextApplications.toLocaleString(),
          },
          totalRevenue: {
            ...existing.totalRevenue,
            value: nextRevenue.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          approvalRate: {
            ...existing.approvalRate,
            value: formatAveragedValue(average([
              metricValue(existing.approvalRate),
              metricValue(item.approvalRate),
            ]), "%"),
          },
          avgProcessingTime: {
            ...existing.avgProcessingTime,
            value: formatAveragedValue(average([
              metricValue(existing.avgProcessingTime),
              metricValue(item.avgProcessingTime),
            ]), "d"),
          },
          avgSatisfaction: {
            ...existing.avgSatisfaction,
            value: formatAveragedValue(average([
              metricValue(existing.avgSatisfaction),
              metricValue(item.avgSatisfaction),
            ]), "%"),
          },
          refundApplications: {
            ...existing.refundApplications,
            value: nextRefundApplications.toLocaleString(),
          },
          totalRefunds: {
            ...existing.totalRefunds,
            value: nextRefunds.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          refundRate: {
            ...existing.refundRate,
            value: formatAveragedValue(average([
              metricValue(existing.refundRate),
              metricValue(item.refundRate),
            ]), "%"),
          },
        };

        return result;
      },
      {},
    ),
  );
};

export const getServiceOperationsAnalytics = async (
  params: AnalyticsTimeFilter = {},
) => {
  try {
    const response = await request.get<
      AnalyticsApiEnvelope<ServiceOperationsStatisticsResponse>,
      AnalyticsApiEnvelope<ServiceOperationsStatisticsResponse>
    >("/api/Application/dashboard/statistics", resolveTimeFilterParams(params));

    return {
      data: mapServiceOperationsAnalyticsResponse(
        normalizeServiceOperationsStatistics(response.data),
        params,
      ),
    };
  } catch (error) {
    console.error("Failed to load service operations analytics:", error);
    return handleAnalyticsError<ServiceOperationsAnalyticsData>(
      error,
      serviceOperationsAnalyticsFallback,
    );
  }
};

export const getProfileAnalytics = async (
  params: AnalyticsTimeFilter = {},
  language = "en",
) => {
  try {
    const response = await request.get<
      AnalyticsApiEnvelope<ProfileStatisticsResponse>,
      AnalyticsApiEnvelope<ProfileStatisticsResponse>
    >(
      "/api/UserManagement/dashboard/profile/statistics",
      resolveTimeFilterParams(params),
    );

    return {
      data: mapProfileAnalyticsResponse(
        normalizeProfileStatistics(response.data),
        language,
      ),
    };
  } catch (error) {
    console.error("Failed to load profile analytics:", error);
    return handleAnalyticsError<ProfileAnalyticsData>(
      error,
      profileAnalyticsFallback,
    );
  }
};

export const getLicenseAnalytics = async (params: AnalyticsTimeFilter = {}) => {
  try {
    const response = await request.get<
      AnalyticsApiEnvelope<LicenseStatisticsResponse>,
      AnalyticsApiEnvelope<LicenseStatisticsResponse>
    >(
      "/api/LicenseManagement/dashboard/statistics",
      resolveTimeFilterParams(params),
    );

    return {
      data: mapLicenseAnalyticsResponse(
        normalizeLicenseStatistics(response.data),
      ),
    };
  } catch (error) {
    console.error("Failed to load license analytics:", error);
    return handleAnalyticsError<LicenseAnalyticsData>(
      error,
      licenseAnalyticsFallback,
    );
  }
};

export const getServicePerformance = async (params: AnalyticsTableParams) => {
  try {
    const response = await request.get<
      AnalyticsApiEnvelope<ServicePerformanceListResponse>,
      AnalyticsApiEnvelope<ServicePerformanceListResponse>
    >(
      "/api/Application/dashboard/service/list",
      {
        ...toListParams(params, {
          ...DEFAULT_SERVICE_PERFORMANCE_SORT,
          option: DEFAULT_SERVICE_PERFORMANCE_OPTION,
        }),
        orderby: mapOrderby(
          params.orderby ?? DEFAULT_SERVICE_PERFORMANCE_SORT.orderby,
          SERVICE_ORDERBY_MAP,
        ),
      },
      { skipErrorMessage: true },
    );

    return {
      data: mapServicePerformanceResponse(
        normalizeServicePerformanceList(response.data),
      ),
    };
  } catch (error) {
    console.error("Failed to load service performance analytics:", error);

    const filtered = fallbackServiceRowsByOption(params.option).filter((item) => {
      const matchesKeyword =
        includesIgnoreCase(item.serviceName, params.keyword) ||
        includesIgnoreCase(item.category, params.keyword);

      return matchesKeyword;
    });

    const sorted = sortRows(
      filtered,
      params.orderby ?? DEFAULT_SERVICE_PERFORMANCE_SORT.orderby,
      params.sort ?? DEFAULT_SERVICE_PERFORMANCE_SORT.sort,
      servicePerformanceSortGetters,
    );

    return handleAnalyticsError<PaginatedTableResult<ServicePerformanceRow>>(
      error,
      () => paginate(sorted, params.pageIndex, params.pageSize),
    );
  }
};

export const getTeamPerformance = async (params: AnalyticsTableParams) => {
  try {
    const response = await request.get<
      AnalyticsApiEnvelope<TeamPerformanceListResponse>,
      AnalyticsApiEnvelope<TeamPerformanceListResponse>
    >(
      "/api/Application/dashboard/team/list",
      {
        ...toListParams(params, DEFAULT_TEAM_PERFORMANCE_SORT),
        orderby: mapOrderby(
          params.orderby ?? DEFAULT_TEAM_PERFORMANCE_SORT.orderby,
          TEAM_ORDERBY_MAP,
        ),
      },
      { skipErrorMessage: true },
    );

    return {
      data: mapTeamPerformanceResponse(
        normalizeTeamPerformanceList(response.data),
      ),
    };
  } catch (error) {
    console.error("Failed to load team performance analytics:", error);

    const filtered = teamPerformanceMockRows.filter((item) =>
      includesIgnoreCase(item.memberName, params.keyword),
    );
    const sorted = sortRows(
      filtered,
      params.orderby ?? DEFAULT_TEAM_PERFORMANCE_SORT.orderby,
      params.sort ?? DEFAULT_TEAM_PERFORMANCE_SORT.sort,
      teamPerformanceSortGetters,
    );

    return handleAnalyticsError<{
      summary: TeamPerformanceSummary[];
      table: PaginatedTableResult<TeamPerformanceRow>;
    }>(error, () => ({
      summary: teamPerformanceSummaryMock,
      table: paginate(sorted, params.pageIndex, params.pageSize),
    }));
  }
};

export const getProfileTeamPerformance = async (params: AnalyticsTableParams) => {
  try {
    const response = await request.get<
      AnalyticsApiEnvelope<ProfileTeamListResponse>,
      AnalyticsApiEnvelope<ProfileTeamListResponse>
    >(
      "/api/UserManagement/dashboard/list",
      toListParams(params, DEFAULT_PROFILE_TEAM_SORT),
    );

    return {
      data: mapProfileTeamResponse(normalizeProfileTeamList(response.data)),
    };
  } catch (error) {
    console.error("Failed to load profile team analytics:", error);

    const filtered = profileTeamMockRows.filter((item) =>
      includesIgnoreCase(item.memberName, params.keyword),
    );
    const sorted = sortRows(
      filtered,
      params.orderby ?? DEFAULT_PROFILE_TEAM_SORT.orderby,
      params.sort ?? DEFAULT_PROFILE_TEAM_SORT.sort,
      profileTeamSortGetters,
    );

    return handleAnalyticsError<PaginatedTableResult<ProfileTeamRow>>(
      error,
      () => paginate(sorted, params.pageIndex, params.pageSize),
    );
  }
};

export const getLicenseDistributionTable = async (params: AnalyticsTableParams) => {
  try {
    const response = await request.get<
      AnalyticsApiEnvelope<LicenseDistributionListResponse>,
      AnalyticsApiEnvelope<LicenseDistributionListResponse>
    >(
      "/api/LicenseManagement/dashboard/report",
      toListParams(params, DEFAULT_LICENSE_DISTRIBUTION_SORT),
    );

    return {
      data: mapLicenseDistributionResponse(
        normalizeLicenseDistributionList(response.data),
      ),
    };
  } catch (error) {
    console.error("Failed to load license distribution analytics:", error);

    const filtered = licenseDistributionMockRows.filter((item) =>
      includesIgnoreCase(item.license, params.keyword),
    );
    const sorted = sortRows(
      filtered,
      params.orderby ?? DEFAULT_LICENSE_DISTRIBUTION_SORT.orderby,
      params.sort ?? DEFAULT_LICENSE_DISTRIBUTION_SORT.sort,
      licenseDistributionSortGetters,
    );

    return handleAnalyticsError<PaginatedTableResult<LicenseDistributionRow>>(
      error,
      () => paginate(sorted, params.pageIndex, params.pageSize),
    );
  }
};

export const exportServicePerformance = (
  params: Partial<ReportsAnalyticsListParams>,
) =>
  saveFileWithAxios(
    "/api/Application/dashboard/service/list/export",
    "service-performance-analytics.csv",
    {
      ...toExportParams(params),
      option: params.option ?? DEFAULT_SERVICE_PERFORMANCE_OPTION,
      orderby: mapOrderby(params.orderby, SERVICE_ORDERBY_MAP),
    },
  );

export const exportTeamPerformance = (
  params: Partial<ReportsAnalyticsListParams>,
) =>
  saveFileWithAxios(
    "/api/Application/dashboard/team/list/export",
    "team-performance-analytics.csv",
    {
      ...toExportParams(params),
      orderby: mapOrderby(params.orderby, TEAM_ORDERBY_MAP),
    },
  );

export const exportProfileTeamPerformance = (
  params: Partial<ReportsAnalyticsListParams>,
) =>
  saveFileWithAxios(
    "/api/UserManagement/dashboard/list/export",
    "profile-analytics.csv",
    toExportParams(params),
  );

export const exportLicenseDistributionTable = (
  params: Partial<ReportsAnalyticsListParams>,
) =>
  saveFileWithAxios(
    "/api/LicenseManagement/dashboard/report/export",
    "license-analytics.csv",
    toExportParams(params),
  );
export type MediaLicenseReportExportParams = {
  dateFrom?: string;
  dateTo?: string;
  emirate?: number;
  profileType?: number;
};
const omitEmptyValues = (params: object) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
const exportMediaLicenseReport = (
  path: string,
  fileName: string,
  params: MediaLicenseReportExportParams,
) => saveFileWithAxios(path, fileName, omitEmptyValues(params), "post");
export const exportMediaLicenseData = (params: MediaLicenseReportExportParams) =>
  exportMediaLicenseReport(
    "/api/MediaLicenseReports/LicenseData/Export",
    "license-data.csv",
    params,
  );
export const exportCancelledActivities = (
  params: Pick<
    MediaLicenseReportExportParams,
    "dateFrom" | "dateTo" | "emirate"
  >,
) =>
  exportMediaLicenseReport(
    "/api/MediaLicenseReports/CancelledActivities/Export",
    "cancelled-activities.csv",
    params,
  );
export const exportElectronicMedia = (
  params: Pick<
    MediaLicenseReportExportParams,
    "dateFrom" | "dateTo"
  >,
) =>
  exportMediaLicenseReport(
    "/api/MediaLicenseReports/ElectronicMedia/Export",
    "electronic-media.csv",
    params,
  );
