import type { ValueFormat } from "./types";

export const formatCount = (value: number) =>
  Math.round(value || 0).toLocaleString("en-US");

// Abbreviated units (K/M/B) default to two decimals, e.g. 1.23M / 500.00K.
const COMPACT_FRACTION_DIGITS = 2;

const formatCompactNumber = (
  value: number,
  fractionDigits = COMPACT_FRACTION_DIGITS,
) => {
  const normalized = Number.isFinite(value) ? value : 0;
  const units = [
    { divisor: 1_000_000_000, suffix: "B" },
    { divisor: 1_000_000, suffix: "M" },
    { divisor: 1_000, suffix: "K" },
  ];
  const unitIndex = units.findIndex((candidate) => Math.abs(normalized) >= candidate.divisor);

  if (unitIndex < 0) return formatCount(normalized);

  const unit =
    Math.abs(Number((normalized / units[unitIndex].divisor).toFixed(fractionDigits))) >= 1000 &&
    unitIndex > 0
      ? units[unitIndex - 1]
      : units[unitIndex];
  return `${(normalized / unit.divisor).toFixed(fractionDigits)}${unit.suffix}`;
};

export const formatCompactCount = (value: number) => formatCompactNumber(value);

export const formatCompactDecimal = (value: number, digits = 1) => {
  const normalized = Number.isFinite(value) ? value : 0;
  if (Math.abs(normalized) >= 1_000) return formatCompactNumber(normalized);

  return normalized.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const formatCurrency = (value: number, compact = false) => {
  const normalized = Number.isFinite(value) ? value : 0;
  if (compact) return `AED ${formatCompactNumber(normalized)}`;
  return `AED ${Math.round(normalized).toLocaleString("en-US")}`;
};

export const formatPercentage = (value: number, digits = 1) =>
  `${(Number.isFinite(value) ? value : 0).toFixed(digits)}%`;

export const formatDuration = (hours: number) => {
  const normalized = Math.max(hours || 0, 0);
  if (normalized >= 24) return `${(normalized / 24).toFixed(1)}d`;
  if (normalized >= 1) return `${normalized.toFixed(1)}h`;
  return `${Math.round(normalized * 60)}min`;
};

export const formatScore = (value: number) =>
  `${(Number.isFinite(value) ? value : 0).toFixed(1)}/100`;

export const formatKpiValue = (value: number, format: ValueFormat) => {
  if (format === "currency") return formatCurrency(value, true);
  if (format === "percentage") return formatPercentage(value, 1);
  if (format === "duration") return formatDuration(value);
  if (format === "score") return formatScore(value);
  return formatCount(value);
};

export const formatDetailedValue = (
  value: number,
  format: Exclude<ValueFormat, "duration" | "score">,
) => {
  if (format === "currency") return formatCurrency(value);
  if (format === "percentage") return formatPercentage(value, 2);
  return formatCount(value);
};

export const formatAxisValue = (
  value: number,
  format: Exclude<ValueFormat, "duration" | "score">,
) => {
  if (format === "currency") return formatCurrency(value, true);
  if (format === "percentage") return `${Math.round(value)}%`;
  return formatCompactCount(value);
};
