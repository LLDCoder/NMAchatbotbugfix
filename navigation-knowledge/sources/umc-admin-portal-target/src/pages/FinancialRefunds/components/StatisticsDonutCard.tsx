import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "antd";
import ReactECharts from "echarts-for-react";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import reportsAnalyticsAedIcon from "@/assets/images/reportsAnalyticsAed.svg";
import reportsAnalyticsInfoIcon from "@/assets/images/reportsAnalyticsInfo.svg";
import { useTranslation } from "react-i18next";
import createViewportEdgeTooltipPosition from "@/utils/createViewportEdgeTooltipPosition";

export interface RefundLegendItem {
  label: string;
  value: number;
  color: string;
  valueText: string;
}

interface StatisticsDonutCardProps {
  title: string;
  totalLabel: string;
  legendItems: RefundLegendItem[];
  formatVisibleTotal: (value: number) => string;
  showAed?: boolean;
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

const formatRefundTooltip = (params: CallbackDataParams) => {
  const label = escapeHtml(String(params.name ?? ""));
  const value = Number(params.value ?? 0).toLocaleString();
  const percentage = Number(params.percent ?? 0).toFixed(2);
  const color = typeof params.color === "string" ? params.color : "#A0D5AB";

  return `
    <div class="financial-refunds__tooltip-content">
      <span class="financial-refunds__tooltip-marker" style="background-color: ${color};"></span>
      <span class="financial-refunds__tooltip-text">${label}: ${value} (${percentage}%)</span>
    </div>
  `;
};

const createSelectedMap = (items: RefundLegendItem[]) =>
  items.reduce<Record<string, boolean>>((result, item) => {
    result[item.label] = true;
    return result;
  }, {});

type EChartsComponentInstance = InstanceType<typeof ReactECharts>;

export default function StatisticsDonutCard({
  title,
  totalLabel,
  legendItems,
  formatVisibleTotal,
  showAed = false,
}: StatisticsDonutCardProps) {
  const { t } = useTranslation();
  const chartRef = useRef<EChartsComponentInstance | null>(null);
  const tooltipPosition = useMemo(
    () =>
      createViewportEdgeTooltipPosition(
        () => chartRef.current?.getEchartsInstance().getDom(),
      ),
    [],
  );
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() =>
    createSelectedMap(legendItems),
  );

  const legendSignature = useMemo(
    () => legendItems.map((item) => `${item.label}:${item.value}`).join("|"),
    [legendItems],
  );

  useEffect(() => {
    setSelectedMap(createSelectedMap(legendItems));
  }, [legendItems, legendSignature]);

  const mergedLegendItems = useMemo(
    () =>
      legendItems.map((item) => ({
        ...item,
        legendKey: item.label,
        displayLabel: item.label,
        selected: selectedMap[item.label] !== false,
      })),
    [legendItems, selectedMap],
  );

  const visibleTotal = useMemo(
    () =>
      mergedLegendItems.reduce(
        (sum, item) => (item.selected ? sum + item.value : sum),
        0,
      ),
    [mergedLegendItems],
  );

  const visibleTotalLabel = useMemo(() => {
    const allSelected = mergedLegendItems.every((item) => item.selected);
    return allSelected ? totalLabel : formatVisibleTotal(visibleTotal);
  }, [formatVisibleTotal, mergedLegendItems, totalLabel, visibleTotal]);

  const handleLegendSelectChanged = useCallback(
    (event: LegendSelectChangedEvent) => {
      setSelectedMap((previous) => {
        const nextSelected: Record<string, boolean> = {};

        legendItems.forEach((item) => {
          nextSelected[item.label] =
            event.selected[item.label] ?? previous[item.label] ?? true;
        });

        return nextSelected;
      });
    },
    [legendItems],
  );

  const toggleLegendSelection = useCallback((legendLabel: string) => {
    const chartInstance = chartRef.current?.getEchartsInstance();

    if (chartInstance) {
      chartInstance.dispatchAction({
        type: "legendToggleSelect",
        name: legendLabel,
      });
      return;
    }

    setSelectedMap((previous) => ({
      ...previous,
      [legendLabel]: previous[legendLabel] === false,
    }));
  }, []);

  const onLegendKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, legendLabel: string) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      toggleLegendSelection(legendLabel);
    },
    [toggleLegendSelection],
  );

  const onEvents = useMemo(
    () => ({
      legendselectchanged: handleLegendSelectChanged,
    }),
    [handleLegendSelectChanged],
  );

  const chartOption = useMemo(
    () => ({
      animation: true,
      animationDuration: 220,
      animationDurationUpdate: 220,
      legend: {
        show: false,
        selectedMode: true,
        data: mergedLegendItems.map((item) => item.displayLabel),
        selected: mergedLegendItems.reduce<Record<string, boolean>>(
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
        position: tooltipPosition,
        className: "financial-refunds__tooltip",
        formatter: formatRefundTooltip,
      },
      series: [
        {
          type: "pie",
          radius: ["85%", "100%"],
          center: ["50%", "50%"],
          minAngle: 3,
          stillShowZeroSum: true,
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scale: false },
          data: mergedLegendItems
            .filter((item) => item.value > 0)
            .map((item) => ({
              value: item.value,
              name: item.displayLabel,
              itemStyle: {
                color: item.color,
              },
            })),
        },
      ],
    }),
    [mergedLegendItems, tooltipPosition],
  );

  return (
    <div className="financial-refunds__stat-card">
      <div className="financial-refunds__stat-card-header">
        <span className="financial-refunds__stat-card-title">{title}</span>
        {showAed ? (
          <img
            src={reportsAnalyticsAedIcon}
            alt="AED"
            className="financial-refunds__stat-card-aed-icon"
          />
        ) : null}
        <Tooltip title={t("Finance.financialRefunds.statistics.onlyCompletedHint")}>
          <span
            className="financial-refunds__stat-card-info-trigger"
            aria-label={t("Finance.financialRefunds.statistics.onlyCompletedHint")}
          >
            <img src={reportsAnalyticsInfoIcon} alt="" />
          </span>
        </Tooltip>
      </div>
      <div className="financial-refunds__stat-card-content">
        <div className="financial-refunds__stat-card-chart-block">
          <div className="financial-refunds__stat-card-chart-shell">
            <ReactECharts
              ref={chartRef}
              className="financial-refunds__stat-card-chart"
              option={chartOption}
              notMerge={true}
              onEvents={onEvents}
            />
            <div className="financial-refunds__stat-card-center">
              <div className="financial-refunds__stat-card-total">
                {visibleTotalLabel}
              </div>
              <div className="financial-refunds__stat-card-total-label">
                {t("Finance.financialRefunds.statistics.total")}
              </div>
            </div>
          </div>
        </div>
        <div className="financial-refunds__stat-card-legend">
          {mergedLegendItems.map((item) => (
            <div
              className={`financial-refunds__stat-card-legend-item ${
                item.selected
                  ? ""
                  : "financial-refunds__stat-card-legend-item--inactive"
              }`}
              key={item.legendKey}
              role="button"
              tabIndex={0}
              aria-pressed={item.selected}
              onClick={() => toggleLegendSelection(item.displayLabel)}
              onKeyDown={(event) => onLegendKeyDown(event, item.displayLabel)}
            >
              <div className="financial-refunds__stat-card-legend-label">
                <span
                  className="financial-refunds__stat-card-legend-dot"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.displayLabel}</span>
              </div>
              <div className="financial-refunds__stat-card-legend-value">
                {item.valueText}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
