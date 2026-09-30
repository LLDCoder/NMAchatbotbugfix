/* eslint-disable @typescript-eslint/no-explicit-any */
import { fromApi, nowGst, toApi } from "@/utils/gstTime"
import type React from "react"
import type {
  InspectionTeamManagementMemberCardDto,
  InspectionTeamManagementMetadataDto,
  InspectionTeamManagementMetadataOptionDto,
  InspectionTeamManagementLocationOptionDto,
  InspectionTeamManagementTaskItemDto,
  InspectionTeamManagementTaskQueryPayload,
  InspectionTeamManagementTaskQueryResponse,
} from "@/services/inspectionTeamManagement"
import {
  getTaskTargetName,
  normalizeTaskStatus,
} from "@/pages/InspectionCommon/helpers"
import type { InspectorSelectOption } from "@/pages/InspectionTaskManagement/components/InspectorSelect"
import {
  APPEAL_SOURCE_TYPE,
  DEFAULT_INSPECTION_TEAM_TASK_VIEW_STATE,
  inspectionTeamTaskNumericStatusMap,
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  SLA_ACTIVE_STATUS_CODES,
  SLA_CLOSED_STATUS_CODES,
} from "./constants"
import type {
  InspectionTeamTaskMetadataOptions,
  InspectionTeamTaskQueryResult,
  InspectionTeamTaskRow,
  InspectionTeamTaskSortField,
  InspectionTeamTaskViewState,
  TaskFilterOption,
  TeamTaskView,
} from "./type"

type InspectionTeamTaskTranslate = (
  key: string,
  options?: Record<string, unknown>
) => string


export const createDefaultInspectionTeamTaskViewState = (
  view: TeamTaskView
): InspectionTeamTaskViewState => ({
  ...DEFAULT_INSPECTION_TEAM_TASK_VIEW_STATE[view],
})

export const createDefaultInspectionTeamTaskMetadataOptions =
  (): InspectionTeamTaskMetadataOptions => ({
    reasonOptions: [],
    statusOptions: [],
    emirateOptions: [],
    areaOptions: [],
    methodOptions: [],
    priorityOptions: [],
    inspectorOptions: [],
    createdByOptions: [],
  })

export const buildInspectionTeamTaskQueryCacheKey = (
  payload: InspectionTeamManagementTaskQueryPayload
) =>
  Object.keys(payload)
    .sort()
    .reduce<string[]>((result, key) => {
      const value = payload[key as keyof InspectionTeamManagementTaskQueryPayload]
      if (value === undefined) {
        return result
      }

      result.push(`${key}:${String(value)}`)
      return result
    }, [])
    .join("|")

export const buildInspectionTeamTaskQueryResult = (
  view: TeamTaskView,
  payload: InspectionTeamManagementTaskQueryPayload,
  response?: InspectionTeamManagementTaskQueryResponse | null,
  t?: InspectionTeamTaskTranslate
): InspectionTeamTaskQueryResult => {
  const page = response?.page
  const items = Array.isArray(page?.items)
    ? page.items.map((item) => normalizeInspectionTeamTaskRow(item, t))
    : []

  return {
    rows: items,
    viewState: {
      pageIndex: Number(page?.pageIndex || payload.pageIndex || 1),
      pageSize: Number(page?.pageSize || payload.pageSize || 10),
      total: Number(page?.total || 0),
      sortBy:
        (payload.sortBy as InspectionTeamTaskSortField) ||
        createDefaultInspectionTeamTaskViewState(view).sortBy,
      sortDirection:
        payload.sortDirection ??
        createDefaultInspectionTeamTaskViewState(view).sortDirection,
    },
  }
}

export const normalizeInspectionTeamMetadataOptions = (
  items?: InspectionTeamManagementMetadataOptionDto[] | null
) =>
  (items || []).reduce<TaskFilterOption[]>((result, item) => {
    const value = String(item?.code || "").trim()
    if (!value) return result

    result.push({
      value,
      label: String(item?.display || value),
    })
    return result
  }, [])

const normalizeInspectionTeamLocationOptions = (
  items?: InspectionTeamManagementLocationOptionDto[] | null,
  language = "en"
) =>
  (items || []).map((item) => ({
    value: String(item.id),
    label: String(
      (language === "ar" ? item.nameAr : item.nameEn) ||
        item.nameEn ||
        item.nameAr ||
        item.id
    ),
  }))

