/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InspectorSelectOption } from "@/pages/InspectionTaskManagement/components/InspectorSelect"
import { normalizeInspectorIds } from "@/pages/InspectionTaskManagement/components/inspectorSelectUtils"

export const getInspectorIdValue = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim()
  if (!value || typeof value !== "object") return ""
  const record = value as Record<string, unknown>
  return String(record.inspectorId || record.id || record.userId || "").trim()
}

export const getAssignedInspectorIds = (
  assignment?: Record<string, any> | null
) => {
  const assignedInspectors = assignment?.assignedInspectors
  if (Array.isArray(assignedInspectors)) {
    const inspectorIds = assignedInspectors
      .map(getInspectorIdValue)
      .filter(Boolean)
    if (inspectorIds.length) return inspectorIds
  }

  return normalizeInspectorIds(getInspectorIdValue(assignedInspectors) || getInspectorIdValue(assignment?.assignedInspector))
}

const getInspectorNameValue = (value: unknown) => {
  if (!value || typeof value !== "object") return ""
  const record = value as Record<string, unknown>
  return String(
    record.inspectorName ||
    record.name ||
    record.userName ||
    record.label ||
    ""
  ).trim()
}

const normalizeInspectorSelectOptions = (
  items?: InspectorSelectOption[] | null
): InspectorSelectOption[] => (items || []).reduce<InspectorSelectOption[]>((result, item) => {
  const id = String(item?.id || "").trim()
  const name = String(item?.name || id).trim()
  if (!id) return result

  result.push({ id, name: name || id })
  return result
}, [])

export const getAssignedInspectorOptions = (
  assignment?: Record<string, any> | null
): InspectorSelectOption[] => {
  const optionMap = new Map<string, InspectorSelectOption>()
  const appendOption = (item: unknown) => {
    const id = getInspectorIdValue(item)
    if (!id || optionMap.has(id)) return

    optionMap.set(id, {
      id,
      name: getInspectorNameValue(item) || id,
    })
  }

  const assignedInspectors = assignment?.assignedInspectors
  if (Array.isArray(assignedInspectors)) {
    assignedInspectors.forEach(appendOption)
  } else {
    appendOption(assignedInspectors)
  }
  // `assignedInspector` carries the inspector display name, not an id, so it would be
  // registered under a second key and render the selected inspector twice in the dropdown.
  // Keep it as a last-resort fallback only, mirroring getAssignedInspectorIds.
  if (!optionMap.size) {
    appendOption(assignment?.assignedInspector)
  }

  return Array.from(optionMap.values())
}

export const mergeInspectorSelectOptions = (
  ...groups: Array<InspectorSelectOption[] | null | undefined>
) => {
  const optionMap = new Map<string, InspectorSelectOption>()

  groups.forEach((items) => {
    normalizeInspectorSelectOptions(items).forEach((item) => {
      const current = optionMap.get(item.id)
      if (!current || current.name === current.id) {
        optionMap.set(item.id, item)
      }
    })
  })

  return Array.from(optionMap.values())
}
