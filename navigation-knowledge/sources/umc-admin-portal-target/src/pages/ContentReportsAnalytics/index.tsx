import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import moment from "moment";
import { useTranslation } from "react-i18next";
import { Spin } from "antd";
import {
  CustomMessage,
  PageHeadingPortal,
  ReportsExportCard,
} from "@/components/common";
import {
  getContentLibraryAnalytics,
  getContentLibraryTable,
  getPermitAnalytics,
  getPermitTable,
  getServicePerformance,
  getServiceOperationsAnalytics,
  getTeamPerformance,
  exportContentLibraryTable,
  exportPermitTable,
  exportServicePerformance,
  exportTeamPerformance,
  exportBookCirculationPrintingPermit,
  exportCirculationMediaMaterialPermit,
  exportNewspapersMagazinesCirculation,
  exportRecordedBooks,
  exportRegulateEntriesApplications,
  getBookCirculationServiceOptions,
} from "@/services/contentReportsAnalytics";
import { getUserProfileUserTypes } from "@/services/userManagement";
import { getMaterialTypeLookup } from "@/services/contentLibrary";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import type { ReportsExportFilters } from "@/components/common/ReportsExportCard";
import SectionTabs from "./components/SectionTabs";
import AIRecommendationOverviewCard from "./components/AIRecommendationOverviewCard";
import AITagsBreakdownCard from "./components/AITagsBreakdownCard";
import DonutChartCard from "./components/DonutChartCard";
import HorizontalBarsCard from "./components/HorizontalBarsCard";
import TrendChartCard from "./components/TrendChartCard";
import HeaderTimeFilter from "./components/HeaderTimeFilter";
import ServicePerformanceTable from "./components/ServicePerformanceTable";
import TeamPerformanceTable from "./components/TeamPerformanceTable";
import PermitTable from "./components/PermitTable";
import ContentLibraryTable from "./components/ContentLibraryTable";
import StatCards from "./components/StatCards";
import CustomerSatisfactionCard from "./components/CustomerSatisfactionCard";
import TeamPerformanceTrendCard from "./components/TeamPerformanceTrendCard";
import { REPORTS_ANALYTICS_TIME_PRESET_DAYS } from "./constants";
import type {
  AnalyticsTableChange,
  AnalyticsTableParams,
  AnalyticsTimeFilter,
  MainAnalyticsTab,
  PaginatedTableResult,
  ReportsAnalyticsRangeValue,
  ReportsAnalyticsTimePreset,
  ServiceOperationsAnalyticsData,
  PermitAnalyticsData,
  ContentLibraryAnalyticsData,
  ServicePerformanceOption,
  ServicePerformanceRow,
  TabOption,
  TeamPerformanceRow,
  TeamPerformanceSummary,
  TimePresetOption,
  PermitRow,
  ContentLibraryRow,
} from "./type";
import type {
  DonutChartData,
  HorizontalBarData,
  TrendChartData,
} from "./type";
import "./index.less";

const EMPTY_DONUT: DonutChartData = { total: 0, legends: [] };
const EMPTY_BARS: HorizontalBarData = { color: "#A0D5AB", items: [] };
const EMPTY_TREND: TrendChartData = { categories: [], series: [] };
const CONTENT_REPORTS_PATH = "/content/reports-analytics";

const EMPTY_SERVICE_OPS: ServiceOperationsAnalyticsData = {
  summaryCards: [],
  applicationStatusOverview: EMPTY_DONUT,
  aiRecommendationOverview: { total: 0, legends: [], adoptionRate: 0 },
  aiTagsBreakdown: EMPTY_DONUT,
  applicationsByMediaType: EMPTY_DONUT,
  applicationsByUserType: EMPTY_DONUT,
  applicationsByServiceCategory: EMPTY_DONUT,
  applicationsByEmirate: EMPTY_BARS,
  applicationsByDevice: EMPTY_DONUT,
  confirmationMethodBreakdown: EMPTY_DONUT,
  csatOverview: {
    overallRate: 0,
    avgRating: 0,
    totalRatings: 0,
    distribution: EMPTY_DONUT,
  },
  csatTrend: EMPTY_TREND,
  teamPerformanceTrend: {
    slaComplianceRate: 0,
    slaBreached: 0,
    avgProcessingTime: "0",
    trend: [],
  },
  revenueTrend: EMPTY_TREND,
  serviceApplicationTrend: EMPTY_TREND,
};

const EMPTY_PERMIT: PermitAnalyticsData = {
  summaryCards: [],
  statusDonut: EMPTY_DONUT,
  userTypeDonut: EMPTY_DONUT,
  locationBars: EMPTY_BARS,
};

const EMPTY_CONTENT: ContentLibraryAnalyticsData = {
  summaryCards: [],
  statusDonut: EMPTY_DONUT,
  regulateEntryStatusDonut: EMPTY_DONUT,
  typeDonut: EMPTY_DONUT,
  approvedTrend: EMPTY_TREND,
  publicationCategories: { color: "", items: [] },
};

const DEFAULT_TIME_FILTER: AnalyticsTimeFilter = {
  days: 30,
};
const createDefaultReportDateRange = (): ReportsExportFilters["submissionDate"] => [
  moment().subtract(30, "days"),
  moment(),
];