export const normalizeInspectionMemberInspectorOptions = (
  items?: InspectionTeamManagementMemberCardDto[] | null
) =>
  (items || []).reduce<InspectorSelectOption[]>((result, item) => {
    const id = String(item?.userId || "").trim()
    const name = String(item?.userName || id).trim()
    if (!id || result.some((option) => option.id === id)) {
      return result
    }

    result.push({
      id,
      name: name || id,
    })
    return result
  }, [])

export const normalizeInspectionTeamInspectorSelectOptions = (
  items?: TaskFilterOption[] | null
) =>
  (items || []).reduce<InspectorSelectOption[]>((result, item) => {
    const id = String(item?.value || "").trim()
    const name = String(item?.label || id).trim()
    if (!id || result.some((option) => option.id === id)) {
      return result
    }

    result.push({
      id,
      name: name || id,
    })
    return result
  }, [])

export const buildInspectionTeamTaskMetadataOptions = (
  metadata?: InspectionTeamManagementMetadataDto | null,
  language = "en"
): InspectionTeamTaskMetadataOptions => ({
  reasonOptions: normalizeInspectionTeamMetadataOptions(metadata?.reasons),
  statusOptions: normalizeInspectionTeamMetadataOptions(metadata?.statuses),
  emirateOptions: normalizeInspectionTeamLocationOptions(
    metadata?.geography?.emirates,
    language
  ),
  areaOptions: normalizeInspectionTeamLocationOptions(
    metadata?.geography?.areas,
    language
  ),
  methodOptions: normalizeInspectionTeamMetadataOptions(
    metadata?.inspectionMethods
  ),
  priorityOptions: normalizeInspectionTeamMetadataOptions(metadata?.priorities),
  inspectorOptions: normalizeInspectionTeamMetadataOptions(metadata?.inspectors),
  createdByOptions: normalizeInspectionTeamMetadataOptions(
    metadata?.createdByUsers
  ),
})

export const getInspectionTeamTaskDisplayValue = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value === "object") continue

    const normalizedValue = String(value || "").trim()
    if (normalizedValue) return normalizedValue
  }

  return "-"
}

export const asInspectionTeamTaskRecord = (
  value?: unknown
): Record<string, any> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null

export const normalizeSlaTone = (value?: unknown) =>
  String(value || "")
    .trim()
    .replace(/[\s_-]+/g, "")
    .toLowerCase()

export const normalizeInspectionTeamTaskStatusValue = (value?: unknown) => {
  const rawValue = String(value ?? "").trim()
  if (!rawValue) return ""

  const mappedStatus = inspectionTeamTaskNumericStatusMap[rawValue]
  if (mappedStatus) return mappedStatus

  return normalizeTaskStatus(rawValue)
}

const getInspectionTeamTaskRowKey = (
  item?: InspectionTeamManagementTaskItemDto | null
) => {
  const sourceType = String(item?.sourceType || "").trim()
  const sourceId = String(item?.sourceId || item?.taskId || item?.taskNo || "").trim()
  return sourceType && sourceId ? `${sourceType}::${sourceId}` : sourceId
}

const getInspectionTeamTaskTargetLabel = (
  item?: InspectionTeamManagementTaskItemDto | null
) => {
  const targetRecord = asInspectionTeamTaskRecord(item?.inspectionTarget)
  const targetName = getTaskTargetName({ inspectionTarget: targetRecord })

  return getInspectionTeamTaskDisplayValue(
    targetName !== "-" ? targetName : "",
    item?.inspectionTargetDisplay,
    item?.inspectionTargetName,
    item?.inspectionTarget,
    item?.applyFor
  )
}

const toFiniteNumber = (value?: unknown) => {
  if (
    value == null ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null
  }

  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : null
}

const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

// SLA wording is assembled on the client, so every segment has to go through i18n
// to stay readable in Arabic; the fallback keeps English when no translator is passed.
const translateSlaText = (
  t: InspectionTeamTaskTranslate | undefined,
  key: string,
  fallback: string,
  options?: Record<string, unknown>
) => {
  const translationKey = `teamManagement.sla.${key}`
  const text = t?.(translationKey, options)
  return text && text !== translationKey ? text : fallback
}

