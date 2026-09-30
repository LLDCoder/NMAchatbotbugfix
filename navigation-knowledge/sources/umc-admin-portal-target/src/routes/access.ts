import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import type { IRoute } from "@/routes";
import { useUserStore } from "@/store/user";

export const DEFAULT_PRIVATE_PATH = "/licensing/applications";
const LAST_AUTHORIZED_PRIVATE_PATH_KEY = "routes:last-authorized-private-path";
const AUTHENTICATED_ALLOWED_PROTECTED_PATHS = new Set([
  "/formilytest",
  "/notifications",
]);
const DEV_AUTHENTICATED_ALLOWED_PROTECTED_PATHS = new Set<string>([]);
const ROUTE_ACCESS_LOCAL_WHITELIST_STORAGE_KEY = "routeAccessLocalWhitelist";

export type PermissionNode = {
  frontendRoute?: string | null;
  buttonList?: PermissionButton[] | null;
  ButtonList?: PermissionButton[] | null;
  children?: PermissionNode[] | null;
};

export type PermissionButton = {
  permissionCode?: string | null;
  frontendRoute?: string | null;
};

export function normalizeRoutePath(value?: string | null): string {
  if (!value) {
    return "";
  }

  const [pathWithoutHash] = value.split("#");
  const [pathWithoutSearch] = pathWithoutHash.split("?");
  const withLeadingSlash = pathWithoutSearch.startsWith("/")
    ? pathWithoutSearch
    : `/${pathWithoutSearch}`;
  const normalized = withLeadingSlash.replace(/\/+$/, "") || "/";

  return normalized.toLowerCase();
}

function normalizePermissionCode(value?: string | null): string {
  return value?.trim() || "";
}

function canReadLocalRouteWhitelist() {
  return Boolean(import.meta.env.DEV && typeof window !== "undefined");
}

function isInspectionRoutePath(path: string) {
  return path === "/inspection" || path.startsWith("/inspection/");
}

function getLocalRouteWhitelistPaths(): string[] {
  if (!canReadLocalRouteWhitelist()) {
    return [];
  }

  try {
    const storedValue =
      window.localStorage.getItem(ROUTE_ACCESS_LOCAL_WHITELIST_STORAGE_KEY) || "";

    return storedValue
      .split(",")
      .map((item) => normalizeRoutePath(item))
      .filter((path) => path && !isInspectionRoutePath(path));
  } catch {
    return [];
  }
}

function getAuthenticatedAllowedProtectedPaths() {
  const paths = new Set(
    [...AUTHENTICATED_ALLOWED_PROTECTED_PATHS].map(normalizeRoutePath),
  );

  if (!import.meta.env.DEV) {
    return paths;
  }

  DEV_AUTHENTICATED_ALLOWED_PROTECTED_PATHS.forEach((path) => {
    paths.add(normalizeRoutePath(path));
  });
  getLocalRouteWhitelistPaths().forEach((path) => {
    paths.add(path);
  });

  return paths;
}

function getButtonList(item: PermissionNode): PermissionButton[] {
  return [...(item.buttonList || []), ...(item.ButtonList || [])];
}

export function collectPermissionPaths(
  permissions: PermissionNode[] = [],
): string[] {
  const paths: string[] = [];

  const visit = (items: PermissionNode[]) => {
    items.forEach((item) => {
      const normalizedPath = normalizeRoutePath(item.frontendRoute);
      if (normalizedPath) {
        paths.push(normalizedPath);
      }

      if (item.children?.length) {
        visit(item.children);
      }
    });
  };

  visit(permissions);

  return paths;
}

export function createPermissionPathSet(
  permissions: PermissionNode[] = [],
): Set<string> {
  return new Set(collectPermissionPaths(permissions));
}

