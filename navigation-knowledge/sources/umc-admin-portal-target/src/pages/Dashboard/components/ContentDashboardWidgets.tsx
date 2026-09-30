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
import { isArabicLanguage } from "@/localization/language";
import type {
  ContentDonutStatusCard,
  ContentMetricTile,
  ContentRiskTagGridCard,
  ContentTrendCard,
  DashboardContentWorkloadData,
  DashboardDisplayValue,
  DashboardTableSortDirection,
} from "../type";
import arrowCircleRightIcon from "../assets/content/arrow-circle-right.svg";
import avatarPlaceholderIcon from "../assets/content/avatar-placeholder.svg";
import infoIcon from "../assets/content/info-icon.svg";
import metricApprovalManagerIcon from "../assets/content/metric-approval-manager.svg";
import metricApprovalStaffIcon from "../assets/content/metric-approval-staff.svg";
import metricOverdueIcon from "../assets/content/metric-overdue.svg";
import metricProcessingIcon from "../assets/content/metric-processing.svg";
import riskAdultContentIcon from "../assets/content/risk-adult-content.svg";
import riskChildProtectionIcon from "../assets/content/risk-child-protection.svg";
import riskLgbtContentIcon from "../assets/content/risk-lgbt-content.svg";
import riskPoliticalSensitivityIcon from "../assets/content/risk-political-sensitivity.svg";
import riskProhibitedWordsIcon from "../assets/content/risk-prohibited-words.svg";
import riskReligiousContentIcon from "../assets/content/risk-religious-content.svg";
import riskRoyalFamilyIcon from "../assets/content/risk-royal-family.svg";
import riskViolenceHateSpeechIcon from "../assets/content/risk-violence-hate-speech.svg";
import {
  DashboardCard,
  DashboardEmptyState,
  TableSection,
  TaskListSection,
} from "./DashboardWidgets";
import {
  formatDashboardTrendDuration,
  translateDashboardStaticText,
  type DashboardTranslate,
} from "./dashboardText";
import { DashboardSlaComplianceGauge } from "./DashboardSlaComplianceGauge";
import OverflowTooltipText from "./OverflowTooltipText";
import useAutoResizeEChart from "./useAutoResizeEChart";
import type { DashboardReturnContext } from "../dashboardReturnState";

const VALUE_CLASS_BY_TONE = {
  default: "",
  green: " dashboard__content-value--green",
  neutral: "",
  orange: " dashboard__content-value--orange",
  red: " dashboard__content-value--red",
  yellow: " dashboard__content-value--orange",
  blue: " dashboard__content-value--blue",
  gold: " dashboard__content-value--gold",
} as const;

const RISK_ICON_BY_KEY = {
  adultContent: riskAdultContentIcon,
  childProtection: riskChildProtectionIcon,
  lgbtContent: riskLgbtContentIcon,
  politicalSensitivity: riskPoliticalSensitivityIcon,
  prohibitedWords: riskProhibitedWordsIcon,
  religiousContent: riskReligiousContentIcon,
  royalFamily: riskRoyalFamilyIcon,
  violenceHateSpeech: riskViolenceHateSpeechIcon,
} as const;

const CONTENT_INFO_TOOLTIP_OVERLAY_STYLE: CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: 8,
  boxShadow: "0 12px 32px rgba(54, 30, 18, 0.16)",
  color: "#361E12",
  fontSize: 12,
  fontWeight: 400,
  lineHeight: "18px",
  maxWidth: 800,
  padding: "8px 10px",
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getDisplayText = (
  value: DashboardDisplayValue,
  translate?: (key: string, options?: Record<string, string | number>) => string
) =>
  value.available
    ? translate
      ? translateDashboardStaticText(value.text, translate)
      : value.text
    : "-";

const getDisplayValueClassName = (
  value: DashboardDisplayValue,
  tone?: keyof typeof VALUE_CLASS_BY_TONE
) =>
  `dashboard__content-value${
    value.available ? VALUE_CLASS_BY_TONE[tone || "default"] : ""
  }${value.available ? "" : " dashboard__content-value--placeholder"}`;

