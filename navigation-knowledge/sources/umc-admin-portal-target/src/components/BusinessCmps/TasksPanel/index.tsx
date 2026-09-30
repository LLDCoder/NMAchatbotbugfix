import { useMemo, type FC } from "react"
import type { IProps, ITaskStatus } from "./type"
import AppTodo from "@/assets/images/app-todo.png"
import AppReview from "@/assets/images/app-review.png"
import AppModify from "@/assets/images/app-modify.png"
import pendingDispositionIcon from "@/assets/images/pendingDispositionIcon.png"
import dispositionVerificationIcon from "@/assets/images/dispositionVerificationIcon.png"
import AppExternal from "@/assets/images/app-external.png"
import GridIcon from "@/assets/images/GridIcon.png"
import PendingReviewIcon from "@/assets/images/review.svg"
import DocumentIcon from "@/assets/images/document.svg"
import TodoIcon from "@/assets/images/application-statistics-todo.svg"
import ModificationIcon from "@/assets/images/application-statistics-modification.svg"
import ExternalApprovalIcon from "@/assets/images/application-statistics-external-approval.svg"
import CompletedIcon from "@/assets/images/application-statistics-completed.svg"
import "./index.less"
import { transformNoValueString } from "@/utils/transform"
import { useTranslation } from "react-i18next";

// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_STATUS: ITaskStatus = {
  completedCount: 0,
  externalApproveCount: 0,
  pendingModificationCount: 0,
  pendingReviewCount: 0,
  todoCount: 0,
  pendingDispositionCount: 0,
  dispositionVerificationCount: 0,
}

export const TasksPanel: FC<IProps> = ({ status, variant = "default" }) => {

  const { t } = useTranslation()
  const {
    todoCount,
    pendingReviewCount,
    pendingModificationCount,
    externalApproveCount,
    completedCount,
    pendingDispositionCount,
    dispositionVerificationCount,
  } = status

  const cardList = useMemo(
    () => [
      {
        icon: AppTodo,
        figmaIcon: TodoIcon,
        name: t("applications.statistics.todo"),
        value: todoCount,
      },
      {
        icon: AppReview,
        figmaIcon: PendingReviewIcon,
        name: t("applications.statistics.pendingReview"),
        value: pendingReviewCount,
      },
      {
        icon: AppModify,
        figmaIcon: ModificationIcon,
        name: t("applications.statistics.pendingModification"),
        value: pendingModificationCount,
      },
      {
        icon: pendingDispositionIcon,
        figmaIcon: PendingReviewIcon,
        name: t("applications.statistics.pendingDisposition"),
        value: pendingDispositionCount ?? 0,
      },
      {
        icon: dispositionVerificationIcon,
        figmaIcon: DocumentIcon,
        name: t("applications.statistics.dispositionVerification"),
        value: dispositionVerificationCount ?? 0,
      },
      {
        icon: AppExternal,
        figmaIcon: ExternalApprovalIcon,
        name: t("applications.statistics.externalReview"),
        value: externalApproveCount,
      },
      {
        icon: GridIcon,
        figmaIcon: CompletedIcon,
        name: t("applications.statistics.completed"),
        value: completedCount,
        completed: true,
      },
    ],
    [
      todoCount,
      pendingReviewCount,
      pendingModificationCount,
      externalApproveCount,
      completedCount,
      pendingDispositionCount,
      dispositionVerificationCount,
      t,
    ]
  )

  return (
    <div
      className={`tasks-panel${
        variant === "applicationStatistics"
          ? " tasks-panel--application-statistics"
          : ""
      }`}
    >
      {cardList.map((item, index) => {
        return (
          <div key={index} className="task-card">
            {variant === "applicationStatistics" ? (
              <div
                className={`task-card__icon-background${
                  item.completed ? " task-card__icon-background--completed" : ""
                }`}
              >
                <img src={item.figmaIcon} alt="" className="task-card__icon" />
              </div>
            ) : (
              <img src={item.icon} alt="" className="task-icon" />
            )}
            <div className="task-content">
              <div className="task-value">
                {transformNoValueString(item.value)}
              </div>
              <div className="task-label">{item.name}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
