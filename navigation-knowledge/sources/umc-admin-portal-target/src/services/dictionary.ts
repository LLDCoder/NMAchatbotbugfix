import request from "@/utils/request";

export interface IDict {
  id: number;
  code: string;
  scope: string;
  nameEn: string;
  nameAr: string;
  isShown: boolean;
  descAr: null | string;
  descEn: null | string;
}
export function getFeeLinkedService(){
    return request.get<IDict[]>("/api/TypeDictionary/GetTypeDictionaries/FeeLinkedService");
}

export function getSeviceFeeRule(){
    return request.get<IDict[]>("/api/TypeDictionary/GetTypeDictionaries/SeviceFeeRule");
}

export function getCertificateStatus(){
    return request.get<IDict[]>("/api/TypeDictionary/GetTypeDictionaries/CertificateStatus");
}

export function getCertificateDisableReason(){
  return request.get<IDict[]>("/api/TypeDictionary/GetTypeDictionaries/CertificateDisableReason");
}

export function getServiceConfigStatus(){
  return request.get<IDict[]>("/api/TypeDictionary/GetTypeDictionaries/ServiceConfigStatus");
}
