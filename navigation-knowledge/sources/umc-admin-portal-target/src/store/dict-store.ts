import create from 'zustand';

export interface IDict{
    id: string | number;
    code: string;
    nameEn: string,
    nameAr: string,
}

const initialApprovalRole: IDict[] = [];

const initApprovalDepartment: IDict[] = [];

export interface IRoleDept{
  id: string;
  discriminator: string;
  isShown: boolean;
  nameEn: string;
  nameAr: string;
  departmentId: number;
  departmentNameEn: string;
  departmentNameAr: string;
}

const initApprovalRoleDepartment: IRoleDept[] = [];

interface IDictStore {
  ApprovalRole: IDict[];
  ApprovalDepartment: IDict[];
  ApprovalRoleDepartment: IRoleDept[];
  setApprovalRole: (data: IDict[]) => void;
  setApprovalDepartment: (data: IDict[]) => void;
  setApprovalRoleDepartment: (data: IRoleDept[]) => void;
}

export const useDictStore = create<IDictStore>((set) => ({
  ApprovalRole: initialApprovalRole,
  ApprovalDepartment: initApprovalDepartment,
  ApprovalRoleDepartment: initApprovalRoleDepartment,
  setApprovalRole: (data: IDict[]) => set({ ApprovalRole: data }),
  setApprovalDepartment: (data: IDict[]) => set({ ApprovalDepartment: data }),
  setApprovalRoleDepartment: (data: IRoleDept[]) => set({ ApprovalRoleDepartment: data }),
}))