const DEFAULT_PAGE_INDEX = 1;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_OPERATIONS_TAB = "servicePerformance";
const DEFAULT_SERVICE_OPTION: ServicePerformanceOption = "AllServices";
const normalizeLookupValue = (value?: string | number) => {
  if (value === undefined || value === "") return undefined;
  if (typeof value === "number") return Number.isNaN(value) ? undefined : value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? value : numeric;
};

const TEXT = {
  tabs: {
    serviceOperations: "contentReportsAnalytics.tabs.serviceOperations",
    permit: "contentReportsAnalytics.tabs.permit",
    content: "contentReportsAnalytics.tabs.content",
    reports: "contentReportsAnalytics.tabs.reports",
  },
  timeFilter: {
    last7: "contentReportsAnalytics.timeFilter.last7",
    last30: "contentReportsAnalytics.timeFilter.last30",
    last6Months: "contentReportsAnalytics.timeFilter.last6Months",
    lastYear: "contentReportsAnalytics.timeFilter.lastYear",
    custom: "contentReportsAnalytics.timeFilter.custom",
  },
} as const;

const MAIN_TAB_OPTIONS: Array<
  Omit<TabOption<MainAnalyticsTab>, "label"> & { textKey: string }
> = [
  { key: "serviceOperations", textKey: TEXT.tabs.serviceOperations },
  { key: "permit", textKey: TEXT.tabs.permit },
  { key: "content", textKey: TEXT.tabs.content },
  { key: "reports", textKey: TEXT.tabs.reports },
];

const TIME_PRESET_OPTIONS: Array<
  Omit<TimePresetOption<ReportsAnalyticsTimePreset>, "label"> & {
    textKey: string;
  }
> = [
  {
    key: "last7",
    textKey: TEXT.timeFilter.last7,
    days: REPORTS_ANALYTICS_TIME_PRESET_DAYS.last7,
  },
  {
    key: "last30",
    textKey: TEXT.timeFilter.last30,
    days: REPORTS_ANALYTICS_TIME_PRESET_DAYS.last30,
  },
  {
    key: "last6Months",
    textKey: TEXT.timeFilter.last6Months,
    days: REPORTS_ANALYTICS_TIME_PRESET_DAYS.last6Months,
  },
  {
    key: "lastYear",
    textKey: TEXT.timeFilter.lastYear,
    days: REPORTS_ANALYTICS_TIME_PRESET_DAYS.lastYear,
  },
  {
    key: "custom",
    textKey: TEXT.timeFilter.custom,
  },
];

const REPORT_CARD_CONFIGS = [
  {
    title: "regulateEntriesApplications",
    exportKey: "regulateEntriesApplications",
    fields: [["profileType", "allProfileTypes"]],
  },
  {
    title: "circulationMediaMaterialPermit",
    exportKey: "circulationMediaMaterialPermit",
    fields: [
      ["materialType", "allMaterialTypes"],
      ["profileType", "allProfileTypes"],
    ],
  },
  {
    title: "recordedBooks",
    exportKey: "recordedBooks",
    fields: [],
  },
  {
    title: "newspapersAndMagazinesCirculationApplications",
    exportKey: "newspapersMagazinesCirculation",
    fields: [
      ["type", "allTypes"],
      ["profileType", "allProfileTypes"],
    ],
  },
  {
    title: "bookCirculationPrintingAndScriptPermitApplications",
    exportKey: "bookCirculationPrintingPermit",
    fields: [
      ["serviceCode", "allServices"],
      ["profileType", "allProfileTypes"],
    ],
  },
] as const;



const createDraftRangeFromFilter = (
  filter: AnalyticsTimeFilter,
): ReportsAnalyticsRangeValue =>
  filter.startDate && filter.endDate
    ? [
        moment(filter.startDate, "YYYY-MM-DD"),
        moment(filter.endDate, "YYYY-MM-DD"),
      ]
    : null;

const formatTimeFilterLabel = (
  preset: ReportsAnalyticsTimePreset,
  filter: AnalyticsTimeFilter,
  presetOptions: Array<{ key: ReportsAnalyticsTimePreset; label: string }>,
  fallbackLabel: string,
) => {
  if (preset === "custom" && filter.startDate && filter.endDate) {
    return `${moment(filter.startDate, "YYYY-MM-DD").format(
      "DD/MM/YYYY",
    )} - ${moment(filter.endDate, "YYYY-MM-DD").format("DD/MM/YYYY")}`;
  }

  return (
    presetOptions.find((item) => item.key === preset)?.label || fallbackLabel
  );
};

const VALID_MAIN_TABS: MainAnalyticsTab[] = [
  "serviceOperations",
  "permit",
  "content",
  "reports",
];

const getInitialTab = (search: string): MainAnalyticsTab => {
  const params = new URLSearchParams(search);
  const tab = params.get("tab") as MainAnalyticsTab | null;

  return tab && VALID_MAIN_TABS.includes(tab) ? tab : "serviceOperations";
};

const OPERATIONS_TAB_OPTIONS: Array<
  Omit<TabOption<string>, "label"> & { textKey: string }
> = [
  {
    key: "servicePerformance",
    textKey: "contentReportsAnalytics.tabs.servicePerformance",
  },
  {
    key: "teamPerformance",
    textKey: "contentReportsAnalytics.tabs.teamPerformance",
  },
];

