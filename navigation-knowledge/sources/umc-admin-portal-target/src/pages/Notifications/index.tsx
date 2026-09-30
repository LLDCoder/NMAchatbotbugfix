import { useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { NotificationItem } from "@/components/NotificationPopover";
import { CustomMessage } from "@/components/common";
import { useNotificationContext } from "@/hooks/useNotificationContext";
import emptyIcon from "@/assets/images/empty.svg";
import appRoutes from "@/routes";
import {
  createPermissionPathSet,
  findRouteByPath,
  type PermissionNode,
} from "@/routes/access";
import { getTaskType } from "@/services/tickets";
import { useUserStore } from "@/store/user";
import {
  AuthenticatedDocumentHtml,
} from "@/components/common/AuthenticatedDocumentHtml";
import {
  buildDirectNotificationPath,
  buildServiceApplicationPath,
  isServiceApplicationReference,
  isNotificationRouteAllowed,
  linkifyNotificationReferenceNumbers,
  resolveProvidedNotificationPath,
} from "./notificationNavigation";
import "./index.less";

export default function Notifications() {
  const { t, i18n } = useTranslation();
  const history = useHistory();
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "read">("all");
  const permissions = useUserStore(
    (state) => state.userInfo?.listSysPermission || [],
  ) as PermissionNode[];
  const permissionPathSet = useMemo(
    () => createPermissionPathSet(permissions),
    [permissions],
  );

  const {
    notifications,
    loading,
    handleMarkAllRead,
    handleMarkSingleRead
  } = useNotificationContext();
  const filteredNotifications =
    activeTab === "all"
      ? notifications
      : activeTab === "unread"
        ? notifications.filter((n) => !n.isRead)
        : notifications.filter((n) => n.isRead);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const resolveNotificationPath = async (
    notification: NotificationItem,
    referenceNo: string,
    hasMultipleReferences: boolean,
  ) => {
    const notificationPath = resolveProvidedNotificationPath(
      notification.linkUrl,
      notification.linkVariableValues,
      referenceNo,
      hasMultipleReferences,
    );
    if (notificationPath) return notificationPath;

    const directPath = buildDirectNotificationPath(
      referenceNo,
      hasMultipleReferences ? null : notification.relatedId,
    );
    if (directPath) return directPath;

    if (!isServiceApplicationReference(referenceNo)) return null;

    const response = await getTaskType(
      { applicationNo: referenceNo },
      { skipErrorMessage: true },
    );
    const task = response.data;
    if (!task?.taskId || !task.departmentId) return null;

    return buildServiceApplicationPath({
      taskId: task.taskId,
      departmentId: task.departmentId,
      referenceNo,
    });
  };

  const handleNotificationClick = async (
    notification: NotificationItem,
    e: React.MouseEvent<HTMLElement>,
  ) => {
    const referenceElement = (e.target as HTMLElement).closest<HTMLElement>(
      ".notification-ref-no",
    );
    const referenceNo = referenceElement?.textContent?.trim();
    if (!referenceNo) {
      return;
    }

    e.stopPropagation();
    const hasMultipleReferences =
      e.currentTarget.querySelectorAll(".notification-ref-no").length > 1;

    if (!notification.isRead) {
      handleMarkSingleRead(Number(notification.id));
    }

    try {
      const targetPath = await resolveNotificationPath(
        notification,
        referenceNo,
        hasMultipleReferences,
      );
      if (!targetPath) {
        CustomMessage.warning(t("response.error.404"));
        return;
      }

      const targetRoute = findRouteByPath(appRoutes, targetPath);
      if (!isNotificationRouteAllowed(targetRoute, permissionPathSet)) {
        CustomMessage.warning(t("response.error.403"));
        return;
      }

      history.push(targetPath);
    } catch {
      CustomMessage.error(t("response.error.404"));
    }
  };
  const handleNotificationCard = (notification: NotificationItem) => {
    if (!notification.isRead) {
      handleMarkSingleRead(Number(notification.id));
    }
  };
  return (
    <div className="notifications-page">

      <div className="notifications-line">

      </div>
      <div className="notifications-layout">
        <div className="notifications-sidebar">
          <div
            className={`filter-item ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <span className="filter-label">{t('notifications.all')} ({notifications.length})</span>
          </div>
          <div
            className={`filter-item ${activeTab === "unread" ? "active" : ""}`}
            onClick={() => setActiveTab("unread")}
          >
            <span className="filter-label">
              {t('notifications.unreadMessages')} ({unreadCount})
            </span>
          </div>
          <div
            className={`filter-item ${activeTab === "read" ? "active" : ""}`}
            onClick={() => setActiveTab("read")}
          >
            <span className="filter-label">
              {t('notifications.readMessages')} ({notifications.length - unreadCount})
            </span>
          </div>
        </div>

        <div className="notifications-container">
          <div className="notifications-header">
            <div className="notifications-hint">
              {t('notifications.showNotificationsHint')}
            </div>
            <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
              {t('notifications.markAllAsRead')}
            </button>
          </div>

          <div className="notifications-list">
            {loading ? (
              <div className="notifications-empty">
                <p className="empty-text">{t('notifications.loading')}</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="notifications-empty">
                <div className="empty-icon">
                  <img src={emptyIcon} />
                </div>
                <p className="empty-text">{t('notifications.noNotifications')}</p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-card ${!notification.isRead ? "unread" : ""
                    }`}
                  onClick={() => handleNotificationCard(notification)}

                >
                  <div className="notification-main">
                    {!notification.isRead ? (
                      <span className="unread-dot" />
                    ) : (
                      <span className="readed-dot" />
                    )}
                    <div className="notification-content-wrapper">
                      <div className="notification-title-row">
                        <h3>{i18n.resolvedLanguage === 'ar' ? notification.inAppTitleAr : notification.inAppTitleEn}</h3>
                        <span className="notification-time">
                          {notification.time}
                        </span>
                      </div>
                      <AuthenticatedDocumentHtml
                        onClick={(e) => handleNotificationClick(notification, e)}
                        className="notification-content"
                        html={linkifyNotificationReferenceNumbers(
                          i18n.resolvedLanguage === 'ar'
                            ? notification.inAppMessageAr
                            : notification.inAppMessageEn,
                        )}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
