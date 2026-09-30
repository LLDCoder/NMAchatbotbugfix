import { useMemo } from "react";
import { useUserStore, type IUser } from "@/store/user";
import {
  createPermissionPathSet,
  isAuthenticatedAllowedProtectedPath,
  normalizeRoutePath,
  type PermissionNode,
} from "@/routes/access";
import { INSPECTION_PATHS } from "./constants";
import {
  getInspectionRolesFromLegacyNames,
  getInspectionRolesFromRoleValues,
  normalizeInspectionRoleName,
  uniqueInspectionRoles,
  type InspectionRole,
} from "./roleMapping";

export type { InspectionRole } from "./roleMapping";

export type InspectionViolationAction =
  | "transfer_content"
  | "submit_report"
  | "transfer_committee"
  | "review_decide"
  | "approve"
  | "modify"
  | "cancel"
  | "download_report";

export type InspectionRouteAccessMeta = {
  path?: string;
  permissionPath?: string;
  activeMenuPath?: string;
  allowedInspectionRoles?: readonly InspectionRole[];
};

export type InspectionAccessState = {
  loading: boolean;
  roles: InspectionRole[];
  inspectorId: string;
  hasInspectionAccess: boolean;
  defaultInspectionPath: string;
  fallbackPath: string;
  hasRole: (role: InspectionRole) => boolean;
  hasAnyRole: (allowedRoles: readonly InspectionRole[]) => boolean;
  isRouteAllowed: (route: InspectionRouteAccessMeta) => boolean;
};

export const MOCK_INSPECTION_ROLE: InspectionRole = "inspector";
// export const MOCK_INSPECTION_ROLE: InspectionRole = "manager";
// export const MOCK_INSPECTION_ROLE: InspectionRole = "content";
// export const MOCK_INSPECTION_ROLE: InspectionRole = "committee";
// export const MOCK_INSPECTION_ROLE: InspectionRole = "customer";

export const DEFAULT_MOCK_INSPECTION_INSPECTOR_ID = "inspector-001";
export const MOCK_INSPECTION_ROLE_OVERRIDE_KEY = "inspectionMockRole";
export const INSPECTION_MOCK_ROLE_STORAGE_KEY = MOCK_INSPECTION_ROLE_OVERRIDE_KEY;
export const MOCK_INSPECTION_INSPECTOR_ID_OVERRIDE_KEY =
  "inspectionMockInspectorId";

export type MockInspectionContext = {
  role: InspectionRole;
  inspectorId: string;
};

const INSPECTION_ROLE_SET = new Set<InspectionRole>([
  "inspector",
  "manager",
  "content",
  "committee",
  "customer",
]);

const canReadMockInspectionOverride = () =>
  Boolean(import.meta.env.DEV && typeof window !== "undefined");

