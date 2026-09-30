import { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import moment from "moment";
import { useTranslation } from "react-i18next";
import { Spin } from "antd";
import { PageHeadingPortal } from "@/components/common";
import HeaderTimeFilter from "@/pages/ContentReportsAnalytics/components/HeaderTimeFilter";
import SectionTabs from "@/pages/ContentReportsAnalytics/components/SectionTabs";
import DonutChartCard from "@/pages/ContentReportsAnalytics/components/DonutChartCard";
import HorizontalBarsCard from "@/pages/ContentReportsAnalytics/components/HorizontalBarsCard";
import TrendChartCard from "@/pages/ContentReportsAnalytics/components/TrendChartCard";
import {
  getCustomerInsightsSummary,
  getTopCustomers,
  getTopProfiles,
  getOperationalInsightsSummary,
  getServiceSatisfaction,
  getTeamPerformance,
  exportServiceSatisfaction,
  exportTeamPerformance,
} from "@/services/customerReportsAnalytics";
import { CustomerInsightsKpiCards, OperationalInsightsKpiCards } from "./components/KpiCards";
import TeamPerformanceTrendCard from "./components/TeamPerformanceTrendCard";
import CsatOverviewCard from "./components/CsatOverviewCard";
import TopTenSection from "./components/TopTenSection";
import SatisfactionTabsCard from "./components/SatisfactionTabsCard";
import { CUSTOMER_REPORTS_TIME_PRESET_DAYS, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "./constants";
import type {
  AnalyticsTimeFilter,
  CustomerMainTab,
  CustomerTimePreset,
  CustomerInsightsSummaryData,
  OperationalInsightsSummaryData,
  DonutChartData,
  TrendChartData,
  TopCustomerRow,
  TopProfileRow,
  PaginatedResult,
  ServiceSatisfactionRow,
  CustomerTeamPerformanceRow,
  AnalyticsSortOrder,
} from "./type";
import type { ReportsAnalyticsRangeValue, ReportsAnalyticsTranslationKey } from "@/pages/ContentReportsAnalytics/type";
import "./index.less";

const tk = (key: string) => key as ReportsAnalyticsTranslationKey;

const EMPTY_DONUT = { total: 0, legends: [] };
const EMPTY_BARS = { color: "#A0D5AB", items: [] };
const EMPTY_TREND = { categories: [], series: [] };

const EMPTY_CUSTOMER_INSIGHTS: CustomerInsightsSummaryData = {
  totalRegisteredUsers: 0,
  totalApprovedProfiles: 0,
  newUsersInRange: 0,
  newApprovedProfilesInRange: 0,
  customerAgeDistribution: EMPTY_DONUT,
  profileTypeDistribution: EMPTY_DONUT,
  profilesByEmirate: EMPTY_BARS,
  customerGrowthTrend: EMPTY_TREND,
  csat: {
    totalResponses: 0,
    avgRating: 0,
    overallSatisfactionRate: 0,
    satisfiedCount: 0,
    satisfiedRate: 0,
    neutralCount: 0,
    neutralRate: 0,
    dissatisfiedCount: 0,
    dissatisfiedRate: 0,
    csatTrend: EMPTY_TREND,
  },
};

const EMPTY_OPERATIONAL_INSIGHTS: OperationalInsightsSummaryData = {
  inProgressCount: 0,
  avgProcessingTime: { value: 0, unit: "min", display: "0min" },
  slaComplianceRate: 0,
  slaBreachesCount: 0,
  reopenRate: 0,
  enquiriesOverview: { total: 0, statusDistribution: EMPTY_DONUT },
  refundsOverview: { total: 0, statusDistribution: EMPTY_DONUT },
  appealsOverview: { total: 0, statusDistribution: EMPTY_DONUT },
  volumeByTicketType: EMPTY_DONUT,
  volumeByEnquiryType: EMPTY_DONUT,
  enquiriesChannelBars: EMPTY_BARS,
  ticketVolumeTrend: EMPTY_TREND,
  enquiriesChannelDistribution: EMPTY_DONUT,
  teamPerformanceTrend: { categories: [], slaComplianceValues: [], avgProcessingTimeValues: [], avgProcessingTimeUnit: "min" },
};

const DEFAULT_TIME_FILTER: AnalyticsTimeFilter = { days: 30 };

const VALID_MAIN_TABS: CustomerMainTab[] = ["customerInsights", "operationalInsights"];

const getInitialTab = (search: string): CustomerMainTab => {
  const params = new URLSearchParams(search);
  const tab = params.get("tab") as CustomerMainTab | null;
  return tab && VALID_MAIN_TABS.includes(tab) ? tab : "customerInsights";
};

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
  preset: CustomerTimePreset,
  filter: AnalyticsTimeFilter,
  presetOptions: Array<{ key: CustomerTimePreset; label: string }>,
  fallbackLabel: string,
) => {
  if (preset === "custom" && filter.startDate && filter.endDate) {
    return `${moment(filter.startDate, "YYYY-MM-DD").format("DD/MM/YYYY")} - ${moment(
      filter.endDate,
      "YYYY-MM-DD",
    ).format("DD/MM/YYYY")}`;
  }
  return presetOptions.find((item) => item.key === preset)?.label || fallbackLabel;
};

const emptyPaginatedResult = <T,>(): PaginatedResult<T> => ({
  rows: [],
  totalCount: 0,
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
});
type CustomerGrowthBucketUnit =
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "twoYear"
  | "fiveYear";
type CustomerGrowthBucket = {
  start: moment.Moment;
  end: moment.Moment;
  label: string;
};
const CUSTOMER_GROWTH_BUCKET_RANGES: Array<{
  minDays: number;
  maxDays: number;
  unit: CustomerGrowthBucketUnit;
}> = [
  { minDays: 1, maxDays: 14, unit: "day" },
  { minDays: 15, maxDays: 90, unit: "week" },
  { minDays: 91, maxDays: 365, unit: "month" },
  { minDays: 366, maxDays: 1095, unit: "quarter" },
  { minDays: 1096, maxDays: 5110, unit: "year" },
  { minDays: 5111, maxDays: 10220, unit: "twoYear" },
  { minDays: 10221, maxDays: Number.POSITIVE_INFINITY, unit: "fiveYear" },
];
const getCustomerGrowthRange = (filter: AnalyticsTimeFilter) => {
  const end = filter.endDate
    ? moment(filter.endDate, "YYYY-MM-DD").endOf("day")
    : moment().endOf("day");
  const start = filter.startDate
    ? moment(filter.startDate, "YYYY-MM-DD").startOf("day")
    : end
        .clone()
        .subtract(Math.max((filter.days || 1) - 1, 0), "days")
        .startOf("day");
  return { start, end, days: end.diff(start, "days") + 1 };
};
const getCustomerGrowthBucketUnit = (
  days: number,
): CustomerGrowthBucketUnit => {
  const inclusiveDays = Math.max(Math.floor(days), 1);
  return (
    CUSTOMER_GROWTH_BUCKET_RANGES.find(
      ({ minDays, maxDays }) =>
        inclusiveDays >= minDays && inclusiveDays <= maxDays,
    )?.unit || "fiveYear"
  );
};
const getCustomerGrowthAxis = (peak: number) => {
  const normalizedPeak = Number.isFinite(peak) ? Math.max(0, peak) : 0;
  const presets: Array<[number, number, number]> = [
    [100, 100, 20],
    [500, 500, 100],
    [1000, 1000, 200],
    [5000, 5000, 1000],
    [10000, 10000, 2000],
    [50000, 50000, 10000],
    [100000, 100000, 20000],
  ];
  const preset = presets.find(([limit]) => normalizedPeak < limit);
  if (preset) {
    return { max: preset[1], interval: preset[2] };
  }
  const interval = Math.pow(10, Math.floor(Math.log10(normalizedPeak))) / 5;
  const max = Math.ceil(normalizedPeak / interval) * interval;
  return { max, interval };
};
const formatCustomerGrowthAxisLabel = (value: number) => {
  if (value < 1000) return `${value}`;
  const thousands = value / 1000;
  return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
};
const toCustomerGrowthNumber = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};
const parseCustomerGrowthDate = (value: string) => {
  const isoDate = moment(value, moment.ISO_8601, true);
  if (isoDate.isValid()) {
    return isoDate;
  }
  return moment(
    value,
    ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"],
    true,
  );
};
const getCustomerGrowthBucketEnd = (
  start: moment.Moment,
  end: moment.Moment,
  unit: CustomerGrowthBucketUnit,
) => {
  if (unit === "day") return start.clone();
  if (unit === "week") return moment.min(start.clone().add(6, "days"), end);
  if (unit === "month") return moment.min(start.clone().endOf("month"), end);
  if (unit === "quarter") return moment.min(start.clone().endOf("quarter"), end);
  if (unit === "year") return moment.min(start.clone().endOf("year"), end);
  return moment.min(
    start
      .clone()
      .add(unit === "twoYear" ? 2 : 5, "years")
      .subtract(1, "day"),
    end,
  );
};
const getCustomerGrowthBucketLabel = (
  start: moment.Moment,
  end: moment.Moment,
  unit: CustomerGrowthBucketUnit,
) => {
  if (unit === "day") return start.format("DD/MM");
  if (unit === "week") return `${start.format("DD/MM")}-${end.format("DD/MM")}`;
  if (unit === "month") return start.format("MM-YYYY");
  if (unit === "quarter") return `Q${start.quarter()} ${start.year()}`;
  if (unit === "year") return start.format("YYYY");
  return `${start.format("YYYY")}-${end.format("YYYY")}`;
};
const createCustomerGrowthTrend = (
  trend: TrendChartData,
  filter: AnalyticsTimeFilter,
): TrendChartData => {
  const { start, end, days } = getCustomerGrowthRange(filter);
  const unit = getCustomerGrowthBucketUnit(days);
  const dateValues = trend.categories.map(parseCustomerGrowthDate);
  const peak = Math.max(
    0,
    ...trend.series.flatMap((series) =>
      series.values.map(toCustomerGrowthNumber),
    ),
  );
  const axis = getCustomerGrowthAxis(peak);
  if (dateValues.some((date) => !date.isValid())) {
    return {
      ...trend,
      yAxisMin: 0,
      yAxisMax: axis.max,
      yAxisInterval: axis.interval,
    };
  }
  const buckets: CustomerGrowthBucket[] = [];
  let cursor = start.clone();
  while (cursor.isSameOrBefore(end, "day")) {
    const bucketEnd = getCustomerGrowthBucketEnd(cursor, end, unit);
    buckets.push({
      start: cursor.clone(),
      end: bucketEnd,
      label: getCustomerGrowthBucketLabel(cursor, bucketEnd, unit),
    });
    cursor = bucketEnd.clone().add(1, "day");
  }
  const series = trend.series.map((source) => ({
    ...source,
    values: buckets.map((bucket) =>
      source.values.reduce(
        (sum, value, index) => {
          const dateValue = dateValues[index];
          if (
            !dateValue ||
            !dateValue.isBetween(bucket.start, bucket.end, "day", "[]")
          ) {
            return sum;
          }
          return sum + toCustomerGrowthNumber(value);
        },
        0,
      ),
    ),
  }));
  const aggregatedPeak = Math.max(
    0,
    ...series.flatMap((item) => item.values),
  );
  const aggregatedAxis = getCustomerGrowthAxis(aggregatedPeak);
  return {
    ...trend,
    categories: buckets.map((bucket) => bucket.label),
    series,
    yAxisMin: 0,
    yAxisMax: aggregatedAxis.max,
    yAxisInterval: aggregatedAxis.interval,
  };
};

