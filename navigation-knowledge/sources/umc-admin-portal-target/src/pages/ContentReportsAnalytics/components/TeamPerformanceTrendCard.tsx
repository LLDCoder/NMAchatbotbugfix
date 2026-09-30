import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import reportsAnalyticsApprovalRateIcon from "@/assets/images/reportsAnalyticsApprovalRate.svg";
import reportsAnalyticsAvgSatisfactionIcon from "@/assets/images/reportsAnalyticsAvgSatisfaction.svg";
import reportsAnalyticsAvgProcessingTimeIcon from "@/assets/images/reportsAnalyticsAvgProcessingTime.svg";
import ClassNameECharts from "@/components/common/ClassNameECharts";
import type {
  TeamPerformanceTrendData,
  ReportsAnalyticsTranslationKey,
} from "../type";
import useAutoResizeEChart from "./useAutoResizeEChart";

interface TeamPerformanceTrendCardProps {
  titleKey: ReportsAnalyticsTranslationKey;
  data: TeamPerformanceTrendData;
  visible?: boolean;
}

interface LegendSelectChangedEvent {
  selected: Record<string, boolean>;
}

interface TrendTooltipParam extends CallbackDataParams {
  axisValueLabel?: string;
  axisValue?: string;
}

const SLA_COLOR = "#A0D5AB";
const PT_COLOR = "#FAAAA7";

const SERIES_KEYS = {
  sla: "slaCompliance",
  pt: "avgProcessingTime",
} as const;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getTooltipPosition = (
  point: [number, number],
  _params: unknown,
  _dom: HTMLElement,
  _rect: unknown,
  size: { contentSize?: [number, number]; viewSize?: [number, number] },
): [number, number] => {
  const [px, py] = point;
  const [cw = 0, ch = 0] = size.contentSize ?? [];
  const [vw = window.innerWidth, vh = window.innerHeight] =
    size.viewSize ?? [];
  const sp = 16;
  const left = Math.min(Math.max(sp, px + sp), vw - cw - sp);
  const top = Math.min(Math.max(sp, py + sp), vh - ch - sp);
  return [left, top];
};

