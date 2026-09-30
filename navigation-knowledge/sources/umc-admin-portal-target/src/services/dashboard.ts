import moment from "moment";
import { DASHBOARD_DEPARTMENTS } from "@/pages/Dashboard/constants";
import { loadCurrentAdminUser } from "@/store/currentAdminUser";
import type {
  DashboardContext,
  DashboardData,
  DashboardDataParams,
  DashboardDataQueryParams,
  DashboardDepartment,
  DashboardDepartmentOption,
  DashboardReassignTask,
  DashboardRoleOptionsByDepartment,
  DashboardRoleVariant,
  DashboardTableTab,
  DashboardTableSortDirection,
  DashboardTaskCard,
  DashboardTimeFilter,
  DashboardTimeQueryParams,
} from "@/pages/Dashboard/type";
import {
  getContentDashboardAttentionTab,
  getContentDashboardData,
  getContentDashboardTaskCards,
} from "./contentDashboard";
import {
  CUSTOMER_HAPPINESS_DASHBOARD_DEPARTMENT_ID,
  getCustomerHappinessDashboardAttentionTab,
  getCustomerHappinessDashboardData,
  getCustomerHappinessDashboardTaskCards,
} from "./customerHappinessDashboard";
import {
  getInspectionDashboardAttentionTab,
  getInspectionDashboardData,
  getInspectionDashboardTaskCards,
  INSPECTION_DASHBOARD_DEPARTMENT_ID,
} from "./inspectionDashboard";
import {
  getLicenseDashboardAttentionTab,
  getLicenseDashboardData as getRealLicenseDashboardData,
  getLicenseDashboardTaskCards,
} from "./licenseDashboard";
import {
  getTeamManagementMembers,
  reassignTeamManagementTasks,
  type TeamManagementScope,
} from "./teamManagement";
import type { AdminUserDepartmentInfo } from "./userManagement";

export interface LicenseDashboardReassignPayload {
  department?: DashboardDepartment;
  assignedUserId: string;
  tasks: DashboardReassignTask[];
}

export interface LicenseDashboardAssignableMember {
  label: string;
  value: string;
}

export interface DashboardTaskCardsParams {
  department: DashboardDepartment;
  roleVariant: DashboardRoleVariant;
  tabKey: string;
  pageSize?: number;
  timeFilter?: DashboardTimeFilter;
  signal?: AbortSignal;
}

export interface DashboardTaskCardsResult {
  tabKey: string;
  count: number;
  cards: DashboardTaskCard[];
}

export interface DashboardAttentionTabParams {
  department: DashboardDepartment;
  roleVariant: DashboardRoleVariant;
  tabKey: string;
  pageIndex?: number;
  pageSize?: number;
  timeFilter?: DashboardTimeFilter;
  sortBy?: string;
  sortDirection?: DashboardTableSortDirection;
  signal?: AbortSignal;
}

export interface DashboardAttentionTabResult {
  tab: DashboardTableTab;
}

const LICENSE_DEPARTMENT: DashboardDepartment = "license";
const DEFAULT_DASHBOARD_DAYS = 7;
const DEFAULT_CONTEXT: DashboardContext = {
  departments: [],
  roleVariant: "staff",
  roleVariantsByDepartment: {},
  roleOptionsByDepartment: {},
};

const departmentKeyById: Partial<Record<number, DashboardDepartment>> = {
  1: "license",
  2: "content",
  [INSPECTION_DASHBOARD_DEPARTMENT_ID]: "inspection",
  [CUSTOMER_HAPPINESS_DASHBOARD_DEPARTMENT_ID]: "customer",
};

const departmentMatchers: Array<{
  key: DashboardDepartment;
  pattern: RegExp;
}> = [
  {
    key: "license",
    pattern: /licen[cs]/i,
  },
  {
    key: "content",
    pattern: /content/i,
  },
  {
    key: "inspection",
    pattern: /inspection/i,
  },
  {
    key: "customer",
    pattern: /customer|happiness/i,
  },
];

export const resolveDashboardTimeFilterParams = (
  timeFilter?: DashboardTimeFilter
): DashboardTimeQueryParams => {
  if (timeFilter?.startDate && timeFilter.endDate) {
    const start = moment(timeFilter.startDate, "YYYY-MM-DD", true);
    const end = moment(timeFilter.endDate, "YYYY-MM-DD", true);

    return {
      startDate: timeFilter.startDate,
      endDate: timeFilter.endDate,
      days:
        start.isValid() && end.isValid() && !end.isBefore(start, "day")
          ? end.diff(start, "days") + 1
          : undefined,
    };
  }

  return {
    days: timeFilter?.days ?? DEFAULT_DASHBOARD_DAYS,
  };
};

export const buildLicenseDashboardDataQuery = ({
  department,
  roleVariant,
  timeFilter,
}: DashboardDataParams): DashboardDataQueryParams => ({
  department,
  roleVariant,
  ...resolveDashboardTimeFilterParams(timeFilter),
});

