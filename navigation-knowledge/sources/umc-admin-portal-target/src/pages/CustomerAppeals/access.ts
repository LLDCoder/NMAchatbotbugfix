import { useMemo } from "react";
import {
  INSPECTION_VIOLATION_ROLES,
  useInspectionAccess,
} from "@/pages/InspectionCommon/access";
import { INSPECTION_PATHS } from "@/pages/InspectionCommon/constants";
import {
  createPermissionPathSet,
  normalizeRoutePath,
  type PermissionNode,
} from "@/routes/access";
import {
  loadCurrentAdminUser,
  useCurrentAdminUser,
} from "@/store/currentAdminUser";
import { useUserStore } from "@/store/user";
import {
  resolveAppealViewRoleFromAdminUser,
  type AppealRoleSourceUser,
} from "./roleConfig";
import type { AppealViewRole } from "./types";

export const CUSTOMER_APPEALS_ROUTE_FALLBACK = "";
const CUSTOMER_APPEALS_ROOT_PATH = "/happiness/appeals";
const INSPECTION_VIOLATION_DETAIL_PERMISSION_PATH = normalizeRoutePath(
  INSPECTION_PATHS.violationDetail,
);

export interface CustomerAppealsRouteAccessMeta {
  path?: string;
  requiresCustomerAppealsAccess?: boolean;
}

export interface CustomerAppealsAccessState {
  loading: boolean;
  hasAccess: boolean;
  role?: AppealViewRole;
}

const CUSTOMER_APPEALS_LOADING_ACCESS: CustomerAppealsAccessState = {
  loading: true,
  hasAccess: false,
};

const CUSTOMER_APPEALS_DISABLED_ACCESS: CustomerAppealsAccessState = {
  loading: false,
  hasAccess: false,
};

interface UseCustomerAppealsAccessOptions {
  enabled?: boolean;
}

function createAccessState(role?: AppealViewRole): CustomerAppealsAccessState {
  return {
    loading: false,
    hasAccess: Boolean(role),
    role,
  };
}

function resolveAppealAccessState(adminUser?: AppealRoleSourceUser | null) {
  return createAccessState(
    resolveAppealViewRoleFromAdminUser(adminUser),
  );
}

export function isCustomerAppealsPath(path?: string) {
  return Boolean(
    path === CUSTOMER_APPEALS_ROOT_PATH ||
      path?.startsWith(`${CUSTOMER_APPEALS_ROOT_PATH}/`),
  );
}

export function isCustomerAppealsRouteProtected(
  route?: CustomerAppealsRouteAccessMeta | null,
) {
  return Boolean(route?.requiresCustomerAppealsAccess);
}

export function resolveCustomerAppealsAccess(userId: string) {
  return loadCurrentAdminUser(userId)
    .then((adminUser) => resolveAppealAccessState(adminUser))
    .catch(() => resolveAppealAccessState(null));
}

export function useCustomerAppealsAccess(
  options: UseCustomerAppealsAccessOptions = {},
) {
  const { enabled = true } = options;
  const currentUserId = useUserStore((state) => state.userInfo?.id);
  const currentAdminUser = useCurrentAdminUser(currentUserId, enabled);
  const access = useMemo<CustomerAppealsAccessState>(() => {
    if (!enabled) {
      return CUSTOMER_APPEALS_DISABLED_ACCESS;
    }

    if (!currentUserId || currentAdminUser.loading) {
      return CUSTOMER_APPEALS_LOADING_ACCESS;
    }

    if (currentAdminUser.error) {
      return createAccessState();
    }

    return createAccessState(
      resolveAppealViewRoleFromAdminUser(currentAdminUser.data),
    );
  }, [
    currentAdminUser.data,
    currentAdminUser.error,
    currentAdminUser.loading,
    currentUserId,
    enabled,
  ]);

  return useMemo(
    () => ({
      ...access,
      isRouteAllowed: (route?: CustomerAppealsRouteAccessMeta | null) =>
        !isCustomerAppealsRouteProtected(route) || access.hasAccess,
    }),
    [access],
  );
}

export function useCanOpenCustomerAppealViolationDetail() {
  const permissions = useUserStore(
    (state) => state.userInfo?.listSysPermission || [],
  ) as PermissionNode[];
  const inspectionAccess = useInspectionAccess();

  return useMemo(() => {
    const hasRoutePermission = createPermissionPathSet(permissions).has(
      INSPECTION_VIOLATION_DETAIL_PERMISSION_PATH,
    );

    return (
      hasRoutePermission &&
      inspectionAccess.isRouteAllowed({
        path: INSPECTION_PATHS.violationDetail,
        allowedInspectionRoles: INSPECTION_VIOLATION_ROLES,
      })
    );
  }, [inspectionAccess, permissions]);
}
