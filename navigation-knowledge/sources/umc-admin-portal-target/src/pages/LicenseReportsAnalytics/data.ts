import { TREND_DATE_LABELS } from "./constants";
import type {
  DonutChartData,
  LicenseAnalyticsData,
  LicenseDistributionRow,
  HorizontalBarData,
  ProfileAnalyticsData,
  ProfileTeamRow,
  ServiceOperationsAnalyticsData,
  ServicePerformanceRow,
  ReportsAnalyticsTranslationKey,
  ServiceCategoryKey,
  TeamPerformanceRow,
  TeamPerformanceSummary,
  TrendChartData,
} from "./type";

const REPORTS_ANALYTICS_SERIES_KEYS = {
  revenue: "licenseReportsAnalytics.series.revenue",
  serviceApplicationFees: "licenseReportsAnalytics.series.serviceApplicationFees",
  fines: "licenseReportsAnalytics.series.fines",
  refunds: "licenseReportsAnalytics.series.refunds",
  serviceApplication: "licenseReportsAnalytics.series.serviceApplication",
  profileApplication: "licenseReportsAnalytics.series.profileApplication",
} as const satisfies Record<string, ReportsAnalyticsTranslationKey>;

const SERVICE_CATEGORY_KEY_BY_LABEL: Record<string, ServiceCategoryKey> = {
  "Film & Content Production": "filmContentProduction",
  "Publication & Distribution": "publicationDistribution",
  "Media Licensing": "mediaLicensing",
  "Digital & Social Media": "digitalSocialMedia",
  "Video Games": "videoGames",
  "Foreign Media & Correspondents": "foreignMediaCorrespondents",
  "Content Review": "contentReview",
  "Printing & Publishing": "printingPublishing",
  "Cinema & Video Games": "cinemaVideoGames",
};

const findServiceCategoryByApiLabel = (value: string) => {
  const key = SERVICE_CATEGORY_KEY_BY_LABEL[value.trim()];

  if (!key) {
    return undefined;
  }

  return { key };
};

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

const withLabelKey = <T extends { label: string }>(
  item: T,
  labelKey?: ReportsAnalyticsTranslationKey,
): T => ({
  ...item,
  labelKey,
});

const withDonutChartKeys = (
  item: DonutChartData,
  legendKeys: Array<ReportsAnalyticsTranslationKey | undefined>,
): DonutChartData => ({
  ...item,
  legends: item.legends.map((legend, index) =>
    withLabelKey(legend, legendKeys[index]),
  ),
});

const withHorizontalBarKeys = (
  item: HorizontalBarData,
  itemKeys: Array<ReportsAnalyticsTranslationKey | undefined>,
): HorizontalBarData => ({
  ...item,
  items: item.items.map((entry, index) => withLabelKey(entry, itemKeys[index])),
});

const withTrendChartKeys = (
  item: TrendChartData,
  seriesKeys: Array<ReportsAnalyticsTranslationKey | undefined>,
): TrendChartData => ({
  ...item,
  series: item.series.map((series, index) => ({
    ...series,
    nameKey: seriesKeys[index],
  })),
});

