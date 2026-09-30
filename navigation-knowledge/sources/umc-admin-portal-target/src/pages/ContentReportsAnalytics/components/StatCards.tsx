import { AppstoreOutlined, TeamOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import reportsAnalyticsAedPrefixIcon from "@/assets/images/reportsAnalyticsAedPrefix.svg";
import reportsAnalyticsApprovalRateIcon from "@/assets/images/reportsAnalyticsApprovalRate.svg";
import reportsAnalyticsAvgProcessingTimeIcon from "@/assets/images/reportsAnalyticsAvgProcessingTime.svg";
import reportsAnalyticsAvgSatisfactionIcon from "@/assets/images/reportsAnalyticsAvgSatisfaction.svg";
import reportsAnalyticsPublishedServicesIcon from "@/assets/images/reportsAnalyticsPublishedServices.svg";
import reportsAnalyticsRefundApplicationsIcon from "@/assets/images/reportsAnalyticsRefundApplications.svg";
import reportsAnalyticsTotalApplicationsIcon from "@/assets/images/reportsAnalyticsTotalApplications.svg";
import reportsAnalyticsTotalRefundsIcon from "@/assets/images/reportsAnalyticsTotalRefunds.svg";
import reportsAnalyticsTotalRevenueIcon from "@/assets/images/reportsAnalyticsTotalRevenue.svg";
import type { ReportsAnalyticsTranslationKey } from "../type";
import type { SummaryCardData, TeamPerformanceSummary } from "../type";

const iconMap = {
  services: reportsAnalyticsPublishedServicesIcon,
  applications: reportsAnalyticsTotalApplicationsIcon,
  revenue: reportsAnalyticsTotalRevenueIcon,
  refundApplications: reportsAnalyticsRefundApplicationsIcon,
  refunds: reportsAnalyticsTotalRefundsIcon,
  approval: reportsAnalyticsApprovalRateIcon,
  satisfaction: reportsAnalyticsAvgSatisfactionIcon,
  avgProcessingTime: reportsAnalyticsAvgProcessingTimeIcon,
  teamSla: AppstoreOutlined,
  teamProcessing: AppstoreOutlined,
  teamApproval: AppstoreOutlined,
  members: TeamOutlined,
};

const TEXT: Record<string, ReportsAnalyticsTranslationKey> = {
  publishedServices: "contentReportsAnalytics.summary.publishedServices",
  totalApplications: "contentReportsAnalytics.summary.totalApplications",
  totalRevenue: "contentReportsAnalytics.summary.totalRevenue",
  refundApplications: "contentReportsAnalytics.summary.refundApplications",
  totalRefunds: "contentReportsAnalytics.summary.totalRefunds",
  approvalRate: "contentReportsAnalytics.summary.approvalRate",
  avgSatisfaction: "contentReportsAnalytics.summary.avgSatisfaction",
  avgSlaCompliance: "contentReportsAnalytics.summary.avgSlaCompliance",
  avgProcessingTime: "contentReportsAnalytics.summary.avgProcessingTime",
  avgApprovalRate: "contentReportsAnalytics.summary.avgApprovalRate",
  sla: "contentReportsAnalytics.summary.teamSla",
  processing: "contentReportsAnalytics.summary.teamProcessing",
  approval: "contentReportsAnalytics.summary.teamApproval",
};

interface StatCardsProps {
  items: Array<SummaryCardData | TeamPerformanceSummary>;
  compact?: boolean;
  variant?: "default" | "outlined" | "six";
}

export default function StatCards({
  items,
  compact = false,
  variant = "default",
}: StatCardsProps) {
  const { t: translate } = useTranslation();

  const renderValue = (item: SummaryCardData | TeamPerformanceSummary) => (
    <div className="content-reports__stat-value">
      {item.valuePrefix ? (
        item.valuePrefix === "AED" ? (
          <img
            src={reportsAnalyticsAedPrefixIcon}
            alt="AED"
            className="content-reports__stat-value-prefix-icon"
          />
        ) : (
          <span className="content-reports__stat-value-prefix">{item.valuePrefix}</span>
        )
      ) : null}
      <span>{item.value}</span>
    </div>
  );

  const renderCardContent = (item: SummaryCardData | TeamPerformanceSummary) => {
    const icon = iconMap[item.iconKey];
    const IconComponent = typeof icon === "string" ? null : icon;

    return (
      <>
        <div className="content-reports__stat-icon">
          {typeof icon === "string" ? (
            <img src={icon} alt="" className="content-reports__stat-icon-image" />
          ) : (
            IconComponent && <IconComponent />
          )}
        </div>
        <div className="content-reports__stat-copy">
          {renderValue(item)}
          <div className="content-reports__stat-label">
            {item.titleKey
              ? translate(item.titleKey)
              : translate(TEXT[item.key] || item.key)}
          </div>
        </div>
      </>
    );
  };

  const isServiceOverviewLayout =
    !compact && variant === "default" && items.length === 7;

  if (isServiceOverviewLayout) {
    const [leadCard, ...stackedCards] = items;
    const columns = [
      stackedCards.slice(0, 2),
      stackedCards.slice(2, 4),
      stackedCards.slice(4, 6),
    ];

    return (
      <div className="content-reports__stat-grid content-reports__stat-grid--service">
        <div className="content-reports__stat-card content-reports__card-surface content-reports__stat-card--primary">
          {renderCardContent(leadCard)}
        </div>

        {columns.map((column, index) => (
          <div
            key={`reports-stat-column-${index + 1}`}
            className="content-reports__stat-stack content-reports__card-surface"
          >
            {column.map((item) => (
              <div key={item.key} className="content-reports__stat-stack-item">
                {renderCardContent(item)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const gridClassName = [
    "content-reports__stat-grid",
    compact ? "content-reports__stat-grid--compact" : "",
    variant === "outlined" ? "content-reports__stat-grid--outlined" : "",
    variant === "six" ? "content-reports__stat-grid--six" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={gridClassName}>
      {items.map((item) => {
        const cardClassName =
          variant === "outlined"
            ? "content-reports__stat-card content-reports__stat-card--outlined"
            : "content-reports__stat-card content-reports__card-surface";

        return (
          <div key={item.key} className={cardClassName}>
            {renderCardContent(item)}
          </div>
        );
      })}
    </div>
  );
}
