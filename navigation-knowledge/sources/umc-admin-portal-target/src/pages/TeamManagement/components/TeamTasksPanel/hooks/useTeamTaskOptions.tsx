import Sousuo from "@/assets/icons/Sousuo";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react"
import { DatePicker, Input, Select } from "antd"
// import { SearchOutlined } from "@ant-design/icons"

import { useTranslation } from "react-i18next"
import { CustomMessage } from "@/components/common"
import type { FilterItem, IFilterStore } from "@/components/common/FilterTable/type"
import type {
  TeamManagementAdapterMode,
  TeamManagementMemberOption,
  TeamManagementOption,
  TeamManagementScope,
  TeamTaskCategory,
  TeamTaskTab,
} from "@/services/teamManagement"
import {
  getTeamManagementMembers,
  getTeamManagementTaskFilterOptions,
} from "@/services/teamManagement"
import type { TeamManagementScopeConfig } from "../../../taskConfig"
import {
  COMPLETED_ONLY_MEMBER_VALUES,
  COMPLETED_ONLY_MEMBER_VALUE_LIST,
  EMPTY_STATUS_OPTIONS_BY_TAB,
  EMPTY_STATUS_OPTIONS_READY_BY_TAB,
} from "../constants"
import { buildTeamTaskCategoryOptions } from "../utils"

interface UseTeamTaskOptionsParams {
  activeFilterStore: IFilterStore
  activeTab: TeamTaskTab
  activeTaskSourceKey?: string
  categoryOptionsRef: MutableRefObject<
    Array<{ label: string; value: TeamTaskCategory }>
  >
  isApplicationTaskOnlyEnabled: boolean
  isControlledPanel: boolean
  mountedRef: MutableRefObject<boolean>
  scope: TeamManagementScope
  scopeConfig: TeamManagementScopeConfig
  serviceAdapterMode: TeamManagementAdapterMode
}

