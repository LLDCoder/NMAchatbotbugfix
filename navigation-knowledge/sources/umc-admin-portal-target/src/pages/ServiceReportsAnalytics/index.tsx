import { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import moment from "moment";
import { Spin } from "antd";
import { useTranslation } from "react-i18next";
import { CustomMessage, PageHeadingPortal } from "@/components/common";
import {
  exportCustomerProfileInsightsTable,
  exportServiceOperationsTable,
  getCustomerProfileInsightsAnalytics,
  getCustomerProfileInsightsTable,
  getServiceOperationsAnalytics,
  getServiceOperationsTable,
} from "@/services/serviceReportsAnalytics";
import SectionTabs from "./components/SectionTabs";
import HeaderTimeFilter from "./components/HeaderTimeFilter";
import StatCards from "./components/StatCards";
import TrendChartCard from "./components/TrendChartCard";
import DonutChartCard from "./components/DonutChartCard";
import ServiceOperationsTable from "./components/ServiceOperationsTable";
import CustomerProfileInsightsTable from "./components/CustomerProfileInsightsTable";
import { REPORTS_ANALYTICS_TIME_PRESET_DAYS } from "./constants";
import type {
  AnalyticsTableChange,
  AnalyticsTableParams,
  AnalyticsTimeFilter,
  CustomerProfileInsightsData,
  CustomerProfileInsightsRow,
  MainAnalyticsTab,
  PaginatedTableResult,
  ReportsAnalyticsRangeValue,
  ReportsAnalyticsTimePreset,
  ServiceDepartmentOption,
  ServiceOperationsAnalyticsData,
  ServiceOperationsRow,
  ServiceScopeOption,
  TabOption,
  TimePresetOption,
} from "./type";
import "./index.less";

const DEFAULT_TIME_FILTER: AnalyticsTimeFilter = {
  days: 30,
};

const DEFAULT_PAGE_INDEX = 1;
const DEFAULT_PAGE_SIZE = 10;

const EMPTY_SERVICE_SUMMARY_CARDS: ServiceOperationsAnalyticsData["summaryCards"] =
  [
    {
      key: "publishedServices",
      value: 0,
      iconKey: "services",
      titleKey: "serviceReportsAnalytics.summary.publishedServices",
    },
    {
      key: "totalApplications",
      value: 0,
      iconKey: "applications",
      titleKey: "serviceReportsAnalytics.summary.totalApplications",
    },
    {
      key: "totalRevenue",
      value: 0,
      valuePrefix: "AED",
      iconKey: "revenue",
      titleKey: "serviceReportsAnalytics.summary.totalRevenue",
    },
    {
      key: "approvalRate",
      value: 0,
      iconKey: "approval",
      titleKey: "serviceReportsAnalytics.summary.approvalRate",
    },
    {
      key: "avgProcessingTime",
      value: 0,
      iconKey: "processing",
      titleKey: "serviceReportsAnalytics.summary.avgProcessingTime",
    },
    {
      key: "avgSatisfaction",
      value: 0,
      iconKey: "satisfaction",
      titleKey: "serviceReportsAnalytics.summary.avgSatisfaction",
    },
    {
      key: "refundApplications",
      value: 0,
      iconKey: "refundApplications",
      titleKey: "serviceReportsAnalytics.summary.refundApplications",
    },
    {
      key: "totalRefunds",
      value: 0,
      valuePrefix: "AED",
      iconKey: "refunds",
      titleKey: "serviceReportsAnalytics.summary.totalRefunds",
    },
  ];

const EMPTY_SERVICE_OPERATIONS: ServiceOperationsAnalyticsData = {
  summaryCards: EMPTY_SERVICE_SUMMARY_CARDS,
  revenueTrend: { categories: [], series: [] },
  serviceApplicationTrend: { categories: [], series: [] },
};

const EMPTY_CUSTOMER_PROFILE: CustomerProfileInsightsData = {
  deviceDistribution: { total: 0, legends: [] },
  userTypeDistribution: { total: 0, legends: [] },
};

const TEXT = {
  tabs: {
    serviceOperations: "serviceReportsAnalytics.tabs.serviceOperations",
    customerProfile: "serviceReportsAnalytics.tabs.customerProfile",
  },
  timeFilter: {
    last7: "serviceReportsAnalytics.timeFilter.last7",
    last30: "serviceReportsAnalytics.timeFilter.last30",
    last6Months: "serviceReportsAnalytics.timeFilter.last6Months",
    lastYear: "serviceReportsAnalytics.timeFilter.lastYear",
    custom: "serviceReportsAnalytics.timeFilter.custom",
  },
} as const;

const MAIN_TAB_OPTIONS: Array<
  Omit<TabOption<MainAnalyticsTab>, "label"> & { textKey: string }
> = [
  {
    key: "serviceOperations",
    textKey: TEXT.tabs.serviceOperations,
  },
  {
    key: "customerProfile",
    textKey: TEXT.tabs.customerProfile,
  },
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

const SERVICE_SCOPE_OPTIONS = [
  {
    value: "AllServices" as ServiceScopeOption,
    translationKey: "serviceReportsAnalytics.options.scope.allServices",
  },
  {
    value: "AllCategories" as ServiceScopeOption,
    translationKey: "serviceReportsAnalytics.options.scope.allCategories",
  },
];

const SERVICE_DEPARTMENT_OPTIONS = [
  {
    value: "AllDepartments" as ServiceDepartmentOption,
    translationKey: "serviceReportsAnalytics.options.departments.allDepartments",
  },
  {
    value: "LicensingDepartment" as ServiceDepartmentOption,
    translationKey: "serviceReportsAnalytics.options.departments.licensingDepartment",
  },
  {
    value: "ContentDepartment" as ServiceDepartmentOption,
    translationKey: "serviceReportsAnalytics.options.departments.contentDepartment",
  },
];

const VALID_MAIN_TABS: MainAnalyticsTab[] = [
  "serviceOperations",
  "customerProfile",
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

const getInitialTab = (search: string): MainAnalyticsTab => {
  const params = new URLSearchParams(search);
  const tab = params.get("tab") as MainAnalyticsTab | null;

  return tab && VALID_MAIN_TABS.includes(tab) ? tab : "serviceOperations";
};

export default function ServiceReportsAnalytics() {
  const { t: translate } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const [mainTab, setMainTab] = useState<MainAnalyticsTab>(() =>
    getInitialTab(location.search),
  );
  const [timeFilterPreset, setTimeFilterPreset] =
    useState<ReportsAnalyticsTimePreset>("last30");
  const [timeFilterVisible, setTimeFilterVisible] = useState(false);
  const [committedTimeFilter, setCommittedTimeFilter] =
    useState<AnalyticsTimeFilter>(DEFAULT_TIME_FILTER);
  const [draftRange, setDraftRange] =
    useState<ReportsAnalyticsRangeValue>(null);

  const [serviceOperationsLoading, setServiceOperationsLoading] =
    useState(false);
  const [customerProfileLoading, setCustomerProfileLoading] = useState(false);
  const [serviceTableLoading, setServiceTableLoading] = useState(false);
  const [customerTableLoading, setCustomerTableLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [serviceOperationsData, setServiceOperationsData] =
    useState<ServiceOperationsAnalyticsData>(EMPTY_SERVICE_OPERATIONS);
  const [customerProfileData, setCustomerProfileData] =
    useState<CustomerProfileInsightsData>(EMPTY_CUSTOMER_PROFILE);

  const [serviceOperationsTable, setServiceOperationsTable] = useState<
    PaginatedTableResult<ServiceOperationsRow>
  >({
    items: [],
    total: 0,
    pageIndex: DEFAULT_PAGE_INDEX,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [serviceOperationsKeyword, setServiceOperationsKeyword] = useState("");
  const [serviceScope, setServiceScope] =
    useState<ServiceScopeOption>("AllServices");
  const [serviceDepartment, setServiceDepartment] =
    useState<ServiceDepartmentOption>("AllDepartments");
  const [serviceTableSort, setServiceTableSort] = useState<
    Pick<AnalyticsTableParams, "orderby" | "sort">
  >({});

  const [customerProfileTable, setCustomerProfileTable] = useState<
    PaginatedTableResult<CustomerProfileInsightsRow>
  >({
    items: [],
    total: 0,
    pageIndex: DEFAULT_PAGE_INDEX,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [customerScope, setCustomerScope] =
    useState<ServiceScopeOption>("AllServices");
  const [customerTableSort, setCustomerTableSort] = useState<
    Pick<AnalyticsTableParams, "orderby" | "sort">
  >({});

  const mainTabs = useMemo(
    () =>
      MAIN_TAB_OPTIONS.map((item) => ({
        key: item.key,
        label: translate(item.textKey),
      })),
    [translate],
  );

  const timePresetOptions = useMemo(
    () =>
      TIME_PRESET_OPTIONS.map((item) => ({
        key: item.key,
        label: translate(item.textKey),
      })),
    [translate],
  );

  const serviceScopeOptions = useMemo(
    () =>
      SERVICE_SCOPE_OPTIONS.map((item) => ({
        value: item.value,
        label: translate(item.translationKey),
      })),
    [translate],
  );

  const serviceDepartmentOptions = useMemo(
    () =>
      SERVICE_DEPARTMENT_OPTIONS.map((item) => ({
        value: item.value,
        label: translate(item.translationKey),
      })),
    [translate],
  );

  const applyCommittedTimeFilter = useCallback(
    (
      preset: ReportsAnalyticsTimePreset,
      filter: AnalyticsTimeFilter,
    ) => {
      setTimeFilterPreset(preset);
      setCommittedTimeFilter(filter);
      setDraftRange(createDraftRangeFromFilter(filter));
      setTimeFilterVisible(false);
    },
    [],
  );

  const handlePresetSelect = useCallback(
    (preset: Exclude<ReportsAnalyticsTimePreset, "custom">) => {
      applyCommittedTimeFilter(preset, {
        days:
          REPORTS_ANALYTICS_TIME_PRESET_DAYS[preset] ?? DEFAULT_TIME_FILTER.days,
      });
    },
    [applyCommittedTimeFilter],
  );

  const handleCustomRangeApply = useCallback(() => {
    if (!draftRange?.[0] || !draftRange?.[1]) {
      return;
    }

    applyCommittedTimeFilter("custom", {
      startDate: draftRange[0].format("YYYY-MM-DD"),
      endDate: draftRange[1].format("YYYY-MM-DD"),
    });
  }, [applyCommittedTimeFilter, draftRange]);

  const handleCustomRangeCancel = useCallback(() => {
    setDraftRange(createDraftRangeFromFilter(committedTimeFilter));
    setTimeFilterVisible(false);
  }, [committedTimeFilter]);

  const handleTimeFilterVisibleChange = useCallback(
    (visible: boolean) => {
      setTimeFilterVisible(visible);

      if (!visible) {
        setDraftRange(createDraftRangeFromFilter(committedTimeFilter));
      }
    },
    [committedTimeFilter],
  );

  const handleMainTabChange = useCallback(
    (tab: MainAnalyticsTab) => {
      setMainTab(tab);
      const params = new URLSearchParams(location.search);
      params.set("tab", tab);
      history.replace({ search: params.toString() });
    },
    [history, location.search],
  );

  useEffect(() => {
    if (mainTab !== "serviceOperations") {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setServiceOperationsLoading(true);
      try {
        const response = await getServiceOperationsAnalytics(committedTimeFilter);
        if (!cancelled) {
          setServiceOperationsData(response.data);
        }
      } finally {
        if (!cancelled) {
          setServiceOperationsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [mainTab, committedTimeFilter]);

  useEffect(() => {
    if (mainTab !== "serviceOperations") {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setServiceTableLoading(true);
      try {
        const response = await getServiceOperationsTable({
          ...committedTimeFilter,
          pageIndex: serviceOperationsTable.pageIndex,
          pageSize: serviceOperationsTable.pageSize,
          keyword: serviceOperationsKeyword,
          option: serviceScope,
          department: serviceDepartment,
          ...serviceTableSort,
        });
        if (!cancelled) {
          setServiceOperationsTable(response.data);
        }
      } finally {
        if (!cancelled) {
          setServiceTableLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [
    committedTimeFilter,
    mainTab,
    serviceDepartment,
    serviceOperationsKeyword,
    serviceOperationsTable.pageIndex,
    serviceOperationsTable.pageSize,
    serviceScope,
    serviceTableSort,
  ]);

  useEffect(() => {
    if (mainTab !== "customerProfile") {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setCustomerProfileLoading(true);
      try {
        const response = await getCustomerProfileInsightsAnalytics(
          committedTimeFilter,
        );
        if (!cancelled) {
          setCustomerProfileData(response.data);
        }
      } finally {
        if (!cancelled) {
          setCustomerProfileLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [mainTab, committedTimeFilter]);

  useEffect(() => {
    if (mainTab !== "customerProfile") {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setCustomerTableLoading(true);
      try {
        const response = await getCustomerProfileInsightsTable({
          ...committedTimeFilter,
          pageIndex: customerProfileTable.pageIndex,
          pageSize: customerProfileTable.pageSize,
          keyword: customerKeyword,
          option: customerScope,
          ...customerTableSort,
        });
        if (!cancelled) {
          setCustomerProfileTable(response.data);
        }
      } finally {
        if (!cancelled) {
          setCustomerTableLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [
    committedTimeFilter,
    customerKeyword,
    customerProfileTable.pageIndex,
    customerProfileTable.pageSize,
    customerScope,
    customerTableSort,
    mainTab,
  ]);

  const timeFilterLabel = formatTimeFilterLabel(
    timeFilterPreset,
    committedTimeFilter,
    timePresetOptions,
    translate("serviceReportsAnalytics.timeFilter.last30"),
  );

  const handleTableChange = <T,>(
    tableSetter: React.Dispatch<React.SetStateAction<PaginatedTableResult<T>>>,
    sortSetter: React.Dispatch<
      React.SetStateAction<Pick<AnalyticsTableParams, "orderby" | "sort">>
    >,
    change: AnalyticsTableChange,
  ) => {
    tableSetter((previous) => ({
      ...previous,
      pageIndex: change.pageIndex,
      pageSize: change.pageSize,
    }));
    sortSetter({
      orderby: change.sort ? change.sortKey : undefined,
      sort: change.sort,
    });
  };

  const handleExport = async (exportFn: () => Promise<void>) => {
    setIsExporting(true);
    try {
      await exportFn();
      CustomMessage.success(translate("serviceReportsAnalytics.messages.exportReady"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
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

      <div className="service-reports__page">
        <div className="service-reports__card-surface service-reports__tabs-card">
          <SectionTabs
            items={mainTabs}
            activeKey={mainTab}
            onChange={handleMainTabChange}
          />
        </div>

        <div
          className={
            mainTab !== "serviceOperations" ? "service-reports__tab--hidden" : ""
          }
        >
          <Spin spinning={serviceOperationsLoading}>
            <div className="service-reports__tab-content">
              <StatCards items={serviceOperationsData.summaryCards} />

              <div className="service-reports__chart-grid">
                <TrendChartCard
                  titleKey="serviceReportsAnalytics.charts.revenueTrend"
                  infoTextKey="serviceReportsAnalytics.charts.revenueTrendInfo"
                  titlePrefix="aed"
                  data={serviceOperationsData.revenueTrend}
                  visible={mainTab === "serviceOperations"}
                />
                <TrendChartCard
                  titleKey="serviceReportsAnalytics.charts.serviceApplicationTrend"
                  data={serviceOperationsData.serviceApplicationTrend}
                  visible={mainTab === "serviceOperations"}
                />
              </div>

              <div className="service-reports__table-card service-reports__card-surface">
                <ServiceOperationsTable
                  loading={serviceTableLoading}
                  rows={serviceOperationsTable.items}
                  total={serviceOperationsTable.total}
                  pageIndex={serviceOperationsTable.pageIndex}
                  pageSize={serviceOperationsTable.pageSize}
                  keyword={serviceOperationsKeyword}
                  scope={serviceScope}
                  scopeOptions={serviceScopeOptions}
                  department={serviceDepartment}
                  departmentOptions={serviceDepartmentOptions}
                  sortField={serviceTableSort.orderby}
                  sortOrder={serviceTableSort.sort}
                  isExporting={isExporting}
                  onKeywordChange={setServiceOperationsKeyword}
                  onScopeChange={setServiceScope}
                  onDepartmentChange={setServiceDepartment}
                  onTableChange={(change) =>
                    handleTableChange(
                      setServiceOperationsTable,
                      setServiceTableSort,
                      change,
                    )
                  }
                  onExport={() =>
                    handleExport(() =>
                      exportServiceOperationsTable({
                        ...committedTimeFilter,
                        keyword: serviceOperationsKeyword,
                        option: serviceScope,
                        department: serviceDepartment,
                        pageIndex: serviceOperationsTable.pageIndex,
                        pageSize: serviceOperationsTable.pageSize,
                        ...serviceTableSort,
                      }),
                    )
                  }
                />
              </div>
            </div>
          </Spin>
        </div>

        <div
          className={
            mainTab !== "customerProfile" ? "service-reports__tab--hidden" : ""
          }
        >
          <Spin spinning={customerProfileLoading}>
            <div className="service-reports__tab-content">
              <div className="service-reports__donut-grid">
                <DonutChartCard
                  titleKey="serviceReportsAnalytics.charts.usersByDevice"
                  data={customerProfileData.deviceDistribution}
                  titleGap={32}
                />
                <DonutChartCard
                  titleKey="serviceReportsAnalytics.charts.applicationsByUserType"
                  data={customerProfileData.userTypeDistribution}
                  titleGap={32}
                  className="service-reports__user-type-donut-card"
                />
              </div>

              <div className="service-reports__table-card service-reports__card-surface">
                <CustomerProfileInsightsTable
                  loading={customerTableLoading}
                  rows={customerProfileTable.items}
                  total={customerProfileTable.total}
                  pageIndex={customerProfileTable.pageIndex}
                  pageSize={customerProfileTable.pageSize}
                  keyword={customerKeyword}
                  scope={customerScope}
                  scopeOptions={serviceScopeOptions}
                  sortField={customerTableSort.orderby}
                  sortOrder={customerTableSort.sort}
                  isExporting={isExporting}
                  onKeywordChange={setCustomerKeyword}
                  onScopeChange={setCustomerScope}
                  onTableChange={(change) =>
                    handleTableChange(
                      setCustomerProfileTable,
                      setCustomerTableSort,
                      change,
                    )
                  }
                  onExport={() =>
                    handleExport(() =>
                      exportCustomerProfileInsightsTable({
                        ...committedTimeFilter,
                        keyword: customerKeyword,
                        option: customerScope,
                        pageIndex: customerProfileTable.pageIndex,
                        pageSize: customerProfileTable.pageSize,
                        ...customerTableSort,
                      }),
                    )
                  }
                />
              </div>
            </div>
          </Spin>
        </div>
      </div>
    </>
  );
}
