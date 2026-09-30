import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type Ref,
} from "react";
import { Tooltip } from "antd";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import { useTranslation } from "react-i18next";
import ClassNameECharts from "@/components/common/ClassNameECharts";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import type {
  DashboardLicenseWorkloadData,
  DashboardLeaveRow,
  DashboardTableSortDirection,
  LicenseDisplayValue,
  LicenseDonutStatusCard,
  LicenseMetricTile,
  LicenseStatusGridCard,
  LicenseTrendCard,
} from "../type";
import { formatDashboardDonutDisplayNumber } from "../formatters";
import arrowCircleRightIcon from "../assets/license/arrow-circle-right.svg";
import avatarPlaceholderIcon from "../assets/license/avatar-placeholder.svg";
import infoIcon from "../assets/license/info-icon.svg";
import metricApprovalManagerIcon from "../assets/license/metric-approval-manager.svg";
import metricApprovalStaffIcon from "../assets/license/metric-approval-staff.svg";
import metricOverdueIcon from "../assets/license/metric-overdue.svg";
import metricProcessingIcon from "../assets/license/metric-processing.svg";
import statusCertificateIcon from "../assets/license/status-certificate.svg";
import statusFileXIcon from "../assets/license/status-file-x.svg";
import statusProhibitIcon from "../assets/license/status-prohibit.svg";
import statusWarningIcon from "../assets/license/status-warning.svg";
import { DashboardSlaComplianceGauge } from "./DashboardSlaComplianceGauge";
import {
  DashboardCard,
  DashboardEmptyState,
  TableSection,
  TaskListSection,
} from "./DashboardWidgets";
import { translateDashboardStaticText } from "./dashboardText";
import useAutoResizeEChart from "./useAutoResizeEChart";
import type { DashboardReturnContext } from "../dashboardReturnState";

const STATUS_VALUE_CLASS_BY_TONE = {
  default: "",
  green: " dashboard__license-value--green",
  neutral: "",
  orange: " dashboard__license-value--orange",
  red: " dashboard__license-value--red",
  yellow: " dashboard__license-value--orange",
  blue: " dashboard__license-value--blue",
  gold: " dashboard__license-value--gold",
} as const;

const STATUS_ICON_BY_KEY = {
  certificate: statusCertificateIcon,
  fileX: statusFileXIcon,
  prohibit: statusProhibitIcon,
  warning: statusWarningIcon,
} as const;

const LICENSE_INFO_TOOLTIP_OVERLAY_STYLE: CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: 8,
  boxShadow: "0 12px 32px rgba(54, 30, 18, 0.16)",
  color: "#361E12",
  fontSize: 12,
  fontWeight: 400,
  lineHeight: "18px",
  maxWidth: 800,
  padding: "8px 10px",
  /*
    The global getPopupContainer (src/App.tsx) mounts this tooltip inside the
    footer stat label, which sets white-space: nowrap. white-space inherits, so
    force it back to normal here (inline style wins) to allow the tooltip copy
    to wrap instead of stretching into a single long line.
  */
  whiteSpace: "normal",
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getDisplayText = (
  value: LicenseDisplayValue,
  translate?: (key: string, options?: Record<string, string | number>) => string
) =>
  value.available
    ? translate
      ? translateDashboardStaticText(value.text, translate)
      : value.text
    : "-";

const getDisplayValueClassName = (
  value: LicenseDisplayValue,
  tone?: keyof typeof STATUS_VALUE_CLASS_BY_TONE
) =>
  `dashboard__license-value${
    value.available ? STATUS_VALUE_CLASS_BY_TONE[tone || "default"] : ""
  }${value.available ? "" : " dashboard__license-value--placeholder"}`;

const formatTooltipValue = (
  value: unknown,
  unit: "%" | "h" | "count",
  translate: (key: string) => string
) => {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  if (unit === "count") {
    return numericValue.toLocaleString("en-US", {
      maximumFractionDigits: Number.isInteger(numericValue) ? 0 : 1,
    });
  }

  return translateDashboardStaticText(`${numericValue.toLocaleString("en-US", {
    maximumFractionDigits: unit === "%" ? 0 : 1,
  })}${unit}`, translate);
};