const formatRemainingDuration = (
  value: number,
  t?: InspectionTeamTaskTranslate
) => {
  const totalMinutes = Math.max(0, Math.ceil(value))
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY)
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR)
  const minutes = totalMinutes % MINUTES_PER_HOUR

  if (days >= 1) {
    return hours > 0
      ? translateSlaText(t, "durationDaysHours", `${days}d ${hours}h`, {
          days,
          hours,
        })
      : translateSlaText(t, "durationDays", `${days}d`, { count: days })
  }

  if (hours >= 1) {
    return minutes > 0
      ? translateSlaText(t, "durationHoursMinutes", `${hours}h ${minutes}m`, {
          hours,
          minutes,
        })
      : translateSlaText(t, "durationHours", `${hours}h`, { count: hours })
  }

  const safeMinutes = Math.max(1, minutes)
  return translateSlaText(t, "durationMinutes", `${safeMinutes}m`, {
    count: safeMinutes,
  })
}

const getInspectionTeamTaskSlaPresentation = (
  item?: InspectionTeamManagementTaskItemDto | null,
  t?: InspectionTeamTaskTranslate
) => {
  const statusCode = normalizeInspectionTeamTaskStatusValue(
    item?.statusCode ?? item?.status
  )

  const slaDisplayText = String(item?.sla?.displayText || "").trim()
  const slaRecord = asInspectionTeamTaskRecord(item?.sla)
  const normalizedDisplayText = normalizeSlaTone(slaDisplayText)

  // Appeal rows carry appeal status ids, not inspection task status ids, so the
  // numeric map above would read "3" (Department Processing) as ACCESS_FAILED and
  // close out an SLA that is still running. The backend already formats the appeal
  // SLA the same way the appeal detail page does, so take its text as-is.
  if (
    String(item?.sourceType || "")
      .trim()
      .toLowerCase() === APPEAL_SOURCE_TYPE
  ) {
    if (!slaDisplayText) {
      return { text: "-", tone: "default" as const, isOverdue: false }
    }

    // The backend localizes this text, and a completed row carries no remaining
    // minutes for `isOverdue` to be derived from, so the Arabic wording has to be
    // matched too: متأخر = Overdue (active), تجاوز الوقت = Exceeded (completed late).
    if (
      Boolean(item?.sla?.isOverdue) ||
      normalizedDisplayText.includes("overdue") ||
      normalizedDisplayText.includes("exceeded") ||
      normalizedDisplayText.includes("متأخر") ||
      normalizedDisplayText.includes("تجاوز")
    ) {
      return { text: slaDisplayText, tone: "danger" as const, isOverdue: true }
    }

    if (normalizedDisplayText.includes("duetoday")) {
      return { text: slaDisplayText, tone: "warning" as const, isOverdue: false }
    }

    return { text: slaDisplayText, tone: "default" as const, isOverdue: false }
  }

  const dueOnRaw = String(item?.sla?.dueOn || item?.dueDate || "").trim()
  // Parse backend Dubai wall-clock values in the Dubai timezone (not browser TZ).
  const dueOn = dueOnRaw ? fromApi(dueOnRaw)?.toDate() ?? null : null
  const hasValidDueOn = Boolean(dueOn && !Number.isNaN(dueOn.getTime()))
  const completedOnRaw = String(
    slaRecord?.completedOn || item?.lastUpdatedOn || ""
  ).trim()
  const completedOn = completedOnRaw ? fromApi(completedOnRaw)?.toDate() ?? null : null
  const hasValidCompletedOn = Boolean(
    completedOn && !Number.isNaN(completedOn.getTime())
  )

  if (SLA_CLOSED_STATUS_CODES.has(statusCode)) {
    const isExceeded =
      Boolean(item?.sla?.isOverdue) ||
      normalizedDisplayText.includes("overdue") ||
      normalizedDisplayText.includes("exceeded") ||
      (hasValidDueOn &&
        hasValidCompletedOn &&
        dueOn &&
        completedOn &&
        completedOn.getTime() > dueOn.getTime())

    return {
      text: isExceeded
        ? translateSlaText(t, "exceeded", "Exceeded")
        : translateSlaText(t, "onTime", "On Time"),
      tone: isExceeded ? ("danger" as const) : ("default" as const),
      isOverdue: isExceeded,
    }
  }

  if (!SLA_ACTIVE_STATUS_CODES.has(statusCode)) {
    return {
      text: "-",
      tone: "default" as const,
      isOverdue: false,
    }
  }

  const remainingMinutesValue = toFiniteNumber(item?.sla?.remainingMinutes)
  // SLA countdown must be Dubai-anchored; fromApi() already returns real instants,
  // so comparing against the real "now" is correct.
  const now = nowGst().toDate()
  const fallbackMinutes =
    hasValidDueOn && dueOn
      ? (dueOn.getTime() - now.getTime()) / (1000 * MINUTES_PER_HOUR)
      : null
  const remainingMinutes =
    remainingMinutesValue !== null ? remainingMinutesValue : fallbackMinutes

  if (hasValidDueOn && dueOn && dueOn.getTime() < now.getTime()) {
    const overdueDays = Math.max(
      1,
      Math.ceil((now.getTime() - dueOn.getTime()) / (1000 * 60 * 60 * 24))
    )
    return {
      text: translateSlaText(t, "overdueDays", `${overdueDays}d Overdue`, {
        count: overdueDays,
      }),
      tone: "danger" as const,
      isOverdue: true,
    }
  }

  if (
    Boolean(item?.sla?.isOverdue) &&
    remainingMinutes !== null &&
    remainingMinutes < 0
  ) {
    const overdueDays = Math.max(
      1,
      Math.ceil(Math.abs(remainingMinutes) / MINUTES_PER_DAY)
    )
    return {
      text: translateSlaText(t, "overdueDays", `${overdueDays}d Overdue`, {
        count: overdueDays,
      }),
      tone: "danger" as const,
      isOverdue: true,
    }
  }

  if (hasValidDueOn && dueOn && isSameLocalDay(dueOn, now)) {
    return {
      text: translateSlaText(t, "dueToday", "Due Today"),
      tone: "warning" as const,
      isOverdue: false,
    }
  }

  if (remainingMinutes !== null && remainingMinutes >= 0) {
    const duration = formatRemainingDuration(remainingMinutes, t)
    return {
      text: translateSlaText(t, "dueIn", `Due in ${duration}`, { duration }),
      tone: "default" as const,
      isOverdue: false,
    }
  }

  if (!slaDisplayText) {
    return {
      text: "-",
      tone: "default" as const,
      isOverdue: false,
    }
  }

  if (normalizedDisplayText.includes("overdue")) {
    return {
      text: slaDisplayText,
      tone: "danger" as const,
      isOverdue: true,
    }
  }

  if (normalizedDisplayText.includes("duetoday")) {
    return {
      text: slaDisplayText,
      tone: "warning" as const,
      isOverdue: false,
    }
  }

  return {
    text: slaDisplayText,
    tone: "default" as const,
    isOverdue: false,
  }
}

