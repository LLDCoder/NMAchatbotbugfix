import "./index.less";
import { useState, useCallback } from "react";
import { Tabs } from "antd";
import { useTranslation } from "react-i18next";
import UserActivity from "./components/UserActivity";
import SecurityLogs from "./components/SecurityLogs";
import SystemOperations from "./components/SystemOperations";

export default function Logs() {
  const { t } = useTranslation();
  const apl = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      opts != null
        ? String(t(`Settings.adminPortalLogs.${key}` as never, opts))
        : String(t(`Settings.adminPortalLogs.${key}` as never)),
    [t],
  );
  const [authType, setAuthType] = useState("1");
  const renderTab = () => {
    switch (authType) {
      case "1":
        return <UserActivity />;
      case "2":
        return <SystemOperations />;
      case "3":
        return <SecurityLogs />;
      default:
        return <UserActivity />;
    }
  };
  return (
    <div className="Logs-container Logs-container--list">
      <Tabs
        className="service-table admin-table"
        defaultActiveKey={authType}
        onChange={(key) => setAuthType(key)}
      >
        <Tabs.TabPane tab={apl("tabs.userActivity")} key="1" />
        <Tabs.TabPane tab={apl("tabs.systemOperations")} key="2" />
        <Tabs.TabPane tab={apl("tabs.securityLogs")} key="3" />
      </Tabs>
      {renderTab()}
    </div>
  );
}
