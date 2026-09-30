import moment from "moment";
import request from "@/utils/request";
import saveFileWithAxios from "@/utils/saveFileWithAxios";
import type {
  AnalyticsTableParams,
  AnalyticsTimeFilter,
  CustomerProfileInsightsData,
  CustomerProfileInsightsRow,
  DonutChartData,
  GeographicDistributionKey,
  MetricCellData,
  PaginatedTableResult,
  ServiceDepartmentOption,
  ServiceOperationsAnalyticsData,
  ServiceOperationsRow,
  ServiceScopeOption,
  SummaryCardData,
  TrendChartData,
  UserTypeDistributionKey,
} from "@/pages/ServiceReportsAnalytics/type";

const DEFAULT_DAYS = 30;
const DEFAULT_PAGE_INDEX = 1;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SCOPE: ServiceScopeOption = "AllServices";
const DEFAULT_DEPARTMENT: ServiceDepartmentOption = "AllDepartments";
const DEFAULT_SORT = "desc" as const;
const EXPORT_TIMEOUT = 60000;

const COLORS = [
  "#A0D5AB",
  "#81C1FF",
  "#FAD44F",
  "#FAAAA7",
  "#F5AC7C",
  "#C3C6CB",
  "#F0ABFC",
  "#D7BC6D",
  "#78B4FF",
] as const;

type ApiEnvelope<T> = {
  isSuccess: boolean;
  statusCode: number;
  message: string;
  data: T;
};

type ServiceReportsListParams = {
  days?: number;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  option?: ServiceScopeOption;
  pageIndex?: number;
  pageSize?: number;
  orderby?: string;
  sort?: "asc" | "desc";
  AllDepartments?: number;
};

type ServiceStatisticsResponse = {
  publishedServices?: number;
  totalApplications?: number;
  totalRevenue?: number | string;
  approvalRate?: number;
  avgProcessingTime?: number | string;
  avgSatisfaction?: number;
  refundApplications?: number;
  totalRefunds?: number | string;
  revenueTrendList?: Array<{
    date: string;
    revenue: number;
    serviceApplicationFees: number;
    fines: number;
    refunds: number;
  }>;
  applicationTrendList?: Array<{
    date: string;
    count: number;
  }>;
};

type ServiceListResponse = {
  pageIndex?: number;
  pageSize?: number;
  total?: number;
  items?: Array<{
    serviceName?: string;
    serviceCategory?: string;
    applications?: number;
    applicationsChange?: number;
    totalRevenue?: number;
    totalRevenueChange?: number;
    approvalRate?: number;
    approvalRateChange?: number;
    avgProcessingTime?: number;
    avgProcessingTimeChange?: number;
    avgSatisfaction?: number;
    avgSatisfactionChange?: number;
    refundApplications?: number;
    refundApplicationsChange?: number;
    totalRefunds?: number;
    totalRefundsChange?: number;
    refundRate?: number;
    refundRateChange?: number;
  }>;
};

type CustomerStatisticsResponse = {
  usersByDevice?: Array<{
    deviceType: string;
    count: number;
  }>;
  applicationByUserType?: Array<{
    userType: string;
    count: number;
    percentage: number;
  }>;
};

type CustomerListResponse = {
  pageIndex?: number;
  pageSize?: number;
  total?: number;
  items?: Array<{
    serviceName?: string;
    categoryName?: string;
    applications?: number;
    geographicDistribution?: Array<{
      region: string;
      percentage: number;
    }>;
    userTypeDistribution?: Partial<
      Record<
        UserTypeDistributionKey,
        {
          count?: number;
          display?: string;
        }
      >
    >;
  }>;
};

const departmentValueMap: Record<
  "AllDepartments" | "LicensingDepartment" | "ContentDepartment",
  number
> = {
  AllDepartments: 0,
  LicensingDepartment: 1,
  ContentDepartment: 2,
};

const resolveDepartmentValue = (value?: ServiceDepartmentOption) => {
  if (value === "LicensingDepartment" || value === "ContentDepartment") {
    return departmentValueMap[value];
  }

  return departmentValueMap.AllDepartments;
};

