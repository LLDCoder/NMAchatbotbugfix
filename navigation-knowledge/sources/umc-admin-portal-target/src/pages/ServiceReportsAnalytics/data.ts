import moment from "moment";
import type {
  AnalyticsTimeFilter,
  CustomerProfileInsightsData,
  CustomerProfileInsightsRow,
  ServiceOperationsAnalyticsData,
  ServiceOperationsRow,
} from "./type";

const positive = (value: string, delta = "+8.5%") => ({
  value,
  delta,
  tone: "positive" as const,
});

const negative = (value: string, delta = "-1.5%") => ({
  value,
  delta,
  tone: "negative" as const,
});

export const serviceOperationsAnalyticsMock: ServiceOperationsAnalyticsData = {
  summaryCards: [
    {
      key: "publishedServices",
      value: 5183,
      iconKey: "services",
      titleKey: "serviceReportsAnalytics.summary.publishedServices",
    },
    {
      key: "totalApplications",
      value: 1680,
      iconKey: "applications",
      titleKey: "serviceReportsAnalytics.summary.totalApplications",
    },
    {
      key: "totalRevenue",
      value: 8888000,
      valuePrefix: "AED",
      iconKey: "revenue",
      titleKey: "serviceReportsAnalytics.summary.totalRevenue",
    },
    {
      key: "approvalRate",
      value: 87.3,
      iconKey: "approval",
      titleKey: "serviceReportsAnalytics.summary.approvalRate",
    },
    {
      key: "avgProcessingTime",
      value: 3.2,
      iconKey: "processing",
      titleKey: "serviceReportsAnalytics.summary.avgProcessingTime",
    },
    {
      key: "avgSatisfaction",
      value: 94.2,
      iconKey: "satisfaction",
      titleKey: "serviceReportsAnalytics.summary.avgSatisfaction",
    },
    {
      key: "refundApplications",
      value: 300,
      iconKey: "refundApplications",
      titleKey: "serviceReportsAnalytics.summary.refundApplications",
    },
    {
      key: "totalRefunds",
      value: 1627.0,
      valuePrefix: "AED",
      iconKey: "refunds",
      titleKey: "serviceReportsAnalytics.summary.totalRefunds",
    },
  ],
  revenueTrend: {
    categories: [
      "28/01 - 01/02",
      "02/02 - 08/02",
      "09/02 - 15/02",
      "16/02 - 22/02",
      "23/02 - 28/02",
    ],
    yAxisMin: -100,
    yAxisMax: 400,
    yAxisInterval: 100,
    yAxisSuffix: "M",
    series: [
      {
        name: "Revenue",
        nameKey: "serviceReportsAnalytics.series.revenue",
        color: "#A0D5AB",
        values: [180, 180, 240, 230, 290],
      },
      {
        name: "Service Application Fees",
        nameKey: "serviceReportsAnalytics.series.serviceApplicationFees",
        color: "#D7BC6D",
        values: [120, 120, 180, 180, 180],
      },
      {
        name: "Fines",
        nameKey: "serviceReportsAnalytics.series.fines",
        color: "#FAD44F",
        values: [10, 10, 30, 30, 45],
      },
      {
        name: "Refunds",
        nameKey: "serviceReportsAnalytics.series.refunds",
        color: "#FAAAA7",
        values: [-20, -25, -40, -40, -28],
      },
    ],
  },
  serviceApplicationTrend: {
    categories: [
      "28/01 - 01/02",
      "02/02 - 08/02",
      "09/02 - 15/02",
      "16/02 - 22/02",
      "23/02 - 28/02",
    ],
    yAxisMax: 2500,
    yAxisInterval: 500,
    series: [
      {
        name: "Service Application",
        nameKey: "serviceReportsAnalytics.series.serviceApplication",
        color: "#D7BC6D",
        areaColor: "rgba(215, 188, 109, 0.16)",
        values: [900, 900, 1400, 1400, 2100],
      },
    ],
  },
};

type TrendGranularity =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "twoYearly"
  | "fiveYearly";

const DEFAULT_TREND_DAYS = 30;

