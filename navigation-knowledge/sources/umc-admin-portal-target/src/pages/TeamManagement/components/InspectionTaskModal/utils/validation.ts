import type React from "react"

const EMIRATES_ID_DIGITS_REGEX = /^784\d{12}$/
export const EMIRATES_ID_MAX_LENGTH = 15
const ARABIC_LETTER_REGEX = /^(?:[\u0621-\u063A\u0641-\u064A\u066E-\u066F\u0671-\u06D3\u06D5]|(?=\p{Script_Extensions=Arabic})[\p{L}\p{M}])$/u

const normalizeLocalizedDigits = (value: unknown) => String(value ?? "")
  .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))

const getDigitsOnlyValue = (value: unknown, maxLength?: number) => {
  const digits = normalizeLocalizedDigits(value).replace(/\D/g, "")
  return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits
}

const isDigitsOnlyText = (value: unknown) => /^\d+$/.test(normalizeLocalizedDigits(value))

const digitInputControlKeys = new Set([
  "Backspace",
  "Delete",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "Tab",
  "Enter",
  "Escape",
])

export const preventNonDigitKeyDown = (
  event: React.KeyboardEvent<HTMLInputElement>
) => {
  if (event.ctrlKey || event.metaKey || digitInputControlKeys.has(event.key)) return
  if (event.key.length === 1 && !/^\d$/.test(event.key)) {
    event.preventDefault()
  }
}

export const preventInvalidDigitPaste = (
  event: React.ClipboardEvent<HTMLInputElement>
) => {
  const text = event.clipboardData.getData("text")
  if (text && !isDigitsOnlyText(text)) {
    event.preventDefault()
  }
}

export const normalizeEmiratesId = (value: unknown) =>
  getDigitsOnlyValue(value, EMIRATES_ID_MAX_LENGTH)

const isValidEmiratesId = (value: unknown) => {
  const normalized = normalizeEmiratesId(value)
  return Boolean(normalized && EMIRATES_ID_DIGITS_REGEX.test(normalized))
}

export const validateEmiratesId = (
  _: unknown,
  value: unknown,
  message: string
) => {
  const text = String(value ?? "").trim()
  if (!text || isValidEmiratesId(text)) {
    return Promise.resolve()
  }
  return Promise.reject(new Error(message))
}

const isArabicEnglishFullNameCharacter = (character: string) => (
  /[A-Za-z\s]/.test(character) || ARABIC_LETTER_REGEX.test(character)
)

export const normalizeArabicEnglishFullName = (value: unknown) => (
  Array.from(String(value ?? "")).filter(isArabicEnglishFullNameCharacter).join("")
)
