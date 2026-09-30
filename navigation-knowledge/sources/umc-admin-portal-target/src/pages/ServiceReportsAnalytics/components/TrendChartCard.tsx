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
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import type { ReportsAnalyticsTranslationKey, TrendChartData } from "../type";
import useAutoResizeEChart from "./useAutoResizeEChart";

interface TrendChartCardProps {
  titleKey: ReportsAnalyticsTranslationKey;
  infoTextKey?: ReportsAnalyticsTranslationKey;
  titlePrefix?: "aed";
  data: TrendChartData;
  visible?: boolean;
}

interface LegendSelectChangedEvent {
  selected: Record<string, boolean>;
}

const createSelectedMap = (chartData: TrendChartData) =>
  chartData.series.reduce<Record<string, boolean>>((result, item) => {
    result[item.nameKey || item.name] = true;
    return result;
  }, {});

export default function TrendChartCard({
  titleKey,
  infoTextKey,
  titlePrefix,
  data,
  visible = true,
}: TrendChartCardProps) {
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

  const visibleSeries = useMemo(
    () =>
      displayedSeries.filter((series) =>
        series.values.some((value) => Number(value) !== 0),
      ),
    [displayedSeries],
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
        left: 0,
        right: 0,
        top: 8,
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
          formatter: (value: number) =>
            data.yAxisSuffix && value !== 0
              ? `${value}${data.yAxisSuffix}`
              : `${value}`,
        },
      },
      series: visibleSeries.map((series) => ({
        name: series.displayName,
        type: "line",
        smooth: true,
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
    [data, visibleSeries],
  );

  return (
    <div className="service-reports__card service-reports__card-surface service-reports__trend-card">
      <div className="service-reports__trend-title-wrap">
        <div className="service-reports__card-title service-reports__trend-title">
          {translate(titleKey)}
        </div>
        {titlePrefix === "aed" ? (
          <img
            src={reportsAnalyticsAedIcon}
            alt="AED"
            className="service-reports__trend-aed-icon"
          />
        ) : null}
        {infoTextKey ? (
          <Tooltip title={translate(infoTextKey)}>
            <span className="service-reports__trend-info-btn">
              <img
                src={reportsAnalyticsInfoIcon}
                alt=""
                className="service-reports__trend-info-icon"
              />
            </span>
          </Tooltip>
        ) : null}
      </div>

      <div className="service-reports__trend-content">
        <div className="service-reports__trend-legend">
          {visibleSeries.map((series) => (
            <div
              key={series.seriesKey}
              className={`service-reports__trend-legend-item ${
                series.selected ? "" : "service-reports__trend-legend-item--inactive"
              }`}
              onClick={() =>
                toggleLegendSelection(series.seriesKey, series.displayName)
              }
              role="button"
              tabIndex={0}
            >
              <span
                className="service-reports__trend-legend-icon"
                style={{ "--legend-color": series.color } as CSSProperties}
              >
                <span className="service-reports__trend-legend-line" />
                <span className="service-reports__trend-legend-dot" />
              </span>
              <span className="service-reports__trend-legend-label">
                {series.displayName}
              </span>
            </div>
          ))}
        </div>

        <div ref={containerRef} className="service-reports__trend-chart-shell">
          {visibleSeries.length > 0 ? (
            <ClassNameECharts
              ref={chartRef as unknown as Ref<ClassNameECharts>}
              option={option}
              className="service-reports__trend-chart"
              notMerge={true}
              onEvents={onEvents}
            />
          ) : (
            <div className="service-reports__chart-empty">
              <EmptyBox title={translate("common.noData")} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
