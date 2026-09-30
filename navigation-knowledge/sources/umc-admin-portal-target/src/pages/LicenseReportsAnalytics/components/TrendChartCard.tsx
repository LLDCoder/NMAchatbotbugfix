import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "antd";
import ReactECharts from "echarts-for-react";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import reportsAnalyticsAedIcon from "@/assets/images/reportsAnalyticsAed.svg";
import reportsAnalyticsInfoIcon from "@/assets/images/reportsAnalyticsInfo.svg";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import type { TrendChartData, ReportsAnalyticsTranslationKey } from "../type";
import useAutoResizeEChart from "./useAutoResizeEChart";

/* 1 decimal max, no trailing ".0" - 500000/1e3 -> "500", 1500000/1e6 -> "1.5". */
const trimTrailingZero = (value: number) =>
  (Math.round(value * 10) / 10).toString();

interface TrendChartCardProps {
  titleKey: ReportsAnalyticsTranslationKey;
  infoTextKey?: ReportsAnalyticsTranslationKey;
  titlePrefix?: "aed";
  data: TrendChartData;
  visible?: boolean;
  layout?: "default" | "sideLegend";
}

interface LegendSelectChangedEvent {
  selected: Record<string, boolean>;
}

interface TooltipContentSize {
  contentSize?: [number, number];
  viewSize?: [number, number];
}

interface TrendTooltipParam extends CallbackDataParams {
  axisValueLabel?: string;
  axisValue?: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatTooltipValue = (value: unknown, suffix?: string) => {
  const numericValue = Number(value ?? 0);
  const formattedValue = Number.isFinite(numericValue)
    ? numericValue.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })
    : String(value ?? "");

  return suffix && numericValue !== 0
    ? `${formattedValue}${suffix}`
    : formattedValue;
};

const createSelectedMap = (chartData: TrendChartData) =>
  chartData.series.reduce<Record<string, boolean>>((result, item) => {
    result[item.nameKey || item.name] = true;
    return result;
  }, {});

const getTooltipPosition = (
  point: [number, number],
  _params: CallbackDataParams | CallbackDataParams[],
  _dom: HTMLElement,
  _rect: unknown,
  size: TooltipContentSize,
): [number, number] => {
  const [pointX, pointY] = point;
  const [contentWidth = 0, contentHeight = 0] = size.contentSize ?? [];
  const [viewWidth = window.innerWidth, viewHeight = window.innerHeight] =
    size.viewSize ?? [];
  const spacing = 16;
  const topSpacing = 8;
  const maxLeft = Math.max(spacing, viewWidth - contentWidth - spacing);
  const maxTop = Math.max(topSpacing, viewHeight - contentHeight - spacing);
  const clampPosition = (left: number, top: number): [number, number] => [
    Math.min(Math.max(spacing, left), maxLeft),
    Math.min(Math.max(topSpacing, top), maxTop),
  ];
  const overlapsPoint = ([left, top]: [number, number]) =>
    pointX >= left &&
    pointX <= left + contentWidth &&
    pointY >= top &&
    pointY <= top + contentHeight;

  const candidates: [number, number][] = [
    clampPosition(pointX + spacing, pointY + spacing),
    clampPosition(pointX + spacing, pointY - contentHeight - spacing),
    clampPosition(pointX - contentWidth - spacing, pointY + spacing),
    clampPosition(pointX - contentWidth - spacing, pointY - contentHeight - spacing),
  ];

  const nonOverlappingPosition = candidates.find(
    (candidate) => !overlapsPoint(candidate),
  );

  return nonOverlappingPosition ?? candidates[0];
};

