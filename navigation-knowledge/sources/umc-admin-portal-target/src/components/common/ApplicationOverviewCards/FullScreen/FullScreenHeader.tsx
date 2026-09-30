import React from "react"
import ShrinkIcon from "@/assets/images/shrink_icon.svg"
import SelfMonitorBadge, {
  type SelfMonitorProgramInfo,
} from "@/components/common/SelfMonitorBadge"
import { useTranslation } from "react-i18next"

type FullScreenHeaderProps = {
  title: string
  statusText: string
  profileStatusClassName: string
  /** Null / absent for establishments with no Self-Monitor record. */
  selfMonitorProgram?: SelfMonitorProgramInfo | null
  onClose: () => void
}

const FullScreenHeader: React.FC<FullScreenHeaderProps> = ({
  title,
  statusText,
  profileStatusClassName,
  selfMonitorProgram,
  onClose,
}) => {
  const { t } = useTranslation()

  return (
    <div className="application-overview-fullscreen__header">
      <div className="application-overview-fullscreen__title-content">
        <span className="application-overview-fullscreen__title">{title}</span>
        {/* Sole occupant of the tier slot: VIP and Standard are retired, and the
            badge renders nothing when there is no Self-Monitor programme. */}
        <SelfMonitorBadge program={selfMonitorProgram} />
        <span
          className={`application-overview-fullscreen__status-badge application-overview-fullscreen__status-badge--${profileStatusClassName}`}
        >
          {statusText}
        </span>
      </div>

      <button
        type="button"
        className="application-overview-fullscreen__collapse-button"
        onClick={onClose}
        aria-label={t("common.collapseOverview")}
      >
        <img src={ShrinkIcon} alt="" />
      </button>
    </div>
  )
}

export default FullScreenHeader