export default function ContentReportsAnalytics() {
  const { t: translate, i18n } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const [mainTab, setMainTab] = useState<MainAnalyticsTab>(() =>
    getInitialTab(location.search),
  );
  const [operationsTab, setOperationsTab] = useState(DEFAULT_OPERATIONS_TAB);

  const [serviceOpsLoading, setServiceOpsLoading] = useState(false);
  const [permitAnalyticsLoading, setPermitAnalyticsLoading] = useState(false);
  const [contentAnalyticsLoading, setContentAnalyticsLoading] = useState(false);

  const [timeFilterPreset, setTimeFilterPreset] =
    useState<ReportsAnalyticsTimePreset>("last30");
  const [timeFilterVisible, setTimeFilterVisible] = useState(false);
  const [committedTimeFilter, setCommittedTimeFilter] =
    useState<AnalyticsTimeFilter>(DEFAULT_TIME_FILTER);
  const [draftRange, setDraftRange] =
    useState<ReportsAnalyticsRangeValue>(null);

  const [serviceOperationsData, setServiceOperationsData] =
    useState<ServiceOperationsAnalyticsData | null>(null);
  const [permitAnalyticsData, setPermitAnalyticsData] =
    useState<PermitAnalyticsData | null>(null);
  const [contentLibraryAnalyticsData, setContentLibraryAnalyticsData] =
    useState<ContentLibraryAnalyticsData | null>(null);

  // Table state - Service Performance
  const [servicePerformanceTable, setServicePerformanceTable] = useState<
    PaginatedTableResult<ServicePerformanceRow>
  >({
    items: [],
    total: 0,
    pageIndex: DEFAULT_PAGE_INDEX,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [servicePerformanceLoading, setServicePerformanceLoading] =
    useState(false);
  const [servicePerformanceKeyword, setServicePerformanceKeyword] =
    useState("");
  const [servicePerformanceOption, setServicePerformanceOption] =
    useState<ServicePerformanceOption>("AllServices");
  const [servicePerformanceSort, setServicePerformanceSort] = useState<
    Pick<AnalyticsTableParams, "orderby" | "sort">
  >({});

  // Table state - Team Performance
  const [teamPerformanceTable, setTeamPerformanceTable] = useState<
    PaginatedTableResult<TeamPerformanceRow>
  >({
    items: [],
    total: 0,
    pageIndex: DEFAULT_PAGE_INDEX,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [teamPerformanceSummary, setTeamPerformanceSummary] = useState<
    TeamPerformanceSummary[]
  >([]);
  const [teamPerformanceLoading, setTeamPerformanceLoading] = useState(false);
  const [teamPerformanceKeyword, setTeamPerformanceKeyword] = useState("");
  const [teamPerformanceSort, setTeamPerformanceSort] = useState<
    Pick<AnalyticsTableParams, "orderby" | "sort">
  >({});

  // Table state - Permit
  const [permitTable, setPermitTable] = useState<
    PaginatedTableResult<PermitRow>
  >({
    items: [],
    total: 0,
    pageIndex: DEFAULT_PAGE_INDEX,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [permitLoading, setPermitLoading] = useState(false);
  const [permitKeyword, setPermitKeyword] = useState("");
  const [permitSort, setPermitSort] = useState<
    Pick<AnalyticsTableParams, "orderby" | "sort">
  >({});

  // Table state - Content Library
  const [contentLibraryTable, setContentLibraryTable] = useState<
    PaginatedTableResult<ContentLibraryRow>
  >({
    items: [],
    total: 0,
    pageIndex: DEFAULT_PAGE_INDEX,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [contentLibraryLoading, setContentLibraryLoading] = useState(false);
  const [contentLibrarySort, setContentLibrarySort] = useState<
    Pick<AnalyticsTableParams, "orderby" | "sort">
  >({});
  const [reportLookupVersion, setReportLookupVersion] = useState(0);
  const reportLookupRef = useRef<{
    loaded: boolean;
    loading: boolean;
    profile: Array<Record<string, unknown>>;
    material: Array<Record<string, unknown>>;
    services: Array<Record<string, unknown>>;
  }>({ loaded: false, loading: false, profile: [], material: [], services: [] });

  const mainAnalyticsTabs = useMemo(
    () =>
      MAIN_TAB_OPTIONS.map((item) => ({
        key: item.key,
        label: translate(item.textKey),
      })),
    [translate],
  );

  const operationsAnalyticsTabs = useMemo(
    () =>
      OPERATIONS_TAB_OPTIONS.map((item) => ({
        key: item.key,
        label: translate(item.textKey),
      })),
    [translate],
  );

  const timePresetOptions = useMemo(
    () =>
      TIME_PRESET_OPTIONS.map((item) => ({
        key: item.key,
        days: item.days,
        label: translate(item.textKey),
      })),
    [translate],
  );
  useEffect(() => {
    if (mainTab !== "reports" || reportLookupRef.current.loaded || reportLookupRef.current.loading) return;
    reportLookupRef.current.loading = true;
    const load = async () => {
      const [profiles, materials, services] = await Promise.allSettled([
        getUserProfileUserTypes(),
        getMaterialTypeLookup(),
        getBookCirculationServiceOptions(),
      ]);
      const itemsFrom = (response: unknown): Array<Record<string, unknown>> => {
        if (Array.isArray(response)) {
          return response.filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === "object",
          );
        }
        const data = (response as { data?: unknown } | null)?.data;
        if (Array.isArray(data)) return data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
        if (!data || typeof data !== "object") return [];
        const nested = data as { data?: unknown; items?: unknown };
        const items = nested.data;
        return Array.isArray(items) ? items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
      };
      const allFulfilled =
        profiles.status === "fulfilled" &&
        materials.status === "fulfilled" &&
        services.status === "fulfilled";
      reportLookupRef.current.profile = profiles.status === "fulfilled" ? itemsFrom(profiles.value) : [];
      reportLookupRef.current.material = materials.status === "fulfilled" ? itemsFrom(materials.value) : [];
      reportLookupRef.current.services = services.status === "fulfilled" ? itemsFrom(services.value) : [];
      reportLookupRef.current.loaded = allFulfilled;
      reportLookupRef.current.loading = false;
      if (!allFulfilled) {
        CustomMessage.error(
          translate("contentReportsAnalytics.messages.exportFailed"),
        );
      }
      setReportLookupVersion((version) => version + 1);
    };
    load().catch(() => {
      reportLookupRef.current.loading = false;
      reportLookupRef.current.loaded = false;
      setReportLookupVersion((version) => version + 1);
    });
  }, [mainTab]);

  const reportOptions = useMemo(() => {
    const { profile, material, services } = reportLookupRef.current;
    const localizedLabel = (item: Record<string, unknown>) => {
      const english = item.nameEn ?? item.labelEn ?? item.name;
      const arabic = item.nameAr ?? item.labelAr;
      return String(i18n.language.startsWith("ar") ? arabic ?? english ?? "" : english ?? arabic ?? "");
    };
    const profileType = profile
      .filter((item) => {
        const normalized = String(item.code ?? item.name ?? item.nameEn ?? "")
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, "");
        return !["all", "allusertypes", "allprofiletypes"].includes(normalized);
      })
      .filter(
        (item) =>
          String(item.nameEn ?? item.name ?? "").trim().toLowerCase() !==
          "establishment",
      )
      .filter((item) => item.id !== undefined)
      .map((item) => ({ value: String(item.id), label: localizedLabel(item) }));
    const materialType = material
      .map((item) => ({
        value: String(item.code ?? "").trim(),
        label: localizedLabel(item),
      }))
      .filter((item) => Boolean(item.value));
    const serviceCode = services
      .map((item) => ({
        value: String(item.serviceCode ?? "").trim(),
        label: String(item.serviceName ?? "").trim(),
      }))
      .filter((item) => Boolean(item.value && item.label));
    return {
      profileType,
      materialType,
      type: [
        { value: "Newspaper", label: translate("contentReportsAnalytics.options.reportTypes.newspaper") },
        { value: "Magazine", label: translate("contentReportsAnalytics.options.reportTypes.magazine") },
      ],
      serviceCode,
    };
  }, [i18n.language, translate, reportLookupVersion]);

  const applyCommittedTimeFilter = (
    preset: ReportsAnalyticsTimePreset,
    filter: AnalyticsTimeFilter,
  ) => {
    setTimeFilterPreset(preset);
    setCommittedTimeFilter(filter);
    setDraftRange(createDraftRangeFromFilter(filter));
    setTimeFilterVisible(false);
  };

  const handlePresetSelect = (
    preset: Exclude<ReportsAnalyticsTimePreset, "custom">,
  ) => {
    applyCommittedTimeFilter(preset, {
      days:
        REPORTS_ANALYTICS_TIME_PRESET_DAYS[preset] ?? DEFAULT_TIME_FILTER.days,
    });
  };

  const handleCustomRangeApply = () => {
    if (!draftRange?.[0] || !draftRange?.[1]) {
      return;
    }

    applyCommittedTimeFilter("custom", {
      startDate: draftRange[0].format("YYYY-MM-DD"),
      endDate: draftRange[1].format("YYYY-MM-DD"),
    });
  };

  const handleCustomRangeCancel = () => {
    setDraftRange(createDraftRangeFromFilter(committedTimeFilter));
    setTimeFilterVisible(false);
  };

  const handleTimeFilterVisibleChange = (visible: boolean) => {
    setTimeFilterVisible(visible);

    if (!visible) {
      setDraftRange(createDraftRangeFromFilter(committedTimeFilter));
    }
  };

  const resetServicePerformanceState = () => {
    setServicePerformanceTable({
      items: [],
      total: 0,
      pageIndex: DEFAULT_PAGE_INDEX,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    setServicePerformanceKeyword("");
    setServicePerformanceOption(DEFAULT_SERVICE_OPTION);
    setServicePerformanceSort({});
  };

  const resetTeamPerformanceState = () => {
    setTeamPerformanceTable({
      items: [],
      total: 0,
      pageIndex: DEFAULT_PAGE_INDEX,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    setTeamPerformanceSummary([]);
    setTeamPerformanceKeyword("");
    setTeamPerformanceSort({});
  };

  const resetPermitState = () => {
    setPermitTable({
      items: [],
      total: 0,
      pageIndex: DEFAULT_PAGE_INDEX,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    setPermitKeyword("");
    setPermitSort({});
  };

  const resetContentLibraryState = () => {
    setContentLibraryTable({
      items: [],
      total: 0,
      pageIndex: DEFAULT_PAGE_INDEX,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    setContentLibrarySort({});
  };

  const resetNonTimeFilters = () => {
    setOperationsTab(DEFAULT_OPERATIONS_TAB);
    resetServicePerformanceState();
    resetTeamPerformanceState();
    resetPermitState();
    resetContentLibraryState();
  };

  const handleMainTabChange = useCallback(
    (tab: MainAnalyticsTab) => {
      if (tab === mainTab) {
        return;
      }

      resetNonTimeFilters();
      setMainTab(tab);
      const params = new URLSearchParams(location.search);
      params.set("tab", tab);
      history.replace({ search: params.toString() });
    },
    [history, location.search, mainTab, resetNonTimeFilters],
  );

  useEffect(() => {
    if (mainTab !== "serviceOperations") {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setServiceOpsLoading(true);
      try {
        const response = await getServiceOperationsAnalytics(
          committedTimeFilter,
        );
        if (!cancelled) setServiceOperationsData(response.data);
      } catch (error) {
        console.error("Failed to load service operations analytics:", error);
      } finally {
        if (!cancelled) setServiceOpsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [mainTab, committedTimeFilter]);

  useEffect(() => {
    if (mainTab !== "serviceOperations" || operationsTab !== "servicePerformance") {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setServicePerformanceLoading(true);
      try {
        const response = await getServicePerformance({
          ...committedTimeFilter,
          pageIndex: servicePerformanceTable.pageIndex,
          pageSize: servicePerformanceTable.pageSize,
          keyword: servicePerformanceKeyword,
          option: servicePerformanceOption,
          ...servicePerformanceSort,
        });
        if (!cancelled) setServicePerformanceTable(response.data);
      } catch (error) {
        console.error("Failed to load service performance:", error);
      } finally {
        if (!cancelled) setServicePerformanceLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    mainTab,
    operationsTab,
    committedTimeFilter,
    servicePerformanceTable.pageIndex,
    servicePerformanceTable.pageSize,
    servicePerformanceKeyword,
    servicePerformanceOption,
    servicePerformanceSort,
  ]);

  useEffect(() => {
    if (mainTab !== "serviceOperations" || operationsTab !== "teamPerformance") {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setTeamPerformanceLoading(true);
      try {
        const response = await getTeamPerformance({
          ...committedTimeFilter,
          pageIndex: teamPerformanceTable.pageIndex,
          pageSize: teamPerformanceTable.pageSize,
          keyword: teamPerformanceKeyword,
          ...teamPerformanceSort,
        });
        if (!cancelled) {
          setTeamPerformanceTable(response.data.table);
          setTeamPerformanceSummary(response.data.summary);
        }
      } catch (error) {
        console.error("Failed to load team performance:", error);
      } finally {
        if (!cancelled) setTeamPerformanceLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    mainTab,
    operationsTab,
    committedTimeFilter,
    teamPerformanceTable.pageIndex,
    teamPerformanceTable.pageSize,
    teamPerformanceKeyword,
    teamPerformanceSort,
  ]);

  useEffect(() => {
    if (mainTab !== "permit") {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setPermitAnalyticsLoading(true);
      try {
        const response = await getPermitAnalytics(committedTimeFilter);
        if (!cancelled) setPermitAnalyticsData(response.data);
      } catch (error) {
        console.error("Failed to load permit analytics:", error);
      } finally {
        if (!cancelled) setPermitAnalyticsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [mainTab, committedTimeFilter]);

  useEffect(() => {
    if (mainTab !== "permit") {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setPermitLoading(true);
      try {
        const response = await getPermitTable({
          ...committedTimeFilter,
          pageIndex: permitTable.pageIndex,
          pageSize: permitTable.pageSize,
          keyword: permitKeyword,
          ...permitSort,
        });
        if (!cancelled) setPermitTable(response.data);
      } catch (error) {
        console.error("Failed to load permit table:", error);
      } finally {
        if (!cancelled) setPermitLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    mainTab,
    committedTimeFilter,
    permitTable.pageIndex,
    permitTable.pageSize,
    permitKeyword,
    permitSort,
  ]);

  useEffect(() => {
    if (mainTab !== "content") {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setContentAnalyticsLoading(true);
      try {
        const response = await getContentLibraryAnalytics(committedTimeFilter);
        if (!cancelled) setContentLibraryAnalyticsData(response.data);
      } catch (error) {
        console.error("Failed to load content library analytics:", error);
      } finally {
        if (!cancelled) setContentAnalyticsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [mainTab, committedTimeFilter]);

  useEffect(() => {
    if (mainTab !== "content") {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setContentLibraryLoading(true);
      try {
        const response = await getContentLibraryTable({
          ...committedTimeFilter,
          pageIndex: contentLibraryTable.pageIndex,
          pageSize: contentLibraryTable.pageSize,
          ...contentLibrarySort,
        });
        if (!cancelled) setContentLibraryTable(response.data);
      } catch (error) {
        console.error("Failed to load content library table:", error);
      } finally {
        if (!cancelled) setContentLibraryLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    mainTab,
    committedTimeFilter,
    contentLibraryTable.pageIndex,
    contentLibraryTable.pageSize,
    contentLibrarySort,
  ]);

  const handleReportExport = async (
    card: (typeof REPORT_CARD_CONFIGS)[number],
    filters: ReportsExportFilters,
  ) => {
    const toDateRange = () =>
      filters.submissionDate?.[0] && filters.submissionDate[1]
        ? {
            dateFrom: filters.submissionDate[0]
              .clone()
              .startOf("day")
              .format("YYYY-MM-DD[T]HH:mm:ss"),
            dateTo: filters.submissionDate[1]
              .clone()
              .endOf("day")
              .format("YYYY-MM-DD[T]HH:mm:ss"),
          }
        : {};
    const toNumber = (value?: string | number) => {
      if (value === undefined || value === "") return undefined;
      const number = Number(value);
      return Number.isFinite(number) ? number : undefined;
    };

    try {
      switch (card.exportKey) {
        case "regulateEntriesApplications":
          await exportRegulateEntriesApplications({
            ...toDateRange(),
            profileType: toNumber(filters.values.profileType),
          });
          break;
        case "circulationMediaMaterialPermit":
          await exportCirculationMediaMaterialPermit({
            ...toDateRange(),
            materialType: normalizeLookupValue(filters.values.materialType),
            profileType: toNumber(filters.values.profileType),
          });
          break;
        case "recordedBooks":
          await exportRecordedBooks({
            ...toDateRange(),
          });
          break;
        case "newspapersMagazinesCirculation":
          await exportNewspapersMagazinesCirculation({
            ...toDateRange(),
            type: filters.values.type as "Magazine" | "Newspaper" | undefined,
            profileType: toNumber(filters.values.profileType),
          });
          break;
        case "bookCirculationPrintingPermit":
          await exportBookCirculationPrintingPermit({
            ...toDateRange(),
            serviceCode: toNumber(filters.values.serviceCode),
            profileType: toNumber(filters.values.profileType),
          });
          break;
      }
    } catch {
      CustomMessage.error(
        translate("contentReportsAnalytics.messages.exportFailed"),
      );
    }
  };

  const timeFilterLabel = formatTimeFilterLabel(
    timeFilterPreset,
    committedTimeFilter,
    timePresetOptions,
    translate("contentReportsAnalytics.timeFilter.last30"),
  );

  const handleTableChange = <T,>(
    tableSetter: React.Dispatch<React.SetStateAction<PaginatedTableResult<T>>>,
    sortSetter: React.Dispatch<
      React.SetStateAction<Pick<AnalyticsTableParams, "orderby" | "sort">>
    >,
    change: AnalyticsTableChange,
  ) => {
    tableSetter((prev) => ({
      ...prev,
      pageIndex: change.pageIndex,
      pageSize: change.pageSize,
    }));
    sortSetter({
      orderby: change.sort ? change.sortKey : undefined,
      sort: change.sort,
    });
  };

  const buildExportParams = (
    params: Partial<AnalyticsTableParams> = {},
  ): Partial<AnalyticsTableParams> => ({
    ...committedTimeFilter,
    ...params,
  });

  const displayServiceData = serviceOperationsData || EMPTY_SERVICE_OPS;
  const displayPermitData = permitAnalyticsData || EMPTY_PERMIT;
  const displayContentData = contentLibraryAnalyticsData || EMPTY_CONTENT;

  return (
    <>
      <PageHeadingPortal>
        {mainTab !== "reports" && (
          <HeaderTimeFilter
            visible={timeFilterVisible}
            preset={timeFilterPreset}
            valueLabel={timeFilterLabel}
            draftRange={draftRange}
            onVisibleChange={handleTimeFilterVisibleChange}
            onPresetSelect={handlePresetSelect}
            onDraftRangeChange={setDraftRange}
            onApplyCustomRange={handleCustomRangeApply}
            onCancelCustomRange={handleCustomRangeCancel}
          />
        )}
      </PageHeadingPortal>

      <div className="content-reports__page">
        <div className="content-reports__card-surface content-reports__tabs-card">
          <SectionTabs
            items={mainAnalyticsTabs}
            activeKey={mainTab}
            onChange={handleMainTabChange}
          />
        </div>

        <div
          className={
            mainTab !== "serviceOperations"
              ? "content-reports__tab--hidden"
              : ""
          }
        >
          <Spin spinning={serviceOpsLoading}>
            <div className="content-reports__tab-content">
              {displayServiceData.summaryCards.length > 0 && (
                <StatCards items={displayServiceData.summaryCards} variant="six" />
              )}
              <div className="content-reports__service-operations-grid">
                <div className="content-reports__service-grid-item content-reports__service-grid-item--small">
                  <DonutChartCard
                    titleKey="contentReportsAnalytics.charts.applicationStatusOverview"
                    data={displayServiceData.applicationStatusOverview}
                    chartVariant="service"
                    layoutVariant="service"
                  />
                </div>
                <div className="content-reports__service-grid-item content-reports__service-grid-item--small">
                  <AIRecommendationOverviewCard
                    titleKey="contentReportsAnalytics.charts.aiRecommendationOverview"
                    data={displayServiceData.aiRecommendationOverview}
                  />
                </div>
                <div className="content-reports__service-grid-item content-reports__service-grid-item--small">
                  <AITagsBreakdownCard
                    titleKey="contentReportsAnalytics.charts.aiTagsBreakdown"
                    data={displayServiceData.aiTagsBreakdown}
                  />
                </div>
                <div className="content-reports__service-grid-item content-reports__service-grid-item--small">
                  <DonutChartCard
                    titleKey="contentReportsAnalytics.charts.applicationsByMediaType"
                    data={displayServiceData.applicationsByMediaType}
                    chartVariant="service"
                    layoutVariant="wideVertical"
                  />
                </div>
                <div className="content-reports__service-grid-item content-reports__service-grid-item--wide">
                  <DonutChartCard
                    titleKey="contentReportsAnalytics.charts.applicationsByUserType"
                    data={displayServiceData.applicationsByUserType}
                    chartVariant="service"
                    layoutVariant="serviceHorizontal"
                  />
                </div>
                <div className="content-reports__service-grid-item content-reports__service-grid-item--small">
                  <HorizontalBarsCard
                    titleKey="contentReportsAnalytics.charts.applicationsByEmirate"
                    data={displayServiceData.applicationsByEmirate}
                  />
                </div>
                <div className="content-reports__service-grid-item content-reports__service-grid-item--small">
                  <DonutChartCard
                    titleKey="contentReportsAnalytics.charts.applicationsByDevice"
                    data={displayServiceData.applicationsByDevice}
                    chartVariant="service"
                    layoutVariant="service"
                  />
                </div>
                <div className="content-reports__service-grid-item content-reports__service-grid-item--small">
                  <DonutChartCard
                    titleKey="contentReportsAnalytics.charts.confirmationMethodBreakdown"
                    data={displayServiceData.confirmationMethodBreakdown}
                    chartVariant="service"
                    layoutVariant="service"
                  />
                </div>
                <div className="content-reports__service-grid-item content-reports__service-grid-item--small">
                  <CustomerSatisfactionCard
                    titleKey="contentReportsAnalytics.charts.customerSatisfactionOverview"
                    data={displayServiceData.csatOverview}
                  />
                </div>
                <div className="content-reports__service-grid-item content-reports__service-grid-item--wide">
                  <TrendChartCard
                    titleKey="contentReportsAnalytics.charts.satisfactionTrendByRating"
                    data={displayServiceData.csatTrend}
                    infoTextKey="contentReportsAnalytics.charts.satisfactionTrendInfo"
                    layoutVariant="edgeAligned"
                    visible={mainTab === "serviceOperations"}
                  />
                </div>
                <div className="content-reports__service-grid-item content-reports__service-grid-item--trend">
                  <TrendChartCard
                    titleKey="contentReportsAnalytics.charts.serviceApplicationTrend"
                    data={displayServiceData.serviceApplicationTrend}
                    visible={mainTab === "serviceOperations"}
                  />
                </div>
                <div className="content-reports__service-grid-item content-reports__service-grid-item--trend">
                  <TrendChartCard
                    titleKey="contentReportsAnalytics.charts.revenueTrend"
                    data={displayServiceData.revenueTrend}
                    visible={mainTab === "serviceOperations"}
                  />
                </div>
                <div className="content-reports__service-grid-item content-reports__service-grid-item--full">
                  <TeamPerformanceTrendCard
                    titleKey="contentReportsAnalytics.charts.teamPerformanceTrend"
                    data={displayServiceData.teamPerformanceTrend}
                    visible={mainTab === "serviceOperations"}
                  />
                </div>
              </div>

              <div className="content-reports__card-surface content-reports__subsection-card">
                <SectionTabs
                  items={operationsAnalyticsTabs}
                  activeKey={operationsTab}
                  onChange={(tab) => {
                    setOperationsTab(tab);
                  }}
                  variant="secondary"
                />

                {operationsTab === "servicePerformance" ? (
                  <ServicePerformanceTable
                    loading={servicePerformanceLoading}
                    rows={servicePerformanceTable.items}
                    total={servicePerformanceTable.total}
                    pageIndex={servicePerformanceTable.pageIndex}
                    pageSize={servicePerformanceTable.pageSize}
                    keyword={servicePerformanceKeyword}
                    sortField={servicePerformanceSort.orderby}
                    sortOrder={servicePerformanceSort.sort}
                    onKeywordChange={setServicePerformanceKeyword}
                    onTableChange={(change) =>
                      handleTableChange(
                        setServicePerformanceTable,
                        setServicePerformanceSort,
                        change,
                      )
                    }
                    onExport={() =>
                      exportServicePerformance(
                        buildExportParams({
                          keyword: servicePerformanceKeyword,
                          option: servicePerformanceOption,
                          orderby: servicePerformanceSort.orderby,
                          sort: servicePerformanceSort.sort,
                        }),
                      )
                    }
                  />
                ) : (
                  <TeamPerformanceTable
                    loading={teamPerformanceLoading}
                    rows={teamPerformanceTable.items}
                    summary={teamPerformanceSummary}
                    total={teamPerformanceTable.total}
                    pageIndex={teamPerformanceTable.pageIndex}
                    pageSize={teamPerformanceTable.pageSize}
                    keyword={teamPerformanceKeyword}
                    sortField={teamPerformanceSort.orderby}
                    sortOrder={teamPerformanceSort.sort}
                    onKeywordChange={setTeamPerformanceKeyword}
                    onTableChange={(change) =>
                      handleTableChange(
                        setTeamPerformanceTable,
                        setTeamPerformanceSort,
                        change,
                      )
                    }
                    onExport={() =>
                      exportTeamPerformance(
                        buildExportParams({
                          keyword: teamPerformanceKeyword,
                          pageIndex: teamPerformanceTable.pageIndex,
                          pageSize: teamPerformanceTable.pageSize,
                          orderby: teamPerformanceSort.orderby,
                          sort: teamPerformanceSort.sort,
                        }),
                      )
                    }
                  />
                )}
              </div>
            </div>
          </Spin>
        </div>

        <div
          className={mainTab !== "permit" ? "content-reports__tab--hidden" : ""}
        >
          <Spin spinning={permitAnalyticsLoading}>
            <div className="content-reports__tab-content">
              <div className="content-reports__grid content-reports__grid--three content-reports__grid--permit">
                <DonutChartCard
                  titleKey="contentReportsAnalytics.charts.permitByStatus"
                  data={displayPermitData.statusDonut}
                  chartVariant="service"
                  layoutVariant="permitStatus"
                />
                {/* Pie per Figma node 44500:68125 - was a horizontal bars card. */}
                <DonutChartCard
                  titleKey="contentReportsAnalytics.charts.permitByUserType"
                  data={displayPermitData.userTypeDonut}
                  chartVariant="service"
                  layoutVariant="service"
                />
                <HorizontalBarsCard
                  titleKey="contentReportsAnalytics.charts.permitByLocation"
                  data={displayPermitData.locationBars}
                  layoutVariant="permit"
                />
              </div>

              <PermitTable
                loading={permitLoading}
                rows={permitTable.items}
                total={permitTable.total}
                pageIndex={permitTable.pageIndex}
                pageSize={permitTable.pageSize}
                keyword={permitKeyword}
                sortField={permitSort.orderby}
                sortOrder={permitSort.sort}
                onKeywordChange={setPermitKeyword}
                onTableChange={(change: AnalyticsTableChange) =>
                  handleTableChange(setPermitTable, setPermitSort, change)
                }
                onExport={() =>
                  exportPermitTable(
                    buildExportParams({
                      keyword: permitKeyword,
                      orderby: permitSort.orderby,
                      sort: permitSort.sort,
                    }),
                  )
                }
              />
            </div>
          </Spin>
        </div>

        <div
          className={
            mainTab !== "content" ? "content-reports__tab--hidden" : ""
          }
        >
          <Spin spinning={contentAnalyticsLoading}>
            <div className="content-reports__tab-content">
              <div className="content-reports__content-layout">
                <DonutChartCard
                  titleKey="contentReportsAnalytics.charts.contentByStatus"
                  data={displayContentData.statusDonut}
                  chartVariant="service"
                  layoutVariant="contentStatus"
                />
                <DonutChartCard
                  titleKey="contentReportsAnalytics.charts.regulateEntryItemByStatus"
                  data={displayContentData.regulateEntryStatusDonut}
                  chartVariant="service"
                  layoutVariant="contentSource"
                />
                <DonutChartCard
                  titleKey="contentReportsAnalytics.charts.contentByType"
                  data={displayContentData.typeDonut}
                  chartVariant="service"
                  layoutVariant="contentType"
                />
                <div className="content-reports__content-trend">
                  <div className="content-reports__content-trend-row">
                    <TrendChartCard
                      titleKey="contentReportsAnalytics.charts.approvedContentTrend"
                      data={displayContentData.approvedTrend}
                      layoutVariant="contentTrend"
                      visible={mainTab === "content"}
                    />
                    <HorizontalBarsCard
                      titleKey="contentReportsAnalytics.charts.publicationCategories"
                      data={displayContentData.publicationCategories}
                    />
                  </div>
                </div>
              </div>

              <ContentLibraryTable
                loading={contentLibraryLoading}
                rows={contentLibraryTable.items}
                total={contentLibraryTable.total}
                pageIndex={contentLibraryTable.pageIndex}
                pageSize={contentLibraryTable.pageSize}
                sortField={contentLibrarySort.orderby}
                sortOrder={contentLibrarySort.sort}
                onTableChange={(change: AnalyticsTableChange) =>
                  handleTableChange(
                    setContentLibraryTable,
                    setContentLibrarySort,
                    change,
                  )
                }
                onExport={() =>
                  exportContentLibraryTable(
                    buildExportParams({
                      orderby: contentLibrarySort.orderby,
                      sort: contentLibrarySort.sort,
                    }),
                  )
                }
              />
            </div>
          </Spin>
        </div>
        <div
          className={
            mainTab !== "reports" ? "content-reports__tab--hidden" : ""
          }
        >
          <div className="content-reports__reports-list">
            {REPORT_CARD_CONFIGS.map((card) => (
              <ReportsExportCard
                key={card.title}
                columns={4}
                title={translate(`contentReportsAnalytics.reports.${card.title}`)}
                dateLabel={translate(
                  "contentReportsAnalytics.reports.applicationSubmissionDate",
                )}
                datePlaceholder={[
                  translate("contentReportsAnalytics.reports.startDate"),
                  translate("contentReportsAnalytics.reports.endDate"),
                ]}
                defaultSubmissionDate={createDefaultReportDateRange}
                fields={card.fields.map(([key, placeholder]) => ({
                  key,
                  label: translate(`contentReportsAnalytics.reports.${key}`),
                  options: reportOptions[key] ?? [],
                  placeholder: translate(
                    `contentReportsAnalytics.reports.${placeholder}`,
                  ),
                }))}
                resetLabel={translate("contentReportsAnalytics.reports.reset")}
                exportLabel={translate("contentReportsAnalytics.reports.export")}
                onExport={(filters) => handleReportExport(card, filters)}
                exportPermissionCode={PERMISSION_CODES.content.reports.export}
                permissionRoutePath={CONTENT_REPORTS_PATH}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
