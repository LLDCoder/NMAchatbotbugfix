import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from "react";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Tabs, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import ClassNameECharts from "@/components/common/ClassNameECharts";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import aedPrefixIcon from "@/assets/Inspection/ReportsAnalytics/aed-prefix.svg";
import aiTriggeredHitRateBase from "@/assets/Inspection/ReportsAnalytics/ai-triggered-hit-rate-base.svg";
import aiTriggeredHitRateGradient from "@/assets/Inspection/ReportsAnalytics/ai-triggered-hit-rate-gradient.svg";
import appealsIcon from "@/assets/Inspection/ReportsAnalytics/appeals.svg";
import autoTriageIcon from "@/assets/Inspection/ReportsAnalytics/auto-triage.svg";
import avgRiskScoreIcon from "@/assets/Inspection/ReportsAnalytics/avg-risk-score.svg";
import confirmedAiFindingsIcon from "@/assets/Inspection/ReportsAnalytics/confirmed-ai-findings.svg";
import fineCollectedIcon from "@/assets/Inspection/ReportsAnalytics/fine-collected.svg";
import highCriticalRiskTasksIcon from "@/assets/Inspection/ReportsAnalytics/high-critical-risk-tasks.svg";
import highRiskProfilesIcon from "@/assets/Inspection/ReportsAnalytics/high-risk-profiles.svg";
import refundIcon from "@/assets/Inspection/ReportsAnalytics/refund.svg";
import riskTaskInfoCircle from "@/assets/Inspection/ReportsAnalytics/risk-task-info-circle.svg";
import riskTaskInfoGlyph from "@/assets/Inspection/ReportsAnalytics/risk-task-info-glyph.svg";
import tasksPerDayIcon from "@/assets/Inspection/ReportsAnalytics/tasks-per-day.svg";
import teamProcessingTimeIcon from "@/assets/Inspection/ReportsAnalytics/team-processing-time.svg";
import teamSlaBreachBaseIcon from "@/assets/Inspection/ReportsAnalytics/team-sla-breach-base.svg";
import teamSlaBreachOverlayIcon from "@/assets/Inspection/ReportsAnalytics/team-sla-breach-overlay.svg";
import teamSlaComplianceIcon from "@/assets/Inspection/ReportsAnalytics/team-sla-compliance.svg";
import totalInspectionsIcon from "@/assets/Inspection/ReportsAnalytics/total-inspections.svg";
import totalRiskTasksIcon from "@/assets/Inspection/ReportsAnalytics/total-risk-tasks.svg";
import violationsFoundIcon from "@/assets/Inspection/ReportsAnalytics/violations-found.svg";
import { COLORS, RISK_BAND_COLORS, RISK_BANDS } from "../constants";
import type {
  DonutData,
  GaugeData,
  HeatmapData,
  HorizontalBarItem,
  RiskBand,
  StackedDistributionRow,
  StatIconKey,
  SummaryCard,
  TrendData,
} from "../types";
import {
  formatAxisValue,
  formatCompactCount,
  formatCompactDecimal,
  formatCount,
  formatCurrency,
  formatDetailedValue,
  formatDuration,
  formatKpiValue,
  formatPercentage,
} from "../utils";

type AnalyticsCardProps = {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  headingClassName?: string;
  info?: string;
};

type TrendTooltipParam = CallbackDataParams & {
  axisValue?: string;
  axisValueLabel?: string;
};

type TrendTooltipVariant = "default" | "fine";

type LegendSelectChangedEvent = {
  selected: Record<string, boolean>;
};

type ChartLegendItem = {
  key: string;
  label: string;
  color: string;
  value: number;
  percentage?: number;
};

type SelectedChartLegendItem = ChartLegendItem & {
  selected: boolean;
};

type ChartLegendSelection = {
  chartRef: MutableRefObject<ClassNameECharts | null>;
  selectedItems: SelectedChartLegendItem[];
  selectedMap: Record<string, boolean>;
  selectedTotal: number;
  onEvents: {
    legendselectchanged: (event: LegendSelectChangedEvent) => void;
  };
  toggleLegendSelection: (item: ChartLegendItem) => void;
  onLegendKeyDown: (
    event: KeyboardEvent<HTMLElement>,
    item: ChartLegendItem,
  ) => void;
};

type TooltipContentSize = {
  contentSize?: [number, number];
  viewSize?: [number, number];
};

type IconTone = "gold" | "danger" | "warning" | "full";

type IconAssetConfig = {
  source: string;
  tone: IconTone;
  overlay?: string;
};

const summaryIconMap: Record<StatIconKey, IconAssetConfig> = {
  inspections: { source: totalInspectionsIcon, tone: "gold" },
  violations: { source: violationsFoundIcon, tone: "danger" },
  fine: { source: fineCollectedIcon, tone: "gold" },
  refund: { source: refundIcon, tone: "gold" },
  appeals: { source: appealsIcon, tone: "gold" },
  riskTasks: { source: totalRiskTasksIcon, tone: "gold" },
  confirmed: { source: confirmedAiFindingsIcon, tone: "full" },
  highRisk: { source: highCriticalRiskTasksIcon, tone: "danger" },
  profiles: { source: highRiskProfilesIcon, tone: "warning" },
  score: { source: avgRiskScoreIcon, tone: "gold" },
};

const teamSummaryIconMap: Record<string, IconAssetConfig> = {
  slaCompliance: { source: teamSlaComplianceIcon, tone: "gold" },
  slaBreached: {
    source: teamSlaBreachBaseIcon,
    overlay: teamSlaBreachOverlayIcon,
    tone: "gold",
  },
  avgProcessingTime: { source: teamProcessingTimeIcon, tone: "full" },
};

const SUMMARY_LABEL_KEYS: Record<string, string> = {
  totalInspections: "inspection.reportsAnalytics.metrics.totalInspections",
  violationsFound: "inspection.reportsAnalytics.metrics.violationsFound",
  fineCollected: "inspection.reportsAnalytics.metrics.fineCollected",
  refund: "inspection.reportsAnalytics.metrics.refund",
  appeals: "inspection.reportsAnalytics.metrics.appeals",
  totalRiskTasks: "inspection.reportsAnalytics.metrics.totalRiskTasks",
  confirmedAiFindings: "inspection.reportsAnalytics.metrics.confirmedAiFindings",
  highCriticalRiskTasks: "inspection.reportsAnalytics.metrics.highCriticalRiskTasks",
  highRiskProfiles: "inspection.reportsAnalytics.metrics.highRiskProfiles",
  avgRiskScore: "inspection.reportsAnalytics.metrics.avgRiskScore",
  slaCompliance: "inspection.reportsAnalytics.metrics.slaCompliance",
  slaBreached: "inspection.reportsAnalytics.metrics.slaBreached",
  avgProcessingTime: "inspection.reportsAnalytics.metrics.avgProcessingTime",
};

