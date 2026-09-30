import GongSi from "@/assets/images/gongsi.svg";
import YongHu from "@/assets/images/yonghu.svg";
import Government from "@/assets/images/government.svg";
import Active from "@/assets/images/Active.svg";
import Cancelled from "@/assets/images/statistics/CancelledIcon.png";
import ExpireSoon from "@/assets/images/statistics/license-expire-soon.svg";
import Expired from "@/assets/images/statistics/license-expired.svg";
import Suspended from "@/assets/images/statistics/license-suspended.svg";


type LicenseStatusStatisticKey =
  | "active"
  | "expireSoon"
  | "expired"
  | "cancelled"
  | "disabled";

interface StatusObj {
  code: string;
  labelKey: string;
  value: LicenseStatusStatisticKey;
  class: string;
  icon: string;
  bgClass: string;
}


export const applicantIcon = {
  user: YongHu,
  company: GongSi,
  government: Government
}

export const statusData: StatusObj[] = [
    {
      code: '201',
      labelKey: 'Licensing.status.active',
      value: 'active',
      class: '_active',
      icon: Active,
      bgClass: '_bg-active'
    },
    {
      code: '205',
      labelKey: 'Licensing.status.expireSoon',
      value: 'expireSoon',
      class: '_expire-soon',
      icon: ExpireSoon,
      bgClass: 'license-stat-card__icon--expire-soon'
    },
    {
      code: '202',
      labelKey: 'Licensing.status.expired',
      value: 'expired',
      class: '_expired',
      icon: Expired,
      bgClass: 'license-stat-card__icon--expired'
    },
    {
      code: '203',
      labelKey: 'Licensing.status.cancelled',
      value: 'cancelled',
      class: '_cancelled',
      icon: Cancelled,
      bgClass: '_bg-cancelled'
    },
    {
      code: '204',
      labelKey: 'Licensing.status.disabled',
      value: 'disabled',
      class: '_disabled',
      icon: Suspended,
      bgClass: 'license-stat-card__icon--suspended'
    }
  ]
