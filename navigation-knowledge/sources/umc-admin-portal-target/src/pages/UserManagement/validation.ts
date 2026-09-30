import { isInternationalText, isInternationalName, codePointLength, trimInternationalText } from "../../utils/internationalText";
export const NAME_MAX_LENGTH = 50;
export const DEPARTMENT_NAME_MAX_LENGTH = 100;
export type TextKind = "name" | "departmentEn" | "departmentAr";
export type TextError = "required" | "length" | "characters" | "letter";
export type LockedUserField = "firstName" | "lastName" | "email" | "gender" | "emiratesId";
const lockedFields: LockedUserField[] = ["firstName", "lastName", "email", "gender", "emiratesId"];
export const trimText = trimInternationalText;

const DEPARTMENT_EN_PATTERN = /^[A-Za-z0-9 -]+$/;
const DEPARTMENT_AR_PATTERN = /^[\p{Script_Extensions=Arabic}\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF0-9 ]+$/u;

export function getTextError(value: unknown, kind: TextKind): TextError | null {
  if (kind === "name" && !isInternationalText(value)) return "characters";
  const text = trimText(value);
  if (!text) return "required";
  const max = kind === "name" ? NAME_MAX_LENGTH : DEPARTMENT_NAME_MAX_LENGTH;
  if (codePointLength(text) < 2 || codePointLength(text) > max) return "length";
  if (kind === "departmentEn" && !DEPARTMENT_EN_PATTERN.test(text)) return "characters";
  if (kind === "departmentAr" && !DEPARTMENT_AR_PATTERN.test(text)) return "characters";
  return kind === "name" && !isInternationalName(text) ? "letter" : null;
}

export function getFieldsToUnlock(names: (string | number)[][]): LockedUserField[] {
  return lockedFields.filter((field) => names.some((name) => name.length === 1 && name[0] === field));
}
