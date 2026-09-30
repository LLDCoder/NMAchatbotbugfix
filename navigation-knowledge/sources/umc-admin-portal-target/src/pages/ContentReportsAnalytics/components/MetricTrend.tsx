import type { MetricCellData } from "../type";

interface MetricTrendProps {
  metric: MetricCellData | string;
}

/**
 * Renders the value only.
 *
 * The period-over-period delta (the green/red percentage under each figure) was
 * dropped from every Reports & Analytics table on request. `MetricCellData`
 * still carries `delta` and `tone` because the KPI cards and trend widgets use
 * the same mapper output — this component simply ignores them, so restoring the
 * column-level delta later means re-rendering them here and nothing else.
 */
export default function MetricTrend({ metric }: MetricTrendProps) {
  if (typeof metric === "string") {
    return <span className="content-reports__table-text">{metric}</span>;
  }

  return <span className="content-reports__table-text">{metric.value}</span>;
}