const SHORT_RANGE_REVENUE_UNIT = "K";
const LONG_RANGE_REVENUE_UNIT = "M";

const TREND_VARIATION_PATTERN = [0, 12, -8, 18, -5, 24, 6, -10, 16, -3, 20, 8];

const getResolvedRange = (filter: AnalyticsTimeFilter = { days: DEFAULT_TREND_DAYS }) => {
  if (filter.startDate && filter.endDate) {
    const start = moment(filter.startDate, "YYYY-MM-DD").startOf("day");
    const end = moment(filter.endDate, "YYYY-MM-DD").startOf("day");

    if (start.isValid() && end.isValid() && !end.isBefore(start)) {
      return {
        start,
        end,
        days: end.diff(start, "days") + 1,
      };
    }
  }

  const days = Math.max(filter.days || DEFAULT_TREND_DAYS, 1);
  const end = moment().startOf("day");
  const start = end.clone().subtract(days - 1, "days");

  return { start, end, days };
};

const getTrendGranularity = (days: number): TrendGranularity => {
  if (days <= 14) {
    return "daily";
  }
  if (days <= 90) {
    return "weekly";
  }
  if (days <= 365) {
    return "monthly";
  }
  if (days <= 1095) {
    return "quarterly";
  }
  if (days <= 5110) {
    return "yearly";
  }
  if (days <= 10220) {
    return "twoYearly";
  }

  return "fiveYearly";
};

const getBucketStartByYearStep = (year: number, step: number) =>
  moment({
    year: Math.floor(year / step) * step,
    month: 0,
    day: 1,
  }).startOf("day");

const buildTrendCategories = (filter?: AnalyticsTimeFilter) => {
  const { start, end, days } = getResolvedRange(filter);
  const granularity = getTrendGranularity(days);
  const categories: string[] = [];

  if (granularity === "daily") {
    const cursor = start.clone();

    while (!cursor.isAfter(end, "day")) {
      categories.push(cursor.format("DD/MM"));
      cursor.add(1, "day");
    }
  }

  if (granularity === "weekly") {
    const cursor = start.clone();

    while (!cursor.isAfter(end, "day")) {
      const bucketStart = cursor.clone();
      const bucketEnd = moment.min(cursor.clone().add(6, "days"), end);

      categories.push(
        `${bucketStart.format("DD/MM")}-${bucketEnd.format("DD/MM")}`,
      );
      cursor.add(7, "days");
    }
  }

  if (granularity === "monthly") {
    const cursor = start.clone().startOf("month");

    while (!cursor.isAfter(end, "day")) {
      const monthEnd = cursor.clone().endOf("month");
      if (monthEnd.isSameOrAfter(start, "day")) {
        categories.push(cursor.format("MM-YYYY"));
      }
      cursor.add(1, "month");
    }
  }

  if (granularity === "quarterly") {
    const cursor = start.clone().startOf("quarter");

    while (!cursor.isAfter(end, "day")) {
      const quarterEnd = cursor.clone().endOf("quarter");
      if (quarterEnd.isSameOrAfter(start, "day")) {
        categories.push(`Q${cursor.quarter()} ${cursor.format("YYYY")}`);
      }
      cursor.add(1, "quarter");
    }
  }

  if (granularity === "yearly") {
    const cursor = start.clone().startOf("year");

    while (!cursor.isAfter(end, "day")) {
      const yearEnd = cursor.clone().endOf("year");
      if (yearEnd.isSameOrAfter(start, "day")) {
        categories.push(cursor.format("YYYY"));
      }
      cursor.add(1, "year");
    }
  }

  if (granularity === "twoYearly") {
    const cursor = getBucketStartByYearStep(start.year(), 2);

    while (!cursor.isAfter(end, "day")) {
      const bucketEnd = cursor.clone().add(1, "year").endOf("year");
      if (bucketEnd.isSameOrAfter(start, "day")) {
        categories.push(`${cursor.year()}-${cursor.year() + 1}`);
      }
      cursor.add(2, "years");
    }
  }

  if (granularity === "fiveYearly") {
    const cursor = getBucketStartByYearStep(start.year(), 5);

    while (!cursor.isAfter(end, "day")) {
      const bucketEnd = cursor.clone().add(4, "years").endOf("year");
      if (bucketEnd.isSameOrAfter(start, "day")) {
        categories.push(`${cursor.year()}-${cursor.year() + 4}`);
      }
      cursor.add(5, "years");
    }
  }

  return {
    categories,
    granularity,
  };
};

