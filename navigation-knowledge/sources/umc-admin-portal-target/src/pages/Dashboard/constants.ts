import type { DashboardDepartmentOption } from "./type";

export type DashboardHeaderControlMode =
  | "singleDepartmentAuto"
  | "legacy";

export const DASHBOARD_HEADER_CONTROL_MODE: DashboardHeaderControlMode =
  "singleDepartmentAuto";

interface DashboardHeaderVisibilityOptions {
  departmentCount: number;
  mode: DashboardHeaderControlMode;
}

export const resolveDashboardHeaderVisibility = ({
  departmentCount,
  mode,
}: DashboardHeaderVisibilityOptions) => {
  if (mode === "legacy") {
    return {
      showDepartmentSelector: true,
      showRoleTag: true,
    };
  }

  return {
    showDepartmentSelector: departmentCount > 1,
    showRoleTag: false,
  };
};

export const DASHBOARD_DEPARTMENTS: DashboardDepartmentOption[] = [
  {
    key: "license",
    labelKey: "adminDashboard.departments.license",
    shortLabelKey: "adminDashboard.departments.licenseShort",
  },
  {
    key: "content",
    labelKey: "adminDashboard.departments.content",
    shortLabelKey: "adminDashboard.departments.contentShort",
  },
  {
    key: "inspection",
    labelKey: "adminDashboard.departments.inspection",
    shortLabelKey: "adminDashboard.departments.inspectionShort",
  },
  {
    key: "customer",
    labelKey: "adminDashboard.departments.customer",
    shortLabelKey: "adminDashboard.departments.customerShort",
  },
];
