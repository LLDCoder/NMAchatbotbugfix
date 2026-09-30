export const INTERNATIONAL_TEXT_PATTERN = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}\u200C\u200D]*$/u;
export const INTERNATIONAL_NAME_PATTERN = /^(?=.*(?!\u0640)\p{L})[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}\u200C\u200D]*$/u;

export const isInternationalText = (value: unknown): boolean =>
  INTERNATIONAL_TEXT_PATTERN.test(String(value ?? ""));
export const isInternationalName = (value: unknown): boolean =>
  INTERNATIONAL_NAME_PATTERN.test(String(value ?? ""));
export const codePointLength = (value: unknown): number =>
  Array.from(String(value ?? "").trim()).length;

/** Keep invalid controls visible to validation instead of trimming them away. */
export const trimInternationalText = (value: unknown): string => {
  const text = String(value ?? "");
  return isInternationalText(text) ? text.trim() : text;
};
