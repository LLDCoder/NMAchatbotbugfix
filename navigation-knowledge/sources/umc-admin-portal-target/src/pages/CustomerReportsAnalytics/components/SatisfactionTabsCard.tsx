import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs } from "antd";
import ServiceSatisfactionTable from "./ServiceSatisfactionTable";
import CustomerTeamPerformanceTable from "./CustomerTeamPerformanceTable";
import type {
  ServiceSatisfactionRow,
  CustomerTeamPerformanceRow,
  AnalyticsSortOrder,
  PaginatedResult,
} from "../type";

interface SatisfactionTabsCardProps {
  serviceSatLoading: boolean;
  serviceSatResult: PaginatedResult<ServiceSatisfactionRow>;
  serviceSatKeyword: string;
  serviceSatSortBy?: string;
  serviceSatSortDir?: AnalyticsSortOrder;
  onServiceSatSearchChange: (value: string) => void;
  onServiceSatTableChange: (page: number, pageSize: number, sortBy?: string, sortDirection?: AnalyticsSortOrder) => void;
  onServiceSatExport?: () => void;

  teamPerfLoading: boolean;
  teamPerfResult: PaginatedResult<CustomerTeamPerformanceRow>;
  teamPerfKeyword: string;
  teamPerfSortBy?: string;
  teamPerfSortDir?: AnalyticsSortOrder;
  onTeamPerfSearchChange: (value: string) => void;
  onTeamPerfTableChange: (page: number, pageSize: number, sortBy?: string, sortDirection?: AnalyticsSortOrder) => void;
  onTeamPerfExport?: () => void;
}

export default function SatisfactionTabsCard({
  serviceSatLoading,
  serviceSatResult,
  serviceSatKeyword,
  serviceSatSortBy,
  serviceSatSortDir,
  onServiceSatSearchChange,
  onServiceSatTableChange,
  onServiceSatExport,
  teamPerfLoading,
  teamPerfResult,
  teamPerfKeyword,
  teamPerfSortBy,
  teamPerfSortDir,
  onTeamPerfSearchChange,
  onTeamPerfTableChange,
  onTeamPerfExport,
}: SatisfactionTabsCardProps) {
  const { t: translate } = useTranslation();
  const [activeTab, setActiveTab] = useState("serviceSatisfaction");

  const handleTabChange = (nextTab: string) => {
    if (nextTab === "teamPerformance") {
      // leaving serviceSatisfaction → reset its search and sort
      onServiceSatSearchChange("");
      onServiceSatTableChange(1, serviceSatResult.pageSize, undefined, undefined);
    } else if (nextTab === "serviceSatisfaction") {
      // leaving teamPerformance → reset its search and sort
      onTeamPerfSearchChange("");
      onTeamPerfTableChange(1, teamPerfResult.pageSize, undefined, undefined);
    }
    setActiveTab(nextTab);
  };

  return (
    <div className="content-reports__card-surface customer-reports__satisfaction-tabs-card">
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        className="customer-reports__satisfaction-tabs"
      >
        <Tabs.TabPane
          key="serviceSatisfaction"
          tab={translate("customerReportsAnalytics.tables.serviceLevelSatisfaction")}
        >
          <ServiceSatisfactionTable
            loading={serviceSatLoading}
            rows={serviceSatResult.rows}
            totalCount={serviceSatResult.totalCount}
            page={serviceSatResult.page}
            pageSize={serviceSatResult.pageSize}
            searchKeyword={serviceSatKeyword}
            sortBy={serviceSatSortBy}
            sortDirection={serviceSatSortDir}
            onSearchChange={onServiceSatSearchChange}
            onTableChange={onServiceSatTableChange}
            onExport={onServiceSatExport}
          />
        </Tabs.TabPane>
        <Tabs.TabPane
          key="teamPerformance"
          tab={translate("customerReportsAnalytics.tables.teamPerformance")}
        >
          <CustomerTeamPerformanceTable
            loading={teamPerfLoading}
            rows={teamPerfResult.rows}
            totalCount={teamPerfResult.totalCount}
            page={teamPerfResult.page}
            pageSize={teamPerfResult.pageSize}
            searchKeyword={teamPerfKeyword}
            sortBy={teamPerfSortBy}
            sortDirection={teamPerfSortDir}
            onSearchChange={onTeamPerfSearchChange}
            onTableChange={onTeamPerfTableChange}
            onExport={onTeamPerfExport}
          />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
