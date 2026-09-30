import type {
  EstablishmentInfoDto,
  UserManagementValueObject,
} from "@/services/userManagement";
import type { SummaryItem, ViewType } from "../../type";

export interface PartnerItem {
  key: string;
  name: string;
  identifier: string;
  location: string;
  partnerTypeCode?: string;
  partnerTypeName?: string;
  nationalityName?: string;
  emirateObj?: UserManagementValueObject | null;
  isOwner?: boolean;
  avatar?: string;
  representativeNameEn?: string | null;
  representativeNameAr?: string | null;
  representativeEmiratesId?: string | null;
  id: number;
}

export interface OrganizationProfileDetailsProps {
  data?: EstablishmentInfoDto | null;
  viewType: ViewType;
  summaryItems: SummaryItem[];
  applicationTitle: string;
  establishmentOverviewTitle: string;
  showRejectReason?: boolean;
  rejectReason?: string;
  preferAr: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  i18n: { language?: string };
  partnerDetailsPermissionCode?: string;
  partnerDetailsPermissionRoutePath?: string;
}
