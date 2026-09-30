import type { ReportsAnalyticsTimePreset } from "./type";

export const REPORTS_ANALYTICS_ENABLE_FALLBACK = false;

export const LICENSE_REPORTS_PATH = "/licensing/reports-analytics";

export const TABLE_PAGE_SIZE_OPTIONS = ["10", "20", "50"];

export const TREND_DATE_LABELS = [
  "28/01 - 01/02",
  "02/02 - 08/02",
  "09/02 - 15/02",
  "16/02 - 22/02",
  "23/02 - 28/02",
];

export const REPORTS_ANALYTICS_TIME_PRESET_DAYS: Partial<
  Record<ReportsAnalyticsTimePreset, number>
> = {
  last7: 7,
  last30: 30,
  last6Months: 180,
  lastYear: 365,
};
