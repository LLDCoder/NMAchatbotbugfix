import { useCallback, useEffect, useMemo, useState } from "react";
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
  exportLicenseDistributionTable,
  exportProfileTeamPerformance,
  exportServicePerformance,
  exportTeamPerformance,
  exportCancelledActivities,
  exportElectronicMedia,
  exportMediaLicenseData,
  getLicenseAnalytics,
  getLicenseDistributionTable,
  getProfileAnalytics,
  getProfileTeamPerformance,
  getServiceOperationsAnalytics,
  getServicePerformance,
  getTeamPerformance,
} from "@/services/licensingReportsAnalytics";
import { getInspectionEmirates } from "@/services/inspection";
import {
  getUserProfileUserTypes,
  type UserManagementValueObject,
} from "@/services/userManagement";
import { isArabicLanguage } from "@/localization/language";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import { unwrapApplicationDictionaryItems } from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/applicationFilterOptions";
import type {
  ReportsExportFilters,
  ReportsExportSelectOption,
} from "@/components/common/ReportsExportCard";
import SectionTabs from "./components/SectionTabs";
import StatCards from "./components/StatCards";
import DonutChartCard from "./components/DonutChartCard";
import HorizontalBarsCard from "./components/HorizontalBarsCard";
import TrendChartCard from "./components/TrendChartCard";
import CsatOverviewCard from "./components/CsatOverviewCard";
import TeamPerformanceTrendCard from "./components/TeamPerformanceTrendCard";
import RevenueBreakdownCard from "./components/RevenueBreakdownCard";
import ServicePerformanceTable from "./components/ServicePerformanceTable";
import TeamPerformanceTable from "./components/TeamPerformanceTable";
import ProfileTeamTable from "./components/ProfileTeamTable";
import LicenseDistributionTable from "./components/LicenseDistributionTable";
import HeaderTimeFilter from "./components/HeaderTimeFilter";
import {
  LICENSE_REPORTS_PATH,
  REPORTS_ANALYTICS_TIME_PRESET_DAYS,
} from "./constants";
import {
  createEmptyLicenseAnalyticsData,
  createEmptyProfileAnalyticsData,
  createEmptyServiceOperationsAnalyticsData,
} from "./services/mappers";
import type {
  AnalyticsSortOrder,
  AnalyticsTableChange,
  AnalyticsTimeFilter,
  LicenseAnalyticsData,
  LicenseDistributionRow,
  MainAnalyticsTab,
  OperationsAnalyticsTab,
  PaginatedTableResult,
  ProfileAnalyticsData,
  ProfileTeamRow,
  ReportsAnalyticsRangeValue,
  ReportsAnalyticsTimePreset,
  ServiceOperationsAnalyticsData,
  ServicePerformanceOption,
  ServicePerformanceRow,
  TabOption,
  TeamPerformanceRow,
  TeamPerformanceSummary,
  TimePresetOption,
} from "./type";
import "./index.less";

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SERVICE_OPTION: ServicePerformanceOption = "AllServices";
const DEFAULT_OPERATIONS_TAB: OperationsAnalyticsTab = "servicePerformance";
const DEFAULT_TIME_FILTER: AnalyticsTimeFilter = {
  days: 30,
};
const createDefaultReportDateRange = (): ReportsExportFilters["submissionDate"] => [
  moment().subtract(30, "days"),
  moment(),
];

