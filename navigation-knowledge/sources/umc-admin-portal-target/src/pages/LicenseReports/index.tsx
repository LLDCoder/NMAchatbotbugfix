import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.less";
import OverviewTab from "./components/OverviewTab";
import InsightsTab from "./components/InsightsTab";
import LicenseTab from "./components/LicenseTab";

export default function License() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");

  const handleTabClick = (tabKey: string) => {
    setActiveTab(tabKey);
  };

  return (
    <div className="performanceanalytics-container">
      <div className="one-card">
        <div
          className={`tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => handleTabClick("overview")}
        >
          Service Operations Analytics
        </div>
        <div
          className={`tab ${activeTab === "insights" ? "active" : ""}`}
          onClick={() => handleTabClick("insights")}
        >
          Profile Analytics
        </div>
        <div
          className={`tab ${activeTab === "license" ? "active" : ""}`}
          onClick={() => handleTabClick("license")}
        >
          License Management
        </div>
      </div>
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "insights" && <InsightsTab />}
      {activeTab === "license" && <LicenseTab />}
    </div>
  );
}