export const serviceOperationsMockData: ServiceOperationsAnalyticsData = {
  summaryCards: [
    {
      key: "publishedServices",
      value: "5,183",
      iconKey: "services",
    },
    {
      key: "totalApplications",
      value: "2342",
      iconKey: "applications",
    },
    {
      key: "totalRevenue",
      value: "5,183k",
      iconKey: "revenue",
      valuePrefix: "AED",
    },
    {
      key: "refundApplications",
      value: "200",
      iconKey: "refundApplications",
    },
    {
      key: "totalRefunds",
      value: "6,000",
      iconKey: "refunds",
      valuePrefix: "AED",
    },
    {
      key: "approvalRate",
      value: "94.20%",
      iconKey: "approval",
    },
    {
      key: "avgSatisfaction",
      value: "94.20%",
      iconKey: "satisfaction",
    },
  ],
  categoryDonut: withDonutChartKeys({
      total: 10000,
      legends: [
        {
          label: "Film & Content Production",
          value: 7000,
          percentage: 70,
          color: "#A0D5AB",
        },
        {
          label: "Publication & Distribution",
          value: 1000,
          percentage: 10,
          color: "#81C1FF",
        },
        {
          label: "Media Licensing",
          value: 500,
          percentage: 5,
          color: "#FAD44F",
        },
        {
          label: "Digital & Social Media",
          value: 500,
          percentage: 5,
          color: "#D7BC6D",
        },
        {
          label: "Video Games",
          value: 500,
          percentage: 5,
          color: "#FAAAA7",
        },
        {
          label: "Foreign Media & Correspondents",
          value: 500,
          percentage: 5,
          color: "#F5AC7C",
        },
      ],
    }, [
      "licenseReportsAnalytics.options.serviceCategories.filmContentProduction",
      "licenseReportsAnalytics.options.serviceCategories.publicationDistribution",
      "licenseReportsAnalytics.options.serviceCategories.mediaLicensing",
      "licenseReportsAnalytics.options.serviceCategories.digitalSocialMedia",
      "licenseReportsAnalytics.options.serviceCategories.videoGames",
      "licenseReportsAnalytics.options.serviceCategories.foreignMediaCorrespondents",
    ]),
typeDonut: withDonutChartKeys({
      total: 10000,
      legends: [
        { label: "New", value: 7000, percentage: 70, color: "#A0D5AB" },
        { label: "Renew", value: 1000, percentage: 10, color: "#D7BC6D" },
        { label: "Modify", value: 500, percentage: 5, color: "#FAAAA7" },
        { label: "Cancel", value: 500, percentage: 5, color: "#C3C6CB" },
        { label: "Transfer", value: 500, percentage: 5, color: "#FAD44F" },
        {
          label: "Partner Management",
          value: 500,
          percentage: 5,
          color: "#81C1FF",
        },
      ],
    }, [
      "licenseReportsAnalytics.options.applicationTypes.new",
      "licenseReportsAnalytics.options.applicationTypes.renew",
      "licenseReportsAnalytics.options.applicationTypes.modify",
      "licenseReportsAnalytics.options.applicationTypes.cancel",
      "licenseReportsAnalytics.options.applicationTypes.transfer",
      "licenseReportsAnalytics.options.applicationTypes.partnerManagement",
    ]),
deviceDonut: withDonutChartKeys({
      total: 10000,
      legends: [
        { label: "Web", value: 8000, percentage: 80, color: "#A0D5AB" },
        { label: "Mobile", value: 1600, percentage: 16, color: "#81C1FF" },
        { label: "Tablet", value: 400, percentage: 4, color: "#C3C6CB" },
      ],
    }, [
      "licenseReportsAnalytics.options.devices.web",
      "licenseReportsAnalytics.options.devices.mobile",
      "licenseReportsAnalytics.options.devices.tablet",
    ]),
  userTypeBars: withHorizontalBarKeys({
      color: "#A0D5AB",
      items: [
        { label: "Commercial", value: 5000, percentage: 40 },
        { label: "Individual", value: 2500, percentage: 20 },
        { label: "Government", value: 1000, percentage: 10 },
        { label: "Free Zone", value: 1000, percentage: 10 },
        { label: "Talent Agency", value: 500, percentage: 5 },
        { label: "Embassy", value: 500, percentage: 5 },
        { label: "Consulate", value: 500, percentage: 5 },
        { label: "Cultural Clubs", value: 500, percentage: 5 },
      ],
    }, [
      "licenseReportsAnalytics.options.userTypes.commercial",
      "licenseReportsAnalytics.options.userTypes.individual",
      "licenseReportsAnalytics.options.userTypes.government",
      "licenseReportsAnalytics.options.userTypes.freeZone",
      "licenseReportsAnalytics.options.userTypes.talentAgency",
      "licenseReportsAnalytics.options.userTypes.embassy",
      "licenseReportsAnalytics.options.userTypes.consulate",
      "licenseReportsAnalytics.options.userTypes.culturalClubs",
    ]),
locationBars: withHorizontalBarKeys({
      color: "#D7BC6D",
      items: [
        { label: "Dubai", value: 5000, percentage: 40 },
        { label: "Abu Dhabi", value: 2500, percentage: 20 },
        { label: "Sharjah", value: 1000, percentage: 10 },
        { label: "Ajman", value: 500, percentage: 5 },
        { label: "RAK", value: 500, percentage: 5 },
        { label: "Fujairah", value: 500, percentage: 5 },
        { label: "Umm Al Quwain", value: 500, percentage: 5 },
        { label: "Foreign", value: 500, percentage: 5 },
      ],
    }, [
      "licenseReportsAnalytics.options.locations.dubai",
      "licenseReportsAnalytics.options.locations.abuDhabi",
      "licenseReportsAnalytics.options.locations.sharjah",
      "licenseReportsAnalytics.options.locations.ajman",
      "licenseReportsAnalytics.options.locations.rak",
      "licenseReportsAnalytics.options.locations.fujairah",
      "licenseReportsAnalytics.options.locations.uaq",
      "licenseReportsAnalytics.options.locations.foreign",
    ]),
  revenueTrend: withTrendChartKeys({
      categories: TREND_DATE_LABELS,
      yAxisMin: -100,
      yAxisMax: 400,
      yAxisInterval: 100,
      yAxisSuffix: "M",
      series: [
        {
          name: "Revenue",
          color: "#A0D5AB",
          values: [180, 180, 245, 245, 290],
        },
      ],
    }, [
      REPORTS_ANALYTICS_SERIES_KEYS.revenue,
    ]),
  serviceApplicationTrend: withTrendChartKeys({
      categories: TREND_DATE_LABELS,
      yAxisMin: 0,
      yAxisMax: 2500,
      yAxisInterval: 500,
      series: [
        {
          name: "Service Application",
          color: "#D7BC6D",
          areaColor: "rgba(215,188,109,0.22)",
          values: [900, 900, 1420, 2100, 2100],
        },
      ],
    }, [
      REPORTS_ANALYTICS_SERIES_KEYS.serviceApplication,
    ]),
};

