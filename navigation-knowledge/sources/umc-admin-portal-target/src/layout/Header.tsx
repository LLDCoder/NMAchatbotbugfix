import React, { useState, useEffect, useRef } from "react";
import { Avatar } from "@mantine/core";
import { Dropdown, Menu, Modal } from "antd";
import CaretUp from "../assets/icons/CaretUp";
import Bell from "../assets/icons/Bell";
import { useNotificationContext } from "@/hooks/useNotificationContext";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AppRoutes from "../routes";
import NotificationPopover from "@/components/NotificationPopover";
import AvatarImg from "../assets/images/default-admin-avatar.svg";
import CaretDown from "../assets/icons/CaretDown";
import PersonalCenter from "@/assets/icons/PersonalCenter";
import LogOut from "@/assets/icons/LogOut";
import { useAuthenticatedDocumentSource } from "@/hooks/useAuthenticatedDocumentUrl";
import { useHistory } from "react-router-dom";
import {
  PAGE_HEADING_EXTRA_PORTAL_ID,
  PAGE_TITLE_EXTRA_PORTAL_ID,
} from "@/components/common/PageHeadingPortal/constants";
import { useUserStore } from "@/store/user";
import type { IRoute } from "@/routes";
import { useCurrentAdminUser } from "@/store/currentAdminUser";
import { performAuthenticatedLogout } from "@/utils/authSession";
import { showLeavePageConfirm } from "@/pages/InspectionStartVisit/components/inspectionVisitModalConfirm";
import {
  isInspectionExecutionPath,
  requestInspectionExecutionDraftSave,
} from "@/utils/inspectionExecutionLeaveGuard";
import {
  findRouteByPath,
  flattenRoutes,
  useAccessibleProtectedRoutes,
} from "@/routes/access";
import { normalizePortalLanguage } from "@/localization/language";
import type { HeaderBreadcrumbItem } from "./headerPresentation";
import {
  createDashboardReturnLocation,
  readDashboardReturnState,
} from "@/pages/Dashboard/dashboardReturnState";
import { resolveTeamManagementBreadcrumbNavigation } from "@/pages/TeamManagement/teamManagementReturnState";

interface HeaderProps {
  pageTitle: string;
  breadcrumbItems?: HeaderBreadcrumbItem[];
  hideAutoBreadcrumb?: boolean;
  reserveTitleExtraHeight?: boolean;
}

