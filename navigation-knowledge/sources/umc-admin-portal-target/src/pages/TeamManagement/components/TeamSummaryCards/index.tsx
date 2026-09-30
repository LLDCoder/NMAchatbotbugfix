import type { FC } from "react"
import {
  AppstoreOutlined,
  AuditOutlined,
  AlertOutlined,
  FileTextOutlined,
  IdcardOutlined,
  MessageOutlined,
  WalletOutlined,
} from "@ant-design/icons"
import { useTranslation } from "react-i18next"
import { getTaskCategoryLabel } from "../../utils"
import type { SummaryCardItem, TeamSummaryCardsProps } from "./type"
import "./index.less"

export const TeamSummaryCards: FC<TeamSummaryCardsProps> = ({
  scope,
  summary,
  supportedTaskCategories,
}) => {
  const { t } = useTranslation()

  const fullCards: SummaryCardItem[] = [
    {
      key: "todo",
      labelKey: "teamManagement.summary.todo",
      value: summary.todoCount,
      icon: <AppstoreOutlined />,
    },
    {
      key: "applications",
      labelKey: "teamManagement.categories.applications",
      value: summary.applicationsCount,
      icon: <FileTextOutlined />,
      label: summary.categoryLabels?.applications,
      category: "applications",
    },
    {
      key: "profileVerifications",
      labelKey: "teamManagement.categories.profileVerifications",
      value: summary.profileVerificationsCount,
      icon: <IdcardOutlined />,
      label: summary.categoryLabels?.profileVerifications,
      category: "profileVerifications",
    },
    {
      key: "enquiries",
      labelKey: "teamManagement.categories.enquiries",
      value: summary.enquiriesCount,
      icon: <MessageOutlined />,
      label: summary.categoryLabels?.enquiries,
      category: "enquiries",
    },
    {
      key: "refunds",
      labelKey: "teamManagement.categories.refunds",
      value: summary.refundsCount,
      icon: <WalletOutlined />,
      label: summary.categoryLabels?.refunds,
      category: "refunds",
    },
    {
      key: "appeals",
      labelKey: "teamManagement.categories.appeals",
      value: summary.appealsCount,
      icon: <AuditOutlined />,
      label: summary.categoryLabels?.appeals,
      category: "appeals",
    },
    {
      key: "inspectionTasks",
      labelKey: "teamManagement.categories.inspectionTasks",
      value: summary.inspectionTasksCount,
      icon: <AppstoreOutlined />,
      label: summary.categoryLabels?.inspectionTasks,
      category: "inspectionTasks",
    },
    {
      key: "violations",
      labelKey: "teamManagement.categories.violations",
      value: summary.violationsCount,
      icon: <AlertOutlined />,
      label: summary.categoryLabels?.violations,
      category: "violations",
    },
  ]
  const cards = fullCards.filter(
    (card) =>
      !card.category || supportedTaskCategories.includes(card.category)
  )

  return (
    <div
      className={`team-management-overview-grid team-management-overview-grid--${scope}`}
    >
      {cards.map((card) => (
        <div className="team-management-overview-card" key={card.key}>
          <div className="team-management-overview-card__icon">{card.icon}</div>
          <div className="team-management-overview-card__content">
            <strong className="team-management-overview-card__value">
              {card.value ?? 0}
            </strong>
            <span className="team-management-overview-card__label">
              {card.category
                ? (scope === "customer" && card.category === "enquiries") ||
                  scope === "content"
                  ? getTaskCategoryLabel(card.category, t, scope)
                  : card.label || getTaskCategoryLabel(card.category, t, scope)
                : card.label || t(card.labelKey)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
