import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "../assets/images/logo.svg";
import Handler from "../assets/icons/Handler";
import routes from "../routes";
import { Popover } from "antd";
import GoldHook from "@/assets/images/GoldHook.png";
import { usePointerHasHover } from "@/hooks/usePointerHasHover";
import {
  isInspectionPath,
  useInspectionAccess,
  type InspectionAccessState,
} from "@/pages/InspectionCommon/access";
import {
  isCustomerAppealsRouteProtected,
  useCustomerAppealsAccess,
  type CustomerAppealsAccessState,
  type CustomerAppealsRouteAccessMeta,
} from "@/pages/CustomerAppeals/access";
import {
  flattenRoutes,
  normalizeRoutePath,
  useAccessibleProtectedRoutes,
} from "@/routes/access";
import { filterRuntimeAccessibleRoutes } from "@/routes/runtimeAccess";
import type { IRoute } from "@/routes";

/*
  Sidebar labels must wrap when they don't fit on one line.

  Multi-word labels (e.g. "Customer Happiness") have a natural break point — the
  space between words — so we leave them untouched and let normal word-wrapping
  break them there, with NO hyphen.

  A single long word (e.g. "Dashboard") has no space to break at. CSS
  `hyphens: auto` relies on the browser's hyphenation dictionary, which is absent
  in several of our target environments, so it silently never inserts a "-".
  Instead we seed such a word with soft hyphens (U+00AD): invisible when it fits
  on one line, rendered as "-" wherever the browser chooses to break. The raw
  label is still used for title/aria-label.
*/
const SOFT_HYPHEN = "\u00AD";
const MIN_WORD_LEN_TO_HYPHENATE = 8;

const softHyphenate = (text: string): string => {
  // Labels with a space wrap at that space; never inject hyphens into them.
  if (/\s/.test(text)) {
    return text;
  }
  // Single unbroken word: seed with soft hyphens so it can break with a "-".
  return text.length >= MIN_WORD_LEN_TO_HYPHENATE
    ? text.split("").join(SOFT_HYPHEN)
    : text;
};

interface MenuItem extends CustomerAppealsRouteAccessMeta {
  path: string;
  title: string;
  titleKey?: string;
  icon?: React.ReactNode;
  isMenu?: boolean;
  children?: MenuItem[];
  activeMenuPath?: string;
  preload?: () => void;
}

const TEAM_MANAGEMENT_DETAIL_BREADCRUMB_MODE = "teamManagementTask";
const TEAM_MANAGEMENT_ACTIVE_MENU_PATH_BY_SCOPE = {
  licensing: "/licensing/team-management",
  content: "/content/team-management",
  customer: "/happiness/team-management",
  inspection: "/inspection/tasks",
} as const;

type TeamManagementScope =
  keyof typeof TEAM_MANAGEMENT_ACTIVE_MENU_PATH_BY_SCOPE;

function isTeamManagementScope(
  value: string | null,
): value is TeamManagementScope {
  return Boolean(
    value &&
      Object.prototype.hasOwnProperty.call(
        TEAM_MANAGEMENT_ACTIVE_MENU_PATH_BY_SCOPE,
        value,
      ),
  );
}

function getTeamManagementActiveMenuPath(search: string) {
  const params = new URLSearchParams(search);
  const breadcrumbMode = params.get("breadcrumbMode");
  const teamManagementScope = params.get("teamManagementScope");

  if (
    breadcrumbMode !== TEAM_MANAGEMENT_DETAIL_BREADCRUMB_MODE ||
    !isTeamManagementScope(teamManagementScope)
  ) {
    return "";
  }

  return TEAM_MANAGEMENT_ACTIVE_MENU_PATH_BY_SCOPE[teamManagementScope];
}

function filterMenuItem(
  item: MenuItem,
  inspectionAccess: InspectionAccessState,
  customerAppealsAccess: CustomerAppealsAccessState,
): MenuItem | null {
  const children = item.children
    ?.map((child) =>
      filterMenuItem(child, inspectionAccess, customerAppealsAccess),
    )
    .filter((child): child is MenuItem => Boolean(child));

  if (
    isCustomerAppealsRouteProtected(item) &&
    (customerAppealsAccess.loading || !customerAppealsAccess.hasAccess)
  ) {
    return null;
  }

  if (isInspectionPath(item.path) && inspectionAccess.loading) {
    return null;
  }

  if (!isInspectionPath(item.path)) {
    return {
      ...item,
      children,
    };
  }

  if (item.path === "/inspection") {
    return children?.length
      ? {
          ...item,
          children,
        }
      : null;
  }

  return {
    ...item,
    children,
  };
}

