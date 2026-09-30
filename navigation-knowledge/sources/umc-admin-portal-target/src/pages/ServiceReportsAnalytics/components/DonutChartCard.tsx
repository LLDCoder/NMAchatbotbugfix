import { useCallback, useEffect, useMemo, useState, useRef, cloneElement } from "react";
import ReactECharts from "echarts-for-react";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { DonutChartData, ReportsAnalyticsTranslationKey } from "../type";
import useAutoResizeEChart from "./useAutoResizeEChart";

interface DonutChartCardProps {
  titleKey: ReportsAnalyticsTranslationKey;
  data: DonutChartData;
  titleGap?: number;
  className?: string;
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
    <div class="service-reports__donut-tooltip-content">
      <span class="service-reports__donut-tooltip-marker" style="background-color: ${color};"></span>
      <span class="service-reports__donut-tooltip-text">${label}: ${value} (${percentage}%)</span>
    </div>
  `;
};

const createSelectedMap = (chartData: DonutChartData) =>
  chartData.legends.reduce<Record<string, boolean>>((result, item) => {
    result[item.labelKey || item.label] = true;
    return result;
  }, {});

const TruncatedTooltip = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactElement;
}) => {
  const [shouldShow, setShouldShow] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    const el = containerRef.current;
    if (el) {
      setShouldShow(el.scrollWidth > el.clientWidth);
    }
  };

  return (
    <Tooltip title={shouldShow ? title : ""}>
      {cloneElement(children, {
        ref: containerRef,
        onMouseEnter: handleMouseEnter,
      })}
    </Tooltip>
  );
};

export default function DonutChartCard({
  titleKey,
  data,
  titleGap,
  className = "",
}: DonutChartCardProps) {
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

        return {
          ...item,
          legendKey,
          displayLabel,
          selected: selectedMap[legendKey] !== false,
        };
      }),
    [data, selectedMap, translate],
  );

  const visibleLegendItems = useMemo(() => legendItems, [legendItems]);

  const visibleTotal = useMemo(
    () =>
      visibleLegendItems.reduce(
        (sum, item) => (item.selected ? sum + item.value : sum),
        0,
      ),
    [visibleLegendItems],
  );

  const legendColumnsClassName =
    legendItems.length > 4
      ? "service-reports__legend-columns service-reports__legend-columns--split"
      : "service-reports__legend-columns";

  const primaryLegendItems =
    legendItems.length > 4 ? legendItems.slice(0, 4) : legendItems;
  const secondaryLegendItems =
    legendItems.length > 4 ? legendItems.slice(4) : [];

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
        className: "service-reports__donut-tooltip",
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
          data: visibleLegendItems
            .filter((item) => item.value > 0)
            .map((item) => ({
              name: item.displayLabel,
              value: item.value,
              itemStyle: { color: item.color },
            })),
        },
      ],
    }),
    [visibleLegendItems],
  );

  return (
    <div
      className={`service-reports__card service-reports__card-surface service-reports__donut-card ${className}`}
    >
      <div
        className="service-reports__card-title"
        style={titleGap !== undefined ? { marginBottom: titleGap } : undefined}
      >
        {translate(titleKey)}
      </div>
      <div className="service-reports__donut-content">
        <div className="service-reports__donut-chart-block">
          <div
            ref={containerRef}
            className="service-reports__donut-chart-shell"
          >
            <ReactECharts
              ref={chartRef}
              option={option}
              className="service-reports__donut-chart"
              notMerge={true}
              onEvents={onEvents}
            />
            <div className="service-reports__donut-center">
              <div className="service-reports__donut-total">
                {visibleTotal.toLocaleString()}
              </div>
              <div className="service-reports__donut-total-label">
                {translate("common.total")}
              </div>
            </div>
          </div>
        </div>
        <div className={legendColumnsClassName}>
          <div className="service-reports__legend-list">
            {primaryLegendItems.map((item) => (
              <div
                key={item.legendKey}
                className={`service-reports__legend-item ${
                  item.selected ? "" : "service-reports__legend-item--inactive"
                }`}
                role="button"
                tabIndex={0}
                onClick={() =>
                  toggleLegendSelection(item.legendKey, item.displayLabel)
                }
              >
                <div className="service-reports__legend-label">
                  <span
                    className="service-reports__legend-dot"
                    style={{ color: item.color }}
                  />
                  <TruncatedTooltip title={item.displayLabel}>
                    <span>{item.displayLabel}</span>
                  </TruncatedTooltip>
                </div>
                <div className="service-reports__legend-value">
                  <span className="service-reports__legend-value-text">
                    {item.value.toLocaleString()}
                  </span>
                  <span className="service-reports__legend-percentage">
                    {item.percentage.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          {secondaryLegendItems.length ? (
            <div className="service-reports__legend-list">
              {secondaryLegendItems.map((item) => (
                <div
                  key={item.legendKey}
                  className={`service-reports__legend-item ${
                    item.selected ? "" : "service-reports__legend-item--inactive"
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    toggleLegendSelection(item.legendKey, item.displayLabel)
                  }
                >
                  <div className="service-reports__legend-label">
                    <span
                      className="service-reports__legend-dot"
                      style={{ color: item.color }}
                    />
                    <TruncatedTooltip title={item.displayLabel}>
                      <span>{item.displayLabel}</span>
                    </TruncatedTooltip>
                  </div>
                  <div className="service-reports__legend-value">
                    <span className="service-reports__legend-value-text">
                      {item.value.toLocaleString()}
                    </span>
                    <span className="service-reports__legend-percentage">
                      {item.percentage.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
