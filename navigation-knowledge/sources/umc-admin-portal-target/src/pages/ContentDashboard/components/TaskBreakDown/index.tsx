import "./index.less"
import { useTranslation } from "react-i18next"

export const TaskBreakDown = () => {
  const { t } = useTranslation()
  const data = [
    {
      name: t("Content.contentApplications.tabs.todo"),
      value: 2,
    },
    {
      name: t("Content.contentDashboard.taskStatuses.pendingReview"),
      value: 23,
    },
    {
      name: t("Content.contentDashboard.taskStatuses.pendingModification"),
      value: 4,
    },
    {
      name: t("Content.contentDashboard.taskStatuses.externalApproval"),
      value: 5,
    },
    {
      name: t("Content.contentDashboard.taskStatuses.exportVerification"),
      value: 78,
    },
  ]

  return (
    <div className="task-breakdown-container">
      <div className="breakdown-title">
        <b>{t("Content.contentDashboard.sections.taskBreakdown")}</b>
      </div>
      <div className="breakdown-content">
        {data.map((item, i) => (
          <div className="breakdown-item" key={i}>
            <div className="item-value">
              <b>{item.value}</b>
            </div>
            <div className="item-name">{item.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
