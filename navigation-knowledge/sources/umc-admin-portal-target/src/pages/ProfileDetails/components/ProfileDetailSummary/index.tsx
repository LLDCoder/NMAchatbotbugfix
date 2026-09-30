import React from "react";
import { Card } from "antd";
import { useTranslation } from "react-i18next";
import errorDot from "@/assets/images/errorDot.svg";
import type { ProfileDetailSummaryProps } from "./type";

const ProfileDetailSummary: React.FC<ProfileDetailSummaryProps> = ({
  title,
  tag,
  summaryItems,
  showRejectReason,
  rejectReason,
}) => {
  const { i18n } = useTranslation();
  const titleDir = i18n.language?.startsWith("ar") ? "rtl" : "ltr";

  return (
    <Card bordered={false} className="details-summary-card">
      <div className="summary-header">
        <div className="summary-header-left">
          <div className="summary-title" dir={titleDir}>
            {title}
          </div>
          {tag && <span className="summary-badge">{tag}</span>}
        </div>
      </div>
      <div className="summary-metrics">
        {summaryItems.map((item) => (
          <div key={item.key} className="summary-item">
            <div className="profile-details-summary__icon-background">
              <img
                className="profile-details-summary__icon"
                src={item.icon}
                alt=""
              />
            </div>
            <div className="summary-item-content">
              <div className="summary-item-label">{item.label}</div>
              <div
                className={[
                  "summary-item-value",
                  item.tone ? `tone-${item.tone}` : "",
                  item.valueClassName || "",
                ].join(" ")}
              >
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>
      {showRejectReason && (
        <div className="_reject-reason">
          <img src={errorDot} alt="" />
          {rejectReason || "-"}
        </div>
      )}
    </Card>
  );
};

export default ProfileDetailSummary;