export const servicePerformanceMockRows: ServicePerformanceRow[] = [
  {
    id: "svc-1",
    category: "Film & Content Production",
    serviceName: "Ground Photography Permit",
    applications: positive("123"),
    totalRevenue: positive("88k"),
    approvalRate: positive("88%"),
    avgProcessingTime: positive("3.2d"),
    avgSatisfaction: positive("87.5%"),
    refundApplications: positive("12"),
    totalRefunds: positive("1500"),
    refundRate: positive("7.5%"),
  },
  {
    id: "svc-2",
    category: "Film & Content Production",
    serviceName: "Drone Shooting Permit",
    applications: positive("118"),
    totalRevenue: negative("82k"),
    approvalRate: positive("85%"),
    avgProcessingTime: positive("2.8d"),
    avgSatisfaction: positive("86.2%"),
    refundApplications: positive("9"),
    totalRefunds: positive("1120"),
    refundRate: positive("6.8%"),
  },
  {
    id: "svc-3",
    category: "Media Licensing",
    serviceName: "Media Equipment Entry Permit",
    applications: positive("96"),
    totalRevenue: positive("74k"),
    approvalRate: negative("82%"),
    avgProcessingTime: positive("4.1d"),
    avgSatisfaction: positive("84.8%"),
    refundApplications: positive("7"),
    totalRefunds: positive("950"),
    refundRate: positive("6.2%"),
  },
  {
    id: "svc-4",
    category: "Publication & Distribution",
    serviceName: "Magazine Distribution Approval",
    applications: negative("82"),
    totalRevenue: positive("66k"),
    approvalRate: positive("90%"),
    avgProcessingTime: negative("3.9d"),
    avgSatisfaction: positive("88.7%"),
    refundApplications: positive("5"),
    totalRefunds: positive("630"),
    refundRate: positive("5.4%"),
  },
  {
    id: "svc-5",
    category: "Digital & Social Media",
    serviceName: "Influencer Content Permit",
    applications: positive("144"),
    totalRevenue: positive("93k"),
    approvalRate: positive("91%"),
    avgProcessingTime: positive("2.6d"),
    avgSatisfaction: positive("89.9%"),
    refundApplications: positive("11"),
    totalRefunds: positive("1380"),
    refundRate: positive("7.1%"),
  },
  {
    id: "svc-6",
    category: "Foreign Media & Correspondents",
    serviceName: "Foreign Media License",
    applications: positive("64"),
    totalRevenue: negative("58k"),
    approvalRate: positive("79%"),
    avgProcessingTime: positive("4.6d"),
    avgSatisfaction: negative("80.1%"),
    refundApplications: positive("4"),
    totalRefunds: positive("420"),
    refundRate: positive("4.9%"),
  },
  {
    id: "svc-7",
    category: "Media Licensing",
    serviceName: "Radio Broadcast Permit",
    applications: positive("132"),
    totalRevenue: positive("98k"),
    approvalRate: positive("92%"),
    avgProcessingTime: positive("2.5d"),
    avgSatisfaction: positive("90.4%"),
    refundApplications: positive("8"),
    totalRefunds: positive("1040"),
    refundRate: positive("6.1%"),
  },
  {
    id: "svc-8",
    category: "Publication & Distribution",
    serviceName: "Newspaper Publishing Approval",
    applications: positive("75"),
    totalRevenue: positive("61k"),
    approvalRate: positive("87%"),
    avgProcessingTime: positive("3.4d"),
    avgSatisfaction: positive("85.5%"),
    refundApplications: positive("6"),
    totalRefunds: positive("780"),
    refundRate: positive("5.7%"),
  },
  {
    id: "svc-9",
    category: "Digital & Social Media",
    serviceName: "Online Campaign Approval",
    applications: positive("158"),
    totalRevenue: positive("102k"),
    approvalRate: positive("93%"),
    avgProcessingTime: positive("2.1d"),
    avgSatisfaction: positive("91.8%"),
    refundApplications: positive("13"),
    totalRefunds: positive("1450"),
    refundRate: positive("7.8%"),
  },
  {
    id: "svc-10",
    category: "Film & Content Production",
    serviceName: "Studio Filming Permit",
    applications: positive("109"),
    totalRevenue: positive("86k"),
    approvalRate: positive("89%"),
    avgProcessingTime: positive("3.0d"),
    avgSatisfaction: positive("88.1%"),
    refundApplications: positive("10"),
    totalRefunds: positive("1210"),
    refundRate: positive("6.7%"),
  },
  {
    id: "svc-11",
    category: "Media Licensing",
    serviceName: "Press Card License",
    applications: positive("142"),
    totalRevenue: positive("91k"),
    approvalRate: positive("94%"),
    avgProcessingTime: positive("1.9d"),
    avgSatisfaction: positive("92.4%"),
    refundApplications: positive("5"),
    totalRefunds: positive("610"),
    refundRate: positive("3.9%"),
  },
  {
    id: "svc-12",
    category: "Foreign Media & Correspondents",
    serviceName: "Overseas Correspondent Permit",
    applications: positive("58"),
    totalRevenue: positive("47k"),
    approvalRate: positive("81%"),
    avgProcessingTime: positive("4.9d"),
    avgSatisfaction: positive("79.2%"),
    refundApplications: positive("3"),
    totalRefunds: positive("360"),
    refundRate: positive("4.2%"),
  },
].map((item) => ({
  ...item,
  categoryKey: findServiceCategoryByApiLabel(item.category)?.key,
}));

