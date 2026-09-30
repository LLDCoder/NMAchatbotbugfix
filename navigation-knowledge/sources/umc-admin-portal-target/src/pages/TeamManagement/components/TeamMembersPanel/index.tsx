import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react"
import { DownOutlined } from "@ant-design/icons"
import { Select, Spin } from "antd"
import type { RangePickerProps } from "antd/es/date-picker"
import moment from "moment"
import { useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { CustomMessage } from "@/components/common"
import DatePicker from "@/components/common/LocalizedDatePicker"
import EmptyBox from "@/components/common/EmptyBox/EmptyBox"
import type {
  MemberMetricCategory,
  TeamManagementMemberCard as TeamManagementMemberCardEntity,
} from "@/services/teamManagement"
import {
  getTeamManagementMemberCards,
  getTeamManagementMembersPanelData,
} from "@/services/teamManagement"
import { DEFAULT_TEAM_MEMBERS_RANGE, sortTeamManagementMembers } from "../../utils"
import type { MemberOption, TeamMembersPanelProps, TeamMembersRange } from "./type"
import { TeamMemberCard } from "../TeamMemberCard"
import "./index.less"

type TeamMembersPickerValue = RangePickerProps["value"]
type PendingTeamMembersRange = [
  TeamMembersRange[number] | null,
  TeamMembersRange[number] | null
]

const formatTeamMembersFilterDate = (
  value?: TeamMembersRange[number] | null
) =>
  moment.isMoment(value) && value.isValid()
    ? value.format("YYYY-MM-DD")
    : undefined

const mergeMemberCardRecord = (
  currentCard: TeamManagementMemberCardEntity,
  nextCard: TeamManagementMemberCardEntity
): TeamManagementMemberCardEntity => {
  const mergedMetricsByCategory = {
    ...(currentCard.metricsByCategory || {}),
    ...(nextCard.metricsByCategory || {}),
  }

  return {
    ...currentCard,
    ...nextCard,
    memberName: nextCard.memberName || currentCard.memberName,
    metrics: mergedMetricsByCategory.all || nextCard.metrics || currentCard.metrics,
    metricsByCategory: mergedMetricsByCategory,
  }
}

export const TeamMembersPanel: FC<TeamMembersPanelProps> = ({
  scopeConfig,
  serviceAdapterMode = "default",
  refreshToken,
  onOpenMarkLeave,
  onOpenResumeWork,
  onOpenSetAssignedArea,
  onOpenEditAssignedArea,
}) => {
  const { t } = useTranslation()
  const location = useLocation()
  const scope = scopeConfig.scope
  const allowMemberLeaveActions =
    scopeConfig.capabilities.allowMemberLeaveActions
  const allowAssignedAreaActions =
    scopeConfig.capabilities.allowAssignedAreaActions &&
    scope === "inspection" &&
    location.pathname.startsWith("/inspection/tasks")
  const [members, setMembers] = useState<MemberOption[]>([])
  const [cards, setCards] = useState<TeamManagementMemberCardEntity[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoadedCards, setHasLoadedCards] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string>()
  const [range, setRange] = useState<TeamMembersRange | null>(
    DEFAULT_TEAM_MEMBERS_RANGE
  )
  const [pickerValue, setPickerValue] =
    useState<TeamMembersPickerValue>(DEFAULT_TEAM_MEMBERS_RANGE)
  const [resetKey, setResetKey] = useState(0)
  const pendingRangeRef = useRef<PendingTeamMembersRange | null>(null)
  const panelRequestIdRef = useRef(0)

  const buildNextMemberOptions = useCallback((
    nextMembers: MemberOption[],
    nextCards: TeamManagementMemberCardEntity[],
    previousMembers: MemberOption[]
  ) => {
    if (!selectedMemberId) {
      return nextMembers
    }

    if (nextMembers.some((item) => item.value === selectedMemberId)) {
      return nextMembers
    }

    const fallbackMemberName =
      nextCards.find((item) => item.memberId === selectedMemberId)?.memberName ||
      previousMembers.find((item) => item.value === selectedMemberId)?.label ||
      selectedMemberId

    return [
      {
        label: fallbackMemberName,
        value: selectedMemberId,
      },
      ...nextMembers,
    ]
  }, [selectedMemberId])

  const loadPanelData = useCallback(async (requestId: number) => {
    try {
      setLoading(true)
      const response = await getTeamManagementMembersPanelData({
        scope,
        adapterMode: serviceAdapterMode,
        memberId: selectedMemberId,
        startTime: formatTeamMembersFilterDate(range?.[0]),
        endTime: formatTeamMembersFilterDate(range?.[1]),
      })

      if (requestId !== panelRequestIdRef.current) {
        return
      }

      const nextCards = Array.isArray(response?.cards) ? response.cards : []
      const nextMembers = Array.isArray(response?.members) ? response.members : []

      setMembers((currentMembers) =>
        buildNextMemberOptions(nextMembers, nextCards, currentMembers)
      )
      setCards(nextCards)
      setResetKey((value) => value + 1)
    } catch {
      if (requestId !== panelRequestIdRef.current) {
        return
      }

      setCards([])
      CustomMessage.error(t("teamManagement.messages.failedToLoadMemberCards"))
    } finally {
      if (requestId === panelRequestIdRef.current) {
        setHasLoadedCards(true)
        setLoading(false)
      }
    }
  }, [
    buildNextMemberOptions,
    range,
    scope,
    selectedMemberId,
    serviceAdapterMode,
    t,
  ])

  const handleCardCategoryChange = useCallback(async (
    memberId: string,
    category: MemberMetricCategory
  ) => {
    try {
      const response = await getTeamManagementMemberCards({
        scope,
        adapterMode: serviceAdapterMode,
        memberId,
        startTime: formatTeamMembersFilterDate(range?.[0]),
        endTime: formatTeamMembersFilterDate(range?.[1]),
        memberMetricCategory: category,
      })
      const nextCard = Array.isArray(response) ? response[0] : null

      if (nextCard) {
        let mergedCard = nextCard

        setCards((currentCards) =>
          currentCards.map((item) => {
            if (item.memberId !== nextCard.memberId) {
              return item
            }

            mergedCard = mergeMemberCardRecord(item, nextCard)
            return mergedCard
          })
        )

        return mergedCard
      }

      return null
    } catch {
      CustomMessage.error(t("teamManagement.messages.failedToLoadMemberCards"))
      return null
    }
  }, [range, scope, serviceAdapterMode, t])

  const filteredCards = useMemo(() => sortTeamManagementMembers(cards), [cards])

  const showEmptyState = hasLoadedCards && !loading && filteredCards.length === 0
  const showLoadingPlaceholder = !hasLoadedCards && loading
  const shouldFillAvailableHeight = showEmptyState || showLoadingPlaceholder
  const todayEnd = moment().endOf("day")
  const resetPickerState = useCallback((nextRange: TeamMembersRange | null) => {
    pendingRangeRef.current = null
    setPickerValue(nextRange)
  }, [])

  useEffect(() => {
    const requestId = panelRequestIdRef.current + 1
    panelRequestIdRef.current = requestId

    void loadPanelData(requestId)
  }, [loadPanelData, refreshToken])

  useEffect(() => {
    setPickerValue(range)
  }, [range])

  return (
    <div
      className={`team-members-panel${
        shouldFillAvailableHeight ? " team-members-panel--fill-height" : ""
      }`}
    >
      <div className="team-members-panel__filters">
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t("teamManagement.placeholders.teamMembers")}
          className="team-members-panel__member-select"
          suffixIcon={<DownOutlined />}
          value={selectedMemberId}
          onChange={(value?: string) => setSelectedMemberId(value)}
          options={members}
          getPopupContainer={(triggerNode) =>
            (triggerNode.closest(".team-members-panel") as HTMLElement | null) ||
            document.body
          }
        />
        <DatePicker.RangePicker
          value={pickerValue}
          format="DD-MM-YYYY"
          className="team-members-panel__range"
          disabledDate={(current) => {
            if (!current) {
              return false
            }

            return current.isAfter(todayEnd, "day")
          }}
          onCalendarChange={(value, _dateStrings, info) => {
            if (!value?.[0] && !value?.[1]) {
              pendingRangeRef.current = null
              setPickerValue(null)
              return
            }

            if (info?.range === "start") {
              const nextDraftRange: PendingTeamMembersRange = [
                value?.[0] ?? null,
                null,
              ]

              pendingRangeRef.current = nextDraftRange
              setPickerValue(nextDraftRange)
              return
            }

            const nextDraftRange: PendingTeamMembersRange = [
              value?.[0] ?? pendingRangeRef.current?.[0] ?? null,
              value?.[1] ?? null,
            ]

            pendingRangeRef.current = nextDraftRange
            setPickerValue(nextDraftRange)
          }}
          onOpenChange={(open) => {
            if (!open) {
              resetPickerState(range)
            }
          }}
          onChange={(value) => {
            if (!value?.[0] && !value?.[1]) {
              setRange(null)
              resetPickerState(null)
              return
            }

            const pendingRange = pendingRangeRef.current
            if (pendingRange?.[0] && !pendingRange?.[1]) {
              return
            }

            if (!value?.[0] || !value?.[1]) {
              return
            }

            const nextRange: TeamMembersRange = [value[0], value[1]]
            setRange(nextRange)
            resetPickerState(nextRange)
          }}
        />
      </div>
      <Spin spinning={loading}>
        <div
          className={`team-members-panel__content ${
            showEmptyState || showLoadingPlaceholder ? "is-empty" : ""
          }`}
        >
          {filteredCards.length ? (
            <div className="team-members-panel__grid">
              {filteredCards.map((item) => (
                <TeamMemberCard
                  key={`${item.memberId}-${resetKey}`}
                  record={item}
                  resetKey={resetKey}
                  permissionRoutePath={scopeConfig.permissionRoutePath}
                  resumeWorkPermissionCode={scopeConfig.permissions.resumeWork}
                  allowMemberLeaveActions={allowMemberLeaveActions}
                  allowAssignedAreaActions={allowAssignedAreaActions}
                  supportedCategories={
                    scopeConfig.supportedMemberMetricCategories
                  }
                  onOpenMarkLeave={onOpenMarkLeave}
                  onOpenResumeWork={onOpenResumeWork}
                  onOpenSetAssignedArea={onOpenSetAssignedArea}
                  onOpenEditAssignedArea={onOpenEditAssignedArea}
                  onCategoryChange={handleCardCategoryChange}
                />
              ))}
            </div>
          ) : showEmptyState ? (
            <EmptyBox
              title={t("common.noData")}
              customClassName="team-management-empty"
            />
          ) : (
            <div className="team-members-panel__loading-placeholder" />
          )}
        </div>
      </Spin>
    </div>
  )
}
