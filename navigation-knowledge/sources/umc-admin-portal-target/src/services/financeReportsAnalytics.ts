import moment from "moment";
import request from "@/utils/request";
import saveFileWithAxios from "@/utils/saveFileWithAxios";
import type {
  BarChartData,
  CardHeaderMetric,
  DonutChartData,
  EmirateTableRow,
  FinanceLocationKey,
  FinanceReportsOverviewData,
  FinanceReportsTimeFilter,
  FinanceUserTypeKey,
  SummaryCardData,
  TrendChartData,
  UserTypeTableRow,
} from "@/pages/FinanceReportsAnalytics/type";

const DEFAULT_DAYS = 30;
const EXPORT_TIMEOUT = 60000;

const COLORS = [
  "#A0D5AB",
  "#FAD44F",
  "#FAAAA7",
  "#78B4FF",
  "#F5AC7C",
  "#D7BC6D",
  "#C3C6CB",
] as const;

const DONUT_COLORS_BY_LABEL_KEY: Record<string, string> = {
  "financeReportsAnalytics.series.serviceApplicationFees": "#A0D5AB",
  "financeReportsAnalytics.series.fines": "#FAD44F",
  "financeReportsAnalytics.series.refunds": "#FAAAA7",
  "financeReportsAnalytics.paymentMethods.wallet": "#A0D5AB",
  "financeReportsAnalytics.paymentMethods.card": "#81C1FF",
  "financeReportsAnalytics.status.completed": "#A0D5AB",
  "financeReportsAnalytics.status.failed": "#FAAAA7",
  "financeReportsAnalytics.refundCategories.fineRefund": "#A0D5AB",
  "financeReportsAnalytics.refundCategories.applicationRefund": "#81C1FF",
  "financeReportsAnalytics.refundTypes.fullRefund": "#A0D5AB",
  "financeReportsAnalytics.refundTypes.partialRefund": "#FAD44F",
};

type ApiEnvelope<T> = {
  isSuccess: boolean;
  statusCode: number;
  message: string;
  data: T;
};

type FinanceListParams = {
  days?: number;
  startDate?: string;
  endDate?: string;
  orderby?: string;
  sort?: "asc" | "desc";
};

type FinanceStatisticsResponse = {
  totalRevenue?: number;
  totalPayments?: number;
  totalRecharges?: number;
  totalRefunds?: number;
  paymentFailureRate?: string;
  revenueTrend?: Array<{
    date: string;
    revenue: number;
    serviceFees: number;
    fines: number;
    refunds: number;
  }>;
  revenueBreakdown?: Array<{
    category: string;
    amount: number;
  }>;
  paymentsByType?: Array<{
    name: string;
    value: number;
    percentage: string;
  }>;
  paymentMethodDistribution?: Array<{
    name: string;
    value: number;
    percentage: string;
  }>;
  rechargeBreakdown?: Array<{
    date: string;
    amount: number;
  }>;
  rechargeCount?: Array<{
    name: string;
    value: number;
    percentage: string;
  }>;
  refundAmountByCategory?: Array<{
    name: string;
    value: number;
    percentage: string;
  }>;
  refundTypeDistribution?: Array<{
    name: string;
    value: number;
    percentage: string;
  }>;
};

type FinanceListResponse<T> = {
  items?: T[];
  totalCount?: number;
};

type FinanceUserTypeListItem = {
  userType?: string;
  totalRevenue?: number;
  transactionCount?: number;
  rechargeCount?: number;
  refundCount?: number;
  refundRate?: string;
};

type FinanceEmirateListItem = {
  emirate?: string;
  totalRevenue?: number;
  transactionCount?: number;
  rechargeCount?: number;
  refundCount?: number;
  refundRate?: string;
};

const normalizeLabel = (value?: string) =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const numberValue = (value?: number | string | null) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const numeric = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
};

const formatAmount = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });

