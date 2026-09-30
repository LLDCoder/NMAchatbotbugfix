import type { ApplicationOverviewProfileType } from "../types"

export const normalizeUserTypeId = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim()

    if (!trimmedValue) {
      return undefined
    }

    const numericValue = Number(trimmedValue)
    return Number.isFinite(numericValue) ? numericValue : undefined
  }

  return undefined
}

export const hasExplicitUserTypeId = (value: unknown): boolean =>
  normalizeUserTypeId(value) !== undefined

export const isIndividualUserType = (value: unknown): boolean =>
  normalizeUserTypeId(value) === 1

export const resolveProfileTypeFromUserTypeId = (
  value: unknown,
  fallback: ApplicationOverviewProfileType = "Individual",
): ApplicationOverviewProfileType => {
  const normalizedUserTypeId = normalizeUserTypeId(value)

  if (normalizedUserTypeId === undefined) {
    return fallback
  }

  return normalizedUserTypeId === 1 ? "Individual" : "Commercial"
}
