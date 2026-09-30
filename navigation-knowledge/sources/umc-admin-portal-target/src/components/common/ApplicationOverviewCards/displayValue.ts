import { parsePhoneNumberFromString } from "libphonenumber-js"
import { emiratesIdToDisplay } from "@/utils/emiratesId"

export function getDisplayValue(
  value?: string | number | null,
  fallback = "-",
) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : fallback
  }
  const text = String(value ?? "").trim()
  return text || fallback
}

export function getPhoneDisplayValue(
  value?: string | number | null,
  fallback = "-",
) {
  const text = getDisplayValue(value, "")

  if (!text) {
    return fallback
  }

  const normalizedText = text.replace(/[\s()-]/g, "")
  const hasInternationalPrefix = normalizedText.startsWith("+")
  const digits = normalizedText.replace(/^\+/, "")

  if (!/^\d+$/.test(digits)) {
    return text
  }

  const phoneNumber = parsePhoneNumberFromString(
    hasInternationalPrefix ? normalizedText : `+${normalizedText}`,
  )

  if (
    !phoneNumber?.nationalNumber ||
    !phoneNumber.isValid() ||
    phoneNumber.number.replace(/^\+/, "") !== digits
  ) {
    return text
  }

  const displayCountryCode = hasInternationalPrefix
    ? `+${phoneNumber.countryCallingCode}`
    : phoneNumber.countryCallingCode

  return `${displayCountryCode} ${phoneNumber.nationalNumber}`
}

export function getEmiratesIdDisplayValue(
  value?: string | number | null,
  fallback = "-",
) {
  const text = getDisplayValue(value, "")

  if (!text) {
    return fallback
  }

  return emiratesIdToDisplay(text) || text
}
