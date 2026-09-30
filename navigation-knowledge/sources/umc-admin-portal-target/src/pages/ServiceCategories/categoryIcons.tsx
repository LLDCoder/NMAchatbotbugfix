import React from "react";
import SelectIcon1 from "@/assets/images/SelectIcon1.svg";
import SelectIcon2 from "@/assets/images/SelectIcon2.svg";
import SelectIcon3 from "@/assets/images/SelectIcon3.svg";
import SelectIcon4 from "@/assets/images/SelectIcon4.svg";
import SelectIcon5 from "@/assets/images/SelectIcon5.svg";
import SelectIcon6 from "@/assets/images/SelectIcon6.svg";
import SelectIcon7 from "@/assets/images/SelectIcon7.svg";
import SelectIcon8 from "@/assets/images/SelectIcon8.svg";
import SelectIcon9 from "@/assets/images/SelectIcon9.svg";
import SelectIcon10 from "@/assets/images/SelectIcon10.svg";
import SelectIcon11 from "@/assets/images/SelectIcon11.svg";
import SelectIcon12 from "@/assets/images/SelectIcon12.svg";
import SelectIcon13 from "@/assets/images/SelectIcon13.svg";
import SelectIcon14 from "@/assets/images/SelectIcon14.svg";
import SelectIcon15 from "@/assets/images/SelectIcon15.svg";
import SelectIcon16 from "@/assets/images/SelectIcon16.svg";
import SelectIcon17 from "@/assets/images/SelectIcon17.svg";
import SelectIcon18 from "@/assets/images/SelectIcon18.svg";
import SelectIcon19 from "@/assets/images/SelectIcon19.svg";
import SelectIcon20 from "@/assets/images/SelectIcon20.svg";
import SelectIcon21 from "@/assets/images/SelectIcon21.svg";
import SelectIcon22 from "@/assets/images/SelectIcon22.svg";
import SelectIcon23 from "@/assets/images/SelectIcon23.svg";
import SelectIcon24 from "@/assets/images/SelectIcon24.svg";

export const serviceCategoryIconOptions = [
  { name: "icon10", src: SelectIcon10 },
  { name: "icon11", src: SelectIcon11 },
  { name: "icon12", src: SelectIcon12 },
  { name: "icon13", src: SelectIcon13 },
  { name: "icon14", src: SelectIcon14 },
  { name: "icon6", src: SelectIcon6 },
  { name: "icon15", src: SelectIcon15 },
  { name: "icon16", src: SelectIcon16 },
  { name: "icon3", src: SelectIcon3 },
  { name: "icon17", src: SelectIcon17 },
  { name: "icon18", src: SelectIcon18 },
  { name: "icon19", src: SelectIcon19 },
  { name: "icon20", src: SelectIcon20 },
  { name: "icon21", src: SelectIcon21 },
  { name: "icon22", src: SelectIcon22 },
  { name: "icon5", src: SelectIcon5 },
  { name: "icon23", src: SelectIcon23 },
  { name: "icon24", src: SelectIcon24 },
  { name: "icon7", src: SelectIcon7 },
  { name: "icon2", src: SelectIcon2 },
  { name: "icon1", src: SelectIcon1 },
  { name: "icon9", src: SelectIcon9 },
  { name: "icon4", src: SelectIcon4 },
  { name: "icon8", src: SelectIcon8 },
] as const;

export type ServiceCategoryIconType =
  (typeof serviceCategoryIconOptions)[number]["name"];

export const serviceCategoryIconList = serviceCategoryIconOptions.reduce<
  Record<ServiceCategoryIconType, React.ReactElement>
>((icons, { name, src }) => {
  icons[name] = <img src={src} alt={name} />;
  return icons;
}, {} as Record<ServiceCategoryIconType, React.ReactElement>);
