import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import { Spin } from "antd";
import { useTranslation } from "react-i18next";
import { CustomMessage, PageHeadingPortal } from "@/components/common";
import {
  exportFinanceEmirateTable,
  exportFinanceUserTypeTable,
  getFinanceEmirateTable,
  getFinanceReportsOverview,
  getFinanceUserTypeTable,
} from "@/services/financeReportsAnalytics";
import SummaryCards from "./components/SummaryCards";
import LineTrendCard from "./components/LineTrendCard";
import BarBreakdownCard from "./components/BarBreakdownCard";
import DonutChartCard from "./components/DonutChartCard";
import AnalyticsTableCard from "./components/AnalyticsTableCard";
import HeaderTimeFilter from "./components/HeaderTimeFilter";
import {
  DEFAULT_OVERVIEW_DATA,
  FINANCE_REPORTS_TIME_PRESET_DAYS,
} from "./constants";
import type {
  EmirateTableRow,
  FinanceReportsRangeValue,
  FinanceReportsOverviewData,
  FinanceReportsTimeFilter,
  FinanceReportsTimePreset,
  UserTypeTableRow,
} from "./type";
import "./index.less";

const DEFAULT_TIME_FILTER: FinanceReportsTimeFilter = {
  days: FINANCE_REPORTS_TIME_PRESET_DAYS.last30,
};

const TIME_PRESET_OPTIONS: Array<{
  key: FinanceReportsTimePreset;
  textKey: string;
  days?: number;
}> = [
  {
    key: "last7",
    textKey: "financeReportsAnalytics.timeFilter.last7",
    days: FINANCE_REPORTS_TIME_PRESET_DAYS.last7,
  },
  {
    key: "last30",
    textKey: "financeReportsAnalytics.timeFilter.last30",
    days: FINANCE_REPORTS_TIME_PRESET_DAYS.last30,
  },
  {
    key: "last6Months",
    textKey: "financeReportsAnalytics.timeFilter.last6Months",
    days: FINANCE_REPORTS_TIME_PRESET_DAYS.last6Months,
  },
  {
    key: "lastYear",
    textKey: "financeReportsAnalytics.timeFilter.lastYear",
    days: FINANCE_REPORTS_TIME_PRESET_DAYS.lastYear,
  },
  {
    key: "custom",
    textKey: "financeReportsAnalytics.timeFilter.custom",
  },
];

const createDraftRangeFromFilter = (
  filter: FinanceReportsTimeFilter,
): FinanceReportsRangeValue =>
  filter.startDate && filter.endDate
    ? [
        moment(filter.startDate, "YYYY-MM-DD"),
        moment(filter.endDate, "YYYY-MM-DD"),
      ]
    : null;