const compactAmount = (value: number) => {
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "")}B`;
  }

  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  }

  if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.?0+$/, "")}K`;
  }

  return formatAmount(value);
};

const formatPercent = (value?: string | number) => {
  if (typeof value === "string" && value.includes("%")) {
    return value;
  }

  return `${formatAmount(numberValue(value))}%`;
};

const buildDateParams = (params: FinanceReportsTimeFilter) => {
  if (params.startDate && params.endDate) {
    const start = moment(params.startDate, "YYYY-MM-DD");
    const end = moment(params.endDate, "YYYY-MM-DD");
    const days =
      start.isValid() && end.isValid() && !end.isBefore(start, "day")
        ? end.diff(start, "days") + 1
        : params.days ?? DEFAULT_DAYS;

    return {
      days,
      startDate: params.startDate,
      endDate: params.endDate,
    };
  }

  return {
    days: params.days ?? DEFAULT_DAYS,
  };
};

const toListParams = (params: FinanceReportsTimeFilter & {
  orderby?: string;
  sort?: "asc" | "desc";
}): FinanceListParams => ({
  ...buildDateParams(params),
  ...(params.orderby && params.sort
    ? {
        orderby: params.orderby,
        sort: params.sort,
      }
    : {}),
});

const toChartDate = (value: string) => {
  const m = moment(value);
  return m.isValid() ? m.format("DD/MM") : value;
};

const createChartScale = (values: number[]) => {
  const maxAbs = values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

  if (maxAbs >= 1_000_000_000) {
    return { divisor: 1_000_000_000, suffix: "B" };
  }

  if (maxAbs >= 1_000_000) {
    return { divisor: 1_000_000, suffix: "M" };
  }

  if (maxAbs >= 1_000) {
    return { divisor: 1_000, suffix: "K" };
  }

  return { divisor: 1, suffix: undefined as string | undefined };
};

const paymentTypeLabelKey = (value?: string) => {
  const normalized = normalizeLabel(value);
  if (
    normalized === "service application" ||
    normalized === "service application fees" ||
    normalized === "service fees" ||
    normalized.includes("service application")
  ) {
    return "financeReportsAnalytics.series.serviceApplicationFees";
  }
  if (normalized === "fines") {
    return "financeReportsAnalytics.series.fines";
  }
  if (normalized === "refunds") {
    return "financeReportsAnalytics.series.refunds";
  }
  return undefined;
};

const paymentMethodLabelKey = (value?: string) => {
  const normalized = normalizeLabel(value);
  if (normalized === "wallet") {
    return "financeReportsAnalytics.paymentMethods.wallet";
  }
  if (normalized.includes("credit") || normalized.includes("debit")) {
    return "financeReportsAnalytics.paymentMethods.card";
  }
  return undefined;
};


const refundTypeLabelKey = (value?: string) => {
  const normalized = normalizeLabel(value);
  if (normalized.includes("full")) {
    return "financeReportsAnalytics.refundTypes.fullRefund";
  }
  if (normalized.includes("partial")) {
    return "financeReportsAnalytics.refundTypes.partialRefund";
  }
  return undefined;
};

const refundCategoryLabelKey = (value?: string) => {
  const normalized = normalizeLabel(value);
  if (normalized.includes("fine")) {
    return "financeReportsAnalytics.refundCategories.fineRefund";
  }
  if (normalized.includes("application")) {
    return "financeReportsAnalytics.refundCategories.applicationRefund";
  }
  return undefined;
};

const statusLabelKey = (value?: string) => {
  const normalized = normalizeLabel(value);
  if (normalized === "completed") {
    return "financeReportsAnalytics.status.completed";
  }
  if (normalized === "failed") {
    return "financeReportsAnalytics.status.failed";
  }
  return undefined;
};

