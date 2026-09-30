import type { MetricCellData } from "../type";

interface MetricTrendProps {
  metric: MetricCellData | string;
}

export default function MetricTrend({ metric }: MetricTrendProps) {
  if (typeof metric === "string") {
    return <span className="service-reports__table-text">{metric}</span>;
  }

  const toneClassName =
    metric.tone === "negative"
      ? "service-reports__table-delta--negative"
      : metric.tone === "neutral"
      ? "service-reports__table-delta--neutral"
      : "service-reports__table-delta--positive";

  return (
    <div className="service-reports__table-metric">
      <span className="service-reports__table-text">{metric.value}</span>
      {metric.delta ? (
        <span className={`service-reports__table-delta ${toneClassName}`}>
          {metric.delta}
        </span>
      ) : null}
    </div>
  );
}
