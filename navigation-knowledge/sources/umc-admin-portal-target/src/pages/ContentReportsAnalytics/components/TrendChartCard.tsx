import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "antd";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import reportsAnalyticsAedIcon from "@/assets/images/reportsAnalyticsAed.svg";
import reportsAnalyticsInfoIcon from "@/assets/images/reportsAnalyticsInfo.svg";
import ClassNameECharts from "@/components/common/ClassNameECharts";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import type { TrendChartData, ReportsAnalyticsTranslationKey } from "../type";
import useAutoResizeEChart from "./useAutoResizeEChart";

interface TrendChartCardProps {
  titleKey: ReportsAnalyticsTranslationKey;
  infoTextKey?: ReportsAnalyticsTranslationKey;
  titlePrefix?: "aed";
  data: TrendChartData;
  smooth?: boolean;
  yAxisLabelFormatter?: (value: number) => string;
  xAxisLabelRotate?: number;
  showPointMarkers?: boolean;
  layoutVariant?: "default" | "contentTrend" | "edgeAligned";
  visible?: boolean;
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
  smooth = true,
  yAxisLabelFormatter,
  xAxisLabelRotate = 0,
  showPointMarkers = false,
  layoutVariant = "default",
  visible = true,
}: TrendChartCardProps) {
  const { t: translate } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart(visible);
  const isRevenueTrend = titlePrefix === "aed";
  const usesEdgeAlignedGrid =
    layoutVariant === "contentTrend" || layoutVariant === "edgeAligned";
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
            <div class="content-reports__trend-tooltip-row">
              <span class="content-reports__trend-tooltip-series">
                <span class="content-reports__trend-tooltip-marker" style="background-color: ${color};"></span>
                <span class="content-reports__trend-tooltip-label">${label}</span>
              </span>
              <span class="content-reports__trend-tooltip-value">${value}</span>
            </div>
          `;
        })
        .join("");

      return `
        <div class="content-reports__trend-tooltip-content">
          <div class="content-reports__trend-tooltip-title">${title}</div>
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
        className: "content-reports__trend-tooltip",
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
        left: usesEdgeAlignedGrid ? 0 : isRevenueTrend ? 32 : 24,
        right: usesEdgeAlignedGrid ? 0 : 24,
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
          interval: xAxisLabelRotate ? 0 : "auto",
          rotate: xAxisLabelRotate,
          align: xAxisLabelRotate ? "right" : undefined,
          alignMinLabel: xAxisLabelRotate ? undefined : "left",
          alignMaxLabel: xAxisLabelRotate ? undefined : "right",
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
          formatter: (value: number) =>
            yAxisLabelFormatter
              ? yAxisLabelFormatter(value)
              : data.yAxisSuffix && value !== 0
                ? `${value}${data.yAxisSuffix}`
                : `${value}`,
        },
      },
      series: visibleSeries.map((series) => ({
        name: series.displayName,
        type: "line",
        smooth,
        lineStyle: {
          width: 2,
          color: series.color,
          type: series.lineType ?? "solid",
        },
        symbol: "circle",
        symbolSize: showPointMarkers ? 8 : 0,
        showSymbol: showPointMarkers,
        data: series.values,
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
    [
      data,
      isRevenueTrend,
      showPointMarkers,
      smooth,
      tooltipFormatter,
      usesEdgeAlignedGrid,
      visibleSeries,
      xAxisLabelRotate,
      yAxisLabelFormatter,
    ],
  );

  return (
    <div
      className={`content-reports__card content-reports__card-surface content-reports__trend-card ${
        layoutVariant === "contentTrend"
          ? "content-reports__trend-card--content-trend"
          : ""
      }`}
    >
      <div className="content-reports__trend-title-wrap">
        <div className="content-reports__card-title content-reports__trend-title">
          {translate(titleKey)}
        </div>
        {titlePrefix === "aed" && (
          <img
            src={reportsAnalyticsAedIcon}
            alt="AED"
            className="content-reports__trend-aed-icon"
          />
        )}
        {infoTextKey && (
          <Tooltip title={translate(infoTextKey)}>
            <div className="content-reports__trend-info-btn">
              <img
                src={reportsAnalyticsInfoIcon}
                alt={translate("common.info")}
                className="content-reports__trend-info-icon"
              />
            </div>
          </Tooltip>
        )}
      </div>

      {!hasSeries ? (
        <div className="content-reports__trend-content">
          <div className="content-reports__chart-empty">
            <EmptyBox title={translate("common.noData")} />
          </div>
        </div>
      ) : (
        <div className="content-reports__trend-content">
          <div className="content-reports__trend-legend">
            {visibleSeries.map((series) => (
              <div
                key={series.seriesKey}
                className={`content-reports__trend-legend-item ${
                  series.lineType === "dashed"
                    ? "content-reports__trend-legend-item--dashed"
                    : ""
                } ${
                  series.selected ? "" : "content-reports__trend-legend-item--inactive"
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
                  className="content-reports__trend-legend-icon"
                  style={
                    {
                      "--legend-color": series.color,
                    } as CSSProperties
                  }
                >
                  <span className="content-reports__trend-legend-line" />
                  <span className="content-reports__trend-legend-dot" />
                </span>
                <span className="content-reports__trend-legend-label">
                  {series.displayName}
                </span>
              </div>
            ))}
          </div>
          <div
            ref={containerRef}
            className="content-reports__chart-shell content-reports__trend-chart-shell"
          >
            <ClassNameECharts
              ref={chartRef as unknown as Ref<ClassNameECharts>}
              option={option}
              className="content-reports__trend-chart"
              onEvents={onEvents}
            />
          </div>
        </div>
      )}
    </div>
  );
}
