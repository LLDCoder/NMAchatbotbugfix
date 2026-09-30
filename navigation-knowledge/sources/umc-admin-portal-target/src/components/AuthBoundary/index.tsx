import { Redirect, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Result, Spin } from "antd";
import routes, { type IRoute } from "../../routes";
import { authService } from "@/services/auth";
import { performAuthenticatedLogout } from "@/utils/authSession";
import { syncCurrentUserAfterAuth } from "@/services/authBootstrap";
import { preloadDesignablePlayground } from "@/components/designable/playground/preload";
import { isInspectionPath, useInspectionAccess } from "@/pages/InspectionCommon/access";
import {
  isCustomerAppealsPath,
  isCustomerAppealsRouteProtected,
  useCustomerAppealsAccess,
} from "@/pages/CustomerAppeals/access";
import {
  normalizeRoutePath,
  useAccessibleProtectedRoutes,
} from "@/routes/access";
import {
  filterRuntimeAccessibleRoutes,
  getDefaultRuntimePrivatePath,
  getRootDefaultRuntimePrivatePath,
} from "@/routes/runtimeAccess";
import { useUserStore } from "@/store/user";
import { SESSION_ACTIVITY_EVENT } from "@/utils/sessionActivity";

type AuthRoute = IRoute & {
  redirect?: string;
  children?: AuthRoute[];
};

interface AuthBoundaryProps {
  children: React.ReactNode;
}

