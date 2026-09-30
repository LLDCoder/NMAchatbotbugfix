import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactEcharts from "echarts-for-react";
import reportsAnalyticsApprovalRateIcon from "@/assets/images/reportsAnalyticsApprovalRate.svg";
import reportsAnalyticsAvgSatisfactionIcon from "@/assets/images/reportsAnalyticsAvgSatisfaction.svg";
import type { CsatOverviewData } from "../type";

const CSAT_COLORS = {
  satisfied: "#A0D5AB",
  neutral: "#81C1FF",
  dissatisfied: "#FAAAA7",
};

interface CsatOverviewCardProps {
  data: CsatOverviewData;
}

export default function CsatOverviewCard({ data }: CsatOverviewCardProps) {
  const { t } = useTranslation();

  const option = useMemo(
    () => ({
      series: [
        {
          type: "pie",
          radius: ["58%", "80%"],
          center: ["50%", "50%"],
          minAngle: 3,
          data: [
            {
              value: data.satisfiedCount,
              name: t("licenseReportsAnalytics.csat.satisfied45"),
              itemStyle: { color: CSAT_COLORS.satisfied },
            },
            {
              value: data.neutralCount,
              name: t("licenseReportsAnalytics.csat.neutral3"),
              itemStyle: { color: CSAT_COLORS.neutral },
            },
            {
              value: data.dissatisfiedCount,
              name: t("licenseReportsAnalytics.csat.dissatisfied12"),
              itemStyle: { color: CSAT_COLORS.dissatisfied },
            },
          ].filter((item) => item.value > 0),
          label: { show: false },
          emphasis: { label: { show: false } },
        },
      ],
      graphic: [
        {
          type: "group",
          left: "center",
          top: "middle",
          children: [
            {
              type: "text",
              style: {
                text: data.totalRatings.toLocaleString(),
                textAlign: "center",
                fill: "#1A1A2E",
                fontSize: 22,
                fontWeight: "bold",
              },
            },
            {
              type: "text",
              top: 30,
              style: {
                text: t("licenseReportsAnalytics.csat.total"),
                textAlign: "center",
                fill: "#8F8F8F",
                fontSize: 12,
              },
            },
          ],
        },
      ],
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
    }),
    [data.satisfiedCount, data.neutralCount, data.dissatisfiedCount, data.totalRatings, t],
  );

  const segments = [
    {
      label: t("licenseReportsAnalytics.csat.satisfied45"),
      value: data.satisfiedCount,
      pct: data.satisfiedPct,
      color: CSAT_COLORS.satisfied,
    },
    {
      label: t("licenseReportsAnalytics.csat.neutral3"),
      value: data.neutralCount,
      pct: data.neutralPct,
      color: CSAT_COLORS.neutral,
    },
    {
      label: t("licenseReportsAnalytics.csat.dissatisfied12"),
      value: data.dissatisfiedCount,
      pct: data.dissatisfiedPct,
      color: CSAT_COLORS.dissatisfied,
    },
  ];

  return (
    <div className="reports-card analytics-card-surface reports-csat-overview-card">
      <div className="reports-card-title">
        {t("licenseReportsAnalytics.csat.overviewTitle")}
      </div>

      <div className="reports-csat-kpi-row">
        <div className="reports-csat-kpi-box">
          <div className="reports-csat-kpi-icon">
            <img
              src={reportsAnalyticsApprovalRateIcon}
              alt=""
              className="reports-csat-kpi-icon-image"
            />
          </div>
          <div className="reports-csat-kpi-copy">
            <div className="reports-csat-kpi-value">
              {data.overallSatisfactionRate.toFixed(1)}%
            </div>
            <div className="reports-csat-kpi-label">
              {t("licenseReportsAnalytics.csat.overallRate")}
            </div>
          </div>
        </div>

        <div className="reports-csat-kpi-box">
          <div className="reports-csat-kpi-icon reports-csat-kpi-icon-star">
            <img
              src={reportsAnalyticsAvgSatisfactionIcon}
              alt=""
              className="reports-csat-kpi-icon-image"
            />
          </div>
          <div className="reports-csat-kpi-copy">
            <div className="reports-csat-kpi-value">
              {data.avgRating.toFixed(1)}
            </div>
            <div className="reports-csat-kpi-label">
              {t("licenseReportsAnalytics.csat.avgRating")}
            </div>
          </div>
        </div>
      </div>

      <div className="reports-csat-donut-wrap">
        <ReactEcharts option={option} style={{ height: 200, width: "100%" }} />
      </div>

      <div className="reports-csat-segment-list">
        {segments.map((seg) => (
          <div key={seg.label} className="reports-csat-segment-row">
            <span
              className="reports-csat-segment-dot"
              style={{ background: seg.color }}
            />
            <span className="reports-csat-segment-name">{seg.label}</span>
            <span className="reports-csat-segment-count">
              {seg.value.toLocaleString()}
            </span>
            <span className="reports-csat-segment-pct">
              {seg.pct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
