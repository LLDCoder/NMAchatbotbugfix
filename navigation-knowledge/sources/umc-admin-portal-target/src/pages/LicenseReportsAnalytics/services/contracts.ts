import type {
  AnalyticsSortOrder,
  LicenseDistributionRow,
  LicenseDistributionUserTypeKey,
  MetricCellData,
  ServicePerformanceOption,
} from "../type";

export interface AnalyticsApiEnvelope<T> {
  isSuccess: boolean;
  statusCode: number;
  message: string | null;
  data: T;
}

export interface AnalyticsUserTypeStats {
  total: number;
  individual: number;
  commercial: number;
  talentAgency: number;
  freeZone: number;
  embassy: number;
  consulate: number;
  culturalClubs: number;
  government: number;
}
export interface ProfileUserTypeStat {
  nameEn: string;
  nameAr: string;
  count: number;
}
export interface ProfileUserTypeStats extends AnalyticsUserTypeStats {
  types: ProfileUserTypeStat[];
}

export interface AnalyticsEmirateStat {
  emirate: string;
  count: number;
  percentage: number;
}

export interface AnalyticsDeviceStat {
  deviceType: string;
  count: number;
}

export interface ServiceOperationsCategoryStat {
  categoryName: string;
  count: number;
  percentage: number;
}

export interface ServiceOperationsTypeStat {
  typeName: string;
  count: number;
  percentage: number;
}

export interface DailyCountStat {
  date: string;
  count?: number;
  approvedCount?: number;
}

export interface RevenueTrendStat {
  date: string;
  serviceApplicationFees: number;
  fines?: number;
  refunds?: number;
  revenue: number;
}

export interface RevenueItem {
  id: number;
  nameEn: string;
  nameAr: string;
  amount: number;
}

export interface RevenueAnalyticsResponse {
  byActivity: RevenueItem[];
  byService: RevenueItem[];
  byApplicationType: RevenueItem[];
}

export interface SlaPerformanceTrendItem {
  period: string;
  slaComplianceRate: number;
  avgProcessingTimeDays: number;
}

export interface SlaPerformanceResponse {
  slaComplianceRate: number;
  slaBreachRate: number;
  avgProcessingTimeDays: number;
  totalCompleted: number;
  slaCompliant: number;
  slaBreached: number;
  trend: SlaPerformanceTrendItem[];
}

export interface CsatDistributionItem {
  category: string;
  count: number;
  percentage: number;
}

export interface CsatTrendItem {
  period: string;
  satisfactionRate: number;
  neutralRate: number;
  dissatisfactionRate: number;
}

export interface CsatAnalysisResponse {
  overallSatisfactionRate: number;
  avgRating: number;
  totalRatings: number;
  distribution: CsatDistributionItem[];
  trend: CsatTrendItem[];
}

export interface ApplicationStatusStat {
  statusName: string;
  count: number;
  percentage: number;
}

export interface EconomicActivityStat {
  economicActivityId: number;
  nameEn: string;
  nameAr: string;
  count: number;
}

export interface ServiceOperationsStatisticsResponse {
  totalPublishServices: number;
  totalApplications: number;
  totalRevenue: number;
  totalRefunds: number;
  refundApplications: number;
  approvalRate: number;
  avgProcessingTime: string;
  avgSatisfaction: number;
  statusStats: AnalyticsUserTypeStats;
  emirateStats: AnalyticsEmirateStat[];
  trendStats: DailyCountStat[];
  deviceStats: AnalyticsDeviceStat[];
  categoryStats: ServiceOperationsCategoryStat[];
  typeStats: ServiceOperationsTypeStat[];
  revenueTrendList: RevenueTrendStat[];
  applicationStatusDistribution?: ApplicationStatusStat[];
  topEconomicActivities?: EconomicActivityStat[];
  csatAnalysis?: CsatAnalysisResponse;
  slaPerformance?: SlaPerformanceResponse;
  revenueAnalytics?: RevenueAnalyticsResponse;
}

export interface VerificationStat {
  verificationMethod: string;
  count: number;
}

export interface ProfileStatisticsResponse {
  statusStats: ProfileUserTypeStats;
  emirateStats: AnalyticsEmirateStat[];
  trendStats: DailyCountStat[];
  verificationStats: VerificationStat[];
  deviceStats: AnalyticsDeviceStat[];
  totalProfileApplications?: number;
  verifiedProfiles?: number;
  profileVerificationRate?: number;
}