export const getInspectionTeamTaskSlaClassName = (
  record?: InspectionTeamTaskRow
) => {
  if (record?.slaTone === "danger") {
    return "inspection-task-management__sla-cell--red"
  }

  if (record?.slaTone === "warning") {
    return "inspection-task-management__sla-cell--yellow"
  }

  return ""
}

const getInspectionTeamTaskCreatedByLabel = (
  item?: InspectionTeamManagementTaskItemDto | null
) => {
  const displayLabel = getInspectionTeamTaskDisplayValue(
    item?.createdByDisplay,
    item?.createdBy
  )
  if (displayLabel !== "-") return displayLabel

  const normalizedCode = normalizeSlaTone(item?.createdByCode)
  if (
    normalizedCode.includes("ai") ||
    normalizedCode.includes("auto") ||
    normalizedCode.includes("system")
  ) {
    return "AI-generated"
  }

  return "-"
}

const getInspectionTeamTaskAreaLabel = (
  item?: InspectionTeamManagementTaskItemDto | null
) => {
  const targetRecord = asInspectionTeamTaskRecord(item?.inspectionTarget)

  return getInspectionTeamTaskDisplayValue(
    item?.areaDisplay,
    item?.area,
    targetRecord?.address?.areaNameEn,
    targetRecord?.address?.communityNameEn
  )
}