const toDonutChart = (
  items: Array<{
    label: string;
    labelKey?: string;
    value: number;
    percentage: string;
  }>,
): DonutChartData => {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return {
    total,
    totalLabel: compactAmount(total),
    legends: items.map((item, index) => ({
      label: item.label,
      labelKey: item.labelKey as DonutChartData["legends"][number]["labelKey"],
      value: item.value,
      valueLabel: compactAmount(item.value),
      percentageLabel: item.percentage,
      color:
        DONUT_COLORS_BY_LABEL_KEY[item.labelKey ?? ""] ??
        COLORS[index % COLORS.length],
    })),
  };
};

const toRevenueTrend = (
  items: NonNullable<FinanceStatisticsResponse["revenueTrend"]>,
): TrendChartData => {
  const values = items.flatMap((item) => [
    item.revenue ?? 0,
    item.serviceFees ?? 0,
    item.fines ?? 0,
    -Math.abs(item.refunds ?? 0),
  ]);
  const scale = createChartScale(values);

  return {
    categories: items.map((item) => toChartDate(item.date)),
    yAxisSuffix: scale.suffix,
    series: [
      {
        name: "Revenue",
        nameKey: "financeReportsAnalytics.series.revenue",
        color: "#A0D5AB",
        values: items.map((item) => numberValue(item.revenue) / scale.divisor),
      },
      {
        name: "Service Application Fees",
        nameKey: "financeReportsAnalytics.series.serviceApplicationFees",
        color: "#D7BC6D",
        values: items.map(
          (item) => numberValue(item.serviceFees) / scale.divisor,
        ),
      },
      {
        name: "Fines",
        nameKey: "financeReportsAnalytics.series.fines",
        color: "#FAD44F",
        values: items.map((item) => numberValue(item.fines) / scale.divisor),
      },
      {
        name: "Refunds",
        nameKey: "financeReportsAnalytics.series.refunds",
        color: "#FAAAA7",
        values: items.map(
          (item) => -Math.abs(numberValue(item.refunds)) / scale.divisor,
        ),
      },
    ],
  };
};

const toRechargeTrend = (
  items: NonNullable<FinanceStatisticsResponse["rechargeBreakdown"]>,
): TrendChartData => {
  const values = items.map((item) => numberValue(item.amount));
  const scale = createChartScale(values);

  return {
    categories: items.map((item) => toChartDate(item.date)),
    yAxisSuffix: scale.suffix,
    series: [
      {
        name: "Recharges",
        nameKey: "financeReportsAnalytics.summary.totalRecharges",
        color: "#D7BC6D",
        areaColor: "rgba(215, 188, 109, 0.16)",
        values: values.map((value) => value / scale.divisor),
      },
    ],
  };
};

const toBarChart = (
  items: NonNullable<FinanceStatisticsResponse["revenueBreakdown"]>,
): BarChartData => {
  const values = items.map((item) => numberValue(item.amount));
  const scale = createChartScale(values);

  return {
    yAxisSuffix: scale.suffix,
    items: items.map((item, index) => {
      const amount = numberValue(item.amount);
      const value =
        normalizeLabel(item.category) === "refunds" && amount !== 0
          ? -Math.abs(amount)
          : amount;

      return {
        name: item.category || "",
        nameKey: paymentTypeLabelKey(item.category) as BarChartData["items"][number]["nameKey"],
        value: value / scale.divisor,
        displayValue: compactAmount(value),
        color: COLORS[index % COLORS.length],
      };
    }),
  };
};

const overviewSummaryCards = (
  response: FinanceStatisticsResponse,
): SummaryCardData[] => [
  {
    key: "totalRevenue",
    displayValue: compactAmount(numberValue(response.totalRevenue)),
    iconKey: "totalRevenue",
    titleKey: "financeReportsAnalytics.summary.totalRevenue",
  },
  {
    key: "totalPayments",
    displayValue: Math.round(numberValue(response.totalPayments)).toLocaleString(),
    iconKey: "totalPayments",
    titleKey: "financeReportsAnalytics.summary.totalPayments",
  },
  {
    key: "totalRecharges",
    displayValue: Math.round(numberValue(response.totalRecharges)).toLocaleString(),
    iconKey: "totalRecharges",
    titleKey: "financeReportsAnalytics.summary.totalRecharges",
  },
  {
    key: "totalRefunds",
    displayValue: Math.round(numberValue(response.totalRefunds)).toLocaleString(),
    iconKey: "totalRefunds",
    titleKey: "financeReportsAnalytics.summary.totalRefunds",
  },
];

