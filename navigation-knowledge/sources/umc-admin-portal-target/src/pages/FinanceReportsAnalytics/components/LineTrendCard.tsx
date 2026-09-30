import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import reportsAnalyticsAedIcon from "@/assets/images/reportsAnalyticsAed.svg";
import reportsAnalyticsInfoIcon from "@/assets/images/reportsAnalyticsInfo.svg";
import ClassNameECharts from "@/components/common/ClassNameECharts";
import { escapeHtml } from "@/utils/escapeHtml";
import type { FinanceReportsTranslationKey, TrendChartData } from "../type";
import useAutoResizeEChart from "./useAutoResizeEChart";
import { formatChartAxisValue, formatChartTooltipValue } from "../utils/format";

interface LineTrendCardProps {
  titleKey: FinanceReportsTranslationKey;
  infoTextKey?: FinanceReportsTranslationKey;
  titlePrefix?: "aed";
  data: TrendChartData;
  showLegend?: boolean;
  size?: "tall" | "medium";
  visible?: boolean;
}

interface LineTooltipParam {
  marker: string;
  seriesName: string;
  value: number;
  axisValueLabel: string;
}

interface LegendSelectChangedEvent {
  selected: Record<string, boolean>;
}

const createSelectedMap = (chartData: TrendChartData) =>
  chartData.series.reduce<Record<string, boolean>>((result, item) => {
    result[item.nameKey || item.name] = true;
    return result;
  }, {});

export default function LineTrendCard({
  titleKey,
  infoTextKey,
  titlePrefix,
  data,
  showLegend = data.series.length > 1,
  size = "tall",
  visible = true,
}: LineTrendCardProps) {
  const { t: translate } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart(visible);
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

  const legendItems = useMemo(
    () =>
      data.series.map((series) => ({
        key: series.nameKey || series.name,
        label: series.nameKey ? translate(series.nameKey) : series.name,
        color: series.color,
        selected: selectedMap[series.nameKey || series.name] !== false,
      })),
    [data.series, selectedMap, translate],
  );

  const displayedSeries = useMemo(
    () =>
      data.series
        .map((series) => {
          const seriesKey = series.nameKey || series.name;
          return {
            ...series,
            seriesKey,
            displayName: series.nameKey ? translate(series.nameKey) : series.name,
            selected: selectedMap[seriesKey] !== false,
          };
        }),
    [data.series, selectedMap, translate],
  );

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
    [data.series, translate],
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

  const onEvents = useMemo(
    () => ({
      legendselectchanged: handleLegendSelectChanged,
    }),
    [handleLegendSelectChanged],
  );

  const option = useMemo(
    () => ({
      animation: false,
      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderColor: "#e1e3e5",
        borderWidth: 1,
        textStyle: {
          color: "#361e12",
          fontSize: 12,
        },
        formatter: (params: LineTooltipParam[]) => {
          if (!params.length) {
            return "";
          }

          const title = escapeHtml(params[0].axisValueLabel);
          const items = params
            .map(
              (item) =>
                `${item.marker}${escapeHtml(item.seriesName)}: ${escapeHtml(formatChartTooltipValue(
                  Number(item.value),
                  data.yAxisSuffix,
                ))}`,
            )
            .join("<br/>");

          return `${title}<br/>${items}`;
        },
      },
      legend: {
        show: false,
        selectedMode: true,
        data: legendItems.map((item) => item.label),
        selected: legendItems.reduce<Record<string, boolean>>((result, item) => {
          result[item.label] = item.selected;
          return result;
        }, {}),
      },
      grid: {
        left: 0,
        right: 8,
        top: 24,
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
            color: "#e1e3e5",
            type: "dashed",
          },
        },
        axisLabel: {
          color: "#9ea2a9",
          fontSize: 12,
          formatter: (value: number) => formatChartAxisValue(value, data.yAxisSuffix),
        },
      },
      series: displayedSeries.map((series) => ({
        name: series.displayName,
        type: "line",
        smooth: false,
        symbol: "circle",
        data: series.values,
        lineStyle: {
          width: 2,
          color: series.color,
        },
        itemStyle: {
          color: series.color,
        },
        symbolSize: 0,
        showSymbol: false,
        areaStyle: series.areaColor
          ? {
              color: series.areaColor,
            }
          : undefined,
      })),
    }),
    [data, displayedSeries, legendItems],
  );

  return (
    <div
      className={`finance-reports__chart-card finance-reports__card-surface finance-reports__chart-card--${size}`}
    >
      <div className="finance-reports__card-header">
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
      </div>

      <div className="finance-reports__chart-content finance-reports__trend-content">
        {showLegend ? (
          <div className="finance-reports__trend-legend">
            {legendItems.map((item) => (
              <div
                key={item.key}
                className={`finance-reports__trend-legend-item ${
                  item.selected
                    ? ""
                    : "finance-reports__trend-legend-item--inactive"
                }`}
                onClick={() => toggleLegendSelection(item.key, item.label)}
                role="button"
                tabIndex={0}
              >
                <span
                  className="finance-reports__trend-legend-icon"
                  style={{ "--legend-color": item.color } as CSSProperties}
                >
                  <span className="finance-reports__trend-legend-line" />
                  <span className="finance-reports__trend-legend-dot" />
                </span>
                <span className="finance-reports__trend-legend-label">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div ref={containerRef} className="finance-reports__trend-chart-shell">
          <ClassNameECharts
            ref={chartRef as unknown as Ref<ClassNameECharts>}
            option={option}
            notMerge={true}
            className="finance-reports__chart"
            onEvents={onEvents}
          />
        </div>
      </div>
    </div>
  );
}