export const teamPerformanceSummaryMock: TeamPerformanceSummary[] = [
  {
    key: "sla",
    value: "93.2%",
    iconKey: "teamSla",
  },
  {
    key: "processing",
    value: "2.4d",
    iconKey: "teamProcessing",
  },
  {
    key: "approval",
    value: "91.5%",
    iconKey: "teamApproval",
  },
];

export const teamPerformanceMockRows: TeamPerformanceRow[] = [
  {
    id: "team-1",
    memberName: "Asma Alhammadi",
    applicationTasks: positive("123"),
    approvedApplications: positive("113"),
    rejectedApplications: positive("8"),
    approvalRate: negative("87.5%"),
    avgProcessingTime: positive("3.2d"),
    sla: positive("87.5%"),
    slaBreaches: positive("0"),
  },
  {
    id: "team-2",
    memberName: "Fatima Al Kaabi",
    applicationTasks: positive("123"),
    approvedApplications: negative("113"),
    rejectedApplications: positive("8"),
    approvalRate: negative("87.5%"),
    avgProcessingTime: positive("3.2d"),
    sla: positive("87.5%"),
    slaBreaches: positive("0"),
  },
  {
    id: "team-3",
    memberName: "Sara Al Muhairi",
    applicationTasks: positive("123"),
    approvedApplications: positive("113"),
    rejectedApplications: negative("8"),
    approvalRate: positive("87.5%"),
    avgProcessingTime: positive("3.2d"),
    sla: positive("87.5%"),
    slaBreaches: positive("0"),
  },
  {
    id: "team-4",
    memberName: "Ahmed",
    applicationTasks: negative("123"),
    approvedApplications: positive("113"),
    rejectedApplications: positive("8"),
    approvalRate: positive("87.5%"),
    avgProcessingTime: positive("3.2d"),
    sla: positive("87.5%"),
    slaBreaches: positive("0"),
  },
  {
    id: "team-5",
    memberName: "Aisha Al Nuaimi",
    applicationTasks: positive("119"),
    approvedApplications: positive("108"),
    rejectedApplications: positive("6"),
    approvalRate: positive("90.2%"),
    avgProcessingTime: positive("2.9d"),
    sla: positive("89.1%"),
    slaBreaches: positive("0"),
  },
  {
    id: "team-6",
    memberName: "Mariam Hassan",
    applicationTasks: positive("131"),
    approvedApplications: positive("120"),
    rejectedApplications: positive("7"),
    approvalRate: positive("91.4%"),
    avgProcessingTime: positive("2.8d"),
    sla: positive("90.0%"),
    slaBreaches: positive("0"),
  },
  {
    id: "team-7",
    memberName: "Noora Khalifa",
    applicationTasks: positive("111"),
    approvedApplications: positive("103"),
    rejectedApplications: positive("5"),
    approvalRate: positive("89.8%"),
    avgProcessingTime: positive("3.1d"),
    sla: positive("88.5%"),
    slaBreaches: positive("0"),
  },
  {
    id: "team-8",
    memberName: "Salem Al Mansoori",
    applicationTasks: positive("126"),
    approvedApplications: positive("114"),
    rejectedApplications: positive("9"),
    approvalRate: positive("88.6%"),
    avgProcessingTime: positive("3.0d"),
    sla: positive("87.9%"),
    slaBreaches: positive("0"),
  },
  {
    id: "team-9",
    memberName: "Huda Al Mazrouei",
    applicationTasks: positive("117"),
    approvedApplications: positive("107"),
    rejectedApplications: positive("6"),
    approvalRate: positive("90.1%"),
    avgProcessingTime: positive("2.7d"),
    sla: positive("89.4%"),
    slaBreaches: positive("0"),
  },
  {
    id: "team-10",
    memberName: "Khalid Omar",
    applicationTasks: positive("121"),
    approvedApplications: positive("110"),
    rejectedApplications: positive("7"),
    approvalRate: positive("89.6%"),
    avgProcessingTime: positive("3.3d"),
    sla: positive("88.1%"),
    slaBreaches: positive("0"),
  },
];

