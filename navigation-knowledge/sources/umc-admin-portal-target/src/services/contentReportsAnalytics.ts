import request from "@/utils/request";
import saveFileWithAxios from "@/utils/saveFileWithAxios";
import type {
  AnalyticsTableParams,
  AnalyticsTimeFilter,
  ContentLibraryAnalyticsData,
  ContentLibraryRow,
  DonutChartData,
  MetricCellData,
  PaginatedTableResult,
  PermitAnalyticsData,
  PermitDistributionItem,
  PermitRow,
  ReportsAnalyticsTranslationKey,
  ServiceOperationsAnalyticsData,
  ServicePerformanceOption,
  ServicePerformanceRow,
  TeamPerformanceRow,
  TeamPerformanceSummary,
} from "@/pages/ContentReportsAnalytics/type";

const DEFAULT_DAYS = 30;
const DEFAULT_PAGE_INDEX = 1;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SERVICE_OPTION: ServicePerformanceOption = "AllCategories";
export type MediaContentReportExportParams = {
  dateFrom?: string;
  dateTo?: string;
  profileType?: number;
  materialType?: string | number;
  type?: "Magazine" | "Newspaper";
  serviceCode?: number;
};

export type BookCirculationServiceOption = {
  serviceName: string;
  serviceCode: string;
};

export const getBookCirculationServiceOptions = () =>
  request.get<
    ApiEnvelope<BookCirculationServiceOption[]>,
    ApiEnvelope<BookCirculationServiceOption[]>
  >(
    "/api/MediaContentReports/BookCirculationPrintingPermit/ServiceOptions",
  );

const omitEmptyValues = (params: object) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );

const COLORS: string[] = [
  "#A0D5AB",
  "#81C1FF",
  "#FAD44F",
  "#FAAAA7",
  "#F5AC7C",
  "#C3C6CB",
  "#F0ABFC",
  "#D7BC6D",
];

type ApiEnvelope<T> = {
  isSuccess: boolean;
  statusCode: number;
  message: string;
  data: T;
};

type AnalyticsListParams = AnalyticsTimeFilter & {
  keyword?: string;
  option?: ServicePerformanceOption;
  pageIndex?: number;
  pageSize?: number;
  orderby?: string;
  sort?: "asc" | "desc";
};

type CountPercentageItem = {
  count: number;
  percentage: number;
};

type ChartLabelSourceItem = CountPercentageItem & {
  label: string;
  labelKey?: ReportsAnalyticsTranslationKey;
  labelAr?: string;
};

const normalizeAnalyticsLabel = (value?: string | null) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "");

const APPLICATION_STATUS_LABEL_KEYS: Record<string, ReportsAnalyticsTranslationKey> = {
  cancelled: "contentReportsAnalytics.options.applicationStatuses.cancelled",
  canceled: "contentReportsAnalytics.options.applicationStatuses.cancelled",
  completed: "contentReportsAnalytics.options.applicationStatuses.completed",
  pendingexternalapproval:
    "contentReportsAnalytics.options.applicationStatuses.pendingExternalApproval",
  pendingfinalapproval:
    "contentReportsAnalytics.options.applicationStatuses.pendingFinalApproval",
  pendinginitialapproval:
    "contentReportsAnalytics.options.applicationStatuses.pendingInitialApproval",
  pendingmaterialsubmission:
    "contentReportsAnalytics.options.applicationStatuses.pendingMaterialSubmission",
  rejected: "contentReportsAnalytics.options.applicationStatuses.rejected",
};

const AI_TAG_LABEL_KEYS: Record<string, ReportsAnalyticsTranslationKey> = {
  adultcontent: "contentReportsAnalytics.options.aiTags.adultContent",
  artificialsensitivity: "contentReportsAnalytics.options.aiTags.artificialSensitivity",
  childprotection: "contentReportsAnalytics.options.aiTags.childProtection",
  lgbtcontent: "contentReportsAnalytics.options.aiTags.lgbtContent",
  lgbtcontentroyalfamily:
    "contentReportsAnalytics.options.aiTags.lgbtContentRoyalFamily",
  lgbtpluscontent: "contentReportsAnalytics.options.aiTags.lgbtContent",
  lgbtpluscontentroyalfamily:
    "contentReportsAnalytics.options.aiTags.lgbtContentRoyalFamily",
  maliciouscontent: "contentReportsAnalytics.options.aiTags.maliciousContent",
  politicalsensitive: "contentReportsAnalytics.options.aiTags.politicalSensitivity",
  politicalsensitivity: "contentReportsAnalytics.options.aiTags.politicalSensitivity",
  prohibitedwords: "contentReportsAnalytics.options.aiTags.prohibitedWords",
  religiouscontent: "contentReportsAnalytics.options.aiTags.religiousContent",
  royalfamily: "contentReportsAnalytics.options.aiTags.royalFamily",
  violenceandhatespeech:
    "contentReportsAnalytics.options.aiTags.violenceAndHateSpeech",
  violencehatespeech: "contentReportsAnalytics.options.aiTags.violenceAndHateSpeech",
};

const USER_TYPE_LABEL_KEYS: Record<string, ReportsAnalyticsTranslationKey> = {
  commercial: "contentReportsAnalytics.options.userTypes.commercial",
  commercialentity:
    "contentReportsAnalytics.options.userTypes.commercialEntity",
  consulate: "contentReportsAnalytics.options.userTypes.consulate",
  culturalclub: "contentReportsAnalytics.options.userTypes.culturalClubs",
  culturalclubs: "contentReportsAnalytics.options.userTypes.culturalClubs",
  embassy: "contentReportsAnalytics.options.userTypes.embassy",
  freezone: "contentReportsAnalytics.options.userTypes.freeZone",
  government: "contentReportsAnalytics.options.userTypes.government",
  governmententity: "contentReportsAnalytics.options.userTypes.government",
  individual: "contentReportsAnalytics.options.userTypes.individual",
  clearingagency:
    "contentReportsAnalytics.options.userTypes.shippingClearingAgency",
  shippingcompany:
    "contentReportsAnalytics.options.userTypes.shippingClearingAgency",
  shippingcompanyclearingagency:
    "contentReportsAnalytics.options.userTypes.shippingClearingAgency",
  talentagency: "contentReportsAnalytics.options.userTypes.talentAgency",
};

