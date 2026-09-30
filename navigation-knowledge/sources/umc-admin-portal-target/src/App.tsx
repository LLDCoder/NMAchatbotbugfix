import { MantineProvider } from "@mantine/core";
import { Redirect, Switch, Route, useLocation } from "react-router-dom";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import "antd/dist/antd.css";
import "/node_modules/flag-icons/css/flag-icons.min.css";

import renderRoutes from "./routes";
import AuthBoundary from "./components/AuthBoundary";
import Layout from "./layout";
import { NotificationProvider } from "./contexts/NotificationContext";
import "./App.less";
import "./localization/config";
import i18n from "./localization/config";
import {
  isArabicLanguage,
  normalizePortalLanguage,
  toFormilyValidateLanguage,
} from "./localization/language";
import { ConfigProvider, Result } from "antd";
import { getAntdLocale } from "@/utils/antdLocale";
import { useState, useEffect, useMemo } from "react";
import {
  registerValidateLocale,
  setValidateLanguage,
  registerValidateFormats,
} from "@formily/core";
import KeepAliveRouteGroup from "@/components/KeepAlive/KeepAliveRouteGroup";
import BuildUpdateBanner from "@/components/BuildUpdateBanner";
import type { IRoute } from "@/routes";
import {
  clearStoredLastAuthorizedPrivatePath,
  findRouteByPath,
  getStoredLastAuthorizedPrivatePath,
  normalizeRoutePath,
  setStoredLastAuthorizedPrivatePath,
  useAccessibleProtectedRoutes,
} from "@/routes/access";
import {
  filterRuntimeAccessibleRoutes,
  isRuntimePathAccessible,
} from "@/routes/runtimeAccess";
import { useInspectionAccess } from "@/pages/InspectionCommon/access";
import { useCustomerAppealsAccess } from "@/pages/CustomerAppeals/access";
import { performLocalLogout } from "@/utils/authSession";
import {
  AUTH_SESSION_SYNC_ACTION,
  subscribeAuthSessionSync,
} from "@/utils/authSessionSync";
import { history } from "@/utils/history";
import { checkBuildVersionNow } from "@/utils/buildVersionWatcher";

function getKeepAliveRouteGroups(routes: IRoute[]) {
  return routes.reduce<Record<string, IRoute[]>>((groups, route) => {
    const groupKey = route.keepAlive?.group;

    if (!groupKey) {
      return groups;
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }

    groups[groupKey].push(route);
    return groups;
  }, {});
}

function PrivateRouteVisitTracker({ routes }: { routes: IRoute[] }) {
  const location = useLocation();

  useEffect(() => {
    const matchedRoute = isRuntimePathAccessible(routes, location.pathname);

    if (matchedRoute && normalizeRoutePath(location.pathname) !== "/") {
      setStoredLastAuthorizedPrivatePath(
        `${location.pathname}${location.search}${location.hash}`,
      );
    }
  }, [location.hash, location.pathname, location.search, routes]);

  return null;
}

function PrivateRouteFallback({
  allRoutes,
  accessibleRoutes,
}: {
  allRoutes: IRoute[];
  accessibleRoutes: IRoute[];
}) {
  const location = useLocation();
  const attemptedLocationKey = `${location.pathname}${location.search}${location.hash}`;
  const [versionCheckState, setVersionCheckState] = useState<{
    checkedLocationKey: string;
    checking: boolean;
    versionUpdateAvailable: boolean;
  }>({
    checkedLocationKey: "",
    checking: true,
    versionUpdateAvailable: false,
  });
  const isKnownProtectedRoute = Boolean(findRouteByPath(allRoutes, location.pathname));
  const lastAuthorizedPath = getStoredLastAuthorizedPrivatePath();
  const currentPath = normalizeRoutePath(location.pathname);
  const isLastAuthorizedPathAllowed = Boolean(
    lastAuthorizedPath && isRuntimePathAccessible(accessibleRoutes, lastAuthorizedPath)
  );
  const canReturnToLastAuthorizedPath =
    isKnownProtectedRoute &&
    lastAuthorizedPath &&
    normalizeRoutePath(lastAuthorizedPath) !== currentPath &&
    isLastAuthorizedPathAllowed;

  useEffect(() => {
    if (lastAuthorizedPath && !isLastAuthorizedPathAllowed) {
      clearStoredLastAuthorizedPrivatePath();
    }
  }, [isLastAuthorizedPathAllowed, lastAuthorizedPath]);

  useEffect(() => {
    let active = true;

    setVersionCheckState({
      checkedLocationKey: attemptedLocationKey,
      checking: true,
      versionUpdateAvailable: false,
    });

    void checkBuildVersionNow().then((versionUpdateAvailable) => {
      if (!active) {
        return;
      }

      setVersionCheckState({
        checkedLocationKey: attemptedLocationKey,
        checking: false,
        versionUpdateAvailable,
      });

      if (
        versionUpdateAvailable &&
        lastAuthorizedPath &&
        isLastAuthorizedPathAllowed &&
        normalizeRoutePath(lastAuthorizedPath) !== currentPath
      ) {
        history.replace(lastAuthorizedPath);
      }
    });

    return () => {
      active = false;
    };
  }, [
    attemptedLocationKey,
    currentPath,
    isLastAuthorizedPathAllowed,
    lastAuthorizedPath,
  ]);

  if (canReturnToLastAuthorizedPath) {
    return <Redirect to={lastAuthorizedPath} />;
  }

  if (
    versionCheckState.checking ||
    versionCheckState.checkedLocationKey !== attemptedLocationKey ||
    versionCheckState.versionUpdateAvailable
  ) {
    return null;
  }

  return (
    <Result
      status="404"
      title="404"
      subTitle={i18n.t("routeStatus.pageUnavailable")}
    />
  );
}

