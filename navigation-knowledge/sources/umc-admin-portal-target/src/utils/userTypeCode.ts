// Lookup.UserTypes.Code values as returned by the API: "1" (Individual),
// "2" (Commercial Entity), "3" (Government Entity), ... — never zero-padded.
// Some screens were written against a padded form ("01"), which never matched
// and silently fell through to the establishment branch, so accept both here.
export const USER_TYPE_CODE_INDIVIDUAL = "1";
export const USER_TYPE_CODE_COMMERCIAL = "2";
export const USER_TYPE_CODE_GOVERNMENT = "3";
export const USER_TYPE_CODE_FREE_ZONE = "5";
export const USER_TYPE_CODE_TALENT_AGENCY = "12";
export const USER_TYPE_CODE_EMBASSY = "13";
export const USER_TYPE_CODE_CONSULATE = "14";
export const USER_TYPE_CODE_CULTURAL_CLUBS = "15";

export const normalizeUserTypeCode = (
  value: string | number | null | undefined
): string => {
  const normalized = String(value ?? "").trim();
  return normalized.replace(/^0+(?=\d)/, "");
};

export const isIndividualUserTypeCode = (
  value: string | number | null | undefined
): boolean => normalizeUserTypeCode(value) === USER_TYPE_CODE_INDIVIDUAL;