const LOCATION_LABEL_KEYS: Record<string, ReportsAnalyticsTranslationKey> = {
  abudhabi: "contentReportsAnalytics.options.locations.abuDhabi",
  ajman: "contentReportsAnalytics.options.locations.ajman",
  dubai: "contentReportsAnalytics.options.locations.dubai",
  foreign: "contentReportsAnalytics.options.locations.foreign",
  fujairah: "contentReportsAnalytics.options.locations.fujairah",
  outsideuae: "contentReportsAnalytics.options.locations.foreign",
  rak: "contentReportsAnalytics.options.locations.rak",
  rasalkhaimah: "contentReportsAnalytics.options.locations.rak",
  sharjah: "contentReportsAnalytics.options.locations.sharjah",
  uaq: "contentReportsAnalytics.options.locations.uaq",
  ummalquwain: "contentReportsAnalytics.options.locations.uaq",
};

const SERVICE_CATEGORY_LABEL_KEYS: Record<string, ReportsAnalyticsTranslationKey> = {
  digitalandsocialmedia:
    "contentReportsAnalytics.options.serviceCategories.digitalSocialMedia",
  digitalsocialmedia:
    "contentReportsAnalytics.options.serviceCategories.digitalSocialMedia",
  filmandcontentproduction:
    "contentReportsAnalytics.options.serviceCategories.filmContentProduction",
  filmcontentproduction:
    "contentReportsAnalytics.options.serviceCategories.filmContentProduction",
  foreignmediaandcorrespondents:
    "contentReportsAnalytics.options.serviceCategories.foreignMediaCorrespondents",
  foreignmediacorrespondents:
    "contentReportsAnalytics.options.serviceCategories.foreignMediaCorrespondents",
  medialicensing: "contentReportsAnalytics.options.serviceCategories.mediaLicensing",
  publicationanddistribution:
    "contentReportsAnalytics.options.serviceCategories.publicationDistribution",
  publicationdistribution:
    "contentReportsAnalytics.options.serviceCategories.publicationDistribution",
  videogames: "contentReportsAnalytics.options.serviceCategories.videoGames",
};

const DEVICE_LABEL_KEYS: Record<string, ReportsAnalyticsTranslationKey> = {
  android: "contentReportsAnalytics.options.devices.mobile",
  ios: "contentReportsAnalytics.options.devices.mobile",
  mobile: "contentReportsAnalytics.options.devices.mobile",
  tablet: "contentReportsAnalytics.options.devices.tablet",
  web: "contentReportsAnalytics.options.devices.web",
};

const CONFIRMATION_METHOD_LABEL_KEYS: Record<string, ReportsAnalyticsTranslationKey> = {
  autoapproved: "contentReportsAnalytics.options.confirmationMethods.autoApproved",
  manuallyconfirmed:
    "contentReportsAnalytics.options.confirmationMethods.manuallyConfirmed",
  selfmonitored:
    "contentReportsAnalytics.options.confirmationMethods.selfMonitored",
};

const SATISFACTION_LABEL_KEYS: Record<string, ReportsAnalyticsTranslationKey> = {
  dissatisfied: "contentReportsAnalytics.options.satisfaction.dissatisfied12",
  dissatisfied12: "contentReportsAnalytics.options.satisfaction.dissatisfied12",
  neutral: "contentReportsAnalytics.options.satisfaction.neutral3",
  neutral3: "contentReportsAnalytics.options.satisfaction.neutral3",
  satisfied: "contentReportsAnalytics.options.satisfaction.satisfied45",
  satisfied45: "contentReportsAnalytics.options.satisfaction.satisfied45",
};

const LICENSE_STATUS_LABEL_KEYS: Record<string, ReportsAnalyticsTranslationKey> = {
  active: "contentReportsAnalytics.options.licenseStatuses.active",
  expired: "contentReportsAnalytics.options.licenseStatuses.expired",
  expiringsoon: "contentReportsAnalytics.options.licenseStatuses.expiringSoon",
  expiressoon: "contentReportsAnalytics.options.licenseStatuses.expiringSoon",
};

const CONTENT_STATUS_LABEL_KEYS: Record<string, ReportsAnalyticsTranslationKey> = {
  approved: "contentReportsAnalytics.series.approved",
  pendingreview: "contentReportsAnalytics.series.pendingReview",
  rejected: "contentReportsAnalytics.series.rejected",
};

const CONTENT_TYPE_LABEL_KEYS: Record<string, ReportsAnalyticsTranslationKey> = {
  book: "contentReportsAnalytics.series.books",
  books: "contentReportsAnalytics.series.books",
  cinema: "contentReportsAnalytics.series.cinema",
  document: "contentReportsAnalytics.series.document",
  documents: "contentReportsAnalytics.series.document",
  image: "contentReportsAnalytics.series.image",
  images: "contentReportsAnalytics.series.image",
  movie: "contentReportsAnalytics.series.cinema",
  movies: "contentReportsAnalytics.series.cinema",
  newspapermagazine: "contentReportsAnalytics.series.newspaperMagazine",
  newspapersmagazines: "contentReportsAnalytics.series.newspaperMagazine",
  newspaper: "contentReportsAnalytics.series.newspaperMagazine",
  newspapers: "contentReportsAnalytics.series.newspaperMagazine",
  video: "contentReportsAnalytics.series.video",
  videogame: "contentReportsAnalytics.series.videoGames",
  videogames: "contentReportsAnalytics.series.videoGames",
  videos: "contentReportsAnalytics.series.video",
};

const resolveLabelKey = (
  value: string | undefined,
  map: Record<string, ReportsAnalyticsTranslationKey>,
) => map[normalizeAnalyticsLabel(value)];

const resolveApplicationStatusLabelKey = (value: string) =>
  resolveLabelKey(value, APPLICATION_STATUS_LABEL_KEYS);

const resolveAiTagLabelKey = (value: string) =>
  resolveLabelKey(value, AI_TAG_LABEL_KEYS);

const resolveUserTypeLabelKey = (value: string) =>
  resolveLabelKey(value, USER_TYPE_LABEL_KEYS);

const resolveLocationLabelKey = (value: string) =>
  resolveLabelKey(value, LOCATION_LABEL_KEYS);

const resolveServiceCategoryLabelKey = (value: string) =>
  resolveLabelKey(value, SERVICE_CATEGORY_LABEL_KEYS);

const resolveDeviceLabelKey = (value: string) =>
  resolveLabelKey(value, DEVICE_LABEL_KEYS);

const resolveConfirmationMethodLabelKey = (value: string) =>
  resolveLabelKey(value, CONFIRMATION_METHOD_LABEL_KEYS);

const resolveSatisfactionLabelKey = (value: string) =>
  resolveLabelKey(value, SATISFACTION_LABEL_KEYS);

