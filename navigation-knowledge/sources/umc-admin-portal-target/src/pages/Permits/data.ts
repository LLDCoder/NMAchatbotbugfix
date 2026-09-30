import GongSi from "@/assets/images/gongsi.svg";
import YongHu from "@/assets/images/yonghu.svg";
import Government from "@/assets/images/government.svg";
import Active from "@/assets/images/Active.svg";
import Expired from "@/assets/images/Expired.svg";
import Disabled from "@/assets/images/Disabled.svg";


interface StatusObj {
  code: string;
  text: string;
  value: string;
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
      text: 'Active',
      value: 'active',
      class: '_active',
      icon: Active,
      bgClass: '_bg-active'
    },
    {
      code: '202',
      text: 'Expired',
      value: 'expired',
      class: '_expired',
      icon: Expired,
      bgClass: '_bg-expired'
    },
    {
      code: '204',
      text: 'Disabled',
      value: 'disabled',
      class: '_disabled',
      icon: Disabled,
      bgClass: '_bg-disabled'
    }
  ]