function findRouteByPath(
  routeList: AuthRoute[],
  path: string,
): AuthRoute | undefined {
  const normalizedPath = normalizeRoutePath(path);

  for (const route of routeList) {
    if (normalizeRoutePath(route.path) === normalizedPath) {
      return route;
    }

    if (route.children?.length) {
      const found = findRouteByPath(route.children, path);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

function hasRouteMatching(
  routeList: AuthRoute[],
  predicate: (route: AuthRoute) => boolean,
): boolean {
  for (const route of routeList) {
    if (predicate(route)) {
      return true;
    }

    if (route.children?.length && hasRouteMatching(route.children, predicate)) {
      return true;
    }
  }

  return false;
}

function isRouteAccessibleByRuntimeRoutes(
  routeList: AuthRoute[],
  route: AuthRoute,
): boolean {
  return Boolean(
    findRouteByPath(routeList, route.path) ||
      (route.activeMenuPath && findRouteByPath(routeList, route.activeMenuPath)),
  );
}

function RouteLoading() {
  return (
    <div className="route-status route-status--loading">
      <Spin size="large" />
    </div>
  );
}

function RouteAccessResult({
  status,
  title,
  subTitle,
}: {
  status: "403" | "404";
  title: string;
  subTitle: string;
}) {
  return (
    <div className="route-status">
      <Result status={status} title={title} subTitle={subTitle} />
    </div>
  );
}

export default function AuthBoundary({ children }: AuthBoundaryProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const timerRef = useRef<number | undefined>(undefined);
  const hasSyncedUserRef = useRef(false);
  const syncUserPromiseRef = useRef<Promise<boolean> | null>(null);
  const hasPreloadedDesignableRef = useRef(false);
  const [userSyncComplete, setUserSyncComplete] = useState(false);
  const logoutTime = 60 * 60 * 1000;
  const isAuthenticated = authService.isAuthenticated();
  const userInfo = useUserStore((state) => state.userInfo);
  const permissions = useMemo(
    () =>
      Array.isArray(userInfo?.listSysPermission)
        ? userInfo.listSysPermission
        : [],
    [userInfo?.listSysPermission],
  );
  const hasPermissionSnapshot = Boolean(
    userInfo?.id && Array.isArray(userInfo.listSysPermission),
  );
  const routeAccessReady =
    isAuthenticated && userSyncComplete && hasPermissionSnapshot;
  const inspectionAccess = useInspectionAccess();
  const rootChildren =
    routes.find((route) => route.root)?.children ?? [];
  const backendAccessibleRootChildren =
    useAccessibleProtectedRoutes(rootChildren);
  const currentRoute = findRouteByPath(
    routes as AuthRoute[],
    location.pathname,
  );
  const currentPath = normalizeRoutePath(location.pathname);
  const customerAppealsAccessRequired =
    routeAccessReady &&
    (isCustomerAppealsRouteProtected(currentRoute) ||
      (!currentRoute && isCustomerAppealsPath(location.pathname)) ||
      currentPath === "/");
  const customerAppealsAccess = useCustomerAppealsAccess({
    enabled: customerAppealsAccessRequired,
  });
  const runtimeAccessibleRootChildren = useMemo(
    () => {
      if (!routeAccessReady) {
        return [];
      }

      return filterRuntimeAccessibleRoutes(backendAccessibleRootChildren, {
        inspectionLoading: inspectionAccess.loading,
        customerAppealsLoading: customerAppealsAccess.loading,
        hasCustomerAppealsAccess: customerAppealsAccess.hasAccess,
      });
    },
    [
      backendAccessibleRootChildren,
      customerAppealsAccess.hasAccess,
      customerAppealsAccess.loading,
      inspectionAccess.loading,
      routeAccessReady,
    ],
  );
  const isCurrentInspectionRouteAccessible = useMemo(
    () => {
      if (!currentRoute || !isInspectionPath(currentRoute.path)) {
        return true;
      }

      if (!routeAccessReady) {
        return false;
      }

      return isRouteAccessibleByRuntimeRoutes(
        runtimeAccessibleRootChildren as AuthRoute[],
        currentRoute,
      );
    },
    [currentRoute, routeAccessReady, runtimeAccessibleRootChildren],
  );
  const hasAccessibleInspectionRoute = useMemo(
    () => (
      routeAccessReady &&
      hasRouteMatching(
        runtimeAccessibleRootChildren as AuthRoute[],
        (route) => isInspectionPath(route.path),
      )
    ),
    [routeAccessReady, runtimeAccessibleRootChildren],
  );
  const defaultPrivatePath = useMemo(
    () => {
      if (!routeAccessReady) {
        return "";
      }

      return getDefaultRuntimePrivatePath(
        runtimeAccessibleRootChildren,
        permissions,
      );
    },
    [permissions, routeAccessReady, runtimeAccessibleRootChildren],
  );
  const rootDefaultPrivatePath = useMemo(
    () => {
      if (!routeAccessReady) {
        return "";
      }

      return getRootDefaultRuntimePrivatePath(
        runtimeAccessibleRootChildren,
        permissions,
      );
    },
    [permissions, routeAccessReady, runtimeAccessibleRootChildren],
  );
  const routeAccessLoading =
    routeAccessReady &&
    (inspectionAccess.loading || customerAppealsAccess.loading);

  useEffect(() => {
    if (!routeAccessReady || !defaultPrivatePath) return;

    const defaultRoute = findRouteByPath(
      runtimeAccessibleRootChildren as AuthRoute[],
      defaultPrivatePath,
    );
    const preload = () => defaultRoute?.preload?.();
    const idleCallback = window.requestIdleCallback;

    if (typeof idleCallback === "function") {
      const idleId = idleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(preload, 500);
    return () => window.clearTimeout(timeoutId);
  }, [defaultPrivatePath, routeAccessReady, runtimeAccessibleRootChildren]);

  const redirectTo = (targetPath: string) => {
    const normalizedTargetPath = normalizeRoutePath(targetPath);

    if (!normalizedTargetPath || normalizedTargetPath === currentPath) {
      return (
        <RouteAccessResult
          status="403"
          title="403"
          subTitle={t("routeStatus.noAccessiblePage")}
        />
      );
    }

    return <Redirect to={targetPath} />;
  };

  useEffect(() => {
    if (!isAuthenticated) {
      hasSyncedUserRef.current = false;
      syncUserPromiseRef.current = null;
      hasPreloadedDesignableRef.current = false;
      setUserSyncComplete(false);
      return undefined;
    }

    let cancelled = false;

    if (!hasSyncedUserRef.current) {
      hasSyncedUserRef.current = true;
      setUserSyncComplete(false);
      syncUserPromiseRef.current = syncCurrentUserAfterAuth();
    }

    if (syncUserPromiseRef.current) {
      void syncUserPromiseRef.current.then((isSynced) => {
        if (!cancelled) {
          setUserSyncComplete(isSynced);
        }
      });
    }

    if (!hasPreloadedDesignableRef.current) {
      hasPreloadedDesignableRef.current = true;
      void preloadDesignablePlayground().catch((error) => {
        console.warn("[AuthBoundary] Failed to preload designable playground", error);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    const autoLogout = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = undefined;
      performAuthenticatedLogout({
        bypassInspectionLeaveConfirm: true,
        saveInspectionExecutionDraft: true,
        loginNotice: t("login.idleSessionLogout"),
      });
    };

    const resetTimer = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(autoLogout, logoutTime);
    };

    resetTimer();
    const scrollEventOptions: AddEventListenerOptions = {
      capture: true,
      passive: true,
    };
    const passiveEventOptions: AddEventListenerOptions = { passive: true };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer, scrollEventOptions);
    window.addEventListener("touchstart", resetTimer, passiveEventOptions);
    window.addEventListener("touchmove", resetTimer, passiveEventOptions);
    window.addEventListener(SESSION_ACTIVITY_EVENT, resetTimer);

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer, scrollEventOptions);
      window.removeEventListener("touchstart", resetTimer, passiveEventOptions);
      window.removeEventListener("touchmove", resetTimer, passiveEventOptions);
      window.removeEventListener(SESSION_ACTIVITY_EVENT, resetTimer);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = undefined;
    };
  }, [isAuthenticated, logoutTime, t]);

  if (!isAuthenticated) {
    return redirectTo("/login");
  }

  if (!userSyncComplete || !hasPermissionSnapshot) {
    return <RouteLoading />;
  }

  if (currentRoute?.redirect) {
    if (routeAccessLoading) {
      return <RouteLoading />;
    }

    if (!rootDefaultPrivatePath) {
      return (
        <RouteAccessResult
          status="404"
          title="404"
          subTitle={t("routeStatus.pageUnavailable")}
        />
      );
    }

    return redirectTo(rootDefaultPrivatePath);
  }

  if (isCustomerAppealsRouteProtected(currentRoute)) {
    if (customerAppealsAccess.loading) {
      return <RouteLoading />;
    }

    if (!customerAppealsAccess.isRouteAllowed(currentRoute)) {
      return redirectTo(defaultPrivatePath);
    }
  }

  if (!currentRoute && isCustomerAppealsPath(location.pathname)) {
    if (customerAppealsAccess.loading) {
      return <RouteLoading />;
    }

    if (!customerAppealsAccess.hasAccess) {
      return redirectTo(defaultPrivatePath);
    }
  }

  if (
    currentRoute &&
    isInspectionPath(currentRoute.path) &&
    inspectionAccess.loading
  ) {
    return <RouteLoading />;
  }

  if (
    currentRoute &&
    isInspectionPath(currentRoute.path) &&
    !isCurrentInspectionRouteAccessible
  ) {
    return redirectTo(defaultPrivatePath);
  }

  if (
    !currentRoute &&
    isInspectionPath(location.pathname) &&
    inspectionAccess.loading
  ) {
    return <RouteLoading />;
  }

  if (
    !currentRoute &&
    isInspectionPath(location.pathname) &&
    !hasAccessibleInspectionRoute
  ) {
    return redirectTo(defaultPrivatePath);
  }

  return <>{children}</>;
}
