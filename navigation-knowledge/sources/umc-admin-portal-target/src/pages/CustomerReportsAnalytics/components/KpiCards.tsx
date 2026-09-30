import { useTranslation } from "react-i18next";
import { Tooltip } from "antd";
import {
  TeamOutlined,
  SendOutlined,
  CheckCircleOutlined,
  StarOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import KpiInProgress from "@/assets/icons/KpiInProgress";
import KpiAvgProcessingTime from "@/assets/icons/KpiAvgProcessingTime";
import KpiSlaCompliance from "@/assets/icons/KpiSlaCompliance";
import KpiSlaBreaches from "@/assets/icons/KpiSlaBreaches";
import KpiReopenRate from "@/assets/icons/KpiReopenRate";
import type { CustomerInsightsSummaryData, OperationalInsightsSummaryData } from "../type";

interface CustomerInsightsKpiProps {
  data: CustomerInsightsSummaryData;
}

interface OperationalInsightsKpiProps {
  data: OperationalInsightsSummaryData;
}

function KpiCard({
  icon,
  value,
  label,
  tooltip,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  tooltip?: string;
}) {
  return (
    <div className="customer-reports__kpi-card content-reports__card-surface">
      <div className="customer-reports__kpi-icon">{icon}</div>
      <div className="customer-reports__kpi-copy">
        <div className="customer-reports__kpi-value">{value}</div>
        <div className="customer-reports__kpi-label">
          <span className="customer-reports__kpi-label-text">{label}</span>
          {tooltip && (
            <Tooltip title={tooltip}>
              <QuestionCircleOutlined className="customer-reports__kpi-info-icon" />
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

export function CustomerInsightsKpiCards({ data }: CustomerInsightsKpiProps) {
  const { t: translate } = useTranslation();
  const asOfYesterday = translate("customerReportsAnalytics.kpi.tooltipAsOfYesterday");
  const selectedPeriod = translate("customerReportsAnalytics.kpi.tooltipSelectedPeriod");

  return (
    <div className="customer-reports__kpi-grid-4">
      <KpiCard
        icon={<TeamOutlined />}
        value={data.totalRegisteredUsers.toLocaleString()}
        label={translate("customerReportsAnalytics.kpi.totalUsers")}
        tooltip={asOfYesterday}
      />
      <KpiCard
        icon={<SendOutlined />}
        value={data.newUsersInRange.toLocaleString()}
        label={translate("customerReportsAnalytics.kpi.newUsers")}
        tooltip={selectedPeriod}
      />
      <KpiCard
        icon={<CheckCircleOutlined />}
        value={data.totalApprovedProfiles.toLocaleString()}
        label={translate("customerReportsAnalytics.kpi.totalApprovedProfiles")}
        tooltip={asOfYesterday}
      />
      <KpiCard
        icon={<StarOutlined />}
        value={data.newApprovedProfilesInRange.toLocaleString()}
        label={translate("customerReportsAnalytics.kpi.newlyApprovedProfiles")}
        tooltip={selectedPeriod}
      />
    </div>
  );
}

export function OperationalInsightsKpiCards({ data }: OperationalInsightsKpiProps) {
  const { t: translate } = useTranslation();

  return (
    <div className="customer-reports__kpi-grid-5">
      <KpiCard
        icon={<KpiInProgress />}
        value={data.inProgressCount.toLocaleString()}
        label={translate("customerReportsAnalytics.kpi.inProgressCount")}
      />
      <KpiCard
        icon={<KpiAvgProcessingTime />}
        value={data.avgProcessingTime.display}
        label={translate("customerReportsAnalytics.kpi.avgProcessingTime")}
      />
      <KpiCard
        icon={<KpiSlaCompliance />}
        value={`${Number(data.slaComplianceRate).toFixed(1)}%`}
        label={translate("customerReportsAnalytics.kpi.slaComplianceRate")}
        tooltip={translate("customerReportsAnalytics.kpi.tooltipSlaCompliance")}
      />
      <KpiCard
        icon={<KpiSlaBreaches />}
        value={data.slaBreachesCount.toLocaleString()}
        label={translate("customerReportsAnalytics.kpi.slaBreachesCount")}
        tooltip={translate("customerReportsAnalytics.kpi.tooltipSlaBreaches")}
      />
      <KpiCard
        icon={<KpiReopenRate />}
        value={`${Number(data.reopenRate).toFixed(1)}%`}
        label={translate("customerReportsAnalytics.kpi.reopenRate")}
        tooltip={translate("customerReportsAnalytics.kpi.tooltipReopenRate")}
      />
    </div>
  );
}
