import type { RiskBand, TaskStatus, ViolationStatus } from "./types";

export const REPORTS_ANALYTICS_TIME_PRESET_DAYS = {
  last7: 7,
  last30: 30,
  last6Months: 183,
  lastYear: 365,
} as const;

export const COLORS = {
  ink: "#361E12",
  muted: "#7B7F87",
  green: "#A0D5AB",
  yellow: "#FAD44F",
  red: "#FAAAA7",
  orange: "#F5AC7C",
  blue: "#81C1FF",
  blueDark: "#579EEA",
  gold: "#D7BC6D",
  pink: "#F0ABFC",
  gray: "#C3C6CB",
  pale: "#EDEFF2",
  purple: "#AFA3FF",
  teal: "#69C3B0",
} as const;

export const EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Ras Al Khaimah",
  "Fujairah",
  "Umm Al Quwain",
] as const;

export const EMIRATE_COLORS: Record<string, string> = {
  "Abu Dhabi": "#579EEA",
  Dubai: "#A0D5AB",
  Sharjah: "#D7BC6D",
  Ajman: "#F5AC7C",
  "Ras Al Khaimah": "#F0ABFC",
  Fujairah: "#69C3B0",
  "Umm Al Quwain": "#AFA3FF",
};

export const TASK_STATUSES: TaskStatus[] = [
  "Queued",
  "Pending Visit",
  "In Progress",
  "Completed",
  "Access Failed",
  "Cancelled",
];

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  Queued: "#81C1FF",
  "Pending Visit": "#F5AC7C",
  "In Progress": "#FAD44F",
  Completed: "#A0D5AB",
  "Access Failed": "#FAAAA7",
  Cancelled: "#C3C6CB",
};

export const VIOLATION_STATUSES: ViolationStatus[] = [
  "Warning Issued",
  "Pending Routing",
  "Pending Content Report",
  "Pending Review",
  "Pending Committee Decision",
  "Pending Approval",
  "Pending Payment",
  "Under Appeal",
  "Paid",
  "Cancelled",
];

export const VIOLATION_STATUS_COLORS: Record<ViolationStatus, string> = {
  "Warning Issued": "#FAAAA7",
  "Pending Routing": "#F5AC7C",
  "Pending Content Report": "#FAD44F",
  "Pending Review": "#A0D5AB",
  "Pending Committee Decision": "#D7BC6D",
  "Pending Approval": "#81C1FF",
  "Pending Payment": "#69C3B0",
  "Under Appeal": "#F0ABFC",
  Paid: "#CBA344",
  Cancelled: "#C3C6CB",
};

export const RISK_BANDS: RiskBand[] = ["Critical", "High", "Medium", "Low"];

export const RISK_BAND_COLORS: Record<RiskBand, string> = {
  Critical: "#FAAAA7",
  High: "#F5AC7C",
  Medium: "#FAD44F",
  Low: "#A0D5AB",
};

export const RISK_FACTORS = [
  "Prior violation history",
  "Unlicensed activity signals",
  "Sanctioned affiliation",
  "Late license renewal",
  "High complaint volume",
  "Overdue fine payment",
  "Cross-border distribution",
  "Repeat-offender network",
];
