import { useState } from "react";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./index.less";
import emptyIcon from "@/assets/images/empty.svg";
import arrowIcon from "@/assets/images/ArrowRight.svg";

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  time: string;
  isRead: boolean;
  type: "warning" | "info" | "success" | "error";
}

interface NotificationPopoverProps {
  visible: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onNotificationClick?: (id: string) => void;
}

export default function NotificationPopover({
  visible,
  onClose,
  notifications,
  onMarkAllRead,
  onNotificationClick,
}: NotificationPopoverProps) {
  const history = useHistory();
  const { t } = useTranslation();

  if (!visible) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleViewAll = () => {
    history.push("/notifications");
    onClose();
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    // ,
    if (!notification.isRead && onNotificationClick) {
      onNotificationClick(notification.id);
    }
  };

  return (
    <>
      <div className="notification-overlay" onClick={onClose} />
      <div className="notification-popover">
        <div className="notification-header">
          <h3>{t('notifications.title')} ({unreadCount})</h3>

          {notifications.length > 0 && (
            <button className="mark-all-read" onClick={onMarkAllRead}>
              {t('notifications.markAllAsRead')}
            </button>
          )}
        </div>

        <div className="notification-list">
          {notifications.length === 0 ? (
            <div className="notification-empty">
              <div className="empty-icon">
                <img src={emptyIcon} />
              </div>
              <p className="empty-text">{t('notifications.noNotifications')}</p>
            </div>
          ) : (
            notifications.slice(0, 5).map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${
                  !notification.isRead ? "unread" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-content">
                  <div className="notification-title-row">
                    {!notification.isRead ? (
                      <span className="unread-dot" />
                    ) : (
                      <span className="read-dot" />
                    )}

                    <h4>{notification.title}</h4>
                    <span className="notification-time">
                      {notification.time}
                    </span>
                  </div>
                  <p className="notification-text">{notification.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="notification-footer">
            <button className="view-all-btn" onClick={handleViewAll}>
              {t('notifications.viewAll')}
              <img src={arrowIcon} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