const DATA_LABEL_KEYS: Record<string, string> = {
  Queued: "inspection.reportsAnalytics.labels.queued",
  "Pending Visit": "inspection.reportsAnalytics.labels.pendingVisit",
  "In Progress": "inspection.reportsAnalytics.labels.inProgress",
  Completed: "inspection.reportsAnalytics.labels.completed",
  "Access Failed": "inspection.reportsAnalytics.labels.accessFailed",
  Cancelled: "inspection.reportsAnalytics.labels.cancelled",
  "Warning Issued": "inspection.reportsAnalytics.labels.warningIssued",
  "Pending Routing": "inspection.reportsAnalytics.labels.pendingRouting",
  "Pending Content Report": "inspection.reportsAnalytics.labels.pendingContentReport",
  "Pending Review": "inspection.reportsAnalytics.labels.pendingReview",
  "Pending Committee Decision": "inspection.reportsAnalytics.labels.pendingCommitteeDecision",
  "Pending Approval": "inspection.reportsAnalytics.labels.pendingApproval",
  "Pending Payment": "inspection.reportsAnalytics.labels.pendingPayment",
  "Under Appeal": "inspection.reportsAnalytics.labels.underAppeal",
  Paid: "inspection.reportsAnalytics.labels.paid",
  "Violation Maintained": "inspection.reportsAnalytics.labels.violationMaintained",
  "Violation Modified": "inspection.reportsAnalytics.labels.violationModified",
  "Violation Cancelled": "inspection.reportsAnalytics.labels.violationCancelled",
  Critical: "inspection.reportsAnalytics.labels.critical",
  High: "inspection.reportsAnalytics.labels.high",
  Medium: "inspection.reportsAnalytics.labels.medium",
  Low: "inspection.reportsAnalytics.labels.low",
  "All Risk Tasks": "inspection.reportsAnalytics.labels.allRiskTasks",
  "AI-Generated Tasks": "inspection.reportsAnalytics.labels.aiGeneratedTasks",
  "Officer-Initiated Tasks": "inspection.reportsAnalytics.labels.officerInitiatedTasks",
  Outstanding: "inspection.reportsAnalytics.labels.outstanding",
  Hits: "inspection.reportsAnalytics.labels.hits",
  Inspections: "inspection.reportsAnalytics.labels.inspections",
  "Total Violations": "inspection.reportsAnalytics.labels.totalViolations",
  "Content Violations": "inspection.reportsAnalytics.labels.contentViolations",
  "License Violations": "inspection.reportsAnalytics.labels.licenseViolations",
  Appeals: "inspection.reportsAnalytics.labels.appeals",
  "SLA Compliance": "inspection.reportsAnalytics.labels.slaCompliance",
  "Avg. Processing Time": "inspection.reportsAnalytics.labels.avgProcessingTime",
  "License Fine": "inspection.reportsAnalytics.labels.licenseFine",
  "Content Fine": "inspection.reportsAnalytics.labels.contentFine",
  "Total Fine": "inspection.reportsAnalytics.labels.totalFine",
  "First Degree": "inspection.reportsAnalytics.labels.firstDegree",
  "Second Degree": "inspection.reportsAnalytics.labels.secondDegree",
  "Third Degree": "inspection.reportsAnalytics.labels.thirdDegree",
  "Fourth Degree": "inspection.reportsAnalytics.labels.fourthDegree",
};

const getPercentage = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const joinClassNames = (...values: Array<string | undefined>) =>
  values.filter(Boolean).join(" ");

const hasTrendData = (data: TrendData) =>
  data.categories.length > 0 && data.series.length > 0;

const hasGaugeData = (data: GaugeData) => data.isAvailable;

const hasHeatmapData = (data: HeatmapData) =>
  data.reasons.length > 0 &&
  data.emirates.length > 0 &&
  data.values.length > 0;

const createLegendSelectionMap = (items: ChartLegendItem[]) =>
  items.reduce<Record<string, boolean>>((result, item) => {
    result[item.key] = true;
    return result;
  }, {});

function useChartLegendSelection(
  items: ChartLegendItem[],
): ChartLegendSelection {
  const chartRef = useRef<ClassNameECharts | null>(null);
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() =>
    createLegendSelectionMap(items),
  );
  const signature = useMemo(
    () =>
      items
        .map(
          (item) =>
            `${item.key}:${item.label}:${item.value}:${item.percentage ?? ""}:${item.color}`,
        )
        .join("|"),
    [items],
  );

  useEffect(() => {
    setSelectedMap(createLegendSelectionMap(items));
  }, [items, signature]);

  const selectedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        selected: selectedMap[item.key] !== false,
      })),
    [items, selectedMap],
  );
  const selectedTotal = useMemo(
    () =>
      selectedItems.reduce(
        (total, item) => (item.selected ? total + item.value : total),
        0,
      ),
    [selectedItems],
  );

  const handleLegendSelectChanged = useCallback(
    (event: LegendSelectChangedEvent) => {
      setSelectedMap((previous) =>
        items.reduce<Record<string, boolean>>((next, item) => {
          next[item.key] = event.selected[item.label] ?? previous[item.key] ?? true;
          return next;
        }, {}),
      );
    },
    [items],
  );

  const toggleLegendSelection = useCallback((item: ChartLegendItem) => {
    const chartInstance = chartRef.current?.getEchartsInstance();

    if (chartInstance) {
      chartInstance.dispatchAction({
        type: "legendToggleSelect",
        name: item.label,
      });
      return;
    }

    setSelectedMap((previous) => ({
      ...previous,
      [item.key]: previous[item.key] === false,
    }));
  }, []);

  const onLegendKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, item: ChartLegendItem) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      toggleLegendSelection(item);
    },
    [toggleLegendSelection],
  );

  const onEvents = useMemo(
    () => ({ legendselectchanged: handleLegendSelectChanged }),
    [handleLegendSelectChanged],
  );

  return {
    chartRef,
    selectedItems,
    selectedMap,
    selectedTotal,
    onEvents,
    toggleLegendSelection,
    onLegendKeyDown,
  };
}