// The API localizes these labels through `Accept-Language`, so both spellings
// are matched. Anything unmatched returns `null` and the caller falls back to
// the API label itself rather than mislabelling the row as a known value.
const mapLocationKey = (value?: string): FinanceLocationKey | null => {
  const normalized = normalizeLabel(value);

  if (normalized === "dubai" || normalized === "دبي") return "dubai";
  if (normalized === "abu dhabi" || normalized === "أبوظبي") return "abuDhabi";
  if (normalized === "sharjah" || normalized === "الشارقة") return "sharjah";
  if (normalized === "ajman" || normalized === "عجمان") return "ajman";
  if (normalized === "ras al khaimah" || normalized === "رأس الخيمة") {
    return "rasAlKhaimah";
  }
  if (normalized === "fujairah" || normalized === "الفجيرة") return "fujairah";
  if (normalized === "umm al quwain" || normalized === "أم القيوين") {
    return "ummAlQuwain";
  }

  return null;
};

const mapUserTypeKey = (value?: string): FinanceUserTypeKey | null => {
  const normalized = normalizeLabel(value);

  if (normalized === "individual") return "individual";
  if (normalized === "commercial") return "commercial";
  if (normalized === "government") return "government";
  if (normalized === "free zone") return "freeZone";
  if (normalized === "embassy") return "embassy";
  if (normalized === "consulate") return "consulate";
  if (normalized === "cultural clubs") return "culturalClubs";
  if (normalized === "talent agency") return "talentAgency";

  return null;
};

const mapPaymentFailureRate = (paymentFailureRate?: string): CardHeaderMetric => ({
    label: "Payment Failure Rate",
    labelKey: "financeReportsAnalytics.charts.paymentFailureRate",
    value: paymentFailureRate ?? "--",
    dotColor: "#F26D6D",
  });

export const getFinanceReportsOverview = async (
  params: FinanceReportsTimeFilter = {},
): Promise<{ data: FinanceReportsOverviewData }> => {
  const response = await request.get<
    ApiEnvelope<FinanceStatisticsResponse>,
    ApiEnvelope<FinanceStatisticsResponse>
  >("/api/Payments/dashboard/statistics", buildDateParams(params));

  return {
    data: {
      summaryCards: overviewSummaryCards(response.data ?? {}),
      revenueTrend: toRevenueTrend(response.data?.revenueTrend ?? []),
      revenueBreakdown: toBarChart(response.data?.revenueBreakdown ?? []),
      paymentsByType: toDonutChart(
        (response.data?.paymentsByType ?? []).map((item) => ({
          label: item.name || "",
          labelKey: paymentTypeLabelKey(item.name),
          value: numberValue(item.value),
          percentage: item.percentage || "0.00%",
        })),
      ),
      paymentsByTypeMetric: mapPaymentFailureRate(response.data?.paymentFailureRate),
      paymentMethodDistribution: toDonutChart(
        (response.data?.paymentMethodDistribution ?? []).map((item) => ({
          label: item.name || "",
          labelKey: paymentMethodLabelKey(item.name),
          value: numberValue(item.value),
          percentage: item.percentage || "0.00%",
        })),
      ),
      rechargeBreakdown: toRechargeTrend(response.data?.rechargeBreakdown ?? []),
      rechargeCount: toDonutChart(
        (response.data?.rechargeCount ?? []).map((item) => ({
          label: item.name || "",
          labelKey: statusLabelKey(item.name),
          value: numberValue(item.value),
          percentage: item.percentage || "0.00%",
        })),
      ),
      refundAmountByCategory: toDonutChart(
        (response.data?.refundAmountByCategory ?? []).map((item) => ({
          label: item.name || "",
          labelKey: refundCategoryLabelKey(item.name),
          value: numberValue(item.value),
          percentage: item.percentage || "0.00%",
        })),
      ),
      refundTypeDistribution: toDonutChart(
        (response.data?.refundTypeDistribution ?? []).map((item) => ({
          label: item.name || "",
          labelKey: refundTypeLabelKey(item.name),
          value: numberValue(item.value),
          percentage: item.percentage || "0.00%",
        })),
      ),
    },
  };
};