export const profileAnalyticsMockData: ProfileAnalyticsData = {
  userTypeDonut: withDonutChartKeys({
    total: 10000,
    legends: [
      { label: "Individual", value: 8000, percentage: 80, color: "#A0D5AB" },
      { label: "Commercial", value: 1000, percentage: 10, color: "#D7BC6D" },
      { label: "Talent Agency", value: 200, percentage: 2, color: "#FAAAA7" },
      { label: "Free Zone", value: 200, percentage: 2, color: "#F5AC7C" },
      { label: "Embassy", value: 200, percentage: 2, color: "#FAD44F" },
      { label: "Consulate", value: 200, percentage: 2, color: "#81C1FF" },
      { label: "Cultural Clubs", value: 0, percentage: 0, color: "#F0ABFC" },
      { label: "Government", value: 200, percentage: 2, color: "#C3C6CB" },
    ],
  }, [
    "licenseReportsAnalytics.options.userTypes.individual",
    "licenseReportsAnalytics.options.userTypes.commercial",
    "licenseReportsAnalytics.options.userTypes.talentAgency",
    "licenseReportsAnalytics.options.userTypes.freeZone",
    "licenseReportsAnalytics.options.userTypes.embassy",
    "licenseReportsAnalytics.options.userTypes.consulate",
    "licenseReportsAnalytics.options.userTypes.culturalClubs",
    "licenseReportsAnalytics.options.userTypes.government",
  ]),
  profileApplicationTrend: withTrendChartKeys({
    categories: TREND_DATE_LABELS,
    series: [
      {
        name: "Profile Application",
        color: "#D7BC6D",
        areaColor: "rgba(215,188,109,0.18)",
        values: [1200, 1200, 1650, 1650, 2180],
      },
    ],
  }, [
    REPORTS_ANALYTICS_SERIES_KEYS.profileApplication,
  ]),
  locationBars: withHorizontalBarKeys({
    color: "#D7BC6D",
    items: [
      { label: "Dubai", value: 5000, percentage: 40 },
      { label: "Abu Dhabi", value: 2500, percentage: 20 },
      { label: "Sharjah", value: 1000, percentage: 10 },
      { label: "Ajman", value: 1000, percentage: 10 },
      { label: "RAK", value: 500, percentage: 5 },
      { label: "Fujairah", value: 500, percentage: 5 },
      { label: "Umm Al Quwain", value: 500, percentage: 5 },
      { label: "Foreign", value: 500, percentage: 5 },
    ],
  }, [
    "licenseReportsAnalytics.options.locations.dubai",
    "licenseReportsAnalytics.options.locations.abuDhabi",
    "licenseReportsAnalytics.options.locations.sharjah",
    "licenseReportsAnalytics.options.locations.ajman",
    "licenseReportsAnalytics.options.locations.rak",
    "licenseReportsAnalytics.options.locations.fujairah",
    "licenseReportsAnalytics.options.locations.uaq",
    "licenseReportsAnalytics.options.locations.foreign",
  ]),
  verificationMethodDonut: withDonutChartKeys({
    total: 5000,
    legends: [
      { label: "Emirates ID", value: 8000, percentage: 80, color: "#A0D5AB" },
      {
        label: "UAE Unified Number",
        value: 2000,
        percentage: 20,
        color: "#FAD44F",
      },
      { label: "Passport", value: 0, percentage: 0, color: "#C3C6CB" },
    ],
  }, [
    "licenseReportsAnalytics.options.verificationMethods.emiratesId",
    "licenseReportsAnalytics.options.verificationMethods.uaeUnifiedNumber",
    "licenseReportsAnalytics.options.verificationMethods.passport",
  ]),
  deviceDonut: withDonutChartKeys({
    total: 10000,
    legends: [
      { label: "Web", value: 8000, percentage: 80, color: "#A0D5AB" },
      { label: "Mobile", value: 1600, percentage: 16, color: "#81C1FF" },
      { label: "Tablet", value: 400, percentage: 4, color: "#C3C6CB" },
    ],
  }, [
    "licenseReportsAnalytics.options.devices.web",
    "licenseReportsAnalytics.options.devices.mobile",
    "licenseReportsAnalytics.options.devices.tablet",
  ]),
};

