import type { Moment } from "moment";

export type MainAnalyticsTab =
  | "serviceOperations"
  | "permit"
  | "content"
  | "reports";

export type OperationsAnalyticsTab = "servicePerformance" | "teamPerformance";
export type ServicePerformanceOption = "AllServices" | "AllCategories";
export type ReportsAnalyticsTimePreset =
  | "last7"
  | "last30"
  | "last6Months"
  | "lastYear"
  | "custom";
export type ReportsAnalyticsRangeValue = [Moment | null, Moment | null] | null;

export type ReportsAnalyticsTranslationKey =
  | `contentReportsAnalytics.${string}`
  | `customerReportsAnalytics.${string}`
  | `common.${string}`
  | `options.${string}`;

export type StatIconKey =
  | "services"
  | "applications"
  | "revenue"
  | "refundApplications"
  | "refunds"
  | "approval"
  | "satisfaction"
  | "avgProcessingTime"
  | "teamSla"
  | "teamProcessing"
  | "teamApproval"
  | "members";

export type MetricTone = "positive" | "negative" | "neutral";

export interface TabOption<T extends string = string> {
  key: T;
  label: string;
  translationKey?: ReportsAnalyticsTranslationKey;
}

export interface SelectOption<T extends string = string> {
  label: string;
  value: T;
  translationKey?: ReportsAnalyticsTranslationKey;
}

export interface TimePresetOption<T extends string = string> {
  key: T;
  label: string;
  days?: number;
  translationKey?: ReportsAnalyticsTranslationKey;
}

export interface SummaryCardData {
  key: string;
  value: string;
  iconKey: StatIconKey;
  valuePrefix?: string;
  titleKey?: ReportsAnalyticsTranslationKey;
}

export interface DonutLegendItem {
  label: string;
  labelKey?: ReportsAnalyticsTranslationKey;
  value: number;
  percentage: number;
  color: string;
}

export interface DonutChartData {
  total: number;
  legends: DonutLegendItem[];
}

export interface AiRecommendationOverviewData {
  total: number;
  legends: DonutLegendItem[];
  adoptionRate: number;
  adoptionRateLabelKey?: ReportsAnalyticsTranslationKey;
}

export interface HorizontalBarItem {
  label: string;
  labelKey?: ReportsAnalyticsTranslationKey;
  labelAr?: string;
  value: number;
  percentage: number;
}

export interface HorizontalBarData {
  color: string;
  items: HorizontalBarItem[];
}

export interface TrendSeries {
  name: string;
  nameKey?: ReportsAnalyticsTranslationKey;
  color: string;
  lineType?: "solid" | "dashed";
  values: number[];
  areaColor?: string | object;
}

export interface TrendChartData {
  categories: string[];
  series: TrendSeries[];
  yAxisSuffix?: string;
  yAxisMin?: number;
  yAxisMax?: number;
  yAxisInterval?: number;
}

export interface MetricCellData {
  value: string;
  delta?: string;
  tone?: MetricTone;
}

export interface CsatOverviewData {
  overallRate: number;
  avgRating: number;
  totalRatings: number;
  distribution: DonutChartData;
}

export interface TeamPerformanceTrendItem {
  period: string;
  slaComplianceRate: number;
  avgProcessingTimeDays: number;
}

export interface TeamPerformanceTrendData {
  slaComplianceRate: number;
  slaBreached: number;
  avgProcessingTime: string;
  trend: TeamPerformanceTrendItem[];
}

export interface ServiceOperationsAnalyticsData {
  summaryCards: SummaryCardData[];
  applicationStatusOverview: DonutChartData;
  aiRecommendationOverview: AiRecommendationOverviewData;
  aiTagsBreakdown: DonutChartData;
  applicationsByMediaType: DonutChartData;
  applicationsByUserType: DonutChartData;
  applicationsByServiceCategory: DonutChartData;
  applicationsByEmirate: HorizontalBarData;
  applicationsByDevice: DonutChartData;
  confirmationMethodBreakdown: DonutChartData;
  csatOverview: CsatOverviewData;
  csatTrend: TrendChartData;
  teamPerformanceTrend: TeamPerformanceTrendData;
  revenueTrend: TrendChartData;
  serviceApplicationTrend: TrendChartData;
}

export interface PermitAnalyticsData {
  summaryCards: SummaryCardData[];
  statusDonut: DonutChartData;
  /* Pie per Figma node 44500:68125 - was a horizontal bars card. */
  userTypeDonut: DonutChartData;
  locationBars: HorizontalBarData;
}

