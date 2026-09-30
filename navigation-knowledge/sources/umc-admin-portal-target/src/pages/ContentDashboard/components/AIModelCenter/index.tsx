import { Divider } from "antd"
import { useTranslation } from "react-i18next"
import "./index.less"

export const AIModelCenter = () => {
  const { t } = useTranslation()
  const renderApplicationsItems = () => {
    return (
      <div className="application-item safe">
        <div className="item-content">
          <span>{t("Content.contentDashboard.aiModelCenter.image")}</span>
          <div className="item-content-text">
            <span>{t("Content.contentDashboard.aiModelCenter.highRiskApplications")}</span>
            <b>89</b>
          </div>
        </div>
        <Divider className="item-divider" />
        <div className="item-violations">
          <p>{t("Content.contentDashboard.aiModelCenter.violations")}</p>
          {/* NOTE multiple violations */}
          <span className="item-violations-content">
            {t("Content.contentDashboard.aiModelCenter.terrorismRelatedContent")}
          </span>
          <span className="item-violations-content">
            {t("Content.contentDashboard.aiModelCenter.moreCount", { count: 1 })}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="model-center-container">
      <div className="model-center-title">
        <b>{t("Content.contentDashboard.aiModelCenter.title")}</b>
      </div>
      <div className="model-center-items">{renderApplicationsItems()}</div>
    </div>
  )
}
