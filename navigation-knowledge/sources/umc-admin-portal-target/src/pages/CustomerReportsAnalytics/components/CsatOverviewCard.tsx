import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactEcharts from "echarts-for-react";
import { RiseOutlined, StarOutlined } from "@ant-design/icons";
import type { CsatData } from "../type";

const CSAT_COLORS = {
  satisfied: "#A0D5AB",
  neutral: "#81C1FF",
  dissatisfied: "#FAAAA7",
};

interface CsatOverviewCardProps {
  data: CsatData;
}

export default function CsatOverviewCard({ data }: CsatOverviewCardProps) {
  const { t } = useTranslation();
  const total = data.totalResponses;

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
              name: t("customerReportsAnalytics.csat.satisfied45"),
              itemStyle: { color: CSAT_COLORS.satisfied },
            },
            {
              value: data.neutralCount,
              name: t("customerReportsAnalytics.csat.neutral3"),
              itemStyle: { color: CSAT_COLORS.neutral },
            },
            {
              value: data.dissatisfiedCount,
              name: t("customerReportsAnalytics.csat.dissatisfied12"),
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
                text: total.toLocaleString(),
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
                text: t("customerReportsAnalytics.csat.total"),
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
    [data.satisfiedCount, data.neutralCount, data.dissatisfiedCount, total, t],
  );

  const segments = [
    {
      label: t("customerReportsAnalytics.csat.satisfied45"),
      value: data.satisfiedCount,
      pct: data.satisfiedRate,
      color: CSAT_COLORS.satisfied,
    },
    {
      label: t("customerReportsAnalytics.csat.neutral3"),
      value: data.neutralCount,
      pct: data.neutralRate,
      color: CSAT_COLORS.neutral,
    },
    {
      label: t("customerReportsAnalytics.csat.dissatisfied12"),
      value: data.dissatisfiedCount,
      pct: data.dissatisfiedRate,
      color: CSAT_COLORS.dissatisfied,
    },
  ];

  return (
    <div className="content-reports__card-surface customer-reports__csat-overview-card">
      <div className="content-reports__card-title">
        {t("customerReportsAnalytics.csat.overviewTitle")}
      </div>

      <div className="customer-reports__csat-kpi-row">
        <div className="customer-reports__csat-kpi-box">
          <div className="customer-reports__kpi-icon">
            <RiseOutlined />
          </div>
          <div className="customer-reports__kpi-copy">
            <div className="customer-reports__kpi-value">
              {data.overallSatisfactionRate.toFixed(1)}%
            </div>
            <div className="customer-reports__kpi-label">
              {t("customerReportsAnalytics.csat.overallSatisfactionRate")}
            </div>
          </div>
        </div>

        <div className="customer-reports__csat-kpi-box">
          <div className="customer-reports__kpi-icon">
            <StarOutlined />
          </div>
          <div className="customer-reports__kpi-copy">
            <div className="customer-reports__kpi-value">
              {data.avgRating.toFixed(1)}
              <span className="customer-reports__csat-rating-denom">/5</span>
            </div>
            <div className="customer-reports__kpi-label">
              {t("customerReportsAnalytics.csat.avgRating")}
            </div>
          </div>
        </div>
      </div>

      <div className="customer-reports__csat-donut-wrap">
        <ReactEcharts option={option} style={{ height: 210, width: "100%" }} />
      </div>

      <div className="customer-reports__csat-segment-list">
        {segments.map((seg) => (
          <div key={seg.label} className="customer-reports__csat-segment-row">
            <span
              className="customer-reports__csat-segment-dot"
              style={{ background: seg.color }}
            />
            <span className="customer-reports__csat-segment-name">{seg.label}</span>
            <span className="customer-reports__csat-segment-count">
              {seg.value.toLocaleString()}
            </span>
            <span className="customer-reports__csat-segment-pct">
              {seg.pct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
