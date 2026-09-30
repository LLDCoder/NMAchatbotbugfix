import "./type"
import "./index.less"
import type { IProps } from "./type"
import type { FC } from "react"
import expandIcon from "@/assets/images/expand_icon.svg"
import shrinkIcon from "@/assets/images/shrink_icon.svg"

export const ExpandBtn: FC<IProps> = ({
  isExpanded = false,
  className = "",
  onShrinkClick,
  onExpandClick,
}) => {
  return (
    <div className={`expand-btn-container ${className}`}>
      {!isExpanded ? (
        <img className="expand-icon" src={expandIcon} onClick={onExpandClick} />
      ) : (
        <img className="shrink-icon" src={shrinkIcon} onClick={onShrinkClick} />
      )}
    </div>
  )
}