const EMPTY_SERVICE_PERFORMANCE: PaginatedTableResult<ServicePerformanceRow> = {
  items: [],
  total: 0,
  pageIndex: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

const EMPTY_TEAM_PERFORMANCE: PaginatedTableResult<TeamPerformanceRow> = {
  items: [],
  total: 0,
  pageIndex: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

const EMPTY_PROFILE_TEAM: PaginatedTableResult<ProfileTeamRow> = {
  items: [],
  total: 0,
  pageIndex: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

const EMPTY_LICENSE_TABLE: PaginatedTableResult<LicenseDistributionRow> = {
  items: [],
  total: 0,
  pageIndex: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

const TEXT = {
  tabs: {
    serviceOperations: "licenseReportsAnalytics.tabs.serviceOperations",
    profile: "licenseReportsAnalytics.tabs.profile",
    license: "licenseReportsAnalytics.tabs.license",
    reports: "licenseReportsAnalytics.tabs.reports",
    servicePerformance: "licenseReportsAnalytics.tabs.servicePerformance",
    teamPerformance: "licenseReportsAnalytics.tabs.teamPerformance",
  },
  options: {
    allServices: "licenseReportsAnalytics.options.filters.allServices",
    allCategories: "licenseReportsAnalytics.options.filters.allCategories",
  },
  timeFilter: {
    last7: "licenseReportsAnalytics.timeFilter.last7",
    last30: "licenseReportsAnalytics.timeFilter.last30",
    last6Months: "licenseReportsAnalytics.timeFilter.last6Months",
    lastYear: "licenseReportsAnalytics.timeFilter.lastYear",
    custom: "licenseReportsAnalytics.timeFilter.custom",
  },
} as const;

const MAIN_TAB_OPTIONS: Array<
  Omit<TabOption<MainAnalyticsTab>, "label"> & { textKey: string }
> = [
  { key: "serviceOperations", textKey: TEXT.tabs.serviceOperations },
  { key: "profile", textKey: TEXT.tabs.profile },
  { key: "license", textKey: TEXT.tabs.license },
  { key: "reports", textKey: TEXT.tabs.reports },
];

const OPERATIONS_TAB_OPTIONS: Array<
  Omit<TabOption<OperationsAnalyticsTab>, "label"> & { textKey: string }
> = [
  { key: "servicePerformance", textKey: TEXT.tabs.servicePerformance },
  { key: "teamPerformance", textKey: TEXT.tabs.teamPerformance },
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
  "profile",
  "license",
  "reports",
];

const getInitialTab = (search: string): MainAnalyticsTab => {
  const params = new URLSearchParams(search);
  const tab = params.get("tab") as MainAnalyticsTab | null;

  return tab && VALID_MAIN_TABS.includes(tab) ? tab : "serviceOperations";
};

const getTabPanelClassName = (active: boolean) =>
  `reports-tab-panel ${active ? "reports-tab-panel-active" : "reports-tab-panel-hidden"}`;
const toReportDateRange = (submissionDate: ReportsExportFilters["submissionDate"]) =>
  submissionDate?.[0] && submissionDate[1]
    ? {
        dateFrom: submissionDate[0]
          .clone()
          .startOf("day")
          .format("YYYY-MM-DD[T]HH:mm:ss"),
        dateTo: submissionDate[1]
          .clone()
          .endOf("day")
          .format("YYYY-MM-DD[T]HH:mm:ss"),
      }
    : {};
const toOptionalNumber = (value?: string) =>
  value === undefined || value === "" ? undefined : Number(value);
type LocalizedSelectOptionSource = {
  id?: number | string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  name?: string | null;
  code?: string | null;
};
type ProfileTypeOptionSource = UserManagementValueObject & {
  isShown?: boolean | null;
};

const normalizeLookupKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const toLocalizedSelectOption = (
  item: LocalizedSelectOptionSource,
  isArabic: boolean,
  valueField: "id" | "code" = "id",
): ReportsExportSelectOption | null => {
  const value = valueField === "code" ? item.code : item.id ?? item.code;
  const localizedLabel = isArabic
    ? item.nameAr || item.nameEn
    : item.nameEn || item.nameAr;
  const label = localizedLabel || item.name || item.code;

  if (value === undefined || value === null || !label) {
    return null;
  }

  return {
    value: String(value),
    label,
  };
};

const toProfileTypeOptions = (
  response: unknown,
  isArabic: boolean,
): ReportsExportSelectOption[] =>
  unwrapApplicationDictionaryItems<ProfileTypeOptionSource>(response)
    .filter((item) => item.isShown !== false)
    .filter((item) => {
      const key = normalizeLookupKey(item.code ?? item.nameEn ?? item.nameAr);
      return !["all", "allusertypes", "allprofiletypes"].includes(key);
    })
    .map((item) => toLocalizedSelectOption(item, isArabic))
    .filter(
      (item): item is ReportsExportSelectOption => item !== null,
    );

export default function LicenseReportsAnalytics() {
  const { t: translate, i18n } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const [mainTab, setMainTab] = useState<MainAnalyticsTab>(() =>
    getInitialTab(location.search),
  );
  const [operationsTab, setOperationsTab] =
    useState<OperationsAnalyticsTab>(DEFAULT_OPERATIONS_TAB);
  const [serviceOpsLoading, setServiceOpsLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [timeFilterPreset, setTimeFilterPreset] =
    useState<ReportsAnalyticsTimePreset>("last30");
  const [timeFilterVisible, setTimeFilterVisible] = useState(false);
  const [committedTimeFilter, setCommittedTimeFilter] =
    useState<AnalyticsTimeFilter>(DEFAULT_TIME_FILTER);
  const [draftRange, setDraftRange] =
    useState<ReportsAnalyticsRangeValue>(null);

  const [serviceOperationsData, setServiceOperationsData] =
    useState<ServiceOperationsAnalyticsData>(
      createEmptyServiceOperationsAnalyticsData(),
    );
  const [profileAnalyticsData, setProfileAnalyticsData] =
    useState<ProfileAnalyticsData>(createEmptyProfileAnalyticsData());
  const [licenseAnalyticsData, setLicenseAnalyticsData] =
    useState<LicenseAnalyticsData>(createEmptyLicenseAnalyticsData());

  const [servicePerformanceLoading, setServicePerformanceLoading] =
    useState(false);
  const [servicePerformanceResult, setServicePerformanceResult] = useState(
    EMPTY_SERVICE_PERFORMANCE,
  );
  const [serviceKeyword, setServiceKeyword] = useState("");
  const [serviceOption, setServiceOption] = useState<ServicePerformanceOption>(
    DEFAULT_SERVICE_OPTION,
  );
  const [servicePageIndex, setServicePageIndex] = useState(1);
  const [servicePageSize, setServicePageSize] = useState(DEFAULT_PAGE_SIZE);
  const [serviceOrderby, setServiceOrderby] = useState<string | undefined>();
  const [serviceSort, setServiceSort] = useState<
    AnalyticsSortOrder | undefined
  >();

  const [teamPerformanceLoading, setTeamPerformanceLoading] = useState(false);
  const [teamPerformanceSummary, setTeamPerformanceSummary] = useState<
    TeamPerformanceSummary[]
  >([]);
  const [teamPerformanceResult, setTeamPerformanceResult] = useState(
    EMPTY_TEAM_PERFORMANCE,
  );
  const [teamKeyword, setTeamKeyword] = useState("");
  const [teamPageIndex, setTeamPageIndex] = useState(1);
  const [teamPageSize, setTeamPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [teamOrderby, setTeamOrderby] = useState<string | undefined>();
  const [teamSort, setTeamSort] = useState<AnalyticsSortOrder | undefined>();

  const [profileTeamLoading, setProfileTeamLoading] = useState(false);
  const [profileTeamResult, setProfileTeamResult] =
    useState(EMPTY_PROFILE_TEAM);
  const [profileKeyword, setProfileKeyword] = useState("");
  const [profilePageIndex, setProfilePageIndex] = useState(1);
  const [profilePageSize, setProfilePageSize] = useState(DEFAULT_PAGE_SIZE);
  const [profileOrderby, setProfileOrderby] = useState<string | undefined>();
  const [profileSort, setProfileSort] = useState<
    AnalyticsSortOrder | undefined
  >();

  const [licenseTableLoading, setLicenseTableLoading] = useState(false);
  const [licenseTableResult, setLicenseTableResult] =
    useState(EMPTY_LICENSE_TABLE);
  const [licenseKeyword, setLicenseKeyword] = useState("");
  const [licensePageIndex, setLicensePageIndex] = useState(1);
  const [licensePageSize, setLicensePageSize] = useState(DEFAULT_PAGE_SIZE);
  const [licenseOrderby, setLicenseOrderby] = useState<string | undefined>();
  const [licenseSort, setLicenseSort] = useState<
    AnalyticsSortOrder | undefined
  >();
  const [emirateOptions, setEmirateOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [profileTypeOptions, setProfileTypeOptions] = useState<
    ReportsExportSelectOption[]
  >([]);
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
    const isArabic = isArabicLanguage(i18n.resolvedLanguage || i18n.language);

    getInspectionEmirates()
      .then((items) => {
        const options = items
          .map((item) => toLocalizedSelectOption(item, isArabic))
          .filter(
            (item): item is ReportsExportSelectOption => item !== null,
          );
        setEmirateOptions(options);
      })
      .catch((error) => {
        console.error("Failed to load emirate options:", error);
      });
  }, [i18n.language, i18n.resolvedLanguage]);

  useEffect(() => {
    if (mainTab !== "reports") {
      return;
    }

    let cancelled = false;
    const isArabic = isArabicLanguage(i18n.resolvedLanguage || i18n.language);

    const loadReportFilterOptions = async () => {
      const profileTypes = await getUserProfileUserTypes();

      if (cancelled) {
        return;
      }

      setProfileTypeOptions(toProfileTypeOptions(profileTypes, isArabic));
    };

    loadReportFilterOptions().catch((error) => {
      console.error("Failed to load profile type options:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [i18n.language, i18n.resolvedLanguage, mainTab]);

  const resolveTableChange = (
    change: AnalyticsTableChange,
    currentPageSize: number,
    currentOrderby?: string,
    currentSort?: AnalyticsSortOrder,
  ) => {
    let nextOrderby = currentOrderby;
    let nextSort = currentSort;

    if (change.action === "sort") {
      nextOrderby = change.sort ? change.sortKey : undefined;
      nextSort = change.sort;
    }

    const pageSizeChanged = change.pageSize !== currentPageSize;
    const sortChanged =
      nextOrderby !== currentOrderby || nextSort !== currentSort;

    return {
      pageIndex: pageSizeChanged || sortChanged ? 1 : change.pageIndex,
      pageSize: change.pageSize,
      orderby: nextOrderby,
      sort: nextSort,
    };
  };

  const resetAllTablePageIndexes = () => {
    setServicePageIndex(1);
    setTeamPageIndex(1);
    setProfilePageIndex(1);
    setLicensePageIndex(1);
  };

  const resetServicePerformanceState = () => {
    setServicePerformanceResult(EMPTY_SERVICE_PERFORMANCE);
    setServiceKeyword("");
    setServiceOption(DEFAULT_SERVICE_OPTION);
    setServicePageIndex(1);
    setServicePageSize(DEFAULT_PAGE_SIZE);
    setServiceOrderby(undefined);
    setServiceSort(undefined);
  };

  const resetTeamPerformanceState = () => {
    setTeamPerformanceSummary([]);
    setTeamPerformanceResult(EMPTY_TEAM_PERFORMANCE);
    setTeamKeyword("");
    setTeamPageIndex(1);
    setTeamPageSize(DEFAULT_PAGE_SIZE);
    setTeamOrderby(undefined);
    setTeamSort(undefined);
  };

  const resetProfileTeamState = () => {
    setProfileTeamResult(EMPTY_PROFILE_TEAM);
    setProfileKeyword("");
    setProfilePageIndex(1);
    setProfilePageSize(DEFAULT_PAGE_SIZE);
    setProfileOrderby(undefined);
    setProfileSort(undefined);
  };

  const resetLicenseTableState = () => {
    setLicenseTableResult(EMPTY_LICENSE_TABLE);
    setLicenseKeyword("");
    setLicensePageIndex(1);
    setLicensePageSize(DEFAULT_PAGE_SIZE);
    setLicenseOrderby(undefined);
    setLicenseSort(undefined);
  };

  const resetNonTimeFilters = useCallback(() => {
    setOperationsTab(DEFAULT_OPERATIONS_TAB);
    resetServicePerformanceState();
    resetTeamPerformanceState();
    resetProfileTeamState();
    resetLicenseTableState();
  }, []);

  const applyCommittedTimeFilter = (
    preset: ReportsAnalyticsTimePreset,
    filter: AnalyticsTimeFilter,
  ) => {
    setTimeFilterPreset(preset);
    setCommittedTimeFilter(filter);
    setDraftRange(createDraftRangeFromFilter(filter));
    setTimeFilterVisible(false);
    resetAllTablePageIndexes();
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
    if (mainTab !== "serviceOperations") return;
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
        if (!cancelled)
          setServiceOperationsData(createEmptyServiceOperationsAnalyticsData());
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
    if (mainTab !== "profile") return;
    let cancelled = false;
    const load = async () => {
      setProfileLoading(true);
      try {
        const response = await getProfileAnalytics(
          committedTimeFilter,
          i18n.language,
        );
        if (!cancelled) setProfileAnalyticsData(response.data);
      } catch (error) {
        console.error("Failed to load profile analytics:", error);
        if (!cancelled)
          setProfileAnalyticsData(createEmptyProfileAnalyticsData());
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [mainTab, committedTimeFilter, i18n.language]);

  useEffect(() => {
    if (mainTab !== "license") return;
    let cancelled = false;
    const load = async () => {
      setLicenseLoading(true);
      try {
        const response = await getLicenseAnalytics(committedTimeFilter);
        if (!cancelled) setLicenseAnalyticsData(response.data);
      } catch (error) {
        console.error("Failed to load license analytics:", error);
        if (!cancelled)
          setLicenseAnalyticsData(createEmptyLicenseAnalyticsData());
      } finally {
        if (!cancelled) setLicenseLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [mainTab, committedTimeFilter]);

  useEffect(() => {
    if (
      mainTab !== "serviceOperations" ||
      operationsTab !== "servicePerformance"
    ) {
      return;
    }

    const loadServicePerformance = async () => {
      setServicePerformanceLoading(true);

      try {
        const response = await getServicePerformance({
          ...committedTimeFilter,
          keyword: serviceKeyword.trim(),
          option: serviceOption,
          pageIndex: servicePageIndex,
          pageSize: servicePageSize,
          orderby: serviceOrderby,
          sort: serviceSort,
        });

        setServicePerformanceResult(response.data);
      } catch (error) {
        console.error("Failed to load service performance table:", error);
      } finally {
        setServicePerformanceLoading(false);
      }
    };

    loadServicePerformance();
  }, [
    mainTab,
    operationsTab,
    serviceKeyword,
    serviceOption,
    servicePageIndex,
    servicePageSize,
    serviceOrderby,
    serviceSort,
    committedTimeFilter,
  ]);

  useEffect(() => {
    if (mainTab !== "serviceOperations" || operationsTab !== "teamPerformance") {
      return;
    }

    const loadTeamPerformance = async () => {
      setTeamPerformanceLoading(true);

      try {
        const response = await getTeamPerformance({
          ...committedTimeFilter,
          keyword: teamKeyword.trim(),
          pageIndex: teamPageIndex,
          pageSize: teamPageSize,
          orderby: teamOrderby,
          sort: teamSort,
        });

        setTeamPerformanceSummary(response.data.summary);
        setTeamPerformanceResult(response.data.table);
      } catch (error) {
        console.error("Failed to load team performance table:", error);
      } finally {
        setTeamPerformanceLoading(false);
      }
    };

    loadTeamPerformance();
  }, [
    mainTab,
    operationsTab,
    teamKeyword,
    teamPageIndex,
    teamPageSize,
    teamOrderby,
    teamSort,
    committedTimeFilter,
  ]);

  useEffect(() => {
    if (mainTab !== "profile") {
      return;
    }

    const loadProfileTeam = async () => {
      setProfileTeamLoading(true);

      try {
        const response = await getProfileTeamPerformance({
          ...committedTimeFilter,
          keyword: profileKeyword.trim(),
          pageIndex: profilePageIndex,
          pageSize: profilePageSize,
          orderby: profileOrderby,
          sort: profileSort,
        });

        setProfileTeamResult(response.data);
      } catch (error) {
        console.error("Failed to load profile team table:", error);
      } finally {
        setProfileTeamLoading(false);
      }
    };

    loadProfileTeam();
  }, [
    mainTab,
    profileKeyword,
    profilePageIndex,
    profilePageSize,
    profileOrderby,
    profileSort,
    committedTimeFilter,
  ]);

  useEffect(() => {
    if (mainTab !== "license") {
      return;
    }

    const loadLicenseTable = async () => {
      setLicenseTableLoading(true);

      try {
        const response = await getLicenseDistributionTable({
          ...committedTimeFilter,
          keyword: licenseKeyword.trim(),
          pageIndex: licensePageIndex,
          pageSize: licensePageSize,
          orderby: licenseOrderby,
          sort: licenseSort,
        });

        setLicenseTableResult(response.data);
      } catch (error) {
        console.error("Failed to load license distribution table:", error);
      } finally {
        setLicenseTableLoading(false);
      }
    };

    loadLicenseTable();
  }, [
    mainTab,
    licenseKeyword,
    licensePageIndex,
    licensePageSize,
    licenseOrderby,
    licenseSort,
    committedTimeFilter,
  ]);

  const handleExport = async (
    exporter: () => Promise<void>,
    errorLabel: string,
  ) => {
    try {
      await exporter();
    } catch (error) {
      console.error(`Failed to export ${errorLabel}:`, error);
      CustomMessage.error(
        translate("licenseReportsAnalytics.messages.exportFailed", {
          target: errorLabel,
        }),
      );
    }
  };
  const handleMediaLicenseExport = async (
    type: "licenseData" | "cancelledActivities" | "electronicMedia",
    filters: ReportsExportFilters,
  ) => {
    try {
      const dateRange = toReportDateRange(filters.submissionDate);

      if (type === "licenseData") {
        await exportMediaLicenseData({
          ...dateRange,
          emirate: toOptionalNumber(filters.values.emirate),
          profileType: toOptionalNumber(filters.values.profileType),
        });
      } else if (type === "cancelledActivities") {
        await exportCancelledActivities({
          ...dateRange,
          emirate: toOptionalNumber(filters.values.emirate),
        });
      } else {
        await exportElectronicMedia({
          ...dateRange,
        });
      }
    } catch {
      CustomMessage.error(
        translate("licenseReportsAnalytics.messages.exportFailed"),
      );
    }
  };

  const timeFilterLabel = formatTimeFilterLabel(
    timeFilterPreset,
    committedTimeFilter,
    timePresetOptions,
    translate("licenseReportsAnalytics.timeFilter.last30"),
  );

  return (
    <>
      {mainTab !== "reports" && (
        <PageHeadingPortal>
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
        </PageHeadingPortal>
      )}

      <div className="reports-analytics-page">
        <div className="analytics-card-surface reports-main-tabs-card">
          <SectionTabs
            items={mainAnalyticsTabs}
            activeKey={mainTab}
            onChange={handleMainTabChange}
          />
        </div>

        <div
          className={getTabPanelClassName(mainTab === "serviceOperations")}
          aria-hidden={mainTab !== "serviceOperations"}
        >
          <Spin spinning={serviceOpsLoading}>
            <div className="reports-tab-content">
              <StatCards items={serviceOperationsData.summaryCards} />

              {/*
                One 12-track grid so the nine cards regroup across 1280. Order: 1 status,
                2 activity, 3 service-category, 4 type, 5 device, 6 emirate, 7 user-type,
                8 csat, 9 satisfaction-trend. Spans in index.less lay them out per the
                Figma 1440 vs 1204/1280 frames.
              */}
              <div className="reports-grid reports-service-grid">
                <DonutChartCard
                  titleKey="licenseReportsAnalytics.charts.applicationStatusOverview"
                  data={serviceOperationsData.applicationStatusDonut}
                  alignLegendToBottom
                  visible={mainTab === "serviceOperations"}
                />
                <HorizontalBarsCard
                  titleKey="licenseReportsAnalytics.charts.applicationsByActivityName"
                  titleTag="#Top 15"
                  data={serviceOperationsData.topActivitiesBars}
                />
                <DonutChartCard
                  titleKey="licenseReportsAnalytics.charts.applicationsByServiceCategory"
                  data={serviceOperationsData.categoryDonut}
                  chartVariant="service"
                  layoutVariant="service"
                  visible={mainTab === "serviceOperations"}
                />
                <DonutChartCard
                  titleKey="licenseReportsAnalytics.charts.applicationsByType"
                  data={serviceOperationsData.typeDonut}
                  chartVariant="service"
                  layoutVariant="service"
                  visible={mainTab === "serviceOperations"}
                />
                <DonutChartCard
                  titleKey="licenseReportsAnalytics.charts.applicationsByDevice"
                  data={serviceOperationsData.deviceDonut}
                  chartVariant="service"
                  layoutVariant="service"
                  alignLegendToBottom
                  visible={mainTab === "serviceOperations"}
                />
                <HorizontalBarsCard
                  titleKey="licenseReportsAnalytics.charts.applicationsByLocation"
                  data={serviceOperationsData.locationBars}
                />
                <DonutChartCard
                  titleKey="licenseReportsAnalytics.charts.applicationsByUserType"
                  data={serviceOperationsData.userTypeDonut}
                  layoutVariant="sideLegend"
                  visible={mainTab === "serviceOperations"}
                />
                <CsatOverviewCard data={serviceOperationsData.csatOverview} />
                <TrendChartCard
                  titleKey="licenseReportsAnalytics.charts.satisfactionTrend"
                  infoTextKey="licenseReportsAnalytics.charts.satisfactionTrendInfo"
                  data={serviceOperationsData.csatTrend}
                  visible={mainTab === "serviceOperations"}
                />
              </div>

              <div className="reports-grid reports-grid-two">
                <TrendChartCard
                  titleKey="licenseReportsAnalytics.charts.serviceApplicationTrend"
                  data={serviceOperationsData.serviceApplicationTrend}
                  visible={mainTab === "serviceOperations"}
                />
                <TeamPerformanceTrendCard
                  titleKey="licenseReportsAnalytics.charts.teamPerformanceTrend"
                  data={serviceOperationsData.teamPerformanceTrend}
                  visible={mainTab === "serviceOperations"}
                />
              </div>

              <div className="reports-grid reports-grid-revenue">
                <TrendChartCard
                  titleKey="licenseReportsAnalytics.charts.revenueTrend"
                  infoTextKey="licenseReportsAnalytics.charts.revenueInfo"
                  titlePrefix="aed"
                  data={serviceOperationsData.revenueTrend}
                  visible={mainTab === "serviceOperations"}
                />
                <RevenueBreakdownCard
                  topActivitiesByRevenue={serviceOperationsData.revenueBreakdown.topActivitiesByRevenue}
                  topServicesByRevenue={serviceOperationsData.revenueBreakdown.topServicesByRevenue}
                  revenueByApplicationType={serviceOperationsData.revenueBreakdown.revenueByApplicationType}
                />
              </div>

              <div className="analytics-card-surface reports-subsection-card">
                <SectionTabs
                  items={operationsAnalyticsTabs}
                  activeKey={operationsTab}
                  onChange={(tab) => {
                    setOperationsTab(tab);
                  }}
                  variant="secondary"
                />

                <div
                  className={getTabPanelClassName(
                    operationsTab === "servicePerformance",
                  )}
                  aria-hidden={operationsTab !== "servicePerformance"}
                >
                  <ServicePerformanceTable
                    loading={servicePerformanceLoading}
                    rows={servicePerformanceResult.items}
                    total={servicePerformanceResult.total}
                    pageIndex={servicePageIndex}
                    pageSize={servicePageSize}
                    keyword={serviceKeyword}
                    sortField={serviceOrderby}
                    sortOrder={serviceSort}
                    onKeywordChange={(value) => {
                      setServiceKeyword(value);
                      setServicePageIndex(1);
                    }}
                    onTableChange={(change) => {
                      const next = resolveTableChange(
                        change,
                        servicePageSize,
                        serviceOrderby,
                        serviceSort,
                      );

                      setServicePageIndex(next.pageIndex);
                      setServicePageSize(next.pageSize);
                      setServiceOrderby(next.orderby);
                      setServiceSort(next.sort);
                    }}
                    onExport={() =>
                      handleExport(
                        () =>
                          exportServicePerformance({
                            ...committedTimeFilter,
                            keyword: serviceKeyword.trim(),
                            option: serviceOption,
                            orderby: serviceOrderby,
                            sort: serviceSort,
                          }),
                        translate(
                          "licenseReportsAnalytics.messages.exportTargets.servicePerformance",
                        ),
                      )
                    }
                  />
                </div>

                <div
                  className={getTabPanelClassName(
                    operationsTab === "teamPerformance",
                  )}
                  aria-hidden={operationsTab !== "teamPerformance"}
                >
                  <TeamPerformanceTable
                    loading={teamPerformanceLoading}
                    rows={teamPerformanceResult.items}
                    summary={teamPerformanceSummary}
                    total={teamPerformanceResult.total}
                    pageIndex={teamPageIndex}
                    pageSize={teamPageSize}
                    keyword={teamKeyword}
                    sortField={teamOrderby}
                    sortOrder={teamSort}
                    onKeywordChange={(value) => {
                      setTeamKeyword(value);
                      setTeamPageIndex(1);
                    }}
                    onTableChange={(change) => {
                      const next = resolveTableChange(
                        change,
                        teamPageSize,
                        teamOrderby,
                        teamSort,
                      );

                      setTeamPageIndex(next.pageIndex);
                      setTeamPageSize(next.pageSize);
                      setTeamOrderby(next.orderby);
                      setTeamSort(next.sort);
                    }}
                    onExport={() =>
                      handleExport(
                        () =>
                          exportTeamPerformance({
                            ...committedTimeFilter,
                            keyword: teamKeyword.trim(),
                            pageIndex: teamPageIndex,
                            pageSize: teamPageSize,
                            orderby: teamOrderby,
                            sort: teamSort,
                          }),
                        translate(
                          "licenseReportsAnalytics.messages.exportTargets.teamPerformance",
                        ),
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </Spin>
        </div>

        <div
          className={getTabPanelClassName(mainTab === "profile")}
          aria-hidden={mainTab !== "profile"}
        >
          <Spin spinning={profileLoading}>
            <div className="reports-tab-content">
              <StatCards items={profileAnalyticsData.summaryCards} />

              <div className="reports-grid reports-profile-top-grid">
                <DonutChartCard
                  titleKey="licenseReportsAnalytics.charts.applicationsByUserType"
                  data={profileAnalyticsData.userTypeDonut}
                  layoutVariant="sideLegend"
                  visible={mainTab === "profile"}
                />
                <TrendChartCard
                  titleKey="licenseReportsAnalytics.charts.profileApplicationTrend"
                  data={profileAnalyticsData.profileApplicationTrend}
                  visible={mainTab === "profile"}
                />
              </div>

              <div className="reports-grid reports-grid-three reports-profile-charts-grid">
                <HorizontalBarsCard
                  titleKey="licenseReportsAnalytics.charts.applicationsByLocation"
                  data={profileAnalyticsData.locationBars}
                />
                <DonutChartCard
                  titleKey="licenseReportsAnalytics.charts.individualApplicationsByVerificationMethods"
                  data={profileAnalyticsData.verificationMethodDonut}
                  chartVariant="service"
                  visible={mainTab === "profile"}
                />
                <DonutChartCard
                  titleKey="licenseReportsAnalytics.charts.applicationsByDevice"
                  data={profileAnalyticsData.deviceDonut}
                  chartVariant="service"
                  visible={mainTab === "profile"}
                />
              </div>

              <ProfileTeamTable
                loading={profileTeamLoading}
                rows={profileTeamResult.items}
                total={profileTeamResult.total}
                pageIndex={profilePageIndex}
                pageSize={profilePageSize}
                keyword={profileKeyword}
                sortField={profileOrderby}
                sortOrder={profileSort}
                onKeywordChange={(value) => {
                  setProfileKeyword(value);
                  setProfilePageIndex(1);
                }}
                onTableChange={(change) => {
                  const next = resolveTableChange(
                    change,
                    profilePageSize,
                    profileOrderby,
                    profileSort,
                  );

                  setProfilePageIndex(next.pageIndex);
                  setProfilePageSize(next.pageSize);
                  setProfileOrderby(next.orderby);
                  setProfileSort(next.sort);
                }}
                onExport={() =>
                  handleExport(
                    () =>
                      exportProfileTeamPerformance({
                        ...committedTimeFilter,
                        keyword: profileKeyword.trim(),
                        pageIndex: profilePageIndex,
                        pageSize: profilePageSize,
                        orderby: profileOrderby,
                        sort: profileSort,
                      }),
                    translate(
                      "licenseReportsAnalytics.messages.exportTargets.profileAnalytics",
                    ),
                  )
                }
              />
            </div>
          </Spin>
        </div>

        <div
          className={getTabPanelClassName(mainTab === "license")}
          aria-hidden={mainTab !== "license"}
        >
          <Spin spinning={licenseLoading}>
            <div className="reports-tab-content">
              {/*
                One grid so the cards can regroup across the 1440 breakpoint. Card order
                is status, trend, emirate, user-type; spans in index.less arrange them as
                status+trend / emirate+user-type at >=1440 (user-type is a side-legend
                pie, Figma 44485:65711) and status+emirate / trend(full) / user-type(full)
                below 1440 (Figma 44485:63783).
              */}
              <div className="reports-grid reports-license-grid">
                <DonutChartCard
                  titleKey="licenseReportsAnalytics.charts.licensesByStatus"
                  data={licenseAnalyticsData.statusDonut}
                  chartVariant="service"
                  footerLabel={translate(
                    "licenseReportsAnalytics.summary.renewalRate",
                  )}
                  footerValue={licenseAnalyticsData.renewalRate || "0.00%"}
                  visible={mainTab === "license"}
                />
                <TrendChartCard
                  titleKey="licenseReportsAnalytics.charts.issuedLicenseTrendByType"
                  data={licenseAnalyticsData.issuedTrend}
                  visible={mainTab === "license"}
                  layout="sideLegend"
                />
                <HorizontalBarsCard
                  titleKey="licenseReportsAnalytics.charts.licensesByLocation"
                  data={licenseAnalyticsData.locationBars}
                />
                <DonutChartCard
                  titleKey="licenseReportsAnalytics.charts.licensesByUserType"
                  data={licenseAnalyticsData.userTypeDonut}
                  layoutVariant="sideLegend"
                  visible={mainTab === "license"}
                />
              </div>

              <LicenseDistributionTable
                loading={licenseTableLoading}
                rows={licenseTableResult.items}
                total={licenseTableResult.total}
                pageIndex={licensePageIndex}
                pageSize={licensePageSize}
                keyword={licenseKeyword}
                sortField={licenseOrderby}
                sortOrder={licenseSort}
                onKeywordChange={(value) => {
                  setLicenseKeyword(value);
                  setLicensePageIndex(1);
                }}
                onTableChange={(change) => {
                  const next = resolveTableChange(
                    change,
                    licensePageSize,
                    licenseOrderby,
                    licenseSort,
                  );

                  setLicensePageIndex(next.pageIndex);
                  setLicensePageSize(next.pageSize);
                  setLicenseOrderby(next.orderby);
                  setLicenseSort(next.sort);
                }}
                onExport={() =>
                  handleExport(
                    () =>
                      exportLicenseDistributionTable({
                        ...committedTimeFilter,
                        keyword: licenseKeyword.trim(),
                        orderby: licenseOrderby,
                        sort: licenseSort,
                      }),
                    translate(
                      "licenseReportsAnalytics.messages.exportTargets.licenseAnalytics",
                    ),
                  )
                }
              />
            </div>
          </Spin>
        </div>

        <div
          className={getTabPanelClassName(mainTab === "reports")}
          aria-hidden={mainTab !== "reports"}
        >
          <div className="reports-tab-content reports-export-list">
            <ReportsExportCard
              title={translate("licenseReportsAnalytics.reports.licenseData")}
              dateLabel={translate(
                "licenseReportsAnalytics.reports.applicationSubmissionDate",
              )}
              datePlaceholder={[
                translate("licenseReportsAnalytics.reports.startDate"),
                translate("licenseReportsAnalytics.reports.endDate"),
              ]}
              defaultSubmissionDate={createDefaultReportDateRange}
              fields={[
                {
                  key: "emirate",
                  label: translate("licenseReportsAnalytics.reports.emirate"),
                  placeholder: translate(
                    "licenseReportsAnalytics.reports.selectEmirate",
                  ),
                  options: emirateOptions,
                },
                {
                  key: "profileType",
                  label: translate("licenseReportsAnalytics.reports.profileType"),
                  placeholder: translate(
                    "licenseReportsAnalytics.reports.selectProfileType",
                  ),
                  options: profileTypeOptions,
                },
              ]}
              resetLabel={translate("licenseReportsAnalytics.reports.reset")}
              exportLabel={translate("licenseReportsAnalytics.reports.export")}
              onExport={(filters) =>
                handleMediaLicenseExport("licenseData", filters)
              }
              exportPermissionCode={PERMISSION_CODES.licensing.reports.export}
              permissionRoutePath={LICENSE_REPORTS_PATH}
            />
            <ReportsExportCard
              title={translate(
                "licenseReportsAnalytics.reports.cancelledActivities",
              )}
              dateLabel={translate(
                "licenseReportsAnalytics.reports.applicationSubmissionDate",
              )}
              datePlaceholder={[
                translate("licenseReportsAnalytics.reports.startDate"),
                translate("licenseReportsAnalytics.reports.endDate"),
              ]}
              defaultSubmissionDate={createDefaultReportDateRange}
              fields={[
                {
                  key: "emirate",
                  label: translate("licenseReportsAnalytics.reports.emirate"),
                  placeholder: translate(
                    "licenseReportsAnalytics.reports.selectEmirate",
                  ),
                  options: emirateOptions,
                },
              ]}
              resetLabel={translate("licenseReportsAnalytics.reports.reset")}
              exportLabel={translate("licenseReportsAnalytics.reports.export")}
              onExport={(filters) =>
                handleMediaLicenseExport("cancelledActivities", filters)
              }
              exportPermissionCode={PERMISSION_CODES.licensing.reports.export}
              permissionRoutePath={LICENSE_REPORTS_PATH}
            />
            <ReportsExportCard
              title={translate(
                "licenseReportsAnalytics.reports.electronicMedia",
              )}
              dateLabel={translate(
                "licenseReportsAnalytics.reports.applicationSubmissionDate",
              )}
              datePlaceholder={[
                translate("licenseReportsAnalytics.reports.startDate"),
                translate("licenseReportsAnalytics.reports.endDate"),
              ]}
              defaultSubmissionDate={createDefaultReportDateRange}
              fields={[]}
              resetLabel={translate("licenseReportsAnalytics.reports.reset")}
              exportLabel={translate("licenseReportsAnalytics.reports.export")}
              onExport={(filters) =>
                handleMediaLicenseExport("electronicMedia", filters)
              }
              exportPermissionCode={PERMISSION_CODES.licensing.reports.export}
              permissionRoutePath={LICENSE_REPORTS_PATH}
            />
          </div>
        </div>
      </div>
    </>
  );
}
