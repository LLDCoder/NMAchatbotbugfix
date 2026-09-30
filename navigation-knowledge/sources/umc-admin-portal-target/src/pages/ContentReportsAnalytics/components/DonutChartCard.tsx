import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import type { DonutChartData, ReportsAnalyticsTranslationKey } from "../type";
import useAutoResizeEChart from "./useAutoResizeEChart";

interface DonutChartCardProps {
  titleKey: ReportsAnalyticsTranslationKey;
  totalLabelKey?: ReportsAnalyticsTranslationKey;
  data: DonutChartData;
  footerLabel?: string;
  footerValue?: string;
  chartVariant?: "default" | "service";
  layoutVariant?:
    | "default"
    | "service"
    | "serviceCompact"
    | "serviceHorizontal"
    | "permitStatus"
    | "contentCompact"
    | "contentStatus"
    | "contentSource"
    | "contentType"
    | "wideVertical";
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

const formatServiceTooltip = (params: CallbackDataParams) => {
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

const createSelectedMap = (chartData: DonutChartData) =>
  chartData.legends.reduce<Record<string, boolean>>((result, item) => {
    result[item.labelKey || item.label] = true;
    return result;
  }, {});

export default function DonutChartCard({
  titleKey,
  totalLabelKey,
  data,
  footerLabel,
  footerValue,
  chartVariant = "default",
  layoutVariant = "default",
}: DonutChartCardProps) {
  const { t: translate } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart();
  const isServiceChart = chartVariant === "service";
  const isContentCompactLayout =
    layoutVariant === "contentCompact" ||
    layoutVariant === "contentStatus" ||
    layoutVariant === "contentSource" ||
    layoutVariant === "contentType" ||
    layoutVariant === "wideVertical";
  const isPermitStatusLayout = layoutVariant === "permitStatus";
  const isServiceHorizontalLayout = layoutVariant === "serviceHorizontal";
  const isServiceLayout =
    layoutVariant === "service" ||
    layoutVariant === "serviceCompact" ||
    isPermitStatusLayout ||
    isContentCompactLayout ||
    isServiceHorizontalLayout;
  const isCompactServiceLayout = layoutVariant === "serviceCompact";
  const contentLayoutClass =
    layoutVariant === "permitStatus"
      ? "content-reports__donut-card--permit-status"
      : layoutVariant === "contentStatus"
      ? "content-reports__donut-card--content-status"
      : layoutVariant === "contentSource"
      ? "content-reports__donut-card--content-source"
      : layoutVariant === "contentType"
      ? "content-reports__donut-card--content-type"
      : layoutVariant === "contentCompact"
      ? "content-reports__donut-card--content-compact"
      : isServiceHorizontalLayout
      ? "content-reports__donut-card--service-horizontal"
      : layoutVariant === "wideVertical"
      ? "content-reports__donut-card--wide-vertical"
      : "";
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
        const selected = selectedMap[legendKey] !== false;

        return {
          ...item,
          legendKey,
          displayLabel,
          selected,
        };
      }),
    [data, selectedMap, translate],
  );

  const visibleLegendItems = legendItems;
  const hasVisibleLegendItems = visibleLegendItems.length > 0;

  const visibleTotal = useMemo(
    () =>
      visibleLegendItems.reduce(
        (sum, item) => (item.selected ? sum + item.value : sum),
        0,
      ),
    [visibleLegendItems],
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

  const onLegendKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLDivElement>,
      legendKey: string,
      displayLabel: string,
    ) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      toggleLegendSelection(legendKey, displayLabel);
    },
    [toggleLegendSelection],
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
      animationEasing: "cubicOut",
      animationEasingUpdate: "cubicOut",
      legend: {
        show: false,
        selectedMode: true,
        data: visibleLegendItems.map((item) => item.displayLabel),
        selected: visibleLegendItems.reduce<Record<string, boolean>>(
          (result, item) => {
            result[item.displayLabel] = item.selected;
            return result;
          },
          {},
        ),
      },
      tooltip: {
        trigger: "item",
        renderMode: "html",
        appendTo: "body",
        confine: false,
        className: "content-reports__donut-tooltip",
        formatter: hasVisibleLegendItems ? formatServiceTooltip : undefined,
      },
      series: [
        {
          type: "pie",
          radius: isServiceChart ? ["78%", "100%"] : ["60%", "78%"],
          center: ["50%", "50%"],
          minAngle: 3,
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scale: false },
          data: hasVisibleLegendItems
            ? visibleLegendItems
                .filter((item) => item.value > 0)
                .map((item) => ({
                  name: item.displayLabel,
                  value: item.value,
                  itemStyle: { color: item.color },
                }))
            : [
                {
                  name: "empty",
                  value: 1,
                  itemStyle: { color: "#EDEFF2" },
                  tooltip: { show: false },
                },
              ],
        },
      ],
      graphic: isServiceChart
        ? []
        : [
            {
              type: "text",
              left: "center",
              top: "41%",
              style: {
                text: visibleTotal.toLocaleString(),
                fill: "#361e12",
                font: "700 28px Inter",
                textAlign: "center",
              },
            },
            {
              type: "text",
              left: "center",
              top: "55.5%",
              style: {
                text:
                  (totalLabelKey && translate(totalLabelKey)) ||
                  translate("common.total"),
                fill: "#797e86",
                font: "500 12px Inter",
                textAlign: "center",
              },
            },
          ],
    }),
    [
      isServiceChart,
      hasVisibleLegendItems,
      translate,
      visibleLegendItems,
      visibleTotal,
      totalLabelKey,
    ],
  );

  const resolvedTitle = translate(titleKey);
  const resolvedTotalLabel =
    (totalLabelKey && translate(totalLabelKey)) || translate("common.total");

  return (
    <div
      className={`content-reports__card content-reports__card-surface content-reports__donut-card ${
        isServiceChart ? "content-reports__donut-card--chart-service" : ""
      } ${isServiceLayout ? "content-reports__donut-card--service" : ""} ${
        isCompactServiceLayout ? "content-reports__donut-card--service-compact" : ""
      } ${contentLayoutClass}`}
    >
      <div className="content-reports__card-title">{resolvedTitle}</div>
      <div
        className={`content-reports__donut-content ${
          isServiceLayout ? "content-reports__donut-content--service" : ""
        }`}
      >
        <div
          className={
            isServiceLayout
              ? "content-reports__donut-chart-block--service"
              : isServiceChart
              ? "content-reports__chart-shell content-reports__donut-chart-block--service-visual"
              : "content-reports__chart-shell"
          }
        >
          <div
            ref={containerRef}
            className={`content-reports__donut-chart-shell ${
              isServiceLayout ? "content-reports__donut-chart-shell--service" : ""
            } ${
              isServiceChart && !isServiceLayout
                ? "content-reports__donut-chart-shell--service-visual"
                : ""
            }`}
          >
            <ReactECharts
              ref={chartRef}
              option={option}
              className="content-reports__donut-chart"
              notMerge={true}
              onEvents={onEvents}
            />
            {isServiceChart && (
              <div className="content-reports__donut-center">
                <div className="content-reports__donut-total">
                  {visibleTotal.toLocaleString()}
                </div>
                <div className="content-reports__donut-total-label">
                  {resolvedTotalLabel}
                </div>
              </div>
            )}
          </div>
        </div>
        {hasVisibleLegendItems ? (
          <div className="content-reports__legend-list">
            {visibleLegendItems.map((item) => (
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
                  <span
                    className="content-reports__legend-dot"
                    style={{ color: item.color }}
                  />
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
        ) : null}
      </div>
      {footerLabel && footerValue ? (
        <div className="content-reports__donut-footer">
          <span>{footerLabel}</span>
          <span className="content-reports__donut-footer-value">{footerValue}</span>
        </div>
      ) : null}
    </div>
  );
}