const resolveLicenseStatusLabelKey = (value: string) =>
  resolveLabelKey(value, LICENSE_STATUS_LABEL_KEYS);

const resolveContentStatusLabelKey = (value: string) =>
  resolveLabelKey(value, CONTENT_STATUS_LABEL_KEYS);

const resolveContentTypeLabelKey = (value: string) =>
  resolveLabelKey(value, CONTENT_TYPE_LABEL_KEYS);

type ServiceOperationsStatisticsResponse = {
  aiRecommendation?: {
    aiRecommendedApproval?: number;
    aiRecommendedRejection?: number;
    aiRecommendationAdoptionRate?: number;
  };
  aiTags?: Array<{
    tag: string;
    count: number;
    percentage: number;
  }>;
  applicationStatusDistribution?: Array<{
    statusName: string;
    count: number;
    percentage: number;
  }>;
  mediaMaterialTypeDistribution?: Array<{
    typeName: string;
    count: number;
    percentage: number;
  }>;
  permitsIssued?: number;
  totalPublishServices?: number;
  totalApplications?: number;
  totalRevenue?: number;
  totalRefunds?: number;
  refundApplications?: number;
  approvalRate?: number;
  avgProcessingTime?: string;
  avgSatisfaction?: number;
  statusStats?: {
    total?: number;
    individual?: number;
    commercial?: number;
    talentAgency?: number;
    freeZone?: number;
    embassy?: number;
    consulate?: number;
    culturalClubs?: number;
    government?: number;
  };
  emirateStats?: Array<{
    emirate: string;
    count: number;
    percentage: number;
  }>;
  trendStats?: Array<{
    date: string;
    count?: number;
    approvedCount?: number;
    unit?: string;
  }>;
  deviceStats?: Array<{
    deviceType: string;
    count: number;
  }>;
  confirmationMethodStats?: {
    total?: number;
    selfMonitored?: number;
    selfMonitoredPercentage?: number;
    autoApproved?: number;
    autoApprovedPercentage?: number;
    manuallyConfirmed?: number;
    manuallyConfirmedPercentage?: number;
  };
  categoryStats?: Array<{
    categoryName: string;
    count: number;
    percentage: number;
  }>;
  typeStats?: Array<{
    typeName: string;
    count: number;
    percentage: number;
  }>;
  revenueTrendList?: Array<{
    date: string;
    serviceApplicationFees: number;
    revenue: number;
    unit?: string;
  }>;
  slaPerformance?: {
    slaComplianceRate?: number;
    slaBreachRate?: number;
    avgProcessingTimeDays?: number;
    slaCompliant?: number;
    slaBreached?: number;
    trend?: Array<{
      period: string;
      slaComplianceRate?: number;
      avgProcessingTimeDays?: number;
    }>;
  };
  csatAnalysis?: {
    overallSatisfactionRate?: number;
    avgRating?: number;
    totalRatings?: number;
    distribution?: Array<{
      category: string;
      count: number;
      percentage: number;
    }>;
    trend?: Array<{
      period: string;
      satisfactionRate: number;
      neutralRate: number;
      dissatisfactionRate: number;
    }>;
  };
};

type ServicePerformanceListResponse = {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: Array<{
    serviceName: string;
    serviceCategory: string | null;
    applications: number;
    applicationsChange: number;
    totalRevenue: number;
    totalRevenueChange: number;
    approvalRate: number;
    approvalRateChange: number;
    /** Same formatted-duration string the team endpoint returns ("0m", "3.2d"). */
    avgProcessingTime: number | string;
    avgProcessingTimeChange: number;
    avgSatisfaction: number;
    avgSatisfactionChange: number;
    refundApplications: number;
    refundApplicationsChange: number;
    totalRefunds: number;
    totalRefundsChange: number;
    refundRate: number;
    refundRateChange: number;
  }>;
};

type TeamPerformanceListResponse = {
  avgSLACompliance: number;
  avgProcessingTime: number | string;
  avgApprovalRate: number;
  page: {
    pageIndex: number;
    pageSize: number;
    total: number;
    items: Array<{
      teamMember: string;
      applicationTasks: number;
      applicationTasksChange: number;
      approvedApplications: number;
      approvedApplicationsChange: number;
      rejectedApplications: number;
      rejectedApplicationsChange: number;
      approvalRate: number;
      approvalRateChange: number;
      /**
       * Already formatted by the API as a duration string ("0m", "3.2d").
       * Declared as a union because older payloads sent a raw day count.
       */
      avgProcessingTime: number | string;
      avgProcessingTimeChange: number;
      sla: number;
      slaChange: number;
      /** Completed-but-overdue task count (spec §8). */
      slaBreachesCount?: number;
      slaBreachesChange?: number;
    }>;
  };
};

type PermitStatisticsResponse = {
  permitsByUserType?: Array<{
    userType: string;
    count: number;
    percentage: number;
  }>;
  permitsByLocation?: Array<{
    emirate: string;
    count: number;
    percentage: number;
  }>;
  statusStats?: {
    total?: number;
    active?: number;
    activePercentage?: number;
    expiringSoon?: number;
    expiringSoonPercentage?: number;
    expired?: number;
    expiredPercentage?: number;
  };
};

type PermitListResponse = {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: Array<{
    license: string;
    issued: number;
    active: number;
    expiringSoon: number;
    expired: number;
    geographicDistribution: Array<{
      region: string;
      percentage: number;
    }>;
    userTypeDistribution: Array<{
      userType: string;
      percentage: number;
    }>;
  }>;
};

type ContentLibraryStatisticsResponse = {
  summary?: {
    total?: number;
    approved?: number;
    rejected?: number;
    pendingReview?: number;
  };
  regulateEntrySummary?: {
    total?: number;
    approved?: number;
    rejected?: number;
  };
  contentByType?: Array<{
    contentType: string;
    count: number;
    percentage: number;
  }>;
  contentBySource?: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  approvedContentTrend?: Array<{
    date: string;
    typeCounts: Array<{
      contentType: string;
      count: number;
    }>;
  }>;
  bookBySubject?: Array<{
    subjectCategorieName: string;
    subjectCategorieNameAr: string;
    count: number;
  }>;
};

type ContentLibraryListResponse = {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: Array<{
    contentCategory: string;
    libraryItems: number;
    libraryItemsChange: number;
    approved: number;
    approvedChange: number;
    rejected: number;
    rejectedChange: number;
    approvedRate: number;
    approvedRateChange: number;
    applications: number;
    applicationsChange: number;
    local: number;
    localChange: number;
    import: number;
    importChange: number;
  }>;
};