const resolveDepartmentKey = (
  department: AdminUserDepartmentInfo
): DashboardDepartment | null => {
  const numericId = Number(department.id);

  if (Number.isFinite(numericId) && departmentKeyById[numericId]) {
    return departmentKeyById[numericId] || null;
  }

  const source = `${department.name || ""} ${department.id || ""}`;
  const matched = departmentMatchers.find((item) => item.pattern.test(source));

  return matched?.key || null;
};

const getDepartmentOption = (
  key: DashboardDepartment
): DashboardDepartmentOption | undefined =>
  DASHBOARD_DEPARTMENTS.find((department) => department.key === key);

const resolveDepartmentOptions = (
  departments: AdminUserDepartmentInfo[] = []
): DashboardDepartmentOption[] => {
  const seen = new Set<DashboardDepartment>();

  return departments.reduce<DashboardDepartmentOption[]>((result, department) => {
    const key = resolveDepartmentKey(department);

    if (!key || seen.has(key)) {
      return result;
    }

    const option = getDepartmentOption(key);

    if (option) {
      seen.add(key);
      result.push(option);
    }

    return result;
  }, []);
};

const resolveRoleVariantsByDepartment = (
  departments: AdminUserDepartmentInfo[] = []
): Partial<Record<DashboardDepartment, DashboardRoleVariant>> => {
  const result: Partial<Record<DashboardDepartment, DashboardRoleVariant>> = {};

  departments.forEach((department) => {
    const key = resolveDepartmentKey(department);

    if (!key) {
      return;
    }

    result[key] = department.isLeader ? "manager" : "staff";
  });

  return result;
};

const addRoleOption = (
  result: DashboardRoleOptionsByDepartment,
  department: DashboardDepartment,
  roleVariant: DashboardRoleVariant
) => {
  const options = result[department] || [];

  if (!options.includes(roleVariant)) {
    result[department] = [...options, roleVariant];
  }
};

const resolveRoleOptionsByDepartment = (
  departments: AdminUserDepartmentInfo[] = []
): DashboardRoleOptionsByDepartment => {
  const result: DashboardRoleOptionsByDepartment = {};

  departments.forEach((department) => {
    const key = resolveDepartmentKey(department);

    if (!key) {
      return;
    }

    addRoleOption(result, key, department.isLeader ? "manager" : "staff");
  });

  return result;
};

interface DashboardLoginRole {
  id?: number | string | null;
  departmentId?: number | string | null;
  departmentID?: number | string | null;
  isLeader?: boolean | null;
}

interface DashboardLoginDepartmentRole {
  departmentId?: number | string | null;
  departmentID?: number | string | null;
  isLeader?: boolean | null;
}

interface DashboardLoginUserProfile {
  userDepartments?: DashboardLoginDepartmentRole[] | null;
}

interface DashboardLoginUser {
  listRoles?: DashboardLoginRole[] | null;
  userDepartments?: DashboardLoginDepartmentRole[] | null;
  userProfileInfo?: DashboardLoginUserProfile[] | null;
  listUserProfile?: DashboardLoginUserProfile[] | null;
}

const getDashboardDepartmentFromId = (
  departmentId?: number | string | null
): DashboardDepartment | null => {
  const numericId = Number(departmentId);

  if (!Number.isFinite(numericId)) {
    return null;
  }

  return resolveDepartmentKey({
    id: numericId,
    name: "",
  });
};

const addLoginDepartmentOption = (
  departments: DashboardDepartmentOption[],
  seen: Set<DashboardDepartment>,
  department: DashboardDepartment
) => {
  if (seen.has(department)) {
    return;
  }

  const option = getDepartmentOption(department);

  if (option) {
    seen.add(department);
    departments.push(option);
  }
};

const getStructuredLoginDepartmentRoles = (
  userInfo?: DashboardLoginUser | null
): DashboardLoginDepartmentRole[] => [
  ...(userInfo?.userDepartments || []),
  ...((userInfo?.userProfileInfo || []).flatMap(
    (profile) => profile.userDepartments || []
  )),
  ...((userInfo?.listUserProfile || []).flatMap(
    (profile) => profile.userDepartments || []
  )),
  ...((userInfo?.listRoles || []).filter(
    (role) => typeof role.isLeader === "boolean"
  )),
];