function LicenseInfoIcon({
  className = "",
  tooltipText,
}: {
  className?: string;
  tooltipText?: string;
}) {
  const { t } = useTranslation();
  const translatedTooltipText = translateDashboardStaticText(tooltipText, t);
  const icon = (
    <span className="dashboard__license-info-icon-trigger">
      <img
        src={infoIcon}
        alt=""
        className={`dashboard__license-info-icon ${className}`.trim()}
      />
    </span>
  );

  if (!tooltipText) {
    return icon;
  }

  return (
    <Tooltip
      title={translatedTooltipText}
      color="#FFFFFF"
      placement="top"
      destroyTooltipOnHide
      overlayInnerStyle={LICENSE_INFO_TOOLTIP_OVERLAY_STYLE}
    >
      {icon}
    </Tooltip>
  );
}

function LicenseMetricIcon({
  tile,
  roleVariant,
}: {
  tile: LicenseMetricTile;
  roleVariant: DashboardLicenseWorkloadData["roleVariant"];
}) {
  if (tile.icon === "slaCompliance") {
    return (
      <DashboardSlaComplianceGauge
        value={tile.value.available ? tile.value.text : null}
        className="dashboard__license-metric-icon dashboard__license-metric-icon--sla-gauge"
      />
    );
  }

  const iconSource =
    tile.icon === "approvalRate"
      ? roleVariant === "manager"
        ? metricApprovalManagerIcon
        : metricApprovalStaffIcon
      : tile.icon === "avgProcessingTime"
      ? metricProcessingIcon
      : metricOverdueIcon;

  return (
    <img
      src={iconSource}
      alt=""
      className="dashboard__license-metric-icon"
    />
  );
}

const createDonutSelectedMap = (card: LicenseDonutStatusCard) =>
  card.legends.reduce<Record<string, boolean>>((result, item) => {
    result[item.key] = true;
    return result;
  }, {});

const createTrendSelectedMap = (card: LicenseTrendCard) =>
  card.series.reduce<Record<string, boolean>>((result, item) => {
    result[item.key] = true;
    return result;
  }, {});

interface LegendSelectChangedEvent {
  selected: Record<string, boolean>;
}

function LicenseMetricSection({
  data,
}: {
  data: DashboardLicenseWorkloadData;
}) {
  const { t } = useTranslation();

  return (
    <DashboardCard
      titleText={data.performanceCard.titleText}
      className={`dashboard__license-metric-card dashboard__license-metric-card--${data.roleVariant}`}
      actionVisible={false}
    >
      <div className="dashboard__license-metric-grid">
        {data.performanceCard.tiles.map((tile) => (
          <article key={tile.key} className="dashboard__license-metric-tile">
            <LicenseMetricIcon tile={tile} roleVariant={data.roleVariant} />
            <div className="dashboard__license-metric-copy">
              <strong className={getDisplayValueClassName(tile.value)}>
                {getDisplayText(tile.value, t)}
              </strong>
              <span className="dashboard__license-metric-label">
                <span className="dashboard__license-metric-label-text">
                  {translateDashboardStaticText(tile.labelText, t)}
                </span>
                {tile.showInfo ? (
                  <LicenseInfoIcon tooltipText={tile.infoTooltipText} />
                ) : null}
              </span>
            </div>
          </article>
        ))}
      </div>
    </DashboardCard>
  );
}

const formatLicenseDonutTooltip = (params: CallbackDataParams) => {
  const label = escapeHtml(String(params.name ?? ""));
  const value = formatDashboardDonutDisplayNumber(Number(params.value ?? 0));
  const percentage = Number(params.percent ?? 0).toFixed(2);
  const color = typeof params.color === "string" ? params.color : "#A0D5AB";

  return `
    <div class="dashboard__donut-tooltip-content">
      <span class="dashboard__donut-tooltip-marker" style="background-color: ${color};"></span>
      <span class="dashboard__donut-tooltip-text">${label}: ${value} (${percentage}%)</span>
    </div>
  `;
};

