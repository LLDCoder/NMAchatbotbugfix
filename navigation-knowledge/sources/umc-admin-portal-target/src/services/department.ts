import request from "@/utils/request";

export interface DepartmentItem {
  id: number;
  nameEn: string;
  nameAr: string;
  code: string;
}

export interface AddDepartmentPayload {
  nameEn: string;
  nameAr: string;
  code: string;
}

export interface UpdateDepartmentPayload extends AddDepartmentPayload {
  id: number;
}

export const addDepartment = (data: AddDepartmentPayload) => {
  return request.post("/api/Departments/DepartmentAdd", data);
};

export const updateDepartment = (data: UpdateDepartmentPayload) => {
  return request.put("/api/Departments/DepartmentEdit", data);
};

export const deleteDepartment = (id: number) => {
  return request.delete(`/api/Departments/DepartmentDeleted?id=${id}`);
};

export const getDepartmentById = (id: number | string) => {
  return request.get<DepartmentItem>("/api/Departments/Department", { id });
};
export interface DepartmentResponse {
  items: DepartmentItem[];
  pageIndex: number;
  pageSize: number;
  total: number
}
interface DepartmentRequest { 
  NameEn: string;
  NameAr: string;
  PageSize: number;
  PageIndex: number;
  SortBy: string;
  SortDirection: string;
}
export const getDepartments = (params?: Partial<DepartmentRequest>) => {
  return request.get<DepartmentResponse>(`/api/Departments/Departments`, params);
};
