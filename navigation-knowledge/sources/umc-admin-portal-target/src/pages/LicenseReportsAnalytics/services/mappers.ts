import { fromApi } from "@/utils/gstTime";
import moment from "moment";
import {
  licenseAnalyticsMockData,
  profileAnalyticsMockData,
  serviceOperationsMockData,
} from "../data";
import type {
  AnalyticsTimeFilter,
  ApplicationTypeKey,
  CsatOverviewData,
  DeviceKey,
  RevenueBreakdownData,
  TeamPerformanceTrendData,
  DonutChartData,
  HorizontalBarItem,
  LicenseAnalyticsData,
  LicenseDistributionRegionKey,
  LicenseDistributionRow,
  LicenseDistributionUserTypeKey,
  LicenseStatusKey,
  LicenseTypeKey,
  PaginatedTableResult,
  ProfileAnalyticsData,
  ProfileTeamRow,
  ReportsAnalyticsTranslationKey,
  ServiceCategoryKey,
  ServiceOperationsAnalyticsData,
  ServicePerformanceRow,
  TeamPerformanceRow,
  TeamPerformanceSummary,
  TrendChartData,
  VerificationMethodKey,
} from "../type";
import type {
  AnalyticsDeviceStat,
  AnalyticsEmirateStat,
  AnalyticsUserTypeStats,
  ApplicationStatusStat,
  CsatAnalysisResponse,
  EconomicActivityStat,
  RevenueAnalyticsResponse,
  RevenueItem,
  SlaPerformanceResponse,
  LicenseDistributionListItem,
  LicenseDistributionListResponse,
  LicenseStatisticsResponse,
  LicenseTrendStat,
  MetricCellMapper,
  MappedDistributionRecords,
  ProfileStatisticsResponse,
  ProfileTeamListResponse,
  RevenueTrendStat,
  ServicePerformanceListResponse,
  ServiceOperationsStatisticsResponse,
  TeamPerformanceListResponse,
  VerificationStat,
} from "./contracts";

interface AnalyticsConfigItem<T extends string> {
  key: T;
  apiLabel: string;
  translationKey: ReportsAnalyticsTranslationKey;
  aliases?: string[];
}

const REPORTS_ANALYTICS_SERIES_KEYS = {
  revenue: "licenseReportsAnalytics.series.revenue",
  serviceApplicationFees: "licenseReportsAnalytics.series.serviceApplicationFees",
  fines: "licenseReportsAnalytics.series.fines",
  refunds: "licenseReportsAnalytics.series.refunds",
  serviceApplications: "licenseReportsAnalytics.series.serviceApplication",
  profileApplication: "licenseReportsAnalytics.series.profileApplication",
} as const satisfies Record<string, ReportsAnalyticsTranslationKey>;

const SERVICE_CATEGORY_ITEMS: readonly AnalyticsConfigItem<ServiceCategoryKey>[] =
  [
    {
      key: "filmContentProduction",
      apiLabel: "Film & Content Production",
      translationKey:
        "licenseReportsAnalytics.options.serviceCategories.filmContentProduction",
    },
    {
      key: "publicationDistribution",
      apiLabel: "Publication & Distribution",
      translationKey:
        "licenseReportsAnalytics.options.serviceCategories.publicationDistribution",
    },
    {
      key: "mediaLicensing",
      apiLabel: "Media Licensing",
      translationKey:
        "licenseReportsAnalytics.options.serviceCategories.mediaLicensing",
    },
    {
      key: "digitalSocialMedia",
      apiLabel: "Digital & Social Media",
      translationKey:
        "licenseReportsAnalytics.options.serviceCategories.digitalSocialMedia",
    },
    {
      key: "videoGames",
      apiLabel: "Video Games",
      translationKey: "licenseReportsAnalytics.options.serviceCategories.videoGames",
    },
    {
      key: "foreignMediaCorrespondents",
      apiLabel: "Foreign Media & Correspondents",
      translationKey:
        "licenseReportsAnalytics.options.serviceCategories.foreignMediaCorrespondents",
    },
    {
      key: "contentReview",
      apiLabel: "Content Review",
      translationKey:
        "licenseReportsAnalytics.options.serviceCategories.contentReview",
    },
    {
      key: "printingPublishing",
      apiLabel: "Printing & Publishing",
      translationKey:
        "licenseReportsAnalytics.options.serviceCategories.printingPublishing",
    },
    {
      key: "cinemaVideoGames",
      apiLabel: "Cinema & Video Games",
      translationKey:
        "licenseReportsAnalytics.options.serviceCategories.cinemaVideoGames",
    },
  ];

const SERVICE_CATEGORY_COLORS: Record<ServiceCategoryKey, string> = {
  filmContentProduction: "#A0D5AB",
  publicationDistribution: "#81C1FF",
  mediaLicensing: "#FAD44F",
  digitalSocialMedia: "#D7BC6D",
  videoGames: "#FAAAA7",
  foreignMediaCorrespondents: "#F5AC7C",
  contentReview: "#81C1FF",
  printingPublishing: "#D7BC6D",
  cinemaVideoGames: "#FAAAA7",
};

const APPLICATION_TYPE_ITEMS: readonly AnalyticsConfigItem<ApplicationTypeKey>[] =
  [
    {
      key: "new",
      apiLabel: "New",
      translationKey: "licenseReportsAnalytics.options.applicationTypes.new",
    },
    {
      key: "renew",
      apiLabel: "Renew",
      translationKey: "licenseReportsAnalytics.options.applicationTypes.renew",
      aliases: ["Renewal"],
    },
    {
      key: "modify",
      apiLabel: "Modify",
      translationKey: "licenseReportsAnalytics.options.applicationTypes.modify",
      aliases: ["Amendment"],
    },
    {
      key: "cancel",
      apiLabel: "Cancel",
      translationKey: "licenseReportsAnalytics.options.applicationTypes.cancel",
      aliases: ["Cancellation"],
    },
    {
      key: "transfer",
      apiLabel: "Transfer",
      translationKey: "licenseReportsAnalytics.options.applicationTypes.transfer",
    },
    {
      key: "partnerManagement",
      apiLabel: "Partner Management",
      translationKey:
        "licenseReportsAnalytics.options.applicationTypes.partnerManagement",
    },
  ];

const APPLICATION_TYPE_COLORS: Record<ApplicationTypeKey, string> = {
  new: "#A0D5AB",
  renew: "#D7BC6D",
  modify: "#FAAAA7",
  cancel: "#C3C6CB",
  transfer: "#FAD44F",
  partnerManagement: "#81C1FF",
};

const DEVICE_ITEMS: readonly AnalyticsConfigItem<DeviceKey>[] = [
  {
    key: "web",
    apiLabel: "Web",
    translationKey: "licenseReportsAnalytics.options.devices.web",
  },
  {
    key: "mobile",
    apiLabel: "Mobile",
    translationKey: "licenseReportsAnalytics.options.devices.mobile",
  },
  {
    key: "tablet",
    apiLabel: "Tablet",
    translationKey: "licenseReportsAnalytics.options.devices.tablet",
  },
];

const DEVICE_COLORS: Record<DeviceKey, string> = {
  web: "#A0D5AB",
  mobile: "#81C1FF",
  tablet: "#C3C6CB",
};

