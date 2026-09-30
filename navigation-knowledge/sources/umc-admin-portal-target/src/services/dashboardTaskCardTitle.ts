import type { DashboardTaskSourceType } from "@/pages/Dashboard/type";

interface DashboardTaskCardTitleSource {
  taskTitle?: string;
  taskNo?: string;
}

export const getDashboardTaskCardTitleFromTaskNo = (
  sourceType: DashboardTaskSourceType | undefined,
  card: DashboardTaskCardTitleSource,
) =>
  sourceType === "enquiry" ||
  sourceType === "refund" ||
  sourceType === "violation"
    ? card.taskNo
    : card.taskTitle;

export const getInspectionDashboardTaskCardTitle = (
  sourceType: DashboardTaskSourceType | undefined,
  card: DashboardTaskCardTitleSource,
) => (sourceType === "refund" ? card.taskNo : card.taskTitle);
