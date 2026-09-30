import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import moment from "moment";
import { Spin, Tabs } from "antd";
import { useTranslation } from "react-i18next";
import { CustomMessage, PageHeadingPortal, ReportsExportCard } from "@/components/common";
import type { ReportsExportFilters } from "@/components/common/ReportsExportCard";
import { getInspectionEmiratesFresh } from "@/services/inspection";
import type { InspectionGeoLookupOption } from "@/services/inspection";
import { COLORS, REPORTS_ANALYTICS_TIME_PRESET_DAYS } from "./constants";
import {
  CurrencyUnitTitle,
  DonutChartCard,
  FineCollectionCard,
  GaugeCard,
  HeatmapCard,
  HorizontalBarsCard,
  RiskTaskSourceCard,
  StackedDistributionCard,
  SummaryCards,
  TabbedTrendChartCard,
  TeamPerformanceTrendCard,
  TrendChartCard,
} from "./components/AnalyticsCards";
import {
  HighRiskProfilesTable,
  OperationalAnalyticsTable,
} from "./components/AnalyticsTables";
import HeaderTimeFilter from "./components/HeaderTimeFilter";
import {
  exportEmirateBreakdown,
  exportInspectionExpiredLicenses,
  exportInspectionTasks,
  exportInspectionViolations,
  exportTeamPerformance,
  getEmirateBreakdownRows,
  getInspectionReportsAnalytics,
  getTeamPerformancePage,
} from "./services";
import { buildEmptyInspectionReportsAnalytics } from "./services/empty";
import type { TeamPerformanceQueryOptions } from "./services";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import type {
  AnalyticsTimeFilter,
  InspectionAnalyticsRangeValue,
  InspectionAnalyticsTab,
  InspectionAnalyticsTimePreset,
  DonutData,
  HorizontalBarItem,
  OperationalAnalyticsData,
  RiskAnalyticsData,
} from "./types";
import "./index.less";

const DEFAULT_FILTER: AnalyticsTimeFilter = { days: 30 };
const INSPECTION_REPORTS_PATH = "/inspection/reports-analytics";
const createDefaultReportDateRange = (): ReportsExportFilters["submissionDate"] => [
  moment().subtract(30, "days"),
  moment(),
];

const TAB_OPTIONS: InspectionAnalyticsTab[] = ["operational", "risk", "reports"];

/* ─── Static option lists for Reports tab ─── */

/** violationType: 1=License Violation, 2=Content Violation (from inspection.ts VIOLATION_TYPE_ID_MAP) */
const VIOLATION_TYPE_OPTIONS_EN = [
  { value: "1", label: "License Violation" },
  { value: "2", label: "Content Violation" },
];
const VIOLATION_TYPE_OPTIONS_AR = [
  { value: "1", label: "مخالفة ترخيص" },
  { value: "2", label: "مخالفة محتوى" },
];

/** violationStatus: ids 1-10 from inspection.ts VIOLATION_STATUS_ID_MAP */
const VIOLATION_STATUS_OPTIONS_EN = [
  { value: "1", label: "Warning Issued" },
  { value: "2", label: "Pending Routing" },
  { value: "3", label: "Pending Content Report" },
  { value: "4", label: "Pending Review" },
  { value: "5", label: "Pending Committee Decision" },
  { value: "6", label: "Pending Approval" },
  { value: "7", label: "Pending Payment" },
  { value: "8", label: "Under Appeal" },
  { value: "9", label: "Paid" },
  { value: "10", label: "Cancelled" },
];
const VIOLATION_STATUS_OPTIONS_AR = [
  { value: "1", label: "تم إصدار تحذير" },
  { value: "2", label: "قيد التوجيه" },
  { value: "3", label: "قيد تقرير المحتوى" },
  { value: "4", label: "قيد المراجعة" },
  { value: "5", label: "قيد قرار اللجنة" },
  { value: "6", label: "قيد الاعتماد" },
  { value: "7", label: "قيد الدفع" },
  { value: "8", label: "قيد الاستئناف" },
  { value: "9", label: "مدفوع" },
  { value: "10", label: "ملغى" },
];

