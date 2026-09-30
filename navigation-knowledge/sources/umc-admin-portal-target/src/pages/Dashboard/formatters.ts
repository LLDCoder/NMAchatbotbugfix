const DASHBOARD_DONUT_NUMERIC_PATTERN =
  /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

const parseDashboardDonutNumber = (value: string | number) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalizedValue = value.trim();

  if (!DASHBOARD_DONUT_NUMERIC_PATTERN.test(normalizedValue)) {
    return null;
  }

  const numericValue = Number(normalizedValue.replace(/,/g, ""));

  return Number.isFinite(numericValue) ? numericValue : null;
};

export const formatDashboardDonutDisplayNumber = (value: string | number) => {
  const numericValue = parseDashboardDonutNumber(value);

  if (numericValue === null) {
    return String(value);
  }

  const absoluteValue = Math.abs(numericValue);

  if (absoluteValue >= 1000000) {
    return `${(numericValue / 1000000).toFixed(2)}M`;
  }

  if (absoluteValue >= 100000) {
    return `${(numericValue / 1000).toFixed(1)}K`;
  }

  return numericValue.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
};