const getNiceAxisStep = (value: number) => {
  if (value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;

  if (normalized <= 1) {
    return magnitude;
  }
  if (normalized <= 2) {
    return 2 * magnitude;
  }
  if (normalized <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
};

const getAxisConfig = (maxValue: number) => {
  const interval = getNiceAxisStep(Math.ceil(maxValue / 4));
  const yAxisMax = Math.max(interval, Math.ceil(maxValue / interval) * interval);

  return {
    yAxisMin: 0,
    yAxisMax,
    yAxisInterval: interval,
  };
};

const buildTrendValues = (
  length: number,
  options: {
    base: number;
    growth: number;
    varianceScale: number;
    offset?: number;
    minimum?: number;
  },
) =>
  Array.from({ length }, (_, index) => {
    const variation =
      TREND_VARIATION_PATTERN[(index + (options.offset || 0)) % TREND_VARIATION_PATTERN.length];
    const nextValue =
      options.base + options.growth * index + variation * options.varianceScale;

    return Math.max(options.minimum || 0, Math.round(nextValue));
  });

const getRevenueUnit = (granularity: TrendGranularity) =>
  granularity === "daily" || granularity === "weekly"
    ? SHORT_RANGE_REVENUE_UNIT
    : LONG_RANGE_REVENUE_UNIT;

const buildRevenueTrend = (
  categories: string[],
  granularity: TrendGranularity,
): ServiceOperationsAnalyticsData["revenueTrend"] => {
  const revenueUnit = getRevenueUnit(granularity);
  const isShortRange = revenueUnit === SHORT_RANGE_REVENUE_UNIT;

  const serviceApplicationFees = buildTrendValues(categories.length, {
    base: isShortRange ? 110 : 18,
    growth: isShortRange ? 11 : 4,
    varianceScale: isShortRange ? 1.2 : 0.4,
    minimum: isShortRange ? 60 : 8,
  });
  const fines = buildTrendValues(categories.length, {
    base: isShortRange ? 14 : 4,
    growth: isShortRange ? 2 : 1,
    varianceScale: isShortRange ? 0.5 : 0.2,
    offset: 2,
    minimum: 1,
  });
  const refunds = buildTrendValues(categories.length, {
    base: isShortRange ? 18 : 5,
    growth: isShortRange ? 1 : 1,
    varianceScale: isShortRange ? 0.4 : 0.18,
    offset: 5,
    minimum: 1,
  });
  const revenue = serviceApplicationFees.map((feesValue, index) =>
    Math.max(0, feesValue + fines[index] - refunds[index]),
  );
  const axis = getAxisConfig(
    Math.max(...revenue, ...serviceApplicationFees, ...fines, ...refunds),
  );

  return {
    categories,
    yAxisSuffix: revenueUnit,
    ...axis,
    series: [
      {
        name: "Revenue",
        nameKey: "serviceReportsAnalytics.series.revenue" as const,
        color: "#A0D5AB",
        values: revenue,
      },
      {
        name: "Service Application Fees",
        nameKey: "serviceReportsAnalytics.series.serviceApplicationFees" as const,
        color: "#D7BC6D",
        values: serviceApplicationFees,
      },
      {
        name: "Fines",
        nameKey: "serviceReportsAnalytics.series.fines" as const,
        color: "#FAD44F",
        values: fines,
      },
      {
        name: "Refunds",
        nameKey: "serviceReportsAnalytics.series.refunds" as const,
        color: "#FAAAA7",
        values: refunds,
      },
    ],
  };
};

const buildServiceApplicationTrend = (
  categories: string[],
  granularity: TrendGranularity,
): ServiceOperationsAnalyticsData["serviceApplicationTrend"] => {
  const baseByGranularity: Record<TrendGranularity, number> = {
    daily: 260,
    weekly: 900,
    monthly: 1100,
    quarterly: 1400,
    yearly: 1650,
    twoYearly: 2100,
    fiveYearly: 2600,
  };
  const growthByGranularity: Record<TrendGranularity, number> = {
    daily: 42,
    weekly: 130,
    monthly: 160,
    quarterly: 210,
    yearly: 250,
    twoYearly: 320,
    fiveYearly: 420,
  };
  const values = buildTrendValues(categories.length, {
    base: baseByGranularity[granularity],
    growth: growthByGranularity[granularity],
    varianceScale: 7,
    offset: 1,
    minimum: 1,
  });
  const axis = getAxisConfig(Math.max(...values));

  return {
    categories,
    ...axis,
    series: [
      {
        name: "Service Application",
        nameKey: "serviceReportsAnalytics.series.serviceApplication" as const,
        color: "#D7BC6D",
        areaColor: "rgba(215, 188, 109, 0.16)",
        values,
      },
    ],
  };
};

export const buildServiceOperationsAnalyticsMock = (
  filter?: AnalyticsTimeFilter,
): ServiceOperationsAnalyticsData => {
  const { categories, granularity } = buildTrendCategories(filter);

  return {
    summaryCards: serviceOperationsAnalyticsMock.summaryCards,
    revenueTrend: buildRevenueTrend(categories, granularity),
    serviceApplicationTrend: buildServiceApplicationTrend(
      categories,
      granularity,
    ),
  };
};

export const customerProfileInsightsMock: CustomerProfileInsightsData = {
  deviceDistribution: {
    total: 10000,
    legends: [
      {
        label: "Web",
        labelKey: "serviceReportsAnalytics.options.devices.web",
        value: 8000,
        percentage: 80,
        color: "#A0D5AB",
      },
      {
        label: "Mobile",
        labelKey: "serviceReportsAnalytics.options.devices.mobile",
        value: 1600,
        percentage: 16,
        color: "#81C1FF",
      },
      {
        label: "Tablet",
        labelKey: "serviceReportsAnalytics.options.devices.tablet",
        value: 400,
        percentage: 4,
        color: "#C3C6CB",
      },
    ],
  },
  userTypeDistribution: {
    total: 10000,
    legends: [
      {
        label: "Individual",
        labelKey: "serviceReportsAnalytics.options.userTypes.individual",
        value: 8000,
        percentage: 80,
        color: "#A0D5AB",
      },
      {
        label: "Commercial",
        labelKey: "serviceReportsAnalytics.options.userTypes.commercial",
        value: 1000,
        percentage: 10,
        color: "#D7BC6D",
      },
      {
        label: "Talent Agency",
        labelKey: "serviceReportsAnalytics.options.userTypes.talentAgency",
        value: 200,
        percentage: 2,
        color: "#F5AC7C",
      },
      {
        label: "Free Zone",
        labelKey: "serviceReportsAnalytics.options.userTypes.freeZone",
        value: 200,
        percentage: 2,
        color: "#FAAAA7",
      },
      {
        label: "Embassy",
        labelKey: "serviceReportsAnalytics.options.userTypes.embassy",
        value: 200,
        percentage: 2,
        color: "#FAD44F",
      },
      {
        label: "Consulate",
        labelKey: "serviceReportsAnalytics.options.userTypes.consulate",
        value: 200,
        percentage: 2,
        color: "#81C1FF",
      },
      {
        label: "Cultural Clubs",
        labelKey: "serviceReportsAnalytics.options.userTypes.culturalClubs",
        value: 0,
        percentage: 0,
        color: "#F0ABFC",
      },
      {
        label: "Government",
        labelKey: "serviceReportsAnalytics.options.userTypes.government",
        value: 200,
        percentage: 2,
        color: "#C3C6CB",
      },
    ],
  },
};

export const serviceOperationsRowsMock: ServiceOperationsRow[] = [
  {
    id: "service-01",
    serviceName: "Ground Photography Permit",
    serviceCategory: "Film & Content Production",
    department: "PermitServices",
    applications: positive("123"),
    totalRevenue: positive("88k"),
    approvalRate: positive("88k"),
    avgProcessingTime: positive("3.2d"),
    avgSatisfaction: positive("87.5%"),
    refundApplications: positive("12"),
    totalRefunds: positive("1500"),
    refundRate: positive("7.5%"),
  },
  {
    id: "service-02",
    serviceName: "Aerial Photography Permit",
    serviceCategory: "Film & Content Production",
    department: "PermitServices",
    applications: positive("123"),
    totalRevenue: negative("88k"),
    approvalRate: positive("88k"),
    avgProcessingTime: positive("3.2d"),
    avgSatisfaction: positive("87.5%"),
    refundApplications: positive("12"),
    totalRefunds: positive("1500"),
    refundRate: positive("7.5%"),
  },
  {
    id: "service-03",
    serviceName: "Media License Renewal",
    serviceCategory: "Media Licensing",
    department: "MediaLicensing",
    applications: positive("123"),
    totalRevenue: positive("88k"),
    approvalRate: positive("88k"),
    avgProcessingTime: negative("3.2d"),
    avgSatisfaction: positive("87.5%"),
    refundApplications: positive("12"),
    totalRefunds: positive("1500"),
    refundRate: positive("7.5%"),
  },
  {
    id: "service-04",
    serviceName: "Foreign Correspondent Permit",
    serviceCategory: "Media Licensing",
    department: "MediaLicensing",
    applications: positive("123"),
    totalRevenue: negative("88k"),
    approvalRate: positive("88k"),
    avgProcessingTime: positive("3.2d"),
    avgSatisfaction: positive("87.5%"),
    refundApplications: positive("12"),
    totalRefunds: positive("1500"),
    refundRate: positive("7.5%"),
  },
  {
    id: "service-05",
    serviceName: "Digital Content Review",
    serviceCategory: "Content Services",
    department: "ContentServices",
    applications: positive("123"),
    totalRevenue: negative("88k"),
    approvalRate: positive("88k"),
    avgProcessingTime: positive("3.2d"),
    avgSatisfaction: positive("87.5%"),
    refundApplications: positive("12"),
    totalRefunds: positive("1500"),
    refundRate: positive("7.5%"),
  },
  {
    id: "service-06",
    serviceName: "Service Escalation Handling",
    serviceCategory: "Customer Care",
    department: "CustomerCare",
    applications: positive("123"),
    totalRevenue: positive("88k"),
    approvalRate: positive("88k"),
    avgProcessingTime: positive("3.2d"),
    avgSatisfaction: positive("87.5%"),
    refundApplications: positive("12"),
    totalRefunds: positive("1500"),
    refundRate: positive("7.5%"),
  },
  {
    id: "service-07",
    serviceName: "Permit Status Amendment",
    serviceCategory: "Permit Services",
    department: "PermitServices",
    applications: positive("123"),
    totalRevenue: positive("88k"),
    approvalRate: positive("88k"),
    avgProcessingTime: positive("3.2d"),
    avgSatisfaction: positive("87.5%"),
    refundApplications: positive("12"),
    totalRefunds: positive("1500"),
    refundRate: positive("7.5%"),
  },
  {
    id: "service-08",
    serviceName: "Permit Cancellation",
    serviceCategory: "Permit Services",
    department: "PermitServices",
    applications: positive("123"),
    totalRevenue: positive("88k"),
    approvalRate: positive("88k"),
    avgProcessingTime: positive("3.2d"),
    avgSatisfaction: positive("87.5%"),
    refundApplications: positive("12"),
    totalRefunds: positive("1500"),
    refundRate: positive("7.5%"),
  },
  {
    id: "service-09",
    serviceName: "License Reissue",
    serviceCategory: "Media Licensing",
    department: "MediaLicensing",
    applications: positive("123"),
    totalRevenue: positive("88k"),
    approvalRate: positive("88k"),
    avgProcessingTime: positive("3.2d"),
    avgSatisfaction: positive("87.5%"),
    refundApplications: positive("12"),
    totalRefunds: positive("1500"),
    refundRate: positive("7.5%"),
  },
  {
    id: "service-10",
    serviceName: "Customer Support Review",
    serviceCategory: "Customer Care",
    department: "CustomerCare",
    applications: positive("123"),
    totalRevenue: positive("88k"),
    approvalRate: positive("88k"),
    avgProcessingTime: positive("3.2d"),
    avgSatisfaction: positive("87.5%"),
    refundApplications: positive("12"),
    totalRefunds: positive("1500"),
    refundRate: positive("7.5%"),
  },
];

const geoDistribution = {
  dubai: "20%",
  abuDhabi: "20%",
  sharjah: "20%",
  ajman: "20%",
  rak: "5%",
  fujairah: "5%",
  uaq: "5%",
  foreign: "5%",
};

const userDistribution = {
  individual: "1,000(5%)",
  commercial: "1,000(5%)",
  government: "1,000(5%)",
  freeZone: "1,000(5%)",
  talentAgency: "1,000(5%)",
  embassy: "1,000(5%)",
  consulate: "1,000(5%)",
  culturalClubs: "1,000(5%)",
};

export const customerProfileInsightsRowsMock: CustomerProfileInsightsRow[] = [
  {
    id: "customer-01",
    serviceName: "Ground Photography Permit",
    serviceCategory: "Film & Content Production",
    serviceFilter: "GroundPhotographyPermit",
    applications: { value: "1,498" },
    geographicDistribution: geoDistribution,
    userTypeDistribution: userDistribution,
  },
  {
    id: "customer-02",
    serviceName: "Ground Photography Permit",
    serviceCategory: "Film & Content Production",
    serviceFilter: "GroundPhotographyPermit",
    applications: { value: "1,498" },
    geographicDistribution: geoDistribution,
    userTypeDistribution: userDistribution,
  },
  {
    id: "customer-03",
    serviceName: "Aerial Photography Permit",
    serviceCategory: "Film & Content Production",
    serviceFilter: "AerialPhotographyPermit",
    applications: { value: "1,498" },
    geographicDistribution: geoDistribution,
    userTypeDistribution: userDistribution,
  },
  {
    id: "customer-04",
    serviceName: "Media License Renewal",
    serviceCategory: "Media Licensing",
    serviceFilter: "MediaLicenseRenewal",
    applications: { value: "1,498" },
    geographicDistribution: geoDistribution,
    userTypeDistribution: userDistribution,
  },
  {
    id: "customer-05",
    serviceName: "Foreign Correspondent Permit",
    serviceCategory: "Media Licensing",
    serviceFilter: "ForeignCorrespondentPermit",
    applications: { value: "1,498" },
    geographicDistribution: geoDistribution,
    userTypeDistribution: userDistribution,
  },
  {
    id: "customer-06",
    serviceName: "Ground Photography Permit",
    serviceCategory: "Film & Content Production",
    serviceFilter: "GroundPhotographyPermit",
    applications: { value: "1,498" },
    geographicDistribution: geoDistribution,
    userTypeDistribution: userDistribution,
  },
  {
    id: "customer-07",
    serviceName: "Aerial Photography Permit",
    serviceCategory: "Film & Content Production",
    serviceFilter: "AerialPhotographyPermit",
    applications: { value: "1,498" },
    geographicDistribution: geoDistribution,
    userTypeDistribution: userDistribution,
  },
  {
    id: "customer-08",
    serviceName: "Media License Renewal",
    serviceCategory: "Media Licensing",
    serviceFilter: "MediaLicenseRenewal",
    applications: { value: "1,498" },
    geographicDistribution: geoDistribution,
    userTypeDistribution: userDistribution,
  },
  {
    id: "customer-09",
    serviceName: "Foreign Correspondent Permit",
    serviceCategory: "Media Licensing",
    serviceFilter: "ForeignCorrespondentPermit",
    applications: { value: "1,498" },
    geographicDistribution: geoDistribution,
    userTypeDistribution: userDistribution,
  },
  {
    id: "customer-10",
    serviceName: "Ground Photography Permit",
    serviceCategory: "Film & Content Production",
    serviceFilter: "GroundPhotographyPermit",
    applications: { value: "1,498" },
    geographicDistribution: geoDistribution,
    userTypeDistribution: userDistribution,
  },
];
