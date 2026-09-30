import type { UserProfileInfoDto } from "@/services/userManagement";
import type { SummaryItem } from "../../type";

export interface IndividualProfileDetailsProps {
  data?: UserProfileInfoDto | null;
  summaryItems: SummaryItem[];
  applicationTitle: string;
  showRejectReason?: boolean;
  rejectReason?: string;
  preferAr: boolean;
  t: (key: string) => string;
}
