import React from "react";
import { Card } from "antd";
import { useTranslation } from "react-i18next";
import type { DetailSectionProps } from "./type";

const DetailSection: React.FC<DetailSectionProps> = ({ title, extra, children }) => {
  const { i18n } = useTranslation();
  const titleDir = i18n.language?.startsWith("ar") ? "rtl" : "ltr";

  return (
    <Card bordered={false} className="detail-section">
      <div className="detail-section-header">
        <div className="section-title" dir={titleDir}>
          {title}
        </div>
        {extra && <div className="section-extra">{extra}</div>}
      </div>
      <div className="detail-section-body">{children}</div>
    </Card>
  );
};

export default DetailSection;
