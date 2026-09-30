import Sider from "./Sider";
import Header from "./Header";
import { resolveHeaderPresentation } from "./headerPresentation";
import "./index.css";
// Breakpoint overrides for the layout tokens and the sidebar rail. Must follow
// ./index.css: equal specificity, so source order decides which wins.
import "@/styles/rwd/layout-breakpoints.css";
import "@/styles/rwd/sider.css";
import "@/styles/rwd/header.css";
import "@/styles/rwd/table.css";
import "@/styles/rwd/filter-toolbar.css";
import "@/styles/rwd/filter-modal.css";
import "@/styles/rwd/pagination.css";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SimpleBar from "@/components/SimpleBar";
import AIChatBot from "@/components/AIChatBot";
import { aiChatbotEnabled } from "@/components/AIChatBot/featureFlag";
import {
  PAGE_CONTENT_SCROLL_REQUEST_EVENT,
  PAGE_CONTENT_SCROLL_TO_TOP_EVENT,
  recordPageContentScrollTop,
} from "./pageContentScroll";
import AppRoutes from "../routes";
import {
  isWideScreenCenteredMode,
  isWideScreenFluidMode,
} from "@/config/layoutWideScreenMode";
import type { IRoute } from "@/routes";
import {
  flattenRoutes,
  useAccessibleProtectedRoutes,
} from "@/routes/access";
import { filterRuntimeAccessibleRoutes } from "@/routes/runtimeAccess";
import { useInspectionAccess } from "@/pages/InspectionCommon/access";
import { useCustomerAppealsAccess } from "@/pages/CustomerAppeals/access";

export default function Layout({ children }: React.PropsWithChildren<object>) {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const layoutScrollRef = useRef<HTMLElement | null>(null);
  const pageScrollRef = useRef<HTMLElement | null>(null);
  const pathSegments = location.pathname?.split("/").filter((part) => part) || [];
  const moduleSegment = pathSegments[0] || "";
  const rootChildren = AppRoutes.find((route) => route.root)?.children || [];
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
    ],
  );
  const appMenuRoutes =
    runtimeAccessibleRootChildren.filter((route) => route.isMenu) || [];

  const currentPath = pathSegments[pathSegments.length - 1] || "";

  const moduleRoute = appMenuRoutes.find((route) => {
    const routeSegment = route.path?.split("/").filter(Boolean)[0];
    return routeSegment === moduleSegment;
  });

  const routeItems = flattenRoutes(runtimeAccessibleRootChildren as IRoute[]);
  const normalizedCurrentPath = currentPath.toLowerCase().replace(/-/g, "");
  const exactPathRoute = routeItems.find((item) => item.path === location.pathname);
  const translationKey = exactPathRoute || routeItems.find((item) => {
    return (
      item.page?.toLowerCase().replace(/-/g, "") === normalizedCurrentPath ||
      (item.path && item.path.split("/").pop() === currentPath)
    );
  });

  const params = new URLSearchParams(location.search);
  const pageTitleKey = params.get("pageTitleKey");
  const pageTitle = pageTitleKey && !translationKey?.preferRouteTitle
    ? t(`${pageTitleKey}`)
    : translationKey && translationKey.i18n
    ? t(translationKey.i18n)
    : currentPath;
  const headerPresentation = resolveHeaderPresentation({
    pathname: location.pathname,
    params,
    pageTitle,
    moduleI18nKey: moduleRoute?.i18n,
    t,
  });
  const layoutClassName = isWideScreenCenteredMode
    ? "layout layout--wide-screen-centered"
    : isWideScreenFluidMode
    ? "layout layout--wide-screen-fluid"
    : "layout";
  // Use i18next's resolved direction instead of checking a language prefix so any RTL locale is covered.
  const isRtlLayout = i18n.dir() === "rtl";

  const scrollPageContentToTop = useCallback(() => {
    recordPageContentScrollTop(0);
    pageScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const handlePageContentScrollRequest = useCallback((event: Event) => {
    const scrollEvent = event as CustomEvent<{ top?: number }>;
    const top = scrollEvent.detail?.top;

    if (typeof top !== "number" || !Number.isFinite(top) || top < 0) {
      return;
    }

    recordPageContentScrollTop(top);
    pageScrollRef.current?.scrollTo({ top, left: 0, behavior: "auto" });
  }, []);

  // Route navigation resets the shared Layout-level scroll container, not any page-local wrapper.
  useEffect(() => {
    layoutScrollRef.current?.scrollTo({ left: 0, behavior: "auto" });
    scrollPageContentToTop();
  }, [location.pathname, location.search, scrollPageContentToTop]);

  /*
    Some pages need to reset scroll after data-level view changes without
    knowing how Layout renders SimpleBar internally. A window event keeps that
    dependency one-way: pages can request a reset, Layout still owns the node.
  */
  useEffect(() => {
    window.addEventListener(
      PAGE_CONTENT_SCROLL_TO_TOP_EVENT,
      scrollPageContentToTop
    );
    window.addEventListener(
      PAGE_CONTENT_SCROLL_REQUEST_EVENT,
      handlePageContentScrollRequest,
    );

    return () => {
      window.removeEventListener(
        PAGE_CONTENT_SCROLL_TO_TOP_EVENT,
        scrollPageContentToTop
      );
      window.removeEventListener(
        PAGE_CONTENT_SCROLL_REQUEST_EVENT,
        handlePageContentScrollRequest,
      );
    };
  }, [handlePageContentScrollRequest, scrollPageContentToTop]);

  return (
    <div className={layoutClassName}>
      <Sider />
      <div className="layout-content">
        <SimpleBar
          className="layout-content-scroll"
          // Keep both scrollbar directions aligned with the active document direction.
          dir={isRtlLayout ? "rtl" : "ltr"}
          data-simplebar-direction={isRtlLayout ? "rtl" : "ltr"}
          scrollableNodeProps={{
            ref: layoutScrollRef,
            className: "layout-content-scroll-node",
          }}
        >
          <div className="layout-content-canvas">
            <div className="layout-content__inner">
              <Header
                pageTitle={headerPresentation.pageTitle}
                breadcrumbItems={headerPresentation.breadcrumbItems}
                hideAutoBreadcrumb={headerPresentation.hideAutoBreadcrumb}
                reserveTitleExtraHeight={location.pathname === "/dashboard"}
              />
            </div>
            <SimpleBar
              className="page-content"
              dir={isRtlLayout ? "rtl" : "ltr"}
              data-simplebar-direction={isRtlLayout ? "rtl" : "ltr"}
              scrollableNodeProps={{
                // This ref points at the vertical page scroll node used by scrollTo().
                ref: pageScrollRef,
                className: "page-content-scroll",
                onScroll: (event: React.UIEvent<HTMLElement>) => {
                  recordPageContentScrollTop(event.currentTarget.scrollTop);
                },
              }}
            >
              <div className="page-content__inner">{children}</div>
            </SimpleBar>
          </div>
        </SimpleBar>
      </div>
      {aiChatbotEnabled === "true" ? <AIChatBot /> : null}
    </div>
  );
}
