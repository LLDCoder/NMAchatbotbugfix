import { transformNoValueString } from "@/utils/transform"
import type { FC } from "react"
import type { IProps } from "./type"
import "./index.less"

export const CountPanel: FC<IProps> = ({ countList }) => {
  return (
    <div className="count-panel-job">
      {countList.map((item, index) => {
        const iconClassName = item?.key === "rejected"
          ? "count-icon count-icon-rejected"
          : "count-icon"
        return (
          <div key={index} className="count-card">
            <div className={iconClassName}>
              <img src={item?.icon} alt="" />
            </div>
            <div className="count-content">
              <div className="count-value">
                {transformNoValueString(item?.value)}
              </div>
              <div className="count-label">{item?.name}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
