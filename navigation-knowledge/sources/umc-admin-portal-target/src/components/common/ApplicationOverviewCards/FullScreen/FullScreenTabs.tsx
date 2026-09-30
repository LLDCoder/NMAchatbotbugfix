import React from "react"
import { Tabs } from "antd"

type FullScreenTabsProps = {
  activeTab: string
  onChange: (key: string) => void
  getTabLabel: (key: string, fallbackLabel: string) => string
  t: (key: string) => string
}

const FullScreenTabs: React.FC<FullScreenTabsProps> = ({
  activeTab,
  onChange,
  getTabLabel,
  t,
}) => {
  return (
    <Tabs
      activeKey={activeTab}
      onChange={onChange}
      className="customer-details-tabs"
    >
      <Tabs.TabPane
        tab={getTabLabel(
          "basic-information",
          t("applicationOverviewCards.tabs.basicInformation"),
        )}
        key="basic-information"
      />
      <Tabs.TabPane
        tab={getTabLabel(
          "applications",
          t("applicationOverviewCards.tabs.applications"),
        )}
        key="applications"
      />
      <Tabs.TabPane
        tab={getTabLabel(
          "payments",
          t("applicationOverviewCards.tabs.payments"),
        )}
        key="payments"
      />
      <Tabs.TabPane
        tab={getTabLabel(
          "licenses",
          t("applicationOverviewCards.tabs.licensesPermits"),
        )}
        key="licenses"
      />
      <Tabs.TabPane tab={getTabLabel("tickets", t("menu.tickets"))} key="tickets" />
      <Tabs.TabPane
        tab={getTabLabel(
          "inspection",
          t("applicationOverviewCards.tabs.inspection"),
        )}
        key="inspection"
      />
      <Tabs.TabPane
        tab={getTabLabel(
          "violations-fines",
          t("applicationOverviewCards.tabs.violationsFines"),
        )}
        key="violations-fines"
      />
      <Tabs.TabPane
        tab={getTabLabel("refunds", t("applicationOverviewCards.tabs.refunds"))}
        key="refunds"
      />
      <Tabs.TabPane
        tab={getTabLabel("appeal", t("applicationOverviewCards.tabs.appeal"))}
        key="appeal"
      />
    </Tabs>
  )
}

export default FullScreenTabs
