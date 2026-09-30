import type { ReportsAnalyticsTimePreset } from "./type";

export const REPORTS_ANALYTICS_ENABLE_FALLBACK = false;

export const TABLE_PAGE_SIZE_OPTIONS = ["10", "20", "50"];

export const REPORTS_ANALYTICS_TIME_PRESET_DAYS: Partial<
  Record<ReportsAnalyticsTimePreset, number>
> = {
  last7: 7,
  last30: 30,
  last6Months: 180,
  lastYear: 365,
};

export const CONTENT_LIBRARY_SORT_KEYS = {
  libraryItems: "LibraryItems",
  approved: "Approved",
  rejected: "Rejected",
  approvedRate: "ApprovedRate",
  applications: "Applications",
  local: "Local",
  import: "Import",
} as const;