const resolveTimeFilterParams = (params?: AnalyticsTimeFilter) => {
  if (params?.startDate && params?.endDate) {
    return {
      startDate: params.startDate,
      endDate: params.endDate,
    };
  }

  return {
    days: params?.days ?? DEFAULT_DAYS,
  };
};

const toListParams = (params: AnalyticsListParams) => ({
  ...resolveTimeFilterParams(params),
  keyword: params.keyword,
  option: params.option,
  pageIndex: params.pageIndex,
  pageSize: params.pageSize,
  orderby: params.orderby,
  sort: params.sort,
});

const toExportParams = (
  params: Partial<AnalyticsListParams>,
  options?: { omitPagination?: boolean },
) => ({
  ...resolveTimeFilterParams(params),
  keyword: params.keyword,
  option: params.option,
  orderby: params.orderby,
  sort: params.sort,
  ...(options?.omitPagination
    ? {}
    : {
        pageIndex: params.pageIndex,
        pageSize: params.pageSize,
      }),
});

const formatNumber = (
  value: number,
  minimumFractionDigits = 0,
  maximumFractionDigits = 0,
) =>
  Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  });

const formatPercent = (
  value: number,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2,
) => `${formatNumber(value, minimumFractionDigits, maximumFractionDigits)}%`;

/**
 * The API hands back an already-formatted duration ("0m", "3.2d"); passing that
 * through formatNumber produced "NaN", because Number("0m") is NaN. Strings are
 * therefore surfaced verbatim and only raw day counts get formatted.
 * Mirrors formatDurationMetricValue in the Licensing mappers.
 */
const formatDurationValue = (value: number | string) => {
  if (typeof value === "string") {
    return value.trim() || "0m";
  }

  return `${formatNumber(value, 0, 2)}d`;
};

const toDurationMetricCell = (
  value: number | string,
  change: number | undefined,
): MetricCellData => {
  const formattedValue = formatDurationValue(value);

  if (typeof change !== "number") {
    return { value: formattedValue };
  }

  return {
    value: formattedValue,
    delta: `${change > 0 ? "+" : ""}${formatPercent(change, 0, 2)}`,
    tone: change > 0 ? "positive" : change < 0 ? "negative" : "neutral",
  };
};

const toMetricCell = (
  value: number,
  change: number | undefined,
  options?: {
    kind?: "number" | "currency" | "percent" | "decimal";
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  },
): MetricCellData => {
  const kind = options?.kind ?? "number";
  const minimumFractionDigits = options?.minimumFractionDigits ?? 0;
  const maximumFractionDigits = options?.maximumFractionDigits ?? 0;

  const formattedValue =
    kind === "percent"
      ? formatPercent(value, minimumFractionDigits, maximumFractionDigits)
      : formatNumber(value, minimumFractionDigits, maximumFractionDigits);

  if (typeof change !== "number") {
    return { value: formattedValue };
  }

  return {
    value: formattedValue,
    delta: `${change > 0 ? "+" : ""}${formatPercent(change, 0, 2)}`,
    tone: change > 0 ? "positive" : change < 0 ? "negative" : "neutral",
  };
};

const toDistributionItems = <T extends { label: string; percentage: number }>(
  items: T[] | undefined,
): PermitDistributionItem[] =>
  (items ?? []).map((item) => ({
    label: item.label,
    percentage: Number(item.percentage ?? 0),
  }));

const getColor = (index: number) => COLORS[index % COLORS.length];

const buildDonutData = <T extends ChartLabelSourceItem>(
  items: T[],
): DonutChartData => ({
  total: items.reduce((sum, item) => sum + Number(item.count ?? 0), 0),
  legends: items.map((item, index) => ({
    label: item.label,
    labelKey: item.labelKey,
    value: Number(item.count ?? 0),
    percentage: Number(item.percentage ?? 0),
    color: getColor(index),
  })),
});

const buildBarData = <T extends ChartLabelSourceItem>(
  items: T[],
  color: string = COLORS[0],
) => ({
  color,
  items: items.map((item) => ({
    label: item.label,
    labelKey: item.labelKey,
    labelAr: item.labelAr,
    value: Number(item.count ?? 0),
    percentage: Number(item.percentage ?? 0),
  })),
});

const buildDeviceDonutData = (
  items: Array<{
    deviceType: string;
    count: number;
  }>,
): DonutChartData => {
  const total = items.reduce((sum, item) => sum + Number(item.count ?? 0), 0);

  return {
    total,
    legends: items.map((item, index) => ({
      label: item.deviceType,
      labelKey: resolveDeviceLabelKey(item.deviceType),
      value: Number(item.count ?? 0),
      percentage:
        total > 0 ? (Number(item.count ?? 0) / total) * 100 : 0,
      color: getColor(index),
    })),
  };
};

const buildAiTagsDonutData = (
  items: Array<{
    tag: string;
    count: number;
    percentage: number;
  }>,
): DonutChartData => ({
  total: items.reduce((sum, item) => sum + Number(item.count ?? 0), 0),
  legends: items.map((item, index) => ({
    label: item.tag,
    labelKey: resolveAiTagLabelKey(item.tag),
    value: Number(item.count ?? 0),
    percentage: Number(item.percentage ?? 0),
    color: getColor(index),
  })),
});


