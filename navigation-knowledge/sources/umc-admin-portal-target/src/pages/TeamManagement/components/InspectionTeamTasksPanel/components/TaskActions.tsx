import React from "react"
import AdaptiveActionGroup from "@/components/common/AdaptiveActionGroup"
import { inspectionFigmaAssets } from "@/pages/InspectionCommon/assets"
import { useTranslation } from "react-i18next"
import type { TaskAction } from "../type"

const TaskActions: React.FC<{ actions: TaskAction[] }> = ({ actions }) => {
  const { t } = useTranslation()

  return (
    <AdaptiveActionGroup
      actions={actions}
      maxInlineActions={2}
      moreLabel={t("common.moreActions")}
      className="inspection-task-management__actions"
      menuClassName="inspection-task-management__row-menu"
      emptyClassName="inspection-task-management__actions-empty"
      moreButtonClassName="inspection-task-management__more-button"
      moreIcon={(
        <img
          className="inspection-task-management__more-icon"
          src={inspectionFigmaAssets.moreVerticalIcon}
          alt=""
        />
      )}
    />
  )
}

export default TaskActions