type EmirateOption = { value: string; label: string };

const toDateFrom = (m: moment.Moment | null | undefined) =>
  m ? m.clone().startOf("day").format("YYYY-MM-DD[T]HH:mm:ss") : undefined;
const toDateTo = (m: moment.Moment | null | undefined) =>
  m ? m.clone().endOf("day").format("YYYY-MM-DD[T]HH:mm:ss") : undefined;
const toInt = (v?: string) => {
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
};

function ReportsDashboard({ isArabic }: { isArabic: boolean }) {
  const { t } = useTranslation();
  const rawEmiratesRef = useRef<InspectionGeoLookupOption[]>([]);
  const [emirateOptions, setEmirateOptions] = useState<EmirateOption[]>([]);

  const toEmirateOptions = useCallback(
    (items: InspectionGeoLookupOption[]): EmirateOption[] =>
      items
        .filter((item) => item.id !== undefined && item.id !== null && String(item.id).trim() !== "")
        .map((item) => ({
          value: String(item.id),
          label: isArabic
            ? (item.nameAr || item.nameEn || item.name || String(item.code ?? item.id))
            : (item.nameEn || item.name || String(item.code ?? item.id)),
        })),
    [isArabic],
  );

  useEffect(() => {
    if (rawEmiratesRef.current.length > 0) {
      setEmirateOptions(toEmirateOptions(rawEmiratesRef.current));
      return;
    }
    getInspectionEmiratesFresh()
      .then((items) => {
        rawEmiratesRef.current = items;
        setEmirateOptions(toEmirateOptions(items));
      })
      .catch(() => {/* silently fall back to empty */});
  }, [isArabic, toEmirateOptions]);

  const violationTypeOptions = isArabic ? VIOLATION_TYPE_OPTIONS_AR : VIOLATION_TYPE_OPTIONS_EN;
  const violationStatusOptions = isArabic ? VIOLATION_STATUS_OPTIONS_AR : VIOLATION_STATUS_OPTIONS_EN;

  const handleTasksExport = async (filters: ReportsExportFilters) => {
    try {
      await exportInspectionTasks({
        dateFrom: toDateFrom(filters.submissionDate?.[0]),
        dateTo: toDateTo(filters.submissionDate?.[1]),
        emirate: toInt(filters.values.emirate),
      });
    } catch {
      CustomMessage.error(t("inspection.reportsAnalytics.reports.exportFailed"));
    }
  };

  const handleViolationsExport = async (filters: ReportsExportFilters) => {
    try {
      await exportInspectionViolations({
        dateFrom: toDateFrom(filters.submissionDate?.[0]),
        dateTo: toDateTo(filters.submissionDate?.[1]),
        emirate: toInt(filters.values.emirate),
        violationType: toInt(filters.values.violationType),
        violationStatus: toInt(filters.values.violationStatus),
      });
    } catch {
      CustomMessage.error(t("inspection.reportsAnalytics.reports.exportFailed"));
    }
  };

  const handleExpiredLicensesExport = async (filters: ReportsExportFilters) => {
    try {
      await exportInspectionExpiredLicenses({
        dateFrom: toDateFrom(filters.submissionDate?.[0]),
        dateTo: toDateTo(filters.submissionDate?.[1]),
        emirate: toInt(filters.values.emirate),
      });
    } catch {
      CustomMessage.error(t("inspection.reportsAnalytics.reports.exportFailed"));
    }
  };

  const datePlaceholder: [string, string] = [
    t("inspection.reportsAnalytics.reports.startDate"),
    t("inspection.reportsAnalytics.reports.endDate"),
  ];
  const resetLabel = t("inspection.reportsAnalytics.reports.reset");
  const exportLabel = t("inspection.reportsAnalytics.reports.export");
  const emiratePlaceholder = t("inspection.reportsAnalytics.reports.allEmirates");

  return (
    <div className="inspection-reports__reports-list">
      <ReportsExportCard
        columns={3}
        title={t("inspection.reportsAnalytics.reports.inspectionTasks")}
        dateLabel={t("inspection.reportsAnalytics.reports.inspectionDate")}
        datePlaceholder={datePlaceholder}
        defaultSubmissionDate={createDefaultReportDateRange}
        resetLabel={resetLabel}
        exportLabel={exportLabel}
        fields={[
          {
            key: "emirate",
            label: t("inspection.reportsAnalytics.reports.emirate"),
            options: emirateOptions,
            placeholder: emiratePlaceholder,
          },
        ]}
        onExport={handleTasksExport}
        exportPermissionCode={PERMISSION_CODES.inspection.reports.export}
        permissionRoutePath={INSPECTION_REPORTS_PATH}
      />
      <ReportsExportCard
        columns={4}
        title={t("inspection.reportsAnalytics.reports.inspectionViolations")}
        dateLabel={t("inspection.reportsAnalytics.reports.creationTime")}
        datePlaceholder={datePlaceholder}
        defaultSubmissionDate={createDefaultReportDateRange}
        resetLabel={resetLabel}
        exportLabel={exportLabel}
        fields={[
          {
            key: "emirate",
            label: t("inspection.reportsAnalytics.reports.emirate"),
            options: emirateOptions,
            placeholder: emiratePlaceholder,
          },
          {
            key: "violationType",
            label: t("inspection.reportsAnalytics.reports.violationType"),
            options: violationTypeOptions,
            placeholder: t("inspection.reportsAnalytics.reports.allViolationTypes"),
          },
          {
            key: "violationStatus",
            label: t("inspection.reportsAnalytics.reports.violationStatus"),
            options: violationStatusOptions,
            placeholder: t("inspection.reportsAnalytics.reports.allViolationStatuses"),
          },
        ]}
        onExport={handleViolationsExport}
        exportPermissionCode={PERMISSION_CODES.inspection.reports.export}
        permissionRoutePath={INSPECTION_REPORTS_PATH}
      />
      <ReportsExportCard
        columns={3}
        title={t("inspection.reportsAnalytics.reports.expiredLicenses")}
        dateLabel={t("inspection.reportsAnalytics.reports.activityExpiryDate")}
        datePlaceholder={datePlaceholder}
        defaultSubmissionDate={createDefaultReportDateRange}
        resetLabel={resetLabel}
        exportLabel={exportLabel}
        fields={[
          {
            key: "emirate",
            label: t("inspection.reportsAnalytics.reports.emirate"),
            options: emirateOptions,
            placeholder: emiratePlaceholder,
          },
        ]}
        onExport={handleExpiredLicensesExport}
        exportPermissionCode={PERMISSION_CODES.inspection.reports.export}
        permissionRoutePath={INSPECTION_REPORTS_PATH}
      />
    </div>
  );
}

