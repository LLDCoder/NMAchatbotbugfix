import { useEffect, useMemo, useState, type FC } from "react"
import {
  ExclamationCircleOutlined,
  EnvironmentOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons"
import { Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import clockAvgIcon from "@/assets/images/clock_avg.svg"
import overdueTaskAlertIcon from "@/assets/images/overdue_task_alert.svg"
import overdueTaskOkIcon from "@/assets/images/overdue_task_ok.svg"
import editIcon from "@/assets/images/circle_pen_edit.svg"
import { PermissionGuard, SafeImage } from "@/components/common"
import type {
  AssignedAreaStatus,
  MemberMetricCategory,
  TeamManagementMemberCard as TeamManagementMemberCardEntity,
  TeamManagementMemberMetrics,
} from "@/services/teamManagement"
import UserImg from "@/assets/icons/UserImg"
import { TEAM_MEMBER_CATEGORIES } from "../../constants"
import {
  formatCompletedTasksValue,
  formatEmergencyLeaveDate,
  getCompletedTaskRate,
  getMemberCategoryLabel,
  resolveTeamManagementAvatarUrl,
} from "../../utils"
import type { MetricRingProps, TeamMemberCardProps } from "./type"
import SlaComplianceGauge from "../SlaComplianceGauge"
import "./index.less"

const MetricRing: FC<MetricRingProps> = ({ percent }) => {
  return (
    <div
      className="team-member-metric-ring"
      style={{
        background: `conic-gradient(#11b95d ${percent}%, #e6e8eb ${percent}% 100%)`,
      }}
    >
      <div className="team-member-metric-ring__inner" />
    </div>
  )
}

const hasMemberMetricsForCategory = (
  record: TeamManagementMemberCardEntity,
  category: MemberMetricCategory
) => category === "all" || Boolean(record.metricsByCategory?.[category])

const getMemberMetricsForCategory = (
  record: TeamManagementMemberCardEntity,
  category: MemberMetricCategory
): TeamManagementMemberMetrics =>
  record.metricsByCategory?.[category] ||
  record.metricsByCategory?.all ||
  record.metrics

const mergeMemberCardRecord = (
  currentRecord: TeamManagementMemberCardEntity,
  nextRecord: TeamManagementMemberCardEntity
): TeamManagementMemberCardEntity => {
  const mergedMetricsByCategory = {
    ...(currentRecord.metricsByCategory || {}),
    ...(nextRecord.metricsByCategory || {}),
  }

  return {
    ...currentRecord,
    ...nextRecord,
    memberName: nextRecord.memberName || currentRecord.memberName,
    metrics:
      mergedMetricsByCategory.all || nextRecord.metrics || currentRecord.metrics,
    metricsByCategory: mergedMetricsByCategory,
  }
}

export const TeamMemberCard: FC<TeamMemberCardProps> = ({
  record,
  resetKey,
  permissionRoutePath,
  resumeWorkPermissionCode,
  allowMemberLeaveActions = false,
  allowAssignedAreaActions = false,
  supportedCategories = TEAM_MEMBER_CATEGORIES,
  onOpenMarkLeave,
  onOpenResumeWork,
  onOpenSetAssignedArea,
  onOpenEditAssignedArea,
  onCategoryChange,
}) => {
  const { t } = useTranslation()
  const formatAvgProcessingTime = (minutes?: number | null) => {
    if (minutes == null || Number.isNaN(minutes)) {
      return "-"
    }

    if (minutes >= 24 * 60) {
      return t("teamManagement.duration.daysShort", {
        value: (minutes / (24 * 60)).toFixed(1),
      })
    }

    if (minutes >= 60) {
      return t("teamManagement.duration.hoursShort", {
        value: (minutes / 60).toFixed(1),
      })
    }

    return t("teamManagement.duration.minutesShort", {
      value: Math.round(minutes),
    })
  }
  const [activeCategory, setActiveCategory] =
    useState<MemberMetricCategory>("all")
  const [loading, setLoading] = useState(false)
  const [currentRecord, setCurrentRecord] = useState(record)
  const availableCategories = useMemo(
    () => {
      const categorySet = new Set(TEAM_MEMBER_CATEGORIES)

      return supportedCategories.filter((category) => categorySet.has(category))
    },
    [supportedCategories]
  )
  const displayMetrics = useMemo(
    () => getMemberMetricsForCategory(currentRecord, activeCategory),
    [activeCategory, currentRecord]
  )

  const completedPercent = useMemo(
    () =>
      getCompletedTaskRate(
        displayMetrics.completedCount,
        displayMetrics.totalAssignedCount
      ),
    [displayMetrics.completedCount, displayMetrics.totalAssignedCount]
  )

  const slaComplianceRate = useMemo(() => {
    const numericValue = Number(displayMetrics.slaComplianceRate)

    if (!Number.isFinite(numericValue)) {
      return null
    }

    return Math.max(0, Math.min(100, numericValue))
  }, [displayMetrics.slaComplianceRate])

  const overdueTone =
    Number(displayMetrics.overdueTasksCount || 0) > 0
      ? "danger"
      : "success"
  const overdueIcon =
    overdueTone === "danger" ? overdueTaskAlertIcon : overdueTaskOkIcon

  const getAssignedAreaStatusInfo = (): {
    status: AssignedAreaStatus
    label: string
    className: string
    actionLabel: string
  } => {
    const validStatuses: AssignedAreaStatus[] = ["unassigned", "assigned", "partial"]
    const status: AssignedAreaStatus = validStatuses.includes(
      currentRecord.assignedAreaStatus as AssignedAreaStatus
    )
      ? (currentRecord.assignedAreaStatus as AssignedAreaStatus)
      : "unassigned"
    const baseInfo = {
      unassigned: {
        label: t("teamManagement.memberCard.assignedAreaUnassigned"),
        className: "team-member-card__assigned-area--unassigned",
        actionLabel: t("teamManagement.memberActions.setAssignedArea"),
      },
      assigned: {
        label: currentRecord.assignedArea || t("teamManagement.memberCard.assignedAreaAssigned"),
        className: "team-member-card__assigned-area--assigned",
        actionLabel: t("teamManagement.memberActions.editAssignedArea"),
      },
      partial: {
        label: t("teamManagement.memberCard.assignedAreaPartial"),
        className: "team-member-card__assigned-area--partial",
        actionLabel: t("teamManagement.memberActions.editAssignedArea"),
      },
    }

    return { status, ...baseInfo[status] }
  }

  const assignedAreaInfo = getAssignedAreaStatusInfo()

  const handleAssignedAreaClick = () => {
    if (!allowAssignedAreaActions) {
      return
    }

    if (assignedAreaInfo.status === "unassigned") {
      onOpenSetAssignedArea(currentRecord.memberId, currentRecord.memberName)
    } else {
      onOpenEditAssignedArea(
        currentRecord.memberId,
        currentRecord.memberName,
        currentRecord.assignedAreaSelection || null
      )
    }
  }

  const leaveTooltip = (
    <div className="team-member-card__leave-tooltip">
      <div>
        {t("teamManagement.memberCard.leaveTime")}:
        {" "}
        {formatEmergencyLeaveDate(currentRecord.leaveCreatedOn)}
      </div>
      <div>
        {t("teamManagement.memberCard.reason")}:
        {" "}
        {currentRecord.leaveReason || "-"}
      </div>
    </div>
  )

  const metricTooltipMap: Record<string, string> = {
    completed: t("teamManagement.tooltips.completedTasks"),
    processing: t("teamManagement.tooltips.avgProcessingTime"),
    sla: t("teamManagement.tooltips.slaCompliance"),
    overdue: t("teamManagement.tooltips.overdueTasks"),
  }

  const handleCategoryChange = async (category: MemberMetricCategory) => {
    if (category === activeCategory || loading) {
      return
    }

    if (hasMemberMetricsForCategory(currentRecord, category)) {
      setActiveCategory(category)
      return
    }

    try {
      setLoading(true)
      const nextCard = await onCategoryChange(currentRecord.memberId, category)

      if (nextCard) {
        const mergedRecord = mergeMemberCardRecord(currentRecord, nextCard)
        setCurrentRecord(mergedRecord)

        if (hasMemberMetricsForCategory(mergedRecord, category)) {
          setActiveCategory(category)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentRecord(record)
    setActiveCategory("all")
    setLoading(false)
  }, [record, resetKey])

  const renderResumeButton = () => {
    const buttonNode = (
      <button
        type="button"
        className="team-member-card__primary-action is-resume"
        onClick={() =>
          onOpenResumeWork(currentRecord.memberId, currentRecord.memberName)
        }
      >
        {t("teamManagement.memberActions.resumeWork")}
      </button>
    )

    if (!resumeWorkPermissionCode) {
      return buttonNode
    }

    return (
      <PermissionGuard
        permissionCode={resumeWorkPermissionCode}
        routePath={permissionRoutePath}
      >
        {buttonNode}
      </PermissionGuard>
    )
  }

  return (
    <div className={`team-member-card ${loading ? "is-loading" : ""}`}>
      <div className="team-member-card__header">
        <div className="team-member-card__identity">
          <SafeImage
            src={resolveTeamManagementAvatarUrl(currentRecord.avatarUrl)}
            alt={currentRecord.memberName}
            className="team-member-card__avatar"
            fallback={
              <span className="team-member-card__avatar team-member-card__avatar--icon">
                <UserImg />
              </span>
            }
          />
          <div
            className={`team-member-card__identity-copy ${
              currentRecord.isLeave || allowAssignedAreaActions
                ? ""
                : "team-member-card__identity-copy--title-only"
            }`}
          >
            <h3>{currentRecord.memberName}</h3>
            {currentRecord.isLeave ? (
              <div className="team-member-card__leave-banner">
                <span>
                  {t("teamManagement.memberCard.emergencyLeaveReturnAt", {
                    date: formatEmergencyLeaveDate(currentRecord.expectedReturnDate),
                  })}
                </span>
                <Tooltip
                  title={leaveTooltip}
                  overlayClassName="team-member-card__tooltip team-member-card__tooltip--leave"
                >
                  <QuestionCircleOutlined />
                </Tooltip>
              </div>
            ) : null}
            {allowAssignedAreaActions && !currentRecord.isLeave ? (
              <div className="team-member-card__assigned-area-wrapper">
                <div
                  className={`team-member-card__assigned-area ${assignedAreaInfo.className}`}
                  onClick={handleAssignedAreaClick}
                >
                  <span className="team-member-card__assigned-area-icon">
                    <EnvironmentOutlined />
                  </span>
                  <span className="team-member-card__assigned-area-label">
                    {assignedAreaInfo.status === "unassigned"
                      ? t("teamManagement.memberActions.setAssignedArea")
                      : assignedAreaInfo.label}
                  </span>
                  {(assignedAreaInfo.status === "assigned" ||
                    assignedAreaInfo.status === "partial") && (
                    <span className="team-member-card__assigned-area-edit">
                      <img src={editIcon} alt="" aria-hidden="true" />
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {allowMemberLeaveActions ? (
          <div className="team-member-card__action">
            {currentRecord.isLeave ? (
              renderResumeButton()
            ) : (
              <button
                type="button"
                className="team-member-card__primary-action"
                onClick={() =>
                  onOpenMarkLeave(currentRecord.memberId, currentRecord.memberName)
                }
              >
                {t("teamManagement.memberActions.markEmergencyLeave")}
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className="team-member-card__tabs">
        {availableCategories.map((category) => (
          <button
            type="button"
            key={category}
            className={`team-member-card__tab ${
              activeCategory === category ? "is-active" : ""
            }`}
            onClick={() => void handleCategoryChange(category)}
          >
            {getMemberCategoryLabel(category, t)}
          </button>
        ))}
      </div>

      <div className="team-member-card__metrics">
        <div className="team-member-card__metric">
          <div className="team-member-card__metric-icon">
            <MetricRing percent={completedPercent} />
          </div>
          <div className="team-member-card__metric-copy">
            <strong>
              {formatCompletedTasksValue(
                displayMetrics.completedCount,
                displayMetrics.totalAssignedCount
              )}
            </strong>
            <span>
              {t("teamManagement.metrics.completedTasks")}
              <Tooltip
                title={metricTooltipMap.completed}
                overlayClassName="team-member-card__tooltip"
              >
                <QuestionCircleOutlined />
              </Tooltip>
            </span>
          </div>
        </div>

        <div className="team-member-card__metric">
          <div className="team-member-card__metric-icon team-member-card__metric-icon--success">
            <img src={clockAvgIcon} alt="" aria-hidden="true" />
          </div>
          <div className="team-member-card__metric-copy">
            <strong>
              {formatAvgProcessingTime(
                displayMetrics.averageProcessingMinutes
              )}
            </strong>
            <span>
              {t("teamManagement.metrics.avgProcessingTime")}
              <Tooltip
                title={metricTooltipMap.processing}
                overlayClassName="team-member-card__tooltip"
              >
                <QuestionCircleOutlined />
              </Tooltip>
            </span>
          </div>
        </div>

        <div className="team-member-card__metric">
          <div className="team-member-card__metric-icon team-member-card__metric-icon--sla">
            <SlaComplianceGauge value={slaComplianceRate} />
          </div>
          <div className="team-member-card__metric-copy">
            <strong>
              {slaComplianceRate == null
                ? "-"
                : `${Math.round(slaComplianceRate)}%`}
            </strong>
            <span>
              {t("teamManagement.metrics.slaCompliance")}
              <Tooltip
                title={metricTooltipMap.sla}
                overlayClassName="team-member-card__tooltip"
              >
                <QuestionCircleOutlined />
              </Tooltip>
            </span>
          </div>
        </div>

        <div className="team-member-card__metric">
          <div
            className={`team-member-card__metric-icon team-member-card__metric-icon--${overdueTone}`}
          >
            <img src={overdueIcon} alt="" aria-hidden="true" />
          </div>
          <div className="team-member-card__metric-copy">
            <strong>{displayMetrics.overdueTasksCount ?? 0}</strong>
            <span>
              {t("teamManagement.metrics.overdueTasks")}
              <Tooltip
                title={metricTooltipMap.overdue}
                overlayClassName="team-member-card__tooltip"
              >
                <QuestionCircleOutlined />
              </Tooltip>
            </span>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="team-member-card__loading-mask">
          <ExclamationCircleOutlined />
          <span>{t("common.loading")}</span>
        </div>
      ) : null}
    </div>
  )
}