export default function CustomerReportsAnalytics() {
  const { t: translate } = useTranslation();
  const history = useHistory();
  const location = useLocation();

  const [mainTab, setMainTab] = useState<CustomerMainTab>(() =>
    getInitialTab(location.search),
  );

  const [timeFilterPreset, setTimeFilterPreset] = useState<CustomerTimePreset>("last30");
  const [timeFilterVisible, setTimeFilterVisible] = useState(false);
  const [committedTimeFilter, setCommittedTimeFilter] = useState<AnalyticsTimeFilter>(DEFAULT_TIME_FILTER);
  const [draftRange, setDraftRange] = useState<ReportsAnalyticsRangeValue>(null);

  const [customerInsightsLoading, setCustomerInsightsLoading] = useState(false);
  const [customerInsightsData, setCustomerInsightsData] = useState<CustomerInsightsSummaryData | null>(null);

  const [topCustomersLoading, setTopCustomersLoading] = useState(false);
  const [topCustomers, setTopCustomers] = useState<TopCustomerRow[]>([]);

  const [topProfilesLoading, setTopProfilesLoading] = useState(false);
  const [topProfiles, setTopProfiles] = useState<TopProfileRow[]>([]);

  const [operationalLoading, setOperationalLoading] = useState(false);
  const [operationalData, setOperationalData] = useState<OperationalInsightsSummaryData | null>(null);

  const [serviceSatLoading, setServiceSatLoading] = useState(false);
  const [serviceSatResult, setServiceSatResult] = useState<PaginatedResult<ServiceSatisfactionRow>>(
    emptyPaginatedResult(),
  );
  const [serviceSatKeyword, setServiceSatKeyword] = useState("");
  const [serviceSatSortBy, setServiceSatSortBy] = useState<string | undefined>();
  const [serviceSatSortDir, setServiceSatSortDir] = useState<AnalyticsSortOrder | undefined>();

  const [teamPerfLoading, setTeamPerfLoading] = useState(false);
  const [teamPerfResult, setTeamPerfResult] = useState<PaginatedResult<CustomerTeamPerformanceRow>>(
    emptyPaginatedResult(),
  );
  const [teamPerfKeyword, setTeamPerfKeyword] = useState("");
  const [teamPerfSortBy, setTeamPerfSortBy] = useState<string | undefined>();
  const [teamPerfSortDir, setTeamPerfSortDir] = useState<AnalyticsSortOrder | undefined>();

  const MAIN_TAB_OPTIONS = useMemo(
    () => [
      { key: "customerInsights" as CustomerMainTab, label: translate("customerReportsAnalytics.tabs.customerInsights") },
      { key: "operationalInsights" as CustomerMainTab, label: translate("customerReportsAnalytics.tabs.operationalInsights") },
    ],
    [translate],
  );

  const TIME_PRESET_OPTIONS = useMemo(
    () => [
      { key: "last7" as CustomerTimePreset, label: translate("contentReportsAnalytics.timeFilter.last7") },
      { key: "last30" as CustomerTimePreset, label: translate("contentReportsAnalytics.timeFilter.last30") },
      { key: "last6Months" as CustomerTimePreset, label: translate("contentReportsAnalytics.timeFilter.last6Months") },
      { key: "lastYear" as CustomerTimePreset, label: translate("contentReportsAnalytics.timeFilter.lastYear") },
      { key: "custom" as CustomerTimePreset, label: translate("contentReportsAnalytics.timeFilter.custom") },
    ],
    [translate],
  );

  const applyCommittedTimeFilter = (preset: CustomerTimePreset, filter: AnalyticsTimeFilter) => {
    setTimeFilterPreset(preset);
    setCommittedTimeFilter(filter);
    setDraftRange(createDraftRangeFromFilter(filter));
    setTimeFilterVisible(false);
  };

  const handlePresetSelect = (preset: Exclude<CustomerTimePreset, "custom">) => {
    applyCommittedTimeFilter(preset, {
      days: CUSTOMER_REPORTS_TIME_PRESET_DAYS[preset] ?? DEFAULT_TIME_FILTER.days,
    });
  };

  const handleCustomRangeApply = () => {
    if (!draftRange?.[0] || !draftRange?.[1]) return;
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
    (tab: CustomerMainTab) => {
      if (tab === mainTab) return;
      setMainTab(tab);
      const params = new URLSearchParams(location.search);
      params.set("tab", tab);
      history.replace({ search: params.toString() });
    },
    [history, location.search, mainTab],
  );

  useEffect(() => {
    if (mainTab !== "customerInsights") return;
    let cancelled = false;
    const load = async () => {
      setCustomerInsightsLoading(true);
      try {
        const data = await getCustomerInsightsSummary(committedTimeFilter);
        if (!cancelled) setCustomerInsightsData(data);
      } catch (error) {
        console.error("Failed to load customer insights summary:", error);
      } finally {
        if (!cancelled) setCustomerInsightsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mainTab, committedTimeFilter]);

  useEffect(() => {
    if (mainTab !== "customerInsights") return;
    let cancelled = false;
    const load = async () => {
      setTopCustomersLoading(true);
      try {
        const data = await getTopCustomers(committedTimeFilter);
        if (!cancelled) setTopCustomers(data);
      } catch (error) {
        console.error("Failed to load top customers:", error);
      } finally {
        if (!cancelled) setTopCustomersLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mainTab, committedTimeFilter]);

  useEffect(() => {
    if (mainTab !== "customerInsights") return;
    let cancelled = false;
    const load = async () => {
      setTopProfilesLoading(true);
      try {
        const data = await getTopProfiles(committedTimeFilter);
        if (!cancelled) setTopProfiles(data);
      } catch (error) {
        console.error("Failed to load top profiles:", error);
      } finally {
        if (!cancelled) setTopProfilesLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mainTab, committedTimeFilter]);

  useEffect(() => {
    if (mainTab !== "operationalInsights") return;
    let cancelled = false;
    const load = async () => {
      setOperationalLoading(true);
      try {
        const data = await getOperationalInsightsSummary(committedTimeFilter);
        if (!cancelled) setOperationalData(data);
      } catch (error) {
        console.error("Failed to load operational insights summary:", error);
      } finally {
        if (!cancelled) setOperationalLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mainTab, committedTimeFilter]);

  useEffect(() => {
    if (mainTab !== "operationalInsights") return;
    let cancelled = false;
    const load = async () => {
      setServiceSatLoading(true);
      try {
        const data = await getServiceSatisfaction({
          ...committedTimeFilter,
          page: serviceSatResult.page,
          pageSize: serviceSatResult.pageSize,
          searchKeyword: serviceSatKeyword || undefined,
          sortBy: serviceSatSortBy,
          sortDirection: serviceSatSortDir,
        });
        if (!cancelled) setServiceSatResult(data);
      } catch (error) {
        console.error("Failed to load service satisfaction:", error);
      } finally {
        if (!cancelled) setServiceSatLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [
    mainTab,
    committedTimeFilter,
    serviceSatResult.page,
    serviceSatResult.pageSize,
    serviceSatKeyword,
    serviceSatSortBy,
    serviceSatSortDir,
  ]);

  useEffect(() => {
    if (mainTab !== "operationalInsights") return;
    let cancelled = false;
    const load = async () => {
      setTeamPerfLoading(true);
      try {
        const data = await getTeamPerformance({
          ...committedTimeFilter,
          page: teamPerfResult.page,
          pageSize: teamPerfResult.pageSize,
          searchKeyword: teamPerfKeyword || undefined,
          sortBy: teamPerfSortBy,
          sortDirection: teamPerfSortDir,
        });
        if (!cancelled) setTeamPerfResult(data);
      } catch (error) {
        console.error("Failed to load team performance:", error);
      } finally {
        if (!cancelled) setTeamPerfLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [
    mainTab,
    committedTimeFilter,
    teamPerfResult.page,
    teamPerfResult.pageSize,
    teamPerfKeyword,
    teamPerfSortBy,
    teamPerfSortDir,
  ]);

  const timeFilterLabel = formatTimeFilterLabel(
    timeFilterPreset,
    committedTimeFilter,
    TIME_PRESET_OPTIONS,
    translate("contentReportsAnalytics.timeFilter.last30"),
  );

  const displayCustomerInsights = customerInsightsData || EMPTY_CUSTOMER_INSIGHTS;
  const displayOperational = operationalData || EMPTY_OPERATIONAL_INSIGHTS;
  const customerGrowthTrend = createCustomerGrowthTrend(
    displayCustomerInsights.customerGrowthTrend,
    committedTimeFilter,
  );

  const handleServiceSatTableChange = (
    page: number,
    pageSize: number,
    sortBy?: string,
    sortDir?: AnalyticsSortOrder,
  ) => {
    setServiceSatResult((prev) => ({ ...prev, page, pageSize }));
    setServiceSatSortBy(sortBy);
    setServiceSatSortDir(sortDir);
  };

  const handleServiceSatSearchChange = (value: string) => {
    setServiceSatKeyword(value);
    setServiceSatResult((prev) => ({ ...prev, page: 1 }));
  };

  const handleTeamPerfTableChange = (
    page: number,
    pageSize: number,
    sortBy?: string,
    sortDir?: AnalyticsSortOrder,
  ) => {
    setTeamPerfResult((prev) => ({ ...prev, page, pageSize }));
    setTeamPerfSortBy(sortBy);
    setTeamPerfSortDir(sortDir);
  };

  const handleTeamPerfSearchChange = (value: string) => {
    setTeamPerfKeyword(value);
    setTeamPerfResult((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <>
      <PageHeadingPortal>
        <HeaderTimeFilter
          visible={timeFilterVisible}
          preset={timeFilterPreset as any}
          valueLabel={timeFilterLabel}
          draftRange={draftRange}
          onVisibleChange={handleTimeFilterVisibleChange}
          onPresetSelect={handlePresetSelect as any}
          onDraftRangeChange={setDraftRange}
          onApplyCustomRange={handleCustomRangeApply}
          onCancelCustomRange={handleCustomRangeCancel}
        />
      </PageHeadingPortal>

      <div className="content-reports__page customer-reports__page">
        <div className="content-reports__card-surface content-reports__tabs-card">
          <SectionTabs
            items={MAIN_TAB_OPTIONS}
            activeKey={mainTab}
            onChange={handleMainTabChange}
          />
        </div>

        {/* ── Customer Insights tab ── */}
        <div className={mainTab !== "customerInsights" ? "content-reports__tab--hidden" : ""}>
          <Spin spinning={customerInsightsLoading}>
            <div className="content-reports__tab-content">
              <CustomerInsightsKpiCards data={displayCustomerInsights} />

              {/* Row 1: Customer Age Distribution | Profile Type Distribution */}
              <div className="customer-reports__two-col-grid customer-reports__two-col-grid--donuts">
                <DonutChartCard
                  titleKey={tk("customerReportsAnalytics.charts.customerAgeDistribution")}
                  data={displayCustomerInsights.customerAgeDistribution}
                  chartVariant="service"
                  layoutVariant="serviceHorizontal"
                />
                <DonutChartCard
                  titleKey={tk("customerReportsAnalytics.charts.profileTypeDistribution")}
                  data={displayCustomerInsights.profileTypeDistribution}
                  chartVariant="service"
                  layoutVariant="serviceHorizontal"
                />
              </div>

              {/*
                Rows 2 + 3. At >=1920 they are two independent 2-up rows:
                [Emirate | Growth Trend] and [CSAT Overview | CSAT Trend]. Below 1920
                the wrapper merges them into one grid that regroups per Figma node
                44592:75213: [Emirate | CSAT Overview], then each trend full-width.
              */}
              <div className="customer-reports__insights-groups">
                <div className="customer-reports__two-col-grid">
                  <div className="customer-reports__emirate-bars-wrap">
                    <HorizontalBarsCard
                      titleKey={tk("customerReportsAnalytics.charts.profilesByEmirate")}
                      data={displayCustomerInsights.profilesByEmirate}
                    />
                  </div>
                  <TrendChartCard
                    titleKey={tk("customerReportsAnalytics.charts.customerGrowthTrend")}
                    data={customerGrowthTrend}
                    smooth={false}
                    xAxisLabelRotate={
                      customerGrowthTrend.categories.length >= 12 ? 20 : 0
                    }
                    yAxisLabelFormatter={formatCustomerGrowthAxisLabel}
                    visible={mainTab === "customerInsights"}
                  />
                </div>
              </div>

              {/* Row 3: CSAT Overview | CSAT Satisfaction Trend */}
              <div className="customer-reports__two-col-grid customer-reports__csat-row">
                <CsatOverviewCard data={displayCustomerInsights.csat} />
                <TrendChartCard
                  titleKey={tk("customerReportsAnalytics.charts.csatTrend")}
                  data={{
                    ...displayCustomerInsights.csat.csatTrend,
                    series: displayCustomerInsights.csat.csatTrend.series.map(
                      (series, index) => ({
                        ...series,
                        color: ["#A0D5AB", "#81C1FF", "#FAAAA7"][index],
                      }),
                    ),
                  }}
                  smooth={false}
                  visible={mainTab === "customerInsights"}
                />
              </div>

              {/* Row 4: Top 10 tabbed section */}
              <TopTenSection
                topCustomers={topCustomers}
                topProfiles={topProfiles}
                customersLoading={topCustomersLoading}
                profilesLoading={topProfilesLoading}
              />
            </div>
          </Spin>
        </div>

        {/* ── Operational Insights tab ── */}
        <div className={mainTab !== "operationalInsights" ? "content-reports__tab--hidden" : ""}>
          <Spin spinning={operationalLoading}>
            <div className="content-reports__tab-content">
              <OperationalInsightsKpiCards data={displayOperational} />

              {/*
                Below 1440 these two rows merge into one continuous 2-column grid so
                every chart card pairs up two-per-row (Figma node 44604:69771); from
                1440 up they stay as two separate 3-up rows.
              */}
              <div className="customer-reports__operational-charts">
                <div className="customer-reports__overview-donut-grid">
                  <DonutChartCard
                    titleKey={tk("customerReportsAnalytics.charts.enquiriesOverview")}
                    data={displayOperational.enquiriesOverview.statusDistribution}
                    chartVariant="service"
                    layoutVariant="permitStatus"
                  />
                  <DonutChartCard
                    titleKey={tk("customerReportsAnalytics.charts.refundsOverview")}
                    data={displayOperational.refundsOverview.statusDistribution}
                    chartVariant="service"
                    layoutVariant="permitStatus"
                  />
                  <DonutChartCard
                    titleKey={tk("customerReportsAnalytics.charts.appealsOverview")}
                    data={displayOperational.appealsOverview.statusDistribution}
                    chartVariant="service"
                    layoutVariant="permitStatus"
                  />
                </div>

                <div className="customer-reports__three-col-grid">
                  <DonutChartCard
                    titleKey={tk("customerReportsAnalytics.charts.volumeByTicketType")}
                    data={displayOperational.volumeByTicketType}
                    chartVariant="service"
                    layoutVariant="permitStatus"
                  />
                  <DonutChartCard
                    titleKey={tk("customerReportsAnalytics.charts.volumeByEnquiryType")}
                    data={displayOperational.volumeByEnquiryType}
                    chartVariant="service"
                    layoutVariant="permitStatus"
                  />
                  <HorizontalBarsCard
                    titleKey={tk("customerReportsAnalytics.charts.enquiriesChannelDistribution")}
                    data={displayOperational.enquiriesChannelBars}
                  />
                </div>
              </div>

              {/* Below 1920 the two trend cards stack full-width (Figma node 44604:69771). */}
              <div className="customer-reports__two-col-grid customer-reports__operational-trend-row">
                <TrendChartCard
                  titleKey={tk("customerReportsAnalytics.charts.ticketVolumeTrend")}
                  data={displayOperational.ticketVolumeTrend}
                  smooth={false}
                  visible={mainTab === "operationalInsights"}
                />
                <TeamPerformanceTrendCard
                  data={displayOperational.teamPerformanceTrend}
                  slaComplianceRate={displayOperational.slaComplianceRate}
                  slaBreachesCount={displayOperational.slaBreachesCount}
                  avgProcessingTime={displayOperational.avgProcessingTime}
                  smooth={false}
                  visible={mainTab === "operationalInsights"}
                />
              </div>

              <SatisfactionTabsCard
                serviceSatLoading={serviceSatLoading}
                serviceSatResult={serviceSatResult}
                serviceSatKeyword={serviceSatKeyword}
                serviceSatSortBy={serviceSatSortBy}
                serviceSatSortDir={serviceSatSortDir}
                onServiceSatSearchChange={handleServiceSatSearchChange}
                onServiceSatTableChange={handleServiceSatTableChange}
                onServiceSatExport={() => exportServiceSatisfaction(committedTimeFilter)}
                teamPerfLoading={teamPerfLoading}
                teamPerfResult={teamPerfResult}
                teamPerfKeyword={teamPerfKeyword}
                teamPerfSortBy={teamPerfSortBy}
                teamPerfSortDir={teamPerfSortDir}
                onTeamPerfSearchChange={handleTeamPerfSearchChange}
                onTeamPerfTableChange={handleTeamPerfTableChange}
                onTeamPerfExport={() => exportTeamPerformance(committedTimeFilter)}
              />
            </div>
          </Spin>
        </div>
      </div>
    </>
  );
}
