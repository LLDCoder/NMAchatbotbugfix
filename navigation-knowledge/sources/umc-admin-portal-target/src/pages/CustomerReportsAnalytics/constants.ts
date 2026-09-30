import type { CustomerTimePreset } from "./type";

export const CUSTOMER_REPORTS_TIME_PRESET_DAYS: Partial<Record<CustomerTimePreset, number>> = {
  last7: 7,
  last30: 30,
  last6Months: 180,
  lastYear: 365,
};

export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_PAGE = 1;