const readMockInspectionOverride = (key: string) => {
  if (!canReadMockInspectionOverride()) return "";

  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

export const INSPECTION_ADMIN_PORTAL_ROLES: readonly InspectionRole[] = [
  "inspector",
  "manager",
  "content",
  "committee",
];

export const INSPECTION_TASK_ROLES: readonly InspectionRole[] = [
  "inspector",
  "manager",
];

export const INSPECTION_MANAGER_ROLES: readonly InspectionRole[] = [
  "manager",
];

export const INSPECTION_EXECUTION_ROLES: readonly InspectionRole[] = [
  "inspector",
];

export const INSPECTION_VIOLATION_ROLES: readonly InspectionRole[] = [
  "inspector",
  "manager",
  "content",
  "committee",
];

export const INSPECTION_ROUTE_FALLBACK = "";

const INSPECTION_MOCK_ROLE_OVERRIDE_SET = new Set<InspectionRole>([
  "inspector",
  "manager",
  "content",
  "committee",
]);

export const INSPECTION_VIOLATION_ACTION_CONFIG: Record<
  InspectionViolationAction,
  { titleKey: string; nextStatus?: string }
> = {
  transfer_content: {
    titleKey: "inspection.violation.actions.transferToContent",
    nextStatus: "PENDING_CONTENT_REPORT",
  },
  submit_report: {
    titleKey: "inspection.violation.actions.submitReport",
    nextStatus: "PENDING_REVIEW",
  },
  transfer_committee: {
    titleKey: "inspection.violation.actions.transferToCommittee",
    nextStatus: "PENDING_COMMITTEE_DECISION",
  },
  review_decide: {
    titleKey: "inspection.violation.actions.reviewDecide",
    nextStatus: "PENDING_APPROVAL",
  },
  approve: {
    titleKey: "inspection.violation.actions.approve",
    nextStatus: "WARNING_ISSUED",
  },
  modify: {
    titleKey: "inspection.violation.actions.modify",
    nextStatus: "RECTIFICATION",
  },
  cancel: {
    titleKey: "inspection.violation.actions.cancel",
    nextStatus: "CANCELLED",
  },
  download_report: {
    titleKey: "inspection.violation.actions.downloadReport",
  },
};

export const normalizeInspectionViolationAction = (
  value?: unknown,
): InspectionViolationAction | null => {
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/&/g, "_and_")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
  const actionMap: Record<string, InspectionViolationAction> = {
    transfer_content: "transfer_content",
    transfer_to_content: "transfer_content",
    transfer_to_content_team: "transfer_content",
    submit_report: "submit_report",
    submit_content_report: "submit_report",
    transfer_committee: "transfer_committee",
    transfer_to_committee: "transfer_committee",
    review_decide: "review_decide",
    review_decision: "review_decide",
    review_and_decide: "review_decide",
    review_and_decision: "review_decide",
    committee_decision: "review_decide",
    approval: "approve",
    approve: "approve",
    modify: "modify",
    modify_violation: "modify",
    cancel: "cancel",
    cancel_violation: "cancel",
    download_report: "download_report",
  };

  return actionMap[normalized] || null;
};

export const normalizeInspectionViolationActions = (
  values?: unknown,
): InspectionViolationAction[] => {
  const items = Array.isArray(values)
    ? values
    : values === undefined || values === null || values === ""
      ? []
      : [values];
  const seen = new Set<InspectionViolationAction>();

  return items.reduce<InspectionViolationAction[]>((actions, value) => {
    const action = normalizeInspectionViolationAction(value);
    if (!action || seen.has(action)) return actions;
    seen.add(action);
    actions.push(action);
    return actions;
  }, []);
};

export function isInspectionRole(value?: string | null): value is InspectionRole {
  return INSPECTION_ROLE_SET.has(String(value || "") as InspectionRole);
}

export function getMockInspectionRoleOverride(): InspectionRole | null {
  const value = readMockInspectionOverride(MOCK_INSPECTION_ROLE_OVERRIDE_KEY);
  return isInspectionRole(value) && INSPECTION_MOCK_ROLE_OVERRIDE_SET.has(value)
    ? value
    : null;
}

export function getEffectiveMockInspectionRole() {
  return getMockInspectionRoleOverride() || MOCK_INSPECTION_ROLE;
}

export function getMockInspectionContext(): MockInspectionContext {
  const inspectorId = readMockInspectionOverride(
    MOCK_INSPECTION_INSPECTOR_ID_OVERRIDE_KEY,
  ).trim();

  return {
    role: getEffectiveMockInspectionRole(),
    inspectorId: inspectorId || DEFAULT_MOCK_INSPECTION_INSPECTOR_ID,
  };
}

const hasSuperAdministratorRole = (userInfo?: Partial<IUser> | null) =>
  (userInfo?.rolesInfo || []).some(
    (role) =>
      role.roleID === "SUPER_ADMINISTRATOR" ||
      normalizeInspectionRoleName(role.roleName) === "super administrator",
  ) ||
  (userInfo?.listRoles || []).some((role) =>
    [role.name, role.nameEn].some(
      (roleName) =>
        normalizeInspectionRoleName(roleName) === "super administrator",
    ),
  );

