import type React from "react";

export type StatusTone = "pending" | "success" | "danger";

export type ViewType = "individual" | "commercial" | "government" | "egaming";

export type ProfileDetailsLocationState = {
  from?: string;
} | null;

export interface SummaryItem {
  key: string;
  icon: string;
  label: string;
  value: React.ReactNode;
  tone?: StatusTone;
  valueClassName?: string;
}

export interface InfoItem {
  key: string;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  span?: number;
  fullWidth?: boolean;
}
