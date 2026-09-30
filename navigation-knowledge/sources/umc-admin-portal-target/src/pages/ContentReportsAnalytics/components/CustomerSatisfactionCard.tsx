import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import reportsAnalyticsApprovalRateIcon from "@/assets/images/reportsAnalyticsApprovalRate.svg";
import reportsAnalyticsAvgSatisfactionIcon from "@/assets/images/reportsAnalyticsAvgSatisfaction.svg";
import type { CsatOverviewData, ReportsAnalyticsTranslationKey } from "../type";
import useAutoResizeEChart from "./useAutoResizeEChart";

interface CustomerSatisfactionCardProps {
  titleKey: ReportsAnalyticsTranslationKey;
  data: CsatOverviewData;
}

interface LegendSelectChangedEvent {
  selected: Record<string, boolean>;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatTooltip = (params: CallbackDataParams) => {
  const label = escapeHtml(String(params.name ?? ""));
  const value = Number(params.value ?? 0).toLocaleString();
  const percentage = Number(params.percent ?? 0).toFixed(2);
  const color = typeof params.color === "string" ? params.color : "#A0D5AB";
  return `
    <div class="content-reports__donut-tooltip-content">
      <span class="content-reports__donut-tooltip-marker" style="background-color: ${color};"></span>
      <span class="content-reports__donut-tooltip-text">${label}: ${value} (${percentage}%)</span>
    </div>
  `;
};

export default function CustomerSatisfactionCard({
  titleKey,
  data,
}: CustomerSatisfactionCardProps) {
  const { t: translate } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart();

  const createSelectedMap = (d: CsatOverviewData) =>
    d.distribution.legends.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.labelKey || item.label] = true;
      return acc;
    }, {});

  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() =>
    createSelectedMap(data),
  );

  useEffect(() => {
    setSelectedMap(createSelectedMap(data));
  }, [data]);

  const legendItems = useMemo(
    () =>
      data.distribution.legends.map((item) => {
        const legendKey = item.labelKey || item.label;
        const displayLabel = item.labelKey
          ? translate(item.labelKey)
          : item.label;

        return {
          ...item,
          legendKey,
          displayLabel,
          selected: selectedMap[legendKey] !== false,
        };
      }),
    [data.distribution.legends, selectedMap, translate],
  );

  const hasLegendItems = legendItems.length > 0;

  const visibleTotal = useMemo(
    () => legendItems.reduce((sum, item) => (item.selected ? sum + item.value : sum), 0),
    [legendItems],
  );

  const handleLegendSelectChanged = useCallback(
    (event: LegendSelectChangedEvent) => {
      setSelectedMap((previous) => {
        const next: Record<string, boolean> = {};
        data.distribution.legends.forEach((item) => {
          const legendKey = item.labelKey || item.label;
          const displayLabel = item.labelKey
            ? translate(item.labelKey)
            : item.label;

          next[legendKey] =
            event.selected[displayLabel] ?? previous[legendKey] ?? true;
        });
        return next;
      });
    },
    [data.distribution.legends, translate],
  );

  const toggleLegendSelection = useCallback(
    (legendKey: string, displayLabel: string) => {
      const chartInstance = chartRef.current?.getEchartsInstance();
      if (chartInstance) {
        chartInstance.dispatchAction({
          type: "legendToggleSelect",
          name: displayLabel,
        });
        return;
      }
      setSelectedMap((previous) => ({ ...previous, [legendKey]: previous[legendKey] === false }));
    },
    [chartRef],
  );

  const onLegendKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLDivElement>,
      legendKey: string,
      displayLabel: string,
    ) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleLegendSelection(legendKey, displayLabel);
    },
    [toggleLegendSelection],
  );

  const onEvents = useMemo(
    () => ({ legendselectchanged: handleLegendSelectChanged }),
    [handleLegendSelectChanged],
  );

  const option = useMemo(
    () => ({
      animation: true,
      animationDuration: 220,
      animationDurationUpdate: 220,
      animationEasing: "cubicOut",
      animationEasingUpdate: "cubicOut",
      legend: {
        show: false,
        selectedMode: true,
        data: legendItems.map((item) => item.displayLabel),
        selected: legendItems.reduce<Record<string, boolean>>((acc, item) => {
          acc[item.displayLabel] = item.selected;
          return acc;
        }, {}),
      },
      tooltip: {
        trigger: "item",
        renderMode: "html",
        appendTo: "body",
        confine: false,
        className: "content-reports__donut-tooltip",
        formatter: hasLegendItems ? formatTooltip : undefined,
      },
      series: [
        {
          type: "pie",
          radius: ["78%", "100%"],
          center: ["50%", "50%"],
          minAngle: 3,
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scale: false },
          data: hasLegendItems
            ? legendItems
                .filter((item) => item.value > 0)
                .map((item) => ({
                  name: item.displayLabel,
                  value: item.value,
                  itemStyle: { color: item.color },
                }))
            : [{ name: "empty", value: 1, itemStyle: { color: "#EDEFF2" }, tooltip: { show: false } }],
        },
      ],
    }),
    [hasLegendItems, legendItems],
  );

  return (
    <div className="content-reports__card content-reports__card-surface content-reports__donut-card content-reports__donut-card--service content-reports__donut-card--chart-service content-reports__csat-overview-card">
      <div className="content-reports__card-title">{translate(titleKey)}</div>

      <div className="content-reports__csat-stats">
        <div className="content-reports__stat-card content-reports__stat-card--outlined">
          <div className="content-reports__stat-icon">
            <img src={reportsAnalyticsApprovalRateIcon} alt="" className="content-reports__stat-icon-image" />
          </div>
          <div className="content-reports__stat-copy">
            <div className="content-reports__stat-value">
              <span>{data.overallRate.toFixed(1)}%</span>
            </div>
            <div className="content-reports__stat-label">
              {translate("contentReportsAnalytics.summary.overallRate")}
            </div>
          </div>
        </div>
        <div className="content-reports__stat-card content-reports__stat-card--outlined">
          <div className="content-reports__stat-icon">
            <img src={reportsAnalyticsAvgSatisfactionIcon} alt="" className="content-reports__stat-icon-image" />
          </div>
          <div className="content-reports__stat-copy">
            <div className="content-reports__stat-value">
              <span>{data.avgRating.toFixed(1)}</span>
            </div>
            <div className="content-reports__stat-label">
              {translate("contentReportsAnalytics.summary.avgRating")}
            </div>
          </div>
        </div>
      </div>

      <div className="content-reports__donut-content content-reports__donut-content--service">
        <div className="content-reports__donut-chart-block--service">
          <div
            ref={containerRef}
            className="content-reports__donut-chart-shell content-reports__donut-chart-shell--service"
          >
            <ReactECharts
              ref={chartRef}
              option={option}
              className="content-reports__donut-chart"
              notMerge={true}
              onEvents={onEvents}
            />
            <div className="content-reports__donut-center">
              <div className="content-reports__donut-total">
                {visibleTotal.toLocaleString()}
              </div>
              <div className="content-reports__donut-total-label">
                {translate("common.total")}
              </div>
            </div>
          </div>
        </div>
        {hasLegendItems && (
          <div className="content-reports__legend-list">
            {legendItems.map((item) => (
              <div
                key={item.legendKey}
                className={`content-reports__legend-item ${
                  item.selected ? "" : "content-reports__legend-item--inactive"
                }`}
                role="button"
                tabIndex={0}
                aria-pressed={item.selected}
                onClick={() =>
                  toggleLegendSelection(item.legendKey, item.displayLabel)
                }
                onKeyDown={(event) =>
                  onLegendKeyDown(event, item.legendKey, item.displayLabel)
                }
              >
                <div className="content-reports__legend-label">
                  <span className="content-reports__legend-dot" style={{ color: item.color }} />
                  <span>{item.displayLabel}</span>
                </div>
                <div className="content-reports__legend-value">
                  <span className="content-reports__legend-value-text">
                    {item.value.toLocaleString()}
                  </span>
                  <span className="content-reports__legend-percentage">
                    {item.percentage.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