export function collectButtonPermissionCodes(
  permissions: PermissionNode[] = [],
  routePath?: string | null,
): string[] {
  const codes: string[] = [];
  const normalizedRoutePath = normalizeRoutePath(routePath);

  const visit = (items: PermissionNode[]) => {
    items.forEach((item) => {
      const itemRoutePath = normalizeRoutePath(item.frontendRoute);

      getButtonList(item).forEach((button) => {
        const buttonRoutePath =
          normalizeRoutePath(button.frontendRoute) || itemRoutePath;
        const matchesRoute =
          !normalizedRoutePath ||
          buttonRoutePath === normalizedRoutePath ||
          itemRoutePath === normalizedRoutePath;
        const permissionCode = normalizePermissionCode(button.permissionCode);

        if (matchesRoute && permissionCode) {
          codes.push(permissionCode);
        }
      });

      if (item.children?.length) {
        visit(item.children);
      }
    });
  };

  visit(permissions);

  return codes;
}

export function createButtonPermissionCodeSet(
  permissions: PermissionNode[] = [],
  routePath?: string | null,
): Set<string> {
  return new Set(collectButtonPermissionCodes(permissions, routePath));
}

export function canRenderButton(
  permissions: PermissionNode[] = [],
  permissionCode?: string | null,
  routePath?: string | null,
): boolean {
  const normalizedPermissionCode = normalizePermissionCode(permissionCode);

  if (!normalizedPermissionCode) {
    return false;
  }

  return createButtonPermissionCodeSet(permissions, routePath).has(
    normalizedPermissionCode,
  );
}

export function flattenRoutes(routes: IRoute[] = []): IRoute[] {
  return routes.reduce<IRoute[]>((acc, route) => {
    acc.push(route);

    if (route.children?.length) {
      acc.push(...flattenRoutes(route.children));
    }

    return acc;
  }, []);
}

export function isAuthenticatedAllowedProtectedPath(path?: string | null): boolean {
  return getAuthenticatedAllowedProtectedPaths().has(normalizeRoutePath(path));
}

function isRouteAllowedByPermissions(route: IRoute, allowedPaths: Set<string>) {
  const normalizedPath = normalizeRoutePath(route.path);
  const normalizedPermissionPath = normalizeRoutePath(route.permissionPath);
  const normalizedActiveMenuPath = normalizeRoutePath(route.activeMenuPath);

  return Boolean(
    allowedPaths.has(normalizedPath) ||
      (normalizedPermissionPath && allowedPaths.has(normalizedPermissionPath)) ||
      (normalizedActiveMenuPath && allowedPaths.has(normalizedActiveMenuPath)) ||
      isAuthenticatedAllowedProtectedPath(normalizedPath),
  );
}

function hasAllowedDescendant(route: IRoute, allowedPaths: Set<string>): boolean {
  return Boolean(
    route.children?.some(
      (child) =>
        isRouteAllowedByPermissions(child, allowedPaths) ||
        hasAllowedDescendant(child, allowedPaths),
    ),
  );
}

function isRenderableRoute(route: IRoute): boolean {
  return Boolean(route.page && (!route.isMenu || !route.children?.length));
}

export function filterProtectedRoutes(
  routes: IRoute[] = [],
  permissions: PermissionNode[] = [],
): IRoute[] {
  const allowedPaths = createPermissionPathSet(permissions);

  const filterRoute = (route: IRoute): IRoute | null => {
    const filteredChildren = route.children
      ?.map(filterRoute)
      .filter((child): child is IRoute => Boolean(child));
    const isAllowed = isRouteAllowedByPermissions(route, allowedPaths);
    const keepForChildren =
      Boolean(filteredChildren?.length) && !isRenderableRoute(route);
    const keepSelf = isAllowed && (!route.isMenu || isRenderableRoute(route));

    if (!keepSelf && !keepForChildren) {
      return null;
    }

    return {
      ...route,
      children: filteredChildren,
    };
  };

  return routes
    .map((route) => {
      const keepForChildren = route.isMenu && hasAllowedDescendant(route, allowedPaths);
      const isAllowed = isRouteAllowedByPermissions(route, allowedPaths);
      const keepSelf = isAllowed && (!route.isMenu || isRenderableRoute(route));

      if (!keepSelf && !keepForChildren) {
        return null;
      }

      return filterRoute(route);
    })
    .filter((route): route is IRoute => Boolean(route));
}

