import type { TFunction } from "i18next"
import type { IFilterStore } from "@/components/common/FilterTable/type"
import type {
  TeamManagementAdapterMode,
  TeamManagementOption,
  TeamManagementScope,
  TeamManagementTaskItem,
  TeamTaskCategory,
  TeamTaskTab,
} from "@/services/teamManagement"
import { transformDate } from "@/utils/transform"
import type { TeamManagementControlledTaskPanelConfig } from "../../type"
import type { TeamManagementScopeConfig } from "../../taskConfig"
import {
  getTaskCategoryLabel,
  normalizeTaskCategoryByToggle,
} from "../../utils"
import type {
  TeamTaskReassignSelection,
  TeamTasksPanelQueryParams,
} from "./type"
import type { TeamTaskSortState } from "./constants"

export const getInspectionSourceCategory = (
  activeTaskSourceKey?: string
): TeamTaskCategory | undefined => {
  if (activeTaskSourceKey === "inspection") {
    return "inspectionTasks"
  }

  return undefined
}

export const hasExternallyControlledTaskData = (
  config?: TeamManagementControlledTaskPanelConfig
) =>
  Boolean(
    config?.customContent ||
      config?.request ||
      config?.dataSource ||
      config?.loading !== undefined ||
      config?.onTableChange ||
      config?.pagination
  )

export const buildReassignTaskSelection = (
  record: TeamManagementTaskItem
): TeamTaskReassignSelection => ({
  sourceType: record.sourceType || null,
  sourceId: record.sourceId || null,
  userId: record.userId || null,
  assignedTo: record.assignedTo || "",
  assignedToUserId: record.assignedToUserId || null,
})

interface BuildTaskRequestPayloadParams {
  activeFilterStore: IFilterStore
  activeTab: TeamTaskTab
  activeTaskSourceKey?: string
  isApplicationTaskOnlyEnabled: boolean
  pageSize: number
  params?: TeamTasksPanelQueryParams
  scope: TeamManagementScope
  serviceAdapterMode: TeamManagementAdapterMode
  sortState: TeamTaskSortState
  sourceDefaultCategory?: TeamTaskCategory
}

export const buildTeamTaskRequestPayload = ({
  activeFilterStore,
  activeTab,
  activeTaskSourceKey,
  isApplicationTaskOnlyEnabled,
  pageSize,
  params,
  scope,
  serviceAdapterMode,
  sortState,
  sourceDefaultCategory,
}: BuildTaskRequestPayloadParams) => {
  const values = activeFilterStore.getFieldsValue() || {}
  const effectiveCategory = normalizeTaskCategoryByToggle(
    isApplicationTaskOnlyEnabled,
    sourceDefaultCategory ||
      (values.category as TeamTaskCategory | undefined)
  )
  const [startTime, endTime] = transformDate(values.lastUpdated)

  return {
    scope,
    adapterMode: serviceAdapterMode,
    taskTab: activeTab,
    taskSourceKey: activeTaskSourceKey,
    applicationTaskOnly: isApplicationTaskOnlyEnabled,
    keyword: values.keyword || undefined,
    category: effectiveCategory,
    status: values.status || undefined,
    memberId: values.memberId || undefined,
    startTime,
    endTime,
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? pageSize,
    sortBy: params?.sortBy ?? sortState.sortBy,
    sortDirection: params?.sortDirection ?? sortState.sortDirection,
  }
}

interface BuildTaskCategoryOptionsParams {
  isApplicationTaskOnlyEnabled: boolean
  metadataCategoryOptions: TeamManagementOption[]
  metadataCategoryOptionsReady: boolean
  scope: TeamManagementScope
  supportedTaskCategories: TeamManagementScopeConfig["supportedTaskCategories"]
  t: TFunction
}

export const buildTeamTaskCategoryOptions = ({
  isApplicationTaskOnlyEnabled,
  metadataCategoryOptions,
  metadataCategoryOptionsReady,
  scope,
  supportedTaskCategories,
  t,
}: BuildTaskCategoryOptionsParams) => {
  // content scope uses a static category list, so it must not wait for the
  // metadata request; otherwise the Select renders the raw value first and
  // flashes when the localized label arrives.
  if (scope === "content") {
    const contentCategories: TeamTaskCategory[] = isApplicationTaskOnlyEnabled
      ? ["applications"]
      : ["applications", "enquiries", "refunds", "appeals", "violations"]

    return contentCategories.map((value) => ({
      label: getTaskCategoryLabel(value, t, scope),
      value,
    }))
  }

  if (!metadataCategoryOptionsReady) {
    return []
  }

  const normalizedMetadataOptions = metadataCategoryOptions
    .filter((item) =>
      supportedTaskCategories.includes(item.value as TeamTaskCategory)
    )
    .map((item) => ({
      label:
        item.label || getTaskCategoryLabel(item.value as TeamTaskCategory, t, scope),
      value: item.value as TeamTaskCategory,
    }))

  if (isApplicationTaskOnlyEnabled) {
    const applicationOnlyOptions = normalizedMetadataOptions.filter(
      (item) => item.value === "applications"
    )

    if (applicationOnlyOptions.length > 0) {
      return applicationOnlyOptions
    }

    return [
      {
        label: getTaskCategoryLabel("applications", t, scope),
        value: "applications" as TeamTaskCategory,
      },
    ]
  }

  return normalizedMetadataOptions
}
