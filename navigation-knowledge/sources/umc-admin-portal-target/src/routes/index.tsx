import React from "react";
import { useTranslation } from "react-i18next";
import { Button, Result, Spin } from "antd";
import { useLocation } from "react-router-dom";
import Layout from "../layout";
import AuthBoundary from "../components/AuthBoundary";

import DashboardIcon from "../assets/icons/Dashboard";
import License from "../assets/icons/License";
import Content from "../assets/icons/Content";
import Inspection from "../assets/icons/Inspection";
import Happiness from "../assets/icons/Happiness";
import ServiceManagement from "../assets/icons/ServiceManagement";
import FinancialPayment from "../assets/icons/FinancialPayment";
import SystemManagement from "../assets/icons/SystemManagement";
import Communications from "../assets/icons/Communications";
import { AZURE_AD_CALLBACK_PATH } from "@/pages/Login/auth";
import CMS from "@/assets/icons/CMS.tsx";
import type { KeepAliveRouteMeta } from "./keepAlive";
import type { InspectionRole } from "@/pages/InspectionCommon/access";
import type { CustomerAppealsRouteAccessMeta } from "@/pages/CustomerAppeals/access";
import {
  getBuildFingerprint,
  getRouteRecoveryPendingRemainingMs,
  lazyWithRetry,
  reloadOnceForStaleAsset,
} from "@/utils/lazyWithRetry";
import {
  classifyRouteFailure,
  getRouteFailureMessage,
  sanitizeDiagnosticRouteKey,
} from "@/utils/routeRecoveryPolicy";
import {
  INSPECTION_ADMIN_PORTAL_ROLES,
  INSPECTION_EXECUTION_ROLES,
  INSPECTION_MANAGER_ROLES,
  INSPECTION_TASK_ROLES,
  INSPECTION_VIOLATION_ROLES,
} from "@/pages/InspectionCommon/access";

export interface IRoute extends CustomerAppealsRouteAccessMeta {
  path: string;
  root?: boolean;
  redirect?: string;
  title: string;
  titleKey?: string;
  icon?: React.ReactNode;
  isMenu?: boolean;
  element: React.ReactNode;
  children?: IRoute[];
  page?: string;
  i18n?: string;
  keepAlive?: KeepAliveRouteMeta;
  preferRouteTitle?: boolean;
  allowedInspectionRoles?: readonly InspectionRole[];
  activeMenuPath?: string;
  permissionPath?: string;
  preload?: () => void;
}

type RouteConfigItem = CustomerAppealsRouteAccessMeta & {
  path?: string;
  title: string;
  titleKey?: string;
  isMenu?: boolean;
  icon?: React.ReactNode;
  lightIcon?: React.ReactNode;
  page?: string;
  children?: RouteConfigItem[];
  i18n?: string;
  keepAlive?: KeepAliveRouteMeta;
  preferRouteTitle?: boolean;
  allowedInspectionRoles?: readonly InspectionRole[];
  activeMenuPath?: string;
  permissionPath?: string;
};

type PageModule = {
  default: React.ComponentType;
};

const pages = import.meta.glob<PageModule>("../pages/*/index.tsx");

function resolvePageLoader(
  page: string | undefined,
): () => Promise<PageModule> {
  if (!page) {
    return () =>
      Promise.reject(
        new Error("[routes] Route is missing `page` for lazy loading."),
      );
  }

  const expected = `../pages/${page}/index.tsx`;
  const loader = pages[expected];
  if (typeof loader === "function") {
    return loader;
  }

  const normalizedExpected = expected.replace(/\\/g, "/").toLowerCase();
  const matchedKey = Object.keys(pages).find(
    (key) => key.replace(/\\/g, "/").toLowerCase() === normalizedExpected,
  );
  if (matchedKey && typeof pages[matchedKey] === "function") {
    return pages[matchedKey] as () => Promise<PageModule>;
  }

  return () =>
    Promise.reject(new Error(`[routes] Page module not found for "${page}"`));
}

const pageNames = Object.keys(pages)
  .map((path) => {
    const match = path.match(/\/pages\/([^/]+)\/index\.tsx$/i);
    return match ? match[1] : "";
  })
  .filter(Boolean);

type RouteErrorBoundaryProps = {
  children: React.ReactNode;
  resetKey: string;
};

type RouteErrorBoundaryWrapperProps = {
  children: React.ReactNode;
  routeKey: string;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
  error: unknown;
};

