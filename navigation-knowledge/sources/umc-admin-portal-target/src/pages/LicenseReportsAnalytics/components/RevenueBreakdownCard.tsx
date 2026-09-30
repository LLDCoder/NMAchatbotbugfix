import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs } from "antd";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import type { HorizontalBarData } from "../type";

type RevenueTab = "activities" | "services" | "applicationTypes";

interface RevenueBreakdownCardProps {
  topActivitiesByRevenue: HorizontalBarData;
  topServicesByRevenue: HorizontalBarData;
  revenueByApplicationType: HorizontalBarData;
}

function RevenueBarList({ data }: { data: HorizontalBarData }) {
  const { t } = useTranslation();
  const items = data.items;
  const maxValue = items.reduce((max, item) => Math.max(max, item.value), 0);

  if (items.length === 0) {
    return (
      <div className="reports-chart-empty">
        <EmptyBox title={t("common.noData")} />
      </div>
    );
  }

  return (
    <div className="reports-bar-list">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="reports-bar-row reports-bar-row-revenue">
          <div className="reports-bar-name reports-bar-name-right">{item.label}</div>
          <div className="reports-bar-scale">
            <div
              className="reports-bar-fill-anchor"
              style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
            >
              <div className="reports-bar-fill" style={{ backgroundColor: data.color }} />
            </div>
            <span className="reports-bar-value-outside">
              {item.value.toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RevenueBreakdownCard({
  topActivitiesByRevenue,
  topServicesByRevenue,
  revenueByApplicationType,
}: RevenueBreakdownCardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<RevenueTab>("activities");

  const tabs = [
    {
      key: "activities" as RevenueTab,
      label: t("licenseReportsAnalytics.revenueBreakdown.topActivities"),
      data: topActivitiesByRevenue,
    },
    {
      key: "services" as RevenueTab,
      label: t("licenseReportsAnalytics.revenueBreakdown.topServices"),
      data: topServicesByRevenue,
    },
    {
      key: "applicationTypes" as RevenueTab,
      label: t("licenseReportsAnalytics.revenueBreakdown.byApplicationType"),
      data: revenueByApplicationType,
    },
  ];

  const activeData =
    tabs.find((tab) => tab.key === activeTab)?.data ?? topActivitiesByRevenue;

  return (
    <div className="reports-card analytics-card-surface reports-revenue-breakdown-card">
      <Tabs
        className="reports-tabs reports-tabs-revenue"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as RevenueTab)}
      >
        {tabs.map((tab) => (
          <Tabs.TabPane tab={tab.label} key={tab.key} />
        ))}
      </Tabs>
      <RevenueBarList data={activeData} />
    </div>
  );
}