const LICENSE_REGION_COLUMNS: readonly AnalyticsConfigItem<LicenseDistributionRegionKey>[] =
  [
    {
      key: "dubai",
      apiLabel: "Dubai",
      translationKey: "licenseReportsAnalytics.options.locations.dubai",
    },
    {
      key: "abuDhabi",
      apiLabel: "Abu Dhabi",
      translationKey: "licenseReportsAnalytics.options.locations.abuDhabi",
    },
    {
      key: "sharjah",
      apiLabel: "Sharjah",
      translationKey: "licenseReportsAnalytics.options.locations.sharjah",
    },
    {
      key: "ajman",
      apiLabel: "Ajman",
      translationKey: "licenseReportsAnalytics.options.locations.ajman",
    },
    {
      key: "rak",
      apiLabel: "RAK",
      translationKey: "licenseReportsAnalytics.options.locations.rak",
    },
    {
      key: "fujairah",
      apiLabel: "Fujairah",
      translationKey: "licenseReportsAnalytics.options.locations.fujairah",
    },
    {
      key: "uaq",
      apiLabel: "Umm Al Quwain",
      translationKey: "licenseReportsAnalytics.options.locations.uaq",
    },
    {
      key: "foreign",
      apiLabel: "Foreign",
      translationKey: "licenseReportsAnalytics.options.locations.foreign",
    },
  ];

const LOCATION_ORDER: readonly LicenseDistributionRegionKey[] = [
  "dubai",
  "abuDhabi",
  "sharjah",
  "ajman",
  "rak",
  "fujairah",
  "uaq",
  "foreign",
];

const LICENSE_USER_TYPE_COLUMNS: readonly AnalyticsConfigItem<LicenseDistributionUserTypeKey>[] =
  [
    {
      key: "commercial",
      apiLabel: "Commercial",
      translationKey: "licenseReportsAnalytics.options.userTypes.commercial",
    },
    {
      key: "individual",
      apiLabel: "Individual",
      translationKey: "licenseReportsAnalytics.options.userTypes.individual",
    },
    {
      key: "establishment",
      apiLabel: "Establishment",
      translationKey: "licenseReportsAnalytics.options.userTypes.establishment",
    },
    {
      key: "government",
      apiLabel: "Government",
      translationKey: "licenseReportsAnalytics.options.userTypes.government",
    },
    {
      key: "freeZone",
      apiLabel: "Free Zone",
      translationKey: "licenseReportsAnalytics.options.userTypes.freeZone",
    },
    {
      key: "talentAgency",
      apiLabel: "Talent Agency",
      translationKey: "licenseReportsAnalytics.options.userTypes.talentAgency",
    },
    {
      key: "embassy",
      apiLabel: "Embassy",
      translationKey: "licenseReportsAnalytics.options.userTypes.embassy",
    },
    {
      key: "consulate",
      apiLabel: "Consulate",
      translationKey: "licenseReportsAnalytics.options.userTypes.consulate",
    },
    {
      key: "culturalClubs",
      apiLabel: "Cultural Clubs",
      translationKey: "licenseReportsAnalytics.options.userTypes.culturalClubs",
    },
  ];

const USER_TYPE_ORDER: readonly LicenseDistributionUserTypeKey[] = [
  "individual",
  "commercial",
  "talentAgency",
  "freeZone",
  "embassy",
  "consulate",
  "culturalClubs",
  "government",
];

const USER_TYPE_COLORS: Record<LicenseDistributionUserTypeKey, string> = {
  individual: "#A0D5AB",
  establishment: "#81C1FF",
  commercial: "#D7BC6D",
  talentAgency: "#FAAAA7",
  freeZone: "#F5AC7C",
  embassy: "#FAD44F",
  consulate: "#81C1FF",
  culturalClubs: "#F0ABFC",
  government: "#C3C6CB",
};

const VERIFICATION_METHOD_ITEMS: readonly AnalyticsConfigItem<VerificationMethodKey>[] =
  [
    {
      key: "emiratesId",
      apiLabel: "Emirates ID",
      translationKey: "licenseReportsAnalytics.options.verificationMethods.emiratesId",
    },
    {
      key: "uaeUnifiedNumber",
      apiLabel: "UAE Unified Number",
      translationKey:
        "licenseReportsAnalytics.options.verificationMethods.uaeUnifiedNumber",
    },
    {
      key: "passport",
      apiLabel: "Passport",
      translationKey: "licenseReportsAnalytics.options.verificationMethods.passport",
    },
  ];

const VERIFICATION_METHOD_COLORS: Record<VerificationMethodKey, string> = {
  emiratesId: "#A0D5AB",
  uaeUnifiedNumber: "#FAD44F",
  passport: "#C3C6CB",
};

const LICENSE_STATUS_ITEMS: readonly AnalyticsConfigItem<LicenseStatusKey>[] = [
  {
    key: "active",
    apiLabel: "Active",
    translationKey: "licenseReportsAnalytics.options.licenseStatuses.active",
  },
  {
    key: "expiringSoon",
    apiLabel: "Expiring Soon",
    translationKey: "licenseReportsAnalytics.options.licenseStatuses.expiringSoon",
  },
  {
    key: "expired",
    apiLabel: "Expired",
    translationKey: "licenseReportsAnalytics.options.licenseStatuses.expired",
  },
  // Spec §10.1: the API already reports these two; they were missing here, so
  // the donut under-counted and the legend hid them.
  {
    key: "suspended",
    apiLabel: "Suspended",
    translationKey: "licenseReportsAnalytics.options.licenseStatuses.suspended",
  },
  {
    key: "cancelled",
    apiLabel: "Cancelled",
    translationKey: "licenseReportsAnalytics.options.licenseStatuses.cancelled",
  },
];

const LICENSE_STATUS_COLORS: Record<LicenseStatusKey, string> = {
  active: "#A0D5AB",
  expiringSoon: "#FAD44F",
  expired: "#FAAAA7",
  suspended: "#F5B461",
  cancelled: "#C3C6CB",
};

