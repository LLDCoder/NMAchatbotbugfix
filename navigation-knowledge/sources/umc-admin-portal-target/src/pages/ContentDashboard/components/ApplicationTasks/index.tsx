import { Tag } from "antd"
import EnterpriseIcon from "@/assets/images/enterprise.svg"
import { useTranslation } from "react-i18next"
import "./index.less"

export const ApplicationTasks = () => {
  const { t } = useTranslation()
  const tasks = [
    {
      status: t("Content.contentDashboard.task.running"),
      remaining: t("Content.contentDashboard.task.hoursRemaining", { count: 3 }),
      suggestion: t("Content.contentDashboard.task.suggestion", { number: 1 }),
      suggestionStatus: t("Content.contentDashboard.task.success"),
      license: t("Content.contentDashboard.task.license", { number: 1 }),
      hub: t("Content.contentDashboard.task.hub", { number: 1 }),
    },
  ]
  const renderTaskItems = () => {
    return tasks.map((item, i) => (
      <div className="application-tasks-item" key={i}>
        <div className="item-status">
          <Tag className="item-status-tag">{item.status}</Tag>
          <span className="item-remaining">{item.remaining}</span>
        </div>
        <div className="item-suggestion item-gap">
          {item.suggestion}:<Tag color="error">{item.suggestionStatus}</Tag>
        </div>
        <div className="item-license item-gap">
          <b>{item.license}</b>
        </div>
        <div className="item-hub item-gap">
          <img src={EnterpriseIcon} alt="" />
          <span className="hub-name">{item.hub}</span>
        </div>
      </div>
    ))
  }

  return (
    <div className="application-tasks-container">
      <div className="application-tasks-title">
        <b>{t("Content.contentDashboard.sections.applicationTasks")}</b>
        <span>{"->"}</span>
      </div>
      <div className="application-tasks">{renderTaskItems()}</div>
    </div>
  )
}
