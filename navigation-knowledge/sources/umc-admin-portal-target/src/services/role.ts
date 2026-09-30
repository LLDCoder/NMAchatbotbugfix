import request from "@/utils/request";

export interface UserItem {
  pageIndex?: number;
  pageSize?: number;
  keyWord?: string;
  status?: string;
}
interface StatusDto {
  id: null | number | string;
  code: string;
  name: string;
}

interface DepartmentInfo {
  id: null | number | string;
  code: string;
  name: string;
}
interface RoleItem {
  id: string;
  name: string;
  discriminator: 'Role' | 'Individual' | 'ApprovalRole';
  isShown: null | boolean;
  nameEn: string;
  nameAr: string;
  descEn: string;
  permissionsIds: number[] | null;
  descAr: string;
  status: string;
  createAt: string | null;
  statusDto: StatusDto;
  departmentId: number;
  departmentInfo: DepartmentInfo;
  hasUsers: boolean;
}
export interface RoleResponse{
  totalPage: number;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  totalAmount: number;
  items: RoleItem[];
}
export const getRoleList = (data: UserItem) => {
  return request.post<RoleResponse>("/api/Role/GetRoleList", data);
};
export const getRoleListByDepartmentId = (data: number[]) => {
  return request.post<RoleResponse>("/api/Role/GetRoleListByDepartmentId", data);
};

export interface RolePayload {
  id?: string;
  name: string;
  discriminator: string;
  isShown: boolean;
  nameEn: string;
  nameAr: string;
  descEn: string;
  descAr: string;
  status: string;
  departmentId: number;
  permissionsIds?: (string | number)[];
}

export type RoleDetail = RolePayload;

export const getRoleById = (id: string) => {
  return request.get<RoleDetail>(`/api/Role/GetRoleById?id=${id}`);
};

export const addRole = (data: RolePayload) => {
  return request.post("/api/Role/AddRole", data);
};

export const updateRole = (data: RolePayload) => {
  return request.put("/api/Role/UpdateRole", data);
};

export const deleteRole = (id: string) => {
  return request.post("/api/Role/DeleteRole", {
    id,
  });
};

export const getSysPermissionList = () => {
  return request.get<any>(`/api/UserManagement/GetSysPermissionList`);
};
