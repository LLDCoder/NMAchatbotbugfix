import { useMemo } from "react"
import { DatePicker, Input, Select } from "antd"
import type { TFunction } from "i18next"
import type { FilterItem } from "@/components/common/FilterTable/type"
import InspectorSelect from "@/pages/InspectionTaskManagement/components/InspectorSelect"
import {
  completedStatusFilterCodes,
  todoStatusFilterCodes,
} from "../constants"
import {
  normalizeInspectionTeamInspectorSelectOptions,
  normalizeInspectionTeamTaskStatusValue,
} from "../utils"
import type {
  InspectionTeamTaskMetadataOptions,
  InspectionTeamTaskRow,
  TaskFilterOption,
  TeamTaskView,
} from "../type"

interface UseInspectionTeamTaskFiltersParams {
  metadata: InspectionTeamTaskMetadataOptions
  rows: Record<TeamTaskView, InspectionTeamTaskRow[]>
  t: TFunction
  taskTab: TeamTaskView
}

export const useInspectionTeamTaskFilters = ({
  metadata,
  rows,
  t,
  taskTab,
}: UseInspectionTeamTaskFiltersParams) => {
  const statusOptions = useMemo(() => {
    const allowedStatusCodes =
      taskTab === "todo" ? todoStatusFilterCodes : completedStatusFilterCodes

    return metadata.statusOptions.filter((item) =>
      allowedStatusCodes.has(
        normalizeInspectionTeamTaskStatusValue(item.value ?? item.label)
      )
    )
  }, [metadata.statusOptions, taskTab])

  const createdByOptions = useMemo(() => {
    if (metadata.createdByOptions.length > 0) return metadata.createdByOptions

    const options = new Map<string, TaskFilterOption>()

    ;([...rows.todo, ...rows.completed] as InspectionTeamTaskRow[]).forEach((item) => {
      const value = String(item.createdBy || item.createdByLabel || "").trim()
      const label = String(item.createdByLabel || item.createdBy || "").trim()
      if (!value || !label || options.has(value)) return

      options.set(value, {
        value,
        label,
      })
    })

    return Array.from(options.values())
  }, [metadata.createdByOptions, rows.completed, rows.todo])

  const filterInspectorOptions = useMemo(
    () => normalizeInspectionTeamInspectorSelectOptions(metadata.inspectorOptions),
    [metadata.inspectorOptions]
  )

  const tableFilters = useMemo(() => {
    const filters: FilterItem[] = [
      {
        label: t("common.search"),
        element: (
          <Input
            key="input-keyword"
            className="team-management-filter-table__inspection-search"
            placeholder={t("common.search")}
            allowClear
          />
        ),
        requestDebounceMs: 500,
      },
      {
        label: t("inspection.tasks.columns.inspectionReason"),
        element: (
          <Select
            key="select-reason"
            placeholder={t("inspection.tasks.filters.allReasons")}
            options={metadata.reasonOptions}
            allowClear
          />
        ),
      },
      {
        label: t("inspection.tasks.columns.status"),
        element: (
          <Select
            key="select-status"
            placeholder={t("inspection.tasks.filters.allStatuses")}
            options={statusOptions}
            allowClear
          />
        ),
      },
    ]

    const rangePlaceholders: [string, string] = [
      t("inspection.tasks.filters.startDate", "Start date"),
      t("inspection.tasks.filters.endDate", "End date"),
    ]

    filters.push({
      label: t("inspection.tasks.columns.emirate"),
      element: (
        <Select
          key="select-emirate"
          options={metadata.emirateOptions}
          allowClear
          placeholder={t("inspection.tasks.filters.selectEmirate")}
        />
      ),
    })

    filters.push({
      label: t("inspection.tasks.columns.area"),
      element: (
        <Select
          key="select-area"
          options={metadata.areaOptions}
          allowClear
          placeholder={t("inspection.tasks.filters.selectArea")}
        />
      ),
    })

    filters.push({
      label: t("inspection.tasks.columns.inspectionMethod"),
      element: (
        <Select
          key="select-inspectionMethod"
          options={metadata.methodOptions}
          allowClear
          placeholder={t("inspection.tasks.filters.selectInspectionMethod")}
        />
      ),
    })

    filters.push({
      label: t("inspection.tasks.columns.priority"),
      element: (
        <Select
          key="select-priority"
          options={metadata.priorityOptions}
          allowClear
          placeholder={t("inspection.tasks.filters.selectPriority")}
        />
      ),
    })

    filters.push({
      label: t("inspection.tasks.columns.dueDate"),
      element: (
        <DatePicker.RangePicker
          key="range-dueDateRange"
          format={["DD/MM/YYYY"]}
          placeholder={rangePlaceholders}
        />
      ),
    })

    filters.push({
      label: t("inspection.tasks.columns.inspector"),
      element: (
        <InspectorSelect
          key="select-assignedInspector"
          options={filterInspectorOptions}
          allowClear
          multiple={false}
          placeholder={t("inspection.tasks.fields.selectInspector")}
        />
      ),
    })

    filters.push({
      label: t("inspection.tasks.fields.createdBy"),
      element: (
        <Select
          key="select-createdBy"
          options={createdByOptions}
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t("inspection.tasks.filters.selectCreatedBy")}
          className="umc-select-arrow-manual"
        />
      ),
    })

    filters.push({
      label: t("inspection.tasks.columns.creationTime"),
      element: (
        <DatePicker.RangePicker
          key="range-creationTimeRange"
          format={["DD/MM/YYYY"]}
          placeholder={rangePlaceholders}
        />
      ),
    })

    return filters
  }, [
    createdByOptions,
    filterInspectorOptions,
    metadata.areaOptions,
    metadata.emirateOptions,
    metadata.methodOptions,
    metadata.reasonOptions,
    metadata.priorityOptions,
    statusOptions,
    t,
  ])

  return {
    tableFilters,
  }
}
