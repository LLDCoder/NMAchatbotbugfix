import type { Moment } from "moment";

export type InspectionAnalyticsTab = "operational" | "risk" | "reports";

export type InspectionAnalyticsTimePreset =
  | "last7"
  | "last30"
  | "last6Months"
  | "lastYear"
  | "custom";

export type InspectionAnalyticsRangeValue = [Moment | null, Moment | null] | null;

export type AnalyticsTimeFilter = {
  days?: number;
  startDate?: string;
  endDate?: string;
};

export type ValueFormat = "count" | "currency" | "percentage" | "duration" | "score";

export type StatIconKey =
  | "inspections"
  | "violations"
  | "fine"
  | "refund"
  | "appeals"
  | "riskTasks"
  | "confirmed"
  | "highRisk"
  | "profiles"
  | "score";

export type SummaryCard = {
  key: string;
  label: string;
  value: number;
  format: ValueFormat;
  icon: StatIconKey;
};

export type DonutItem = {
  label: string;
  value: number;
  color: string;
  percentage?: number;
};

export type DonutData = {
  total: number;
  items: DonutItem[];
};

export type TrendSeries = {
  name: string;
  color: string;
  values: number[];
  areaColor?: string;
  type?: "line" | "bar";
  lineType?: "solid" | "dashed";
  stack?: string;
  yAxisIndex?: number;
};

export type TrendData = {
  categories: string[];
  series: TrendSeries[];
  format: Exclude<ValueFormat, "duration" | "score">;
};

export type HeatmapData = {
  emirates: string[];
  reasons: string[];
  values: Array<[number, number, number]>;
  totals: Array<{ label: string; value: number }>;
  color: "blue" | "orange";
};

export type GaugeData = {
  isAvailable: boolean;
  value: number;
  primaryLabel: string;
  primaryValue: number;
  secondaryLabel: string;
  secondaryValue: number;
  format: "currency" | "count";
};

export type HorizontalBarItem = {
  label: string;
  value: number;
  color?: string;
  percentage?: number;
};

export type StackedDistributionRow = {
  label: string;
  total: number;
  values: Record<RiskBand, number>;
};

export type RiskBand = "Critical" | "High" | "Medium" | "Low";

export type EmirateBreakdownRow = {
  emirate: string;
  inspections: number;
  violations: number;
  content: number;
  license: number;
  violationRate: number;
  fines: number;
  collectedRate: number;
};

export type TeamPerformanceRow = {
  id: string;
  teamMember: string;
  inspectionTasks: number;
  accessSuccessfulRate: number;
  violationsFound: number;
  avgProcessingHours: number;
  slaCompliance: number;
  slaBreaches: number;
};

export type RiskProfileRow = {
  id: string;
  rank: number;
  profile: string;
  emirate: string;
  factors: string[];
  riskScore: number;
  riskLevel: Extract<RiskBand, "Critical" | "High">;
};

export type OperationalAnalyticsData = {
  summaryCards: SummaryCard[];
  inspectionStatus: DonutData;
  violationStatus: DonutData;
  inspectionAndViolationTrend: TrendData;
  fineTrend: TrendData;
  inspectionByEmirate: TrendData;
  violationsByEmirate: TrendData;
  fineByEmirate: TrendData;
  licenseHeatmap: HeatmapData;
  contentHeatmap: HeatmapData;
  fineCollection: GaugeData;
  appealOutcomes: DonutData;
  penaltiesByDegree: HorizontalBarItem[];
  teamSummary: SummaryCard[];
  teamPerformanceTrend: TrendData;
  repeatViolators: HorizontalBarItem[];
  emirateRows: EmirateBreakdownRow[];
  teamRows: TeamPerformanceRow[];
  teamTotalCount: number;
};

export type RiskAnalyticsData = {
  summaryCards: SummaryCard[];
  riskReasons: DonutData;
  aiHitRate: GaugeData;
  sourceMetrics: {
    autoTriageRate: number;
    tasksPerDay: number;
    total: number;
    sourceDistribution: DonutData;
  };
  riskBands: DonutData;
  bandsBySource: StackedDistributionRow[];
  bandsByEmirate: StackedDistributionRow[];
  riskFactors: HorizontalBarItem[];
  highRiskProfiles: RiskProfileRow[];
};

export type InspectionReportsAnalyticsData = {
  operational: OperationalAnalyticsData;
  risk: RiskAnalyticsData;
};

export type AnalyticsResponse<T> = {
  data: T;
};

export type TaskStatus =
  | "Queued"
  | "Pending Visit"
  | "In Progress"
  | "Completed"
  | "Access Failed"
  | "Cancelled";

export type ViolationStatus =
  | "Warning Issued"
  | "Pending Routing"
  | "Pending Content Report"
  | "Pending Review"
  | "Pending Committee Decision"
  | "Pending Approval"
  | "Pending Payment"
  | "Under Appeal"
  | "Paid"
  | "Cancelled";

export type ViolationType = "License" | "Content";

export type FineStatus = "Issued" | "Cancelled";

export type PaymentStatus = "Succeeded" | "Pending" | "Failed";

export type AppealOutcome =
  | "Violation Maintained"
  | "Violation Modified"
  | "Violation Cancelled";

export type RiskSource = "AI-Generated Tasks" | "Officer-Initiated Tasks";