const formatTimeFilterLabel = (
  preset: FinanceReportsTimePreset,
  filter: FinanceReportsTimeFilter,
  presetOptions: Array<{ key: FinanceReportsTimePreset; label: string }>,
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

export default function FinanceReportsAnalytics() {
  const { t: translate } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [timeFilterPreset, setTimeFilterPreset] =
    useState<FinanceReportsTimePreset>("last30");
  const [timeFilterVisible, setTimeFilterVisible] = useState(false);
  const [committedTimeFilter, setCommittedTimeFilter] =
    useState<FinanceReportsTimeFilter>(DEFAULT_TIME_FILTER);
  const [draftRange, setDraftRange] = useState<FinanceReportsRangeValue>(null);
  const [overview, setOverview] =
    useState<FinanceReportsOverviewData>(DEFAULT_OVERVIEW_DATA);
  const [emirateRows, setEmirateRows] = useState<EmirateTableRow[]>([]);
  const [userTypeRows, setUserTypeRows] = useState<UserTypeTableRow[]>([]);
  const [exportingTarget, setExportingTarget] = useState<
    "emirates" | "userTypes" | null
  >(null);
  const [emirateSort, setEmirateSort] = useState<{
    field?: string;
    order?: "asc" | "desc";
  }>({});
  const [userTypeSort, setUserTypeSort] = useState<{
    field?: string;
    order?: "asc" | "desc";
  }>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const [overviewResponse, emirateResponse, userTypeResponse] =
          await Promise.all([
            getFinanceReportsOverview(committedTimeFilter),
            getFinanceEmirateTable({
              ...committedTimeFilter,
              orderby: emirateSort.field,
              sort: emirateSort.order,
            }),
            getFinanceUserTypeTable({
              ...committedTimeFilter,
              orderby: userTypeSort.field,
              sort: userTypeSort.order,
            }),
          ]);

        if (!cancelled) {
          setOverview(overviewResponse.data);
          setEmirateRows(emirateResponse.data);
          setUserTypeRows(userTypeResponse.data);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [
    committedTimeFilter,
    emirateSort.field,
    emirateSort.order,
    userTypeSort.field,
    userTypeSort.order,
  ]);

  const handleExport = useCallback(
    async (target: "emirates" | "userTypes", action: () => Promise<void>) => {
      setExportingTarget(target);
      try {
        await action();
        CustomMessage.success(translate("financeReportsAnalytics.messages.exportReady"));
      } finally {
        setExportingTarget(null);
      }
    },
    [translate],
  );

  const handleEmirateSortChange = useCallback<
    NonNullable<TableProps<EmirateTableRow>["onChange"]>
  >((_pagination, _filters, sorter) => {
    const resolvedSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    setEmirateSort({
      field:
        resolvedSorter?.order && typeof resolvedSorter.columnKey === "string"
          ? resolvedSorter.columnKey
          : undefined,
      order:
        resolvedSorter?.order === "ascend"
          ? "asc"
          : resolvedSorter?.order === "descend"
          ? "desc"
          : undefined,
    });
  }, []);

  const handleUserTypeSortChange = useCallback<
    NonNullable<TableProps<UserTypeTableRow>["onChange"]>
  >((_pagination, _filters, sorter) => {
    const resolvedSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    setUserTypeSort({
      field:
        resolvedSorter?.order && typeof resolvedSorter.columnKey === "string"
          ? resolvedSorter.columnKey
          : undefined,
      order:
        resolvedSorter?.order === "ascend"
          ? "asc"
          : resolvedSorter?.order === "descend"
          ? "desc"
          : undefined,
    });
  }, []);

  const timePresetOptions = useMemo(
    () =>
      TIME_PRESET_OPTIONS.map((item) => ({
        key: item.key,
        label: translate(item.textKey),
      })),
    [translate],
  );

  const timeFilterLabel = formatTimeFilterLabel(
    timeFilterPreset,
    committedTimeFilter,
    timePresetOptions,
    translate("financeReportsAnalytics.timeFilter.last30"),
  );

  const handleTimeFilterVisibleChange = useCallback((visible: boolean) => {
    setTimeFilterVisible(visible);

    if (visible) {
      setDraftRange(createDraftRangeFromFilter(committedTimeFilter));
    }
  }, [committedTimeFilter]);

  const handlePresetSelect = useCallback(
    (preset: Exclude<FinanceReportsTimePreset, "custom">) => {
      const matchedPreset = TIME_PRESET_OPTIONS.find((item) => item.key === preset);

      setTimeFilterPreset(preset);
      setCommittedTimeFilter({
        days: matchedPreset?.days,
      });
      setDraftRange(null);
      setTimeFilterVisible(false);
    },
    [],
  );

  const handleCustomRangeApply = useCallback(() => {
    if (!draftRange?.[0] || !draftRange?.[1]) {
      return;
    }

    setCommittedTimeFilter({
      startDate: draftRange[0].format("YYYY-MM-DD"),
      endDate: draftRange[1].format("YYYY-MM-DD"),
    });
    setTimeFilterPreset("custom");
    setTimeFilterVisible(false);
  }, [draftRange]);

  const handleCustomRangeCancel = useCallback(() => {
    setDraftRange(createDraftRangeFromFilter(committedTimeFilter));
    setTimeFilterVisible(false);
  }, [committedTimeFilter]);

  const emirateColumns = useMemo<ColumnsType<EmirateTableRow>>(
    () => [
      {
        title: translate("financeReportsAnalytics.tables.emirate"),
        dataIndex: "locationKey",
        key: "locationKey",
        render: (value, row) =>
          value
            ? translate(`financeReportsAnalytics.locations.${value}`)
            : row.location || "-",
      },
      {
        title: translate("financeReportsAnalytics.tables.totalRevenue"),
        dataIndex: "totalRevenue",
        key: "TotalRevenue",
        sorter: true,
      },
      {
        title: translate("financeReportsAnalytics.tables.transactionCount"),
        dataIndex: "transactionCount",
        key: "transactionCount",
      },
      {
        title: translate("financeReportsAnalytics.tables.rechargeCount"),
        dataIndex: "rechargeCount",
        key: "rechargeCount",
      },
      {
        title: translate("financeReportsAnalytics.tables.refundCount"),
        dataIndex: "refundCount",
        key: "refundCount",
      },
      {
        title: translate("financeReportsAnalytics.tables.refundRate"),
        dataIndex: "refundRate",
        key: "refundRate",
      },
    ],
    [translate],
  );

  const userTypeColumns = useMemo<ColumnsType<UserTypeTableRow>>(
    () => [
      {
        title: translate("financeReportsAnalytics.tables.userType"),
        dataIndex: "userTypeKey",
        key: "userTypeKey",
        render: (value, row) =>
          value
            ? translate(`financeReportsAnalytics.userTypes.${value}`)
            : row.userType || "-",
      },
      {
        title: translate("financeReportsAnalytics.tables.totalRevenue"),
        dataIndex: "totalRevenue",
        key: "TotalRevenue",
        sorter: true,
      },
      {
        title: translate("financeReportsAnalytics.tables.transactionCount"),
        dataIndex: "transactionCount",
        key: "transactionCount",
      },
      {
        title: translate("financeReportsAnalytics.tables.rechargeCount"),
        dataIndex: "rechargeCount",
        key: "rechargeCount",
      },
      {
        title: translate("financeReportsAnalytics.tables.refundCount"),
        dataIndex: "refundCount",
        key: "refundCount",
      },
      {
        title: translate("financeReportsAnalytics.tables.refundRate"),
        dataIndex: "refundRate",
        key: "refundRate",
      },
    ],
    [translate],
  );

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

      <div className="finance-reports__page">
        <Spin spinning={loading}>
          <div className="finance-reports__content">
          <SummaryCards items={overview.summaryCards} />

          <div className="finance-reports__chart-grid">
            <LineTrendCard
              titleKey="financeReportsAnalytics.charts.revenueTrend"
              infoTextKey="financeReportsAnalytics.charts.revenueTrendInfo"
              titlePrefix="aed"
              data={overview.revenueTrend}
              size="tall"
            />
            <BarBreakdownCard
              titleKey="financeReportsAnalytics.charts.revenueBreakdown"
              infoTextKey="financeReportsAnalytics.charts.revenueBreakdownInfo"
              titlePrefix="aed"
              data={overview.revenueBreakdown}
              size="tall"
            />
            <DonutChartCard
              titleKey="financeReportsAnalytics.charts.paymentsByType"
              infoTextKey="financeReportsAnalytics.charts.paymentsByTypeInfo"
              data={overview.paymentsByType}
              headerMetric={overview.paymentsByTypeMetric}
              size="compact"
            />
            <DonutChartCard
              titleKey="financeReportsAnalytics.charts.paymentMethodDistribution"
              infoTextKey="financeReportsAnalytics.charts.paymentMethodDistributionInfo"
              data={overview.paymentMethodDistribution}
              size="compact"
            />
            <LineTrendCard
              titleKey="financeReportsAnalytics.charts.rechargeBreakdown"
              titlePrefix="aed"
              data={overview.rechargeBreakdown}
              showLegend={false}
              size="medium"
            />
            <DonutChartCard
              titleKey="financeReportsAnalytics.charts.rechargeCount"
              data={overview.rechargeCount}
              size="medium"
            />
            <DonutChartCard
              titleKey="financeReportsAnalytics.charts.refundAmountByCategory"
              titlePrefix="aed"
              data={overview.refundAmountByCategory}
              size="compact"
            />
            <DonutChartCard
              titleKey="financeReportsAnalytics.charts.refundTypeDistribution"
              infoTextKey="financeReportsAnalytics.charts.refundTypeDistributionInfo"
              data={overview.refundTypeDistribution}
              size="compact"
            />
          </div>

          <AnalyticsTableCard
            titleKey="financeReportsAnalytics.tables.dataByEmirate"
            rows={emirateRows}
            columns={emirateColumns}
            onExport={() =>
              handleExport("emirates", () =>
                exportFinanceEmirateTable({
                  ...committedTimeFilter,
                  orderby: emirateSort.field,
                  sort: emirateSort.order,
                }),
              )
            }
            onTableChange={handleEmirateSortChange}
            isExporting={exportingTarget === "emirates"}
            sortField={emirateSort.field}
            sortOrder={
              emirateSort.order === "asc"
                ? "ascend"
                : emirateSort.order === "desc"
                ? "descend"
                : undefined
            }
          />

          <AnalyticsTableCard
            titleKey="financeReportsAnalytics.tables.dataByUserType"
            rows={userTypeRows}
            columns={userTypeColumns}
            onExport={() =>
              handleExport("userTypes", () =>
                exportFinanceUserTypeTable({
                  ...committedTimeFilter,
                  orderby: userTypeSort.field,
                  sort: userTypeSort.order,
                }),
              )
            }
            onTableChange={handleUserTypeSortChange}
            isExporting={exportingTarget === "userTypes"}
            sortField={userTypeSort.field}
            sortOrder={
              userTypeSort.order === "asc"
                ? "ascend"
                : userTypeSort.order === "desc"
                ? "descend"
                : undefined
            }
          />
          </div>
        </Spin>
      </div>
    </>
  );
}
