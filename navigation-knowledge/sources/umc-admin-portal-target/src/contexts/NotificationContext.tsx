import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { NotificationItem } from "@/utils/notificationHelper";
import {
  getMessageList,
  getMessageListShowBox,
  markAllMessagesAsRead,
  markMessageAsRead,
  type MessageResponse,
} from "@/services/notification";
import {
  transformMessagesToNotifications,
  transformMessageToNotification,
} from "@/utils/notificationHelper";
import CustomMessage from "@/components/common/CustomMessage";
import AnnouncementModal from "@/components/common/AnnouncementModal";
import { useTranslation } from "react-i18next";
import { useNotificationSignalR } from "@/hooks/useNotificationSignalR";
import { authStorage, AUTH_STORAGE_KEYS } from "@/storage/authStorage";
import { useUserStore } from "@/store/user";
import {
  NotificationContext,
  type NotificationContextType,
} from "./notificationContextValue";

function getNotificationListPayload(response: unknown): unknown[] {
  const data = (response as { data?: unknown } | null)?.data ?? response;

  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const record = data as Record<string, unknown>;
  const candidates = [
    record.items,
    record.records,
    record.list,
    record.rows,
    record.data,
  ];

  return candidates.find(Array.isArray) || [];
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { i18n, t } = useTranslation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const userInfo = useUserStore((state) => state.userInfo);
  const [announcements, setAnnouncements] = useState<NotificationItem[]>([]);
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const mountedRef = useRef(false);
  const notificationsRequestRef = useRef(0);
  const announcementsRequestRef = useRef(0);
  const notificationProfileId = useMemo(
    () =>
      userInfo?.userInvitation?.userProfileId ||
      userInfo?.userProfileInfo?.[0]?.id ||
      "",
    [userInfo?.userInvitation?.userProfileId, userInfo?.userProfileInfo]
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      const token = authStorage.getToken();
      const isValid = authStorage.isTokenValid();
      const authenticated = !!token && isValid;
      setIsAuthenticated(authenticated);
    };

    checkAuth();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEYS.TOKEN) {
        checkAuth();
      }
    };

    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("auth-changed", handleAuthChange);

    const interval = setInterval(checkAuth, 60000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("auth-changed", handleAuthChange);
      clearInterval(interval);
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !userInfo?.id) {
      notificationsRequestRef.current += 1;
      if (mountedRef.current) {
        setNotifications([]);
        setLoading(false);
      }
      return;
    }

    const requestId = notificationsRequestRef.current + 1;
    notificationsRequestRef.current = requestId;

    try {
      if (mountedRef.current) {
        setLoading(true);
      }
      const response = await getMessageList({
        pageSize: 100,
        profileId: notificationProfileId,
      });
      const data = getNotificationListPayload(response);
      const transformedNotifications = transformMessagesToNotifications(data);
      if (mountedRef.current && notificationsRequestRef.current === requestId) {
        setNotifications(transformedNotifications);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      if (mountedRef.current && notificationsRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, notificationProfileId, userInfo?.id]);

  const handleNewNotification = useCallback((message: MessageResponse) => {
    console.log("Received new notification via SignalR payload", message);
    // Add the new notification to the list
    const newNotification = transformMessageToNotification(message);
    if (mountedRef.current) {
      setNotifications((prev) => [newNotification, ...prev]);
    }
  }, []);

  const fetchShowBoxNotifications = useCallback(async () => {
    if (!isAuthenticated || !userInfo?.id || !notificationProfileId) {
      announcementsRequestRef.current += 1;
      if (mountedRef.current) {
        setAnnouncements([]);
        setCurrentAnnouncementIndex(0);
      }
      return;
    }

    const requestId = announcementsRequestRef.current + 1;
    announcementsRequestRef.current = requestId;

    try {
      const res = await getMessageListShowBox(notificationProfileId);
      const list = getNotificationListPayload(res);
      const transformed = transformMessagesToNotifications(list);

      if (mountedRef.current && announcementsRequestRef.current === requestId) {
        if (transformed.length > 0) {
          setAnnouncements(transformed);
          setCurrentAnnouncementIndex(0);
        } else {
          setAnnouncements([]);
          setCurrentAnnouncementIndex(0);
        }
      }
    } catch (error) {
      console.error("Failed to fetch show-box notifications:", error);
    }
  }, [isAuthenticated, notificationProfileId, userInfo?.id]);

  const handleRefreshNotifications = useCallback(() => {
    void fetchNotifications();
    void fetchShowBoxNotifications();
  }, [fetchNotifications, fetchShowBoxNotifications]);

  const { isConnected: signalRConnected } = useNotificationSignalR({
    onNewNotification: handleNewNotification,
    onRefreshNotifications: handleRefreshNotifications,
    enabled: isAuthenticated && Boolean(notificationProfileId),
    profileId: notificationProfileId,
  });

  const handleMarkAllRead = useCallback(async () => {
    if (!userInfo?.id) return;

    try {
      await markAllMessagesAsRead(userInfo.id);
      if (mountedRef.current) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        CustomMessage.success(t("notifications.markAllReadSuccess"));
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      if (mountedRef.current) {
        CustomMessage.error(t("notifications.markReadFailed"));
      }
    }
  }, [t, userInfo?.id]);

  const handleMarkSingleRead = useCallback(async (mesgId: number) => {
    try {
      await markMessageAsRead(mesgId);
      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === String(mesgId) ? { ...n, isRead: true } : n
          )
        );
      }
    } catch (error) {
      console.error("Failed to mark single message as read:", error);
    }
  }, []);

  useEffect(() => {
    handleRefreshNotifications();
  }, [handleRefreshNotifications]);

  const handleCloseCurrentAnnouncement = useCallback(
    async (item: NotificationItem) => {
      try {
        await handleMarkSingleRead(Number(item.id));
        if (!mountedRef.current) {
          return;
        }

        const nextIndex = currentAnnouncementIndex + 1;
        if (nextIndex < announcements.length) {
          setCurrentAnnouncementIndex(nextIndex);
        } else {
          setAnnouncements([]);
          setCurrentAnnouncementIndex(0);
        }
      } catch (error) {
        console.error("Failed to mark announcement as read:", error);
      }
    },
    [currentAnnouncementIndex, announcements.length, handleMarkSingleRead]
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const value: NotificationContextType = {
    notifications,
    loading,
    unreadCount,
    signalRConnected,
    fetchNotifications,
    handleMarkAllRead,
    handleMarkSingleRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {announcements.length > 0 && currentAnnouncementIndex < announcements.length && (
        <AnnouncementModal
          key={announcements[currentAnnouncementIndex].id}
          visible
          headerLabel={t("notifications.announcement")}
          title={
            i18n.resolvedLanguage === "ar"
              ? announcements[currentAnnouncementIndex].inAppTitleAr 
              : announcements[currentAnnouncementIndex].inAppTitleEn
          }
          content={
            i18n.resolvedLanguage === "ar"
              ? announcements[currentAnnouncementIndex].inAppMessageAr 
              : announcements[currentAnnouncementIndex].inAppMessageEn
          }
          onClose={() => handleCloseCurrentAnnouncement(announcements[currentAnnouncementIndex])}
        />
      )}
    </NotificationContext.Provider>
  );
};
