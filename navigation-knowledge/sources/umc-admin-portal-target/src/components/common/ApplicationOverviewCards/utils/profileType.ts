export type OverviewProfileType = "Individual" | "Commercial";

const normalizeProfileTypeValue = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();

export const resolveOverviewProfileType = (
  value: unknown,
  fallback: OverviewProfileType = "Individual",
): OverviewProfileType => {
  const normalizedValue = normalizeProfileTypeValue(value);

  if (!normalizedValue) {
    return fallback;
  }

  if (
    normalizedValue.includes("individual") ||
    normalizedValue.includes("personal") ||
    normalizedValue.includes("person")
  ) {
    return "Individual";
  }

  if (
    normalizedValue.includes("commercial") ||
    normalizedValue.includes("establishment") ||
    normalizedValue.includes("company") ||
    normalizedValue.includes("business") ||
    normalizedValue.includes("corporate") ||
    normalizedValue.includes("organization") ||
    normalizedValue.includes("organisation") ||
    normalizedValue.includes("institution")
  ) {
    return "Commercial";
  }

  const numericValue = Number(normalizedValue);
  if (Number.isFinite(numericValue)) {
    if (numericValue === 1) return "Commercial";
    if (numericValue === 2) return "Individual";
  }

  return fallback;
};
