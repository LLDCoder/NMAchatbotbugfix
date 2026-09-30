import type { IRoute } from "@/routes";
import { isCustomerAppealsRouteProtected } from "@/pages/CustomerAppeals/access";
import { isInspectionPath } from "@/pages/InspectionCommon/access";
import {
  collectPermissionPaths,
  DEFAULT_PRIVATE_PATH,
  normalizeRoutePath,
  type PermissionNode,
} from "./access";

const DASHBOARD_PRIVATE_PATH = "/dashboard";

export type RuntimeRouteAccessOptions = {
  inspectionLoading?: boolean;
  customerAppealsLoading?: boolean;
  hasCustomerAppealsAccess?: boolean;
};

function isRuntimeRouteAllowed(
  route: IRoute,
  options: RuntimeRouteAccessOptions
) {
  if (isInspectionPath(route.path)) {
    return !options.inspectionLoading;
  }

  if (isCustomerAppealsRouteProtected(route)) {
    return (
      !options.customerAppealsLoading &&
      Boolean(options.hasCustomerAppealsAccess)
    );
  }

  return true;
}

function isRuntimeRenderableRoute(route: IRoute) {
  return Boolean(route.page && (!route.isMenu || !route.children?.length));
}

export function filterRuntimeAccessibleRoutes(
  routes: IRoute[] = [],
  options: RuntimeRouteAccessOptions
): IRoute[] {
  const filterRoute = (route: IRoute): IRoute | null => {
    const filteredChildren = route.children
      ?.map(filterRoute)
      .filter((child): child is IRoute => Boolean(child));
    const isAllowed = isRuntimeRouteAllowed(route, options);
    const keepForChildren = Boolean(filteredChildren?.length);

    if (!isAllowed && !keepForChildren) {
      return null;
    }

    if (route.isMenu && !keepForChildren && route.children?.length) {
      return null;
    }

    return {
      ...route,
      children: filteredChildren,
    };
  };

  return routes
    .map(filterRoute)
    .filter((route): route is IRoute => Boolean(route));
}

export function findFirstRuntimeAccessibleRoute(
  routes: IRoute[] = []
): IRoute | undefined {
  return routes.find(isRuntimeRenderableRoute);
}

function findRuntimeRenderableRouteByPath(
  routes: IRoute[] = [],
  path?: string | null
): IRoute | undefined {
  const normalizedPath = normalizeRoutePath(path);

  if (!normalizedPath) {
    return undefined;
  }

  return routes.find(
    (route) =>
      isRuntimeRenderableRoute(route) &&
      normalizeRoutePath(route.path) === normalizedPath
  );
}

export function getDefaultRuntimePrivatePath(
  routes: IRoute[] = [],
  permissions: PermissionNode[] = []
) {
  if (findRuntimeRenderableRouteByPath(routes, DEFAULT_PRIVATE_PATH)) {
    return DEFAULT_PRIVATE_PATH;
  }

  const routeByPath = new Map(
    routes.map((route) => [
      normalizeRoutePath(route.path),
      route,
    ])
  );

  for (const permissionPath of collectPermissionPaths(permissions)) {
    const route = routeByPath.get(permissionPath);
    if (route && isRuntimeRenderableRoute(route)) {
      return route.path;
    }
  }

  return findFirstRuntimeAccessibleRoute(routes)?.path || "";
}

export function getRootDefaultRuntimePrivatePath(
  routes: IRoute[] = [],
  permissions: PermissionNode[] = []
) {
  const hasDashboardPermission = collectPermissionPaths(permissions).some(
    (permissionPath) =>
      normalizeRoutePath(permissionPath) === DASHBOARD_PRIVATE_PATH
  );
  const dashboardRoute = findRuntimeRenderableRouteByPath(
    routes,
    DASHBOARD_PRIVATE_PATH
  );

  if (hasDashboardPermission && dashboardRoute) {
    return dashboardRoute.path;
  }

  return getDefaultRuntimePrivatePath(routes, permissions);
}

export function isRuntimePathAccessible(
  routes: IRoute[] = [],
  path?: string | null
) {
  return Boolean(findRuntimeRenderableRouteByPath(routes, path));
}
