import moment from "moment";
import { nowGst } from "@/utils/gstTime";
import request from "@/utils/request";
import saveFileWithAxios from "@/utils/saveFileWithAxios";
import type { AnalyticsTimeFilter, TeamPerformanceRow } from "../types";

type ApiEnvelope<T> = {
  code?: number;
  data?: T | null;
  isSuccess?: boolean;
  message?: string;
};

type TeamPerformanceRowDto = {
  inspectorId?: string | number | null;
  teamMember?: string | null;
  inspectionTasks?: number | string | null;
  accessSuccessfulRate?: number | string | null;
  violationsFound?: number | string | null;
  avgProcessingTimeMinutes?: number | string | null;
  slaCompliance?: number | string | null;
  slaBreaches?: number | string | null;
};

type TeamPerformancePageDto = {
  rows?: TeamPerformanceRowDto[] | null;
  totalCount?: number | string | null;
  pageIndex?: number | string | null;
  pageSize?: number | string | null;
};

export type TeamPerformancePage = {
  rows: TeamPerformanceRow[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
};

export type TeamPerformanceSortField =
  | "InspectionTasks"
  | "AccessSuccessfulRate"
  | "ViolationsFound"
  | "AvgProcessingTimeMinutes"
  | "SlaCompliance"
  | "SlaBreaches"
  | "TeamMember";

export type TeamPerformanceQueryOptions = {
  search?: string;
  pageIndex?: number;
  pageSize?: number;
  sortField?: TeamPerformanceSortField;
  sortOrder?: "asc" | "desc";
};

export type EmirateBreakdownQueryOptions = {
  search?: string;
};

export type InspectionReportExportParams = {
  dateFrom?: string;
  dateTo?: string;
  emirate?: number;
  violationType?: number;
  violationStatus?: number;
};

const omitUndefined = (params: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

const exportInspectionReport = (
  path: string,
  fileName: string,
  params: Record<string, unknown>,
) => saveFileWithAxios(path, fileName, omitUndefined(params), "post");

export const exportInspectionTasks = (params: InspectionReportExportParams) =>
  exportInspectionReport(
    "/api/InspectionReports/Tasks/Export",
    "inspection-tasks.csv",
    { dateFrom: params.dateFrom, dateTo: params.dateTo, emirate: params.emirate },
  );

export const exportInspectionViolations = (params: InspectionReportExportParams) =>
  exportInspectionReport(
    "/api/InspectionReports/Violations/Export",
    "inspection-violations.csv",
    {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      emirate: params.emirate,
      violationType: params.violationType,
      violationStatus: params.violationStatus,
    },
  );

export const exportInspectionExpiredLicenses = (params: InspectionReportExportParams) =>
  exportInspectionReport(
    "/api/InspectionReports/ExpiredLicenses/Export",
    "inspection-expired-licenses.csv",
    { dateFrom: params.dateFrom, dateTo: params.dateTo, emirate: params.emirate },
  );

type ReportsAnalyticsQuery = {
  StartDate: string;
  EndDate: string;
  Search?: string;
  PageIndex?: number;
  PageSize?: number;
  SortField?: TeamPerformanceSortField;
  SortOrder?: "asc" | "desc";
};

export type DistributionItemDto = {
  code?: string | null;
  label?: string | null;
  count?: number | string | null;
  percentage?: number | string | null;
};

export type StatusDistributionItemDto = DistributionItemDto;

export type TrendBucketDto = {
  bucketStart?: string | null;
  bucketEnd?: string | null;
  label?: string | null;
  count?: number | string | null;
  inspectionCount?: number | string | null;
  violationCount?: number | string | null;
  contentViolationCount?: number | string | null;
  licenseViolationCount?: number | string | null;
  appealCount?: number | string | null;
  amount?: number | string | null;
  licenseFineAmount?: number | string | null;
  contentFineAmount?: number | string | null;
  totalFineAmount?: number | string | null;
};

export type EmirateMetricDto = {
  emirateId?: number | string | null;
  emirateName?: string | null;
  count?: number | string | null;
  amount?: number | string | null;
};

export type ViolationHeatmapRowDto = {
  emirateId?: number | string | null;
  emirateName?: string | null;
  counts?: Array<number | string | null> | null;
  total?: number | string | null;
};

export type ViolationsByEmirateDto = {
  violationItemCodes?: string[] | null;
  rows?: ViolationHeatmapRowDto[] | null;
};

export type EmirateTrendByEmirateDto = {
  emirateId?: number | string | null;
  emirateName?: string | null;
  points?: TrendBucketDto[] | null;
};

export type SummaryDistributionDto = {
  total?: number | string | null;
  items?: DistributionItemDto[] | null;
};

export type FineCollectionDto = {
  totalReceivable?: number | string | null;
  paid?: number | string | null;
  outstanding?: number | string | null;
  collectionRate?: number | string | null;
};

export type PenaltyByViolationDegreeItemDto = {
  degree?: number | string | null;
  label?: string | null;
  count?: number | string | null;
  percentage?: number | string | null;
};

export type PenaltiesByViolationDegreeDto = {
  total?: number | string | null;
  items?: PenaltyByViolationDegreeItemDto[] | null;
};

export type TeamPerformanceTrendBucketDto = {
  bucketStart?: string | null;
  bucketEnd?: string | null;
  label?: string | null;
  slaCompliance?: number | string | null;
  avgProcessingTimeMinutes?: number | string | null;
  avgProcessingTimeDisplay?: string | null;
};

export type TeamPerformanceTrendDto = {
  kpis?: {
    slaCompliance?: number | string | null;
    slaBreached?: number | string | null;
    avgProcessingTimeMinutes?: number | string | null;
    avgProcessingTimeDisplay?: string | null;
  } | null;
  buckets?: TeamPerformanceTrendBucketDto[] | null;
};

export type RepeatViolatorDto = {
  rank?: number | string | null;
  profileName?: string | null;
  violationCount?: number | string | null;
};

export type TopRepeatViolatorsDto = {
  items?: RepeatViolatorDto[] | null;
};

export type OperationalInsightsDto = {
  kpis?: {
    totalInspections?: number | string | null;
    violationsFound?: number | string | null;
    fineCollected?: number | string | null;
    refund?: number | string | null;
    appeals?: number | string | null;
  } | null;
  inspectionStatusDistribution?: StatusDistributionItemDto[] | null;
  violationStatusDistribution?: StatusDistributionItemDto[] | null;
  inspectionViolationTrend?: TrendBucketDto[] | null;
  fineTrendByCategory?: TrendBucketDto[] | null;
  appealsTrend?: TrendBucketDto[] | null;
  refundTrend?: TrendBucketDto[] | null;
  emirateTrends?: EmirateMetricDto[] | null;
  licenseViolationsByEmirate?: ViolationsByEmirateDto | null;
  contentViolationsByEmirate?: ViolationsByEmirateDto | null;
  inspectionTrendByEmirate?: EmirateTrendByEmirateDto[] | null;
  violationTrendByEmirate?: EmirateTrendByEmirateDto[] | null;
  fineTrendByEmirate?: EmirateTrendByEmirateDto[] | null;
  fineCollection?: FineCollectionDto | null;
  appealOutcomes?: SummaryDistributionDto | null;
  penaltiesByViolationDegree?: PenaltiesByViolationDegreeDto | null;
  teamPerformanceTrend?: TeamPerformanceTrendDto | null;
  topRepeatViolators?: TopRepeatViolatorsDto | null;
};

export type RiskBandBySourceRowDto = {
  riskBand?: string | null;
  total?: number | string | null;
  aiGenerated?: number | string | null;
  officerInitiated?: number | string | null;
  aiPercentage?: number | string | null;
  officerPercentage?: number | string | null;
};

export type RiskBandByEmirateRowDto = {
  emirateId?: number | string | null;
  emirateName?: string | null;
  total?: number | string | null;
  critical?: number | string | null;
  high?: number | string | null;
  medium?: number | string | null;
  low?: number | string | null;
};

export type HighRiskProfileDto = {
  rank?: number | string | null;
  profileName?: string | null;
  emirate?: string | null;
  triggeredFactors?: string[] | null;
  riskLevel?: string | null;
  riskScore?: number | string | null;
};

export type RiskInsightsDto = {
  kpis?: {
    totalRiskTasks?: number | string | null;
    confirmedAiFindings?: number | string | null;
    highCriticalRiskTasks?: number | string | null;
    highRiskProfiles?: number | string | null;
    avgRiskScore?: number | string | null;
  } | null;
  topRiskDrivenReasons?: DistributionItemDto[] | null;
  aiHitRate?: {
    completed?: number | string | null;
    hits?: number | string | null;
    hitRate?: number | string | null;
  } | null;
  taskSource?: {
    aiGenerated?: number | string | null;
    officerInitiated?: number | string | null;
    total?: number | string | null;
    autoTriageRate?: number | string | null;
    tasksPerDay?: number | string | null;
  } | null;
  riskBandDistribution?: DistributionItemDto[] | null;
  riskBandBySource?: RiskBandBySourceRowDto[] | null;
  riskBandByEmirate?: RiskBandByEmirateRowDto[] | null;
  topRiskFactors?: DistributionItemDto[] | null;
  topHighRiskProfiles?: HighRiskProfileDto[] | null;
};

export type EmirateBreakdownRowDto = {
  emirateId?: number | string | null;
  emirateName?: string | null;
  inspections?: number | string | null;
  violations?: number | string | null;
  contentViolations?: number | string | null;
  licenseViolations?: number | string | null;
  violationRate?: number | string | null;
  fines?: number | string | null;
  collectedRate?: number | string | null;
};

export type EmirateBreakdownDto = {
  rows?: EmirateBreakdownRowDto[] | null;
};

const DEFAULT_TEAM_PAGE_SIZE = 10;
const DEFAULT_DAYS = 30;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const parsed = moment(value, "YYYY-MM-DD", true);
  return parsed.isValid() ? parsed : null;
};

const searchParam = (search?: string) => {
  const value = search?.trim();
  return value ? { Search: value } : {};
};

const createReportsAnalyticsQuery = (
  filter: AnalyticsTimeFilter = {},
): ReportsAnalyticsQuery => {
  const selectedStart = parseDate(filter.startDate);
  const selectedEnd = parseDate(filter.endDate);

  // Custom range: send exactly what the user picked, the way Content Reports does.
  // The end date used to gain a day here, so a 31 Jul selection reached the backend
  // as 1 Aug and every custom report pulled in a day the user never chose.
  if (selectedStart && selectedEnd) {
    return {
      StartDate: selectedStart.format("YYYY-MM-DD"),
      EndDate: selectedEnd.format("YYYY-MM-DD"),
    };
  }

  // Preset: this API needs explicit dates, so derive the window from `days` ending
  // today (inclusive). "Last 7 days" means today plus the six days before it, so with
  // both ends inclusive the window spans `days` calendar days only when we step back
  // days - 1. Subtracting the full `days` reached back one extra day (a 7-day preset
  // started on the 12th instead of the 13th).
  const days = filter.days || DEFAULT_DAYS;
  const endDate = nowGst().startOf("day");
  const startDate = endDate.clone().subtract(days - 1, "days");
  return {
    StartDate: startDate.format("YYYY-MM-DD"),
    EndDate: endDate.format("YYYY-MM-DD"),
  };
};

const createTeamPerformanceQuery = (
  filter: AnalyticsTimeFilter,
  options: TeamPerformanceQueryOptions,
): ReportsAnalyticsQuery => ({
  ...createReportsAnalyticsQuery(filter),
  ...searchParam(options.search),
  PageIndex: Math.max(1, options.pageIndex || 1),
  PageSize: Math.max(1, options.pageSize || DEFAULT_TEAM_PAGE_SIZE),
  SortField: options.sortField || "InspectionTasks",
  SortOrder: options.sortOrder || "desc",
});

const createTeamPerformanceExportQuery = (
  filter: AnalyticsTimeFilter,
  options: TeamPerformanceQueryOptions,
): ReportsAnalyticsQuery => ({
  ...createReportsAnalyticsQuery(filter),
  ...searchParam(options.search),
  SortField: options.sortField || "InspectionTasks",
  SortOrder: options.sortOrder || "desc",
});

const unwrapResponse = <T,>(response: ApiEnvelope<T> | T): T => {
  if (response && typeof response === "object" && "data" in response) {
    const envelope = response as ApiEnvelope<T>;
    if (envelope.isSuccess === false) {
      throw new Error(envelope.message || "Request failed");
    }
    return (envelope.data || {}) as T;
  }

  return response as T;
};

const mapTeamPerformanceRow = (
  row: TeamPerformanceRowDto,
): TeamPerformanceRow => ({
  id: String(row.inspectorId ?? "team-member"),
  teamMember: row.teamMember || "Unknown",
  inspectionTasks: toNumber(row.inspectionTasks),
  accessSuccessfulRate: toNumber(row.accessSuccessfulRate),
  violationsFound: toNumber(row.violationsFound),
  avgProcessingHours: toNumber(row.avgProcessingTimeMinutes) / 60,
  slaCompliance: toNumber(row.slaCompliance),
  slaBreaches: toNumber(row.slaBreaches),
});

export const getTeamPerformancePage = async (
  filter: AnalyticsTimeFilter = {},
  options: TeamPerformanceQueryOptions = {},
): Promise<TeamPerformancePage> => {
  const response = await request.get<
    ApiEnvelope<TeamPerformancePageDto>,
    ApiEnvelope<TeamPerformancePageDto>
  >(
    "/api/inspection/reportsAnalytics/teamPerformance",
    createTeamPerformanceQuery(filter, options),
    { skipErrorMessage: true },
  );

  const data = unwrapResponse<TeamPerformancePageDto>(response);
  const rows = (data.rows || []).map(mapTeamPerformanceRow);
  return {
    rows,
    totalCount: toNumber(data.totalCount, rows.length),
    pageIndex: toNumber(data.pageIndex, options.pageIndex || 1),
    pageSize: toNumber(data.pageSize, options.pageSize || DEFAULT_TEAM_PAGE_SIZE),
  };
};

export const getOperationalInsights = async (
  filter: AnalyticsTimeFilter = {},
): Promise<OperationalInsightsDto> => {
  const response = await request.get<
    ApiEnvelope<OperationalInsightsDto>,
    ApiEnvelope<OperationalInsightsDto>
  >(
    "/api/inspection/reportsAnalytics/operationalInsights",
    createReportsAnalyticsQuery(filter),
    { skipErrorMessage: true },
  );

  return unwrapResponse<OperationalInsightsDto>(response);
};

export const getRiskInsights = async (
  filter: AnalyticsTimeFilter = {},
): Promise<RiskInsightsDto> => {
  const response = await request.get<ApiEnvelope<RiskInsightsDto>, ApiEnvelope<RiskInsightsDto>>(
    "/api/inspection/reportsAnalytics/riskInsights",
    createReportsAnalyticsQuery(filter),
    { skipErrorMessage: true },
  );

  return unwrapResponse<RiskInsightsDto>(response);
};

export const getEmirateBreakdown = async (
  filter: AnalyticsTimeFilter = {},
  options: EmirateBreakdownQueryOptions = {},
): Promise<EmirateBreakdownDto> => {
  const response = await request.get<
    ApiEnvelope<EmirateBreakdownDto>,
    ApiEnvelope<EmirateBreakdownDto>
  >(
    "/api/inspection/reportsAnalytics/breakdownByEmirate",
    { ...createReportsAnalyticsQuery(filter), ...searchParam(options.search) },
    { skipErrorMessage: true },
  );

  return unwrapResponse<EmirateBreakdownDto>(response);
};

export const exportEmirateBreakdown = (
  filter: AnalyticsTimeFilter = {},
  options: EmirateBreakdownQueryOptions = {},
) =>
  request.get<Blob, Blob>(
    "/api/inspection/reportsAnalytics/breakdownByEmirate/export",
    { ...createReportsAnalyticsQuery(filter), ...searchParam(options.search) },
    { responseType: "blob" },
  );

export const exportTeamPerformance = (
  filter: AnalyticsTimeFilter = {},
  options: TeamPerformanceQueryOptions = {},
) =>
  request.get<Blob, Blob>(
    "/api/inspection/reportsAnalytics/teamPerformance/export",
    createTeamPerformanceExportQuery(filter, options),
    { responseType: "blob" },
  );