const mapServiceOperationsAnalytics = (
  response: ServiceOperationsStatisticsResponse,
): ServiceOperationsAnalyticsData => {
  const aiApproved = Number(
    response.aiRecommendation?.aiRecommendedApproval ?? 0,
  );
  const aiRejected = Number(
    response.aiRecommendation?.aiRecommendedRejection ?? 0,
  );
  const aiTotal = aiApproved + aiRejected;

  return {
    summaryCards: [
      {
        key: "totalApplications",
        iconKey: "applications",
        value: Number(response.totalApplications ?? 0).toLocaleString(),
        titleKey: "contentReportsAnalytics.summary.totalApplications",
      },
      {
        key: "totalPublishServices",
        iconKey: "approval",
        value: Number(response.permitsIssued ?? 0).toLocaleString(),
        titleKey: "contentReportsAnalytics.summary.permitsIssued",
      },
      {
        key: "approvalRate",
        iconKey: "approval",
        value: `${Number(response.approvalRate ?? 0)}%`,
        titleKey: "contentReportsAnalytics.summary.approvalRate",
      },
      {
        key: "avgProcessingTime",
        iconKey: "avgProcessingTime",
        value: response.avgProcessingTime ?? "0m",
        titleKey: "contentReportsAnalytics.summary.avgProcessingTime",
      },
      {
        key: "totalRevenue",
        iconKey: "revenue",
        value: Number(response.totalRevenue ?? 0).toLocaleString(),
        valuePrefix: "AED",
        titleKey: "contentReportsAnalytics.summary.totalRevenue",
      },
      {
        key: "avgSatisfaction",
        iconKey: "satisfaction",
        value: `${Number(response.avgSatisfaction ?? 0)}%`,
        titleKey: "contentReportsAnalytics.summary.avgSatisfaction",
      },
    ],
    applicationStatusOverview: buildDonutData(
      (response.applicationStatusDistribution ?? []).map((item) => ({
        label: item.statusName,
        labelKey: resolveApplicationStatusLabelKey(item.statusName),
        count: item.count,
        percentage: item.percentage,
      })),
    ),
    aiRecommendationOverview: {
      total: aiTotal,
      legends: [
        {
          label: "aiRecommendedApproval",
          labelKey: "contentReportsAnalytics.series.aiRecommendedApproval" as const,
          value: aiApproved,
          percentage: aiTotal > 0 ? (aiApproved / aiTotal) * 100 : 0,
          color: getColor(0),
        },
        {
          label: "aiRecommendedRejection",
          labelKey: "contentReportsAnalytics.series.aiRecommendedRejection" as const,
          value: aiRejected,
          percentage: aiTotal > 0 ? (aiRejected / aiTotal) * 100 : 0,
          color: getColor(3),
        },
      ],
      adoptionRate: Number(
        response.aiRecommendation?.aiRecommendationAdoptionRate ?? 0,
      ),
    },
    aiTagsBreakdown: buildAiTagsDonutData(response.aiTags ?? []),
    applicationsByMediaType: buildDonutData(
      (response.mediaMaterialTypeDistribution ?? []).map((item) => ({
        label: item.typeName,
        labelKey: resolveContentTypeLabelKey(item.typeName),
        count: item.count,
        percentage: item.percentage,
      })),
    ),
    applicationsByUserType: buildDonutData(
      (response.typeStats ?? []).map((item) => ({
        label: item.typeName,
        labelKey: resolveUserTypeLabelKey(item.typeName),
        count: item.count,
        percentage: item.percentage,
      })),
    ),
    applicationsByServiceCategory: buildDonutData(
      (response.categoryStats ?? []).map((item) => ({
        label: item.categoryName,
        labelKey: resolveServiceCategoryLabelKey(item.categoryName),
        count: item.count,
        percentage: item.percentage,
      })),
    ),
    applicationsByEmirate: buildBarData(
      (response.emirateStats ?? []).map((item) => ({
        label: item.emirate,
        labelKey: resolveLocationLabelKey(item.emirate),
        count: item.count,
        percentage: item.percentage,
      })),
      COLORS[0],
    ),
    applicationsByDevice: buildDeviceDonutData(response.deviceStats ?? []),
    confirmationMethodBreakdown: {
      total: Number(response.confirmationMethodStats?.total ?? 0),
      legends: [
        {
          label: "Self Monitored",
          labelKey: resolveConfirmationMethodLabelKey("Self Monitored"),
          value: Number(response.confirmationMethodStats?.selfMonitored ?? 0),
          percentage: Number(response.confirmationMethodStats?.selfMonitoredPercentage ?? 0),
          color: getColor(0),
        },
        {
          label: "Auto-Approved",
          labelKey: resolveConfirmationMethodLabelKey("Auto-Approved"),
          value: Number(response.confirmationMethodStats?.autoApproved ?? 0),
          percentage: Number(response.confirmationMethodStats?.autoApprovedPercentage ?? 0),
          color: getColor(1),
        },
        {
          label: "Manually Confirmed",
          labelKey: resolveConfirmationMethodLabelKey("Manually Confirmed"),
          value: Number(response.confirmationMethodStats?.manuallyConfirmed ?? 0),
          percentage: Number(response.confirmationMethodStats?.manuallyConfirmedPercentage ?? 0),
          color: getColor(5),
        },
      ],
    },
    teamPerformanceTrend: (() => {
      const sla = response.slaPerformance ?? {};
      const days = Number(sla.avgProcessingTimeDays ?? 0);
      let avgProcessingTime: string;
      if (days === 0) {
        avgProcessingTime = "0";
      } else {
        const totalMinutes = Math.round(days * 24 * 60);
        if (totalMinutes < 60) {
          avgProcessingTime = `${totalMinutes}min`;
        } else if (days < 1) {
          avgProcessingTime = `${Math.round(days * 24)}h`;
        } else {
          avgProcessingTime = `${Math.round(days * 10) / 10}d`;
        }
      }
      return {
        slaComplianceRate: Number(sla.slaComplianceRate ?? 0),
        slaBreached: Number(sla.slaBreached ?? 0),
        avgProcessingTime,
        trend: (sla.trend ?? []).map((item) => ({
          period: item.period,
          slaComplianceRate: Number(item.slaComplianceRate ?? 0),
          avgProcessingTimeDays: Number(item.avgProcessingTimeDays ?? 0),
        })),
      };
    })(),
    csatOverview: (() => {
      const dist = response.csatAnalysis?.distribution ?? [];
      const findDist = (category: string) =>
        dist.find((d) => d.category === category);
      return {
        overallRate: Number(response.csatAnalysis?.overallSatisfactionRate ?? 0),
        avgRating: Number(response.csatAnalysis?.avgRating ?? 0),
        totalRatings: Number(response.csatAnalysis?.totalRatings ?? 0),
        distribution: {
          total: Number(response.csatAnalysis?.totalRatings ?? 0),
          legends: [
            {
              label: "Satisfied (4-5)",
              labelKey: resolveSatisfactionLabelKey("Satisfied"),
              value: Number(findDist("Satisfied")?.count ?? 0),
              percentage: Number(findDist("Satisfied")?.percentage ?? 0),
              color: getColor(0),
            },
            {
              label: "Neutral (3)",
              labelKey: resolveSatisfactionLabelKey("Neutral"),
              value: Number(findDist("Neutral")?.count ?? 0),
              percentage: Number(findDist("Neutral")?.percentage ?? 0),
              color: getColor(1),
            },
            {
              label: "Dissatisfied (1-2)",
              labelKey: resolveSatisfactionLabelKey("Dissatisfied"),
              value: Number(findDist("Dissatisfied")?.count ?? 0),
              percentage: Number(findDist("Dissatisfied")?.percentage ?? 0),
              color: getColor(3),
            },
          ],
        },
      };
    })(),
    csatTrend: (() => {
      const trend = response.csatAnalysis?.trend ?? [];
      return {
        categories: trend.map((item) => item.period),
        series: [
          {
            name: "Satisfied(4-5)",
            nameKey: resolveSatisfactionLabelKey("Satisfied"),
            color: getColor(0),
            values: trend.map((item) => Number(item.satisfactionRate ?? 0)),
          },
          {
            name: "Neutral(3)",
            nameKey: resolveSatisfactionLabelKey("Neutral"),
            color: getColor(1),
            values: trend.map((item) => Number(item.neutralRate ?? 0)),
          },
          {
            name: "Dissatisfied(1-2)",
            nameKey: resolveSatisfactionLabelKey("Dissatisfied"),
            color: getColor(3),
            values: trend.map((item) => Number(item.dissatisfactionRate ?? 0)),
          },
        ],
        yAxisSuffix: "%",
        yAxisMin: 0,
        yAxisMax: 100,
      };
    })(),
    revenueTrend: {
      categories: (response.revenueTrendList ?? []).map((item) => item.date),
      series: [
        {
          name: "revenue",
          nameKey: "contentReportsAnalytics.series.revenue" as const,
          color: COLORS[7],
          values: (response.revenueTrendList ?? []).map((item) =>
            Number(item.revenue ?? 0),
          ),
          areaColor: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(215, 188, 109, 0.3)" },
              { offset: 1, color: "rgba(215, 188, 109, 0)" },
            ],
            global: false,
          },
        },
      ],
    },
    serviceApplicationTrend: {
      categories: (response.trendStats ?? []).map((item) => item.date),
      series: [
        {
          name: "serviceApplication",
          nameKey: "contentReportsAnalytics.series.serviceApplication" as const,
          color: COLORS[7],
          values: (response.trendStats ?? []).map((item) =>
            Number(item.approvedCount ?? item.count ?? 0),
          ),
          areaColor: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(215, 188, 109, 0.3)" },
              { offset: 1, color: "rgba(215, 188, 109, 0)" },
            ],
            global: false,
          },
        },
      ],
    },
  };
};