function LicenseDonutSummaryCard({
  card,
}: {
  card: LicenseDonutStatusCard;
}) {
  const { t } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart();
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() =>
    createDonutSelectedMap(card)
  );

  const legendSignature = useMemo(
    () =>
      card.legends
        .map((item) => `${item.key}:${item.labelText}:${item.value.text}`)
        .join("|"),
    [card.legends]
  );

  useEffect(() => {
    setSelectedMap(createDonutSelectedMap(card));
  }, [card, legendSignature]);

  const segmentKeysWithValue = useMemo(
    () =>
      new Set(
        card.chartSegments
          .filter((segment) => segment.value > 0)
          .map((segment) => segment.key)
      ),
    [card.chartSegments]
  );

  const legendItems = useMemo(
    () =>
      card.legends.map((legend) => {
        const canToggleChart =
          legend.value.available && segmentKeysWithValue.has(legend.key);

        return {
          ...legend,
          canToggleChart,
          selected: selectedMap[legend.key] !== false,
        };
      }),
    [card.legends, segmentKeysWithValue, selectedMap]
  );

  const donutItems = useMemo(
    () =>
      legendItems
        .filter((legend) => legend.selected && legend.value.available)
        .map((legend) => ({
          name: translateDashboardStaticText(legend.labelText, t),
          value:
            card.chartSegments.find((segment) => segment.key === legend.key)
              ?.value ?? 0,
          itemStyle: {
            color: legend.color,
          },
        })),
    [card.chartSegments, legendItems, t]
  );

  const hasDonutData = donutItems.some((item) => item.value > 0);

  const donutOption = useMemo(
    () => ({
      animation: true,
      animationDuration: 220,
      animationDurationUpdate: 220,
      tooltip: {
        show: hasDonutData,
        trigger: "item",
        renderMode: "html",
        appendTo: "body",
        confine: false,
        className: "dashboard__donut-tooltip",
        formatter: hasDonutData ? formatLicenseDonutTooltip : undefined,
      },
      series: [
        {
          type: "pie",
          cursor: "default",
          radius: ["77%", "100%"],
          center: ["50%", "50%"],
          startAngle: 90,
          minAngle: 3,
          avoidLabelOverlap: true,
          silent: !hasDonutData,
          label: {
            show: false,
          },
          labelLine: {
            show: false,
          },
          emphasis: {
            scale: false,
          },
          data: hasDonutData
            ? donutItems.filter((item) => item.value > 0)
            : [
                {
                  value: 1,
                  name: "",
                  itemStyle: { color: "#E6E8EC" },
                },
              ],
        },
      ],
    }),
    [donutItems, hasDonutData]
  );

  const toggleLegendSelection = useCallback(
    (legendKey: string, canToggleChart: boolean) => {
      if (!canToggleChart) {
        return;
      }

      setSelectedMap((previous) => ({
        ...previous,
        [legendKey]: previous[legendKey] === false,
      }));
    },
    []
  );

  const handleLegendKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLDivElement>,
      legendKey: string,
      canToggleChart: boolean
    ) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      toggleLegendSelection(legendKey, canToggleChart);
    },
    [toggleLegendSelection]
  );

  return (
    <DashboardCard
      titleText={card.titleText}
      className="dashboard__license-summary-card dashboard__license-summary-card--donut"
      actionPath={card.targetPath}
      actionPermissionPath={card.permissionPath}
      actionIconSrc={arrowCircleRightIcon}
    >
      <div className="dashboard__license-summary-body">
        <div className="dashboard__license-donut-layout">
          <div className="dashboard__license-donut-shell">
            <div className="dashboard__donut-wrap">
              <div ref={containerRef} className="dashboard__chart-shell dashboard__donut-chart">
                <ClassNameECharts
                  ref={chartRef as unknown as Ref<ClassNameECharts>}
                  option={donutOption}
                  className="dashboard__donut-chart-instance"
                  notMerge
                  lazyUpdate
                />
              </div>
              <div className="dashboard__donut-center">
                <strong className={getDisplayValueClassName(card.centerValue)}>
                  {getDisplayText(card.centerValue, t)}
                </strong>
                <span>
                  {translateDashboardStaticText(card.centerLabelText, t)}
                </span>
              </div>
            </div>
          </div>

          <div className="dashboard__license-legend-list">
            {legendItems.map((legend) => (
              <div
                key={legend.key}
                className={`dashboard__license-legend-item${
                  legend.selected ? "" : " dashboard__license-legend-item--inactive"
                }${
                  legend.canToggleChart
                    ? ""
                    : " dashboard__license-legend-item--static"
                }`}
                role={legend.canToggleChart ? "button" : undefined}
                tabIndex={legend.canToggleChart ? 0 : undefined}
                onClick={
                  legend.canToggleChart
                    ? () =>
                        toggleLegendSelection(
                          legend.key,
                          legend.canToggleChart
                        )
                    : undefined
                }
                onKeyDown={
                  legend.canToggleChart
                    ? (event) =>
                        handleLegendKeyDown(
                          event,
                          legend.key,
                          legend.canToggleChart
                        )
                    : undefined
                }
              >
                <span
                  className="dashboard__license-legend-dot"
                  style={{ backgroundColor: legend.color }}
                />
                <span className="dashboard__license-legend-label">
                  {translateDashboardStaticText(legend.labelText, t)}
                </span>
                <strong className={getDisplayValueClassName(legend.value)}>
                  {getDisplayText(legend.value, t)}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard__license-footer-stats">
          {card.footerStats.map((stat) => (
            <article
              key={stat.key}
              className="dashboard__license-footer-stat"
            >
              <strong
                className={getDisplayValueClassName(
                  stat.value,
                  stat.tone as keyof typeof STATUS_VALUE_CLASS_BY_TONE
                )}
              >
                {getDisplayText(stat.value, t)}
              </strong>
              <span className="dashboard__license-footer-stat-label">
                <span className="dashboard__license-footer-stat-label-text">
                  {translateDashboardStaticText(stat.labelText, t)}
                </span>
                {stat.showInfo ? (
                  <LicenseInfoIcon tooltipText={stat.infoTooltipText} />
                ) : null}
              </span>
            </article>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

function LicenseStatusGridSummaryCard({
  card,
}: {
  card: LicenseStatusGridCard;
}) {
  const { t } = useTranslation();

  return (
    <DashboardCard
      titleText={card.titleText}
      className="dashboard__license-summary-card dashboard__license-summary-card--status-grid"
      actionPath={card.targetPath}
      actionPermissionPath={card.permissionPath}
      actionIconSrc={arrowCircleRightIcon}
    >
      <div className="dashboard__license-status-grid">
        <article className="dashboard__license-status-tile dashboard__license-status-tile--total">
          <strong className={getDisplayValueClassName(card.totalValue)}>
            {getDisplayText(card.totalValue, t)}
          </strong>
          <span className="dashboard__license-status-tile-label">
            {translateDashboardStaticText(card.totalLabelText, t)}
          </span>
        </article>

        {card.tiles.map((tile) => (
          <article key={tile.key} className="dashboard__license-status-tile">
            <div className="dashboard__license-status-tile-copy">
              <strong
                className={getDisplayValueClassName(
                  tile.value,
                  tile.tone as keyof typeof STATUS_VALUE_CLASS_BY_TONE
                )}
              >
                {getDisplayText(tile.value, t)}
              </strong>
              <span className="dashboard__license-status-tile-label">
                {translateDashboardStaticText(tile.labelText, t)}
              </span>
            </div>
            <img
              src={STATUS_ICON_BY_KEY[tile.icon]}
              alt=""
              className="dashboard__license-status-icon"
            />
          </article>
        ))}
      </div>
    </DashboardCard>
  );
}

function LicenseCoachingCard({
  data,
}: {
  data: NonNullable<DashboardLicenseWorkloadData["coachingCard"]>;
}) {
  const { t } = useTranslation();

  return (
    <DashboardCard
      titleText={data.titleText}
      className="dashboard__license-coaching-card"
      actionPath={data.targetPath}
      actionPermissionPath={data.permissionPath}
      actionIconSrc={arrowCircleRightIcon}
      titleAccessory={
        data.showInfo ? (
          <LicenseInfoIcon tooltipText={data.infoTooltipText} />
        ) : undefined
      }
    >
      <div className="dashboard__license-coaching-table">
        {data.rows.length ? (
          <>
            <div className="dashboard__license-coaching-row dashboard__license-coaching-row--head">
              <span>{t("adminDashboard.table.member")}</span>
              <span>{t("adminDashboard.table.overdue")}</span>
              <span>{t("adminDashboard.metrics.slaCompliance")}</span>
              <span>{t("adminDashboard.metrics.avgProcessingTime")}</span>
            </div>

            {data.rows.map((row) => (
              <div key={row.key} className="dashboard__license-coaching-row">
                <span>{row.member || "-"}</span>
                <span className="dashboard__license-coaching-overdue">
                  {Number.isFinite(row.overdue) ? row.overdue : "-"}
                </span>
                <span>{row.slaCompliance || "-"}</span>
                <span>
                  {row.avgProcessingTime
                    ? translateDashboardStaticText(row.avgProcessingTime, t)
                    : "-"}
                </span>
              </div>
            ))}
          </>
        ) : (
          <div className="dashboard__license-coaching-empty">
            <DashboardEmptyState />
          </div>
        )}
      </div>
    </DashboardCard>
  );
}

function LicenseLeaveAvatar({ row }: { row: DashboardLeaveRow }) {
  if (row.avatar) {
    return (
      <AuthenticatedDocumentImage
        src={row.avatar}
        alt=""
        className="dashboard__license-leave-avatar-image"
      />
    );
  }

  return (
    <span className="dashboard__license-leave-avatar-fallback">
      <img src={avatarPlaceholderIcon} alt="" />
    </span>
  );
}

function LicenseLeaveCard({
  data,
}: {
  data: NonNullable<DashboardLicenseWorkloadData["leaveCard"]>;
}) {
  const { t } = useTranslation();

  return (
    <DashboardCard
      titleText={data.titleText}
      titleCount={data.totalCount}
      className="dashboard__license-leave-card"
      actionPath={data.targetPath}
      actionPermissionPath={data.permissionPath}
      actionIconSrc={arrowCircleRightIcon}
    >
      {data.rows.length ? (
        <div className="dashboard__license-leave-list">
          {data.rows.map((row) => (
            <article key={row.key} className="dashboard__license-leave-item">
              <div className="dashboard__license-leave-main">
                <div className="dashboard__license-leave-avatar">
                  <LicenseLeaveAvatar row={row} />
                </div>
                <div className="dashboard__license-leave-copy">
                  <strong>
                    {row.name || t("adminDashboard.empty.noData")}
                  </strong>
                  <span>
                    {row.reason
                      ? translateDashboardStaticText(row.reason, t)
                      : t(row.reasonKey)}
                  </span>
                  <span className="dashboard__license-leave-return">
                    {row.returnAt
                      ? t("adminDashboard.leave.returnAt", {
                          value: row.returnAt,
                        })
                      : t("adminDashboard.empty.noData")}
                  </span>
                </div>
              </div>
              <div className="dashboard__license-leave-divider" />
              <div className="dashboard__license-leave-todo">
                <strong>
                  {Number.isFinite(row.todoCount)
                    ? formatDashboardDonutDisplayNumber(row.todoCount)
                    : t("adminDashboard.empty.noData")}
                </strong>
                <span>{t("adminDashboard.labels.toDoCompact")}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <DashboardEmptyState
          className="dashboard__license-leave-empty"
        />
      )}
    </DashboardCard>
  );
}

const createTrendTooltipFormatter =
  (chart: LicenseTrendCard, translate: (key: string) => string) =>
  (params: CallbackDataParams | CallbackDataParams[]) => {
    const seriesParams = Array.isArray(params) ? params : [params];

    if (!seriesParams.length) {
      return "";
    }

    const title = escapeHtml(
      String(
        (seriesParams[0] as CallbackDataParams & { axisValueLabel?: string })
          .axisValueLabel ??
          seriesParams[0].name ??
          ""
      )
    );
    const rows = seriesParams
      .map((item) => {
        const matchedSeries = chart.series.find(
          (series) =>
            translateDashboardStaticText(series.labelText, translate) ===
            item.seriesName
        );
        const color = typeof item.color === "string" ? item.color : "#FAD44F";

        return `
          <div class="dashboard__trend-tooltip-row dashboard__trend-tooltip-row--compact">
            <span class="dashboard__trend-tooltip-series">
              <span class="dashboard__trend-tooltip-marker dashboard__trend-tooltip-marker--outlined" style="border-color: ${color};"></span>
              <span class="dashboard__trend-tooltip-copy">
                <span class="dashboard__trend-tooltip-label">${escapeHtml(
                  String(item.seriesName ?? item.name ?? "")
                )}：</span><span class="dashboard__trend-tooltip-value">${escapeHtml(
                  formatTooltipValue(item.value, matchedSeries?.unit || "%", translate)
                )}</span>
              </span>
            </span>
          </div>
        `;
      })
      .join("");

    return `
      <div class="dashboard__trend-tooltip-content">
        <div class="dashboard__trend-tooltip-title">${title}</div>
        ${rows}
      </div>
    `;
  };

const getRightAxisMax = (chart: LicenseTrendCard) => {
  const processingSeries = chart.series.find((item) => item.axis === "right");
  const maxValue = Math.max(...(processingSeries?.values || [0]));

  if (maxValue <= 0) {
    return 64;
  }

  return Math.max(8, Math.ceil(maxValue / 8) * 8);
};

const getCountAxisMax = (chart: LicenseTrendCard) => {
  const maxValue = Math.max(
    ...chart.series.flatMap((series) =>
      series.unit === "count" ? series.values : []
    ),
    0
  );

  if (maxValue <= 0) {
    return 5;
  }

  return Math.max(5, Math.ceil(maxValue / 5) * 5);
};

function LicenseTrendCardView({ card }: { card: LicenseTrendCard }) {
  const { t } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart();
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() =>
    createTrendSelectedMap(card)
  );
  const hasTrendData =
    card.categories.length > 0 &&
    card.series.length > 0 &&
    card.series.every(
      (series) => series.available && series.values.length === card.categories.length
    );
  const seriesSignature = useMemo(
    () =>
      card.series
        .map((series) => `${series.key}:${series.labelText}:${series.values.join(",")}`)
        .join("|"),
    [card.series]
  );

  useEffect(() => {
    setSelectedMap(createTrendSelectedMap(card));
  }, [card, seriesSignature]);

  const displayedSeries = useMemo(
    () =>
      card.series.map((series) => ({
        ...series,
        displayLabel: translateDashboardStaticText(series.labelText, t),
        selected: selectedMap[series.key] !== false,
      })),
    [card.series, selectedMap, t]
  );

  const handleLegendSelectChanged = useCallback(
    (event: LegendSelectChangedEvent) => {
      setSelectedMap((previous) => {
        const nextSelected: Record<string, boolean> = {};

        displayedSeries.forEach((series) => {
          nextSelected[series.key] =
            event.selected[series.displayLabel] ?? previous[series.key] ?? true;
        });

        return nextSelected;
      });
    },
    [displayedSeries]
  );

  const toggleLegendSelection = useCallback(
    (seriesKey: string, displayLabel: string) => {
      const chartInstance = chartRef.current?.getEchartsInstance();

      if (chartInstance) {
        chartInstance.dispatchAction({
          type: "legendToggleSelect",
          name: displayLabel,
        });

        return;
      }

      setSelectedMap((previous) => ({
        ...previous,
        [seriesKey]: previous[seriesKey] === false,
      }));
    },
    [chartRef]
  );

  const handleLegendKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLDivElement>,
      seriesKey: string,
      displayLabel: string
    ) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      toggleLegendSelection(seriesKey, displayLabel);
    },
    [toggleLegendSelection]
  );

  const onEvents = useMemo(
    () => ({
      legendselectchanged: handleLegendSelectChanged,
    }),
    [handleLegendSelectChanged]
  );

  const tooltipFormatter = useMemo(
    () => createTrendTooltipFormatter(card, t),
    [card, t]
  );

  const option = useMemo(() => {
    const rightAxisMax = getRightAxisMax(card);
    const countOnly = card.series.every((series) => series.unit === "count");
    const countAxisMax = getCountAxisMax(card);

    return {
      animation: false,
      color: displayedSeries.map((item) => item.color),
      tooltip: {
        trigger: "axis",
        renderMode: "html",
        appendTo: "body",
        confine: false,
        className:
          "dashboard__trend-tooltip dashboard__trend-tooltip--compact",
        backgroundColor: "transparent",
        borderWidth: 0,
        padding: 0,
        formatter: tooltipFormatter,
      },
      legend: {
        show: false,
        selectedMode: true,
        data: displayedSeries.map((series) => series.displayLabel),
        selected: displayedSeries.reduce<Record<string, boolean>>(
          (result, series) => {
            result[series.displayLabel] = series.selected;
            return result;
          },
          {}
        ),
      },
      grid: {
        top: 12,
        left: 40,
        right: 40,
        bottom: 24,
        containLabel: false,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: card.categories,
        axisLine: {
          lineStyle: {
            color: "#D8DADC",
          },
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: "#5F646D",
          fontSize: 12,
          margin: 12,
        },
      },
      yAxis: countOnly
        ? [
            {
              type: "value",
              min: 0,
              max: countAxisMax,
              interval: countAxisMax / 5,
              axisLine: {
                show: false,
              },
              axisTick: {
                show: false,
              },
              axisLabel: {
                color: "#5F646D",
                fontSize: 12,
                formatter: "{value}",
              },
              splitLine: {
                lineStyle: {
                  color: "#E1E3E5",
                  type: "dashed",
                },
              },
            },
          ]
        : [
            {
              type: "value",
              min: 0,
              max: 100,
              interval: 20,
              axisLine: {
                show: false,
              },
              axisTick: {
                show: false,
              },
              axisLabel: {
                color: "#5F646D",
                fontSize: 12,
                formatter: "{value}%",
              },
              splitLine: {
                lineStyle: {
                  color: "#E1E3E5",
                  type: "dashed",
                },
              },
            },
            {
              type: "value",
              min: 0,
              max: rightAxisMax,
              interval: rightAxisMax / 5,
              axisLine: {
                show: false,
              },
              axisTick: {
                show: false,
              },
              axisLabel: {
                color: "#5F646D",
                fontSize: 12,
                formatter: (value: number) =>
                  translateDashboardStaticText(`${value}h`, t),
              },
              splitLine: {
                show: false,
              },
            },
          ],
      series: displayedSeries.map((series) => ({
        name: series.displayLabel,
        type: "line",
        smooth: false,
        showSymbol: false,
        symbol: "circle",
        symbolSize: 8,
        yAxisIndex: countOnly || series.axis !== "right" ? 0 : 1,
        itemStyle: {
          color: series.color,
        },
        lineStyle: {
          width: 2,
          color: series.color,
        },
        data: series.values,
      })),
    };
  }, [card, displayedSeries, t, tooltipFormatter]);

  return (
    <DashboardCard
      titleText={card.titleText}
      className="dashboard__license-trend-card"
      actionVisible={false}
      titleAccessory={
        card.showInfo ? (
          <LicenseInfoIcon
            className="dashboard__license-info-icon--md"
            tooltipText={card.infoTooltipText}
          />
        ) : undefined
      }
    >
      {hasTrendData ? (
        <div className="dashboard__license-trend-body">
          <div className="dashboard__license-trend-legend">
            {displayedSeries.map((series) => (
              <div
                key={series.key}
                className={`dashboard__license-trend-legend-item${
                  series.selected
                    ? ""
                    : " dashboard__license-trend-legend-item--inactive"
                }`}
                role="button"
                tabIndex={0}
                onClick={() =>
                  toggleLegendSelection(series.key, series.displayLabel)
                }
                onKeyDown={(event) =>
                  handleLegendKeyDown(event, series.key, series.displayLabel)
                }
              >
                <span
                  className="dashboard__license-trend-legend-line"
                  style={
                    {
                      "--license-trend-color": series.color,
                    } as CSSProperties
                  }
                />
                <span className="dashboard__license-trend-legend-label">
                  {series.displayLabel}
                </span>
              </div>
            ))}
          </div>

          <div
            ref={containerRef}
            className="dashboard__license-trend-chart-shell"
          >
            <ClassNameECharts
              ref={chartRef as unknown as Ref<ClassNameECharts>}
              option={option}
              className="dashboard__license-trend-chart"
              notMerge
              lazyUpdate
              onEvents={onEvents}
            />
          </div>
        </div>
      ) : (
        <DashboardEmptyState className="dashboard__license-trend-empty" />
      )}
    </DashboardCard>
  );
}

function renderSummaryCard(
  card: DashboardLicenseWorkloadData["summaryCards"][number]
) {
  if (card.variant === "donutStatus") {
    return <LicenseDonutSummaryCard key={card.key} card={card} />;
  }

  return <LicenseStatusGridSummaryCard key={card.key} card={card} />;
}

interface LicenseDashboardLayoutProps {
  data: DashboardLicenseWorkloadData;
  resetKey: string;
  attentionActiveTabKey?: string;
  dashboardReturnContext: DashboardReturnContext;
  taskTabLoadingByKey?: Record<string, boolean>;
  attentionTableLoadingByKey?: Record<string, boolean>;
  onTaskTabChange?: (tabKey: string) => void;
  onAttentionTabChange?: (tabKey: string) => void;
  onAttentionPageChange?: (
    tabKey: string,
    page: number,
    pageSize: number,
    sortBy?: string,
    sortDirection?: DashboardTableSortDirection
  ) => void;
}

export function LicenseDashboardLayout({
  data,
  resetKey,
  attentionActiveTabKey,
  dashboardReturnContext,
  taskTabLoadingByKey,
  attentionTableLoadingByKey,
  onTaskTabChange,
  onAttentionTabChange,
  onAttentionPageChange,
}: LicenseDashboardLayoutProps) {
  return (
    <>
      <TaskListSection
        key={`${resetKey}-${data.department}-${data.roleVariant}-tasks`}
        tabs={data.taskTabs}
        loadingByTab={taskTabLoadingByKey}
        onTabChange={onTaskTabChange}
      />

      {data.roleVariant === "manager" ? (
        <>
          <LicenseMetricSection data={data} />

          <div className="dashboard__license-summary-grid dashboard__license-summary-grid--manager">
            {data.summaryCards.map((card) => renderSummaryCard(card))}
          </div>

          <div className="dashboard__license-support-grid">
            {data.coachingCard ? <LicenseCoachingCard data={data.coachingCard} /> : null}
            {data.leaveCard ? <LicenseLeaveCard data={data.leaveCard} /> : null}
          </div>
        </>
      ) : (
        <>
          {/*
            Below 1440 these two rows merge into one continuous 2-column grid so the cards
            pair up as [Profile | Service] [My Performance | License Distribution] and the
            Performance Trend spans the full width on its own row (Figma node 44390:74002).
            From 1440 up they stay as two independent rows: summary strictly 3-up,
            performance 2-up (Figma node 44390:73837).
          */}
          <div className="dashboard__license-staff-groups">
            <div className="dashboard__license-summary-grid dashboard__license-summary-grid--staff">
              {data.summaryCards.map((card) => renderSummaryCard(card))}
            </div>

            <div className="dashboard__license-performance-grid">
              <LicenseMetricSection data={data} />
              {data.trendCard ? <LicenseTrendCardView card={data.trendCard} /> : null}
            </div>
          </div>
        </>
      )}

      <TableSection
        key={`${resetKey}-${data.department}-${data.roleVariant}-${data.attentionTable.key}`}
        section={data.attentionTable}
        department={data.department}
        activeTabKey={attentionActiveTabKey}
        dashboardReturnContext={dashboardReturnContext}
        loadingByTab={attentionTableLoadingByKey}
        onTabChange={onAttentionTabChange}
        onPageChange={onAttentionPageChange}
      />
    </>
  );
}