const PENALTY_COLORS: Record<string, string> = {
  "First Degree": COLORS.red,
  "Second Degree": COLORS.orange,
  "Third Degree": COLORS.yellow,
  "Fourth Degree": COLORS.green,
};

const toPenaltyDonut = (items: HorizontalBarItem[]): DonutData => ({
  total: items.reduce((total, item) => total + item.value, 0),
  items: items.map((item) => ({
    label: item.label,
    value: item.value,
    color: PENALTY_COLORS[item.label] || item.color || COLORS.green,
    percentage: item.percentage,
  })),
});

const getInitialTab = (search: string): InspectionAnalyticsTab => {
  const tab = new URLSearchParams(search).get("tab") as InspectionAnalyticsTab | null;
  return tab && TAB_OPTIONS.includes(tab) ? tab : "operational";
};

const createDraftRange = (filter: AnalyticsTimeFilter): InspectionAnalyticsRangeValue =>
  filter.startDate && filter.endDate
    ? [moment(filter.startDate, "YYYY-MM-DD"), moment(filter.endDate, "YYYY-MM-DD")]
    : null;

function OperationalDashboard({
  data,
  filter,
}: {
  data: OperationalAnalyticsData;
  filter: AnalyticsTimeFilter;
}) {
  const { t } = useTranslation();
  const loadEmirateRows = useCallback(
    (search: string) => getEmirateBreakdownRows(filter, search),
    [filter],
  );
  const exportEmirateRows = useCallback(
    (search: string) => exportEmirateBreakdown(filter, { search }),
    [filter],
  );
  const loadTeamRows = useCallback(
    (options: TeamPerformanceQueryOptions) => getTeamPerformancePage(filter, options),
    [filter],
  );
  const exportTeamRows = useCallback(
    (options: TeamPerformanceQueryOptions) => exportTeamPerformance(filter, options),
    [filter],
  );

  return (
    <div className="inspection-reports__dashboard inspection-reports__dashboard--operational">
      <SummaryCards items={data.summaryCards} />
      <div className="inspection-reports__operational-primary">
        <div className="inspection-reports__operational-status-column">
          <DonutChartCard
            title={t("inspection.reportsAnalytics.titles.inspectionStatus")}
            data={data.inspectionStatus}
            className="inspection-reports__operational-inspection-status"
          />
          <DonutChartCard
            title={t("inspection.reportsAnalytics.titles.violationStatus")}
            data={data.violationStatus}
            className="inspection-reports__operational-violation-status"
          />
        </div>
        <div className="inspection-reports__operational-trend-column">
          <TrendChartCard
            title={t("inspection.reportsAnalytics.titles.inspectionViolationTrend")}
            data={data.inspectionAndViolationTrend}
          />
          <TrendChartCard
            title={<CurrencyUnitTitle>{t("inspection.reportsAnalytics.titles.fineTrendByCategory")}</CurrencyUnitTitle>}
            data={data.fineTrend}
            className="inspection-reports__fine-trend-card"
            headingClassName="inspection-reports__fine-trend-heading"
            visualClassName="inspection-reports__trend-visual--fine"
            tooltipVariant="fine"
          />
          <TabbedTrendChartCard
            items={[
              {
                key: "inspection",
                title: t("inspection.reportsAnalytics.titles.inspectionTrendByEmirate"),
                data: data.inspectionByEmirate,
              },
              {
                key: "violation",
                title: t("inspection.reportsAnalytics.titles.violationTrendByEmirate"),
                data: data.violationsByEmirate,
              },
              {
                key: "fine",
                title: <CurrencyUnitTitle>{t("inspection.reportsAnalytics.titles.fineTrendByEmirate")}</CurrencyUnitTitle>,
                data: data.fineByEmirate,
              },
            ]}
          />
        </div>
      </div>

      <div className="inspection-reports__operational-heatmaps">
        <HeatmapCard
          title={t("inspection.reportsAnalytics.titles.licenseViolationsByEmirate")}
          data={data.licenseHeatmap}
          className="inspection-reports__operational-heatmap-card"
        />
        <HeatmapCard
          title={t("inspection.reportsAnalytics.titles.contentViolationsByEmirate")}
          data={data.contentHeatmap}
          className="inspection-reports__operational-heatmap-card"
        />
      </div>

      <div className="inspection-reports__operational-summary-charts">
        <FineCollectionCard data={data.fineCollection} />
        <DonutChartCard
          title={t("inspection.reportsAnalytics.titles.appealOutcomes")}
          data={data.appealOutcomes}
        />
        <DonutChartCard
          title={t("inspection.reportsAnalytics.titles.penaltiesByViolationDegree")}
          data={toPenaltyDonut(data.penaltiesByDegree)}
          className="inspection-reports__penalties-card"
        />
      </div>

      <div className="inspection-reports__operational-performance-row">
        <TeamPerformanceTrendCard summary={data.teamSummary} data={data.teamPerformanceTrend} />
        <HorizontalBarsCard
          title={t("inspection.reportsAnalytics.titles.topRepeatViolators")}
          items={data.repeatViolators}
          valueSuffix={t("inspection.reportsAnalytics.metrics.violations")}
        />
      </div>

      <OperationalAnalyticsTable
        emirateRows={data.emirateRows}
        teamRows={data.teamRows}
        teamTotalCount={data.teamTotalCount}
        onEmirateQuery={loadEmirateRows}
        onEmirateExport={exportEmirateRows}
        onTeamQuery={loadTeamRows}
        onTeamExport={exportTeamRows}
      />
    </div>
  );
}

