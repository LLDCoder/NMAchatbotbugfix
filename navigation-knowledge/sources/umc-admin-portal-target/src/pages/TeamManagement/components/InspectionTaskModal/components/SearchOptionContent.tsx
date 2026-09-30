import React from "react"
import { inspectionFigmaAssets } from "@/pages/InspectionCommon/assets"
import type { InspectionTargetSearchOption } from "@/services/inspection"

const SearchOptionContent: React.FC<{ option: InspectionTargetSearchOption }> = ({
  option,
}) => (
  <div className="inspection-task-management__search-option">
    <span className="inspection-task-management__search-option-icon">
      <img
        src={option.targetType === "individual"
          ? inspectionFigmaAssets.taskTargetIcons.user
          : inspectionFigmaAssets.taskTargetIcons.company}
        alt=""
      />
    </span>
    <span className="inspection-task-management__search-option-content">
      <strong>{option.title}</strong>
      <small>{option.subtitle}</small>
    </span>
  </div>
)

export default SearchOptionContent