export const normalizeInspectionTeamTaskRow = (
  item: InspectionTeamManagementTaskItemDto,
  t?: InspectionTeamTaskTranslate
): InspectionTeamTaskRow => {
  const slaPresentation = getInspectionTeamTaskSlaPresentation(item, t)

  return {
    ...item,
    rowKey: getInspectionTeamTaskRowKey(item),
    inspectionTargetLabel: getInspectionTeamTaskTargetLabel(item),
    inspectionReasonLabel: getInspectionTeamTaskDisplayValue(
      item?.inspectionReasonDisplay,
      item?.inspectionReason
    ),
    inspectorLabel: getInspectionTeamTaskDisplayValue(
      item?.assignedToDisplay,
      item?.primaryAssignedUserName,
      item?.assignedTo
    ),
    priorityLabel: getInspectionTeamTaskDisplayValue(
      item?.priorityDisplay,
      item?.priority
    ),
    dueDateValue: String(item?.dueDate || item?.sla?.dueOn || ""),
    emirateLabel: getInspectionTeamTaskDisplayValue(
      item?.emirateDisplay,
      item?.emirate
    ),
    areaLabel: getInspectionTeamTaskAreaLabel(item),
    assignedTimeValue: String(item?.assignedTimeDisplay || item?.assignedTime || ""),
    inspectionMethodLabel: getInspectionTeamTaskDisplayValue(
      item?.inspectionMethodDisplay,
      item?.inspectionMethod
    ),
    createdByLabel: getInspectionTeamTaskCreatedByLabel(item),
    statusLabelValue: getInspectionTeamTaskDisplayValue(
      item?.status,
      item?.statusDisplay
    ),
    slaText: slaPresentation.text,
    slaTone: slaPresentation.tone,
    isOverdueValue: Boolean(slaPresentation.isOverdue),
  }
}

export const formatTaskDate = (value?: string) => {
  // Display backend Dubai wall-clock values without browser-timezone shifting.
  const d = value ? fromApi(value) : null
  return d ? d.format("DD/MM/YYYY") : "-"
}

export const formatTaskDateTime = (value?: string) => {
  const d = value ? fromApi(value) : null
  return d ? d.format("DD/MM/YYYY HH:mm:ss") : "-"
}

export const getDefaultDuplicateDueDate = (value?: string) => {
  // Anchor on the Dubai clock and emit the offset-less contract format.
  const base = (value ? fromApi(value) : null) ?? nowGst()
  return toApi(base.add(14, "day"))
}

export const shouldIgnoreTaskRowClick = (
  event: React.MouseEvent<HTMLElement>
) => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return false

  if (
    target.closest(
      [
        "a",
        "button",
        "input",
        "textarea",
        "select",
        "[role=\"button\"]",
        ".ant-checkbox",
        ".ant-checkbox-wrapper",
        ".ant-dropdown-trigger",
        ".ant-select",
        ".inspection-task-management__actions",
        ".inspection-task-management__actions-column",
      ].join(",")
    )
  ) {
    return true
  }

  const cell = target.closest("td")
  return Boolean(
    cell?.classList.contains("ant-table-selection-column") ||
      cell?.classList.contains("inspection-task-management__actions-column") ||
      cell?.classList.contains("ant-table-cell-fix-right")
  )
}

export const getInspectionTeamTaskStatusCode = (
  record: InspectionTeamTaskRow
) =>
  normalizeInspectionTeamTaskStatusValue(
    record.statusCode ?? record.status ?? record.statusLabelValue
  )

export const isInspectionTeamTaskEditable = (record: InspectionTeamTaskRow) => {
  return getInspectionTeamTaskStatusCode(record) === "PENDING_VISIT"
}

export const getAreaName = (record?: Record<string, any>) =>
  record?.inspectionTarget?.address?.areaNameEn
  || record?.inspectionTarget?.address?.communityNameEn
  || "-"

export const getAuthorityName = (record?: Record<string, any>) =>
  record?.inspectionTarget?.address?.authorityNameEn || "-"