export interface ContentLibraryAnalyticsData {
  summaryCards: SummaryCardData[];
  statusDonut: DonutChartData;
  regulateEntryStatusDonut: DonutChartData;
  typeDonut: DonutChartData;
  approvedTrend: TrendChartData;
  publicationCategories: HorizontalBarData;
}

export interface ProfileAnalyticsData {
  summaryCards: SummaryCardData[];
  userTypeDonut: DonutChartData;
  profileApplicationTrend: TrendChartData;
  locationBars: HorizontalBarData;
  verificationMethodDonut: DonutChartData;
  deviceDonut: DonutChartData;
}

export interface LicenseAnalyticsData {
  summaryCards: SummaryCardData[];
  statusDonut: DonutChartData;
  issuedTrend: TrendChartData;
  userTypeBars: HorizontalBarData;
  locationBars: HorizontalBarData;
  renewalRate?: string;
}

export interface ServicePerformanceRow {
  id: string;
  serviceName: string;
  serviceCategory?: string | null;
  applications: MetricCellData;
  totalRevenue: MetricCellData;
  approvalRate: MetricCellData;
  avgProcessingTime: MetricCellData;
  avgSatisfaction: MetricCellData;
  refundApplications: MetricCellData;
  totalRefunds: MetricCellData;
  refundRate: MetricCellData;
}

export interface TeamPerformanceSummary {
  key: string;
  value: string;
  iconKey: StatIconKey;
  valuePrefix?: string;
  titleKey?: ReportsAnalyticsTranslationKey;
}

export interface TeamPerformanceRow {
  id: string;
  teamMember: string;
  applicationTasks: MetricCellData;
  approvedApplications: MetricCellData;
  rejectedApplications: MetricCellData;
  approvalRate: MetricCellData;
  avgProcessingTime: MetricCellData;
  sla: MetricCellData;
  /** Completed-but-overdue tasks in range (spec §8), from slaBreachesCount. */
  slaBreaches: MetricCellData;
}

export interface ProfileTeamRow {
  id: string;
  memberName: string;
  applicationTasks: MetricCellData;
  approvedApplications: MetricCellData;
  rejectedApplications: MetricCellData;
  approvalRate: MetricCellData;
}

export type LicenseDistributionRegionKey =
  | "dubai"
  | "abuDhabi"
  | "sharjah"
  | "ajman"
  | "rak"
  | "fujairah"
  | "uaq"
  | "foreign";

export type LicenseDistributionUserTypeKey =
  | "commercial"
  | "individual"
  | "establishment"
  | "government"
  | "freeZone"
  | "talentAgency"
  | "embassy"
  | "consulate"
  | "culturalClubs";

export interface LicenseDistributionRow {
  id: string;
  license: string;
  issued: string;
  active: string;
  expiringSoon: string;
  expired: string;
  geographicDistribution: Record<LicenseDistributionRegionKey, string>;
  userTypeDistribution: Record<LicenseDistributionUserTypeKey, string>;
}

export interface PermitDistributionItem {
  label: string;
  percentage: number;
}

export interface PermitRow {
  id: string;
  license: string;
  issued: number;
  active: number;
  expiringSoon: number;
  expired: number;
  geographicDistribution: PermitDistributionItem[];
  userTypeDistribution: PermitDistributionItem[];
}

export interface ContentLibraryRow {
  id: string;
  contentCategory: string;
  libraryItems: MetricCellData;
  approved: MetricCellData;
  rejected: MetricCellData;
  approvedRate: MetricCellData;
  applications: MetricCellData;
  local: MetricCellData;
  import: MetricCellData;
}

export interface PaginatedTableResult<T> {
  items: T[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

export type AnalyticsSortOrder = "asc" | "desc";

export interface AnalyticsTimeFilter {
  days?: number;
  startDate?: string;
  endDate?: string;
}

export interface AnalyticsTableParams extends AnalyticsTimeFilter {
  keyword?: string;
  option?: ServicePerformanceOption;
  pageIndex: number;
  pageSize: number;
  orderby?: string;
  sort?: AnalyticsSortOrder;
}

export interface AnalyticsTableChange {
  pageIndex: number;
  pageSize: number;
  action?: "paginate" | "sort" | "filter";
  sortKey?: string;
  sort?: AnalyticsSortOrder;
}

export interface AnalyticsResponse<T> {
  data: T;
}