const locationKeyMap: Record<string, GeographicDistributionKey> = {
  dubai: "dubai",
  "abu dhabi": "abuDhabi",
  sharjah: "sharjah",
  ajman: "ajman",
  rak: "rak",
  "ras al khaimah": "rak",
  fujairah: "fujairah",
  uaq: "uaq",
  "umm al quwain": "uaq",
  foreign: "foreign",
};

const userTypeKeyMap: Record<string, UserTypeDistributionKey | "establishment"> = {
  individual: "individual",
  establishment: "establishment",
  commercial: "commercial",
  "talent agency": "talentAgency",
  "free zone": "freeZone",
  government: "government",
  embassy: "embassy",
  consulate: "consulate",
  "cultural clubs": "culturalClubs",
};

const normalizeLabel = (value?: string) =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const numberValue = (value?: number | string | null) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      return 0;
    }

    if (normalized.endsWith("min") || normalized.endsWith("m")) {
      const minutes = Number.parseFloat(normalized.replace(/[^0-9.-]/g, ""));
      return Number.isFinite(minutes) ? minutes / (24 * 60) : 0;
    }

    if (normalized.endsWith("h")) {
      const hours = Number.parseFloat(normalized.replace(/[^0-9.-]/g, ""));
      return Number.isFinite(hours) ? hours / 24 : 0;
    }

    if (normalized.endsWith("d")) {
      const days = Number.parseFloat(normalized.replace(/[^0-9.-]/g, ""));
      return Number.isFinite(days) ? days : 0;
    }

    const numeric = Number.parseFloat(normalized.replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
};

const formatAmount = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });

const formatMetricValue = (
  value: number,
  kind: "count" | "amount" | "percent" | "duration",
) => {
  if (kind === "count") {
    return Math.round(value).toLocaleString();
  }

  if (kind === "amount") {
    return formatAmount(value);
  }

  if (kind === "percent") {
    return `${formatAmount(value)}%`;
  }

  if (value >= 1) {
    return `${formatAmount(value)}d`;
  }

  const hours = value * 24;
  if (hours >= 1) {
    return `${formatAmount(hours)}h`;
  }

  return `${Math.max(0, Math.round(hours * 60))}min`;
};

