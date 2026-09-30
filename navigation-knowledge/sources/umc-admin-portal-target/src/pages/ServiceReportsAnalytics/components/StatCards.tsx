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
import type { SummaryCardData } from "../type";
import { formatKpiValue } from "../utils/format";

const iconMap = {
  services: reportsAnalyticsPublishedServicesIcon,
  applications: reportsAnalyticsTotalApplicationsIcon,
  revenue: reportsAnalyticsTotalRevenueIcon,
  approval: reportsAnalyticsApprovalRateIcon,
  processing: reportsAnalyticsAvgProcessingTimeIcon,
  satisfaction: reportsAnalyticsAvgSatisfactionIcon,
  refundApplications: reportsAnalyticsRefundApplicationsIcon,
  refunds: reportsAnalyticsTotalRefundsIcon,
};

interface StatCardsProps {
  items: SummaryCardData[];
}

export default function StatCards({ items }: StatCardsProps) {
  const { t: translate } = useTranslation();

  return (
    <div className="service-reports__stat-grid">
      {items.map((item) => (
        <div
          key={item.key}
          className="service-reports__stat-card service-reports__card-surface"
        >
          <div className="service-reports__stat-icon">
            <img
              src={iconMap[item.iconKey]}
              alt=""
              className="service-reports__stat-icon-image"
            />
          </div>
          <div className="service-reports__stat-copy">
            <div className="service-reports__stat-value">
              {item.valuePrefix === "AED" ? (
                <img
                  src={reportsAnalyticsAedPrefixIcon}
                  alt="AED"
                  className="service-reports__stat-value-prefix-icon"
                />
              ) : null}
              <span>{formatKpiValue(item.key, item.value)}</span>
            </div>
            <div className="service-reports__stat-label">
              {item.titleKey ? translate(item.titleKey) : item.key}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
