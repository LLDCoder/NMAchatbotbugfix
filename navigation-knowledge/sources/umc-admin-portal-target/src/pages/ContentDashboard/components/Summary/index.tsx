import { Divider } from "antd"
import { useTranslation } from "react-i18next"
import "./index.less"

export const Summary = () => {
  const { t } = useTranslation()
  return (
    <div className="summary-container">
      <div className="summary-title">
        <b>{t("Content.contentDashboard.sections.summary")}</b>
      </div>
      <div className="summary-content">
        <div className="summary-item">
          <span className="item-title-name">{t("Content.contentDashboard.metrics.adoptionRate")}</span>
          <b>80%</b>
        </div>
        <Divider className="item-divider" />
        <div className="summary-item">
          <span className="item-title-name">{t("adminDashboard.metrics.avgProcessingTime")}</span>
          <b>46h 23m</b>
        </div>
        <Divider className="item-divider" />
        <div className="summary-item">
          <span className="item-title-name">{t("adminDashboard.metrics.avgProcessingTime")}</span>
          <b>46h 23m</b>
        </div>
      </div>
    </div>
  )
}