const mapPermitAnalytics = (
  response: PermitStatisticsResponse,
): PermitAnalyticsData => ({
  summaryCards: [],
  statusDonut: {
    total: Number(response.statusStats?.total ?? 0),
    legends: [
      {
        label: "active",
        labelKey: resolveLicenseStatusLabelKey("active"),
        value: Number(response.statusStats?.active ?? 0),
        percentage: Number(response.statusStats?.activePercentage ?? 0),
        color: getColor(0),
      },
      {
        label: "expiringSoon",
        labelKey: resolveLicenseStatusLabelKey("expiringSoon"),
        value: Number(response.statusStats?.expiringSoon ?? 0),
        percentage: Number(response.statusStats?.expiringSoonPercentage ?? 0),
        color: getColor(2),
      },
      {
        label: "expired",
        labelKey: resolveLicenseStatusLabelKey("expired"),
        value: Number(response.statusStats?.expired ?? 0),
        percentage: Number(response.statusStats?.expiredPercentage ?? 0),
        color: getColor(3),
      },
    ],
  },
  /* Pie per Figma node 44500:68125 - was a horizontal bars card. */
  userTypeDonut: buildDonutData(
    (response.permitsByUserType ?? []).map((item) => ({
      label: item.userType,
      labelKey: resolveUserTypeLabelKey(item.userType),
      count: item.count,
      percentage: item.percentage,
    })),
  ),
  locationBars: buildBarData(
    (response.permitsByLocation ?? []).map((item) => ({
      label: item.emirate,
      labelKey: resolveLocationLabelKey(item.emirate),
      count: item.count,
      percentage: item.percentage,
    })),
    COLORS[0],
  ),
});

const mapContentLibraryAnalytics = (
  response: ContentLibraryStatisticsResponse,
): ContentLibraryAnalyticsData => {
  const trendItems = response.approvedContentTrend ?? [];
  const regulateEntryTotal = Number(response.regulateEntrySummary?.total ?? 0);
  const trendTypes = Array.from(
    new Set(
      trendItems.flatMap((item) =>
        item.typeCounts.map((typeCount) => typeCount.contentType),
      ),
    ),
  );

  return {
    summaryCards: [],
    statusDonut: {
      total: Number(response.summary?.total ?? 0),
      legends: [
        {
          label: "approved",
          labelKey: resolveContentStatusLabelKey("approved"),
          value: Number(response.summary?.approved ?? 0),
          percentage:
            Number(response.summary?.total ?? 0) > 0
              ? (Number(response.summary?.approved ?? 0) /
                  Number(response.summary?.total ?? 0)) *
                100
              : 0,
          color: getColor(0),
        },
        {
          label: "rejected",
          labelKey: resolveContentStatusLabelKey("rejected"),
          value: Number(response.summary?.rejected ?? 0),
          percentage:
            Number(response.summary?.total ?? 0) > 0
              ? (Number(response.summary?.rejected ?? 0) /
                  Number(response.summary?.total ?? 0)) *
                100
              : 0,
          color: getColor(3),
        },
        {
          label: "pendingReview",
          labelKey: resolveContentStatusLabelKey("pendingReview"),
          value: Number(response.summary?.pendingReview ?? 0),
          percentage:
            Number(response.summary?.total ?? 0) > 0
              ? (Number(response.summary?.pendingReview ?? 0) /
                  Number(response.summary?.total ?? 0)) *
                100
              : 0,
          color: "#FAD44F",
        },
      ],
    },
    regulateEntryStatusDonut: {
      total: regulateEntryTotal,
      legends: [
        {
          label: "approved",
          labelKey: resolveContentStatusLabelKey("approved"),
          value: Number(response.regulateEntrySummary?.approved ?? 0),
          percentage:
            regulateEntryTotal > 0
              ? (Number(response.regulateEntrySummary?.approved ?? 0) /
                  regulateEntryTotal) *
                100
              : 0,
          color: getColor(0),
        },
        {
          label: "rejected",
          labelKey: resolveContentStatusLabelKey("rejected"),
          value: Number(response.regulateEntrySummary?.rejected ?? 0),
          percentage:
            regulateEntryTotal > 0
              ? (Number(response.regulateEntrySummary?.rejected ?? 0) /
                  regulateEntryTotal) *
                100
              : 0,
          color: getColor(3),
        },
      ],
    },
    typeDonut: buildDonutData(
      (response.contentByType ?? []).map((item) => ({
        label: item.contentType,
        labelKey: resolveContentTypeLabelKey(item.contentType),
        count: item.count,
        percentage: item.percentage,
      })),
    ),
    approvedTrend: {
      categories: trendItems.map((item) => item.date),
      series: trendTypes.map((contentType, index) => ({
        name: contentType,
        nameKey: resolveContentTypeLabelKey(contentType),
        color: getColor(index),
        values: trendItems.map(
          (item) =>
            Number(
              item.typeCounts.find(
                (typeCount) => typeCount.contentType === contentType,
              )?.count ?? 0,
            ),
        ),
      })),
    },
    publicationCategories: buildBarData(
      (response.bookBySubject ?? []).map((item) => ({
        label: item.subjectCategorieName,
        labelAr: item.subjectCategorieNameAr,
        count: item.count,
        percentage: 0,
      })),
      "#D7BC6D",
    ),
  };
};

