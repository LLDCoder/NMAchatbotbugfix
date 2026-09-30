import type { FinanceReportsOverviewData } from "./type";

export const FINANCE_REPORTS_TIME_PRESET_DAYS = {
  last7: 7,
  last30: 30,
  last6Months: 183,
  lastYear: 365,
} as const;

export const DEFAULT_OVERVIEW_DATA: FinanceReportsOverviewData = {
  summaryCards: [
    {
      key: "totalRevenue",
      displayValue: "0",
      iconKey: "totalRevenue",
      titleKey: "financeReportsAnalytics.summary.totalRevenue",
    },
    {
      key: "totalPayments",
      displayValue: "0",
      iconKey: "totalPayments",
      titleKey: "financeReportsAnalytics.summary.totalPayments",
    },
    {
      key: "totalRecharges",
      displayValue: "0",
      iconKey: "totalRecharges",
      titleKey: "financeReportsAnalytics.summary.totalRecharges",
    },
    {
      key: "totalRefunds",
      displayValue: "0",
      iconKey: "totalRefunds",
      titleKey: "financeReportsAnalytics.summary.totalRefunds",
    },
  ],
  revenueTrend: {
    categories: [],
    series: [],
  },
  revenueBreakdown: {
    items: [],
  },
  paymentsByType: {
    total: 0,
    totalLabel: "0",
    legends: [],
  },
  paymentsByTypeMetric: {
    label: "",
    value: "",
    dotColor: "#F26D6D",
  },
  paymentMethodDistribution: {
    total: 0,
    totalLabel: "0",
    legends: [],
  },
  rechargeBreakdown: {
    categories: [],
    series: [],
  },
  rechargeCount: {
    total: 0,
    totalLabel: "0",
    legends: [],
  },
  refundAmountByCategory: {
    total: 0,
    totalLabel: "0",
    legends: [],
  },
  refundTypeDistribution: {
    total: 0,
    totalLabel: "0",
    legends: [],
  },
};
