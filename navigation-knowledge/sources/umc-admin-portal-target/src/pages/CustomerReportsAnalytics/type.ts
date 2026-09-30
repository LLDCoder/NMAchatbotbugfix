import type {
  DonutChartData,
  HorizontalBarData,
  TrendChartData,
  AnalyticsTimeFilter,
  AnalyticsSortOrder,
} from "@/pages/ContentReportsAnalytics/type";

export type { DonutChartData, HorizontalBarData, TrendChartData, AnalyticsTimeFilter, AnalyticsSortOrder };

export type CustomerMainTab = "customerInsights" | "operationalInsights";
export type CustomerTimePreset = "last7" | "last30" | "last6Months" | "lastYear" | "custom";

export interface ProcessingTimeDto {
  value: number;
  unit: string;
  display: string;
}

export interface CsatTrendPoint {
  period: string;
  satisfiedRate: number;
  neutralRate: number;
  dissatisfiedRate: number;
}

export interface CsatData {
  totalResponses: number;
  avgRating: number;
  overallSatisfactionRate: number;
  satisfiedCount: number;
  satisfiedRate: number;
  neutralCount: number;
  neutralRate: number;
  dissatisfiedCount: number;
  dissatisfiedRate: number;
  csatTrend: TrendChartData;
}

export interface CustomerInsightsSummaryData {
  totalRegisteredUsers: number;
  totalApprovedProfiles: number;
  newUsersInRange: number;
  newApprovedProfilesInRange: number;
  customerAgeDistribution: DonutChartData;
  profileTypeDistribution: DonutChartData;
  profilesByEmirate: HorizontalBarData;
  customerGrowthTrend: TrendChartData;
  csat: CsatData;
}

export interface TeamPerformanceTrendData {
  categories: string[];
  slaComplianceValues: number[];
  avgProcessingTimeValues: number[];
  avgProcessingTimeUnit: string;
}

export interface OverviewData {
  total: number;
  statusDistribution: DonutChartData;
}

export interface OperationalInsightsSummaryData {
  inProgressCount: number;
  avgProcessingTime: ProcessingTimeDto;
  slaComplianceRate: number;
  slaBreachesCount: number;
  reopenRate: number;
  enquiriesOverview: OverviewData;
  refundsOverview: OverviewData;
  appealsOverview: OverviewData;
  volumeByTicketType: DonutChartData;
  volumeByEnquiryType: DonutChartData;
  enquiriesChannelBars: HorizontalBarData;
  ticketVolumeTrend: TrendChartData;
  enquiriesChannelDistribution: DonutChartData;
  teamPerformanceTrend: TeamPerformanceTrendData;
}

export interface TopCustomerRow {
  rank: number;
  userId?: string | number;
  customerId?: string | number;
  id?: string | number;
  accountNo: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  emirate: string;
  complaintsCount: number;
  refundsCount: number;
  appealsCount: number;
  total: number;
}

export interface TopProfileRow {
  rank: number;
  profileId?: string | number;
  id?: string | number;
  mediaFileNo: string;
  isVip: boolean;
  profileType: string;
  profileName: string;
  accountHolder: string;
  emirate: string;
  complaintsCount: number;
  refundsCount: number;
  appealsCount: number;
  total: number;
}

export interface ServiceSatisfactionRow {
  rank: number;
  serviceId: number;
  serviceNameEn: string;
  serviceNameAr: string;
  satisfactionRate: number;
  avgRating: number;
  totalResponses: number;
  satisfiedCount: number;
  neutralCount: number;
  dissatisfiedCount: number;
  complaintCount: number;
  suggestionCount: number;
  inquiryCount: number;
  refundCount: number;
  refundRate: number;
}

export interface CustomerTeamPerformanceRow {
  rank: number;
  employeeId: string;
  employeeName: string;
  totalTasks: number;
  complaintsCount: number;
  refundsCount: number;
  appealsCount: number;
  reopenRate: number;
  avgProcessingTime: ProcessingTimeDto;
  slaComplianceRate: number;
  slaBreachesCount: number;
}

export interface PaginatedResult<T> {
  rows: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ServiceSatisfactionParams extends AnalyticsTimeFilter {
  searchKeyword?: string;
  sortBy?: string;
  sortDirection?: AnalyticsSortOrder;
  page: number;
  pageSize: number;
}

export interface TeamPerformanceParams extends AnalyticsTimeFilter {
  departmentId?: number;
  searchKeyword?: string;
  sortBy?: string;
  sortDirection?: AnalyticsSortOrder;
  page: number;
  pageSize: number;
}