export const profileTeamMockRows: ProfileTeamRow[] = [
  {
    id: "profile-team-1",
    memberName: "Asma Alhammadi",
    applicationTasks: positive("123"),
    approvedApplications: positive("113"),
    rejectedApplications: positive("8"),
    approvalRate: negative("87.5%"),
  },
  {
    id: "profile-team-2",
    memberName: "Fatima Al Kaabi",
    applicationTasks: positive("123"),
    approvedApplications: negative("113"),
    rejectedApplications: positive("8"),
    approvalRate: negative("87.5%"),
  },
  {
    id: "profile-team-3",
    memberName: "Sara Al Muhairi",
    applicationTasks: positive("123"),
    approvedApplications: positive("113"),
    rejectedApplications: negative("8"),
    approvalRate: positive("87.5%"),
  },
  {
    id: "profile-team-4",
    memberName: "Ahmed",
    applicationTasks: negative("123"),
    approvedApplications: positive("113"),
    rejectedApplications: positive("8"),
    approvalRate: positive("87.5%"),
  },
  {
    id: "profile-team-5",
    memberName: "Noora Khalifa",
    applicationTasks: positive("119"),
    approvedApplications: positive("108"),
    rejectedApplications: positive("6"),
    approvalRate: positive("90.2%"),
  },
  {
    id: "profile-team-6",
    memberName: "Aisha Al Nuaimi",
    applicationTasks: positive("128"),
    approvedApplications: positive("117"),
    rejectedApplications: positive("9"),
    approvalRate: positive("91.4%"),
  },
  {
    id: "profile-team-7",
    memberName: "Mariam Hassan",
    applicationTasks: positive("114"),
    approvedApplications: positive("103"),
    rejectedApplications: positive("5"),
    approvalRate: positive("89.8%"),
  },
  {
    id: "profile-team-8",
    memberName: "Khalid Omar",
    applicationTasks: positive("121"),
    approvedApplications: positive("110"),
    rejectedApplications: positive("7"),
    approvalRate: positive("89.6%"),
  },
  {
    id: "profile-team-9",
    memberName: "Salem Al Mansoori",
    applicationTasks: positive("117"),
    approvedApplications: positive("107"),
    rejectedApplications: positive("6"),
    approvalRate: positive("88.9%"),
  },
  {
    id: "profile-team-10",
    memberName: "Huda Al Mazrouei",
    applicationTasks: positive("113"),
    approvedApplications: positive("104"),
    rejectedApplications: positive("4"),
    approvalRate: positive("90.8%"),
  },
];