function useTrendChartResize(
  chartRef: MutableRefObject<ClassNameECharts | null>,
  enabled: boolean,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const firstFrameRef = useRef<number | null>(null);
  const secondFrameRef = useRef<number | null>(null);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const cancelScheduledResize = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (firstFrameRef.current !== null) {
        window.cancelAnimationFrame(firstFrameRef.current);
        firstFrameRef.current = null;
      }

      if (secondFrameRef.current !== null) {
        window.cancelAnimationFrame(secondFrameRef.current);
        secondFrameRef.current = null;
      }
    };

    const resizeChart = (force = false) => {
      const container = containerRef.current;
      const chartInstance = chartRef.current?.getEchartsInstance();

      if (!container || !chartInstance) {
        return;
      }

      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) {
        return;
      }

      const nextSize = { width: Math.round(width), height: Math.round(height) };
      const lastSize = lastSizeRef.current;
      if (
        !force &&
        lastSize &&
        lastSize.width === nextSize.width &&
        lastSize.height === nextSize.height
      ) {
        return;
      }

      chartInstance.resize(nextSize);
      lastSizeRef.current = nextSize;
    };

    const scheduleResize = (force = false) => {
      if (!enabled) {
        return;
      }

      cancelScheduledResize();
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        firstFrameRef.current = window.requestAnimationFrame(() => {
          firstFrameRef.current = null;
          secondFrameRef.current = window.requestAnimationFrame(() => {
            secondFrameRef.current = null;
            resizeChart(force);
          });
        });
      }, 0);
    };

    const container = containerRef.current;
    if (!enabled || !container) {
      cancelScheduledResize();
      return undefined;
    }

    const card = container.closest(".inspection-reports__card");
    const handleWindowResize = () => scheduleResize();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => scheduleResize());

    observer?.observe(container);
    if (card && card !== container) {
      observer?.observe(card);
    }
    window.addEventListener("resize", handleWindowResize);
    lastSizeRef.current = null;
    scheduleResize(true);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      cancelScheduledResize();
    };
  }, [chartRef, enabled]);

  return containerRef;
}

const getChartTooltipPosition = (
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
  const clamp = (left: number, top: number): [number, number] => [
    Math.min(Math.max(spacing, left), maxLeft),
    Math.min(Math.max(topSpacing, top), maxTop),
  ];
  const overlapsPoint = ([left, top]: [number, number]) =>
    pointX >= left &&
    pointX <= left + contentWidth &&
    pointY >= top &&
    pointY <= top + contentHeight;
  const candidates: [number, number][] = [
    clamp(pointX + spacing, pointY + spacing),
    clamp(pointX + spacing, pointY - contentHeight - spacing),
    clamp(pointX - contentWidth - spacing, pointY + spacing),
    clamp(pointX - contentWidth - spacing, pointY - contentHeight - spacing),
  ];

  return candidates.find((candidate) => !overlapsPoint(candidate)) ?? candidates[0];
};

function ChartEmptyState() {
  return (
    <div className="inspection-reports__chart-empty">
      <EmptyBox />
    </div>
  );
}

