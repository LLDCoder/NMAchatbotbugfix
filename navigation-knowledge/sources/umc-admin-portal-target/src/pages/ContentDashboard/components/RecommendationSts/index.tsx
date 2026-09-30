import { Divider } from "antd"
import { useTranslation } from "react-i18next"
import "./index.less"

export const RecommendationSts = () => {
  const { t } = useTranslation()
  return (
    <div className="recommendation-sts-container">
      <div className="sts-title">
        <b>{t("Content.contentDashboard.sections.recommendationStatistics")}</b>
      </div>
      <div className="sts-content">
        <div className="sts-item">
          <div className="item-title">
            <span className="item-title-name">{t("Content.contentDashboard.metrics.adoptionRate")}</span>
            <b>80%</b>
          </div>
          <div className="item-percent">+2.3%</div>
        </div>
        <Divider className="item-divider" />
        <div className="sts-item">
          <div className="item-title">
            <span className="item-title-name">{t("adminDashboard.metrics.avgProcessingTime")}</span>
            <b>46h 23m</b>
          </div>
          <div className="item-percent">+2h 10m</div>
        </div>
      </div>
    </div>
  )
}