const LICENSE_TYPE_ITEMS: readonly AnalyticsConfigItem<LicenseTypeKey>[] = [
  {
    key: "mediaLicense",
    apiLabel: "Media License",
    translationKey: "licenseReportsAnalytics.options.licenseTypes.mediaLicense",
  },
  {
    key: "photographyEquipmentEntryPermit",
    apiLabel: "Photography Equipment Entry Permit",
    translationKey:
      "licenseReportsAnalytics.options.licenseTypes.photographyEquipmentEntryPermit",
  },
  {
    key: "foreignCorrespondentPermit",
    apiLabel: "Foreign Correspondent Permit",
    translationKey:
      "licenseReportsAnalytics.options.licenseTypes.foreignCorrespondentPermit",
  },
  {
    key: "foreignMediaOfficeLicense",
    apiLabel: "Foreign Media Office License",
    translationKey:
      "licenseReportsAnalytics.options.licenseTypes.foreignMediaOfficeLicense",
  },
  {
    key: "newspaperMediaLicense",
    apiLabel: "Newspaper Media License",
    translationKey:
      "licenseReportsAnalytics.options.licenseTypes.newspaperMediaLicense",
  },
  {
    key: "radioTvBroadcastingLicense",
    apiLabel: "Radio & TV Broadcasting License",
    translationKey:
      "licenseReportsAnalytics.options.licenseTypes.radioTvBroadcastingLicense",
  },
  {
    key: "aerialPhotographyPermit",
    apiLabel: "Aerial Photography Permit",
    translationKey:
      "licenseReportsAnalytics.options.licenseTypes.aerialPhotographyPermit",
  },
  {
    key: "groundPhotographyPermit",
    apiLabel: "Ground Photography Permit",
    translationKey:
      "licenseReportsAnalytics.options.licenseTypes.groundPhotographyPermit",
  },
  {
    key: "pressCardLicense",
    apiLabel: "Press Card License",
    translationKey: "licenseReportsAnalytics.options.licenseTypes.pressCardLicense",
  },
  {
    key: "marinePhotographyPermit",
    apiLabel: "Marine Photography Permit",
    translationKey:
      "licenseReportsAnalytics.options.licenseTypes.marinePhotographyPermit",
  },
];

const LICENSE_TYPE_COLORS: Record<LicenseTypeKey, string> = {
  mediaLicense: "#A0D5AB",
  photographyEquipmentEntryPermit: "#7BC4B8",
  foreignCorrespondentPermit: "#FAAAA7",
  foreignMediaOfficeLicense: "#C3C6CB",
  newspaperMediaLicense: "#81C1FF",
  radioTvBroadcastingLicense: "#F0ABFC",
  aerialPhotographyPermit: "#FAD44F",
  groundPhotographyPermit: "#F5AC7C",
  pressCardLicense: "#9B8CFF",
  marinePhotographyPermit: "#D7BC6D",
};

const matchesApiLabel = <T extends string>(
  items: readonly AnalyticsConfigItem<T>[],
  value: string,
) => {
  const normalizeAnalyticsLabel = (input: string) =>
    input
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();

  const normalizedValue = normalizeAnalyticsLabel(value);

  return items.find((item) => {
    const candidates = [item.apiLabel, item.key, ...(item.aliases || [])];

    return candidates.some(
      (candidate) => normalizeAnalyticsLabel(candidate) === normalizedValue,
    );
  });
};

const findApplicationTypeByApiLabel = (value: string) =>
  matchesApiLabel(APPLICATION_TYPE_ITEMS, value);

const findServiceCategoryByApiLabel = (value: string) =>
  matchesApiLabel(SERVICE_CATEGORY_ITEMS, value);

const APPLICATION_STATUS_COLORS: Record<string, string> = {
  "Pending Initial Approval": "#F5AC7C",
  "Pending Final Approval": "#81C1FF",
  "Pending External Approval": "#FAAAA7",
  "Pending Material Submission": "#FAD44F",
  "Rejected": "#F0ABFC",
  "Completed": "#A0D5AB",
  "Cancelled": "#C3C6CB",
};

const mapApplicationStatusDonut = (
  stats: ApplicationStatusStat[],
): DonutChartData => {
  const total = stats.reduce((sum, item) => sum + item.count, 0);
  return {
    total,
    legends: stats.map((item, index) => ({
      label: item.statusName,
      value: item.count,
      percentage: item.percentage,
      color:
        APPLICATION_STATUS_COLORS[item.statusName] ??
        getFallbackColor(index),
    })),
  };
};

const CSAT_SERIES_COLORS = {
  satisfied: "#A0D5AB",
  neutral: "#81C1FF",
  dissatisfied: "#FAAAA7",
};

const mapCsatOverview = (csat: CsatAnalysisResponse): CsatOverviewData => {
  const satisfied = csat.distribution.find((d) =>
    d.category.toLowerCase().includes("satisfied") &&
    !d.category.toLowerCase().includes("dis"),
  );
  const neutral = csat.distribution.find((d) =>
    d.category.toLowerCase().includes("neutral"),
  );
  const dissatisfied = csat.distribution.find((d) =>
    d.category.toLowerCase().includes("dis"),
  );

  return {
    overallSatisfactionRate: csat.overallSatisfactionRate,
    avgRating: csat.avgRating,
    totalRatings: csat.totalRatings,
    satisfiedCount: satisfied?.count ?? 0,
    satisfiedPct: satisfied?.percentage ?? 0,
    neutralCount: neutral?.count ?? 0,
    neutralPct: neutral?.percentage ?? 0,
    dissatisfiedCount: dissatisfied?.count ?? 0,
    dissatisfiedPct: dissatisfied?.percentage ?? 0,
  };
};

const mapCsatTrend = (csat: CsatAnalysisResponse): TrendChartData => ({
  categories: csat.trend.map((item) => item.period),
  series: [
    {
      name: "Satisfied(4-5)",
      nameKey: "licenseReportsAnalytics.csat.satisfied45" as const,
      color: CSAT_SERIES_COLORS.satisfied,
      values: csat.trend.map((item) => item.satisfactionRate),
    },
    {
      name: "Neutral(3)",
      nameKey: "licenseReportsAnalytics.csat.neutral3" as const,
      color: CSAT_SERIES_COLORS.neutral,
      values: csat.trend.map((item) => item.neutralRate),
    },
    {
      name: "Dissatisfied(1-2)",
      nameKey: "licenseReportsAnalytics.csat.dissatisfied12" as const,
      color: CSAT_SERIES_COLORS.dissatisfied,
      values: csat.trend.map((item) => item.dissatisfactionRate),
    },
  ],
  yAxisSuffix: "%",
  yAxisMin: 0,
  yAxisMax: 100,
  yAxisInterval: 20,
});

const EMPTY_CSAT_ANALYSIS: CsatAnalysisResponse = {
  overallSatisfactionRate: 0,
  avgRating: 0,
  totalRatings: 0,
  distribution: [],
  trend: [],
};

const EMPTY_SLA_PERFORMANCE: SlaPerformanceResponse = {
  slaComplianceRate: 0,
  slaBreachRate: 0,
  avgProcessingTimeDays: 0,
  totalCompleted: 0,
  slaCompliant: 0,
  slaBreached: 0,
  trend: [],
};

const formatProcessingTimeDays = (days: number): string => {
  if (days <= 0) return "0d";
  if (days < 1) {
    const hours = Math.round(days * 24);
    return hours <= 0 ? "0d" : `${hours}h`;
  }
  return `${Math.round(days)}d`;
};

const mapSlaPerformance = (data: SlaPerformanceResponse): TeamPerformanceTrendData => ({
  slaComplianceRate: data.slaComplianceRate,
  slaBreached: data.slaBreached,
  avgProcessingTime: formatProcessingTimeDays(data.avgProcessingTimeDays),
  trend: data.trend.map((item) => ({
    period: item.period,
    slaComplianceRate: item.slaComplianceRate,
    avgProcessingTimeDays: item.avgProcessingTimeDays,
  })),
});

const REVENUE_BREAKDOWN_COLOR = "#C9A427";

