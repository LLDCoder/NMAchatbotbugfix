/**
 * Formats KPI values based on the requirements:
 * 1. Published Services (publishedServices): comma separated integer
 * 2. Total Applications (totalApplications): comma separated integer
 * 3. Total Revenue (totalRevenue): Currency symbol (handled in component) + value + K/M
 * 4. Approval Rate (approvalRate): value + %
 * 5. Avg Processing Time (avgProcessingTime): d/h/min rounded down
 * 6. Avg Satisfaction (avgSatisfaction): value + %
 * 7. Refund Applications (refundApplications): comma separated integer
 * 8. Total Refunds (totalRefunds): Currency symbol (handled in component) + value (2 dec)
 */
export function formatKpiValue(key: string, value: number): string {
  if (value === undefined || value === null) return "-";

  switch (key) {
    case "publishedServices":
    case "totalApplications":
    case "refundApplications":
      return Math.floor(value).toLocaleString();

    case "totalRevenue":
      if (value >= 1000000) {
        return (value / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
      }
      if (value >= 1000) {
        return (value / 1000).toFixed(1).replace(/\.?0+$/, "") + "K";
      }
      return value.toLocaleString();

    case "approvalRate":
    case "avgSatisfaction":
      return value + "%";

    case "avgProcessingTime":
      if (value >= 1) return Math.floor(value) + "d";
      if (value >= 1 / 24) return Math.floor(value * 24) + "h";
      return Math.max(0, Math.floor(value * 24 * 60)) + "min";

    case "totalRefunds":
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    default:
      return value.toLocaleString();
  }
}