export function resolveInspectionRoles(
  userInfo?: Partial<IUser> | null,
): InspectionRole[] {
  const localOverride = getMockInspectionRoleOverride();
  if (localOverride) {
    return [localOverride];
  }

  // Role id and role name are matched independently, so a payload that carries only
  // one of them still resolves. Descriptions and the discriminator stay on the legacy
  // exact-name matching to avoid false positives from their free text.
  const roleValueRoles = getInspectionRolesFromRoleValues([
    ...(userInfo?.rolesInfo || []).flatMap((role) => [
      role.roleName,
      role.roleID,
    ]),
    ...(userInfo?.listRoles || []).flatMap((role) => [
      role.name,
      role.nameEn,
      role.id,
    ]),
  ]);

  const legacyNameRoles = getInspectionRolesFromLegacyNames(
    (userInfo?.listRoles || []).flatMap((role) => [
      role.descEn,
      role.discriminator,
    ]),
  );

  const resolvedRoles = uniqueInspectionRoles([
    ...roleValueRoles,
    ...legacyNameRoles,
  ]);

  return resolvedRoles;
}

export function resolveInspectionRole(
  userInfo?: Partial<IUser> | null,
): InspectionRole | null {
  return resolveInspectionRoles(userInfo)[0] || null;
}

export function resolveInspectionInspectorId(
  userInfo?: Partial<IUser> | null,
) {
  const override = readMockInspectionOverride(
    MOCK_INSPECTION_INSPECTOR_ID_OVERRIDE_KEY,
  ).trim();

  if (override) {
    return override;
  }

  return String(userInfo?.id || DEFAULT_MOCK_INSPECTION_INSPECTOR_ID);
}

export function isInspectionPath(path?: string) {
  return Boolean(path?.startsWith("/inspection"));
}

export function isInspectionAdminPortalRole(role: InspectionRole) {
  return INSPECTION_ADMIN_PORTAL_ROLES.includes(role);
}

export function isInspectionTaskRole(
  role?: InspectionRole | null,
): role is "inspector" | "manager" {
  return Boolean(role && INSPECTION_TASK_ROLES.includes(role));
}

export function hasInspectionRole(
  roles: readonly InspectionRole[],
  role: InspectionRole,
) {
  return roles.includes(role);
}

export function hasAnyInspectionRole(
  roles: readonly InspectionRole[],
  allowedRoles: readonly InspectionRole[],
) {
  return allowedRoles.some((role) => roles.includes(role));
}

export function hasInspectionAdminPortalAccess(roles: readonly InspectionRole[]) {
  return hasAnyInspectionRole(roles, INSPECTION_ADMIN_PORTAL_ROLES);
}

export function getPrimaryInspectionTaskRole(
  roles: readonly InspectionRole[],
): "inspector" | "manager" | null {
  return roles.find(isInspectionTaskRole) || null;
}

export function getDefaultInspectionPath(roles: readonly InspectionRole[]) {
  if (hasAnyInspectionRole(roles, INSPECTION_TASK_ROLES)) {
    return INSPECTION_PATHS.tasks;
  }

  if (hasAnyInspectionRole(roles, INSPECTION_VIOLATION_ROLES)) {
    return INSPECTION_PATHS.violations;
  }

  return INSPECTION_ROUTE_FALLBACK;
}

export function getInspectionFallbackPath(roles: readonly InspectionRole[]) {
  return hasInspectionAdminPortalAccess(roles)
    ? getDefaultInspectionPath(roles)
    : INSPECTION_ROUTE_FALLBACK;
}

export function isInspectionRouteAllowedForRoles(
  route: InspectionRouteAccessMeta,
  roles: readonly InspectionRole[],
) {
  if (!isInspectionPath(route.path)) {
    return true;
  }

  const allowedRoles =
    route.allowedInspectionRoles || INSPECTION_ADMIN_PORTAL_ROLES;
  return hasAnyInspectionRole(roles, allowedRoles);
}