export const getFinanceEmirateTable = async (
  params: FinanceReportsTimeFilter & {
    orderby?: string;
    sort?: "asc" | "desc";
  } = {},
): Promise<{ data: EmirateTableRow[] }> => {
  const response = await request.get<
    ApiEnvelope<FinanceListResponse<FinanceEmirateListItem>>,
    ApiEnvelope<FinanceListResponse<FinanceEmirateListItem>>
  >("/api/Payments/dashboard/emirates/list", toListParams(params));

  return {
    data: (response.data?.items ?? []).map((item, index) => {
      const locationKey = mapLocationKey(item.emirate);
      const location = item.emirate?.trim() || "";

      return {
        id: `${locationKey ?? (location || "unknown")}-${index}`,
        locationKey,
        location,
        totalRevenue: formatAmount(numberValue(item.totalRevenue)),
        totalRevenueValue: numberValue(item.totalRevenue),
        transactionCount: Math.round(numberValue(item.transactionCount)).toLocaleString(),
        rechargeCount: Math.round(numberValue(item.rechargeCount)).toLocaleString(),
        refundCount: Math.round(numberValue(item.refundCount)).toLocaleString(),
        refundRate: formatPercent(item.refundRate),
      };
    }),
  };
};

export const exportFinanceEmirateTable = (
  params: FinanceReportsTimeFilter & {
    orderby?: string;
    sort?: "asc" | "desc";
  } = {},
) =>
  saveFileWithAxios(
    "/api/Payments/dashboard/emirates/list/export",
    "finance-by-emirate.csv",
    toListParams(params),
    "get",
    { timeout: EXPORT_TIMEOUT },
  );

export const getFinanceUserTypeTable = async (
  params: FinanceReportsTimeFilter & {
    orderby?: string;
    sort?: "asc" | "desc";
  } = {},
): Promise<{ data: UserTypeTableRow[] }> => {
  const response = await request.get<
    ApiEnvelope<FinanceListResponse<FinanceUserTypeListItem>>,
    ApiEnvelope<FinanceListResponse<FinanceUserTypeListItem>>
  >("/api/Payments/dashboard/usertype/list", toListParams(params));

  return {
    data: (response.data?.items ?? []).map((item, index) => {
      const userTypeKey = mapUserTypeKey(item.userType);
      const userType = item.userType?.trim() || "";

      return {
        id: `${userTypeKey ?? (userType || "unknown")}-${index}`,
        userTypeKey,
        userType,
        totalRevenue: formatAmount(numberValue(item.totalRevenue)),
        totalRevenueValue: numberValue(item.totalRevenue),
        transactionCount: Math.round(numberValue(item.transactionCount)).toLocaleString(),
        rechargeCount: Math.round(numberValue(item.rechargeCount)).toLocaleString(),
        refundCount: Math.round(numberValue(item.refundCount)).toLocaleString(),
        refundRate: formatPercent(item.refundRate),
      };
    }),
  };
};

export const exportFinanceUserTypeTable = (
  params: FinanceReportsTimeFilter & {
    orderby?: string;
    sort?: "asc" | "desc";
  } = {},
) =>
  saveFileWithAxios(
    "/api/Payments/dashboard/usertype/list/export",
    "finance-by-user-type.csv",
    toListParams(params),
    "get",
    { timeout: EXPORT_TIMEOUT },
  );