export const useTeamTaskOptions = ({
  activeFilterStore,
  activeTab,
  activeTaskSourceKey,
  categoryOptionsRef,
  isApplicationTaskOnlyEnabled,
  isControlledPanel,
  mountedRef,
  scope,
  scopeConfig,
  serviceAdapterMode,
}: UseTeamTaskOptionsParams) => {
  const { t } = useTranslation()
  const [statusOptionsByTab, setStatusOptionsByTab] = useState<
    Record<TeamTaskTab, TeamManagementOption[]>
  >(EMPTY_STATUS_OPTIONS_BY_TAB)
  const [statusOptionsReadyByTab, setStatusOptionsReadyByTab] = useState<
    Record<TeamTaskTab, boolean>
  >(EMPTY_STATUS_OPTIONS_READY_BY_TAB)
  const [metadataCategoryOptions, setMetadataCategoryOptions] = useState<
    TeamManagementOption[]
  >([])
  const [metadataCategoryOptionsReady, setMetadataCategoryOptionsReady] =
    useState(false)
  const [baseMemberOptions, setBaseMemberOptions] = useState<
    TeamManagementMemberOption[]
  >([])
  const [memberOptionsLoading, setMemberOptionsLoading] = useState(false)
  const memberOptionsLoadedRef = useRef(false)
  const memberOptionsLoadingRef = useRef(false)
  const filterOptionsRequestIdRef = useRef(0)
  const memberRequestIdRef = useRef(0)
  const statusOptions = statusOptionsByTab[activeTab] || []

  const categoryOptions = useMemo(
    () =>
      buildTeamTaskCategoryOptions({
        isApplicationTaskOnlyEnabled,
        metadataCategoryOptions,
        metadataCategoryOptionsReady,
        scope,
        supportedTaskCategories: scopeConfig.supportedTaskCategories,
        t,
      }),
    [
      isApplicationTaskOnlyEnabled,
      metadataCategoryOptions,
      metadataCategoryOptionsReady,
      scope,
      scopeConfig.supportedTaskCategories,
      t,
    ]
  )

  categoryOptionsRef.current = categoryOptions

  const loadTaskFilterOptions = useCallback(async () => {
    const requestId = filterOptionsRequestIdRef.current + 1
    filterOptionsRequestIdRef.current = requestId

    try {
      const response = await getTeamManagementTaskFilterOptions({
        scope,
        adapterMode: serviceAdapterMode,
        taskTab: activeTab,
        taskSourceKey: activeTaskSourceKey,
      })

      if (
        requestId !== filterOptionsRequestIdRef.current ||
        !mountedRef.current
      ) {
        return
      }

      const nextCategoryOptions = response?.categoryOptions || []
      const nextTodoStatusOptions = response?.todoStatusOptions || []
      const nextCompletedStatusOptions =
        response?.completedStatusOptions || []
      const nextStatusOptions = response?.statusOptions || []

      setMetadataCategoryOptions(nextCategoryOptions)
      setMetadataCategoryOptionsReady(true)
      setStatusOptionsByTab({
        todo: nextTodoStatusOptions,
        completed: nextCompletedStatusOptions,
      })
      setStatusOptionsReadyByTab({
        todo: true,
        completed: true,
      })

      const currentStatus = String(
        activeFilterStore.getFieldValue("status") || ""
      ).trim()

      if (
        currentStatus &&
        !nextStatusOptions.some((item) => item.value === currentStatus)
      ) {
        activeFilterStore.setFieldValue("status", undefined)
      }
    } catch (error) {
      if (
        requestId !== filterOptionsRequestIdRef.current ||
        !mountedRef.current
      ) {
        return
      }

      setMetadataCategoryOptions([])
      setMetadataCategoryOptionsReady(true)
      setStatusOptionsByTab(EMPTY_STATUS_OPTIONS_BY_TAB)
      setStatusOptionsReadyByTab(EMPTY_STATUS_OPTIONS_READY_BY_TAB)

      const currentStatus = String(
        activeFilterStore.getFieldValue("status") || ""
      ).trim()

      if (currentStatus) {
        activeFilterStore.setFieldValue("status", undefined)
      }
    }
  }, [
    activeFilterStore,
    activeTab,
    activeTaskSourceKey,
    mountedRef,
    scope,
    serviceAdapterMode,
  ])

  const loadMemberOptions = useCallback(async () => {
    if (memberOptionsLoadingRef.current) {
      return
    }

    const requestId = memberRequestIdRef.current + 1
    memberRequestIdRef.current = requestId
    memberOptionsLoadingRef.current = true

    if (mountedRef.current) {
      setMemberOptionsLoading(true)
    }
    try {
      const members = await getTeamManagementMembers({
        scope,
        adapterMode: serviceAdapterMode,
      })

      if (
        requestId !== memberRequestIdRef.current ||
        !mountedRef.current
      ) {
        return
      }
      setBaseMemberOptions(Array.isArray(members) ? members : [])
      memberOptionsLoadedRef.current = true
    } catch (error) {
      if (
        requestId !== memberRequestIdRef.current ||
        !mountedRef.current
      ) {
        return
      }

      setBaseMemberOptions([])
      CustomMessage.error(t("teamManagement.messages.failedToLoadMembers"))
    } finally {
      memberOptionsLoadingRef.current = false

      if (
        requestId === memberRequestIdRef.current &&
        mountedRef.current
      ) {
        setMemberOptionsLoading(false)
      }
    }
  }, [mountedRef, scope, serviceAdapterMode, t])

  // Auto / Self-Monitor are only meaningful for finished tasks, so keep them out of the To Do tab.
  const memberOptions = useMemo<TeamManagementMemberOption[]>(() => {
    if (activeTab !== "completed") {
      return baseMemberOptions
    }

    return [
      ...baseMemberOptions,
      {
        value: COMPLETED_ONLY_MEMBER_VALUES.auto,
        label: t("teamManagement.memberOptions.auto"),
      },
      {
        value: COMPLETED_ONLY_MEMBER_VALUES.selfMonitor,
        label: t("teamManagement.memberOptions.selfMonitor"),
      },
    ]
  }, [activeTab, baseMemberOptions, t])

  const ensureMemberOptionsLoaded = useCallback(async () => {
    if (
      memberOptionsLoadedRef.current ||
      memberOptionsLoadingRef.current
    ) {
      return
    }

    await loadMemberOptions()
  }, [loadMemberOptions])

  const defaultTableFilters = useMemo<FilterItem[]>(
    () => [
      {
        label: t("common.search"),
        element: (
          <Input
            key="input-keyword"
            placeholder={t("common.search")}
            prefix={<Sousuo className="search-icon" />}
            allowClear
          />
        ),
        requestDebounceMs: 500,
      },
      {
        label: t("teamManagement.table.taskCategory"),
        element: (
          <Select
            key="select-category"
            placeholder={t("teamManagement.placeholders.allCategories")}
            options={categoryOptions}
            allowClear={!isApplicationTaskOnlyEnabled}
            getPopupContainer={(triggerNode) => triggerNode.ownerDocument.body}
          />
        ),
      },
      {
        label: t("teamManagement.table.status"),
        element: (
          <Select
            key="select-status"
            placeholder={t("teamManagement.placeholders.allStatuses")}
            options={statusOptions}
            allowClear
            getPopupContainer={(triggerNode) => triggerNode.ownerDocument.body}
          />
        ),
      },
      {
        label: t("teamManagement.filter.member"),
        element: (
          <Select
            key="select-memberId"
            className="umc-select-arrow-manual"
            placeholder={t("teamManagement.placeholders.allMembers")}
            options={memberOptions}
            loading={memberOptionsLoading}
            allowClear
            showSearch
            optionFilterProp="label"
            getPopupContainer={(triggerNode) => triggerNode.ownerDocument.body}
          />
        ),
      },
      {
        label: t("teamManagement.filter.lastUpdated"),
        element: (
          <DatePicker.RangePicker
            key="range-lastUpdated"
            placeholder={[
              t("teamManagement.placeholders.startDate"),
              t("teamManagement.placeholders.endDate"),
            ]}
            format={["DD/MM/YYYY"]}
            getPopupContainer={(triggerNode) => triggerNode.ownerDocument.body}
          />
        ),
      },
    ],
    [
      categoryOptions,
      isApplicationTaskOnlyEnabled,
      memberOptions,
      memberOptionsLoading,
      statusOptions,
      t,
    ]
  )

  useEffect(() => {
    memberOptionsLoadedRef.current = false
    memberOptionsLoadingRef.current = false
    setBaseMemberOptions([])
    setMemberOptionsLoading(false)
  }, [scope, serviceAdapterMode])

  useEffect(() => {
    setMetadataCategoryOptions([])
    setMetadataCategoryOptionsReady(false)
    setStatusOptionsByTab(EMPTY_STATUS_OPTIONS_BY_TAB)
    setStatusOptionsReadyByTab(EMPTY_STATUS_OPTIONS_READY_BY_TAB)
  }, [activeFilterStore, scope, serviceAdapterMode])

  useEffect(() => {
    void loadTaskFilterOptions()
  }, [
    activeFilterStore,
    activeTab,
    loadTaskFilterOptions,
    scope,
    serviceAdapterMode,
  ])

  useEffect(() => {
    if (!statusOptionsReadyByTab[activeTab]) {
      return
    }

    const currentStatus = String(
      activeFilterStore.getFieldValue("status") || ""
    ).trim()

    if (
      currentStatus &&
      !statusOptions.some((item) => item.value === currentStatus)
    ) {
      activeFilterStore.setFieldValue("status", undefined)
    }
  }, [activeFilterStore, activeTab, statusOptions, statusOptionsReadyByTab])

  // Leaving the Completed tab must drop Auto / Self-Monitor, otherwise To Do would query a value it cannot show.
  useEffect(() => {
    if (activeTab === "completed") {
      return
    }

    const currentMemberId = String(
      activeFilterStore.getFieldValue("memberId") || ""
    ).trim()

    if (
      currentMemberId &&
      COMPLETED_ONLY_MEMBER_VALUE_LIST.includes(currentMemberId)
    ) {
      activeFilterStore.setFieldValue("memberId", undefined)
    }
  }, [activeFilterStore, activeTab])

  useEffect(() => {
    if (scope !== "customer" || isControlledPanel) {
      return
    }

    const currentCategory = activeFilterStore.getFieldValue("category") as
      | TeamTaskCategory
      | undefined

      if (
      currentCategory &&
      !scopeConfig.supportedTaskCategories.includes(currentCategory)
    ) {
      activeFilterStore.setFieldValue("category", undefined)
    }
  }, [
    activeFilterStore,
    isControlledPanel,
    scope,
    scopeConfig.supportedTaskCategories,
  ])

  useEffect(() => {
    if (
      isControlledPanel ||
      isApplicationTaskOnlyEnabled ||
      !metadataCategoryOptionsReady
    ) {
      return
    }

    const currentCategory = activeFilterStore.getFieldValue("category") as
      | TeamTaskCategory
      | undefined

    if (!currentCategory) {
      return
    }

    const isCurrentCategorySupported = categoryOptions.some(
      (item) => item.value === currentCategory
    )

    if (isCurrentCategorySupported) {
      return
    }

    activeFilterStore.setFieldValue("category", undefined)
  }, [
    activeFilterStore,
    categoryOptions,
    isApplicationTaskOnlyEnabled,
    isControlledPanel,
    metadataCategoryOptionsReady,
  ])

  return {
    defaultTableFilters,
    ensureMemberOptionsLoaded,
  }
}
