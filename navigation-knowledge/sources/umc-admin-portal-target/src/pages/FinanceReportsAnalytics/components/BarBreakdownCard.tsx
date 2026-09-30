import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import reportsAnalyticsAedIcon from "@/assets/images/reportsAnalyticsAed.svg";
import reportsAnalyticsInfoIcon from "@/assets/images/reportsAnalyticsInfo.svg";
import { escapeHtml } from "@/utils/escapeHtml";
import type { BarChartData, FinanceReportsTranslationKey } from "../type";
import useAutoResizeEChart from "./useAutoResizeEChart";
import { formatChartAxisValue } from "../utils/format";

interface BarBreakdownCardProps {
  titleKey: FinanceReportsTranslationKey;
  infoTextKey?: FinanceReportsTranslationKey;
  titlePrefix?: "aed";
  data: BarChartData;
  size?: "tall" | "medium";
}

interface BarTooltipParam {
  dataIndex: number;
  marker: string;
  name: string;
}

export default function BarBreakdownCard({
  titleKey,
  infoTextKey,
  titlePrefix,
  data,
  size = "tall",
}: BarBreakdownCardProps) {
  const { t: translate } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart();

  const option = useMemo(
    () => ({
      animation: false,
      grid: {
        left: 0,
        right: 0,
        top: 24,
        bottom: 0,
        containLabel: true,
      },
      tooltip: {
        trigger: "item",
        backgroundColor: "#ffffff",
        borderColor: "#e1e3e5",
        borderWidth: 1,
        textStyle: {
          color: "#361e12",
          fontSize: 12,
        },
        formatter: (params: BarTooltipParam) => {
          const item = data.items[params.dataIndex];

          if (!item) {
            return "";
          }

          return `${params.marker}${escapeHtml(params.name)}: ${escapeHtml(item.displayValue)}`;
        },
      },
      xAxis: {
        type: "category",
        data: data.items.map((item) =>
          item.nameKey ? translate(item.nameKey) : item.name,
        ),
        axisLine: {
          lineStyle: { color: "#E1E3E5" },
        },
        axisTick: { show: false },
        axisLabel: {
          color: "#5f646d",
          fontSize: 12,
          margin: 12,
          hideOverlap: false,
        },
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
      series: data.items.map((item, seriesIndex) => ({
        type: "bar",
        barWidth: 40,
        barGap: "-100%",
        barMinHeight: item.value === 0 ? 0 : 6,
        data: data.items.map((_, dataIndex) => {
          if (dataIndex !== seriesIndex) {
            return "-";
          }

          return {
            value: item.value,
            itemStyle: {
              color: item.color,
              borderRadius: item.value >= 0 ? [8, 8, 0, 0] : [0, 0, 8, 8],
            },
            label: {
              show: true,
              position: item.value >= 0 ? "top" : "bottom",
              distance: 8,
              color: item.value >= 0 ? "#361e12" : "#5f646d",
              fontSize: 12,
              fontWeight: 600,
              formatter: item.displayValue,
            },
          };
        }),
      })),
    }),
    [data, translate],
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

      <div className="finance-reports__chart-content finance-reports__bar-content">
        <div ref={containerRef} className="finance-reports__bar-chart-shell">
          <ReactECharts
            ref={chartRef}
            option={option}
            notMerge={true}
            className="finance-reports__chart"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