const mapServicePerformanceTable = (
  response: ServicePerformanceListResponse,
): PaginatedTableResult<ServicePerformanceRow> => ({
  pageIndex: response.pageIndex ?? DEFAULT_PAGE_INDEX,
  pageSize: response.pageSize ?? DEFAULT_PAGE_SIZE,
  total: response.total ?? 0,
  items: (response.items ?? []).map((item, index) => ({
    id: `${item.serviceCategory || item.serviceName}-${index}`,
    serviceName: item.serviceName,
    serviceCategory: item.serviceCategory,
    applications: toMetricCell(item.applications, item.applicationsChange),
    totalRevenue: toMetricCell(item.totalRevenue, item.totalRevenueChange, {
      kind: "currency",
      maximumFractionDigits: 2,
    }),
    approvalRate: toMetricCell(item.approvalRate, item.approvalRateChange, {
      kind: "percent",
      maximumFractionDigits: 2,
    }),
    avgProcessingTime: toDurationMetricCell(
      item.avgProcessingTime,
      item.avgProcessingTimeChange,
    ),
    avgSatisfaction: toMetricCell(
      item.avgSatisfaction,
      item.avgSatisfactionChange,
      {
        kind: "percent",
        maximumFractionDigits: 2,
      },
    ),
    refundApplications: toMetricCell(
      item.refundApplications,
      item.refundApplicationsChange,
    ),
    totalRefunds: toMetricCell(item.totalRefunds, item.totalRefundsChange, {
      kind: "currency",
      maximumFractionDigits: 2,
    }),
    refundRate: toMetricCell(item.refundRate, item.refundRateChange, {
      kind: "percent",
      maximumFractionDigits: 2,
    }),
  })),
});

const mapTeamPerformanceSummary = (
  response: TeamPerformanceListResponse,
): TeamPerformanceSummary[] => [
  {
    key: "avgSlaCompliance",
    value: formatPercent(response.avgSLACompliance ?? 0, 0, 2),
    iconKey: "teamSla",
  },
  {
    key: "avgProcessingTime",
    value:
      typeof response.avgProcessingTime === "string"
        ? response.avgProcessingTime
        : formatNumber(response.avgProcessingTime ?? 0, 0, 2),
    iconKey: "teamProcessing",
  },
  {
    key: "avgApprovalRate",
    value: formatPercent(response.avgApprovalRate ?? 0, 0, 2),
    iconKey: "teamApproval",
  },
];

const mapTeamPerformanceTable = (
  response: TeamPerformanceListResponse,
): PaginatedTableResult<TeamPerformanceRow> => ({
  pageIndex: response.page?.pageIndex ?? DEFAULT_PAGE_INDEX,
  pageSize: response.page?.pageSize ?? DEFAULT_PAGE_SIZE,
  total: response.page?.total ?? 0,
  items: (response.page?.items ?? []).map((item, index) => ({
    id: `${item.teamMember}-${index}`,
    teamMember: item.teamMember,
    applicationTasks: toMetricCell(
      item.applicationTasks,
      item.applicationTasksChange,
    ),
    approvedApplications: toMetricCell(
      item.approvedApplications,
      item.approvedApplicationsChange,
    ),
    rejectedApplications: toMetricCell(
      item.rejectedApplications,
      item.rejectedApplicationsChange,
    ),
    approvalRate: toMetricCell(item.approvalRate, item.approvalRateChange, {
      kind: "percent",
      maximumFractionDigits: 2,
    }),
    avgProcessingTime: toDurationMetricCell(
      item.avgProcessingTime,
      item.avgProcessingTimeChange,
    ),
    sla: toMetricCell(item.sla, item.slaChange, {
      kind: "percent",
      maximumFractionDigits: 2,
    }),
    slaBreaches: toMetricCell(
      Number(item.slaBreachesCount ?? 0),
      item.slaBreachesChange,
    ),
  })),
});

const mapPermitTable = (
  response: PermitListResponse,
): PaginatedTableResult<PermitRow> => ({
  pageIndex: response.pageIndex ?? DEFAULT_PAGE_INDEX,
  pageSize: response.pageSize ?? DEFAULT_PAGE_SIZE,
  total: response.total ?? 0,
  items: (response.items ?? []).map((item, index) => ({
    id: `${item.license}-${index}`,
    license: item.license,
    issued: Number(item.issued ?? 0),
    active: Number(item.active ?? 0),
    expiringSoon: Number(item.expiringSoon ?? 0),
    expired: Number(item.expired ?? 0),
    geographicDistribution: toDistributionItems(
      (item.geographicDistribution ?? []).map((distribution) => ({
        label: distribution.region,
        percentage: distribution.percentage,
      })),
    ),
    userTypeDistribution: toDistributionItems(
      (item.userTypeDistribution ?? []).map((distribution) => ({
        label: distribution.userType,
        percentage: distribution.percentage,
      })),
    ),
  })),
});

const mapContentLibraryTable = (
  response: ContentLibraryListResponse,
): PaginatedTableResult<ContentLibraryRow> => ({
  pageIndex: response.pageIndex ?? DEFAULT_PAGE_INDEX,
  pageSize: response.pageSize ?? DEFAULT_PAGE_SIZE,
  total: response.total ?? 0,
  items: (response.items ?? []).map((item, index) => ({
    id: `${item.contentCategory}-${index}`,
    contentCategory: item.contentCategory,
    libraryItems: toMetricCell(item.libraryItems, item.libraryItemsChange),
    approved: toMetricCell(item.approved, item.approvedChange),
    rejected: toMetricCell(item.rejected, item.rejectedChange),
    approvedRate: toMetricCell(item.approvedRate, item.approvedRateChange, {
      kind: "percent",
      maximumFractionDigits: 2,
    }),
    applications: toMetricCell(item.applications, item.applicationsChange),
    local: toMetricCell(item.local, item.localChange),
    import: toMetricCell(item.import, item.importChange),
  })),
});

