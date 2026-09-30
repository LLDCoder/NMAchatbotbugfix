import type {
  DonutData,
  InspectionReportsAnalyticsData,
  SummaryCard,
  TrendData,
} from "../types";

const emptyDonut = (): DonutData => ({ total: 0, items: [] });

const emptyTrend = (format: TrendData["format"]): TrendData => ({
  categories: [],
  series: [],
  format,
});

const operationalSummaryCards = (): SummaryCard[] => [
  {
    key: "totalInspections",
    label: "Total Inspections",
    value: 0,
    format: "count",
    icon: "inspections",
  },
  {
    key: "violationsFound",
    label: "Violations Found",
    value: 0,
    format: "count",
    icon: "violations",
  },
  {
    key: "fineCollected",
    label: "Fine Collected",
    value: 0,
    format: "currency",
    icon: "fine",
  },
  {
    key: "refund",
    label: "Refund",
    value: 0,
    format: "currency",
    icon: "refund",
  },
  {
    key: "appeals",
    label: "Appeals",
    value: 0,
    format: "count",
    icon: "appeals",
  },
];

const teamSummaryCards = (): SummaryCard[] => [
  {
    key: "slaCompliance",
    label: "SLA Compliance",
    value: 0,
    format: "percentage",
    icon: "confirmed",
  },
  {
    key: "slaBreached",
    label: "SLA Breached",
    value: 0,
    format: "count",
    icon: "violations",
  },
  {
    key: "avgProcessingTime",
    label: "Avg. Processing Time",
    value: 0,
    format: "duration",
    icon: "riskTasks",
  },
];

const riskSummaryCards = (): SummaryCard[] => [
  {
    key: "totalRiskTasks",
    label: "Total Risk Tasks",
    value: 0,
    format: "count",
    icon: "riskTasks",
  },
  {
    key: "confirmedAiFindings",
    label: "Confirmed AI Findings",
    value: 0,
    format: "count",
    icon: "confirmed",
  },
  {
    key: "highCriticalRiskTasks",
    label: "High / Critical Risk Tasks",
    value: 0,
    format: "count",
    icon: "highRisk",
  },
  {
    key: "highRiskProfiles",
    label: "High-Risk Profiles",
    value: 0,
    format: "count",
    icon: "profiles",
  },
  {
    key: "avgRiskScore",
    label: "Avg. Risk Score",
    value: 0,
    format: "score",
    icon: "score",
  },
];

export const buildEmptyInspectionReportsAnalytics = (): InspectionReportsAnalyticsData => ({
  operational: {
    summaryCards: operationalSummaryCards(),
    inspectionStatus: emptyDonut(),
    violationStatus: emptyDonut(),
    inspectionAndViolationTrend: emptyTrend("count"),
    fineTrend: emptyTrend("currency"),
    inspectionByEmirate: emptyTrend("count"),
    violationsByEmirate: emptyTrend("count"),
    fineByEmirate: emptyTrend("currency"),
    licenseHeatmap: {
      emirates: [],
      reasons: [],
      values: [],
      totals: [],
      color: "blue",
    },
    contentHeatmap: {
      emirates: [],
      reasons: [],
      values: [],
      totals: [],
      color: "orange",
    },
    fineCollection: {
      isAvailable: false,
      value: 0,
      primaryLabel: "Paid",
      primaryValue: 0,
      secondaryLabel: "Outstanding",
      secondaryValue: 0,
      format: "currency",
    },
    appealOutcomes: emptyDonut(),
    penaltiesByDegree: [],
    teamSummary: teamSummaryCards(),
    teamPerformanceTrend: emptyTrend("percentage"),
    repeatViolators: [],
    emirateRows: [],
    teamRows: [],
    teamTotalCount: 0,
  },
  risk: {
    summaryCards: riskSummaryCards(),
    riskReasons: emptyDonut(),
    aiHitRate: {
      isAvailable: false,
      value: 0,
      primaryLabel: "Hits",
      primaryValue: 0,
      secondaryLabel: "Completed",
      secondaryValue: 0,
      format: "count",
    },
    sourceMetrics: {
      autoTriageRate: 0,
      tasksPerDay: 0,
      total: 0,
      sourceDistribution: emptyDonut(),
    },
    riskBands: emptyDonut(),
    bandsBySource: [],
    bandsByEmirate: [],
    riskFactors: [],
    highRiskProfiles: [],
  },
});