export function findRouteByPath(
  routes: IRoute[] = [],
  path: string,
): IRoute | undefined {
  const normalizedPath = normalizeRoutePath(path);

  return flattenRoutes(routes).find(
    (route) => normalizeRoutePath(route.path) === normalizedPath,
  );
}

export function isProtectedPathAllowed(
  routes: IRoute[] = [],
  permissions: PermissionNode[] = [],
  path: string,
): boolean {
  const normalizedPath = normalizeRoutePath(path);

  if (!normalizedPath || normalizedPath === "/") {
    return true;
  }

  return Boolean(findRouteByPath(filterProtectedRoutes(routes, permissions), path));
}

export function findFirstAccessibleRoute(
  routes: IRoute[] = [],
  permissions: PermissionNode[] = [],
): IRoute | undefined {
  const routeByPath = new Map(
    flattenRoutes(routes).map((route) => [normalizeRoutePath(route.path), route]),
  );

  for (const permissionPath of collectPermissionPaths(permissions)) {
    const route = routeByPath.get(permissionPath);
    if (route && isRenderableRoute(route)) {
      return route;
    }
  }

  return undefined;
}

export function getDefaultPrivatePath(
  routes: IRoute[] = [],
  permissions: PermissionNode[] = [],
): string {
  if (isProtectedPathAllowed(routes, permissions, DEFAULT_PRIVATE_PATH)) {
    return DEFAULT_PRIVATE_PATH;
  }

  return findFirstAccessibleRoute(routes, permissions)?.path || "";
}

export function getStoredLastAuthorizedPrivatePath(): string {
  return sessionStorage.getItem(LAST_AUTHORIZED_PRIVATE_PATH_KEY) || "";
}

export function clearStoredLastAuthorizedPrivatePath() {
  sessionStorage.removeItem(LAST_AUTHORIZED_PRIVATE_PATH_KEY);
}

export function setStoredLastAuthorizedPrivatePath(path: string) {
  const normalizedPath = normalizeRoutePath(path);

  if (normalizedPath && normalizedPath !== "/") {
    sessionStorage.setItem(LAST_AUTHORIZED_PRIVATE_PATH_KEY, path);
  }
}

export function useAccessibleProtectedRoutes(routes: IRoute[] = []) {
  const permissions = useUserStore(
    (state) => state.userInfo?.listSysPermission || [],
  ) as PermissionNode[];

  return useMemo(
    () => filterProtectedRoutes(routes, permissions),
    [permissions, routes],
  );
}

export function useDefaultPrivatePath(routes: IRoute[] = []) {
  const permissions = useUserStore(
    (state) => state.userInfo?.listSysPermission || [],
  ) as PermissionNode[];

  return useMemo(
    () => getDefaultPrivatePath(routes, permissions),
    [permissions, routes],
  );
}

export function useCanRenderButton(
  permissionCode?: string | null,
  routePath?: string | null,
) {
  const location = useLocation();
  const resolvedRoutePath = routePath || location.pathname;
  const permissions = useUserStore(
    (state) => state.userInfo?.listSysPermission || [],
  ) as PermissionNode[];

  return useMemo(
    () => canRenderButton(permissions, permissionCode, resolvedRoutePath),
    [permissionCode, permissions, resolvedRoutePath],
  );
}

export function useButtonPermission(routePath?: string | null) {
  const location = useLocation();
  const resolvedRoutePath = routePath || location.pathname;
  const permissions = useUserStore(
    (state) => state.userInfo?.listSysPermission || [],
  ) as PermissionNode[];
  const buttonPermissionCodes = useMemo(
    () => createButtonPermissionCodeSet(permissions, resolvedRoutePath),
    [permissions, resolvedRoutePath],
  );

  return useMemo(
    () => ({
      canRenderButton: (permissionCode?: string | null) => {
        const normalizedPermissionCode = normalizePermissionCode(permissionCode);

        return Boolean(
          normalizedPermissionCode &&
            buttonPermissionCodes.has(normalizedPermissionCode),
        );
      },
      buttonPermissionCodes,
    }),
    [buttonPermissionCodes],
  );
}