function ContentInfoIcon({
  className = "",
  tooltipText,
}: {
  className?: string;
  tooltipText?: string;
}) {
  const { t } = useTranslation();
  const translatedTooltipText = translateDashboardStaticText(tooltipText, t);
  const icon = (
    <span className="dashboard__content-info-icon-trigger">
      <img
        src={infoIcon}
        alt=""
        className={`dashboard__content-info-icon ${className}`.trim()}
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
      overlayInnerStyle={CONTENT_INFO_TOOLTIP_OVERLAY_STYLE}
    >
      {icon}
    </Tooltip>
  );
}

function ContentMetricIcon({
  roleVariant,
  tile,
}: {
  roleVariant: DashboardContentWorkloadData["roleVariant"];
  tile: ContentMetricTile;
}) {
  if (tile.icon === "slaCompliance") {
    return (
      <DashboardSlaComplianceGauge
        value={tile.value.available ? tile.value.text : null}
        className="dashboard__content-metric-icon dashboard__content-metric-icon--sla-gauge"
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
      className="dashboard__content-metric-icon"
    />
  );
}

function ContentMetricSection({
  data,
}: {
  data: DashboardContentWorkloadData;
}) {
  const { t } = useTranslation();

  return (
    <DashboardCard
      titleText={data.performanceCard.titleText}
      className={`dashboard__content-metric-card dashboard__content-metric-card--${data.roleVariant}`}
      actionVisible={false}
    >
      <div className="dashboard__content-metric-grid">
        {data.performanceCard.tiles.map((tile) => (
          <article key={tile.key} className="dashboard__content-metric-tile">
            <ContentMetricIcon tile={tile} roleVariant={data.roleVariant} />
            <div className="dashboard__content-metric-copy">
              <strong className={getDisplayValueClassName(tile.value)}>
                {getDisplayText(tile.value, t)}
              </strong>
              <span className="dashboard__content-metric-label">
                <span className="dashboard__content-metric-label-text">
                  {translateDashboardStaticText(tile.labelText, t)}
                </span>
                {tile.showInfo ? (
                  <ContentInfoIcon tooltipText={tile.infoTooltipText} />
                ) : null}
              </span>
            </div>
          </article>
        ))}
      </div>
    </DashboardCard>
  );
}

const createDonutSelectedMap = (card: ContentDonutStatusCard) =>
  card.legends.reduce<Record<string, boolean>>((result, item) => {
    result[item.key] = true;
    return result;
  }, {});

const buildDonutTrackStyle = (
  segments: ContentDonutStatusCard["chartSegments"]
): CSSProperties => {
  const totalValue = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (totalValue <= 0) {
    return {
      background: "#E6E8EC",
    };
  }

  let start = 0;
  const ranges = segments.map((segment) => {
    const value = (segment.value / totalValue) * 100;
    const end = start + value;
    const range = `${segment.color} ${start}% ${end}%`;
    start = end;

    return range;
  });

  return {
    background: `conic-gradient(${ranges.join(", ")})`,
  };
};

function ContentDonutSummaryCard({
  card,
}: {
  card: ContentDonutStatusCard;
}) {
  const { t } = useTranslation();
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

  const visibleSegments = useMemo(
    () =>
      card.chartSegments.filter((segment) => selectedMap[segment.key] !== false),
    [card.chartSegments, selectedMap]
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
      className="dashboard__content-summary-card dashboard__content-summary-card--donut"
      actionPath={card.targetPath}
      actionPermissionPath={card.permissionPath}
      actionIconSrc={arrowCircleRightIcon}
    >
      <div className="dashboard__content-summary-body">
        <div className="dashboard__content-donut-layout">
          <div className="dashboard__content-donut-shell">
            <div
              className="dashboard__content-donut-ring"
              style={buildDonutTrackStyle(visibleSegments)}
            >
              <div className="dashboard__content-donut-inner">
                <strong className={getDisplayValueClassName(card.centerValue)}>
                  {getDisplayText(card.centerValue, t)}
                </strong>
                <span>
                  {translateDashboardStaticText(card.centerLabelText, t)}
                </span>
              </div>
            </div>
          </div>

          <div className="dashboard__content-legend-list">
            {legendItems.map((legend) => (
              <div
                key={legend.key}
                className={`dashboard__content-legend-item${
                  legend.selected ? "" : " dashboard__content-legend-item--inactive"
                }${
                  legend.canToggleChart
                    ? ""
                    : " dashboard__content-legend-item--static"
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
                  className="dashboard__content-legend-dot"
                  style={{ backgroundColor: legend.color }}
                />
                <span className="dashboard__content-legend-label">
                  {translateDashboardStaticText(legend.labelText, t)}
                </span>
                <strong className={getDisplayValueClassName(legend.value)}>
                  {getDisplayText(legend.value, t)}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard__content-footer-stats">
          {card.footerStats.map((stat) => (
            <article key={stat.key} className="dashboard__content-footer-stat">
              <strong
                className={getDisplayValueClassName(
                  stat.value,
                  stat.tone as keyof typeof VALUE_CLASS_BY_TONE
                )}
              >
                {getDisplayText(stat.value, t)}
              </strong>
              <span className="dashboard__content-footer-stat-label">
                <span className="dashboard__content-footer-stat-label-text">
                  {translateDashboardStaticText(stat.labelText, t)}
                </span>
                {stat.showInfo ? (
                  <ContentInfoIcon tooltipText={stat.infoTooltipText} />
                ) : null}
              </span>
            </article>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

function ContentAiRiskCard({
  card,
}: {
  card: ContentRiskTagGridCard;
}) {
  const { t } = useTranslation();

  return (
    <DashboardCard
      titleText={card.titleText}
      className="dashboard__content-risk-card"
      actionVisible={false}
      titleAccessory={
        card.showInfo ? (
          <ContentInfoIcon
            className="dashboard__content-info-icon--md"
            tooltipText={card.infoTooltipText}
          />
        ) : null
      }
    >
      <div className="dashboard__content-risk-grid">
        {card.items.map((item) => {
          const isZero = item.value.available && Number(item.value.text) === 0;

          return (
            <article
              key={item.key}
              className={`dashboard__content-risk-item${
                !item.value.available || isZero
                  ? " dashboard__content-risk-item--muted"
                  : ""
              }`}
            >
              <img
                src={RISK_ICON_BY_KEY[item.icon]}
                alt=""
                className="dashboard__content-risk-icon"
              />
              <OverflowTooltipText
                className="dashboard__content-risk-title"
                text={translateDashboardStaticText(item.labelText, t)}
              />
              <strong
                className={`dashboard__content-risk-value${
                  item.highlight ? " dashboard__content-risk-value--highlight" : ""
                }${
                  !item.value.available || isZero
                    ? " dashboard__content-risk-value--muted"
                    : ""
                }`}
              >
                {getDisplayText(item.value, t)}
              </strong>
            </article>
          );
        })}
      </div>
    </DashboardCard>
  );
}

const formatCoachingOverdue = (value: number) =>
  Number.isFinite(value) ? String(value) : "-";

function ContentCoachingCard({
  data,
}: {
  data: NonNullable<DashboardContentWorkloadData["coachingCard"]>;
}) {
  const { t } = useTranslation();
  const hasRows = data.rows.length > 0;

  return (
    <DashboardCard
      titleText={data.titleText}
      className="dashboard__content-coaching-card"
      actionPath={data.targetPath}
      actionPermissionPath={data.permissionPath}
      actionIconSrc={arrowCircleRightIcon}
      titleAccessory={
        data.showInfo ? (
          <ContentInfoIcon
            className="dashboard__content-info-icon--md"
            tooltipText={data.infoTooltipText}
          />
        ) : null
      }
    >
      {hasRows ? (
        <div className="dashboard__content-coaching-table">
          <div className="dashboard__content-coaching-row dashboard__content-coaching-row--head">
            <span>{t("adminDashboard.table.member")}</span>
            <span>{t("adminDashboard.table.overdue")}</span>
            <span>{t("adminDashboard.metrics.slaCompliance")}</span>
            <span>{t("adminDashboard.metrics.avgProcessingTime")}</span>
          </div>

          {data.rows.map((row) => (
            <div key={row.key} className="dashboard__content-coaching-row">
              <span>{row.member || t("adminDashboard.empty.noData")}</span>
              <span className="dashboard__content-coaching-overdue">
                {Number.isFinite(row.overdue)
                  ? formatCoachingOverdue(row.overdue)
                  : t("adminDashboard.empty.noData")}
              </span>
              <span>{row.slaCompliance || t("adminDashboard.empty.noData")}</span>
              <span>
                {row.avgProcessingTime
                  ? translateDashboardStaticText(row.avgProcessingTime, t)
                  : t("adminDashboard.empty.noData")}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="dashboard__content-coaching-empty">
          <DashboardEmptyState />
        </div>
      )}
    </DashboardCard>
  );
}

function LeaveAvatar({ avatar }: { avatar?: string }) {
  if (avatar) {
    return (
      <AuthenticatedDocumentImage
        src={avatar}
        alt=""
        className="dashboard__content-leave-avatar-image"
      />
    );
  }

  return (
    <span className="dashboard__content-leave-avatar-fallback">
      <img src={avatarPlaceholderIcon} alt="" />
    </span>
  );
}

function ContentLeaveCard({
  data,
}: {
  data: NonNullable<DashboardContentWorkloadData["leaveCard"]>;
}) {
  const { t } = useTranslation();
  const hasRows = data.rows.length > 0;

  return (
    <DashboardCard
      titleText={data.titleText}
      titleCount={data.totalCount}
      className="dashboard__content-leave-card"
      actionPath={data.targetPath}
      actionPermissionPath={data.permissionPath}
      actionIconSrc={arrowCircleRightIcon}
    >
      {hasRows ? (
        <div className="dashboard__content-leave-list">
          {data.rows.map((row) => (
            <article key={row.key} className="dashboard__content-leave-item">
              <div className="dashboard__content-leave-main">
                <div className="dashboard__content-leave-avatar">
                  <LeaveAvatar avatar={row.avatar} />
                </div>
                <div className="dashboard__content-leave-copy">
                  <strong>
                    {row.name || t("adminDashboard.empty.noData")}
                  </strong>
                  <span>
                    {row.reason
                      ? translateDashboardStaticText(row.reason, t)
                      : t("adminDashboard.empty.noData")}
                  </span>
                  <span className="dashboard__content-leave-return">
                    {row.returnAt
                      ? t("adminDashboard.leave.returnAt", {
                          value: row.returnAt,
                        })
                      : t("adminDashboard.empty.noData")}
                  </span>
                </div>
              </div>

              <div className="dashboard__content-leave-divider" />

              <div className="dashboard__content-leave-todo">
                <strong>
                  {Number.isFinite(row.todoCount)
                    ? row.todoCount
                    : t("adminDashboard.empty.noData")}
                </strong>
                <span>{t("adminDashboard.labels.toDo")}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <DashboardEmptyState
          className="dashboard__content-leave-empty"
        />
      )}
    </DashboardCard>
  );
}

const formatTooltipSeriesValue = (
  item: ContentTrendCard["series"][number],
  dataIndex: number,
  translate?: (key: string, options?: Record<string, string | number>) => string,
  isArabic = false
) => {
  if (item.unit === "%") {
    const value = Number(item.values[dataIndex] ?? 0);

    return Number.isFinite(value) ? `${value.toFixed(0)}%` : "-";
  }

  return formatDashboardTrendDuration(
    item.values[dataIndex],
    translate,
    isArabic
  );
};

const buildTrendTooltipFormatter = ({
  card,
  displayedSeries,
  translate,
  isArabic,
}: {
  card: ContentTrendCard;
  displayedSeries: Array<
    ContentTrendCard["series"][number] & {
      displayLabel: string;
      selected: boolean;
    }
  >;
  translate: DashboardTranslate;
  isArabic: boolean;
}) => {
  return (params: CallbackDataParams | CallbackDataParams[]) => {
    const rows = Array.isArray(params) ? params : [params];

    if (!rows.length) {
      return "";
    }

    const firstRow = rows[0];
    const dataIndex = Number(firstRow?.dataIndex ?? 0);
    const title = escapeHtml(
      String(card.categories[dataIndex] ?? firstRow?.name ?? "")
    );
    const content = displayedSeries
      .filter((series) => series.selected)
      .map((series) => {
        const value = escapeHtml(
          formatTooltipSeriesValue(series, dataIndex, translate, isArabic)
        );

        return `
          <div class="dashboard__trend-tooltip-row dashboard__trend-tooltip-row--compact">
            <span class="dashboard__trend-tooltip-series">
              <span class="dashboard__trend-tooltip-marker dashboard__trend-tooltip-marker--outlined" style="border-color: ${series.color};"></span>
              <span class="dashboard__trend-tooltip-copy">
                <span class="dashboard__trend-tooltip-label">${escapeHtml(
                  series.displayLabel
                )}：</span><span class="dashboard__trend-tooltip-value">${value}</span>
              </span>
            </span>
          </div>
        `;
      })
      .join("");

    return `
      <div class="dashboard__trend-tooltip-content">
        <div class="dashboard__trend-tooltip-title">${title}</div>
        ${content}
      </div>
    `;
  };
};

const createTrendSelectedMap = (card: ContentTrendCard) =>
  card.series.reduce<Record<string, boolean>>((result, item) => {
    result[item.key] = true;
    return result;
  }, {});

function ContentTrendCardView({
  card,
}: {
  card: NonNullable<DashboardContentWorkloadData["trendCard"]>;
}) {
  const { t, i18n } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart();
  const hasTrendData =
    card.categories.length > 0 &&
    card.series.some((series) => series.available && series.values.length > 0);
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() =>
    createTrendSelectedMap(card)
  );

  const seriesSignature = useMemo(
    () =>
      card.series
        .map((item) => `${item.key}:${item.labelText}:${item.values.join(",")}`)
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
    (event: { selected: Record<string, boolean> }) => {
      setSelectedMap((previous) => {
        const nextSelected: Record<string, boolean> = {};

        displayedSeries.forEach((series) => {
          nextSelected[series.key] =
            event.selected[series.displayLabel] ??
            previous[series.key] ??
            true;
        });

        return nextSelected;
      });
    },
    [displayedSeries]
  );

  const toggleLegendSelection = useCallback(
    (itemKey: string, displayLabel: string) => {
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
        [itemKey]: previous[itemKey] === false,
      }));
    },
    [chartRef]
  );

  const handleLegendKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLDivElement>,
      itemKey: string,
      displayLabel: string
    ) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      toggleLegendSelection(itemKey, displayLabel);
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
    () =>
      buildTrendTooltipFormatter({
        card,
        displayedSeries,
        translate: t,
        isArabic: isArabicLanguage(i18n.resolvedLanguage),
      }),
    [card, displayedSeries, i18n.resolvedLanguage, t]
  );

  const option = useMemo(
    () => ({
      animation: false,
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
        top: 8,
        left: 8,
        right: 8,
        bottom: 0,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: card.categories,
        axisLine: { lineStyle: { color: "#D8DADC" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#5F646D",
          fontSize: 12,
          margin: 12,
          alignMinLabel: "left",
          alignMaxLabel: "right",
          showMinLabel: true,
          showMaxLabel: true,
          hideOverlap: true,
        },
      },
      yAxis: [
        {
          type: "value",
          min: 0,
          max: 100,
          interval: 20,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "#9EA2A9",
            fontSize: 12,
            formatter: (value: number) => `${value}%`,
          },
          splitLine: { lineStyle: { color: "#E1E3E5", type: "dashed" } },
        },
        {
          type: "value",
          min: 0,
          max: card.avgProcessingTimeAxis?.maxValueMinutes || 0,
          splitNumber: Math.max(
            1,
            (card.avgProcessingTimeAxis?.tickLabels.length || 2) - 1
          ),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "#9EA2A9",
            fontSize: 12,
            formatter: (value: number) => {
              const unit = card.avgProcessingTimeAxis?.unit;

              if (unit === "days") {
                return translateDashboardStaticText(
                  `${Number(value / (24 * 60)).toFixed(0)}d`,
                  t
                );
              }

              if (unit === "hours") {
                return translateDashboardStaticText(
                  `${Number(value / 60).toFixed(0)}h`,
                  t
                );
              }

              return translateDashboardStaticText(
                `${Number(value).toFixed(0)}m`,
                t
              );
            },
          },
          splitLine: { show: false },
        },
      ],
      series: displayedSeries.map((item) => ({
        name: item.displayLabel,
        type: "line",
        smooth: false,
        yAxisIndex: item.axis === "right" ? 1 : 0,
        symbol: "circle",
        symbolSize: 0,
        showSymbol: false,
        itemStyle: {
          color: item.color,
        },
        lineStyle: {
          width: 2,
          color: item.color,
        },
        data: item.values,
      })),
    }),
    [card.avgProcessingTimeAxis, card.categories, displayedSeries, t, tooltipFormatter]
  );

  return (
    <DashboardCard
      titleText={card.titleText}
      className="dashboard__content-trend-card"
      actionVisible={false}
      titleAccessory={
        card.showInfo ? (
          <ContentInfoIcon
            className="dashboard__content-info-icon--md"
            tooltipText={card.infoTooltipText}
          />
        ) : null
      }
    >
      {hasTrendData ? (
        <div className="dashboard__content-trend-body">
          <div className="dashboard__content-trend-legend">
            {displayedSeries.map((series) => (
              <div
                key={series.key}
                className={`dashboard__content-trend-legend-item${
                  series.selected
                    ? ""
                    : " dashboard__content-trend-legend-item--inactive"
                }`}
                role="button"
                tabIndex={0}
                onClick={() =>
                  toggleLegendSelection(series.key, series.displayLabel)
                }
                onKeyDown={(event) =>
                  handleLegendKeyDown(
                    event,
                    series.key,
                    series.displayLabel
                  )
                }
              >
                <span
                  className="dashboard__content-trend-legend-line"
                  style={
                    { "--content-trend-color": series.color } as CSSProperties
                  }
                />
                <span className="dashboard__content-trend-legend-label">
                  {series.displayLabel}
                </span>
              </div>
            ))}
          </div>

          <div
            ref={containerRef}
            className="dashboard__chart-shell dashboard__content-trend-chart-shell"
          >
            <ClassNameECharts
              ref={chartRef as unknown as Ref<ClassNameECharts>}
              option={option}
              className="dashboard__content-trend-chart"
              notMerge
              lazyUpdate
              onEvents={onEvents}
            />
          </div>
        </div>
      ) : (
        <DashboardEmptyState className="dashboard__content-trend-empty" />
      )}
    </DashboardCard>
  );
}

interface ContentDashboardLayoutProps {
  data: DashboardContentWorkloadData;
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
    sortDirection?: DashboardTableSortDirection,
  ) => void;
}

export function ContentDashboardLayout({
  data,
  resetKey,
  attentionActiveTabKey,
  dashboardReturnContext,
  taskTabLoadingByKey,
  attentionTableLoadingByKey,
  onTaskTabChange,
  onAttentionTabChange,
  onAttentionPageChange,
}: ContentDashboardLayoutProps) {
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
          <ContentMetricSection data={data} />

          <div className="dashboard__content-summary-grid dashboard__content-summary-grid--manager">
            <ContentDonutSummaryCard card={data.serviceApplicationCard} />
            <ContentAiRiskCard card={data.aiRiskCard} />
          </div>

          <div className="dashboard__content-support-grid">
            {data.coachingCard ? <ContentCoachingCard data={data.coachingCard} /> : null}
            {data.leaveCard ? <ContentLeaveCard data={data.leaveCard} /> : null}
          </div>
        </>
      ) : (
        <>
          <div className="dashboard__content-summary-grid dashboard__content-summary-grid--staff">
            <ContentDonutSummaryCard card={data.serviceApplicationCard} />
            <ContentAiRiskCard card={data.aiRiskCard} />
          </div>

          <div className="dashboard__content-performance-grid">
            <ContentMetricSection data={data} />
            {data.trendCard ? <ContentTrendCardView card={data.trendCard} /> : null}
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