export function AnalyticsCard({
  title,
  children,
  className,
  headingClassName,
  info,
}: AnalyticsCardProps) {
  return (
    <section className={joinClassNames("inspection-reports__card", className)}>
      <div className={joinClassNames("inspection-reports__card-heading", headingClassName)}>
        <h2>{title}</h2>
        {info ? (
          <Tooltip title={info}>
            <InfoIndicator />
          </Tooltip>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function CurrencyUnitTitle({ children }: { children: ReactNode }) {
  return (
    <span className="inspection-reports__currency-unit-title">
      <span>{children}(</span>
      <img src={aedPrefixIcon} alt="AED" />
      <span>)</span>
    </span>
  );
}

function InfoIndicator({ className }: { className?: string }) {
  return (
    <InfoCircleOutlined
      className={joinClassNames("inspection-reports__info-indicator", className)}
      aria-hidden="true"
    />
  );
}

const RiskTaskInfoIndicator = forwardRef<
  HTMLButtonElement,
  { label: string } & ButtonHTMLAttributes<HTMLButtonElement>
>(({ label, ...buttonProps }, ref) => (
  <button
    {...buttonProps}
    ref={ref}
    type="button"
    className="inspection-reports__summary-info-button"
    aria-label={label}
  >
    <img
      className="inspection-reports__summary-info-circle"
      src={riskTaskInfoCircle}
      alt=""
      aria-hidden="true"
    />
    <img
      className="inspection-reports__summary-info-glyph"
      src={riskTaskInfoGlyph}
      alt=""
      aria-hidden="true"
    />
  </button>
));

RiskTaskInfoIndicator.displayName = "RiskTaskInfoIndicator";

function AssetIcon({
  config,
  className,
}: {
  config: IconAssetConfig;
  className: string;
}) {
  return (
    <span className={joinClassNames(className, `${className}--${config.tone}`)}>
      <img src={config.source} alt="" aria-hidden="true" />
      {config.overlay ? <img src={config.overlay} alt="" aria-hidden="true" /> : null}
    </span>
  );
}

function SummaryValue({ item }: { item: SummaryCard }) {
  if (item.format === "currency") {
    const value = formatKpiValue(item.value, item.format)
      .replace(/^AED\s/, "")
      .replace(/\.0(?=[KM]$)/, "");

    return (
      <div className="inspection-reports__summary-value inspection-reports__summary-value--currency">
        <img src={aedPrefixIcon} alt="AED" />
        <strong>{value}</strong>
      </div>
    );
  }

  if (item.format === "score") {
    const [value, maximum] = formatKpiValue(item.value, item.format).split("/");
    return (
      <div className="inspection-reports__summary-value inspection-reports__summary-value--score">
        <strong>{value}</strong>
        <small>/{maximum}</small>
      </div>
    );
  }

  return (
    <div className="inspection-reports__summary-value">
      <strong>{formatKpiValue(item.value, item.format)}</strong>
    </div>
  );
}

export function SummaryCards({ items }: { items: SummaryCard[] }) {
  const { t } = useTranslation();

  return (
    <div className="inspection-reports__summary-grid">
      {items.map((item) => {
        const iconConfig = summaryIconMap[item.icon as StatIconKey];
        return (
          <article key={item.key} className="inspection-reports__summary-card">
            <AssetIcon config={iconConfig} className="inspection-reports__summary-icon" />
            <div className="inspection-reports__summary-copy">
              <SummaryValue item={item} />
              <div className="inspection-reports__summary-label">
                <span>{SUMMARY_LABEL_KEYS[item.key] ? t(SUMMARY_LABEL_KEYS[item.key]) : item.label}</span>
                {item.key === "totalRiskTasks" ? (
                  <Tooltip
                    title={t("inspection.reportsAnalytics.tooltips.totalRiskTasks")}
                    trigger={["hover", "focus", "click"]}
                  >
                    <RiskTaskInfoIndicator
                      label={t("inspection.reportsAnalytics.tooltips.totalRiskTasks")}
                    />
                  </Tooltip>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function DonutCenter({ value, label }: { value: string; label: string }) {
  return (
    <div className="inspection-reports__donut-center" aria-hidden="true">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function DonutVisual({
  data,
  selection,
  className,
  formatValue = formatCount,
}: {
  data: DonutData;
  selection: ChartLegendSelection;
  className?: string;
  formatValue?: (value: number) => string;
}) {
  const { t } = useTranslation();
  const option = useMemo(() => {
    const hasData = data.items.some((item) => item.value > 0);
    return {
      animationDuration: 240,
      animationDurationUpdate: 240,
      legend: {
        show: false,
        selectedMode: true,
        data: selection.selectedItems.map((item) => item.label),
        selected: selection.selectedItems.reduce<Record<string, boolean>>(
          (result, item) => {
            result[item.label] = item.selected;
            return result;
          },
          {},
        ),
      },
      tooltip: hasData
        ? {
            trigger: "item" as const,
            renderMode: "html" as const,
            appendTo: "body" as const,
            confine: false,
            className: "inspection-reports__donut-tooltip",
            backgroundColor: "transparent",
            borderWidth: 0,
            padding: 0,
            formatter: createDonutTooltip(formatValue, selection.selectedItems),
          }
        : { show: false },
      series: [
        {
          type: "pie",
          radius: ["80%", "100%"],
          center: ["50%", "50%"],
          minAngle: 3,
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scale: false },
          data: hasData
            ? selection.selectedItems
                .filter((item) => item.value > 0)
                .map((item) => ({
                  name: item.label,
                  value: item.value,
                  itemStyle: { color: item.color },
                }))
            : [
                {
                  name: t("common.noData"),
                  value: 1,
                  itemStyle: { color: "#EDEFF2" },
                },
              ],
        },
      ],
    };
  }, [data, formatValue, selection.selectedItems, t]);

  return (
    <div className={joinClassNames("inspection-reports__donut-visual", className)}>
      <ClassNameECharts
        ref={selection.chartRef as unknown as Ref<ClassNameECharts>}
        option={option}
        style={{ width: "100%", height: "100%" }}
        onEvents={selection.onEvents}
      />
      <DonutCenter
        value={formatCompactCount(selection.selectedTotal)}
        label={t("inspection.reportsAnalytics.metrics.total")}
      />
    </div>
  );
}

function DonutLegend({
  selection,
  total,
  formatValue = formatCompactCount,
}: {
  selection: ChartLegendSelection;
  total: number;
  formatValue?: (value: number) => string;
}) {
  return (
    <div className="inspection-reports__donut-legend">
      {selection.selectedItems.map((item) => (
        <div
          key={item.key}
          className={joinClassNames(
            "inspection-reports__donut-legend-row",
            !item.selected ? "inspection-reports__donut-legend-row--inactive" : undefined,
          )}
          role="button"
          tabIndex={0}
          aria-pressed={item.selected}
          onClick={() => selection.toggleLegendSelection(item)}
          onKeyDown={(event) => selection.onLegendKeyDown(event, item)}
        >
          <span className="inspection-reports__donut-legend-name">
            <i style={{ backgroundColor: item.color }} />
            <span className="inspection-reports__donut-legend-label-text">{item.label}</span>
          </span>
          <span className="inspection-reports__donut-legend-value">
            <b>{formatValue(item.value)}</b>
            <small>
              {formatPercentage(item.percentage ?? getPercentage(item.value, total), 2)}
            </small>
          </span>
        </div>
      ))}
    </div>
  );
}

export function DonutChartCard({
  title,
  data,
  className,
}: {
  title: string;
  data: DonutData;
  className?: string;
}) {
  const { t } = useTranslation();
  const hasData = data.items.length > 0;
  const legendItems = useMemo<ChartLegendItem[]>(
    () =>
      data.items.map((item) => ({
        key: item.label,
        label: DATA_LABEL_KEYS[item.label] ? t(DATA_LABEL_KEYS[item.label]) : item.label,
        color: item.color,
        value: item.value,
        percentage: item.percentage,
      })),
    [data.items, t],
  );
  const selection = useChartLegendSelection(legendItems);

  return (
    <AnalyticsCard title={title} className={joinClassNames("inspection-reports__donut-card", className)}>
      {hasData ? (
        <>
          <DonutVisual data={data} selection={selection} />
          <DonutLegend selection={selection} total={data.total} />
        </>
      ) : (
        <ChartEmptyState />
      )}
    </AnalyticsCard>
  );
}

const escapeTooltipText = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      "\"": "&quot;",
    };
    return entities[character];
  });

const createDonutTooltip = (
  formatValue: (value: number) => string,
  items: DonutData["items"] = [],
) => {
  const percentagesByLabel = new Map(
    items
      .filter((item) => Number.isFinite(item.percentage))
      .map((item) => [item.label, item.percentage as number]),
  );

  return (params: CallbackDataParams) => {
    const label = escapeTooltipText(String(params.name || ""));
    const value = formatValue(Number(params.value || 0));
    const percentage = formatPercentage(
      percentagesByLabel.get(String(params.name || "")) ?? Number(params.percent || 0),
      2,
    );
    const color = typeof params.color === "string" ? params.color : "#A0D5AB";

    return [
      '<div class="inspection-reports__donut-tooltip-content">',
      `<span class="inspection-reports__donut-tooltip-marker" style="background-color:${color};"></span>`,
      `<span class="inspection-reports__donut-tooltip-text">${label}: ${escapeTooltipText(value)} (${percentage})</span>`,
      "</div>",
    ].join("");
  };
};

const getFineTrendTooltipMarkerClassName = (seriesName: string) => {
  if (seriesName === "License Fine") {
    return "inspection-reports__fine-trend-tooltip-marker--license";
  }
  if (seriesName === "Content Fine") {
    return "inspection-reports__fine-trend-tooltip-marker--content";
  }
  return "inspection-reports__fine-trend-tooltip-marker--total";
};

const createFineTrendTooltip = (
  data: TrendData,
  translateLabel: (label: string) => string,
) => (
  params: CallbackDataParams | CallbackDataParams[],
) => {
  const rows = Array.isArray(params) ? params : [params];
  const first = rows[0] as TrendTooltipParam | undefined;
  const date = escapeTooltipText(String(first?.axisValueLabel || first?.axisValue || ""));
  const values = rows.map((item) => {
    const tooltipItem = item as TrendTooltipParam;
    const name = escapeTooltipText(translateLabel(tooltipItem.seriesName || ""));
    const value = formatDetailedValue(Number(tooltipItem.value || 0), data.format);
    const markerClassName = getFineTrendTooltipMarkerClassName(tooltipItem.seriesName || "");

    return [
      '<div class="inspection-reports__fine-trend-tooltip-row">',
      `<i class="inspection-reports__fine-trend-tooltip-marker ${markerClassName}"></i>`,
      `<span>${name}: <b>${escapeTooltipText(value)}</b></span>`,
      "</div>",
    ].join("");
  });

  return [
    '<div class="inspection-reports__fine-trend-tooltip-date">',
    date,
    "</div>",
    ...values,
  ].join("");
};

const createTrendTooltip = (
  data: TrendData,
  translateLabel: (label: string) => string,
) => (
  params: CallbackDataParams | CallbackDataParams[],
) => {
  const rows = Array.isArray(params) ? params : [params];
  const first = rows[0] as TrendTooltipParam | undefined;
  const title = escapeTooltipText(
    String(first?.axisValueLabel || first?.axisValue || first?.name || ""),
  );
  const values = rows.map((item) => {
    const tooltipItem = item as TrendTooltipParam;
    const series = data.series.find((entry) => entry.name === tooltipItem.seriesName);
    const value =
      series?.yAxisIndex === 1
        ? formatDuration(Number(tooltipItem.value || 0))
        : formatDetailedValue(Number(tooltipItem.value || 0), data.format);
    const color = typeof tooltipItem.color === "string" ? tooltipItem.color : "#A0D5AB";
    const name = escapeTooltipText(
      translateLabel(tooltipItem.seriesName || tooltipItem.name || ""),
    );

    return [
      '<div class="inspection-reports__trend-tooltip-row">',
      '<span class="inspection-reports__trend-tooltip-series">',
      `<i class="inspection-reports__trend-tooltip-marker" style="background-color:${color};"></i>`,
      `<span class="inspection-reports__trend-tooltip-label">${name}</span>`,
      "</span>",
      `<span class="inspection-reports__trend-tooltip-value">${escapeTooltipText(value)}</span>`,
      "</div>",
    ].join("");
  });

  return [
    '<div class="inspection-reports__trend-tooltip-content">',
    `<div class="inspection-reports__trend-tooltip-title">${title}</div>`,
    ...values,
    "</div>",
  ].join("");
};

function TrendLegend({
  data,
  selection,
}: {
  data: TrendData;
  selection: ChartLegendSelection;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="inspection-reports__trend-legend"
      aria-label={t("inspection.reportsAnalytics.aria.chartLegend")}
    >
      {data.series.map((series) => {
        const item: ChartLegendItem = {
          key: series.name,
          label: series.name,
          color: series.color,
          value: sum(series.values),
        };
        const selected = selection.selectedMap[item.key] !== false;

        return (
          <span
            key={series.name}
            className={joinClassNames(
              "inspection-reports__trend-legend-item",
              !selected
                ? "inspection-reports__trend-legend-item--inactive"
                : undefined,
            )}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            onClick={() => selection.toggleLegendSelection(item)}
            onKeyDown={(event) => selection.onLegendKeyDown(event, item)}
          >
            <i
              className={joinClassNames(
                "inspection-reports__trend-legend-marker",
                `inspection-reports__trend-legend-marker--${
                  series.type === "bar"
                    ? "bar"
                    : series.lineType === "dashed"
                      ? "dashed-line"
                      : "line"
                }`,
              )}
              style={{ "--trend-color": series.color } as CSSProperties}
            />
            {DATA_LABEL_KEYS[series.name] ? t(DATA_LABEL_KEYS[series.name]) : series.name}
          </span>
        );
      })}
    </div>
  );
}

function TrendVisual({
  data,
  dualAxis = false,
  className,
  tooltipVariant = "default",
}: {
  data: TrendData;
  dualAxis?: boolean;
  className?: string;
  tooltipVariant?: TrendTooltipVariant;
}) {
  const { t } = useTranslation();
  const translateLabel = useCallback(
    (label: string) => DATA_LABEL_KEYS[label] ? t(DATA_LABEL_KEYS[label]) : label,
    [t],
  );
  const legendItems = useMemo<ChartLegendItem[]>(
    () =>
      data.series.map((series) => ({
        key: series.name,
        label: series.name,
        color: series.color,
        value: sum(series.values),
      })),
    [data.series],
  );
  const selection = useChartLegendSelection(legendItems);
  const hasData = hasTrendData(data);
  const trendCanvasRef = useTrendChartResize(selection.chartRef, hasData);
  const displayedSeries = useMemo(
    () =>
      data.series.map((series) => ({
        ...series,
        selected: selection.selectedMap[series.name] !== false,
      })),
    [data.series, selection.selectedMap],
  );
  const option = useMemo(() => {
    const hasBars = displayedSeries.some((series) => series.type === "bar");
    const hasFineTooltip = tooltipVariant === "fine";
    const tooltip = hasFineTooltip
      ? {
          trigger: "axis" as const,
          renderMode: "html" as const,
          className: "inspection-reports__fine-trend-tooltip",
          confine: true,
          padding: 0,
          backgroundColor: "#FFFFFF",
          borderWidth: 0,
          textStyle: { color: "#5F646D", fontFamily: "Inter", fontSize: 14 },
          axisPointer: {
            type: "shadow" as const,
            z: -1,
            shadowStyle: { color: "#F7F7F8" },
          },
          formatter: createFineTrendTooltip(data, translateLabel),
        }
      : {
          trigger: "axis" as const,
          renderMode: "html" as const,
          appendTo: "body" as const,
          confine: false,
          position: getChartTooltipPosition,
          className: "inspection-reports__trend-tooltip",
          backgroundColor: "transparent",
          borderWidth: 0,
          padding: 0,
          formatter: createTrendTooltip(data, translateLabel),
        };

    return {
      animationDuration: 240,
      animationDurationUpdate: 240,
      color: displayedSeries.map((series) => series.color),
      tooltip,
      legend: {
        show: false,
        selectedMode: true,
        data: displayedSeries.map((series) => series.name),
        selected: displayedSeries.reduce<Record<string, boolean>>(
          (result, series) => {
            result[series.name] = series.selected;
            return result;
          },
          {},
        ),
      },
      grid: {
        top: 6,
        right: dualAxis ? 52 : 24,
        bottom: 0,
        left: data.format === "currency" ? 32 : 24,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: hasBars,
        data: data.categories,
        axisLine: { lineStyle: { color: "#E1E3E5" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#5F646D",
          fontSize: 12,
          lineHeight: 18,
          margin: 12,
          ...(hasBars
            ? {
                align: "center",
                alignMinLabel: "center",
                alignMaxLabel: "center",
              }
            : {
                alignMinLabel: "left",
                alignMaxLabel: "right",
              }),
          showMinLabel: true,
          showMaxLabel: true,
          hideOverlap: true,
        },
      },
      yAxis: dualAxis
        ? [
            {
              type: "value",
              min: 0,
              max: 100,
              interval: 20,
              axisLabel: { color: "#9EA2A9", fontSize: 12, lineHeight: 18, formatter: "{value}%" },
              splitLine: { lineStyle: { color: "#E1E3E5", type: "dashed" } },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            {
              type: "value",
              axisLabel: {
                color: "#9EA2A9",
                fontSize: 12,
                lineHeight: 18,
                formatter: (value: number) => formatDuration(value),
              },
              splitLine: { show: false },
              axisLine: { show: false },
              axisTick: { show: false },
            },
          ]
        : {
            type: "value",
            min: 0,
            axisLabel: {
              color: "#9EA2A9",
              fontSize: 12,
              lineHeight: 18,
              formatter: (value: number) => formatAxisValue(value, data.format),
            },
            splitLine: { lineStyle: { color: "#E1E3E5", type: "dashed" } },
            axisLine: { show: false },
            axisTick: { show: false },
          },
      series: displayedSeries.map((series) => ({
        name: series.name,
        type: series.type || "line",
        stack: series.stack,
        yAxisIndex: series.yAxisIndex || 0,
        data: series.values,
        smooth: series.type !== "bar",
        showSymbol: false,
        symbol: "circle",
        symbolSize: 6,
        barMaxWidth: series.type === "bar" && data.format === "currency" ? 16 : 24,
        barWidth: series.type === "bar" && data.format === "currency" ? 16 : undefined,
        barGap: series.type === "bar" && data.format === "currency" ? "50%" : undefined,
        itemStyle: {
          color: series.color,
          borderRadius:
            series.type === "bar" && data.format === "currency" ? [6, 6, 6, 6] : [3, 3, 0, 0],
        },
        lineStyle: { width: 2, color: series.color, type: series.lineType || "solid" },
        areaStyle: series.areaColor ? { color: series.areaColor } : undefined,
      })),
    };
  }, [data, displayedSeries, dualAxis, tooltipVariant, translateLabel]);

  if (!hasData) {
    return (
      <div className={joinClassNames("inspection-reports__trend-visual", className)}>
        <ChartEmptyState />
      </div>
    );
  }

  return (
    <div className={joinClassNames("inspection-reports__trend-visual", className)}>
      <TrendLegend data={data} selection={selection} />
      <div ref={trendCanvasRef} className="inspection-reports__trend-canvas">
        <ClassNameECharts
          ref={selection.chartRef as unknown as Ref<ClassNameECharts>}
          option={option}
          style={{ width: "100%", height: "100%" }}
          onEvents={selection.onEvents}
        />
      </div>
    </div>
  );
}

export function TrendChartCard({
  title,
  data,
  className,
  headingClassName,
  visualClassName,
  tooltipVariant,
}: {
  title: ReactNode;
  data: TrendData;
  className?: string;
  headingClassName?: string;
  visualClassName?: string;
  tooltipVariant?: TrendTooltipVariant;
}) {
  return (
    <AnalyticsCard
      title={title}
      className={joinClassNames("inspection-reports__trend-card", className)}
      headingClassName={headingClassName}
    >
      <TrendVisual data={data} className={visualClassName} tooltipVariant={tooltipVariant} />
    </AnalyticsCard>
  );
}

type TabbedTrendItem = {
  key: string;
  title: ReactNode;
  data: TrendData;
};

export function TabbedTrendChartCard({ items }: { items: TabbedTrendItem[] }) {
  const [activeKey, setActiveKey] = useState(items[0]?.key || "");
  const activeItem = items.find((item) => item.key === activeKey) || items[0];

  if (!activeItem) return null;

  return (
    <section className="inspection-reports__card inspection-reports__tabbed-trend-card">
      <Tabs
        activeKey={activeItem.key}
        className="inspection-reports__tabbed-trend-tabs"
        animated={false}
        onChange={setActiveKey}
      >
        {items.map((item) => (
          <Tabs.TabPane tab={item.title} key={item.key} />
        ))}
      </Tabs>
      <TrendVisual data={activeItem.data} className="inspection-reports__trend-visual--compact" />
    </section>
  );
}

export function TeamPerformanceTrendCard({
  summary,
  data,
}: {
  summary: SummaryCard[];
  data: TrendData;
}) {
  const { t } = useTranslation();

  return (
    <AnalyticsCard
      title={t("inspection.reportsAnalytics.titles.teamPerformanceTrend")}
      className="inspection-reports__team-trend-card"
    >
      <div className="inspection-reports__team-summary">
        {summary.map((item) => {
          const iconConfig = teamSummaryIconMap[item.key] || summaryIconMap[item.icon as StatIconKey];
          return (
            <div key={item.key} className="inspection-reports__team-summary-card">
              <AssetIcon config={iconConfig} className="inspection-reports__team-summary-icon" />
              <div>
                <strong>{formatKpiValue(item.value, item.format)}</strong>
                <span>{SUMMARY_LABEL_KEYS[item.key] ? t(SUMMARY_LABEL_KEYS[item.key]) : item.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      <TrendVisual data={data} dualAxis />
    </AnalyticsCard>
  );
}

const HEATMAP_COLORS = {
  blue: ["#D3EDFF", "#B0DBFF", "#81C1FF", "#4F98FF", "#286CFF", "#043DFF", "#002DC2"],
  orange: ["#FCE9D8", "#F9CFAF", "#F5AC7C", "#EF8048", "#EB5F24", "#E54B1D", "#B2550B"],
} as const;

const getHeatmapColor = (
  value: number,
  maximum: number,
  colors: readonly string[],
) => {
  if (value <= 0) return colors[0];
  const index = Math.min(colors.length - 1, Math.max(1, Math.ceil((value / maximum) * (colors.length - 1))));
  return colors[index];
};

export function HeatmapCard({
  title,
  data,
  className,
}: {
  title: string;
  data: HeatmapData;
  className?: string;
}) {
  const { t } = useTranslation();
  const maximum = Math.max(...data.values.map((item) => item[2]), 1);
  const values = useMemo(
    () => new Map(data.values.map(([reasonIndex, emirateIndex, value]) => [`${reasonIndex}:${emirateIndex}`, value])),
    [data.values],
  );
  const heatmapGridStyle = useMemo(
    () =>
      ({
        "--heatmap-column-count": Math.max(data.emirates.length, 1),
      }) as CSSProperties,
    [data.emirates.length],
  );
  const colors = HEATMAP_COLORS[data.color];
  const hasData = hasHeatmapData(data);

  return (
    <AnalyticsCard
      title={title}
      className={joinClassNames("inspection-reports__heatmap-card", className)}
    >
      {hasData ? (
        <div className={`inspection-reports__heatmap-visual inspection-reports__heatmap-visual--${data.color}`}>
          <div className="inspection-reports__heatmap-content" style={heatmapGridStyle}>
            <div className="inspection-reports__heatmap-rows">
              {data.reasons.map((reason, reasonIndex) => {
                const rowValues = data.emirates.map(
                  (_emirate, emirateIndex) => values.get(`${reasonIndex}:${emirateIndex}`) || 0,
                );

                return (
                  <div key={reason} className="inspection-reports__heatmap-row">
                    <span className="inspection-reports__heatmap-reason" title={reason}>
                      {reason}
                    </span>
                    <div className="inspection-reports__heatmap-cells">
                      {rowValues.map((value, emirateIndex) => (
                        <span
                          key={`${reason}-${data.emirates[emirateIndex]}`}
                          className="inspection-reports__heatmap-cell"
                          style={{ backgroundColor: getHeatmapColor(value, maximum, colors) }}
                          title={`${data.emirates[emirateIndex]}: ${formatCount(value)}`}
                        >
                          {formatCompactCount(value)}
                        </span>
                      ))}
                    </div>
                    <strong>{formatCompactCount(data.totals[reasonIndex]?.value ?? sum(rowValues))}</strong>
                  </div>
                );
              })}
            </div>
            <div className="inspection-reports__heatmap-axis">
              <span />
              <div>
                {data.emirates.map((emirate) => (
                  <span key={emirate}>{emirate}</span>
                ))}
              </div>
              <strong>{t("inspection.reportsAnalytics.metrics.total")}</strong>
            </div>
            <div className="inspection-reports__heatmap-scale">
              <span aria-hidden="true" />
              <div>
                <span>{`0-${formatCompactCount(maximum)}`}</span>
                <i />
              </div>
              <span aria-hidden="true" />
            </div>
          </div>
        </div>
      ) : (
        <ChartEmptyState />
      )}
    </AnalyticsCard>
  );
}

function FineCollectionVisual({
  data,
  selection,
}: {
  data: GaugeData;
  selection: ChartLegendSelection;
}) {
  const { t } = useTranslation();
  const option = useMemo(
    () => {
      const hasValues = selection.selectedItems.some((item) => item.value > 0);

      return {
        animationDuration: 240,
        legend: {
          show: false,
          selectedMode: true,
          data: selection.selectedItems.map((item) => item.label),
          selected: selection.selectedItems.reduce<Record<string, boolean>>(
            (result, item) => {
              result[item.label] = item.selected;
              return result;
            },
            {},
          ),
        },
        tooltip: hasValues
          ? {
              trigger: "item" as const,
              renderMode: "html" as const,
              appendTo: "body" as const,
              confine: false,
              className: "inspection-reports__donut-tooltip",
              backgroundColor: "transparent",
              borderWidth: 0,
              padding: 0,
              formatter: createDonutTooltip(formatCurrency, selection.selectedItems),
            }
          : { show: false },
        series: [
          {
            type: "pie",
            radius: ["80%", "100%"],
            center: ["50%", "50%"],
            minAngle: 3,
            avoidLabelOverlap: true,
            label: { show: false },
            labelLine: { show: false },
            emphasis: { scale: false },
            data: selection.selectedItems
              .filter((item) => item.value > 0)
              .map((item) => ({
                name: item.label,
                value: item.value,
                itemStyle: { color: item.color },
              })),
          },
        ],
      };
    },
    [selection.selectedItems],
  );

  return (
    <div className="inspection-reports__fine-collection-visual">
      <ClassNameECharts
        ref={selection.chartRef as unknown as Ref<ClassNameECharts>}
        option={option}
        style={{ width: "100%", height: "100%" }}
        onEvents={selection.onEvents}
      />
      <DonutCenter
        value={formatPercentage(data.value, 1)}
        label={t("inspection.reportsAnalytics.metrics.collected")}
      />
    </div>
  );
}

export function FineCollectionCard({ data }: { data: GaugeData }) {
  const { t } = useTranslation();
  const total = data.primaryValue + data.secondaryValue;
  const hasData = hasGaugeData(data);
  const legendItems = useMemo<ChartLegendItem[]>(
    () => [
      {
        key: data.primaryLabel,
        label: DATA_LABEL_KEYS[data.primaryLabel]
          ? t(DATA_LABEL_KEYS[data.primaryLabel])
          : data.primaryLabel,
        value: data.primaryValue,
        color: COLORS.green,
      },
      {
        key: data.secondaryLabel,
        label: DATA_LABEL_KEYS[data.secondaryLabel]
          ? t(DATA_LABEL_KEYS[data.secondaryLabel])
          : data.secondaryLabel,
        value: data.secondaryValue,
        color: COLORS.yellow,
      },
    ],
    [data.primaryLabel, data.primaryValue, data.secondaryLabel, data.secondaryValue, t],
  );
  const selection = useChartLegendSelection(legendItems);

  return (
    <AnalyticsCard
      title={t("inspection.reportsAnalytics.titles.fineCollection")}
      className="inspection-reports__fine-collection-card"
    >
      {hasData ? (
        <>
          <FineCollectionVisual data={data} selection={selection} />
          <DonutLegend
            selection={selection}
            total={total}
            formatValue={(value) => formatCurrency(value, true)}
          />
        </>
      ) : (
        <ChartEmptyState />
      )}
    </AnalyticsCard>
  );
}

function GaugeVisual({ data }: { data: GaugeData }) {
  const { t } = useTranslation();
  const value = formatPercentage(data.value, 1);

  return (
    <div
      className="inspection-reports__gauge-visual"
      role="img"
      aria-label={t("inspection.reportsAnalytics.aria.aiTriggeredHitRate", { value })}
    >
      <img
        className="inspection-reports__gauge-track"
        src={aiTriggeredHitRateBase}
        alt=""
        aria-hidden="true"
      />
      <div className="inspection-reports__gauge-gradient-wrap" aria-hidden="true">
        <img
          className="inspection-reports__gauge-gradient"
          src={aiTriggeredHitRateGradient}
          alt=""
        />
      </div>
      <strong className="inspection-reports__gauge-value">{value}</strong>
    </div>
  );
}

export function GaugeCard({
  title,
  data,
  className,
}: {
  title: string;
  data: GaugeData;
  className?: string;
}) {
  const { t } = useTranslation();
  const formatValue =
    data.format === "currency"
      ? (value: number) => formatCurrency(value, true)
      : formatCompactCount;
  const hasData = hasGaugeData(data);
  return (
    <AnalyticsCard
      title={title}
      className={joinClassNames("inspection-reports__gauge-card", className)}
    >
      {hasData ? (
        <>
          <GaugeVisual data={data} />
          <div className="inspection-reports__gauge-metrics">
            <span>
              <i className="inspection-reports__metric-marker inspection-reports__metric-marker--green" />
              {DATA_LABEL_KEYS[data.primaryLabel]
                ? t(DATA_LABEL_KEYS[data.primaryLabel])
                : data.primaryLabel}
              <b>{formatValue(data.primaryValue)}</b>
            </span>
            <span>
              <i className="inspection-reports__metric-marker inspection-reports__metric-marker--gray" />
              {DATA_LABEL_KEYS[data.secondaryLabel]
                ? t(DATA_LABEL_KEYS[data.secondaryLabel])
                : data.secondaryLabel}
              <b>{formatValue(data.secondaryValue)}</b>
            </span>
          </div>
        </>
      ) : (
        <ChartEmptyState />
      )}
    </AnalyticsCard>
  );
}

export function RiskTaskSourceCard({
  autoTriageRate,
  tasksPerDay,
  sourceDistribution,
}: {
  autoTriageRate: number;
  tasksPerDay: number;
  sourceDistribution: DonutData;
}) {
  const { t } = useTranslation();
  const hasData = sourceDistribution.items.length > 0;
  const legendItems = useMemo<ChartLegendItem[]>(
    () =>
      sourceDistribution.items.map((item) => ({
        key: item.label,
        label: DATA_LABEL_KEYS[item.label] ? t(DATA_LABEL_KEYS[item.label]) : item.label,
        color: item.color,
        value: item.value,
      })),
    [sourceDistribution.items, t],
  );
  const selection = useChartLegendSelection(legendItems);

  return (
    <AnalyticsCard
      title={t("inspection.reportsAnalytics.titles.riskTaskSource")}
      className="inspection-reports__source-card"
    >
      {hasData ? (
        <>
          <div className="inspection-reports__source-metrics">
            <span>
              <span className="inspection-reports__source-metric-icon">
                <img src={autoTriageIcon} alt="" aria-hidden="true" />
              </span>
              <b>{formatPercentage(autoTriageRate, 1)}</b>
              <small>{t("inspection.reportsAnalytics.metrics.autoTriageRate")}</small>
            </span>
            <span>
              <span className="inspection-reports__source-metric-icon">
                <img src={tasksPerDayIcon} alt="" aria-hidden="true" />
              </span>
              <b>{formatCompactDecimal(tasksPerDay)}</b>
              <small>{t("inspection.reportsAnalytics.metrics.tasksPerDay")}</small>
            </span>
          </div>
          <div className="inspection-reports__source-chart">
            <DonutVisual data={sourceDistribution} selection={selection} />
          </div>
          <DonutLegend selection={selection} total={sourceDistribution.total} />
        </>
      ) : (
        <ChartEmptyState />
      )}
    </AnalyticsCard>
  );
}

export function HorizontalBarsCard({
  title,
  items,
  showPercentage = false,
  valueSuffix,
  className,
}: {
  title: string;
  items: HorizontalBarItem[];
  showPercentage?: boolean;
  valueSuffix?: string;
  className?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const total = sum(items.map((item) => item.value));
  const hasData = items.length > 0;

  return (
    <AnalyticsCard
      title={title}
      className={joinClassNames("inspection-reports__horizontal-bars-card", className)}
    >
      {hasData ? (
        <div
          className={joinClassNames(
            "inspection-reports__horizontal-bars",
            /* Few rows: fixed 32px spacing instead of stranding them across the card. */
            items.length <= 4 ? "inspection-reports__horizontal-bars--sparse" : "",
          )}
        >
          {items.map((item) => (
            <div key={item.label} className="inspection-reports__horizontal-bar-row">
              <div className="inspection-reports__horizontal-bar-label">
                <span>{item.label}</span>
                <b>
                  {formatCompactCount(item.value)}
                  {valueSuffix ? ` ${valueSuffix}` : ""}
                  {showPercentage
                    ? ` (${formatPercentage(item.percentage ?? getPercentage(item.value, total), 2)})`
                    : ""}
                </b>
              </div>
              <div className="inspection-reports__horizontal-bar-track">
                <i
                  style={{
                    width: `${(item.value / max) * 100}%`,
                    backgroundColor: item.color || COLORS.green,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ChartEmptyState />
      )}
    </AnalyticsCard>
  );
}

function StackedSegmentTooltipContent({
  band,
  value,
  total,
}: {
  band: RiskBand;
  value: number;
  total: number;
}) {
  const { t } = useTranslation();
  const label = DATA_LABEL_KEYS[band] ? t(DATA_LABEL_KEYS[band]) : band;

  return (
    <div className="inspection-reports__stacked-tooltip">
      <div className="inspection-reports__stacked-tooltip-title">
        <span
          className="inspection-reports__stacked-tooltip-marker"
          style={{ backgroundColor: RISK_BAND_COLORS[band] }}
        />
        <span>{label}</span>
      </div>
      <div className="inspection-reports__stacked-tooltip-row">
        <span>{t("inspection.reportsAnalytics.tooltip.tasks")}:</span>
        <b>{formatCompactCount(value)}</b>
      </div>
      <div className="inspection-reports__stacked-tooltip-row">
        <span>{t("inspection.reportsAnalytics.tooltip.share")}:</span>
        <b>{formatPercentage(getPercentage(value, total), 0)}</b>
      </div>
    </div>
  );
}

export function StackedDistributionCard({
  title,
  rows,
  className,
  showSegmentTooltip = false,
}: {
  title: string;
  rows: StackedDistributionRow[];
  className?: string;
  showSegmentTooltip?: boolean;
}) {
  const { t } = useTranslation();
  const hasData = rows.length > 0;

  return (
    <AnalyticsCard
      title={title}
      className={joinClassNames("inspection-reports__stacked-card", className)}
    >
      {hasData ? (
        <>
          <div className="inspection-reports__stacked-legend">
            {RISK_BANDS.map((band) => (
              <span key={band}>
                <i style={{ backgroundColor: RISK_BAND_COLORS[band] }} />
                {DATA_LABEL_KEYS[band] ? t(DATA_LABEL_KEYS[band]) : band}
              </span>
            ))}
          </div>
          <div className="inspection-reports__stacked-rows">
            {rows.map((row) => {
              const visibleBands = RISK_BANDS.filter((band) => row.values[band] > 0);

              return (
                <div key={row.label} className="inspection-reports__stacked-row">
                  <div>
                    <span>
                      {DATA_LABEL_KEYS[row.label]
                        ? t(DATA_LABEL_KEYS[row.label])
                        : row.label}
                    </span>
                    <b>{formatCompactCount(row.total)}</b>
                  </div>
                  <div className="inspection-reports__stacked-track">
                    {visibleBands.map((band, index) => {
                      const isOnlySegment = visibleBands.length === 1;
                      const isFirstSegment = index === 0;
                      const isLastSegment = index === visibleBands.length - 1;

                      const segment = (
                        <i
                          key={band}
                          className={joinClassNames(
                            "inspection-reports__stacked-segment",
                            isOnlySegment
                              ? "inspection-reports__stacked-segment--only"
                              : isFirstSegment
                                ? "inspection-reports__stacked-segment--first"
                                : isLastSegment
                                  ? "inspection-reports__stacked-segment--last"
                                  : undefined,
                            !isLastSegment
                              ? "inspection-reports__stacked-segment--divider"
                              : undefined,
                            showSegmentTooltip
                              ? "inspection-reports__stacked-segment--interactive"
                              : undefined,
                          )}
                          style={{
                            width: `${row.total > 0 ? (row.values[band] / row.total) * 100 : 0}%`,
                            backgroundColor: RISK_BAND_COLORS[band],
                          }}
                        />
                      );

                      if (!showSegmentTooltip) {
                        return segment;
                      }

                      return (
                        <Tooltip
                          key={band}
                          title={
                            <StackedSegmentTooltipContent
                              band={band}
                              value={row.values[band]}
                              total={row.total}
                            />
                          }
                          overlayClassName="inspection-reports__stacked-tooltip-overlay"
                          placement="top"
                        >
                          {segment}
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <ChartEmptyState />
      )}
    </AnalyticsCard>
  );
}