function RiskDashboard({ data }: { data: RiskAnalyticsData }) {
  const { t } = useTranslation();

  return (
    <div className="inspection-reports__dashboard inspection-reports__dashboard--risk">
      <SummaryCards items={data.summaryCards} />
      <div className="inspection-reports__risk-top-row">
        <DonutChartCard
          title={t("inspection.reportsAnalytics.titles.topRiskDrivenInspectionReasons")}
          data={data.riskReasons}
          className="inspection-reports__risk-top-card inspection-reports__risk-reasons-card"
        />
        <GaugeCard
          title={t("inspection.reportsAnalytics.titles.aiTriggeredHitRate")}
          data={data.aiHitRate}
          className="inspection-reports__risk-top-card"
        />
        <RiskTaskSourceCard
          autoTriageRate={data.sourceMetrics.autoTriageRate}
          tasksPerDay={data.sourceMetrics.tasksPerDay}
          sourceDistribution={data.sourceMetrics.sourceDistribution}
        />
      </div>

      <div className="inspection-reports__risk-middle-row">
        <div className="inspection-reports__risk-left-column">
          <DonutChartCard
            title={t("inspection.reportsAnalytics.titles.riskBandDistribution")}
            data={data.riskBands}
            className="inspection-reports__risk-band-distribution"
          />
          <StackedDistributionCard
            title={t("inspection.reportsAnalytics.titles.riskBandBySource")}
            rows={data.bandsBySource}
            className="inspection-reports__risk-band-source"
            showSegmentTooltip
          />
        </div>
        <StackedDistributionCard
          title={t("inspection.reportsAnalytics.titles.riskBandByEmirate")}
          rows={data.bandsByEmirate}
          className="inspection-reports__risk-band-emirate"
          showSegmentTooltip
        />
        <HorizontalBarsCard
          title={t("inspection.reportsAnalytics.titles.topRiskFactorsTriggered")}
          items={data.riskFactors}
          className="inspection-reports__risk-factors"
        />
      </div>
      <HighRiskProfilesTable rows={data.highRiskProfiles} />
    </div>
  );
}

