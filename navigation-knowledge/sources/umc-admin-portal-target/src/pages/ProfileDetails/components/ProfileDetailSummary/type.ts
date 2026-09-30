import type { SummaryItem } from "../../type";

export interface ProfileDetailSummaryProps {
  title: string;
  tag?: string;
  summaryItems: SummaryItem[];
  rejectReason?: string;
  showRejectReason?: boolean;
}
