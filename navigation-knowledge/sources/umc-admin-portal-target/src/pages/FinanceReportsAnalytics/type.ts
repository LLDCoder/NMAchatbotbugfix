import type { Moment } from "moment";

export type FinanceReportsTranslationKey =
  | `financeReportsAnalytics.${string}`
  | `common.${string}`;

export type FinanceReportsTimePreset =
  | "last7"
  | "last30"
  | "last6Months"
  | "lastYear"
  | "custom";

export type FinanceReportsRangeValue = [Moment, Moment] | null;

export interface FinanceReportsTimeFilter {
  days?: number;
  startDate?: string;
  endDate?: string;
}

export type SummaryIconKey =
  | "totalRevenue"
  | "totalPayments"
  | "totalRecharges"
  | "totalRefunds";

export interface SummaryCardData {
  key: string;
  displayValue: string;
  iconKey: SummaryIconKey;
  titleKey: FinanceReportsTranslationKey;
}

export interface TrendSeries {
  name: string;
  nameKey?: FinanceReportsTranslationKey;
  color: string;
  values: number[];
  areaColor?: string;
}

export interface TrendChartData {
  categories: string[];
  series: TrendSeries[];
  yAxisMin?: number;
  yAxisMax?: number;
  yAxisInterval?: number;
  yAxisSuffix?: string;
}

export interface BarChartItem {
  name: string;
  nameKey?: FinanceReportsTranslationKey;
  value: number;
  displayValue: string;
  color: string;
}

export interface BarChartData {
  items: BarChartItem[];
  yAxisMin?: number;
  yAxisMax?: number;
  yAxisInterval?: number;
  yAxisSuffix?: string;
}

export interface DonutLegendItem {
  label: string;
  labelKey?: FinanceReportsTranslationKey;
  value: number;
  valueLabel: string;
  percentageLabel: string;
  color: string;
}

export interface DonutChartData {
  total: number;
  totalLabel: string;
  legends: DonutLegendItem[];
}

export interface CardHeaderMetric {
  label: string;
  labelKey?: FinanceReportsTranslationKey;
  value: string;
  dotColor: string;
}

export interface FinanceReportsOverviewData {
  summaryCards: SummaryCardData[];
  revenueTrend: TrendChartData;
  revenueBreakdown: BarChartData;
  paymentsByType: DonutChartData;
  paymentsByTypeMetric: CardHeaderMetric;
  paymentMethodDistribution: DonutChartData;
  rechargeBreakdown: TrendChartData;
  rechargeCount: DonutChartData;
  refundAmountByCategory: DonutChartData;
  refundTypeDistribution: DonutChartData;
}

export type FinanceLocationKey =
  | "dubai"
  | "abuDhabi"
  | "sharjah"
  | "ajman"
  | "rasAlKhaimah"
  | "fujairah"
  | "ummAlQuwain";

export type FinanceUserTypeKey =
  | "individual"
  | "commercial"
  | "government"
  | "freeZone"
  | "embassy"
  | "consulate"
  | "culturalClubs"
  | "talentAgency";

export interface EmirateTableRow {
  id: string;
  /** `null` when the API label matches none of the known emirates. */
  locationKey: FinanceLocationKey | null;
  location?: string;
  totalRevenue: string;
  totalRevenueValue: number;
  transactionCount: string;
  rechargeCount: string;
  refundCount: string;
  refundRate: string;
}

export interface UserTypeTableRow {
  id: string;
  /** `null` when the API label matches none of the known user types. */
  userTypeKey: FinanceUserTypeKey | null;
  userType?: string;
  totalRevenue: string;
  totalRevenueValue: number;
  transactionCount: string;
  rechargeCount: string;
  refundCount: string;
  refundRate: string;
}

export interface AnalyticsResponse<T> {
  data: T;
}