export default function TrendChartCard({
  titleKey,
  infoTextKey,
  titlePrefix,
  data,
  visible = true,
  layout = "default",
}: TrendChartCardProps) {
  const { t: translate } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart(visible);
  const isRevenueTrend = titlePrefix === "aed";
  const isSideLegendLayout = layout === "sideLegend";
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() =>
    createSelectedMap(data),
  );

  const seriesSignature = useMemo(
    () =>
      data.series
        .map((item) => `${item.nameKey || item.name}:${item.values.join(",")}`)
        .join("|"),
    [data],
  );

  useEffect(() => {
    setSelectedMap(createSelectedMap(data));
  }, [data, seriesSignature]);

  const displayedSeries = useMemo(
    () =>
      data.series.map((series) => ({
        ...series,
        seriesKey: series.nameKey || series.name,
        displayName: series.nameKey ? translate(series.nameKey) : series.name,
        selected: selectedMap[series.nameKey || series.name] !== false,
      })),
    [data, selectedMap, translate],
  );

  const visibleSeries = displayedSeries;
  const hasSeries = visibleSeries.length > 0;

  const handleLegendSelectChanged = useCallback(
    (event: LegendSelectChangedEvent) => {
      setSelectedMap((previous) => {
        const nextSelected: Record<string, boolean> = {};

        data.series.forEach((series) => {
          const seriesKey = series.nameKey || series.name;
          const displayName = series.nameKey
            ? translate(series.nameKey)
            : series.name;

          nextSelected[seriesKey] =
            event.selected[displayName] ?? previous[seriesKey] ?? true;
        });

        return nextSelected;
      });
    },
    [data, translate],
  );

  const toggleLegendSelection = useCallback(
    (seriesKey: string, displayName: string) => {
      const chartInstance = chartRef.current?.getEchartsInstance();

      if (chartInstance) {
        chartInstance.dispatchAction({
          type: "legendToggleSelect",
          name: displayName,
        });

        return;
      }

      setSelectedMap((previous) => ({
        ...previous,
        [seriesKey]: previous[seriesKey] === false,
      }));
    },
    [chartRef],
  );

  const onLegendKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLDivElement>,
      seriesKey: string,
      displayName: string,
    ) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      toggleLegendSelection(seriesKey, displayName);
    },
    [toggleLegendSelection],
  );

  const onEvents = useMemo(
    () => ({
      legendselectchanged: handleLegendSelectChanged,
    }),
    [handleLegendSelectChanged],
  );

  const tooltipFormatter = useCallback(
    (params: CallbackDataParams | CallbackDataParams[]) => {
      const seriesParams = Array.isArray(params) ? params : [params];

      if (seriesParams.length === 0) {
        return "";
      }

      const title = escapeHtml(
        String(
          (seriesParams[0] as TrendTooltipParam).axisValueLabel ??
            (seriesParams[0] as TrendTooltipParam).axisValue ??
            seriesParams[0].name ??
            "",
        ),
      );

      const rows = seriesParams
        .map((item) => {
          const color =
            typeof item.color === "string" ? item.color : "#A0D5AB";
          const label = escapeHtml(String(item.seriesName ?? item.name ?? ""));
          const value = escapeHtml(
            formatTooltipValue(item.value, data.yAxisSuffix),
          );

          return `
            <div class="reports-trend-tooltip-row">
              <span class="reports-trend-tooltip-series">
                <span class="reports-trend-tooltip-marker" style="background-color: ${color};"></span>
                <span class="reports-trend-tooltip-label">${label}</span>
              </span>
              <span class="reports-trend-tooltip-value">${value}</span>
            </div>
          `;
        })
        .join("");

      return `
        <div class="reports-trend-tooltip-content">
          <div class="reports-trend-tooltip-title">${title}</div>
          ${rows}
        </div>
      `;
    },
    [data.yAxisSuffix],
  );

  const option = useMemo(
    () => ({
      animation: false,
      tooltip: {
        trigger: "axis",
        renderMode: "html",
        appendTo: "body",
        confine: false,
        position: getTooltipPosition,
        className: "reports-trend-tooltip",
        backgroundColor: "transparent",
        borderWidth: 0,
        padding: 0,
        formatter: tooltipFormatter,
      },
      legend: {
        show: false,
        selectedMode: true,
        data: visibleSeries.map((series) => series.displayName),
        selected: visibleSeries.reduce<Record<string, boolean>>(
          (result, series) => {
            result[series.displayName] = series.selected;
            return result;
          },
          {},
        ),
      },
      grid: {
        left: isRevenueTrend ? 32 : 24,
        right: isSideLegendLayout ? 8 : 24,
        top: 6,
        bottom: 0,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.categories,
        axisLine: {
          lineStyle: { color: "#E1E3E5" },
        },
        axisLabel: {
          color: "#5f646d",
          fontSize: 12,
          margin: 12,
          alignMinLabel: "left",
          alignMaxLabel: "right",
          showMinLabel: true,
          showMaxLabel: true,
          hideOverlap: true,
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        min: data.yAxisMin,
        max: data.yAxisMax,
        interval: data.yAxisInterval,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: {
            color: "#E1E3E5",
            type: "dashed",
          },
        },
        axisLabel: {
          color: "#9EA2A9",
          fontSize: 12,
          formatter: (value: number) => {
            /*
              Compact currency/count units per the Figma annotation (node
              44485:62719): 500,000 -> 500K, 1,000,000 -> 1M, then B / T.
              Values under 1,000 (e.g. percentages) are untouched.
            */
            const abs = Math.abs(value);
            const compact =
              abs >= 1e12
                ? `${trimTrailingZero(value / 1e12)}T`
                : abs >= 1e9
                ? `${trimTrailingZero(value / 1e9)}B`
                : abs >= 1e6
                ? `${trimTrailingZero(value / 1e6)}M`
                : abs >= 1e3
                ? `${trimTrailingZero(value / 1e3)}K`
                : `${value}`;

            return data.yAxisSuffix && value !== 0
              ? `${compact}${data.yAxisSuffix}`
              : compact;
          },
        },
      },
      series: visibleSeries.map((series) => ({
        name: series.displayName,
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 0,
        data: series.values,
        lineStyle: {
          width: 2,
          color: series.color,
        },
        itemStyle: {
          color: series.color,
        },
        areaStyle: series.areaColor
          ? {
              color: series.areaColor,
            }
          : undefined,
      })),
    }),
    [data, isRevenueTrend, isSideLegendLayout, tooltipFormatter, visibleSeries],
  );

  return (
    <div
      className={`reports-card analytics-card-surface reports-trend-card ${
        isSideLegendLayout ? "reports-trend-card-side-legend" : ""
      }`}
    >
      <div className="reports-trend-title-wrap">
        <div className="reports-card-title reports-trend-title">
          {translate(titleKey)}
        </div>
        {titlePrefix === "aed" && (
          <img
            src={reportsAnalyticsAedIcon}
            alt="AED"
            className="reports-trend-aed-icon"
          />
        )}
        {infoTextKey && (
          <Tooltip title={translate(infoTextKey)}>
            <div className="reports-trend-info-button">
              <img
                src={reportsAnalyticsInfoIcon}
                alt={translate("common.info")}
                className="reports-trend-info-icon"
              />
            </div>
          </Tooltip>
        )}
      </div>

      {!hasSeries ? (
        <div className="reports-chart-empty">
          <EmptyBox title={translate("common.noData")} />
        </div>
      ) : (
        <div
          className={`reports-trend-content ${
            isSideLegendLayout ? "reports-trend-content-side-legend" : ""
          }`}
        >
          <div
            className={`reports-trend-legend ${
              isSideLegendLayout ? "reports-trend-legend-side" : ""
            }`}
          >
            {visibleSeries.map((series) => (
              <div
                key={series.seriesKey}
                className={`reports-trend-legend-item ${
                  series.selected ? "" : "reports-trend-legend-item-inactive"
                }`}
                role="button"
                tabIndex={0}
                aria-pressed={series.selected}
                onClick={() =>
                  toggleLegendSelection(series.seriesKey, series.displayName)
                }
                onKeyDown={(event) =>
                  onLegendKeyDown(event, series.seriesKey, series.displayName)
                }
              >
                <span
                  className="reports-trend-legend-icon"
                  style={
                    {
                      "--legend-color": series.color,
                    } as CSSProperties
                  }
                >
                  <span className="reports-trend-legend-line" />
                  <span className="reports-trend-legend-dot" />
                </span>
                {/* title keeps the full name reachable once the side legend
                    ellipsizes it (see .reports-trend-legend-side in the LESS). */}
                <span
                  className="reports-trend-legend-label"
                  title={series.displayName}
                >
                  {series.displayName}
                </span>
              </div>
            ))}
          </div>
          <div
            ref={containerRef}
            className={`reports-chart-shell reports-trend-chart-shell ${
              isSideLegendLayout ? "reports-trend-chart-shell-side" : ""
            }`}
          >
            <ReactECharts
              ref={chartRef}
              option={option}
              className="reports-trend-chart"
              onEvents={onEvents}
            />
          </div>
        </div>
      )}
    </div>
  );
}