export const licenseAnalyticsMockData: LicenseAnalyticsData = {
  statusDonut: withDonutChartKeys({
    total: 5000,
    legends: [
      { label: "Active", value: 4000, percentage: 80, color: "#A0D5AB" },
      {
        label: "Expiring Soon",
        value: 800,
        percentage: 16,
        color: "#FAD44F",
      },
      { label: "Expired", value: 200, percentage: 4, color: "#FAAAA7" },
    ],
  }, [
    "licenseReportsAnalytics.options.licenseStatuses.active",
    "licenseReportsAnalytics.options.licenseStatuses.expiringSoon",
    "licenseReportsAnalytics.options.licenseStatuses.expired",
  ]),
  issuedTrend: withTrendChartKeys({
    categories: TREND_DATE_LABELS,
    series: [
      { name: "Media License", color: "#A0D5AB", values: [290, 290, 350, 350, 395] },
      {
        name: "Photography Equipment Entry Permit",
        color: "#D7BC6D",
        values: [430, 385, 385, 320, 320],
      },
      {
        name: "Press Card License",
        color: "#81C1FF",
        values: [120, 125, 138, 141, 150],
      },
      {
        name: "Foreign Correspondent Permit",
        color: "#FAAAA7",
        values: [230, 230, 265, 265, 330],
      },
      {
        name: "Foreign Media Office License",
        color: "#C3C6CB",
        values: [245, 245, 280, 280, 200],
      },
      {
        name: "Newspaper Media License",
        color: "#81C1FF",
        values: [140, 125, 140, 140, 165],
      },
      {
        name: "Radio & TV Broadcasting License",
        color: "#F0ABFC",
        values: [70, 70, 85, 85, 110],
      },
      {
        name: "Aerial Photography Permit",
        color: "#FAD44F",
        values: [25, 25, 45, 45, 35],
      },
      {
        name: "Ground Photography Permit",
        color: "#F5AC7C",
        values: [45, 45, 60, 60, 52],
      },
      {
        name: "Marine Photography Permit",
        color: "#7BC4B8",
        values: [18, 20, 24, 26, 29],
      },
    ],
  }, [
    "licenseReportsAnalytics.options.licenseTypes.mediaLicense",
    "licenseReportsAnalytics.options.licenseTypes.photographyEquipmentEntryPermit",
    "licenseReportsAnalytics.options.licenseTypes.pressCardLicense",
    "licenseReportsAnalytics.options.licenseTypes.foreignCorrespondentPermit",
    "licenseReportsAnalytics.options.licenseTypes.foreignMediaOfficeLicense",
    "licenseReportsAnalytics.options.licenseTypes.newspaperMediaLicense",
    "licenseReportsAnalytics.options.licenseTypes.radioTvBroadcastingLicense",
    "licenseReportsAnalytics.options.licenseTypes.aerialPhotographyPermit",
    "licenseReportsAnalytics.options.licenseTypes.groundPhotographyPermit",
    "licenseReportsAnalytics.options.licenseTypes.marinePhotographyPermit",
  ]),
  userTypeDonut: withDonutChartKeys({
    total: 12700,
    legends: [
      { label: "Commercial", value: 5000, percentage: 39.4, color: "#D7BC6D" },
      { label: "Individual", value: 2500, percentage: 19.7, color: "#A0D5AB" },
      { label: "Establishment", value: 1200, percentage: 9.4, color: "#FAAAA7" },
      { label: "Government", value: 1000, percentage: 7.9, color: "#C3C6CB" },
      { label: "Free Zone", value: 1000, percentage: 7.9, color: "#F5AC7C" },
      { label: "Talent Agency", value: 500, percentage: 3.9, color: "#FAD44F" },
      { label: "Embassy", value: 500, percentage: 3.9, color: "#81C1FF" },
      { label: "Consulate", value: 500, percentage: 3.9, color: "#F0ABFC" },
      { label: "Cultural Clubs", value: 500, percentage: 3.9, color: "#9EB8F2" },
    ],
  }, [
    "licenseReportsAnalytics.options.userTypes.commercial",
    "licenseReportsAnalytics.options.userTypes.individual",
    "licenseReportsAnalytics.options.userTypes.establishment",
    "licenseReportsAnalytics.options.userTypes.government",
    "licenseReportsAnalytics.options.userTypes.freeZone",
    "licenseReportsAnalytics.options.userTypes.talentAgency",
    "licenseReportsAnalytics.options.userTypes.embassy",
    "licenseReportsAnalytics.options.userTypes.consulate",
    "licenseReportsAnalytics.options.userTypes.culturalClubs",
  ]),
  locationBars: withHorizontalBarKeys({
    color: "#D7BC6D",
    items: [
      { label: "Dubai", value: 5000, percentage: 40 },
      { label: "Abu Dhabi", value: 2500, percentage: 20 },
      { label: "Sharjah", value: 1000, percentage: 10 },
      { label: "Ajman", value: 1000, percentage: 10 },
      { label: "RAK", value: 500, percentage: 5 },
      { label: "Fujairah", value: 500, percentage: 5 },
      { label: "Umm Al Quwain", value: 500, percentage: 5 },
      { label: "Foreign", value: 500, percentage: 5 },
    ],
  }, [
    "licenseReportsAnalytics.options.locations.dubai",
    "licenseReportsAnalytics.options.locations.abuDhabi",
    "licenseReportsAnalytics.options.locations.sharjah",
    "licenseReportsAnalytics.options.locations.ajman",
    "licenseReportsAnalytics.options.locations.rak",
    "licenseReportsAnalytics.options.locations.fujairah",
    "licenseReportsAnalytics.options.locations.uaq",
    "licenseReportsAnalytics.options.locations.foreign",
  ]),
};

const licenseTitles = [
  "Modification of commercial media permit",
  "Photography Equipment Entry Permit",
  "Foreign Correspondent Permit",
  "Foreign Media Office License",
  "Newspaper Media License",
  "Radio & TV Broadcasting License",
  "Aerial Photography Permit",
  "Ground Photography Permit",
  "Marine Photography Permit",
  "Press Card License",
];

export const licenseDistributionMockRows: LicenseDistributionRow[] = Array.from(
  { length: 18 },
  (_, index) => ({
    id: `license-${index + 1}`,
    license: licenseTitles[index % licenseTitles.length],
    issued: "1,498",
    active: "500",
    expiringSoon: "50",
    expired: "50",
    geographicDistribution: {
      dubai: "20%",
      abuDhabi: "20%",
      sharjah: "20%",
      ajman: "20%",
      rak: "5%",
      fujairah: "5%",
      uaq: "5%",
      foreign: "5%",
    },
    userTypeDistribution: {
      commercial: "30%",
      individual: "20%",
      establishment: "10%",
      government: "20%",
      freeZone: "20%",
      talentAgency: "5%",
      embassy: "5%",
      consulate: "5%",
      culturalClubs: "5%",
    },
  })
);
