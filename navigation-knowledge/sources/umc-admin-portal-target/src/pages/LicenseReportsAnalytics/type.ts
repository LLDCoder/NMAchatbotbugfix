import type { Moment } from "moment";

export type MainAnalyticsTab =
  | "serviceOperations"
  | "profile"
  | "license"
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
  | `licenseReportsAnalytics.${string}`
  | `common.${string}`;

export type ServiceCategoryKey =
  | "filmContentProduction"
  | "publicationDistribution"
  | "mediaLicensing"
  | "digitalSocialMedia"
  | "videoGames"
  | "foreignMediaCorrespondents"
  | "contentReview"
  | "printingPublishing"
  | "cinemaVideoGames";

export type ApplicationTypeKey =
  | "new"
  | "renew"
  | "modify"
  | "cancel"
  | "transfer"
  | "partnerManagement";

export type DeviceKey = "web" | "mobile" | "tablet";

export type VerificationMethodKey =
  | "emiratesId"
  | "uaeUnifiedNumber"
  | "passport";

export type LicenseStatusKey =
  | "active"
  | "expiringSoon"
  | "expired"
  | "suspended"
  | "cancelled";

export type LicenseTypeKey =
  | "mediaLicense"
  | "photographyEquipmentEntryPermit"
  | "foreignCorrespondentPermit"
  | "foreignMediaOfficeLicense"
  | "newspaperMediaLicense"
  | "radioTvBroadcastingLicense"
  | "aerialPhotographyPermit"
  | "groundPhotographyPermit"
  | "pressCardLicense"
  | "marinePhotographyPermit";

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

export interface HorizontalBarItem {
  label: string;
  labelKey?: ReportsAnalyticsTranslationKey;
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

export interface MetricCellData {
  value: string;
  delta?: string;
  tone?: MetricTone;
}

export interface RevenueBreakdownData {
  topActivitiesByRevenue: HorizontalBarData;
  topServicesByRevenue: HorizontalBarData;
  revenueByApplicationType: HorizontalBarData;
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

export interface CsatOverviewData {
  overallSatisfactionRate: number;
  avgRating: number;
  totalRatings: number;
  satisfiedCount: number;
  satisfiedPct: number;
  neutralCount: number;
  neutralPct: number;
  dissatisfiedCount: number;
  dissatisfiedPct: number;
}

export interface ServiceOperationsAnalyticsData {
  summaryCards: SummaryCardData[];
  applicationStatusDonut: DonutChartData;
  topActivitiesBars: HorizontalBarData;
  categoryDonut: DonutChartData;
  typeDonut: DonutChartData;
  deviceDonut: DonutChartData;
  locationBars: HorizontalBarData;
  userTypeDonut: DonutChartData;
  csatOverview: CsatOverviewData;
  csatTrend: TrendChartData;
  teamPerformanceTrend: TeamPerformanceTrendData;
  revenueBreakdown: RevenueBreakdownData;
  revenueTrend: TrendChartData;
  serviceApplicationTrend: TrendChartData;
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
  statusDonut: DonutChartData;
  issuedTrend: TrendChartData;
  userTypeDonut: DonutChartData;
  locationBars: HorizontalBarData;
  renewalRate?: string;
}

export interface ServicePerformanceRow {
  id: string;
  category: string;
  categoryKey?: ServiceCategoryKey;
  serviceName: string;
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
}

export interface TeamPerformanceRow {
  id: string;
  memberName: string;
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
