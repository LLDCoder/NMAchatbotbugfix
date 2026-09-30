import { ClockCircleOutlined, TeamOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import reportsAnalyticsAedPrefixIcon from "@/assets/images/reportsAnalyticsAedPrefix.svg";
import reportsAnalyticsApprovalRateIcon from "@/assets/images/reportsAnalyticsApprovalRate.svg";
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
  avgProcessingTime: ClockCircleOutlined,
  teamSla: reportsAnalyticsTotalApplicationsIcon,
  teamProcessing: reportsAnalyticsTotalApplicationsIcon,
  teamApproval: reportsAnalyticsTotalApplicationsIcon,
  members: TeamOutlined,
};

const TEXT: Record<string, ReportsAnalyticsTranslationKey> = {
  publishedServices: "licenseReportsAnalytics.summary.publishedServices",
  totalApplications: "licenseReportsAnalytics.summary.totalApplications",
  totalRevenue: "licenseReportsAnalytics.summary.totalRevenue",
  refundApplications: "licenseReportsAnalytics.summary.refundApplications",
  totalRefunds: "licenseReportsAnalytics.summary.totalRefunds",
  approvalRate: "licenseReportsAnalytics.summary.approvalRate",
  avgSatisfaction: "licenseReportsAnalytics.summary.avgSatisfaction",
  avgProcessingTime: "licenseReportsAnalytics.summary.avgProcessingTime",
  sla: "licenseReportsAnalytics.summary.avgSlaCompliance",
  processing: "licenseReportsAnalytics.summary.avgProcessingTime",
  approval: "licenseReportsAnalytics.summary.avgApprovalRate",
  totalProfileApplications: "licenseReportsAnalytics.summary.totalProfileApplications",
  verifiedProfiles: "licenseReportsAnalytics.summary.verifiedProfiles",
  profileVerificationRate: "licenseReportsAnalytics.summary.profileVerificationRate",
};

interface StatCardsProps {
  items: Array<SummaryCardData | TeamPerformanceSummary>;
  compact?: boolean;
  variant?: "default" | "outlined";
}

export default function StatCards({
  items,
  compact = false,
  variant = "default",
}: StatCardsProps) {
  const { t: translate } = useTranslation();

  const renderValue = (item: SummaryCardData | TeamPerformanceSummary) => (
    <div className="reports-stat-value">
      {item.valuePrefix ? (
        item.valuePrefix === "AED" ? (
          <img
            src={reportsAnalyticsAedPrefixIcon}
            alt="AED"
            className="reports-stat-value-prefix-icon"
          />
        ) : (
          <span className="reports-stat-value-prefix">{item.valuePrefix}</span>
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
        <div className="reports-stat-icon">
          {typeof icon === "string" ? (
            <img src={icon} alt="" className="reports-stat-icon-image" />
          ) : (
            IconComponent && <IconComponent />
          )}
        </div>
        <div className="reports-stat-copy">
          {renderValue(item)}
          <div className="reports-stat-label">
            {translate(TEXT[item.key] || item.key)}
          </div>
        </div>
      </>
    );
  };

  const gridClassName = [
    "reports-stat-grid",
    compact ? "reports-stat-grid-compact" : "",
    variant === "outlined" ? "reports-stat-grid-outlined" : "",
    !compact && variant === "default" && items.length === 6
      ? "reports-stat-grid-six"
      : "",
    !compact && variant === "default" && items.length === 3
      ? "reports-stat-grid-three"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={gridClassName}>
      {items.map((item) => {
        const cardClassName =
          variant === "outlined"
            ? "reports-stat-card reports-stat-card-outlined"
            : "reports-stat-card analytics-card-surface";

        return (
          <div key={item.key} className={cardClassName}>
            {renderCardContent(item)}
          </div>
        );
      })}
    </div>
  );
}