export default function TeamPerformanceTrendCard({
  titleKey,
  data,
  visible = true,
}: TeamPerformanceTrendCardProps) {
  const { t: translate } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart(visible);

  const slaLabel = translate("contentReportsAnalytics.summary.slaCompliance");
  const ptLabel = translate(
    "contentReportsAnalytics.summary.avgProcessingTime",
  );

  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({
    [SERIES_KEYS.sla]: true,
    [SERIES_KEYS.pt]: true,
  });

  const handleLegendSelectChanged = useCallback(
    (event: LegendSelectChangedEvent) => {
      setSelectedMap({
        [SERIES_KEYS.sla]: event.selected[slaLabel] ?? true,
        [SERIES_KEYS.pt]: event.selected[ptLabel] ?? true,
      });
    },
    [slaLabel, ptLabel],
  );

  const toggleSeries = useCallback(
    (key: string, displayName: string) => {
      const instance = chartRef.current?.getEchartsInstance();
      if (instance) {
        instance.dispatchAction({ type: "legendToggleSelect", name: displayName });
        return;
      }
      setSelectedMap((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [chartRef],
  );

  const onEvents = useMemo(
    () => ({ legendselectchanged: handleLegendSelectChanged }),
    [handleLegendSelectChanged],
  );

  const tooltipFormatter = useCallback(
    (params: CallbackDataParams | CallbackDataParams[]) => {
      const list = Array.isArray(params) ? params : [params];
      if (!list.length) return "";
      const title = escapeHtml(
        String(
          (list[0] as TrendTooltipParam).axisValueLabel ??
            (list[0] as TrendTooltipParam).axisValue ??
            "",
        ),
      );
      const rows = list
        .map((item, i) => {
          const color =
            typeof item.color === "string" ? item.color : SLA_COLOR;
          const label = escapeHtml(String(item.seriesName ?? ""));
          const suffix = i === 0 ? "%" : "d";
          const val = Number(item.value ?? 0);
          const formatted =
            val !== 0
              ? `${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`
              : `0${suffix}`;
          return `
            <div class="content-reports__trend-tooltip-row">
              <span class="content-reports__trend-tooltip-series">
                <span class="content-reports__trend-tooltip-marker" style="background-color:${color};"></span>
                <span class="content-reports__trend-tooltip-label">${label}</span>
              </span>
              <span class="content-reports__trend-tooltip-value">${escapeHtml(formatted)}</span>
            </div>`;
        })
        .join("");
      return `<div class="content-reports__trend-tooltip-content"><div class="content-reports__trend-tooltip-title">${title}</div>${rows}</div>`;
    },
    [],
  );

  const categories = data.trend.map((item) => item.period);
  const slaValues = data.trend.map((item) => item.slaComplianceRate);
  const ptValues = data.trend.map((item) => item.avgProcessingTimeDays);

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
        data: [slaLabel, ptLabel],
        selected: {
          [slaLabel]: selectedMap[SERIES_KEYS.sla],
          [ptLabel]: selectedMap[SERIES_KEYS.pt],
        },
      },
      grid: { left: 48, right: 48, top: 6, bottom: 0, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: categories,
        axisLine: { lineStyle: { color: "#E1E3E5" } },
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
      yAxis: [
        {
          type: "value",
          min: 0,
          max: 100,
          position: "left",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: {
            lineStyle: { color: "#E1E3E5", type: "dashed" },
          },
          axisLabel: {
            color: "#9EA2A9",
            fontSize: 12,
            formatter: (value: number) =>
              value === 0 ? "0" : `${value}%`,
          },
        },
        {
          type: "value",
          min: 0,
          position: "right",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: "#9EA2A9",
            fontSize: 12,
            formatter: (value: number) => `${value}d`,
          },
        },
      ],
      series: [
        {
          name: slaLabel,
          type: "line",
          yAxisIndex: 0,
          smooth: false,
          symbol: "circle",
          symbolSize: 8,
          showSymbol: true,
          data: selectedMap[SERIES_KEYS.sla] ? slaValues : [],
          lineStyle: { width: 2, color: SLA_COLOR },
          itemStyle: { color: SLA_COLOR },
        },
        {
          name: ptLabel,
          type: "line",
          yAxisIndex: 1,
          smooth: false,
          symbol: "circle",
          symbolSize: 8,
          showSymbol: true,
          data: selectedMap[SERIES_KEYS.pt] ? ptValues : [],
          lineStyle: { width: 2, color: PT_COLOR },
          itemStyle: { color: PT_COLOR },
        },
      ],
    }),
    [
      categories,
      ptLabel,
      ptValues,
      selectedMap,
      slaLabel,
      slaValues,
      tooltipFormatter,
    ],
  );

  const legendItems = [
    { key: SERIES_KEYS.sla, label: slaLabel, color: SLA_COLOR },
    { key: SERIES_KEYS.pt, label: ptLabel, color: PT_COLOR },
  ];

  return (
    <div className="content-reports__card content-reports__card-surface content-reports__team-perf-trend-card">
      <div className="content-reports__card-title">{translate(titleKey)}</div>

      <div className="content-reports__team-perf-trend-stats">
        <div className="content-reports__stat-card content-reports__stat-card--outlined">
          <div className="content-reports__stat-icon">
            <img
              src={reportsAnalyticsApprovalRateIcon}
              alt=""
              className="content-reports__stat-icon-image"
            />
          </div>
          <div className="content-reports__stat-copy">
            <div className="content-reports__stat-value">
              <span>{data.slaComplianceRate.toFixed(1)}%</span>
            </div>
            <div className="content-reports__stat-label">
              {translate("contentReportsAnalytics.summary.slaCompliance")}
            </div>
          </div>
        </div>

        <div className="content-reports__stat-card content-reports__stat-card--outlined">
          <div className="content-reports__stat-icon">
            <img
              src={reportsAnalyticsAvgSatisfactionIcon}
              alt=""
              className="content-reports__stat-icon-image"
            />
          </div>
          <div className="content-reports__stat-copy">
            <div className="content-reports__stat-value">
              <span>{data.slaBreached.toLocaleString()}</span>
            </div>
            <div className="content-reports__stat-label">
              {translate("contentReportsAnalytics.summary.slaBreached")}
            </div>
          </div>
        </div>

        <div className="content-reports__stat-card content-reports__stat-card--outlined">
          <div className="content-reports__stat-icon">
            <img
              src={reportsAnalyticsAvgProcessingTimeIcon}
              alt=""
              className="content-reports__stat-icon-image"
            />
          </div>
          <div className="content-reports__stat-copy">
            <div className="content-reports__stat-value">
              <span>{data.avgProcessingTime}</span>
            </div>
            <div className="content-reports__stat-label">
              {translate("contentReportsAnalytics.summary.avgProcessingTime")}
            </div>
          </div>
        </div>
      </div>

      <div className="content-reports__team-perf-trend-legend">
        {legendItems.map((item) => (
          <div
            key={item.key}
            className={`content-reports__trend-legend-item${
              !selectedMap[item.key]
                ? " content-reports__trend-legend-item--inactive"
                : ""
            }`}
            role="button"
            tabIndex={0}
            aria-pressed={selectedMap[item.key]}
            onClick={() => toggleSeries(item.key, item.label)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleSeries(item.key, item.label);
              }
            }}
          >
            <span
              className="content-reports__trend-legend-icon"
              style={
                { "--legend-color": item.color } as React.CSSProperties
              }
            >
              <span className="content-reports__trend-legend-line" />
              <span className="content-reports__trend-legend-dot" />
            </span>
            <span className="content-reports__trend-legend-label">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div className="content-reports__trend-content">
        <div
          ref={containerRef}
          className="content-reports__trend-chart-shell"
        >
          <ClassNameECharts
            ref={chartRef}
            option={option}
            className="content-reports__trend-chart"
            notMerge={true}
            onEvents={onEvents}
          />
        </div>
      </div>
    </div>
  );
}
