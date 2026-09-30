import type { CustomFee } from '@/pages/AddNewService/components/FeeConfiguration';
import create from 'zustand';

interface IServiceData{
    serviceId: number | null;
    serviceCode: string;
    serviceName: string
    nameEn: string;
    nameAr: string;
    serviceCategoryId: number | null;
    type: string;
    department: string;
    userType: string;
    isLoginRequired: boolean;
    status?: string;
    createdAt: string;
    templateId: number | null;
    loadedAt: string;
    workflowConfigurations: any[] | null;
    serviceFees: CustomFee | null;
    serivceCertificates: any[] | null;
    scopes: string;
}

const initialServiceValues: IServiceData = {
    serviceId: null,
    serviceCode: '',
    serviceName: '',
    nameEn: '',
    nameAr: '',
    serviceCategoryId: null,
    type: '',
    department: '',
    scope: '',
    userType: '',
    isLoginRequired: false,
    status: "draft",
    createdAt: '',
    templateId: null,
    loadedAt: '',
    workflowConfigurations: null,
    serviceFees: null,
    serivceCertificates: null,
    scopes: ''
}

interface IServiceStore {
  serviceFee: CustomFee | null;
  serviceData: IServiceData;
  setServiceFee: (data: CustomFee | null) => void;
  setData: (data: IServiceData) => void;
  resetSerivceData: () => void;
}

export const useServiceStore = create<IServiceStore>((set) => ({
  serviceFee: null,
  serviceData: initialServiceValues,
  setServiceFee: (data: CustomFee| null) => set({ serviceFee: data }),
  setData: (data: IServiceData) => set({ serviceData: data }),
  resetSerivceData: () => set({ serviceData: initialServiceValues }),
}))