export default function Header({
  pageTitle,
  breadcrumbItems,
  hideAutoBreadcrumb = false,
  reserveTitleExtraHeight = false,
}: HeaderProps) {
  const location = useLocation();
  const history = useHistory();
  const { i18n, t } = useTranslation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isUserDropdownVisible, setIsUserDropdownVisible] = useState(false);
  const notificationBellRef = useRef<HTMLDivElement>(null);
  const [currentLang, setCurrentLang] = useState(i18n.language || "en");
  const userInfo = useUserStore((state) => state.userInfo);
  const {
    data: adminUserInfo,
    loading: isAdminUserLoading,
  } = useCurrentAdminUser(userInfo.id);
  const {
    notifications: allNotifications,
    handleMarkAllRead,
    handleMarkSingleRead,
  } = useNotificationContext();

  const notifications = allNotifications;
  const handleNotificationClick = (id: string) => {
    handleMarkSingleRead(Number(id));
  };

  useEffect(() => {
    const savedLanguage = normalizePortalLanguage(
      localStorage.getItem("language"),
    );
    setCurrentLang(savedLanguage);
  }, []);

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
    const normalizedLanguage = normalizePortalLanguage(lng);
    setCurrentLang(normalizedLanguage);
    localStorage.setItem("language", normalizedLanguage);
    window.location.reload();
  };

  const normalizeRoutePart = (value?: string) =>
    value?.toLowerCase().replace(/-/g, "") || "";

  const rootChildren = AppRoutes.find((route) => route.root)?.children || [];
  const accessibleRootChildren = useAccessibleProtectedRoutes(rootChildren);
  const routeItems = flattenRoutes(accessibleRootChildren as IRoute[]);
  const canAccessPersonalCenter = Boolean(
    findRouteByPath(accessibleRootChildren, "/personal-center"),
  );
  const params = new URLSearchParams(location.search);
  const breadcrumbRootKey = params.get("breadcrumbRootKey");
  const autoBreadcrumbs = location.pathname.split("/").filter(Boolean).map(
    (item, index, array) => {
      const breadcrumbPath = `/${array.slice(0, index + 1).join("/")}`;
      const normalizedItem = normalizeRoutePart(item);
      const translationKey =
        item === "customers"
          ? ({
            i18n: "menu.CustomerHappiness",
            path: "/happiness",
          } as IRoute)
          : index === 1 &&
            normalizeRoutePart(array[0]) === "licensing" &&
            normalizedItem === "license"
            ? ({
              i18n: "menu.licenses",
              path: "/licensing/licenses",
            } as IRoute)
            : routeItems.find((route) => route.path === breadcrumbPath) ||
            routeItems.find((route) => {
              const routePage = normalizeRoutePart(route.page);
              const routeSegment = normalizeRoutePart(route.path?.split("/").pop());
              return routePage === normalizedItem || routeSegment === normalizedItem;
            });

      const label =
        index === 0 && breadcrumbRootKey
          ? t(breadcrumbRootKey)
          : translationKey?.i18n
            ? t(translationKey.i18n)
            : item;

      return {
        key: `${item}-${index}`,
        label,
        path:
          translationKey?.path && !translationKey.isMenu ? translationKey.path : undefined,
        active: index === array.length - 1,
      };
    },
  );

  const breadcrumbs = hideAutoBreadcrumb
    ? breadcrumbItems || []
    : breadcrumbItems || autoBreadcrumbs;
  const dashboardReturnState = readDashboardReturnState(location.state);
  const { source: avatarSource, status: avatarStatus } =
    useAuthenticatedDocumentSource(
      adminUserInfo?.personalPhotoUrl,
      AvatarImg,
    );
  const showAvatar = !isAdminUserLoading && avatarStatus !== "loading";

  const isArabic = currentLang.toLowerCase().startsWith("ar");
  const targetLanguage = isArabic ? "en" : "ar";
  const targetLanguageLabel = isArabic ? "En" : "Ar";
  const userDisplayName = [
    adminUserInfo?.firstName,
    adminUserInfo?.lastName,
  ]
    .filter(Boolean)
    .join(" ");
  const userRole =
    adminUserInfo?.assignRolesIdsInfo?.[0]?.name ||
    t("header.defaultRole");

  function logout() {
    Modal.destroyAll();
    performAuthenticatedLogout({
      bypassInspectionLeaveConfirm: true,
      saveInspectionExecutionDraft: true,
    });
  }

  function confirmLogoutFromInspectionExecution() {
    showLeavePageConfirm({
      title: t('inspection.execution.leaveConfirm.title'),
      content: t('inspection.execution.leaveConfirm.content'),
      okText: t('inspection.execution.leaveConfirm.leave'),
      cancelText: t('inspection.common.no'),
      onOk: () => {
        requestInspectionExecutionDraftSave();
        return logout();
      },
    });
  }

  function handleUserMenuClick(key: string) {
    setIsUserDropdownVisible(false);

    if (key === 'LogOut') {
      if (isInspectionExecutionPath(location.pathname)) {
        confirmLogoutFromInspectionExecution();
        return;
      }
      logout();
    }

    if (key === 'PersonalCenter') {
      history.push('/personal-center');
    }
  }

  const userMenuItems = [
    ...(canAccessPersonalCenter
      ? [
          {
            key: "PersonalCenter",
            label: <div className="layout-header-user-menu-item">
              <PersonalCenter />{t("header.personalCenter")}
            </div>,
          },
        ]
      : []),
    {
      key: "LogOut",
      label: <div className="layout-header-user-menu-item">
        <LogOut /> {t("header.logout")}
      </div>,
    },
    // {
    //   key: "ChangeLang",
    //   label: <div onClick={(e) => {
    //     e.stopPropagation();
    //   }} className="layout-header-lang">
    //     <div onClick={() => {
    //       handleLanguageChange('en');
    //     }} className={`layout-header-changelang ${currentLang === 'en' ? 'layout-header-lang-active' : ''}`}>
    //       <div className="layout-header-changelang-en-icon"><img src={EnImg} alt="" /></div>
    //       EN
    //     </div>
    //     <div onClick={() => {
    //       handleLanguageChange('ar');
    //     }} className={`layout-header-changelang ${currentLang === 'ar' ? 'layout-header-lang-active' : ''}`}>
    //       <div className="layout-header-changelang-en-icon"><img src={ArImg} alt="" /></div>
    //       AR
    //     </div>
    //   </div>,
    // },
  ];

  const userMenu = (
    <Menu
      className="layout-header-user-menu"
      onClick={({ key }) => handleUserMenuClick(key)}
      items={userMenuItems}
    />
  );

  return (
    <div className="header">
      <div className="header-left">
        <div className="breadcrumbs">
          {breadcrumbs.map((item, index) => {
            const breadcrumbNavigation = item.path
              ? resolveTeamManagementBreadcrumbNavigation(
                  item.key,
                  item.path,
                  location.state,
                )
              : null;
            const content = item.path && !item.active ? (
              breadcrumbNavigation?.restoreHistory ? (
                <button
                  type="button"
                  className="headerTitle"
                  onClick={() => history.goBack()}
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  to={
                    dashboardReturnState
                      ? createDashboardReturnLocation(dashboardReturnState)
                      : breadcrumbNavigation?.path || item.path
                  }
                  className="headerTitle"
                >
                  {item.label}
                </Link>
              )
            ) : (
              <span className="headerTitle">{item.label}</span>
            );

            return (
              <React.Fragment key={index}>
                <div className={item.active ? "active" : ""}>
                  {content}
                </div>
                {index !== breadcrumbs.length - 1 && <CaretUp />}
              </React.Fragment>
            );
          })}
        </div>
        <div
          className={`page-title-row${
            reserveTitleExtraHeight
              ? " page-title-row--reserve-extra-height"
              : ""
          }`}
        >
          <div className="page-title">{pageTitle}</div>
          <div id={PAGE_TITLE_EXTRA_PORTAL_ID} className="page-title-extra" />
        </div>
      </div>
      <div
        id={PAGE_HEADING_EXTRA_PORTAL_ID}
        className="header-middle page-heading-extra"
      />
      <div className="actions">
        <div
          ref={notificationBellRef}
          className={`header-action-icon header-bell-icon ${showNotifications
            ? "notification-selectWrapper"
            : "notification-wrapper"
            }`}
          onClick={() => setShowNotifications(!showNotifications)}
        >

          <Bell />
          {notifications.some((n) => !n.isRead) && (
            <span className="notification-badge" />
          )}
        </div>
        <button
          type="button"
          className="header-language-toggle"
          onClick={() => handleLanguageChange(targetLanguage)}
        >
          {targetLanguageLabel}
        </button>
        <Dropdown
          overlay={userMenu}
          trigger={["click"]}
          placement="bottomRight"
          onVisibleChange={setIsUserDropdownVisible}
        >
          <button
            type="button"
            className="layout-header-user-dropdown profile-switcher"
            aria-label={userDisplayName || userRole}
          >
            {showAvatar ? (
              <Avatar
                src={avatarSource}
                className="profile-switcher__avatar"
                alt={t("header.userAvatarAlt")}
              >
                <img src={AvatarImg} alt={t("header.userAvatarAlt")} />
              </Avatar>
            ) : (
              <span className="profile-switcher__avatar" aria-hidden="true" />
            )}
            <div className="profile-switcher__details">
              <div className="profile-switcher__name" title={userDisplayName}>
                {userDisplayName}
              </div>
              <div className="profile-switcher__role" title={userRole}>
                {userRole}
              </div>
            </div>
            <span
              className={`profile-switcher__caret${
                isUserDropdownVisible
                  ? " profile-switcher__caret--expanded"
                  : ""
              }`}
              aria-hidden="true"
            >
              <CaretDown />
            </span>
          </button>
        </Dropdown>
        <NotificationPopover
          visible={showNotifications}
          anchorRef={notificationBellRef}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
          onNotificationClick={handleNotificationClick}
        />
      </div>
    </div>
  );
}