const resolveDashboardContextFromLoginUser = (
  userInfo?: DashboardLoginUser | null
): DashboardContext => {
  const seen = new Set<DashboardDepartment>();
  const departments: DashboardDepartmentOption[] = [];
  const roleVariantsByDepartment: Partial<
    Record<DashboardDepartment, DashboardRoleVariant>
  > = {};
  const roleOptionsByDepartment: DashboardRoleOptionsByDepartment = {};

  (userInfo?.listRoles || []).forEach((role) => {
    const key = getDashboardDepartmentFromId(
      role.departmentId ?? role.departmentID
    );

    if (!key) {
      return;
    }

    addLoginDepartmentOption(departments, seen, key);
  });

  getStructuredLoginDepartmentRoles(userInfo).forEach((role) => {
    const key = getDashboardDepartmentFromId(
      role.departmentId ?? role.departmentID
    );

    if (!key || typeof role.isLeader !== "boolean") {
      return;
    }

    const roleVariant = role.isLeader ? "manager" : "staff";

    addLoginDepartmentOption(departments, seen, key);

    if (role.isLeader || !roleVariantsByDepartment[key]) {
      roleVariantsByDepartment[key] = roleVariant;
    }

    addRoleOption(roleOptionsByDepartment, key, roleVariant);
  });

  const defaultDepartment = departments[0]?.key;

  if (!defaultDepartment) {
    return DEFAULT_CONTEXT;
  }

  return {
    departments,
    defaultDepartment,
    roleVariant:
      roleVariantsByDepartment[defaultDepartment] ||
      DEFAULT_CONTEXT.roleVariant,
    roleVariantsByDepartment,
    roleOptionsByDepartment,
  };
};

export const getLicenseDashboardContext = async (
  userId?: string,
  userInfo?: DashboardLoginUser | null
): Promise<DashboardContext> => {
  const fallbackContext = resolveDashboardContextFromLoginUser(userInfo);

  if (!userId?.trim()) {
    return fallbackContext.defaultDepartment ? fallbackContext : DEFAULT_CONTEXT;
  }

  let adminUser: Awaited<ReturnType<typeof loadCurrentAdminUser>>;

  try {
    adminUser = await loadCurrentAdminUser(userId.trim());
  } catch (error) {
    if (fallbackContext.defaultDepartment) {
      return fallbackContext;
    }

    throw error;
  }

  const profileDepartments = adminUser?.departmentsInfo || [];
  const departments = resolveDepartmentOptions(profileDepartments);
  const roleVariantsByDepartment =
    resolveRoleVariantsByDepartment(profileDepartments);
  const roleOptionsByDepartment =
    resolveRoleOptionsByDepartment(profileDepartments);
  const firstDepartmentInfo = profileDepartments.find((department) =>
    resolveDepartmentKey(department)
  );
  const defaultDepartment =
    (firstDepartmentInfo ? resolveDepartmentKey(firstDepartmentInfo) : null) ||
    departments[0]?.key;
  const roleVariant =
    (defaultDepartment && roleVariantsByDepartment[defaultDepartment]) ||
    DEFAULT_CONTEXT.roleVariant;

  if (!defaultDepartment && fallbackContext.defaultDepartment) {
    return fallbackContext;
  }

  return {
    departments,
    defaultDepartment,
    roleVariant,
    roleVariantsByDepartment,
    roleOptionsByDepartment,
  };
};

const dataLoaders: Record<
  DashboardDepartment,
  (params: DashboardDataParams) => Promise<DashboardData>
> = {
  license: getRealLicenseDashboardData,
  content: getContentDashboardData,
  inspection: getInspectionDashboardData,
  customer: getCustomerHappinessDashboardData,
};

export const getDashboardData = (params: DashboardDataParams) =>
  dataLoaders[params.department](params);

export const getLicenseDashboardData = getDashboardData;

export const getDashboardTaskCards = async (
  params: DashboardTaskCardsParams
): Promise<DashboardTaskCardsResult> => {
  if (params.department === "license") {
    return getLicenseDashboardTaskCards(params);
  }

  if (params.department === "content") {
    return getContentDashboardTaskCards(params);
  }

  if (params.department === "inspection") {
    return getInspectionDashboardTaskCards(params);
  }

  return getCustomerHappinessDashboardTaskCards(params);
};

export const getDashboardAttentionTab = async (
  params: DashboardAttentionTabParams
): Promise<DashboardAttentionTabResult> => {
  if (params.department === "license") {
    return getLicenseDashboardAttentionTab(params);
  }

  if (params.department === "content") {
    return getContentDashboardAttentionTab(params);
  }

  if (params.department === "inspection") {
    return getInspectionDashboardAttentionTab(params);
  }

  return getCustomerHappinessDashboardAttentionTab(params);
};

const teamManagementScopeByDepartment: Record<
  DashboardDepartment,
  TeamManagementScope
> = {
  license: "licensing",
  content: "content",
  inspection: "inspection",
  customer: "customer",
};

export const getDashboardAssignableMembers = async (
  department: DashboardDepartment
): Promise<LicenseDashboardAssignableMember[]> =>
  getTeamManagementMembers({
    scope: teamManagementScopeByDepartment[department],
    assignableOnly: true,
  });

export const reassignDashboardTasks = (
  payload: LicenseDashboardReassignPayload
) => {
  const department = payload.department || LICENSE_DEPARTMENT;
  const scope = teamManagementScopeByDepartment[department];

  return reassignTeamManagementTasks({
    scope,
    assignedUserId: payload.assignedUserId,
    memberId: department === "inspection" ? payload.assignedUserId : undefined,
    tasks: payload.tasks.map((task) => ({
      sourceType: task.sourceType,
      sourceId: task.sourceId,
    })),
  });
};