function RouteErrorResult({
  error,
  routeKey,
}: {
  error: unknown;
  routeKey: string;
}) {
  const { t } = useTranslation();
  const failureKind = classifyRouteFailure(error);
  // While a stale-asset recovery reload is committing, keep showing the
  // loading state instead of flashing the error page. If the reload never
  // lands, fall through to the error page once the pending window elapses.
  const [recoveryHoldMs] = React.useState(() =>
    failureKind === "stale-asset"
      ? getRouteRecoveryPendingRemainingMs(getRouteFailureMessage(error))
      : 0,
  );
  const [holdForRecovery, setHoldForRecovery] = React.useState(
    () => recoveryHoldMs > 0,
  );
  const [recoveryReloadInFlight, setRecoveryReloadInFlight] =
    React.useState(false);

  React.useEffect(() => {
    if (!holdForRecovery) {
      return undefined;
    }

    const timeoutId = window.setTimeout(
      () => setHoldForRecovery(false),
      recoveryHoldMs,
    );
    return () => window.clearTimeout(timeoutId);
  }, [holdForRecovery, recoveryHoldMs]);

  // Last-resort recovery before settling on the error page: React.lazy caches
  // a rejected loader forever, so navigating back to a once-failed route
  // rethrows the stale error without refetching. A cooldown-limited reload
  // here gives that route a real second chance once the cooldown has passed.
  React.useEffect(() => {
    if (failureKind !== "stale-asset" || holdForRecovery) {
      return;
    }

    if (reloadOnceForStaleAsset(getRouteFailureMessage(error))) {
      setRecoveryReloadInFlight(true);
    }
  }, [error, failureKind, holdForRecovery]);
  const isUnavailablePage = failureKind === "page-unavailable";
  const buildFingerprint =
    typeof document === "undefined"
      ? "server"
      : getBuildFingerprint().split("/").pop() || "unknown";
  const diagnosticId = `${failureKind}:${sanitizeDiagnosticRouteKey(routeKey)}:${buildFingerprint}`;
  // Render errors surface nothing in the Network tab and production users
  // cannot open the console, so keep a trimmed first line of the real error
  // next to the diagnostic id. Without it a `render-error` id is unactionable.
  const failureDetail =
    failureKind === "page-unavailable"
      ? ""
      : getRouteFailureMessage(error).split("\n")[0].trim().slice(0, 300);

  if (holdForRecovery || recoveryReloadInFlight) {
    return <RouteLoadingFallback />;
  }

  return (
    <div className="route-status">
      <div className="route-status__content">
        {isUnavailablePage ? (
          <Result
            status="404"
            title="404"
            subTitle={t("routeStatus.pageUnavailable")}
          />
        ) : (
          <Result
            status="500"
            title={
              failureKind === "stale-asset"
                ? t("routeStatus.assetErrorTitle")
                : t("routeStatus.renderErrorTitle")
            }
            subTitle={
              failureKind === "stale-asset"
                ? t("routeStatus.assetErrorDescription")
                : t("routeStatus.renderErrorDescription")
            }
            extra={
              <>
                <Button
                  type="primary"
                  className="route-status__action route-status__action--primary"
                  onClick={() => window.location.reload()}
                >
                  {t("routeStatus.refresh")}
                </Button>
                <Button
                  className="route-status__action route-status__action--secondary"
                  onClick={() => window.location.assign("/")}
                >
                  {t("routeStatus.returnToAuthorizedPage")}
                </Button>
              </>
            }
          />
        )}
        {!isUnavailablePage ? (
          <div className="route-status__diagnostic">
            {t("routeStatus.diagnosticId", { id: diagnosticId })}
            {failureDetail ? (
              <div className="route-status__diagnostic-detail">
                {failureDetail}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error("[routes] Failed to render route", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <RouteErrorResult
          error={this.state.error}
          routeKey={this.props.resetKey}
        />
      );
    }

    return this.props.children;
  }
}

function RouteLoadingFallback() {
  return (
    <div className="route-status route-status--loading">
      <Spin size="large" />
    </div>
  );
}

function RouteErrorBoundaryWrapper({
  children,
  routeKey,
}: RouteErrorBoundaryWrapperProps) {
  const location = useLocation();
  const resetKey = `${routeKey}:${location.pathname}${location.search}`;

  return (
    <RouteErrorBoundary resetKey={resetKey}>
      {children}
    </RouteErrorBoundary>
  );
}

function createLazyRoute(
  loader: () => Promise<PageModule>,
  routeKey: string,
) {
  const LazyPage = lazyWithRetry(loader);

  return {
    element: (
      <RouteErrorBoundaryWrapper routeKey={routeKey}>
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <LazyPage />
        </React.Suspense>
      </RouteErrorBoundaryWrapper>
    ),
    preload: () => {
      void loader().catch((error) => {
        console.warn("[routes] Failed to preload route", {
          routeKey,
          failureKind: classifyRouteFailure(error),
          message: getRouteFailureMessage(error),
        });
      });
    },
  };
}

function createLazyElement(loader: () => Promise<PageModule>, routeKey: string) {
  return createLazyRoute(loader, routeKey).element;
}

const menuRouteConfig: RouteConfigItem[] = [
  {
    path: "/dashboard",
    title: "Dashboard",
    titleKey: "menu.dashboard",
    isMenu: true,
    icon: <DashboardIcon />,
    page: "Dashboard",
    i18n: "menu.dashboard",
  },
  {
    path: "/licensing",
    title: "Licensing",
    titleKey: "menu.licensing",
    isMenu: true,
    icon: <License />,
    i18n: "menu.licensingManagement",
    children: [
      {
        path: "/licensing/applications",
        title: "Applications",
        page: "Applications",
        titleKey: "menu.applications",
        i18n: "menu.applications",
        keepAlive: {
          group: "licensing-applications",
          mode: "cache",
        },
        children: [
          {
            path: "/licensing/applications/applicationsDetails",
            title: "ApplicationDetails",
            page: "ApplicationsDetails",
            titleKey: "menu.applicationsDetails",
            i18n: "menu.applicationsDetails",
            activeMenuPath: "/licensing/applications",
            keepAlive: {
              group: "licensing-applications",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/licensing/profile",
        title: "Profile",
        page: "Profile",
        titleKey: "menu.profile",
        i18n: "menu.profile",
        keepAlive: {
          group: "licensing-profile",
          mode: "cache",
        },
        children: [
          {
            path: "/licensing/profile/profiledetails",
            title: "ProfileDetails",
            page: "ProfileDetails",
            titleKey: "menu.profileDetails",
            i18n: "menu.profileDetails",
            activeMenuPath: "/licensing/profile",
            keepAlive: {
              group: "licensing-profile",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/licensing/team-management",
        title: "TeamManagement",
        page: "TeamManagement",
        titleKey: "menu.teamManagement",
        i18n: "menu.teamManagement",
        keepAlive: {
          group: "licensing-team-management",
          mode: "cache",
        },
        children: [
          {
            path: "/licensing/team-management/applicationsDetails",
            title: "Applications Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "ApplicationsDetails",
            activeMenuPath: "/licensing/team-management",
            permissionPath: "/licensing/team-management",
            keepAlive: {
              group: "licensing-team-management",
              mode: "route",
            },
          },
          {
            path: "/licensing/team-management/profileDetails",
            title: "Profile Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "ProfileDetails",
            activeMenuPath: "/licensing/team-management",
            permissionPath: "/licensing/team-management",
            keepAlive: {
              group: "licensing-team-management",
              mode: "route",
            },
          },
          {
            path: "/licensing/team-management/ticketsDetails",
            title: "Tickets Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "TicketsDetails",
            activeMenuPath: "/licensing/team-management",
            permissionPath: "/licensing/team-management",
            keepAlive: {
              group: "licensing-team-management",
              mode: "route",
            },
          },
          {
            path: "/licensing/team-management/refundsDetails",
            title: "Refunds Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "CustomerRefundsDetails",
            activeMenuPath: "/licensing/team-management",
            permissionPath: "/licensing/team-management",
            keepAlive: {
              group: "licensing-team-management",
              mode: "route",
            },
          },
          {
            path: "/licensing/team-management/appealsDetails",
            title: "Appeals Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "CustomerAppealsDetails",
            activeMenuPath: "/licensing/team-management",
            permissionPath: "/licensing/team-management",
            keepAlive: {
              group: "licensing-team-management",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/licensing/licenses",
        title: "licenses",
        page: "Licenses",
        titleKey: "menu.licenses",
        i18n: "menu.licenses",
        keepAlive: {
          group: "licensing-licenses",
          mode: "cache",
        },
        children: [
          {
            path: "/licensing/license/LicenseDatails",
            title: "LicenseDatails",
            page: "LicenseDatails",
            titleKey: "menu.licenseDatails",
            i18n: "menu.licenseDatails",
            activeMenuPath: "/licensing/licenses",
            keepAlive: {
              group: "licensing-licenses",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/licensing/reports-analytics",
        title: "LicenseReportsAnalytics",
        page: "LicenseReportsAnalytics",
        titleKey: "menu.reportsAnalytics",
        i18n: "menu.reportsAnalytics",
      },
    ],
  },
  {
    path: "/content",
    title: "Content",
    titleKey: "menu.content",
    isMenu: true,
    icon: <Content />,
    i18n: "menu.contentManagement",
    children: [
      /*
      CARE Don't show it now
      {
        path: "/content/ContentDashboard",
        title: "Dashboard",
        page: "Dashboard",
        titleKey: "menu.contentDashboard",
        i18n: "menu.contentDashboard",
      }, 
      */
      {
        path: "/content/ContentApplications",
        title: "Applications",
        page: "ContentApplications",
        titleKey: "menu.contentApplications",
        i18n: "menu.contentApplications",
        keepAlive: {
          group: "content-applications",
          mode: "cache",
        },
        children: [
          {
            path: "/content/ContentApplications/ContentApplicationsDetails",
            title: "ApplicationsDetails",
            page: "ContentApplicationsDetails",
            titleKey: "menu.contentApplicationsDetails",
            i18n: "menu.contentApplicationsDetails",
            activeMenuPath: "/content/ContentApplications",
            keepAlive: {
              group: "content-applications",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/content/team-management",
        title: "TeamManagement",
        page: "TeamManagement",
        titleKey: "menu.teamManagement",
        i18n: "menu.teamManagement",
        keepAlive: {
          group: "content-team-management",
          mode: "cache",
        },
        children: [
          {
            path: "/content/team-management/applicationsDetails",
            title: "Applications Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "ContentApplicationsDetails",
            activeMenuPath: "/content/team-management",
            permissionPath: "/content/team-management",
            keepAlive: {
              group: "content-team-management",
              mode: "route",
            },
          },
          {
            path: "/content/team-management/ticketsDetails",
            title: "Tickets Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "TicketsDetails",
            activeMenuPath: "/content/team-management",
            permissionPath: "/content/team-management",
            keepAlive: {
              group: "content-team-management",
              mode: "route",
            },
          },
          {
            path: "/content/team-management/refundsDetails",
            title: "Refunds Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "CustomerRefundsDetails",
            activeMenuPath: "/content/team-management",
            permissionPath: "/content/team-management",
            keepAlive: {
              group: "content-team-management",
              mode: "route",
            },
          },
          {
            path: "/content/team-management/appealsDetails",
            title: "Appeals Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "CustomerAppealsDetails",
            activeMenuPath: "/content/team-management",
            permissionPath: "/content/team-management",
            keepAlive: {
              group: "content-team-management",
              mode: "route",
            },
          },
          {
            path: "/content/team-management/violationsDetails",
            title: "Violations Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "InspectionViolationDetails",
            activeMenuPath: "/content/team-management",
            permissionPath: "/content/team-management",
            keepAlive: {
              group: "content-team-management",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/content/ContentLibrary",
        title: "Content Library",
        page: "ContentLibrary",
        titleKey: "menu.contentLibrary",
        i18n: "menu.contentLibrary",
        keepAlive: {
          group: "content-library",
          mode: "cache",
        },
        children: [
          {
            path: "/content/ContentLibrary/Books",
            title: "Books",
            page: "Books",
            titleKey: "menu.books",
            i18n: "menu.books",
            activeMenuPath: "/content/ContentLibrary",
            keepAlive: {
              group: "content-library",
              mode: "route",
            },
          },
          {
            path: "/content/ContentLibrary/Newspapers",
            title: "NewsPapers",
            page: "Newspapers",
            titleKey: "menu.newspapers",
            i18n: "menu.newspapers",
            activeMenuPath: "/content/ContentLibrary",
            keepAlive: {
              group: "content-library",
              mode: "route",
            },
          },
          {
            path: "/content/ContentLibrary/Movies",
            title: "Movies",
            page: "Cinema",
            titleKey: "menu.cinema",
            i18n: "menu.cinema",
            activeMenuPath: "/content/ContentLibrary",
            keepAlive: {
              group: "content-library",
              mode: "route",
            },
          },
          {
            path: "/content/ContentLibrary/videoGames",
            title: "VideoGames",
            page: "VideoGames",
            titleKey: "menu.videoGames",
            i18n: "menu.videoGames",
            activeMenuPath: "/content/ContentLibrary",
            keepAlive: {
              group: "content-library",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/content/Permits",
        title: "Permits",
        page: "Permits",
        titleKey: "menu.permits",
        i18n: "menu.permits",
        keepAlive: {
          group: "content-permits",
          mode: "cache",
        },
        children: [
          {
            path: "/content/Permits/PermitsDetails",
            title: "PermitsDetails ",
            page: "PermitsDetails",
            titleKey: "menu.permitsDetails",
            i18n: "menu.permitsDetails",
            activeMenuPath: "/content/Permits",
            keepAlive: {
              group: "content-permits",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/content/reports-analytics",
        title: "ReportsAnalytics",
        page: "ContentReportsAnalytics",
        titleKey: "menu.contentReportsAnalytics",
        i18n: "menu.contentReportsAnalytics",
      },
    ],
  },
  {
    path: "/inspection",
    title: "Inspection",
    titleKey: "menu.inspection",
    isMenu: true,
    icon: <Inspection />,
    page: "Inspection",
    i18n: "menu.inspection",
    allowedInspectionRoles: INSPECTION_ADMIN_PORTAL_ROLES,
    children: [
      {
        path: "/inspection/tasks",
        title: "Task Management",
        titleKey: "menu.inspectionTasks",
        i18n: "menu.inspectionTasks",
        page: "InspectionTaskManagement",
        allowedInspectionRoles: INSPECTION_TASK_ROLES,
        keepAlive: {
          group: "inspection-tasks",
          mode: "cache",
        },
        children: [
          {
            path: "/inspection/tasks/detail",
            title: "Task Details",
            titleKey: "menu.inspectionTaskDetails",
            i18n: "menu.inspectionTaskDetails",
            page: "InspectionTaskDetails",
            isMenu: false,
            allowedInspectionRoles: INSPECTION_TASK_ROLES,
            activeMenuPath: "/inspection/tasks",
            keepAlive: {
              group: "inspection-tasks",
              mode: "route",
            },
          },
          {
            path: "/inspection/tasks/execution",
            title: "Task Execution",
            titleKey: "inspection.execution.inspectionInProgress",
            i18n: "inspection.execution.inspectionInProgress",
            page: "InspectionStartVisit",
            isMenu: false,
            allowedInspectionRoles: INSPECTION_EXECUTION_ROLES,
            activeMenuPath: "/inspection/tasks",
            keepAlive: {
              group: "inspection-tasks",
              mode: "route",
            },
          },
          {
            path: "/inspection/tasks/report",
            title: "Inspection Report",
            titleKey: "menu.inspectionTaskReport",
            i18n: "menu.inspectionTaskReport",
            page: "InspectionTaskReport",
            isMenu: false,
            allowedInspectionRoles: INSPECTION_TASK_ROLES,
            activeMenuPath: "/inspection/tasks",
            keepAlive: {
              group: "inspection-tasks",
              mode: "route",
            },
          },
          {
            path: "/inspection/tasks/violationsDetails",
            title: "Violation Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "InspectionViolationDetails",
            activeMenuPath: "/inspection/tasks",
            permissionPath: "/inspection/tasks",
            keepAlive: {
              group: "inspection-tasks",
              mode: "route",
            },
          },
          {
            path: "/inspection/tasks/appealsDetails",
            title: "Appeals Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "CustomerAppealsDetails",
            activeMenuPath: "/inspection/tasks",
            permissionPath: "/inspection/tasks",
            keepAlive: {
              group: "inspection-tasks",
              mode: "route",
            },
          },
          {
            path: "/inspection/tasks/refundsDetails",
            title: "Refunds Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "CustomerRefundsDetails",
            activeMenuPath: "/inspection/tasks",
            permissionPath: "/inspection/tasks",
            keepAlive: {
              group: "inspection-tasks",
              mode: "route",
            },
          },
          {
            path: "/inspection/tasks/ticketsDetails",
            title: "Tickets Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "TicketsDetails",
            activeMenuPath: "/inspection/tasks",
            permissionPath: "/inspection/tasks",
            keepAlive: {
              group: "inspection-tasks",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/inspection/violations",
        title: "Violation Management",
        titleKey: "menu.inspectionViolations",
        i18n: "menu.inspectionViolations",
        page: "InspectionViolations",
        allowedInspectionRoles: INSPECTION_VIOLATION_ROLES,
        keepAlive: {
          group: "inspection-violations",
          mode: "cache",
        },
        children: [
          {
            path: "/inspection/violations/detail",
            title: "Violation Details",
            titleKey: "menu.inspectionViolationDetails",
            i18n: "menu.inspectionViolationDetails",
            page: "InspectionViolationDetails",
            isMenu: false,
            allowedInspectionRoles: INSPECTION_VIOLATION_ROLES,
            activeMenuPath: "/inspection/violations",
            keepAlive: {
              group: "inspection-violations",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/inspection/reports-analytics",
        title: "Reports & Analytics",
        titleKey: "menu.inspectionReportsAnalytics",
        i18n: "menu.inspectionReportsAnalytics",
        page: "InspectionReportsAnalytics",
        allowedInspectionRoles: INSPECTION_MANAGER_ROLES,
      },
    ],
  },
  {
    path: "/happiness",
    title: "Customer Module",
    titleKey: "menu.Customer",
    isMenu: true,
    icon: <Happiness />,
    i18n: "menu.CustomerHappiness",
    children: [
      {
        path: "/happiness/tickets",
        title: "Tickets",
        page: "Tickets",
        titleKey: "menu.tickets",
        i18n: "menu.tickets",
        keepAlive: {
          group: "customer-tickets",
          mode: "cache",
        },
        children: [
          {
            path: "/happiness/tickets/tickets-details",
            title: "TicketsDetails ",
            page: "TicketsDetails",
            titleKey: "menu.ticketsDetails",
            i18n: "menu.ticketsDetails",
            activeMenuPath: "/happiness/tickets",
            keepAlive: {
              group: "customer-tickets",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/happiness/refunds",
        title: "Refunds",
        titleKey: "menu.refunds",
        i18n: "menu.refunds",
        page: "CustomerRefunds",
        keepAlive: {
          group: "customer-refunds",
          mode: "cache",
        },
        children: [
          {
            path: "/happiness/refunds/refundsDetails",
            title: "Refunds Details",
            titleKey: "menu.refundsDetails",
            i18n: "menu.refundsDetails",
            page: "CustomerRefundsDetails",
            activeMenuPath: "/happiness/refunds",
            keepAlive: {
              group: "customer-refunds",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/happiness/appeals",
        title: "Appeals",
        titleKey: "menu.appeals",
        i18n: "menu.appeals",
        page: "CustomerAppeals",
        requiresCustomerAppealsAccess: true,
        keepAlive: {
          group: "customer-appeals",
          mode: "cache",
        },
        children: [
          {
            path: "/happiness/appeals/appealsDetails",
            title: "Appeals Details",
            titleKey: "menu.appealsDetails",
            i18n: "menu.appealsDetails",
            page: "CustomerAppealsDetails",
            requiresCustomerAppealsAccess: true,
            activeMenuPath: "/happiness/appeals",
            keepAlive: {
              group: "customer-appeals",
              mode: "route",
            },
          },
          {
            path: "/happiness/appeals/violationDetails",
            title: "Violation Details",
            titleKey: "menu.inspectionViolationDetails",
            i18n: "menu.inspectionViolationDetails",
            page: "InspectionViolationDetails",
            requiresCustomerAppealsAccess: true,
            allowedInspectionRoles: INSPECTION_VIOLATION_ROLES,
            activeMenuPath: "/happiness/appeals",
            permissionPath: "/inspection/violations/detail",
            keepAlive: {
              group: "customer-appeals",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/happiness/team-management",
        title: "TeamManagement",
        page: "TeamManagement",
        titleKey: "menu.teamManagement",
        i18n: "menu.teamManagement",
        keepAlive: {
          group: "customer-team-management",
          mode: "cache",
        },
        children: [
          {
            path: "/happiness/team-management/ticketsDetails",
            title: "Tickets Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "TicketsDetails",
            activeMenuPath: "/happiness/team-management",
            permissionPath: "/happiness/team-management",
            keepAlive: {
              group: "customer-team-management",
              mode: "route",
            },
          },
          {
            path: "/happiness/team-management/refundsDetails",
            title: "Refunds Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "CustomerRefundsDetails",
            activeMenuPath: "/happiness/team-management",
            permissionPath: "/happiness/team-management",
            keepAlive: {
              group: "customer-team-management",
              mode: "route",
            },
          },
          {
            path: "/happiness/team-management/appealsDetails",
            title: "Appeals Details",
            titleKey: "menu.taskDetails",
            i18n: "menu.taskDetails",
            page: "CustomerAppealsDetails",
            activeMenuPath: "/happiness/team-management",
            permissionPath: "/happiness/team-management",
            keepAlive: {
              group: "customer-team-management",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/happiness/customerManagement",
        title: "Customer Management",
        page: "CustomerManagement",
        titleKey: "menu.customerManagement",
        i18n: "menu.customerManagement",
        keepAlive: {
          group: "customer-management",
          mode: "cache",
        },
        children: [
          {
            path: "/happiness/customerManagement/customer-details",
            title: "Customer Details",
            page: "CustomerDetails",
            titleKey: "menu.customerDetails",
            i18n: "menu.customerDetails",
            activeMenuPath: "/happiness/customerManagement",
            keepAlive: {
              group: "customer-management",
              mode: "route",
            },
          },
          {
            path: "/happiness/customerManagement/customerProfileDetail",
            title: "Profile Detail",
            page: "CustomerProfileDetail",
            titleKey: "menu.customerProfileDetail",
            i18n: "menu.customerProfileDetail",
            activeMenuPath: "/happiness/customerManagement",
            keepAlive: {
              group: "customer-management",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/happiness/reports-analytics",
        title: "CustomerReportsAnalytics",
        page: "CustomerReportsAnalytics",
        titleKey: "menu.customerReportsAnalytics",
        i18n: "menu.customerReportsAnalytics",
        isMenu: true,
      },
    ],
  },
  // {
  //   path: "/customers",
  //   title: "",
  //   titleKey: "menu.customers",
  //   isMenu: true,
  //   icon: <Customers />,
  //   page: "Customers",
  //   i18n: "menu.customer",

  //   // path: "/happiness",
  //   // title: "Happiness",
  //   // titleKey: "menu.happiness",
  //   // isMenu: true,
  //   // icon: <Happiness />,
  //   // page: "Happiness",
  //   // i18n: "menu.happiness",

  //   children: [],
  // },
  // {
  //   path: "/test",
  //   title: "Test",
  //   titleKey: "menu.customers",
  //   isMenu: true,
  //   icon: <Customers />,
  //   page: "ContentView",
  //   i18n: "menu.customers",
  // },
  {
    path: "/service-management",
    title: "Service",
    titleKey: "menu.serviceManagement",
    isMenu: true,
    icon: <ServiceManagement />,
    page: "ServiceManagement",
    i18n: "menu.serviceManagement",
    children: [
      /*
        CARE Don't show it now
        MyDashboard renders only hard-coded demo data and calls no API, so it is
        hidden from the menu and from the route table on purpose. The page code
        under src/pages/MyDashboard stays untouched; re-enable by uncommenting
        this entry AND removing "MyDashboard" from `excludedAutoRoutePages`.
      {
        path: "/service-management/mydashboard",
        title: "Dashboard",
        page: "MyDashboard",
        titleKey: "menu.myDashboard",
        i18n: "menu.myDashboard",
      },
      */
      {
        path: "/service-management/service-categories",
        title: "Service Categories",
        page: "ServiceCategories",
        titleKey: "menu.serviceCategories",
        i18n: "menu.serviceCategories",
      },
      {
        path: "/service-management/service-configuration",
        title: "Service Configuration",
        page: "ServiceConfiguration",
        titleKey: "menu.serviceConfiguration",
        i18n: "menu.serviceConfiguration",
        keepAlive: {
          group: "service-configuration",
          mode: "cache",
        },
        children: [
          {
            path: "/service-management/service-configuration/addnewservice",
            title: "Add New Service",
            page: "AddNewService",
            titleKey: "menu.addNewService",
            i18n: "menu.addNewService",
            activeMenuPath: "/service-management/service-configuration",
            keepAlive: {
              group: "service-configuration",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/service-management/reports-analytics",
        title: "Reports & Analytics",
        page: "ServiceReportsAnalytics",
        titleKey: "menu.reportsAnalytics",
        i18n: "menu.reportsAnalytics",
      },
    ],
  },
  {
    path: "/financial-payment",
    title: "Finance",
    titleKey: "menu.financialPayment",
    isMenu: true,
    icon: <FinancialPayment />,
    page: "FinancialPayment",
    i18n: "menu.financialPayment",
    children: [
      {
        path: "/financial-payment/transactions",
        title: "Transactions",
        page: "Transactions",
        titleKey: "menu.transactions",
        i18n: "menu.transactions",
        keepAlive: {
          group: "finance-transactions",
          mode: "cache",
        },
        children: [
          {
            path: "/financial-payment/transactions/transactions-detail",
            title: "Transactions Detail",
            page: "TransactionsDetail",
            titleKey: "menu.transactionsDetail",
            i18n: "menu.transactionsDetail",
            activeMenuPath: "/financial-payment/transactions",
            keepAlive: {
              group: "finance-transactions",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/financial-payment/refunds",
        title: "refunds",
        titleKey: "menu.refunds",
        i18n: "menu.refunds",
        page: "FinancialRefunds",
        keepAlive: {
          group: "finance-refunds",
          mode: "cache",
        },
        children: [
          {
            path: "/financial-payment/refunds/refundsDetails",
            title: "Refunds Details",
            titleKey: "menu.refundsDetails",
            i18n: "menu.refundsDetails",
            page: "FinancialRefundsDetails",
            activeMenuPath: "/financial-payment/refunds",
            keepAlive: {
              group: "finance-refunds",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/financial-payment/reports-analytics",
        title: "Reports & Analytics",
        page: "FinanceReportsAnalytics",
        titleKey: "menu.reportsAnalytics",
        i18n: "menu.reportsAnalytics",
      },
    ],
  },
  {
    path: "/cms",
    title: "CMS",
    titleKey: "menu.cms",
    isMenu: true,
    icon: <CMS />,
    i18n: "menu.cms",
    children: [
      {
        path: "/cms/pageManagement",
        title: "Pages",
        titleKey: "menu.pageManagement",
        page: "PageManagement",
        i18n: "menu.pageManagement",
        keepAlive: {
          group: "cms-pages",
          mode: "cache",
        },
        children: [
          {
            path: "/cms/pageManagement/PageManagementHome",
            title: "Homepage",
            page: "PageManagementHome",
            titleKey: "menu.pageManagementHome",
            i18n: "menu.pageManagementHome",
            activeMenuPath: "/cms/pageManagement",
            keepAlive: {
              group: "cms-pages",
              mode: "route",
            },
          },
          {
            path: "/cms/pageManagement/PageManagementAbout",
            title: "About NMA",
            page: "PageManagementAbout",
            titleKey: "menu.pageManagementAbout",
            i18n: "menu.pageManagementAbout",
            activeMenuPath: "/cms/pageManagement",
            keepAlive: {
              group: "cms-pages",
              mode: "route",
            },
          },
          {
            path: "/cms/pageManagement/PageManagementLeadership",
            title: "Leadership",
            page: "PageManagementLeadership",
            titleKey: "menu.pageManagementLeadership",
            i18n: "menu.pageManagementLeadership",
            activeMenuPath: "/cms/pageManagement",
            keepAlive: {
              group: "cms-pages",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/cms/NewsManagement",
        title: "News",
        page: "NewsManagement",
        titleKey: "menu.newsManagement",
        i18n: "menu.newsManagement",
        keepAlive: {
          group: "cms-news",
          mode: "cache",
        },
        children: [
          {
            path: "/cms/NewsManagement/AddNewsManagement",
            title: "addNewsManagement",
            page: "AddNewsManagement",
            titleKey: "menu.addNewsManagement",
            i18n: "menu.addNewsManagement",
            activeMenuPath: "/cms/NewsManagement",
            keepAlive: {
              group: "cms-news",
              mode: "route",
            },
          },
          {
            path: "/cms/NewsManagement/NewsManagementDetail",
            title: "newsManagementDetail",
            page: "NewsManagementDetail",
            titleKey: "menu.newsManagementDetail",
            i18n: "menu.newsManagementDetail",
            activeMenuPath: "/cms/NewsManagement",
            keepAlive: {
              group: "cms-news",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/cms/EventManagement",
        title: "Event",
        page: "EventManagement",
        titleKey: "menu.eventManagement",
        i18n: "menu.eventManagement",
        keepAlive: {
          group: "cms-events",
          mode: "cache",
        },
        children: [
          {
            path: "/cms/EventManagement/AddEventManagement",
            title: "addEventManagement",
            page: "AddEventManagement",
            titleKey: "menu.addEventManagement",
            i18n: "menu.addEventManagement",
            activeMenuPath: "/cms/EventManagement",
            keepAlive: {
              group: "cms-events",
              mode: "route",
            },
          },
          {
            path: "/cms/EventManagement/EventManagementDetail",
            title: "newsManagementDetail",
            page: "EventManagementDetail",
            titleKey: "menu.eventManagementDetail",
            i18n: "menu.eventManagementDetail",
            activeMenuPath: "/cms/EventManagement",
            keepAlive: {
              group: "cms-events",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/cms/JobOpeningsManagement",
        title: "Job Openings",
        page: "JobOpeningsManagement",
        titleKey: "menu.jobOpeningsManagement",
        i18n: "menu.jobOpeningsManagement",
        keepAlive: {
          group: "cms-job-openings",
          mode: "cache",
        },
        children: [
          {
            path: "/cms/JobOpeningsManagement/addJobOpeningsManagement",
            title: "addJobOpeningsManagement",
            page: "AddJobOpeningsManagement",
            titleKey: "menu.addJobOpeningsManagement",
            i18n: "menu.addJobOpeningsManagement",
            activeMenuPath: "/cms/JobOpeningsManagement",
            keepAlive: {
              group: "cms-job-openings",
              mode: "route",
            },
          },
          {
            path: "/cms/JobOpeningsManagement/JobOpeningsManagementDetail",
            title: "JobOpeningsManagementDetail",
            page: "JobOpeningsManagementDetail",
            titleKey: "menu.jobOpeningsManagementDetail",
            i18n: "menu.jobOpeningsManagementDetail",
            activeMenuPath: "/cms/JobOpeningsManagement",
            keepAlive: {
              group: "cms-job-openings",
              mode: "route",
            },
          },
        ],
      },
    ],
  },
  {
    path: "/communications",
    title: "Communications",
    titleKey: "menu.communications",
    isMenu: true,
    icon: <Communications />,
    page: "Communications",
    i18n: "menu.communications",
    children: [
      {
        path: "/communications/message-templates",
        title: "Message Templates",
        page: "MessageTemplates",
        titleKey: "menu.messageTemplates",
        i18n: "menu.messageTemplates",
        keepAlive: {
          group: "communications-message-templates",
          mode: "cache",
        },
        children: [
          {
            path: "/communications/message-templates/EditTemplate",
            title: "Template Details",
            page: "EditTemplate",
            titleKey: "menu.messageTemplatesDetails",
            i18n: "menu.messageTemplatesDetails",
            activeMenuPath: "/communications/message-templates",
            keepAlive: {
              group: "communications-message-templates",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/communications/broadcast",
        title: "Broadcast",
        page: "Broadcast",
        titleKey: "menu.broadcast",
        i18n: "menu.broadcast",
        keepAlive: {
          group: "communications-broadcast",
          mode: "cache",
        },
        children: [
          {
            path: "/communications/broadcastView",
            title: "Broadcast",
            page: "BroadcastView",
            titleKey: "menu.broadcastView",
            i18n: "menu.broadcastView",
            activeMenuPath: "/communications/broadcast",
            keepAlive: {
              group: "communications-broadcast",
              mode: "route",
            },
          },
          {
            path: "/communications/broadcastEdit",
            title: "Broadcast",
            page: "BroadcastEdit",
            titleKey: "menu.broadcastEdit",
            i18n: "menu.broadcastEdit",
            activeMenuPath: "/communications/broadcast",
            keepAlive: {
              group: "communications-broadcast",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/communications/message-log",
        title: "Message Log",
        titleKey: "menu.messageLog",
        page: "MessageLog",
        i18n: "menu.messageLog",
        keepAlive: {
          group: "communications-message-log",
          mode: "cache",
        },
        children: [
          {
            path: "/communications/message-log/message-details",
            title: "Message Details",
            titleKey: "menu.messageDetails",
            page: "MessageLogDetail",
            i18n: "menu.messageDetails",
            activeMenuPath: "/communications/message-log",
            keepAlive: {
              group: "communications-message-log",
              mode: "route",
            },
          },
        ],
      },
    ],
  },
  {
    path: "/system-management",
    title: "Settings",
    titleKey: "menu.systemManagement",
    isMenu: true,
    icon: <SystemManagement />,
    page: "SystemManagement",
    i18n: "menu.systemManagement",
    children: [
      {
        path: "/system-management/userManagement",
        title: "User",
        page: "UserManagement",
        titleKey: "menu.userManagement",
        i18n: "menu.userManagement",
      },
      {
        path: "/system-management/roleManagement",
        title: "Roles",
        page: "RoleManagement",
        titleKey: "menu.roleManagement",
        i18n: "menu.roleManagement",
        keepAlive: {
          group: "system-roles",
          mode: "cache",
        },
        children: [
          {
            path: "/system-management/roleManagement/roledetails",
            title: "Role Details",
            page: "RoleDetails",
            titleKey: "menu.roleDetails",
            i18n: "menu.roleDetails",
            activeMenuPath: "/system-management/roleManagement",
            keepAlive: {
              group: "system-roles",
              mode: "route",
            },
          },
        ],
      },
      {
        path: "/system-management/adminPortalLogs",
        title: "logs",
        titleKey: "menu.adminPortalLogs",
        i18n: "menu.adminPortalLogs",
        page: "AdminPortalLogs",
        children: [
          {
            path: "/system-management/adminPortalLogs/adminPortalLogsDetail",
            title: "adminPortalLogsDetail",
            page: "AdminPortalLogsDetail",
            titleKey: "menu.adminPortalLogsDetail",
            i18n: "menu.adminPortalLogsDetail",
            activeMenuPath: "/system-management/adminPortalLogs",
          },
        ],
      },
    ],
  },

  // {
  //   path: "/AImonitor",
  //   title: "AImonitor",
  //   titleKey: "menu.AImonitor",
  //   isMenu: true,
  //   icon: <SystemManagement />,
  //   page: "AImonitor",
  //   i18n: "menu.AImonitor",
  // },
  {
    path: "/personal-center",
    title: "Personal Center",
    titleKey: "menu.personalCenter",
    isMenu: false,
    i18n: "menu.personalCenter",
    page: "PersonalCenter",
  },
];

function generateAllRoutes() {
  const routes = [...menuRouteConfig];
  const routePaths = new Set(
    routes.map((route) => route.path).filter(Boolean) as string[],
  );
  /*
    Pages listed here never get an auto-generated fallback route. "MyDashboard"
    must stay listed while it is hidden: its page directory still exists, so the
    fallback below would otherwise expose it again at /mydashboard.
  */
  const excludedAutoRoutePages = new Set([
    "ReportsAnalytics",
    "FormilyTest",
    "MyDashboard",
  ]);
  const normalizeRouteKey = (value?: string) =>
    value?.toLowerCase().replace(/-/g, "") ?? "";

  const appendRoute = (route: RouteConfigItem) => {
    if (!route.path || routePaths.has(route.path)) {
      return;
    }

    routePaths.add(route.path);
    routes.push(route);
  };

  const createFlattenedRoute = (route: RouteConfigItem): RouteConfigItem => {
    const flattenedRoute = { ...route };
    delete flattenedRoute.children;

    return {
      ...flattenedRoute,
      isMenu: false,
    };
  };

  const appendConfiguredNestedRoutes = (items: RouteConfigItem[]) => {
    items.forEach((item) => {
      if (item.path && item.page) {
        appendRoute(createFlattenedRoute(item));
      }

      if (item.children?.length) {
        appendConfiguredNestedRoutes(item.children);
      }
    });
  };

  menuRouteConfig.forEach((route) => {
    if (route.children?.length) {
      appendConfiguredNestedRoutes(route.children);
    }
  });

  const collectMatchingChildren = (
    items: RouteConfigItem[],
    pageName: string,
  ): {
    pageExact: RouteConfigItem[];
    segmentExact: RouteConfigItem[];
    fuzzy: RouteConfigItem[];
  } => {
    const normalizedPageName = normalizeRouteKey(pageName);
    let pageExact: RouteConfigItem[] = [];
    let segmentExact: RouteConfigItem[] = [];
    let fuzzy: RouteConfigItem[] = [];

    items.forEach((item) => {
      const normalizedItemPage = normalizeRouteKey(item.page);
      const normalizedItemPath = normalizeRouteKey(item.path);
      const normalizedLastSegment = normalizeRouteKey(
        item.path?.split("/").pop(),
      );

      if (normalizedItemPage === normalizedPageName) {
        pageExact.push(item);
      } else if (normalizedLastSegment === normalizedPageName) {
        segmentExact.push(item);
      } else if (
        normalizedItemPath &&
        normalizedItemPath.includes(normalizedPageName)
      ) {
        fuzzy.push(item);
      }

      if (item.children) {
        const childMatches = collectMatchingChildren(item.children, pageName);
        pageExact = pageExact.concat(childMatches.pageExact);
        segmentExact = segmentExact.concat(childMatches.segmentExact);
        fuzzy = fuzzy.concat(childMatches.fuzzy);
      }
    });

    return { pageExact, segmentExact, fuzzy };
  };

  const findMatchingChildren = (
    items: RouteConfigItem[],
    pageName: string,
  ): RouteConfigItem[] => {
    const { pageExact, segmentExact, fuzzy } = collectMatchingChildren(
      items,
      pageName,
    );
    if (pageExact.length > 0) {
      return pageExact;
    }
    if (segmentExact.length > 0) {
      return segmentExact;
    }
    return fuzzy;
  };
  pageNames.forEach((pageName) => {
    if (excludedAutoRoutePages.has(pageName)) {
      return;
    }

    const existingRoute = routes.find(
      (route) => route.page?.toLowerCase() === pageName.toLowerCase(),
    );

    if (!existingRoute) {
      let found = false;
      for (const menuRouteItem of menuRouteConfig) {
        const targets = findMatchingChildren([menuRouteItem], pageName);
        if (targets.length > 0) {
          appendRoute({
            path: targets[0].path!,
            title: pageName,
            isMenu: false,
            page: pageName,
            icon: <SystemManagement />,
            keepAlive: targets[0].keepAlive,
            preferRouteTitle: targets[0].preferRouteTitle,
            allowedInspectionRoles: targets[0].allowedInspectionRoles,
            requiresCustomerAppealsAccess:
              targets[0].requiresCustomerAppealsAccess,
            titleKey: `menu.${
              pageName.charAt(0).toLowerCase() + pageName.slice(1)
            }`,
            i18n: `menu.${
              pageName.charAt(0).toLowerCase() + pageName.slice(1)
            }`,
          });
          found = true;
          break;
        }
      }

      if (!found) {
        appendRoute({
          path: `/${pageName.toLowerCase()}`,
          title: pageName,
          isMenu: false,
          page: pageName,
          icon: <SystemManagement />,
          titleKey: `menu.${
            pageName.charAt(0).toLowerCase() + pageName.slice(1)
          }`,
          i18n: `menu.${pageName.charAt(0).toLowerCase() + pageName.slice(1)}`,
        });
      }
    }
  });

  return routes;
}

function createRoutes() {
  const allRoutes = generateAllRoutes();

  const rootRoute = {
    path: "/",
    root: true,
    redirect: "/licensing/licenses",
    element: (
      <AuthBoundary>
        <Layout />
      </AuthBoundary>
    ),
    children: allRoutes.map((route) => {
      if (!route.page) {
        return { ...route, element: null };
      }

      const lazyRoute = createLazyRoute(
        resolvePageLoader(route.page),
        route.path || route.page,
      );
      return { ...route, ...lazyRoute };
    }),
  };

  const publicRoutes = [
    {
      path: "/login",
      title: "Login",
      isMenu: false,
      page: "Login",
      element: createLazyElement(() => import("../pages/Login"), "/login"),
    },
    {
      path: AZURE_AD_CALLBACK_PATH,
      title: "Microsoft Callback",
      isMenu: false,
      element: createLazyElement(
        () => import("../pages/Login/MicrosoftCallback"),
        AZURE_AD_CALLBACK_PATH,
      ),
    },
    {
      // Standalone new-window homepage preview (PRD): draft data comes from
      // sessionStorage, so it renders without the admin layout shell.
      path: "/cms/pageManagement/PageManagementHome/preview",
      title: "Homepage Preview",
      isMenu: false,
      element: createLazyElement(
        () => import("../pages/PageManagementHome/Preview/index.tsx"),
        "/cms/pageManagement/PageManagementHome/preview",
      ),
    },
    {
      path: "/cms/pageManagement/PageManagementAbout/preview",
      title: "About NMA Preview",
      isMenu: false,
      element: createLazyElement(
        () => import("../pages/PageManagementAbout/Preview/index.tsx"),
        "/cms/pageManagement/PageManagementAbout/preview",
      ),
    },
    {
      path: "/cms/pageManagement/PageManagementLeadership/preview",
      title: "Leadership Preview",
      isMenu: false,
      element: createLazyElement(
        () => import("../pages/PageManagementLeadership/Preview/index.tsx"),
        "/cms/pageManagement/PageManagementLeadership/preview",
      ),
    },
    {
      path: "/verification",
      title: "Verification",
      isMenu: false,
      element: createLazyElement(
        () => import("../pages/Verification/index.tsx"),
        "/verification",
      ),
    },
    {
      path: "/forgot-password",
      title: "Forgot Password",
      isMenu: false,
      page: "ForgotPassword",
      element: createLazyElement(
        () => import("../pages/ForgotPassword/index.tsx"),
        "/forgot-password",
      ),
    },
    {
      path: "/new-password",
      title: "New Password",
      isMenu: false,
      element: createLazyElement(
        () => import("../pages/NewPassword/index.tsx"),
        "/new-password",
      ),
    },
    {
      path: "/pwd-reset-success",
      title: "Password Reset Successful",
      isMenu: false,
      element: createLazyElement(
        () => import("../pages/PwdResetSuccess/index.tsx"),
        "/pwd-reset-success",
      ),
    },
    {
      path: "/change-password",
      title: "Change Password",
      isMenu: false,
      page: "ChangePassword",
      element: createLazyElement(
        () =>
          import("../pages/ChangePassword/index.tsx") as Promise<PageModule>,
        "/change-password",
      ),
    },
  ];
  return [...publicRoutes, rootRoute];
}

const AppRoutes = createRoutes();

export default AppRoutes as IRoute[];
