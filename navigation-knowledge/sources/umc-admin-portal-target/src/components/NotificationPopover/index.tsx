import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./index.less";
import emptyIcon from "@/assets/images/empty.svg";
import arrowIcon from "@/assets/images/ArrowRight.svg";
import {
  AuthenticatedDocumentHtml,
} from "@/components/common/AuthenticatedDocumentHtml";
import type { NotificationItem } from "@/utils/notificationHelper";

export type { NotificationItem } from "@/utils/notificationHelper";

interface NotificationPopoverProps {
  visible: boolean;
  anchorRef: RefObject<HTMLElement>;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onNotificationClick?: (id: string) => void;
}

const POPOVER_VERTICAL_OFFSET = 16;
const POPOVER_VIEWPORT_PADDING = 16;

export default function NotificationPopover({
  visible,
  anchorRef,
  onClose,
  notifications,
  onMarkAllRead,
  onNotificationClick,
}: NotificationPopoverProps) {
  const { i18n } = useTranslation();
  const history = useHistory();
  const { t } = useTranslation();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState({
    left: 0,
    top: 0,
    positioned: false,
  });

  const updatePopoverPosition = useCallback(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;

    if (!anchor || !popover) return;

    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    const halfPopoverWidth = popoverRect.width / 2;
    const minLeft = POPOVER_VIEWPORT_PADDING + halfPopoverWidth;
    const maxLeft = Math.max(
      minLeft,
      window.innerWidth - POPOVER_VIEWPORT_PADDING - halfPopoverWidth,
    );
    const left = Math.min(Math.max(anchorCenterX, minLeft), maxLeft);
    const top = anchorRect.bottom + POPOVER_VERTICAL_OFFSET;

    setPopoverPosition({
      left,
      top,
      positioned: true,
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!visible) return;

    updatePopoverPosition();
    const animationFrame = window.requestAnimationFrame(updatePopoverPosition);
    window.addEventListener("resize", updatePopoverPosition);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updatePopoverPosition);
    };
  }, [visible, updatePopoverPosition]);

  if (!visible) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const positionStyle: CSSProperties = {
    left: popoverPosition.left,
    top: popoverPosition.top,
    visibility: popoverPosition.positioned ? "visible" : "hidden",
  };

  const handleViewAll = () => {
    history.push("/notifications");
    onClose();
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.isRead && onNotificationClick) {
      onNotificationClick(notification.id);
    }
    handleViewAll();
  };
  return createPortal(
    <>
      <div className="notification-popover__overlay" onClick={onClose} />
      <div className="notification-popover__positioner" style={positionStyle}>
        <div
          ref={popoverRef}
          className={
            i18n.resolvedLanguage === "ar"
              ? "notification-popover notification-popover--rtl"
              : "notification-popover"
          }
        >
          <div className="notification-popover__header">
            <h3 className="notification-popover__heading">
              {t("notifications.title")} ({unreadCount})
            </h3>

            {notifications.length > 0 && (
              <button
                className="notification-popover__mark-all-button"
                onClick={onMarkAllRead}
              >
                {t("notifications.markAllAsRead")}
              </button>
            )}
          </div>

          <div className="notification-popover__list">
            {notifications.length === 0 ? (
              <div className="notification-popover__empty">
                <div className="notification-popover__empty-icon">
                  <img src={emptyIcon} />
                </div>
                <p className="notification-popover__empty-text">
                  {t("notifications.noNotifications")}
                </p>
              </div>
            ) : (
              notifications.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-popover__item ${
                    notification.isRead
                      ? "notification-popover__item--read"
                      : "notification-popover__item--unread"
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <span
                    className={`notification-popover__status-dot ${
                      notification.isRead
                        ? "notification-popover__status-dot--read"
                        : "notification-popover__status-dot--unread"
                    }`}
                  />
                  <div className="notification-popover__item-content">
                    <div className="notification-popover__item-title-row">
                      <h4
                        className="notification-popover__item-title"
                        title={
                          i18n.resolvedLanguage === "ar"
                            ? notification.inAppTitleAr
                            : notification.inAppTitleEn
                        }
                      >
                        {i18n.resolvedLanguage === "ar"
                          ? notification.inAppTitleAr
                          : notification.inAppTitleEn}
                      </h4>
                      <span className="notification-popover__time">
                        {notification.time}
                      </span>
                    </div>
                    <AuthenticatedDocumentHtml
                      className="notification-popover__message"
                      html={
                        i18n.resolvedLanguage === "ar"
                          ? notification.inAppMessageAr
                          : notification.inAppMessageEn
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-popover__footer">
              <button
                className="notification-popover__view-all-button"
                onClick={handleViewAll}
              >
                {t("notifications.viewAll")}
                <img className="notification-popover__view-all-icon" src={arrowIcon} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
