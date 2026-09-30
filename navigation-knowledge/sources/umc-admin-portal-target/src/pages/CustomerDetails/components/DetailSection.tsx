import React from "react";
import { Card } from "antd";

const DetailSection: React.FC<{
  title: string;
  extra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, extra, className, children }) => (
  <Card bordered={false} className={["detail-section", className].filter(Boolean).join(" ")}>
    <div className="detail-section-header">
      <div className="section-title">{title}</div>
      <div className="section-extra">{extra}</div>
    </div>
    <div className="detail-section-body">{children}</div>
  </Card>
);

export default DetailSection;
