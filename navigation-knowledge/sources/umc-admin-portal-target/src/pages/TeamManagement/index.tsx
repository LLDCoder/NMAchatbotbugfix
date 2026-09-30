import { useEffect, useRef, useState } from "react"
import { Radio, Switch, Tabs } from "antd"
import { useHistory, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { CustomMessage } from "@/components/common"
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated"
import {
  getTeamManagementScopeConfig,
  getTeamManagementScopeConfigByScope,
} from "./taskConfig"
import { TeamSummaryCards } from "./components/TeamSummaryCards"
import { TeamTasksPanel } from "./components/TeamTasksPanel"
import { TeamMembersPanel } from "./components/TeamMembersPanel"
import { ReassignTasksModal } from "./components/modal/ReassignTasksModal"
import { MarkEmergencyLeaveModal } from "./components/modal/MarkEmergencyLeaveModal"
import { ResumeWorkModal } from "./components/modal/ResumeWorkModal"
import { AssignedAreaModal } from "./components/modal/AssignedAreaModal"
import "./index.less"
import {
  INITIAL_ASSIGNED_AREA_STATE,
  INITIAL_LEAVE_STATE,
  INITIAL_REASSIGN_STATE,
  INITIAL_RESUME_STATE,
} from "./constants"
import { DEFAULT_TEAM_MANAGEMENT_SUMMARY } from "./utils"
import {
  checkTeamManagementAccess,
  getTeamManagementSummary,
  type TeamManagementSummary,
  type TeamTaskTab,
} from "@/services/teamManagement"
export type {
  TeamManagementContentProps,
  TeamManagementLayoutMode,
} from "./type"
import type {
  AssignedAreaModalState,
  LeaveModalState,
  ReassignModalState,
  ResumeModalState,
  TeamManagementContentProps,
  TeamManagementMainTab,
} from "./type"

const getMainTabFromSearch = (search: string): TeamManagementMainTab =>
  new URLSearchParams(search).get("tab") === "teamMembers"
    ? "teamMembers"
    : "teamTasks"

export function TeamManagementContent({
  scope,
  serviceAdapterMode = "default",
  layoutMode = "page",
  forcedMainTab,
  renderMainTabs,
  renderSummaryCards,
  renderTaskToggle,
  skipAccessCheck = false,
  taskTab,
  onTaskTabChange,
  taskHeaderExtraContent,
  onCreateTask,
  createTaskText,
  taskSources,
  activeTaskSourceKey,
  onTaskSourceChange,
  taskSourcePanelConfigs,
}: TeamManagementContentProps) {
  const { t } = useTranslation()
  const history = useHistory()
  const location = useLocation()
  const scopeConfig = scope
    ? getTeamManagementScopeConfigByScope(scope, serviceAdapterMode)
    : getTeamManagementScopeConfig(location.pathname, serviceAdapterMode)
  const [internalActiveTab, setInternalActiveTab] =
    useState<TeamManagementMainTab>(
      forcedMainTab ??
        (layoutMode === "page"
          ? getMainTabFromSearch(location.search)
          : "teamTasks")
    )
  const [applicationTaskOnly, setApplicationTaskOnly] = useState(
    scopeConfig.capabilities.applicationTaskOnlyLocked
      ? true
      : scopeConfig.capabilities.defaultApplicationTaskOnly
  )
  const [summary, setSummary] = useState<TeamManagementSummary>(
    DEFAULT_TEAM_MANAGEMENT_SUMMARY
  )
  const [refreshToken, setRefreshToken] = useState(0)
  const [reassignState, setReassignState] =
    useState<ReassignModalState>(INITIAL_REASSIGN_STATE)
  const [leaveState, setLeaveState] =
    useState<LeaveModalState>(INITIAL_LEAVE_STATE)
  const [resumeState, setResumeState] =
    useState<ResumeModalState>(INITIAL_RESUME_STATE)
  const [assignedAreaState, setAssignedAreaState] =
    useState<AssignedAreaModalState>(INITIAL_ASSIGNED_AREA_STATE)
  const [accessLoading, setAccessLoading] = useState(
    scopeConfig.leaderCheck && !skipAccessCheck
  )
  const [hasAccess, setHasAccess] = useState(
    skipAccessCheck || !scopeConfig.leaderCheck
  )
  const summaryRequestIdRef = useRef(0)

  const isKeepAliveActivated = useKeepAliveActivated({
    onActivated: () => {
      setRefreshToken((value) => value + 1)
    },
    onDeactivated: () => {
      summaryRequestIdRef.current += 1
      setReassignState(INITIAL_REASSIGN_STATE)
      setLeaveState(INITIAL_LEAVE_STATE)
      setResumeState(INITIAL_RESUME_STATE)
      setAssignedAreaState(INITIAL_ASSIGNED_AREA_STATE)
    },
  })

  const resolvedRenderMainTabs = renderMainTabs ?? layoutMode === "page"
  const resolvedRenderSummaryCards =
    renderSummaryCards ?? layoutMode === "page"
  const resolvedRenderTaskToggle =
    (renderTaskToggle ?? layoutMode === "page") &&
    scopeConfig.capabilities.supportsApplicationTaskOnly
  const activeTab = forcedMainTab ?? internalActiveTab
  const urgentCount = summary.urgentCount ?? 0
  const showMainTabs = resolvedRenderMainTabs && !forcedMainTab
  const isEmbedded = !showMainTabs
  const normalizedTaskSources = taskSources || []
  const activeTaskSource =
    normalizedTaskSources.find((item) => item.key === activeTaskSourceKey) ||
    normalizedTaskSources[0]
  const taskSourceSwitcherNode =
    activeTab === "teamTasks" && normalizedTaskSources.length > 1 ? (
      <Radio.Group
        value={activeTaskSource?.key}
        optionType="button"
        buttonStyle="solid"
        className="team-management-page__task-source-switch"
        onChange={(event) => {
          onTaskSourceChange?.(String(event.target.value || ""))
        }}
      >
        {normalizedTaskSources.map((item) => (
          <Radio.Button key={item.key} value={item.key}>
            {t(item.labelKey)}
          </Radio.Button>
        ))}
      </Radio.Group>
    ) : null
  const combinedTaskHeaderExtraContent =
    taskSourceSwitcherNode || taskHeaderExtraContent ? (
      <>
        {taskHeaderExtraContent}
        {taskSourceSwitcherNode}
      </>
    ) : undefined

  const refreshPageData = () => {
    setRefreshToken((value) => value + 1)
  }

  const handleTaskTabChange = (nextTaskTab: TeamTaskTab) => {
    onTaskTabChange?.(nextTaskTab)
  }

  useEffect(() => {
    if (forcedMainTab) {
      setInternalActiveTab(forcedMainTab)
      return
    }

    if (isKeepAliveActivated && showMainTabs) {
      setInternalActiveTab(getMainTabFromSearch(location.search))
    }
  }, [
    forcedMainTab,
    isKeepAliveActivated,
    location.search,
    showMainTabs,
  ])

  const handleMainTabChange = (nextTab: TeamManagementMainTab) => {
    setInternalActiveTab(nextTab)

    const searchParams = new URLSearchParams(location.search)
    if (nextTab === "teamMembers") {
      searchParams.set("tab", "teamMembers")
    } else {
      searchParams.delete("tab")
    }

    const nextSearch = searchParams.toString()
    history.replace({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : "",
    })
  }

  useEffect(() => {
    setApplicationTaskOnly(
      scopeConfig.capabilities.applicationTaskOnlyLocked
        ? true
        : scopeConfig.capabilities.defaultApplicationTaskOnly
    )
  }, [
    scopeConfig.capabilities.applicationTaskOnlyLocked,
    scopeConfig.capabilities.defaultApplicationTaskOnly,
    scopeConfig.scope,
  ])

  useEffect(() => {
    if (!(resolvedRenderSummaryCards || showMainTabs)) {
      return
    }

    let mounted = true
    const requestId = summaryRequestIdRef.current + 1
    summaryRequestIdRef.current = requestId

    const loadInitialSummary = async () => {
      try {
        const nextSummary = await getTeamManagementSummary({
          scope: scopeConfig.scope,
          adapterMode: serviceAdapterMode,
          applicationTaskOnly: false,
        })

        if (
          !mounted ||
          requestId !== summaryRequestIdRef.current
        ) {
          return
        }

        setSummary({
          ...DEFAULT_TEAM_MANAGEMENT_SUMMARY,
          ...nextSummary,
        })
      } catch {
        if (
          !mounted ||
          requestId !== summaryRequestIdRef.current
        ) {
          return
        }

        setSummary(DEFAULT_TEAM_MANAGEMENT_SUMMARY)
        CustomMessage.error(t("teamManagement.messages.failedToLoadSummary"))
      }
    }

    void loadInitialSummary()

    return () => {
      mounted = false
    }
  }, [
    resolvedRenderSummaryCards,
    refreshToken,
    scopeConfig.scope,
    serviceAdapterMode,
    showMainTabs,
    t,
  ])

  useEffect(() => {
    let mounted = true

    if (skipAccessCheck || !scopeConfig.leaderCheck) {
      setHasAccess(true)
      setAccessLoading(false)
      return () => {
        mounted = false
      }
    }

    setAccessLoading(true)
    void checkTeamManagementAccess(scopeConfig.scope, serviceAdapterMode)
      .then((allowed) => {
        if (!mounted) {
          return
        }
        setHasAccess(allowed)
        setAccessLoading(false)
        if (!allowed) {
          // history.replace(scopeConfig.accessDeniedRedirectPath)
        }
      })
      .catch(() => {
        if (!mounted) {
          return
        }
        setHasAccess(false)
        setAccessLoading(false)
        // history.replace(scopeConfig.accessDeniedRedirectPath)
      })

    return () => {
      mounted = false
    }
  }, [
    history,
    scopeConfig.accessDeniedRedirectPath,
    scopeConfig.leaderCheck,
    scopeConfig.scope,
    serviceAdapterMode,
    skipAccessCheck,
  ])

  if (accessLoading || !hasAccess) {
    return null
  }

  return (
    <div
      className={`team-management-page${
        isEmbedded ? " team-management-page--embedded" : ""
      }`}
    >
      {showMainTabs ? (
        <div className="team-management-page__tabs-card">
          <Tabs
            activeKey={activeTab}
            onChange={(key) =>
              handleMainTabChange(key as TeamManagementMainTab)
            }
          >
            <Tabs.TabPane
              key="teamTasks"
              tab={
                <div
                  className="team-management-page__tab-title"
                  aria-label={
                    urgentCount > 0
                      ? t("teamManagement.tabs.teamTasksWithUrgentCount", {
                          count: urgentCount,
                        })
                      : undefined
                  }
                >
                  <span>{t("teamManagement.tabs.teamTasks")}</span>
                  {urgentCount > 0 ? (
                    <span className="team-management-page__badge">
                      {urgentCount}
                    </span>
                  ) : null}
                </div>
              }
            />
            <Tabs.TabPane
              key="teamMembers"
              tab={t("teamManagement.tabs.teamMembers")}
            />
          </Tabs>
        </div>
      ) : null}

      {activeTab === "teamTasks" ? (
        <>
          {resolvedRenderSummaryCards ? (
            <TeamSummaryCards
              scope={scopeConfig.scope}
              summary={summary}
              supportedTaskCategories={scopeConfig.supportedTaskCategories}
            />
          ) : null}
          <TeamTasksPanel
            scopeConfig={scopeConfig}
            serviceAdapterMode={serviceAdapterMode}
            taskTab={taskTab}
            onTaskTabChange={handleTaskTabChange}
            taskHeaderExtraContent={combinedTaskHeaderExtraContent}
            onCreateTask={onCreateTask}
            createTaskText={createTaskText}
            activeTaskSourceKey={activeTaskSource?.key}
            taskSourcePanelConfigs={taskSourcePanelConfigs}
            applicationTaskOnly={applicationTaskOnly}
            refreshToken={refreshToken}
            toggleControl={resolvedRenderTaskToggle ? (
              <div className="team-management-page__toggle-row">
                <span>{t("teamManagement.applicationTaskOnly")}</span>
                <Switch
                  checked={applicationTaskOnly}
                  checkedChildren={t("common.on")}
                  unCheckedChildren={t("common.off")}
                  disabled={scopeConfig.capabilities.applicationTaskOnlyLocked}
                  onChange={setApplicationTaskOnly}
                />
              </div>
            ) : undefined}
            onOpenReassign={(tasks, selectedCount) =>
              setReassignState({
                visible: true,
                tasks,
                selectedCount,
              })
            }
          />
        </>
      ) : (
        <div className="team-management-page__members-section">
          <TeamMembersPanel
            scopeConfig={scopeConfig}
            serviceAdapterMode={serviceAdapterMode}
            refreshToken={refreshToken}
            onOpenMarkLeave={(memberId, memberName) =>
              setLeaveState({
                visible: true,
                memberId,
                memberName,
              })
            }
            onOpenResumeWork={(memberId, memberName) =>
              setResumeState({
                visible: true,
                memberId,
                memberName,
              })
            }
            onOpenSetAssignedArea={(memberId, memberName) =>
              setAssignedAreaState({
                visible: true,
                isEdit: false,
                memberId,
                memberName,
                currentArea: null,
              })
            }
            onOpenEditAssignedArea={(memberId, memberName, currentArea) =>
              setAssignedAreaState({
                visible: true,
                isEdit: true,
                memberId,
                memberName,
                currentArea,
              })
            }
          />
        </div>
      )}

      <ReassignTasksModal
        scope={scopeConfig.scope}
        serviceAdapterMode={serviceAdapterMode}
        manualReassignSelection={
          scopeConfig.capabilities.manualReassignSelection
        }
        confirmPermissionCode={scopeConfig.permissions.confirmReassign}
        permissionRoutePath={scopeConfig.permissionRoutePath}
        visible={reassignState.visible}
        tasks={reassignState.tasks}
        selectedCount={reassignState.selectedCount}
        onCancel={() => setReassignState(INITIAL_REASSIGN_STATE)}
        onSuccess={() => {
          setReassignState(INITIAL_REASSIGN_STATE)
          refreshPageData()
        }}
      />

      <MarkEmergencyLeaveModal
        scope={scopeConfig.scope}
        serviceAdapterMode={serviceAdapterMode}
        confirmPermissionCode={
          scopeConfig.permissions.confirmMarkEmergencyLeave
        }
        permissionRoutePath={scopeConfig.permissionRoutePath}
        visible={leaveState.visible}
        memberId={leaveState.memberId}
        memberName={leaveState.memberName}
        onCancel={() => setLeaveState(INITIAL_LEAVE_STATE)}
        onSuccess={() => {
          setLeaveState(INITIAL_LEAVE_STATE)
          refreshPageData()
        }}
      />

      <ResumeWorkModal
        scope={scopeConfig.scope}
        serviceAdapterMode={serviceAdapterMode}
        confirmPermissionCode={scopeConfig.permissions.resumeWork}
        permissionRoutePath={scopeConfig.permissionRoutePath}
        visible={resumeState.visible}
        memberId={resumeState.memberId}
        memberName={resumeState.memberName}
        onCancel={() => setResumeState(INITIAL_RESUME_STATE)}
        onSuccess={() => {
          setResumeState(INITIAL_RESUME_STATE)
          refreshPageData()
        }}
      />

      <AssignedAreaModal
        scope={scopeConfig.scope}
        serviceAdapterMode={serviceAdapterMode}
        visible={assignedAreaState.visible}
        isEdit={assignedAreaState.isEdit}
        memberId={assignedAreaState.memberId}
        memberName={assignedAreaState.memberName}
        currentArea={assignedAreaState.currentArea}
        onCancel={() => setAssignedAreaState(INITIAL_ASSIGNED_AREA_STATE)}
        onSuccess={() => {
          setAssignedAreaState(INITIAL_ASSIGNED_AREA_STATE)
          refreshPageData()
        }}
      />
    </div>
  )
}

export default function TeamManagement() {
  return <TeamManagementContent />
}
