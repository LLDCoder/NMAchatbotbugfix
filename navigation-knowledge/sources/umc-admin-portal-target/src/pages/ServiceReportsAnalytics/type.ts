import type { Moment } from "moment";

export type MainAnalyticsTab = "serviceOperations" | "customerProfile";

export type ReportsAnalyticsTimePreset =
  | "last7"
  | "last30"
  | "last6Months"
  | "lastYear"
  | "custom";

export type ReportsAnalyticsRangeValue = [Moment | null, Moment | null] | null;

export type ReportsAnalyticsTranslationKey =
  | `serviceReportsAnalytics.${string}`
  | `common.${string}`;

export type AnalyticsSortOrder = "asc" | "desc";

export type ServiceScopeOption = "AllServices" | "AllCategories";

export type ServiceDepartmentOption =
  | "AllDepartments"
  | "LicensingDepartment"
  | "ContentDepartment"
  | "PermitServices"
  | "MediaLicensing"
  | "ContentServices"
  | "CustomerCare";

export type CustomerServiceFilterOption =
  | "AllServices"
  | "GroundPhotographyPermit"
  | "AerialPhotographyPermit"
  | "MediaLicenseRenewal"
  | "ForeignCorrespondentPermit";

export type ServiceOperationsSortKey =
  | "Applications"
  | "TotalRevenue"
  | "ApprovalRate"
  | "AvgProcessingTime"
  | "AvgSatisfaction"
  | "RefundApplications"
  | "TotalRefunds"
  | "RefundRate";

export type CustomerProfileInsightsSortKey = "Applications";

export type StatIconKey =
  | "services"
  | "applications"
  | "revenue"
  | "approval"
  | "processing"
  | "satisfaction"
  | "refundApplications"
  | "refunds";

export type MetricTone = "positive" | "negative" | "neutral";

export interface TabOption<T extends string = string> {
  key: T;
  label: string;
}

export interface SelectOption<T extends string = string> {
  label: string;
  value: T;
}

export interface TimePresetOption<T extends string = string> {
  key: T;
  label: string;
  days?: number;
}

export interface SummaryCardData {
  key: string;
  value: number;
  iconKey: StatIconKey;
  valuePrefix?: string;
  titleKey?: ReportsAnalyticsTranslationKey;
}

export interface MetricCellData {
  value: string;
  delta?: string;
  tone?: MetricTone;
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

export interface TrendSeries {
  name: string;
  nameKey?: ReportsAnalyticsTranslationKey;
  color: string;
  values: number[];
  areaColor?: string;
}

export interface TrendChartData {
  categories: string[];
  series: TrendSeries[];
  yAxisSuffix?: string;
  yAxisMin?: number;
  yAxisMax?: number;
  yAxisInterval?: number;
}

export interface ServiceOperationsAnalyticsData {
  summaryCards: SummaryCardData[];
  revenueTrend: TrendChartData;
  serviceApplicationTrend: TrendChartData;
}

export interface CustomerProfileInsightsData {
  deviceDistribution: DonutChartData;
  userTypeDistribution: DonutChartData;
}

export interface ServiceOperationsRow {
  id: string;
  serviceName: string;
  serviceCategory: string;
  department: ServiceDepartmentOption;
  applications: MetricCellData;
  totalRevenue: MetricCellData;
  approvalRate: MetricCellData;
  avgProcessingTime: MetricCellData;
  avgSatisfaction: MetricCellData;
  refundApplications: MetricCellData;
  totalRefunds: MetricCellData;
  refundRate: MetricCellData;
}

export type GeographicDistributionKey =
  | "dubai"
  | "abuDhabi"
  | "sharjah"
  | "ajman"
  | "rak"
  | "fujairah"
  | "uaq"
  | "foreign";

export type UserTypeDistributionKey =
  | "individual"
  | "commercial"
  | "government"
  | "freeZone"
  | "talentAgency"
  | "embassy"
  | "consulate"
  | "culturalClubs";

export interface CustomerProfileInsightsRow {
  id: string;
  serviceName: string;
  serviceCategory: string;
  serviceFilter: CustomerServiceFilterOption;
  applications: MetricCellData;
  geographicDistribution: Record<GeographicDistributionKey, string>;
  userTypeDistribution: Record<UserTypeDistributionKey, string>;
}

export interface PaginatedTableResult<T> {
  items: T[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

export interface AnalyticsTimeFilter {
  days?: number;
  startDate?: string;
  endDate?: string;
}

export interface AnalyticsTableParams extends AnalyticsTimeFilter {
  keyword?: string;
  pageIndex: number;
  pageSize: number;
  orderby?: string;
  sort?: AnalyticsSortOrder;
}

export interface ServiceOperationsTableParams extends AnalyticsTableParams {
  option?: ServiceScopeOption;
  department?: ServiceDepartmentOption;
}

export interface CustomerProfileInsightsTableParams extends AnalyticsTableParams {
  option?: ServiceScopeOption;
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