const mapRevenueBreakdown = (data: RevenueAnalyticsResponse): RevenueBreakdownData => {
  const toItems = (items: RevenueItem[]) => {
    const total = items.reduce((s, i) => s + i.amount, 0);
    return items.map((item) => ({
      label: item.nameEn,
      value: item.amount,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
    }));
  };

  return {
    topActivitiesByRevenue: {
      color: REVENUE_BREAKDOWN_COLOR,
      items: toItems(data.byActivity),
    },
    topServicesByRevenue: {
      color: REVENUE_BREAKDOWN_COLOR,
      items: toItems(data.byService),
    },
    revenueByApplicationType: {
      color: REVENUE_BREAKDOWN_COLOR,
      items: toItems(data.byApplicationType),
    },
  };
};

const mapTopActivitiesBars = (
  activities: EconomicActivityStat[],
): HorizontalBarData => {
  const total = activities.reduce((sum, item) => sum + item.count, 0);
  return {
    color: "#D7BC6D",
    items: activities.map((item) => ({
      label: item.nameEn,
      value: item.count,
      percentage: calculatePercentage(item.count, total),
    })),
  };
};

const FALLBACK_SERIES_COLORS = [
  "#A0D5AB",
  "#81C1FF",
  "#FAD44F",
  "#D7BC6D",
  "#FAAAA7",
  "#F5AC7C",
  "#F0ABFC",
  "#7BC4B8",
  "#C3C6CB",
];

const LICENSE_TREND_FALLBACK_COLORS = [
  "#5EC2F2",
  "#FF8FB1",
  "#6CCB5F",
  "#FFB86B",
  "#94A3B8",
  "#4FD1C5",
  "#F97316",
  "#A78BFA",
  "#22C55E",
  "#E879F9",
  "#38BDF8",
  "#FB7185",
];

const USER_TYPE_STATUS_KEYS = {
  individual: "individual",
  commercial: "commercial",
  talentAgency: "talentAgency",
  freeZone: "freeZone",
  embassy: "embassy",
  consulate: "consulate",
  culturalClubs: "culturalClubs",
  government: "government",
} as const;

const formatNumber = (
  value: number,
  maximumFractionDigits = 0,
  minimumFractionDigits = 0,
) =>
  Number.isFinite(value)
    ? value.toLocaleString(undefined, {
        maximumFractionDigits,
        minimumFractionDigits,
      })
    : (0).toLocaleString(undefined, {
        maximumFractionDigits,
        minimumFractionDigits,
      });

const formatInteger = (value: number) => formatNumber(value, 0, 0);

const formatPercent = (value: number, maximumFractionDigits = 2) =>
  `${formatNumber(value, maximumFractionDigits, 0)}%`;

const formatSignedPercent = (value: number, maximumFractionDigits = 2) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const prefix = safeValue > 0 ? "+" : safeValue < 0 ? "-" : "";

  return `${prefix}${formatNumber(
    Math.abs(safeValue),
    maximumFractionDigits,
    0,
  )}%`;
};

const formatDateLabel = (value: string) => {
  // Backend sends Dubai wall-clock — take the day/month in the Dubai calendar.
  try {
    const d = fromApi(value);
    return d ? d.format("DD/MM") : value;
  } catch {
    return value;
  }
};

const DEFAULT_TREND_DAYS = 30;
const DAILY_TREND_MAX_DAYS = 14;
const TREND_DATE_TOKEN_REGEXP =
  /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{2}/g;

const resolveTrendRange = (filter?: AnalyticsTimeFilter) => {
  if (filter?.startDate && filter?.endDate) {
    const start = moment(filter.startDate, "YYYY-MM-DD", true).startOf("day");
    const end = moment(filter.endDate, "YYYY-MM-DD", true).startOf("day");

    if (start.isValid() && end.isValid() && !end.isBefore(start, "day")) {
      return {
        start,
        end,
        days: end.diff(start, "days") + 1,
      };
    }
  }

  const days = Math.max(filter?.days ?? DEFAULT_TREND_DAYS, 1);
  const end = moment().startOf("day");
  const start = end.clone().subtract(days - 1, "days");

  return { start, end, days };
};

const shouldUseDailyTrendGranularity = (filter?: AnalyticsTimeFilter) =>
  resolveTrendRange(filter).days <= DAILY_TREND_MAX_DAYS;

const toTrendDayKey = (value: moment.Moment) => value.format("YYYY-MM-DD");

const parseDateToken = (
  token: string,
  range: ReturnType<typeof resolveTrendRange>,
) => {
  const isoDate = moment(token, "YYYY-MM-DD", true);
  if (isoDate.isValid()) {
    return isoDate.startOf("day");
  }

  const fullDate = moment(token, "DD/MM/YYYY", true);
  if (fullDate.isValid()) {
    return fullDate.startOf("day");
  }

  if (/^\d{2}\/\d{2}$/.test(token)) {
    const startYearCandidate = moment(
      `${token}/${range.start.year()}`,
      "DD/MM/YYYY",
      true,
    ).startOf("day");

    if (
      startYearCandidate.isValid() &&
      startYearCandidate.isBetween(range.start, range.end, "day", "[]")
    ) {
      return startYearCandidate;
    }

    const endYearCandidate = moment(
      `${token}/${range.end.year()}`,
      "DD/MM/YYYY",
      true,
    ).startOf("day");

    if (endYearCandidate.isValid()) {
      return endYearCandidate;
    }
  }

  return null;
};

