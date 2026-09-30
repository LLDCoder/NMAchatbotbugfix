import { useCallback, useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { Tooltip } from "antd";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import { useTranslation } from "react-i18next";
import reportsAnalyticsAedIcon from "@/assets/images/reportsAnalyticsAed.svg";
import reportsAnalyticsInfoIcon from "@/assets/images/reportsAnalyticsInfo.svg";
import createViewportEdgeTooltipPosition from "@/utils/createViewportEdgeTooltipPosition";
import type {
  CardHeaderMetric,
  DonutChartData,
  FinanceReportsTranslationKey,
} from "../type";
import useAutoResizeEChart from "./useAutoResizeEChart";

interface DonutChartCardProps {
  titleKey: FinanceReportsTranslationKey;
  data: DonutChartData;
  infoTextKey?: FinanceReportsTranslationKey;
  titlePrefix?: "aed";
  headerMetric?: CardHeaderMetric;
  size?: "compact" | "medium";
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
    <div class="finance-reports__donut-tooltip-content">
      <span class="finance-reports__donut-tooltip-marker" style="background-color: ${color};"></span>
      <span class="finance-reports__donut-tooltip-text">${label}: ${value} (${percentage}%)</span>
    </div>
  `;
};

const createSelectedMap = (chartData: DonutChartData) =>
  chartData.legends.reduce<Record<string, boolean>>((result, item) => {
    result[item.labelKey || item.label] = true;
    return result;
  }, {});

const formatVisibleTotal = (total: number, totalLabel: string) => {
  if (totalLabel.includes("M")) {
    const value = total / 1000000;
    return `${value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}M`;
  }

  return total.toLocaleString();
};

export default function DonutChartCard({
  titleKey,
  data,
  infoTextKey,
  titlePrefix,
  headerMetric,
  size = "compact",
}: DonutChartCardProps) {
  const { t: translate } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart();
  const tooltipPosition = useMemo(
    () =>
      createViewportEdgeTooltipPosition(
        () => chartRef.current?.getEchartsInstance().getDom(),
      ),
    [chartRef],
  );
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() =>
    createSelectedMap(data),
  );

  const legendSignature = useMemo(
    () =>
      data.legends
        .map((item) => `${item.labelKey || item.label}:${item.value}`)
        .join("|"),
    [data],
  );

  useEffect(() => {
    setSelectedMap(createSelectedMap(data));
  }, [data, legendSignature]);

  const legendItems = useMemo(
    () =>
      data.legends.map((item) => {
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
    [data, selectedMap, translate],
  );

  const visibleTotal = useMemo(
    () =>
      legendItems.reduce(
        (sum, item) => (item.selected ? sum + item.value : sum),
        0,
      ),
    [legendItems],
  );

  const visibleTotalLabel = useMemo(() => {
    const allSelected = legendItems.every((item) => item.selected);
    return allSelected
      ? data.totalLabel
      : formatVisibleTotal(visibleTotal, data.totalLabel);
  }, [data.totalLabel, legendItems, visibleTotal]);

  const legendColumnsClassName =
    legendItems.length > 4
      ? "finance-reports__legend-columns finance-reports__legend-columns--split"
      : "finance-reports__legend-columns";
  const legendRowsClassName =
    legendItems.length > 2
      ? "finance-reports__legend-columns--three-rows"
      : "finance-reports__legend-columns--two-rows";

  const primaryLegendItems =
    legendItems.length > 4 ? legendItems.slice(0, 4) : legendItems;
  const secondaryLegendItems =
    legendItems.length > 4 ? legendItems.slice(4) : [];

  const renderLegendList = (items: typeof legendItems) => (
    <div className="finance-reports__legend-list">
      {items.map((item) => (
        <div
          key={item.legendKey}
          className={`finance-reports__legend-item ${
            item.selected ? "" : "finance-reports__legend-item--inactive"
          }`}
          role="button"
          tabIndex={0}
          onClick={() =>
            toggleLegendSelection(item.legendKey, item.displayLabel)
          }
        >
          <div className="finance-reports__legend-label">
            <span
              className="finance-reports__legend-dot"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.displayLabel}</span>
          </div>
          <div className="finance-reports__legend-value">
            <span className="finance-reports__legend-value-text">
              {item.valueLabel}
            </span>
            <span className="finance-reports__legend-percentage">
              {item.percentageLabel}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  const handleLegendSelectChanged = useCallback(
    (event: LegendSelectChangedEvent) => {
      setSelectedMap((previous) => {
        const nextSelected: Record<string, boolean> = {};

        data.legends.forEach((item) => {
          const legendKey = item.labelKey || item.label;
          const displayLabel = item.labelKey
            ? translate(item.labelKey)
            : item.label;

          nextSelected[legendKey] =
            event.selected[displayLabel] ?? previous[legendKey] ?? true;
        });

        return nextSelected;
      });
    },
    [data, translate],
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

      setSelectedMap((previous) => ({
        ...previous,
        [legendKey]: previous[legendKey] === false,
      }));
    },
    [chartRef],
  );

  const onEvents = useMemo(
    () => ({
      legendselectchanged: handleLegendSelectChanged,
    }),
    [handleLegendSelectChanged],
  );

  const option = useMemo(
    () => ({
      animation: true,
      animationDuration: 220,
      animationDurationUpdate: 220,
      legend: {
        show: false,
        selectedMode: true,
        data: legendItems.map((item) => item.displayLabel),
        selected: legendItems.reduce<Record<string, boolean>>((result, item) => {
          result[item.displayLabel] = item.selected;
          return result;
        }, {}),
      },
      tooltip: {
        trigger: "item",
        renderMode: "html",
        appendTo: "body",
        confine: false,
        position: tooltipPosition,
        className: "finance-reports__donut-tooltip",
        formatter: formatTooltip,
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
          data: legendItems
            .filter((item) => item.value > 0)
            .map((item) => ({
              name: item.displayLabel,
              value: item.value,
              itemStyle: { color: item.color },
            })),
        },
      ],
    }),
    [legendItems, tooltipPosition],
  );

  return (
    <div
      className={`finance-reports__donut-card finance-reports__card-surface finance-reports__donut-card--${size}`}
    >
      <div className="finance-reports__card-header finance-reports__card-header--spread">
        <div className="finance-reports__card-header-title">
          <div className="finance-reports__card-title">{translate(titleKey)}</div>
          {titlePrefix === "aed" ? (
            <img
              src={reportsAnalyticsAedIcon}
              alt="AED"
              className="finance-reports__aed-icon"
            />
          ) : null}
          {infoTextKey ? (
            <Tooltip title={translate(infoTextKey)}>
              <span className="finance-reports__info-button">
                <img
                  src={reportsAnalyticsInfoIcon}
                  alt=""
                  className="finance-reports__info-icon"
                />
              </span>
            </Tooltip>
          ) : null}
        </div>
        {headerMetric ? (
          <div className="finance-reports__header-metric">
            <span
              className="finance-reports__header-metric-dot"
              style={{ backgroundColor: headerMetric.dotColor }}
            />
            <span className="finance-reports__header-metric-label">
              {headerMetric.labelKey
                ? translate(headerMetric.labelKey)
                : headerMetric.label}
            </span>
            <span className="finance-reports__header-metric-value">
              {headerMetric.value}
            </span>
          </div>
        ) : null}
      </div>

      <div className="finance-reports__donut-content">
        <div className="finance-reports__donut-layout">
          <div className="finance-reports__donut-chart-block">
            <div
              ref={containerRef}
              className="finance-reports__donut-chart-shell"
            >
              <ReactECharts
                ref={chartRef}
                option={option}
                notMerge={true}
                className="finance-reports__chart"
                onEvents={onEvents}
              />
              <div className="finance-reports__donut-center">
                <div className="finance-reports__donut-total">
                  {visibleTotalLabel}
                </div>
                <div className="finance-reports__donut-total-label">
                  {translate("common.total")}
                </div>
              </div>
            </div>
          </div>
          <div
            className={`${legendColumnsClassName} ${legendRowsClassName}`.trim()}
          >
            {renderLegendList(primaryLegendItems)}
            {secondaryLegendItems.length
              ? renderLegendList(secondaryLegendItems)
              : null}
          </div>
        </div>
      </div>
    </div>
  );
}
