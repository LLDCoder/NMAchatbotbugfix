export const formatChartAxisValue = (value: number, suffix?: string) => {
  if (!suffix) {
    return `${value}`;
  }

  return value === 0 ? "0" : `${value}${suffix}`;
};

const CHART_UNIT_MULTIPLIERS: Record<string, number> = {
  B: 1_000_000_000,
  M: 1_000_000,
  K: 1_000,
};

const UNIT_PROMOTION_THRESHOLD = 0.999995;

const formatChartValue = (value: number) =>
  value.toFixed(2).replace(/\.?0+$/, "");

export const formatChartTooltipValue = (value: number, suffix?: string) => {
  const actualValue = value * (CHART_UNIT_MULTIPLIERS[suffix ?? ""] ?? 1);
  const absoluteValue = Math.abs(actualValue);

  if (
    absoluteValue >=
    CHART_UNIT_MULTIPLIERS.B * UNIT_PROMOTION_THRESHOLD
  ) {
    return `${formatChartValue(actualValue / CHART_UNIT_MULTIPLIERS.B)}B`;
  }

  if (
    absoluteValue >=
    CHART_UNIT_MULTIPLIERS.M * UNIT_PROMOTION_THRESHOLD
  ) {
    return `${formatChartValue(actualValue / CHART_UNIT_MULTIPLIERS.M)}M`;
  }

  if (
    absoluteValue >=
    CHART_UNIT_MULTIPLIERS.K * UNIT_PROMOTION_THRESHOLD
  ) {
    return `${formatChartValue(actualValue / CHART_UNIT_MULTIPLIERS.K)}K`;
  }

  return formatChartValue(actualValue);
};