const resolveTrendBucketDays = (
  value: string,
  range: ReturnType<typeof resolveTrendRange>,
) => {
  const directDate = moment(value, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  const parsedDates = directDate.isValid()
    ? [directDate.startOf("day")]
    : (value.match(TREND_DATE_TOKEN_REGEXP) ?? [])
        .map((token) => parseDateToken(token, range))
        .filter((date): date is moment.Moment => Boolean(date));

  if (!parsedDates.length) {
    return [] as string[];
  }

  const start = moment.max(parsedDates[0], range.start);
  const end = moment.min(parsedDates[parsedDates.length - 1], range.end);

  if (!start.isValid() || !end.isValid() || end.isBefore(start, "day")) {
    return [] as string[];
  }

  const cursor = start.clone();
  const dayKeys: string[] = [];

  while (
    !cursor.isAfter(end, "day") &&
    dayKeys.length < DAILY_TREND_MAX_DAYS
  ) {
    dayKeys.push(toTrendDayKey(cursor));
    cursor.add(1, "day");
  }

  return dayKeys;
};

const buildDailyTrendAxis = (filter?: AnalyticsTimeFilter) => {
  if (!shouldUseDailyTrendGranularity(filter)) {
    return null;
  }

  const range = resolveTrendRange(filter);
  const categories: string[] = [];
  const dayKeys: string[] = [];
  const cursor = range.start.clone();

  while (!cursor.isAfter(range.end, "day")) {
    categories.push(cursor.format("DD/MM"));
    dayKeys.push(toTrendDayKey(cursor));
    cursor.add(1, "day");
  }

  return {
    range,
    categories,
    dayKeys,
    dayIndexMap: dayKeys.reduce<Record<string, number>>((result, dayKey, index) => {
      result[dayKey] = index;
      return result;
    }, {}),
  };
};

const buildDailySeriesValues = <T extends { date: string }>(
  items: T[],
  filter: AnalyticsTimeFilter | undefined,
  getValue: (item: T) => number,
) => {
  const dailyAxis = buildDailyTrendAxis(filter);

  if (!dailyAxis) {
    return null;
  }

  const values = Array.from({ length: dailyAxis.categories.length }, () => 0);

  items.forEach((item) => {
    const bucketDays = resolveTrendBucketDays(item.date, dailyAxis.range);

    if (!bucketDays.length) {
      return;
    }

    const bucketValue = getValue(item);
    const normalizedValue = Number.isFinite(bucketValue) ? bucketValue : 0;
    const valuePerDay = normalizedValue / bucketDays.length;

    bucketDays.forEach((dayKey) => {
      const index = dailyAxis.dayIndexMap[dayKey];

      if (typeof index === "number") {
        values[index] += valuePerDay;
      }
    });
  });

  return {
    categories: dailyAxis.categories,
    values,
  };
};

const calculatePercentage = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

const getFallbackColor = (index: number) =>
  FALLBACK_SERIES_COLORS[index % FALLBACK_SERIES_COLORS.length];

const getNextUniqueLicenseTrendColor = (
  usedColors: Set<string>,
  sequenceIndex: number,
) => {
  for (
    let index = sequenceIndex;
    index < sequenceIndex + LICENSE_TREND_FALLBACK_COLORS.length;
    index += 1
  ) {
    const color =
      LICENSE_TREND_FALLBACK_COLORS[
        index % LICENSE_TREND_FALLBACK_COLORS.length
      ];

    if (!usedColors.has(color)) {
      return color;
    }
  }

  let generatedOffset = 0;

  while (true) {
    const hue = Math.round(((sequenceIndex + generatedOffset + 1) * 137.508) % 360);
    const color = `hsl(${hue} 70% 58%)`;

    if (!usedColors.has(color)) {
      return color;
    }

    generatedOffset += 1;
  }
};

const createMetricCell: MetricCellMapper = (value, change, options) => {
  const tone = change > 0 ? "positive" : change < 0 ? "negative" : "neutral";
  const format = options?.format ?? "integer";
  const digits = options?.maximumFractionDigits;

  const formattedValue =
    format === "rate"
      ? formatPercent(value, digits ?? 2)
      : format === "duration"
      ? `${formatNumber(value, digits ?? 1, 0)}d`
      : format === "decimal"
      ? formatNumber(value, digits ?? 2, 0)
      : formatInteger(value);

  return {
    value: formattedValue,
    delta: formatSignedPercent(change, digits ?? 2),
    tone,
  };
};

const formatDurationMetricValue = (value: number | string) => {
  if (typeof value === "string") {
    return value.trim() || "0m";
  }

  return `${formatNumber(value, 1, 0)}d`;
};

const createDurationMetricCell = (
  value: number | string,
  change: number,
): MetricCellData => ({
  value: formatDurationMetricValue(value),
  delta: formatSignedPercent(change),
  tone: change > 0 ? "positive" : change < 0 ? "negative" : "neutral",
});

interface AnalyticsChartEntry {
  label: string;
  labelKey?: ReportsAnalyticsTranslationKey;
  value: number;
  color: string;
}

interface AnalyticsBarEntry {
  label: string;
  labelKey?: ReportsAnalyticsTranslationKey;
  value: number;
}

const toOrderedEntries = <
  TKey extends string,
  TConfig extends {
    key: TKey;
    apiLabel: string;
    translationKey: ReportsAnalyticsTranslationKey;
  },
>(
  configItems: readonly TConfig[],
  availableLabels: string[],
) => {
  const orderedKnownEntries = configItems
    .map((item) => ({
      label: item.apiLabel,
      labelKey: item.translationKey,
      configKey: item.key,
    }))
    .filter((item) => availableLabels.includes(item.label));

  const knownLabels = new Set(orderedKnownEntries.map((item) => item.label));
  const unknownEntries = availableLabels
    .filter((label) => !knownLabels.has(label))
    .map((label) => ({
      label,
      labelKey: undefined,
      configKey: undefined,
    }));

  return [...orderedKnownEntries, ...unknownEntries];
};

const buildHorizontalItems = (
  entries: AnalyticsBarEntry[],
  total?: number,
): HorizontalBarItem[] => {
  const resolvedTotal =
    typeof total === "number"
      ? total
      : entries.reduce((sum, entry) => sum + entry.value, 0);

  return entries.map((entry) => ({
    label: entry.label,
    labelKey: entry.labelKey,
    value: entry.value,
    percentage: calculatePercentage(entry.value, resolvedTotal),
  }));
};

const buildDonutChart = (
  entries: AnalyticsChartEntry[],
  total?: number,
): DonutChartData => {
  const resolvedTotal =
    typeof total === "number"
      ? total
      : entries.reduce((sum, entry) => sum + entry.value, 0);

  return {
    total: resolvedTotal,
    legends: entries.map((entry) => ({
      label: entry.label,
      labelKey: entry.labelKey,
      value: entry.value,
      percentage: calculatePercentage(entry.value, resolvedTotal),
      color: entry.color,
    })),
  };
};

const mapUserTypeValues = (statusStats: AnalyticsUserTypeStats) =>
  USER_TYPE_ORDER.reduce<Record<string, number>>((result, key) => {
    const statusKey =
      USER_TYPE_STATUS_KEYS[key as keyof typeof USER_TYPE_STATUS_KEYS];
    result[key] = statusKey ? statusStats[statusKey] ?? 0 : 0;
    return result;
  }, {});

const mapLocationValues = (emirateStats: AnalyticsEmirateStat[]) => {
  const byName = emirateStats.reduce<Record<string, number>>((result, item) => {
    result[item.emirate] = item.count;
    return result;
  }, {});

  return LOCATION_ORDER.reduce<Record<string, number>>((result, key) => {
    const location = LICENSE_REGION_COLUMNS.find((item) => item.key === key);
    const label = location?.apiLabel || key;

    result[key] = byName[label] ?? 0;
    return result;
  }, {});
};

const mapServiceCategoryValues = (
  categoryStats: ServiceOperationsStatisticsResponse["categoryStats"],
) => {
  return categoryStats.reduce<Record<string, number>>((result, item) => {
    const matchedCategory = findServiceCategoryByApiLabel(item.categoryName);
    const label = matchedCategory?.apiLabel ?? item.categoryName;

    result[label] = (result[label] ?? 0) + item.count;
    return result;
  }, {});
};

const mapServiceApplicationTypeValues = (
  typeStats: ServiceOperationsStatisticsResponse["typeStats"],
) => {
  const byName = typeStats.reduce<Record<string, number>>((result, item) => {
    const option = findApplicationTypeByApiLabel(item.typeName);
    const label = option?.apiLabel ?? item.typeName;
    result[label] = item.count;
    return result;
  }, {});

  return byName;
};

const mapDeviceValues = (deviceStats: AnalyticsDeviceStat[]) =>
  DEVICE_ITEMS.reduce<Record<string, number>>((result, item) => {
    result[item.key] =
      deviceStats.find((entry) => entry.deviceType === item.apiLabel)?.count ??
      0;
    return result;
  }, {});

const mapVerificationValues = (verificationStats: VerificationStat[]) =>
  VERIFICATION_METHOD_ITEMS.reduce<Record<string, number>>((result, item) => {
    result[item.key] =
      verificationStats.find(
        (entry) => entry.verificationMethod === item.apiLabel,
      )?.count ?? 0;
    return result;
  }, {});

const buildCountTrend = (
  seriesNameKey: ReportsAnalyticsTranslationKey,
  color: string,
  rawItems: Array<{ date: string; count?: number; approvedCount?: number }>,
  areaColor?: string,
  filter?: AnalyticsTimeFilter,
) => {
  const getValue = (item: { count?: number; approvedCount?: number }) =>
    item.count ?? item.approvedCount ?? 0;
  const dailySeries = buildDailySeriesValues(
    rawItems.map((item) => ({ date: item.date, count: getValue(item) })),
    filter,
    (item) => item.count,
  );

  return {
    categories:
      dailySeries?.categories ||
      rawItems.map((item) => formatDateLabel(item.date)),
    series: [
      {
        name: seriesNameKey,
        nameKey: seriesNameKey,
        color,
        areaColor,
        values: dailySeries?.values || rawItems.map(getValue),
      },
    ],
  };
};

const buildLicenseTrend = (trendStats: LicenseTrendStat[]) => {
  const availableTypes = Array.from(
    new Set(
      trendStats.flatMap((item) =>
        item.typeCounts.map((typeCount) => typeCount.type),
      ),
    ),
  );
  const orderedEntries = toOrderedEntries(LICENSE_TYPE_ITEMS, availableTypes);
  const usedColors = new Set<string>();
  const fallbackLabelCount = { value: 0 };

  const resolveLicenseTrendColor = (entry: (typeof orderedEntries)[number]) => {
    if (entry.configKey) {
      const configuredColor =
        LICENSE_TYPE_COLORS[
          entry.configKey as keyof typeof LICENSE_TYPE_COLORS
        ];

      if (!usedColors.has(configuredColor)) {
        usedColors.add(configuredColor);
        return configuredColor;
      }
    }

    const fallbackColor = getNextUniqueLicenseTrendColor(
      usedColors,
      fallbackLabelCount.value,
    );

    fallbackLabelCount.value += 1;
    usedColors.add(fallbackColor);
    return fallbackColor;
  };

  return {
    categories: trendStats.map((item) => formatDateLabel(item.date)),
    series: orderedEntries.map((entry) => ({
      name: entry.label,
      nameKey: entry.labelKey,
      color: resolveLicenseTrendColor(entry),
      values: trendStats.map((item) => {
        return (
          item.typeCounts.find((typeCount) => typeCount.type === entry.label)
            ?.count ?? 0
        );
      }),
    })),
  };
};

const buildRevenueTrend = (
  revenueTrendList: RevenueTrendStat[],
  filter?: AnalyticsTimeFilter,
) => {
  const getValues = (key: keyof Omit<RevenueTrendStat, "date">) =>
    revenueTrendList.map((item) => {
      const value = item[key];
      return Number.isFinite(value) ? value ?? 0 : 0;
    });
  const revenueValues = buildDailySeriesValues(
    revenueTrendList,
    filter,
    (item) => item.revenue,
  );

  return {
    categories:
      revenueValues?.categories ||
      revenueTrendList.map((item) => formatDateLabel(item.date)),
    series: [
      {
        name: "Revenue",
        nameKey: REPORTS_ANALYTICS_SERIES_KEYS.revenue,
        color: "#A0D5AB",
        values: revenueValues?.values || getValues("revenue"),
      },
    ],
  };
};

const createEmptyRevenueTrend = () => ({
  categories: [] as string[],
  series: [
    {
      name: "Revenue",
      nameKey: REPORTS_ANALYTICS_SERIES_KEYS.revenue,
      color: "#A0D5AB",
      values: [],
    },
  ],
});

const mapRenewRate = (value: number) => formatPercent(value);

export const mapServiceOperationsAnalyticsResponse = (
  response: ServiceOperationsStatisticsResponse,
  filter?: AnalyticsTimeFilter,
): ServiceOperationsAnalyticsData => {
  const userTypeValues = mapUserTypeValues(response.statusStats);
  const locationValues = mapLocationValues(response.emirateStats);
  const categoryValues = mapServiceCategoryValues(response.categoryStats);
  const typeValues = mapServiceApplicationTypeValues(response.typeStats);
  const categoryEntries = toOrderedEntries(
    SERVICE_CATEGORY_ITEMS,
    response.categoryStats.map((item) => item.categoryName),
  ).map((entry, index) => ({
    label: entry.label,
    labelKey: entry.labelKey,
    value: categoryValues[entry.label] ?? 0,
    color: entry.configKey
      ? SERVICE_CATEGORY_COLORS[
          entry.configKey as keyof typeof SERVICE_CATEGORY_COLORS
        ]
      : getFallbackColor(index),
  }));
  const typeEntries = toOrderedEntries(
    APPLICATION_TYPE_ITEMS,
    Object.keys(typeValues),
  ).map((entry, index) => ({
    label: entry.label,
    labelKey: entry.labelKey,
    value: typeValues[entry.label] ?? 0,
    color: entry.configKey
      ? APPLICATION_TYPE_COLORS[
          entry.configKey as keyof typeof APPLICATION_TYPE_COLORS
        ]
      : getFallbackColor(index),
  }));
  const deviceValues = mapDeviceValues(response.deviceStats);
  const deviceEntries = DEVICE_ITEMS.map((item) => ({
    label: item.apiLabel,
    labelKey: item.translationKey,
    value: deviceValues[item.key] ?? 0,
    color: DEVICE_COLORS[item.key],
  }));
  const userTypeEntries = USER_TYPE_ORDER.map((key) => {
    const item = LICENSE_USER_TYPE_COLUMNS.find((column) => column.key === key);

    return {
      label: item?.apiLabel || key,
      labelKey: item?.translationKey,
      value: userTypeValues[key] ?? 0,
      color: USER_TYPE_COLORS[key],
    };
  });
  const locationEntries = LOCATION_ORDER.map((key) => {
    const item = LICENSE_REGION_COLUMNS.find((column) => column.key === key);

    return {
      label: item?.apiLabel || key,
      labelKey: item?.translationKey,
      value: locationValues[key] ?? 0,
    };
  });

  const applicationStatusDonut = mapApplicationStatusDonut(
    response.applicationStatusDistribution ?? [],
  );
  const topActivitiesBars = mapTopActivitiesBars(
    response.topEconomicActivities ?? [],
  );

  return {
    summaryCards: [
      {
        key: "totalApplications",
        value: formatInteger(response.totalApplications),
        iconKey: "applications",
      },
      {
        key: "publishedServices",
        value: formatPercent(response.totalPublishServices, 1),
        iconKey: "services",
      },
      {
        key: "approvalRate",
        value: formatPercent(response.approvalRate),
        iconKey: "approval",
      },
      {
        key: "avgProcessingTime",
        value: response.avgProcessingTime ?? "0m",
        iconKey: "avgProcessingTime",
      },
      {
        key: "totalRevenue",
        value: formatNumber(response.totalRevenue, 2, 0),
        iconKey: "revenue",
        valuePrefix: "AED",
      },
      {
        key: "avgSatisfaction",
        value: formatPercent(response.avgSatisfaction),
        iconKey: "satisfaction",
      },
    ],
    applicationStatusDonut,
    topActivitiesBars,
    categoryDonut: buildDonutChart(categoryEntries),
    typeDonut: buildDonutChart(typeEntries),
    deviceDonut: buildDonutChart(deviceEntries),
    locationBars: {
      color: "#81C1FF",
      items: buildHorizontalItems(locationEntries),
    },
    userTypeDonut: buildDonutChart(
      userTypeEntries,
      response.statusStats.total,
    ),
    csatOverview: mapCsatOverview(response.csatAnalysis ?? EMPTY_CSAT_ANALYSIS),
    csatTrend: mapCsatTrend(response.csatAnalysis ?? EMPTY_CSAT_ANALYSIS),
    teamPerformanceTrend: mapSlaPerformance(
      response.slaPerformance ?? EMPTY_SLA_PERFORMANCE,
    ),
    revenueBreakdown: mapRevenueBreakdown(
      response.revenueAnalytics ?? { byActivity: [], byService: [], byApplicationType: [] },
    ),
    revenueTrend: response.revenueTrendList?.length
      ? buildRevenueTrend(response.revenueTrendList, filter)
      : createEmptyRevenueTrend(),
    serviceApplicationTrend: buildCountTrend(
      REPORTS_ANALYTICS_SERIES_KEYS.serviceApplications,
      "#A0D5AB",
      response.trendStats,
      "rgba(160,213,171,0.18)",
      filter,
    ),
  };
};

export const mapProfileAnalyticsResponse = (
  response: ProfileStatisticsResponse,
  language = "en",
): ProfileAnalyticsData => {
  const locationValues = mapLocationValues(response.emirateStats);
  const verificationValues = mapVerificationValues(response.verificationStats);
  const deviceValues = mapDeviceValues(response.deviceStats);
  const userTypeColors: readonly string[] = [
    ...Object.values(USER_TYPE_COLORS),
  ];
  const userTypeEntries = response.statusStats.types.map((item, index) => ({
    label:
      language.trim().toLowerCase().startsWith("ar")
        ? item.nameAr || item.nameEn
        : item.nameEn || item.nameAr,
    value: item.count,
    color: userTypeColors[index % userTypeColors.length] ?? "#C3C6CB",
  }));
  const locationEntries = LOCATION_ORDER.map((key) => {
    const item = LICENSE_REGION_COLUMNS.find((column) => column.key === key);

    return {
      label: item?.apiLabel || key,
      labelKey: item?.translationKey,
      value: locationValues[key] ?? 0,
    };
  });
  const verificationEntries = VERIFICATION_METHOD_ITEMS.map((item) => ({
    label: item.apiLabel,
    labelKey: item.translationKey,
    value: verificationValues[item.key] ?? 0,
    color: VERIFICATION_METHOD_COLORS[item.key],
  }));
  const deviceEntries = DEVICE_ITEMS.map((item) => ({
    label: item.apiLabel,
    labelKey: item.translationKey,
    value: deviceValues[item.key] ?? 0,
    color: DEVICE_COLORS[item.key],
  }));

  return {
    summaryCards: [
      {
        key: "totalProfileApplications",
        value: formatInteger(response.totalProfileApplications ?? 0),
        iconKey: "services",
      },
      {
        key: "verifiedProfiles",
        value: formatInteger(response.verifiedProfiles ?? 0),
        iconKey: "approval",
      },
      {
        key: "profileVerificationRate",
        value: formatPercent(response.profileVerificationRate ?? 0),
        iconKey: "satisfaction",
      },
    ],
    userTypeDonut: buildDonutChart(userTypeEntries, response.statusStats.total),
    profileApplicationTrend: buildCountTrend(
      REPORTS_ANALYTICS_SERIES_KEYS.profileApplication,
      "#D7BC6D",
      response.trendStats,
      "rgba(215,188,109,0.18)",
    ),
    locationBars: {
      color: "#D7BC6D",
      items: buildHorizontalItems(locationEntries),
    },
    verificationMethodDonut: buildDonutChart(verificationEntries),
    deviceDonut: buildDonutChart(deviceEntries),
  };
};

export const mapLicenseAnalyticsResponse = (
  response: LicenseStatisticsResponse,
): LicenseAnalyticsData => {
  const userTypeValues = LICENSE_USER_TYPE_COLUMNS.reduce<
    Record<string, number>
  >((result, item) => {
    result[item.key] =
      response.userTypeStats.find((stat) => stat.userType === item.apiLabel)
        ?.count ?? 0;
    return result;
  }, {});
  const locationValues = mapLocationValues(response.emirateStats);
  const statusEntries = LICENSE_STATUS_ITEMS.map((item) => ({
    label: item.apiLabel,
    labelKey: item.translationKey,
    value: response.statusStats[item.key] ?? 0,
    color: LICENSE_STATUS_COLORS[item.key],
  }));
  const userTypeEntries = LICENSE_USER_TYPE_COLUMNS.map((item) => ({
    label: item.apiLabel,
    labelKey: item.translationKey,
    value: userTypeValues[item.key] ?? 0,
    color: USER_TYPE_COLORS[item.key],
  }));
  const locationEntries = LOCATION_ORDER.map((key) => {
    const item = LICENSE_REGION_COLUMNS.find((column) => column.key === key);

    return {
      label: item?.apiLabel || key,
      labelKey: item?.translationKey,
      value: locationValues[key] ?? 0,
    };
  });

  return {
    statusDonut: buildDonutChart(statusEntries, response.statusStats.total),
    issuedTrend: buildLicenseTrend(response.trendStats),
    /* Pie per Figma node 44485:65711 - was a horizontal bars card. */
    userTypeDonut: buildDonutChart(userTypeEntries),
    locationBars: {
      color: "#D7BC6D",
      items: buildHorizontalItems(locationEntries),
    },
    renewalRate: mapRenewRate(response.statusStats.renewRate),
  };
};

export const mapProfileTeamResponse = (
  response: ProfileTeamListResponse,
): PaginatedTableResult<ProfileTeamRow> => ({
  pageIndex: response.pageIndex,
  pageSize: response.pageSize,
  total: response.total,
  items: response.items.map((item, index) => ({
    id: `profile-team-${response.pageIndex}-${index + 1}`,
    memberName: item.teamMember.trim() || "-",
    applicationTasks: createMetricCell(
      item.applicationTasks,
      item.applicationTasksChange,
    ),
    approvedApplications: createMetricCell(
      item.approvedApplications,
      item.approvedApplicationsChange,
    ),
    rejectedApplications: createMetricCell(
      item.rejectedApplications,
      item.rejectedApplicationsChange,
    ),
    approvalRate: createMetricCell(item.approvalRate, item.approvalRateChange, {
      format: "rate",
    }),
  })),
});

export const mapServicePerformanceResponse = (
  response: ServicePerformanceListResponse,
): PaginatedTableResult<ServicePerformanceRow> => ({
  pageIndex: response.pageIndex,
  pageSize: response.pageSize,
  total: response.total,
  items: response.items.map((item, index) => ({
    id: `service-performance-${response.pageIndex}-${index + 1}`,
    category: item.serviceCategory?.trim() || "-",
    categoryKey: findServiceCategoryByApiLabel(item.serviceCategory?.trim() || "")
      ?.key,
    serviceName: item.serviceName?.trim() || "-",
    applications: createMetricCell(item.applications, item.applicationsChange),
    totalRevenue: createMetricCell(item.totalRevenue, item.totalRevenueChange, {
      format: "decimal",
      maximumFractionDigits: 2,
    }),
    approvalRate: createMetricCell(item.approvalRate, item.approvalRateChange, {
      format: "rate",
    }),
    avgProcessingTime: createDurationMetricCell(
      item.avgProcessingTime,
      item.avgProcessingTimeChange,
    ),
    avgSatisfaction: createMetricCell(
      item.avgSatisfaction,
      item.avgSatisfactionChange,
      { format: "rate" },
    ),
    refundApplications: createMetricCell(
      item.refundApplications,
      item.refundApplicationsChange,
    ),
    totalRefunds: createMetricCell(item.totalRefunds, item.totalRefundsChange, {
      format: "decimal",
      maximumFractionDigits: 2,
    }),
    refundRate: createMetricCell(item.refundRate, item.refundRateChange, {
      format: "rate",
    }),
  })),
});

export const mapTeamPerformanceResponse = (
  response: TeamPerformanceListResponse,
): {
  summary: TeamPerformanceSummary[];
  table: PaginatedTableResult<TeamPerformanceRow>;
} => ({
  summary: [
    {
      key: "sla",
      value: formatPercent(response.avgSLACompliance, 1),
      iconKey: "teamSla",
    },
    {
      key: "processing",
      value: formatDurationMetricValue(response.avgProcessingTime),
      iconKey: "teamProcessing",
    },
    {
      key: "approval",
      value: formatPercent(response.avgApprovalRate, 1),
      iconKey: "teamApproval",
    },
  ],
  table: {
    pageIndex: response.page.pageIndex,
    pageSize: response.page.pageSize,
    total: response.page.total,
    items: response.page.items.map((item, index) => ({
      id: `team-performance-${response.page.pageIndex}-${index + 1}`,
      memberName: item.teamMember.trim() || "-",
      applicationTasks: createMetricCell(
        item.applicationTasks,
        item.applicationTasksChange,
      ),
      approvedApplications: createMetricCell(
        item.approvedApplications,
        item.approvedApplicationsChange,
      ),
      rejectedApplications: createMetricCell(
        item.rejectedApplications,
        item.rejectedApplicationsChange,
      ),
      approvalRate: createMetricCell(
        item.approvalRate,
        item.approvalRateChange,
        { format: "rate" },
      ),
      avgProcessingTime: createDurationMetricCell(
        item.avgProcessingTime,
        item.avgProcessingTimeChange,
      ),
      sla: createMetricCell(item.sla, item.slaChange, { format: "rate" }),
      slaBreaches: createMetricCell(
        Number(item.slaBreachesCount ?? 0),
        Number(item.slaBreachesChange ?? 0),
      ),
    })),
  },
});

const mapDistributionRecord = (
  item: LicenseDistributionListItem,
): MappedDistributionRecords => {
  const geographicDistribution = LICENSE_REGION_COLUMNS.reduce<
    LicenseDistributionRow["geographicDistribution"]
  >((result, column) => {
    const regionName = column.apiLabel;
    const percentage =
      item.geographicDistribution.find((entry) => entry.region === regionName)
        ?.percentage ?? 0;

    result[column.key] = formatPercent(percentage);
    return result;
  }, {} as LicenseDistributionRow["geographicDistribution"]);

  const userTypeDistribution = LICENSE_USER_TYPE_COLUMNS.reduce<
    LicenseDistributionRow["userTypeDistribution"]
  >((result, column) => {
    const percentage =
      item.userTypeDistribution.find(
        (entry) => entry.userType === column.apiLabel,
      )?.percentage ?? 0;

    result[column.key] = formatPercent(percentage);
    return result;
  }, {} as LicenseDistributionRow["userTypeDistribution"]);

  return {
    geographicDistribution,
    userTypeDistribution,
  };
};

export const mapLicenseDistributionResponse = (
  response: LicenseDistributionListResponse,
): PaginatedTableResult<LicenseDistributionRow> => ({
  pageIndex: response.pageIndex,
  pageSize: response.pageSize,
  total: response.total,
  items: response.items.map((item, index) => {
    const distributions = mapDistributionRecord(item);

    return {
      id: `license-report-${response.pageIndex}-${index + 1}`,
      license: item.license,
      issued: formatInteger(item.issued),
      active: formatInteger(item.active),
      expiringSoon: formatInteger(item.expiringSoon),
      expired: formatInteger(item.expired),
      geographicDistribution: distributions.geographicDistribution,
      userTypeDistribution: distributions.userTypeDistribution,
    };
  }),
});

export const createEmptyServiceOperationsAnalyticsData =
  (): ServiceOperationsAnalyticsData =>
    mapServiceOperationsAnalyticsResponse({
      totalPublishServices: 0,
      totalApplications: 0,
      totalRevenue: 0,
      totalRefunds: 0,
      refundApplications: 0,
      approvalRate: 0,
      avgProcessingTime: "0m",
      avgSatisfaction: 0,
      statusStats: {
        total: 0,
        individual: 0,
        commercial: 0,
        talentAgency: 0,
        freeZone: 0,
        embassy: 0,
        consulate: 0,
        culturalClubs: 0,
        government: 0,
      },
      emirateStats: [],
      trendStats: [],
      deviceStats: [],
      categoryStats: [],
      typeStats: [],
      revenueTrendList: [],
    });

export const createEmptyProfileAnalyticsData = (): ProfileAnalyticsData =>
  mapProfileAnalyticsResponse({
    statusStats: {
      total: 0,
      individual: 0,
      commercial: 0,
      talentAgency: 0,
      freeZone: 0,
      embassy: 0,
      consulate: 0,
      culturalClubs: 0,
      government: 0,
      types: [],
    },
    emirateStats: [],
    trendStats: [],
    verificationStats: [],
    deviceStats: [],
    totalProfileApplications: 0,
    verifiedProfiles: 0,
    profileVerificationRate: 0,
  }, "en");

export const createEmptyLicenseAnalyticsData = (): LicenseAnalyticsData =>
  mapLicenseAnalyticsResponse({
    statusStats: {
      total: 0,
      active: 0,
      activePercentage: 0,
      expiringSoon: 0,
      expiringSoonPercentage: 0,
      expired: 0,
      expiredPercentage: 0,
      suspended: 0,
      suspendedPercentage: 0,
      cancelled: 0,
      cancelledPercentage: 0,
      renewRate: 0,
    },
    userTypeStats: [],
    emirateStats: [],
    trendStats: [],
  });

export const profileAnalyticsFallback = () => profileAnalyticsMockData;

export const serviceOperationsAnalyticsFallback = () =>
  serviceOperationsMockData;

export const licenseAnalyticsFallback = () => licenseAnalyticsMockData;