function getTopLevelMenus(
  accessibleRoutes: MenuItem[],
  inspectionAccess: InspectionAccessState,
  customerAppealsAccess: CustomerAppealsAccessState,
) {
  const topLevelMenus =
    accessibleRoutes.filter((route: MenuItem) => route.isMenu) || [];
  return topLevelMenus
    .map((item: MenuItem) =>
      filterMenuItem(item, inspectionAccess, customerAppealsAccess),
    )
    .filter((item): item is MenuItem => Boolean(item));
}

export default function Sider() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const inspectionAccess = useInspectionAccess();
  const isRtl = i18n.language.toLowerCase().startsWith("ar");
  const rootChildren = (routes.find((route) => route.root)?.children ||
    []) as IRoute[];
  const accessibleRootChildren = useAccessibleProtectedRoutes(rootChildren);
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

  const routeItems = flattenRoutes(runtimeAccessibleRootChildren) as MenuItem[];
  const menus = getTopLevelMenus(
    runtimeAccessibleRootChildren as MenuItem[],
    inspectionAccess,
    customerAppealsAccess,
  );
  const normalizedLocationPath = normalizeRoutePath(location.pathname);
  const routeActiveMenuPath =
    routeItems.find(
      (item) => normalizeRoutePath(item.path) === normalizedLocationPath,
    )
      ?.activeMenuPath || "";
  const activeMenuPath = normalizeRoutePath(
    getTeamManagementActiveMenuPath(location.search) ||
      routeActiveMenuPath ||
      location.pathname,
  );

  const isMenuPathActive = (path: string) =>
    activeMenuPath === normalizeRoutePath(path);

  const isTopLevelMenuActive = (path: string) => {
    const normalizedPath = normalizeRoutePath(path);

    return (
      activeMenuPath === normalizedPath ||
      activeMenuPath.startsWith(`${normalizedPath}/`)
    );
  };

  /*
    Touch devices have no hover, and stacking hover+click makes a tap open the
    flyout on the synthetic mouseenter then immediately toggle it shut on the
    click. Pick exactly one trigger for the current pointer instead.
  */
  const hasHover = usePointerHasHover();
  const submenuTrigger = hasHover ? "hover" : "click";

  const getMenuItems = (array: MenuItem[], moduleTitle: string) => {
    const result = array.map((item: MenuItem) => {
      const isActive = isMenuPathActive(item.path);
      const label = item.titleKey ? t(item.titleKey) : item.title;

      return (
        <Link
          to={item.path}
          className={`menu-item-drop ${isActive ? "menuItem-active" : ""}`}
          title={label}
          key={item.path}
          onMouseEnter={item.preload}
          onFocus={item.preload}
        >
          <span className="menu-item-drop__content">
            <span className="menu-item-drop__label">{softHyphenate(label)}</span>
            {isActive ? (
              <img
                className="menu-item-drop__active-icon"
                src={GoldHook}
                alt=""
              />
            ) : null}
          </span>
        </Link>
      );
    });

    return (
      <div className="DropBox">
        <div className="submenu-module-title">{moduleTitle}</div>
        {result}
      </div>
    );
  };
  return (
    <>
      <div className="sider">
        <img src={logo} alt={t("common.nmaLogoAlt")} className="eagle" />
        <div className="menu">
          {menus.map((item) => {
            const label = item.titleKey ? t(item.titleKey) : item.title;
            const isActive = item.children
              ? isTopLevelMenuActive(item.path)
              : isMenuPathActive(item.path);

            return item.children ? (
              <Popover
                overlayClassName={`layou-menu-popover${
                  isRtl ? " layou-menu-popover-rtl" : ""
                }`}
                content={getMenuItems(item.children, label)}
                placement={isRtl ? "left" : "right"}
                trigger={submenuTrigger}
                getPopupContainer={(triggerNode) =>
                  triggerNode.ownerDocument.body
                }
                key={item.path}
              >
                <div
                  className={`menu-item ${isActive ? "menu-item-active" : ""}`}
                  /* Label is hidden on the icon rail, so keep an accessible name. */
                  title={label}
                  aria-label={label}
                  onMouseEnter={() => item.children?.[0]?.preload?.()}
                  onFocus={() => item.children?.[0]?.preload?.()}
                >
                  {item.icon}
                  <span className="menu-item__label">{softHyphenate(label)}</span>
                </div>
              </Popover>
            ) : (
              <Link
                to={item.path}
                className={`menu-item ${isActive ? "menu-item-active" : ""}`}
                title={label}
                aria-label={label}
                key={item.path}
                onMouseEnter={item.preload}
                onFocus={item.preload}
              >
                {item.icon}
                <span className="menu-item__label">{softHyphenate(label)}</span>
              </Link>
            );
          })}
        </div>
        <div className="sider-top"></div>

        <div className="menu-other">
          <Handler />
        </div>
      </div>
    </>
  );
}
