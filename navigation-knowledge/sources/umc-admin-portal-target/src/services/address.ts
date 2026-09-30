import request from "@/utils/request";
import { resolveServiceCode } from "@/utils/serviceCode";

export interface EmirateItem {
  id: number;
  nameEn: string;
  nameAr: string;
  code?: string;
}

export interface RegionItem {
  id: number;
  nameEn: string;
  nameAr: string;
  emirateId: number;
  code?: string;
}

export interface AreaItem {
  id: number;
  nameEn: string;
  nameAr: string;
  regionId: number;
  code?: string;
}

export const getEmirateList = (serviceCode?: string | number | null) => {
  return request.get<EmirateItem[]>("/api/User/GetEmirateList", {
    serviceCode: resolveServiceCode(serviceCode),
  });
};

export const getRegionList = (emirateId?: number) => {
  const url = emirateId
    ? `/api/User/GetRegionList?emirateId=${emirateId}`
    : "/api/User/GetRegionList";
  return request.get<RegionItem[]>(url);
};

export const getAreaList = (regionId?: number) => {
  const url = regionId
    ? `/api/User/GetAreaList?regionId=${regionId}`
    : "/api/User/GetAreaList";
  return request.get<AreaItem[]>(url);
};