export default function InspectionReportsAnalytics() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const history = useHistory();
  const location = useLocation();
  const [tab, setTab] = useState<InspectionAnalyticsTab>(() => getInitialTab(location.search));
  const [preset, setPreset] = useState<InspectionAnalyticsTimePreset>("last30");
  const [filter, setFilter] = useState<AnalyticsTimeFilter>(DEFAULT_FILTER);
  const [draftRange, setDraftRange] = useState<InspectionAnalyticsRangeValue>(null);
  const [timeFilterVisible, setTimeFilterVisible] = useState(false);
  const [operationalLoading, setOperationalLoading] = useState(false);
  const [riskLoading, setRiskLoading] = useState(false);
  const [analytics, setAnalytics] = useState(() => buildEmptyInspectionReportsAnalytics());

  useEffect(() => {
    const queryTab = getInitialTab(location.search);
    if (queryTab !== tab) setTab(queryTab);
  }, [location.search, tab]);

  useEffect(() => {
    if (tab === "reports") return;
    let active = true;
    const setCurrentTabLoading = tab === "operational" ? setOperationalLoading : setRiskLoading;

    setCurrentTabLoading(true);

    getInspectionReportsAnalytics(filter, tab)
      .then((response) => {
        if (!active) return;

        setAnalytics((current) =>
          tab === "operational"
            ? { ...current, operational: response.data.operational }
            : { ...current, risk: response.data.risk },
        );
      })
      .finally(() => {
        if (active) setCurrentTabLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filter, language, tab]);

  const timeLabel = useMemo(() => {
    if (preset === "custom" && filter.startDate && filter.endDate) {
      return `${moment(filter.startDate).format("DD/MM/YYYY")} - ${moment(filter.endDate).format("DD/MM/YYYY")}`;
    }

    return {
      last7: t("inspection.reportsAnalytics.timePresets.last7"),
      last30: t("inspection.reportsAnalytics.timePresets.last30"),
      last6Months: t("inspection.reportsAnalytics.timePresets.last6Months"),
      lastYear: t("inspection.reportsAnalytics.timePresets.lastYear"),
      custom: t("inspection.reportsAnalytics.timePresets.custom"),
    }[preset];
  }, [filter, preset, t]);

  const selectTab = (nextTab: string) => {
    const value = nextTab as InspectionAnalyticsTab;
    if (!TAB_OPTIONS.includes(value)) return;
    setTab(value);
    const query = new URLSearchParams(location.search);
    query.set("tab", value);
    history.replace({
      pathname: location.pathname,
      search: `?${query.toString()}`,
    });
  };

  const selectPreset = (nextPreset: Exclude<InspectionAnalyticsTimePreset, "custom">) => {
    setPreset(nextPreset);
    setFilter({ days: REPORTS_ANALYTICS_TIME_PRESET_DAYS[nextPreset] });
    setDraftRange(null);
    setTimeFilterVisible(false);
  };

  const applyCustomRange = () => {
    const [start, end] = draftRange || [];
    if (!start || !end) return;
    setPreset("custom");
    setFilter({
      startDate: start.format("YYYY-MM-DD"),
      endDate: end.format("YYYY-MM-DD"),
    });
    setTimeFilterVisible(false);
  };

  const cancelCustomRange = () => {
    setDraftRange(createDraftRange(filter));
    setTimeFilterVisible(false);
  };

  return (
    <div className="inspection-reports__page" aria-label={t("inspection.reportsAnalytics.title")}>
      <PageHeadingPortal>
        <HeaderTimeFilter
          visible={timeFilterVisible}
          preset={preset}
          valueLabel={timeLabel}
          draftRange={draftRange}
          onVisibleChange={(visible) => {
            setTimeFilterVisible(visible);
            if (visible) setDraftRange(createDraftRange(filter));
          }}
          onPresetSelect={selectPreset}
          onDraftRangeChange={setDraftRange}
          onApplyCustomRange={applyCustomRange}
          onCancelCustomRange={cancelCustomRange}
        />
      </PageHeadingPortal>

      <div className="inspection-reports__tabs-card">
        <Tabs activeKey={tab} onChange={selectTab} className="inspection-reports__tabs" animated={false}>
          <Tabs.TabPane
            tab={t("inspection.reportsAnalytics.tabs.operationalInsights")}
            key="operational"
          />
          <Tabs.TabPane
            tab={t("inspection.reportsAnalytics.tabs.riskInsights")}
            key="risk"
          />
          <Tabs.TabPane
            tab={t("inspection.reportsAnalytics.tabs.reports")}
            key="reports"
          />
        </Tabs>
      </div>

      <div className={tab !== "operational" ? "inspection-reports__tab--hidden" : ""}>
        <Spin spinning={operationalLoading}>
          <OperationalDashboard
            data={analytics.operational}
            filter={filter}
          />
        </Spin>
      </div>
      <div className={tab !== "risk" ? "inspection-reports__tab--hidden" : ""}>
        <Spin spinning={riskLoading}>
          <RiskDashboard data={analytics.risk} />
        </Spin>
      </div>
      <div className={tab !== "reports" ? "inspection-reports__tab--hidden" : ""}>
        <ReportsDashboard isArabic={language.startsWith("ar")} />
      </div>
    </div>
  );
}
