import request from "@/utils/request";

export interface RoleSimpleDto {
  id?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
}

export interface RoleByDepartmentGroupDto {
  departmentId?: number | null;
  departmentNameEn?: string | null;
  departmentNameAr?: string | null;
  roles?: RoleSimpleDto[] | null;
}

export const getRolesGroupedByDepartmentId = (departmentIds: number[]) => {
  return request.post<RoleByDepartmentGroupDto[]>(
    "/api/Role/GetRolesGroupedByDepartmentId",
    departmentIds,
  );
};