function App() {
  const [locale, setLocale] = useState(i18n.language);
  useEffect(
    () =>
      subscribeAuthSessionSync((action) => {
        if (action === AUTH_SESSION_SYNC_ACTION.LOGIN) {
          window.location.reload();
          return;
        }

        performLocalLogout({
          bypassInspectionLeaveConfirm: true,
          saveInspectionExecutionDraft: true,
          syncOtherTabs: false,
        });
      }),
    [],
  );

  useEffect(() => {
    const handleLanguageChange = () => {
      const normalizedLanguage = normalizePortalLanguage(i18n.language);
      setLocale(normalizedLanguage);
      setValidateLanguage(toFormilyValidateLanguage(i18n.language));
      document.documentElement.lang = normalizedLanguage;
      document.documentElement.dir = isArabicLanguage(i18n.language)
        ? "rtl"
        : "ltr";
      document.title = i18n.t("pageTitle.portal");
      // window.location.reload();
    };

    handleLanguageChange();
    i18n.on("languageChanged", handleLanguageChange);

    return () => {
      i18n.off("languageChanged", handleLanguageChange);
    };
  }, []);
  registerValidateLocale({
    "en-US": {
      global1: i18n.t("formValidation.customRule", { lng: "en" }),
    },
    "ar-AE": {
      global1: i18n.t("formValidation.customRule", { lng: "ar" }),
    },
  });

  registerValidateFormats({
    global1: /123/,
  });

  const rootRoute = renderRoutes.find((route) => route.root);
  const rootChildren = rootRoute?.children ?? [];
  const accessibleRootChildren = useAccessibleProtectedRoutes(rootChildren);
  const inspectionAccess = useInspectionAccess();
  const customerAppealsAccess = useCustomerAppealsAccess();
  const runtimeAccessibleRootChildren = useMemo(
    () =>
      filterRuntimeAccessibleRoutes(accessibleRootChildren, {
        inspectionLoading: inspectionAccess.loading,
        customerAppealsLoading: customerAppealsAccess.loading,
        hasCustomerAppealsAccess: customerAppealsAccess.hasAccess,
      }),
    [
      accessibleRootChildren,
      customerAppealsAccess.hasAccess,
      customerAppealsAccess.loading,
      inspectionAccess.loading,
    ]
  );
  const keepAliveRouteGroups = getKeepAliveRouteGroups(runtimeAccessibleRootChildren);
  const defaultRootChildren = runtimeAccessibleRootChildren.filter(
    (route) => route.page && !route.keepAlive?.group,
  );

  return (
    <ConfigProvider
      locale={getAntdLocale(locale)}
      direction={isArabicLanguage(locale) ? "rtl" : "ltr"}
      getPopupContainer={(triggerNode) => {
        if (!triggerNode) return document.body;

        if (
          triggerNode.closest(".ant-modal") ||
          triggerNode.closest(".ant-modal-wrap")
        ) {
          return document.body;
        }

        const isInTableAction =
          triggerNode.closest(".ant-table-tbody") ||
          triggerNode.closest(".ant-table-cell");

        if (isInTableAction) {
          return triggerNode.closest(".ant-table-tbody") || document.body;
        }
        if(triggerNode.closest('.ant-card')){
          return triggerNode.closest('.ant-card')|| document.body;
        }
        if (
          triggerNode?.parentElement &&
          typeof triggerNode.parentElement?.className?.includes ===
            "function" &&
          !triggerNode.parentElement.className.includes("filter-modal-item")
        ) {
          return triggerNode.parentElement;
        }
        return document.body;
      }}
    >
      <NotificationProvider>
        <BuildUpdateBanner />
        <DndProvider backend={HTML5Backend}>
          <MantineProvider>
            <Switch>
              {renderRoutes.map((route) => {
                if (route.root) {
                  return (
                    <Route key={route.path} path={route.path}>
                      <AuthBoundary>
                        <Layout>
                          <PrivateRouteVisitTracker
                            routes={runtimeAccessibleRootChildren}
                          />
                          <Switch>
                            {Object.entries(keepAliveRouteGroups).map(
                              ([groupKey, groupRoutes]) => (
                                <Route
                                  key={groupKey}
                                  exact
                                  path={groupRoutes.map(
                                    (groupRoute) => groupRoute.path,
                                  )}
                                  render={() => (
                                    <KeepAliveRouteGroup
                                      routes={groupRoutes.map((groupRoute) => ({
                                        path: groupRoute.path,
                                        element: groupRoute.element,
                                        cache:
                                          groupRoute.keepAlive?.mode === "cache",
                                      }))}
                                    />
                                  )}
                                />
                              ),
                            )}
                            {defaultRootChildren.map((child) => {
                              return (
                                <Route
                                  key={child.path}
                                  exact
                                  path={child.path}
                                  render={() => child.element}
                                />
                              );
                            })}
                            <Route
                              render={() => (
                                <PrivateRouteFallback
                                  allRoutes={rootChildren}
                                  accessibleRoutes={
                                    runtimeAccessibleRootChildren
                                  }
                                />
                              )}
                            />
                          </Switch>
                        </Layout>
                      </AuthBoundary>
                    </Route>
                  );
                } else {
                  return (
                    <Route
                      key={route.path}
                      exact
                      path={route.path}
                      render={() => route.element}
                    />
                  );
                }
              })}
            </Switch>
          </MantineProvider>
        </DndProvider>
      </NotificationProvider>
    </ConfigProvider>
  );
}

export default App;
