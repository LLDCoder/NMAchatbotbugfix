import type { ReportsAnalyticsTimePreset } from "./type";

export const TABLE_PAGE_SIZE_OPTIONS = ["10", "20", "50"];

export const REPORTS_ANALYTICS_TIME_PRESET_DAYS: Partial<
  Record<ReportsAnalyticsTimePreset, number>
> = {
  last7: 7,
  last30: 30,
  last6Months: 180,
  lastYear: 365,
};

export const SERVICE_OPERATIONS_SORT_KEYS = {
  applications: "Applications",
  totalRevenue: "TotalRevenue",
  approvalRate: "ApprovalRate",
  avgProcessingTime: "AvgProcessingTime",
  avgSatisfaction: "AvgSatisfaction",
  refundApplications: "RefundApplications",
  totalRefunds: "TotalRefunds",
  refundRate: "RefundRate",
} as const;

export const CUSTOMER_PROFILE_INSIGHTS_SORT_KEYS = {
  applications: "Applications",
} as const;