export function isInspectionRouteAllowedForRole(
  route: InspectionRouteAccessMeta,
  role: InspectionRole,
) {
  return isInspectionRouteAllowedForRoles(route, [role]);
}

function hasInspectionPermissionPath(
  permissionPaths: Set<string>,
  path?: string | null,
) {
  const normalizedPath = normalizeRoutePath(path);

  return Boolean(
    normalizedPath &&
      (permissionPaths.has(normalizedPath) ||
        isAuthenticatedAllowedProtectedPath(normalizedPath)),
  );
}

function hasInspectionAccessByPermissionPaths(permissionPaths: Set<string>) {
  return Array.from(permissionPaths).some((path) => isInspectionPath(path));
}

function getDefaultInspectionPathByPermissionPaths(permissionPaths: Set<string>) {
  if (
    hasInspectionPermissionPath(permissionPaths, INSPECTION_PATHS.tasks) ||
    Array.from(permissionPaths).some((path) =>
      path.startsWith(`${INSPECTION_PATHS.tasks}/`),
    )
  ) {
    return INSPECTION_PATHS.tasks;
  }

  if (
    hasInspectionPermissionPath(permissionPaths, INSPECTION_PATHS.violations) ||
    Array.from(permissionPaths).some((path) =>
      path.startsWith(`${INSPECTION_PATHS.violations}/`),
    )
  ) {
    return INSPECTION_PATHS.violations;
  }

  return INSPECTION_ROUTE_FALLBACK;
}

function isInspectionRouteAllowedByPermissionPaths(
  route: InspectionRouteAccessMeta,
  permissionPaths: Set<string>,
) {
  if (!isInspectionPath(route.path)) {
    return true;
  }

  return (
    hasInspectionPermissionPath(permissionPaths, route.permissionPath || route.path) ||
    hasInspectionPermissionPath(permissionPaths, route.activeMenuPath)
  );
}

export function useInspectionAccess() {
  const userInfo = useUserStore(
    (state: unknown) => (state as { userInfo?: IUser }).userInfo,
  );
  const loading = !userInfo?.id;
  const roles = useMemo(() => resolveInspectionRoles(userInfo), [userInfo]);
  const isSuperAdministrator = hasSuperAdministratorRole(userInfo);
  const inspectorId = resolveInspectionInspectorId(userInfo);
  const permissionPaths = useMemo(
    () =>
      createPermissionPathSet(
        (userInfo?.listSysPermission || []) as PermissionNode[],
      ),
    [userInfo?.listSysPermission],
  );
  const defaultPermissionPath =
    getDefaultInspectionPathByPermissionPaths(permissionPaths);
  const hasPermissionAccess =
    Boolean(defaultPermissionPath) ||
    hasInspectionAccessByPermissionPaths(permissionPaths);

  return useMemo<InspectionAccessState>(
    () => ({
      loading,
      roles,
      inspectorId,
      hasInspectionAccess: hasPermissionAccess,
      defaultInspectionPath: defaultPermissionPath,
      fallbackPath: hasPermissionAccess
        ? defaultPermissionPath
        : INSPECTION_ROUTE_FALLBACK,
      hasRole: (role: InspectionRole) => hasInspectionRole(roles, role),
      hasAnyRole: (allowedRoles: readonly InspectionRole[]) =>
        hasAnyInspectionRole(roles, allowedRoles),
      isRouteAllowed: (route: InspectionRouteAccessMeta) =>
        !isInspectionPath(route.path) ||
        (!loading &&
          isInspectionRouteAllowedByPermissionPaths(route, permissionPaths) &&
          (isSuperAdministrator ||
            isInspectionRouteAllowedForRoles(route, roles))),
    }),
    [
      defaultPermissionPath,
      hasPermissionAccess,
      inspectorId,
      isSuperAdministrator,
      loading,
      permissionPaths,
      roles,
    ],
  );
}