const formatDelta = (value?: number | null) => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return undefined;
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatAmount(value)}%`;
};

const toneFromDelta = (value?: number | null): MetricCellData["tone"] => {
  if (value === undefined || value === null || value === 0) {
    return "neutral";
  }

  return value > 0 ? "positive" : "negative";
};

const toMetricCell = (
  value: number,
  delta: number | undefined,
  kind: "count" | "amount" | "percent" | "duration",
): MetricCellData => ({
  value: formatMetricValue(value, kind),
  delta: formatDelta(delta),
  tone: toneFromDelta(delta),
});

const buildDateParams = (params: AnalyticsTimeFilter) => {
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

const toListParams = (
  params: AnalyticsTableParams & {
    option?: ServiceScopeOption;
    department?: ServiceDepartmentOption;
  },
): ServiceReportsListParams => {
  const requestParams: ServiceReportsListParams = {
    ...buildDateParams(params),
    keyword: params.keyword,
    option: params.option ?? DEFAULT_SCOPE,
    pageIndex: params.pageIndex,
    pageSize: params.pageSize,
    orderby: params.orderby,
    sort: params.sort ?? DEFAULT_SORT,
  };

  if ((params.option ?? DEFAULT_SCOPE) === "AllServices") {
    requestParams.AllDepartments = resolveDepartmentValue(params.department);
  }

  return requestParams;
};

const toExportParams = (
  params: Partial<ServiceReportsListParams> & {
    department?: ServiceDepartmentOption;
  },
) => {
  const requestParams: ServiceReportsListParams = {
    ...buildDateParams(params),
    keyword: params.keyword,
    option: params.option ?? DEFAULT_SCOPE,
    pageIndex: params.pageIndex,
    pageSize: params.pageSize,
    orderby: params.orderby,
    sort: params.sort ?? DEFAULT_SORT,
  };

  if ((params.option ?? DEFAULT_SCOPE) === "AllServices") {
    requestParams.AllDepartments = resolveDepartmentValue(params.department);
  }

  return requestParams;
};

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

const mapRevenueTrend = (
  items: NonNullable<ServiceStatisticsResponse["revenueTrendList"]>,
): TrendChartData => {
  const values = items.flatMap((item) => [
    item.revenue ?? 0,
    item.serviceApplicationFees ?? 0,
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
        nameKey: "serviceReportsAnalytics.series.revenue",
        color: "#A0D5AB",
        values: items.map((item) => numberValue(item.revenue) / scale.divisor),
      },
      {
        name: "Service Application Fees",
        nameKey: "serviceReportsAnalytics.series.serviceApplicationFees",
        color: "#D7BC6D",
        values: items.map(
          (item) => numberValue(item.serviceApplicationFees) / scale.divisor,
        ),
      },
      {
        name: "Fines",
        nameKey: "serviceReportsAnalytics.series.fines",
        color: "#FAD44F",
        values: items.map((item) => numberValue(item.fines) / scale.divisor),
      },
      {
        name: "Refunds",
        nameKey: "serviceReportsAnalytics.series.refunds",
        color: "#FAAAA7",
        values: items.map(
          (item) => -Math.abs(numberValue(item.refunds)) / scale.divisor,
        ),
      },
    ],
  };
};

const mapApplicationTrend = (
  items: NonNullable<ServiceStatisticsResponse["applicationTrendList"]>,
): TrendChartData => ({
  categories: items.map((item) => toChartDate(item.date)),
  series: [
    {
      name: "Service Application",
      nameKey: "serviceReportsAnalytics.series.serviceApplication",
      color: "#D7BC6D",
      areaColor: "rgba(215, 188, 109, 0.16)",
      values: items.map((item) => numberValue(item.count)),
    },
  ],
});

const buildSummaryCards = (
  response: ServiceStatisticsResponse,
): SummaryCardData[] => [
  {
    key: "publishedServices",
    value: numberValue(response.publishedServices),
    iconKey: "services",
    titleKey: "serviceReportsAnalytics.summary.publishedServices",
  },
  {
    key: "totalApplications",
    value: numberValue(response.totalApplications),
    iconKey: "applications",
    titleKey: "serviceReportsAnalytics.summary.totalApplications",
  },
  {
    key: "totalRevenue",
    value: numberValue(response.totalRevenue),
    valuePrefix: "AED",
    iconKey: "revenue",
    titleKey: "serviceReportsAnalytics.summary.totalRevenue",
  },
  {
    key: "approvalRate",
    value: numberValue(response.approvalRate),
    iconKey: "approval",
    titleKey: "serviceReportsAnalytics.summary.approvalRate",
  },
  {
    key: "avgProcessingTime",
    value: numberValue(response.avgProcessingTime),
    iconKey: "processing",
    titleKey: "serviceReportsAnalytics.summary.avgProcessingTime",
  },
  {
    key: "avgSatisfaction",
    value: numberValue(response.avgSatisfaction),
    iconKey: "satisfaction",
    titleKey: "serviceReportsAnalytics.summary.avgSatisfaction",
  },
  {
    key: "refundApplications",
    value: numberValue(response.refundApplications),
    iconKey: "refundApplications",
    titleKey: "serviceReportsAnalytics.summary.refundApplications",
  },
  {
    key: "totalRefunds",
    value: numberValue(response.totalRefunds),
    valuePrefix: "AED",
    iconKey: "refunds",
    titleKey: "serviceReportsAnalytics.summary.totalRefunds",
  },
];

const mapDeviceKey = (value?: string) => {
  const normalized = normalizeLabel(value);

  if (normalized === "web") return "serviceReportsAnalytics.options.devices.web";
  if (normalized === "mobile")
    return "serviceReportsAnalytics.options.devices.mobile";
  if (normalized === "tablet")
    return "serviceReportsAnalytics.options.devices.tablet";

  return undefined;
};

const toDonutChart = (
  items: Array<{
    label: string;
    labelKey?: string;
    value: number;
    percentage?: number;
  }>,
): DonutChartData => {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return {
    total,
    legends: items.map((item, index) => ({
      label: item.label,
      labelKey: item.labelKey as DonutChartData["legends"][number]["labelKey"],
      value: item.value,
      percentage:
        item.percentage ??
        (total > 0 ? Number(((item.value / total) * 100).toFixed(2)) : 0),
      color: COLORS[index % COLORS.length],
    })),
  };
};

const mapCustomerAnalytics = (
  response: CustomerStatisticsResponse,
): CustomerProfileInsightsData => {
  const foldedUserTypes = new Map<UserTypeDistributionKey, number>();

  (response.applicationByUserType ?? []).forEach((item) => {
    const mapped = userTypeKeyMap[normalizeLabel(item.userType)];
    if (!mapped) {
      return;
    }

    const targetKey = mapped === "establishment" ? "commercial" : mapped;
    foldedUserTypes.set(
      targetKey,
      (foldedUserTypes.get(targetKey) ?? 0) + numberValue(item.count),
    );
  });

  return {
    deviceDistribution: toDonutChart(
      (response.usersByDevice ?? []).map((item) => ({
        label: item.deviceType,
        labelKey: mapDeviceKey(item.deviceType),
        value: numberValue(item.count),
      })),
    ),
    userTypeDistribution: toDonutChart(
      Array.from(foldedUserTypes.entries()).map(([key, value]) => ({
        label: key,
        labelKey: `serviceReportsAnalytics.options.userTypes.${key}`,
        value,
      })),
    ),
  };
};

const emptyGeographicDistribution = (): Record<GeographicDistributionKey, string> => ({
  dubai: "0%",
  abuDhabi: "0%",
  sharjah: "0%",
  ajman: "0%",
  rak: "0%",
  fujairah: "0%",
  uaq: "0%",
  foreign: "0%",
});

const emptyUserTypeDistribution = (): Record<UserTypeDistributionKey, string> => ({
  individual: "0 (0%)",
  commercial: "0 (0%)",
  government: "0 (0%)",
  freeZone: "0 (0%)",
  talentAgency: "0 (0%)",
  embassy: "0 (0%)",
  consulate: "0 (0%)",
  culturalClubs: "0 (0%)",
});

const formatPlainPercent = (value: number) =>
  `${formatAmount(value, Number.isInteger(value) ? 0 : 2)}%`;

const mapGeographicDistribution = (
  items: NonNullable<CustomerListResponse["items"]>[number]["geographicDistribution"],
) => {
  const result = emptyGeographicDistribution();

  (items ?? []).forEach((item) => {
    const key = locationKeyMap[normalizeLabel(item.region)];

    if (key) {
      result[key] = formatPlainPercent(numberValue(item.percentage));
    }
  });

  return result;
};

const mapUserTypeDistribution = (
  distribution?: NonNullable<CustomerListResponse["items"]>[number]["userTypeDistribution"],
) => {
  const result = emptyUserTypeDistribution();

  Object.entries(distribution ?? {}).forEach(([key, value]) => {
    const typedKey = key as UserTypeDistributionKey;
    if (typedKey in result) {
      result[typedKey] = value?.display || "0 (0%)";
    }
  });

  return result;
};

const buildRowId = (...parts: Array<string | number | undefined>) =>
  parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

const mapServiceList = (
  response: ServiceListResponse,
): PaginatedTableResult<ServiceOperationsRow> => ({
  pageIndex: response.pageIndex ?? DEFAULT_PAGE_INDEX,
  pageSize: response.pageSize ?? DEFAULT_PAGE_SIZE,
  total: response.total ?? 0,
  items: (response.items ?? []).map((item, index) => ({
    id: buildRowId(
      item.serviceName || item.serviceCategory || "service",
      response.pageIndex,
      index,
    ),
    serviceName: item.serviceName || item.serviceCategory || "-",
    serviceCategory: item.serviceCategory || item.serviceName || "-",
    department: DEFAULT_DEPARTMENT,
    applications: toMetricCell(
      numberValue(item.applications),
      item.applicationsChange,
      "count",
    ),
    totalRevenue: toMetricCell(
      numberValue(item.totalRevenue),
      item.totalRevenueChange,
      "amount",
    ),
    approvalRate: toMetricCell(
      numberValue(item.approvalRate),
      item.approvalRateChange,
      "percent",
    ),
    avgProcessingTime: toMetricCell(
      numberValue(item.avgProcessingTime),
      item.avgProcessingTimeChange,
      "duration",
    ),
    avgSatisfaction: toMetricCell(
      numberValue(item.avgSatisfaction),
      item.avgSatisfactionChange,
      "percent",
    ),
    refundApplications: toMetricCell(
      numberValue(item.refundApplications),
      item.refundApplicationsChange,
      "count",
    ),
    totalRefunds: toMetricCell(
      numberValue(item.totalRefunds),
      item.totalRefundsChange,
      "amount",
    ),
    refundRate: toMetricCell(
      numberValue(item.refundRate),
      item.refundRateChange,
      "percent",
    ),
  })),
});

const mapCustomerList = (
  response: CustomerListResponse,
): PaginatedTableResult<CustomerProfileInsightsRow> => ({
  pageIndex: response.pageIndex ?? DEFAULT_PAGE_INDEX,
  pageSize: response.pageSize ?? DEFAULT_PAGE_SIZE,
  total: response.total ?? 0,
  items: (response.items ?? []).map((item, index) => ({
    id: buildRowId(
      item.serviceName || item.categoryName || "customer",
      response.pageIndex,
      index,
    ),
    serviceName: item.serviceName || item.categoryName || "-",
    serviceCategory: item.categoryName || item.serviceName || "-",
    serviceFilter: "AllServices",
    applications: {
      value: Math.round(numberValue(item.applications)).toLocaleString(),
      tone: "neutral",
    },
    geographicDistribution: mapGeographicDistribution(item.geographicDistribution),
    userTypeDistribution: mapUserTypeDistribution(item.userTypeDistribution),
  })),
});

export const getServiceOperationsAnalytics = async (
  params: AnalyticsTimeFilter = {},
): Promise<{ data: ServiceOperationsAnalyticsData }> => {
  const response = await request.get<
    ApiEnvelope<ServiceStatisticsResponse>,
    ApiEnvelope<ServiceStatisticsResponse>
  >("/api/ServiceInfo/dashboard/service/statistics", buildDateParams(params));

  return {
    data: {
      summaryCards: buildSummaryCards(response.data ?? {}),
      revenueTrend: mapRevenueTrend(response.data?.revenueTrendList ?? []),
      serviceApplicationTrend: mapApplicationTrend(
        response.data?.applicationTrendList ?? [],
      ),
    },
  };
};

export const getServiceOperationsTable = async (
  params: AnalyticsTableParams & {
    option?: ServiceScopeOption;
    department?: ServiceDepartmentOption;
  },
): Promise<{ data: PaginatedTableResult<ServiceOperationsRow> }> => {
  const response = await request.get<
    ApiEnvelope<ServiceListResponse>,
    ApiEnvelope<ServiceListResponse>
  >("/api/ServiceInfo/dashboard/service/list", toListParams(params), {
    skipErrorMessage: true,
  });

  return {
    data: mapServiceList(response.data ?? {}),
  };
};

export const exportServiceOperationsTable = (
  params: Partial<ServiceReportsListParams> & {
    department?: ServiceDepartmentOption;
  },
) =>
  saveFileWithAxios(
    "/api/ServiceInfo/dashboard/service/list/export",
    "service-operations-analytics.csv",
    toExportParams(params),
    "get",
    { timeout: EXPORT_TIMEOUT },
  );

export const getCustomerProfileInsightsAnalytics = async (
  params: AnalyticsTimeFilter = {},
): Promise<{ data: CustomerProfileInsightsData }> => {
  const response = await request.get<
    ApiEnvelope<CustomerStatisticsResponse>,
    ApiEnvelope<CustomerStatisticsResponse>
  >("/api/ServiceInfo/dashboard/customer/statistics", buildDateParams(params));

  return {
    data: mapCustomerAnalytics(response.data ?? {}),
  };
};

export const getCustomerProfileInsightsTable = async (
  params: AnalyticsTableParams & { option?: ServiceScopeOption },
): Promise<{ data: PaginatedTableResult<CustomerProfileInsightsRow> }> => {
  const response = await request.get<
    ApiEnvelope<CustomerListResponse>,
    ApiEnvelope<CustomerListResponse>
  >("/api/ServiceInfo/dashboard/customer/list", toListParams(params), {
    skipErrorMessage: true,
  });

  return {
    data: mapCustomerList(response.data ?? {}),
  };
};

export const exportCustomerProfileInsightsTable = (
  params: Partial<ServiceReportsListParams>,
) =>
  saveFileWithAxios(
    "/api/ServiceInfo/dashboard/customer/list/export",
    "customer-profile-insights.csv",
    toExportParams(params),
    "get",
    { timeout: EXPORT_TIMEOUT },
  );