export const getServiceOperationsAnalytics = async (
  params: AnalyticsTimeFilter,
): Promise<{ data: ServiceOperationsAnalyticsData }> => {
  const response = await request.get<
    ApiEnvelope<ServiceOperationsStatisticsResponse>,
    ApiEnvelope<ServiceOperationsStatisticsResponse>
  >("/api/Content/dashboard/statistics", resolveTimeFilterParams(params));

  return {
    data: mapServiceOperationsAnalytics(response.data ?? {}),
  };
};

export const getServicePerformance = async (
  params: AnalyticsTableParams,
): Promise<{ data: PaginatedTableResult<ServicePerformanceRow> }> => {
  const response = await request.get<
    ApiEnvelope<ServicePerformanceListResponse>,
    ApiEnvelope<ServicePerformanceListResponse>
  >("/api/Content/dashboard/service/list", toListParams({
    ...params,
    option: params.option ?? DEFAULT_SERVICE_OPTION,
  }));

  return {
    data: mapServicePerformanceTable(response.data),
  };
};

export const exportServicePerformance = (
  params: Partial<AnalyticsListParams>,
) =>
  saveFileWithAxios(
    "/api/Content/dashboard/service/list/export",
    "content-service-performance.csv",
    toExportParams({
      ...params,
      option: params.option ?? DEFAULT_SERVICE_OPTION,
    }),
  );

export const getTeamPerformance = async (
  params: AnalyticsTableParams,
): Promise<{
  data: {
    summary: TeamPerformanceSummary[];
    table: PaginatedTableResult<TeamPerformanceRow>;
  };
}> => {
  const response = await request.get<
    ApiEnvelope<TeamPerformanceListResponse>,
    ApiEnvelope<TeamPerformanceListResponse>
  >("/api/Content/dashboard/team/list", toListParams(params));

  return {
    data: {
      summary: mapTeamPerformanceSummary(response.data),
      table: mapTeamPerformanceTable(response.data),
    },
  };
};

export const exportTeamPerformance = (
  params: Partial<AnalyticsListParams>,
) =>
  saveFileWithAxios(
    "/api/Content/dashboard/team/list/export",
    "content-team-performance.csv",
    toExportParams(params),
  );

export const getPermitAnalytics = async (
  params: AnalyticsTimeFilter,
): Promise<{ data: PermitAnalyticsData }> => {
  const response = await request.get<
    ApiEnvelope<PermitStatisticsResponse>,
    ApiEnvelope<PermitStatisticsResponse>
  >(
    "/api/LicenseManagement/content/permit/analytics",
    resolveTimeFilterParams(params),
  );

  return {
    data: mapPermitAnalytics(response.data ?? {}),
  };
};

export const getPermitTable = async (
  params: AnalyticsTableParams,
): Promise<{ data: PaginatedTableResult<PermitRow> }> => {
  const response = await request.get<
    ApiEnvelope<PermitListResponse>,
    ApiEnvelope<PermitListResponse>
  >("/api/LicenseManagement/content/permit/list", toListParams(params));

  return {
    data: mapPermitTable(response.data),
  };
};

export const exportPermitTable = (params: Partial<AnalyticsListParams>) =>
  saveFileWithAxios(
    "/api/LicenseManagement/content/permit/list/export",
    "content-permit-analytics.csv",
    toExportParams(params),
  );

export const getContentLibraryAnalytics = async (
  params: AnalyticsTimeFilter,
): Promise<{ data: ContentLibraryAnalyticsData }> => {
  const response = await request.get<
    ApiEnvelope<ContentLibraryStatisticsResponse>,
    ApiEnvelope<ContentLibraryStatisticsResponse>
  >("/api/ContentLibrary/dashboard/statistics", resolveTimeFilterParams(params));

  return {
    data: mapContentLibraryAnalytics(response.data ?? {}),
  };
};

export const getContentLibraryTable = async (
  params: AnalyticsTableParams,
): Promise<{ data: PaginatedTableResult<ContentLibraryRow> }> => {
  const response = await request.get<
    ApiEnvelope<ContentLibraryListResponse>,
    ApiEnvelope<ContentLibraryListResponse>
  >("/api/ContentLibrary/dashboard/list", toListParams(params));

  return {
    data: mapContentLibraryTable(response.data),
  };
};

export const exportContentLibraryTable = (
  params: Partial<AnalyticsListParams>,
) =>
  saveFileWithAxios(
    "/api/ContentLibrary/dashboard/list/export",
    "content-library-analytics.csv",
    toExportParams(params, { omitPagination: true }),
  );
const exportMediaContentReport = (
  path: string,
  fileName: string,
  params: MediaContentReportExportParams,
) => saveFileWithAxios(path, fileName, omitEmptyValues(params), "post");
export const exportRegulateEntriesApplications = (
  params: Pick<MediaContentReportExportParams, "dateFrom" | "dateTo" | "profileType">,
) => exportMediaContentReport("/api/MediaContentReports/RegulateEntriesApplications/Export", "regulate-entries-applications.csv", params);
export const exportCirculationMediaMaterialPermit = (
  params: Pick<MediaContentReportExportParams, "dateFrom" | "dateTo" | "materialType" | "profileType">,
) => exportMediaContentReport("/api/MediaContentReports/CirculationMediaMaterialPermit/Export", "circulation-media-material-permit.csv", params);
export const exportRecordedBooks = (
  params: Pick<MediaContentReportExportParams, "dateFrom" | "dateTo">,
) => exportMediaContentReport("/api/MediaContentReports/RecordedBooks/Export", "recorded-books.csv", params);
export const exportNewspapersMagazinesCirculation = (
  params: Pick<MediaContentReportExportParams, "dateFrom" | "dateTo" | "type" | "profileType">,
) => exportMediaContentReport("/api/MediaContentReports/NewspapersMagazinesCirculation/Export", "newspapers-magazines-circulation.csv", params);
export const exportBookCirculationPrintingPermit = (
  params: Pick<MediaContentReportExportParams, "dateFrom" | "dateTo" | "serviceCode" | "profileType">,
) => exportMediaContentReport("/api/MediaContentReports/BookCirculationPrintingPermit/Export", "book-circulation-printing-permit.csv", params);
