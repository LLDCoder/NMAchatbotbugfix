import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import type { AiRecommendationOverviewData } from "../type";
import useAutoResizeEChart from "./useAutoResizeEChart";

interface AIRecommendationOverviewCardProps {
  titleKey: "contentReportsAnalytics.charts.aiRecommendationOverview";
  data: AiRecommendationOverviewData;
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

const createSelectedMap = (chartData: AiRecommendationOverviewData) =>
  chartData.legends.reduce<Record<string, boolean>>((result, item) => {
    result[item.labelKey || item.label] = true;
    return result;
  }, {});

export default function AIRecommendationOverviewCard({
  titleKey,
  data,
}: AIRecommendationOverviewCardProps) {
  const { t: translate } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart();

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

  const visibleLegendItems = useMemo(
    () => legendItems.filter((item) => item.value > 0),
    [legendItems],
  );
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
          radius: ["78%", "100%"],
          center: ["50%", "50%"],
          minAngle: 3,
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scale: false },
          data: hasVisibleLegendItems
            ? visibleLegendItems.map((item) => ({
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
    }),
    [hasVisibleLegendItems, visibleLegendItems],
  );

  const adoptionLabel = data.adoptionRateLabelKey
    ? translate(data.adoptionRateLabelKey)
    : translate("contentReportsAnalytics.charts.aiAdoptionRate");

  return (
    <div className="content-reports__card content-reports__card-surface content-reports__ai-overview-card">
      <div className="content-reports__card-title content-reports__ai-overview-title">
        {translate(titleKey)}
      </div>

      <div className="content-reports__ai-overview-content">
        <div className="content-reports__ai-overview-chart-wrap">
          <div ref={containerRef} className="content-reports__ai-overview-chart-shell">
            <ReactECharts
              ref={chartRef}
              option={option}
              className="content-reports__donut-chart"
              notMerge={true}
              onEvents={onEvents}
            />
            <div className="content-reports__donut-center content-reports__ai-overview-center">
              <div className="content-reports__donut-total">
                {visibleTotal.toLocaleString()}
              </div>
              <div className="content-reports__donut-total-label">
                {translate("common.total")}
              </div>
            </div>
          </div>
        </div>

        {visibleLegendItems.length > 0 ? (
          <div className="content-reports__legend-list content-reports__ai-overview-legend-list">
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
                <div className="content-reports__legend-label content-reports__ai-overview-legend-label">
                  <span
                    className="content-reports__legend-dot content-reports__ai-overview-legend-dot"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.displayLabel}</span>
                </div>
                <div className="content-reports__legend-value content-reports__ai-overview-legend-value">
                  <span>{item.value.toLocaleString()}</span>
                  <span className="content-reports__legend-percentage">
                    {item.percentage.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="content-reports__ai-overview-footer">
        <div className="content-reports__ai-overview-gauge">
          <svg width="64" height="64" viewBox="0 0 64 64">
            {/* Background Arc: 270 degrees starting from 135deg to 45deg */}
            <circle
              cx="32"
              cy="32"
              r="24"
              fill="none"
              stroke="#e1e3e5"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 24 * 0.75} ${2 * Math.PI * 24}`}
              style={{
                transform: "rotate(135deg)",
                transformOrigin: "center",
              }}
            />
            {/* Progress Arc */}
            <circle
              cx="32"
              cy="32"
              r="24"
              fill="none"
              stroke="#a0d5ab"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 24 * 0.75 * (data.adoptionRate / 100)} ${2 * Math.PI * 24}`}
              style={{
                transform: "rotate(135deg)",
                transformOrigin: "center",
                transition: "stroke-dasharray 0.3s ease",
              }}
            />
          </svg>
        </div>
        <div className="content-reports__ai-overview-footer-copy">
          <div className="content-reports__ai-overview-footer-value">
            {data.adoptionRate.toFixed(2)}%
          </div>
          <div className="content-reports__ai-overview-footer-label">{adoptionLabel}</div>
        </div>
      </div>
    </div>
  );
}