export interface LicenseStatusStats {
  total: number;
  active: number;
  activePercentage: number;
  expiringSoon: number;
  expiringSoonPercentage: number;
  expired: number;
  expiredPercentage: number;
  /** Spec §10.1 — returned by the API but previously dropped by the mapper. */
  suspended?: number;
  suspendedPercentage?: number;
  cancelled?: number;
  cancelledPercentage?: number;
  renewRate: number;
}

export interface LicenseUserTypeStat {
  userType: string;
  count: number;
  percentage: number;
}

export interface LicenseTypeCount {
  type: string;
  count: number;
}

export interface LicenseTrendStat {
  date: string;
  typeCounts: LicenseTypeCount[];
}

export interface LicenseStatisticsResponse {
  statusStats: LicenseStatusStats;
  userTypeStats: LicenseUserTypeStat[];
  emirateStats: AnalyticsEmirateStat[];
  trendStats: LicenseTrendStat[];
}

export interface ProfileTeamListItem {
  teamMember: string;
  applicationTasks: number;
  applicationTasksChange: number;
  approvedApplications: number;
  approvedApplicationsChange: number;
  rejectedApplications: number;
  rejectedApplicationsChange: number;
  approvalRate: number;
  approvalRateChange: number;
}

export interface ProfileTeamListResponse {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: ProfileTeamListItem[];
}

export interface LicenseDistributionPercentageItem {
  region?: string;
  userType?: string;
  percentage: number;
}

export interface LicenseDistributionListItem {
  license: string;
  issued: number;
  active: number;
  expiringSoon: number;
  expired: number;
  geographicDistribution: LicenseDistributionPercentageItem[];
  userTypeDistribution: LicenseDistributionPercentageItem[];
}

export interface LicenseDistributionListResponse {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: LicenseDistributionListItem[];
}

export interface ServicePerformanceListItem {
  serviceCategory: string | null;
  serviceName: string | null;
  applications: number;
  applicationsChange: number;
  totalRevenue: number;
  totalRevenueChange: number;
  approvalRate: number;
  approvalRateChange: number;
  avgProcessingTime: number | string;
  avgProcessingTimeChange: number;
  avgSatisfaction: number;
  avgSatisfactionChange: number;
  refundApplications: number;
  refundApplicationsChange: number;
  totalRefunds: number;
  totalRefundsChange: number;
  refundRate: number;
  refundRateChange: number;
}

export interface ServicePerformanceListResponse {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: ServicePerformanceListItem[];
}

export interface TeamPerformanceListItem {
  teamMember: string;
  applicationTasks: number;
  applicationTasksChange: number;
  approvedApplications: number;
  approvedApplicationsChange: number;
  rejectedApplications: number;
  rejectedApplicationsChange: number;
  approvalRate: number;
  approvalRateChange: number;
  avgProcessingTime: number | string;
  avgProcessingTimeChange: number;
  sla: number;
  slaChange: number;
  /** Completed-but-overdue task count (spec §8). */
  slaBreachesCount?: number;
  slaBreachesChange?: number;
}

export interface TeamPerformanceListResponse {
  avgSLACompliance: number;
  avgProcessingTime: number | string;
  avgApprovalRate: number;
  page: {
    pageIndex: number;
    pageSize: number;
    total: number;
    items: TeamPerformanceListItem[];
  };
}

export interface ReportsAnalyticsListParams {
  days?: number;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  option?: ServicePerformanceOption;
  pageIndex?: number;
  pageSize?: number;
  orderby?: string;
  sort?: AnalyticsSortOrder;
}

export type MetricsSummaryFallback = {
  summary: Array<{
    key: string;
    label: string;
    value: string;
    iconKey:
      | "teamSla"
      | "teamProcessing"
      | "teamApproval"
      | "members"
      | "services"
      | "applications"
      | "revenue"
      | "refundApplications"
      | "refunds"
      | "approval"
      | "satisfaction";
    valuePrefix?: string;
  }>;
};

export type DistributionRecordKey = keyof LicenseDistributionRow["geographicDistribution"];

export interface MappedDistributionRecords {
  geographicDistribution: Record<DistributionRecordKey, string>;
  userTypeDistribution: Record<LicenseDistributionUserTypeKey, string>;
}

export type MetricCellMapper = (
  value: number,
  change: number,
  options?: {
    format?: "integer" | "decimal" | "rate" | "duration";
    maximumFractionDigits?: number;
  },
) => MetricCellData;
