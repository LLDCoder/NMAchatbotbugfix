import { useMemo, type Ref } from "react";
import { useTranslation } from "react-i18next";
import ClassNameECharts from "@/components/common/ClassNameECharts";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import type { TeamPerformanceTrendData, ProcessingTimeDto } from "../type";
import useAutoResizeEChart from "@/pages/ContentReportsAnalytics/components/useAutoResizeEChart";
import { escapeHtml } from "@/utils/escapeHtml";
import customerReportsAvgProcessingTime from "@/assets/images/customerReportsAvgProcessingTime.svg";
import customerReportsSlaBreached from "@/assets/images/customerReportsSlaBreached.svg";
import customerReportsSlaCompliance from "@/assets/images/customerReportsSlaCompliance.svg";

interface TeamPerformanceTrendCardProps {
  data: TeamPerformanceTrendData;
  slaComplianceRate: number;
  slaBreachesCount: number;
  avgProcessingTime: ProcessingTimeDto;
  smooth?: boolean;
  visible?: boolean;
}
interface TrendTooltipParam {
  axisValueLabel?: string;
  axisValue?: string | number;
  color?: string;
  seriesName?: string;
  seriesIndex?: number;
  value?: number;
}

export default function TeamPerformanceTrendCard({
  data,
  slaComplianceRate,
  slaBreachesCount,
  avgProcessingTime,
  smooth = true,
  visible = true,
}: TeamPerformanceTrendCardProps) {
  const { t: translate } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart(visible);
  const hasSeries = data.categories.length > 0;

  const option = useMemo(() => {
    const maxTime = data.avgProcessingTimeValues.reduce(
      (max, v) => Math.max(max, v),
      0,
    );
    const rightMax = maxTime > 0 ? Math.ceil(maxTime * 1.2) : 10;

    return {
      animation: false,
      tooltip: {
        trigger: "axis",
        renderMode: "html",
        appendTo: "body",
        confine: false,
        className: "content-reports__trend-tooltip",
        backgroundColor: "transparent",
        borderWidth: 0,
        padding: 0,
        formatter: (params: TrendTooltipParam[]) => {
          const title = escapeHtml(
            params[0]?.axisValueLabel ?? params[0]?.axisValue ?? "",
          );
          const rows = params
            .map((p) => {
              const color = typeof p.color === "string" ? p.color : "#A0D5AB";
              const label = escapeHtml(p.seriesName ?? "");
              const value = p.seriesIndex === 0
                ? `${Number(p.value ?? 0).toFixed(1)}%`
                : `${Number(p.value ?? 0)}${data.avgProcessingTimeUnit}`;
              return `<div class="content-reports__trend-tooltip-row">
                <span class="content-reports__trend-tooltip-series">
                  <span class="content-reports__trend-tooltip-marker" style="background-color:${color};"></span>
                  <span class="content-reports__trend-tooltip-label">${label}</span>
                </span>
                <span class="content-reports__trend-tooltip-value">${escapeHtml(value)}</span>
              </div>`;
            })
            .join("");
          return `<div class="content-reports__trend-tooltip-content">
            <div class="content-reports__trend-tooltip-title">${title}</div>
            ${rows}
          </div>`;
        },
      },
      legend: { show: false },
      grid: { left: 24, right: 40, top: 6, bottom: 0, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.categories,
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
          interval: 20,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#E1E3E5", type: "dashed" } },
          axisLabel: {
            color: "#9EA2A9",
            fontSize: 12,
            formatter: (v: number) => (v === 0 ? "0" : `${v}%`),
          },
        },
        {
          type: "value",
          min: 0,
          max: rightMax,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: "#9EA2A9",
            fontSize: 12,
            formatter: (v: number) => (v === 0 ? "0" : `${v}${data.avgProcessingTimeUnit}`),
          },
        },
      ],
      series: [
        {
          name: translate("customerReportsAnalytics.teamPerf.slaCompliance"),
          type: "line",
          smooth,
          yAxisIndex: 0,
          symbol: "circle",
          symbolSize: 0,
          showSymbol: false,
          data: data.slaComplianceValues,
          lineStyle: { width: 2, color: "#A0D5AB" },
          itemStyle: { color: "#A0D5AB" },
        },
        {
          name: translate("customerReportsAnalytics.teamPerf.avgProcessingTime"),
          type: "line",
          smooth,
          yAxisIndex: 1,
          symbol: "circle",
          symbolSize: 0,
          showSymbol: false,
          data: data.avgProcessingTimeValues,
          lineStyle: { width: 2, color: "#FAAAA7", type: "dashed" },
          itemStyle: { color: "#FAAAA7" },
        },
      ],
    };
  }, [data, smooth, translate]);

  return (
    <div className="content-reports__card content-reports__card-surface customer-reports__team-perf-card">
      <div className="content-reports__card-title">
        {translate("customerReportsAnalytics.charts.teamPerformanceTrend")}
      </div>

      <div className="customer-reports__team-perf-kpi-row">
        <div className="customer-reports__team-perf-kpi-box">
          <div className="customer-reports__team-perf-kpi-icon">
            <img src={customerReportsSlaCompliance} alt="" aria-hidden="true" />
          </div>
          <div className="customer-reports__team-perf-kpi-copy">
            <span className="customer-reports__team-perf-kpi-value">
              {slaComplianceRate.toFixed(1)}%
            </span>
            <span className="customer-reports__team-perf-kpi-label">
              {translate("customerReportsAnalytics.teamPerf.slaCompliance")}
            </span>
          </div>
        </div>
        <div className="customer-reports__team-perf-kpi-box">
          <div className="customer-reports__team-perf-kpi-icon">
            <img src={customerReportsSlaBreached} alt="" aria-hidden="true" />
          </div>
          <div className="customer-reports__team-perf-kpi-copy">
            <span className="customer-reports__team-perf-kpi-value">
              {slaBreachesCount.toLocaleString()}
            </span>
            <span className="customer-reports__team-perf-kpi-label">
              {translate("customerReportsAnalytics.teamPerf.slaBreached")}
            </span>
          </div>
        </div>
        <div className="customer-reports__team-perf-kpi-box">
          <div className="customer-reports__team-perf-kpi-icon">
            <img src={customerReportsAvgProcessingTime} alt="" aria-hidden="true" />
          </div>
          <div className="customer-reports__team-perf-kpi-copy">
            <span className="customer-reports__team-perf-kpi-value">
              {avgProcessingTime.display}
            </span>
            <span className="customer-reports__team-perf-kpi-label">
              {translate("customerReportsAnalytics.teamPerf.avgProcessingTime")}
            </span>
          </div>
        </div>
      </div>

      <div className="customer-reports__team-perf-legend">
        <div className="content-reports__trend-legend-item">
          <span
            className="content-reports__trend-legend-icon"
            style={{ "--legend-color": "#A0D5AB" } as React.CSSProperties}
          >
            <span className="content-reports__trend-legend-line" />
            <span className="content-reports__trend-legend-dot" />
          </span>
          <span className="content-reports__trend-legend-label">
            {translate("customerReportsAnalytics.teamPerf.slaCompliance")}
          </span>
        </div>
        <div className="content-reports__trend-legend-item">
          <span
            className="content-reports__trend-legend-icon"
            style={{ "--legend-color": "#FAAAA7" } as React.CSSProperties}
          >
            <span className="content-reports__trend-legend-line content-reports__trend-legend-line--dashed" />
            <span className="content-reports__trend-legend-dot" />
          </span>
          <span className="content-reports__trend-legend-label">
            {translate("customerReportsAnalytics.teamPerf.avgProcessingTime")}
          </span>
        </div>
      </div>

      {!hasSeries ? (
        <div className="content-reports__trend-content">
          <div className="content-reports__chart-empty">
            <EmptyBox title={translate("common.noData")} />
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="content-reports__chart-shell content-reports__trend-chart-shell customer-reports__team-perf-chart-shell"
        >
          <ClassNameECharts
            ref={chartRef as unknown as Ref<ClassNameECharts>}
            option={option}
            className="content-reports__trend-chart"
          />
        </div>
      )}
    </div>
  );
}
