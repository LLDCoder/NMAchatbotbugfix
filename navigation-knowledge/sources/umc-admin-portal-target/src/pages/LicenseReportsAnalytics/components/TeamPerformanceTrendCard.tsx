import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import ReactECharts from "echarts-for-react";
import reportsAnalyticsApprovalRateIcon from "@/assets/images/reportsAnalyticsApprovalRate.svg";
import reportsAnalyticsAvgSatisfactionIcon from "@/assets/images/reportsAnalyticsAvgSatisfaction.svg";
import reportsAnalyticsAvgProcessingTimeIcon from "@/assets/images/reportsAnalyticsAvgProcessingTime.svg";
import type { TeamPerformanceTrendData, ReportsAnalyticsTranslationKey } from "../type";
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
  const [vw = window.innerWidth, vh = window.innerHeight] = size.viewSize ?? [];
  const sp = 16;
  return [
    Math.min(Math.max(sp, px + sp), vw - cw - sp),
    Math.min(Math.max(sp, py + sp), vh - ch - sp),
  ];
};

export default function TeamPerformanceTrendCard({
  titleKey,
  data,
  visible = true,
}: TeamPerformanceTrendCardProps) {
  const { t } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart(visible);

  const slaLabel = t("licenseReportsAnalytics.teamTrend.slaCompliance");
  const ptLabel = t("licenseReportsAnalytics.teamTrend.avgProcessingTime");

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
          const color = typeof item.color === "string" ? item.color : SLA_COLOR;
          const label = escapeHtml(String(item.seriesName ?? ""));
          const suffix = i === 0 ? "%" : "d";
          const val = Number(item.value ?? 0);
          const formatted =
            val !== 0
              ? `${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`
              : `0${suffix}`;
          return `<div class="reports-trend-tooltip-row">
            <span class="reports-trend-tooltip-series">
              <span class="reports-trend-tooltip-marker" style="background-color:${color};"></span>
              <span class="reports-trend-tooltip-label">${label}</span>
            </span>
            <span class="reports-trend-tooltip-value">${escapeHtml(formatted)}</span>
          </div>`;
        })
        .join("");
      return `<div class="reports-trend-tooltip-content"><div class="reports-trend-tooltip-title">${title}</div>${rows}</div>`;
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
        className: "reports-trend-tooltip",
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
      /*
        Figma annotation (node 44485:62719): the chart block sits 24px from the card
        edges, with the left axis numbers LEFT-aligned at that inset and the right
        axis numbers RIGHT-aligned. Fixed gutters (containLabel: false) make the
        maths deterministic: plot starts 64px in; labels anchor 40px outside the
        axis line, i.e. exactly at the 24px inset.
      */
      grid: { left: 64, right: 64, top: 6, bottom: 28, containLabel: false },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: categories,
        axisLine: { lineStyle: { color: "#E1E3E5" } },
        axisLabel: {
          color: "#5f646d",
          fontSize: 12,
          margin: 12,
          hideOverlap: true,
          showMinLabel: true,
          showMaxLabel: true,
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
          splitLine: { lineStyle: { color: "#E1E3E5", type: "dashed" } },
          axisLabel: {
            color: "#9EA2A9",
            fontSize: 12,
            /* Left edge of the number at the 24px card inset (64 - 40). */
            align: "left",
            margin: 40,
            showMinLabel: true,
            showMaxLabel: true,
            formatter: (value: number) => (value === 0 ? "0" : `${value}%`),
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
            /* Right edge of the number at the 24px card inset (64 - 40). */
            align: "right",
            margin: 40,
            showMinLabel: true,
            showMaxLabel: true,
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
          lineStyle: { width: 2, color: PT_COLOR, type: "dashed" },
          itemStyle: { color: PT_COLOR },
        },
      ],
    }),
    [categories, ptLabel, ptValues, selectedMap, slaLabel, slaValues, tooltipFormatter],
  );

  const legendItems = [
    { key: SERIES_KEYS.sla, label: slaLabel, color: SLA_COLOR, dashed: false },
    { key: SERIES_KEYS.pt, label: ptLabel, color: PT_COLOR, dashed: true },
  ];

  return (
    <div className="reports-card analytics-card-surface reports-team-trend-card">
      <div className="reports-card-title">{t(titleKey)}</div>

      <div className="reports-team-trend-kpi-row">
        <div className="reports-team-trend-kpi-box">
          <img
            src={reportsAnalyticsApprovalRateIcon}
            alt=""
            className="reports-team-trend-kpi-icon"
          />
          <div className="reports-team-trend-kpi-copy">
            <div className="reports-team-trend-kpi-value">
              {data.slaComplianceRate.toFixed(1)}%
            </div>
            <div className="reports-team-trend-kpi-label">
              {t("licenseReportsAnalytics.teamTrend.slaCompliance")}
            </div>
          </div>
        </div>

        <div className="reports-team-trend-kpi-box">
          <img
            src={reportsAnalyticsAvgSatisfactionIcon}
            alt=""
            className="reports-team-trend-kpi-icon"
          />
          <div className="reports-team-trend-kpi-copy">
            <div className="reports-team-trend-kpi-value">
              {data.slaBreached.toLocaleString()}
            </div>
            <div className="reports-team-trend-kpi-label">
              {t("licenseReportsAnalytics.teamTrend.slaBreached")}
            </div>
          </div>
        </div>

        <div className="reports-team-trend-kpi-box">
          <img
            src={reportsAnalyticsAvgProcessingTimeIcon}
            alt=""
            className="reports-team-trend-kpi-icon"
          />
          <div className="reports-team-trend-kpi-copy">
            <div className="reports-team-trend-kpi-value">
              {data.avgProcessingTime}
            </div>
            <div className="reports-team-trend-kpi-label">
              {t("licenseReportsAnalytics.teamTrend.avgProcessingTime")}
            </div>
          </div>
        </div>
      </div>

      <div className="reports-team-trend-legend">
        {legendItems.map((item) => (
          <div
            key={item.key}
            className={`reports-team-trend-legend-item${
              !selectedMap[item.key] ? " reports-team-trend-legend-item-inactive" : ""
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
              className={`reports-team-trend-legend-line${item.dashed ? " reports-team-trend-legend-line-dashed" : ""}`}
              style={{ borderColor: item.color }}
            />
            <span
              className="reports-team-trend-legend-dot"
              style={{ background: item.color }}
            />
            <span className="reports-team-trend-legend-label">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="reports-team-trend-chart-shell" ref={containerRef}>
        <ReactECharts
          ref={chartRef}
          option={option}
          className="reports-donut-chart"
          notMerge={true}
          onEvents={onEvents}
          style={{ height: "100%", width: "100%" }}
        />
      </div>
    </div>
  );
}
