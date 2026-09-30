import { Divider } from "antd"
import "./index.less"

export const PermitDistribution = () => {
  return (
    <div className="permit-distribution-container">
      <div className="distribution-title">
        <b>Permit Distribution by Status</b>
      </div>
      <div className="distribution-content">
        <div className="distribution-item">
          <span className="item-title-name">Adoption Rate</span>
          <b>12</b>
        </div>
        <div className="distribution-item">
          <span className="item-title-name">Avg. Processing Time</span>
          <b>12</b>
        </div>
        <div className="distribution-item">
          <span className="item-title-name">Avg. Processing Time</span>
          <b>12</b>
        </div>
        <Divider className="item-divider" />
        <div className="distribution-item">
          <span className="item-title-name">Total</span>
          <b>36</b>
        </div>
      </div>
    </div>
  )
}
