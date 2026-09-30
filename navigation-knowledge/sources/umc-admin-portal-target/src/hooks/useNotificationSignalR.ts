import { useEffect, useCallback } from "react";
import { useSignalR } from "./useSignalR";
import { SIGNALR_CONFIG } from "@/config/signalr";
import type { MessageResponse } from '@/services/notification';

interface UseNotificationSignalRProps {
  onNewNotification?: (notification: MessageResponse) => void;
  onRefreshNotifications?: () => void;
  enabled?: boolean; 
  profileId?: string | number | null;
}

export const useNotificationSignalR = ({
  onNewNotification,
  onRefreshNotifications,
  enabled = true, 
  profileId,
}: UseNotificationSignalRProps) => {
  const handleConnected = useCallback((connectionId: string) => {
    console.log("SignalR Connected:", connectionId);
  }, []);

  const handleDisconnected = useCallback(() => {
    console.log("SignalR Disconnected");
  }, []);

  const { connection, isConnected, error } = useSignalR(
    SIGNALR_CONFIG.HUB_URL,
    handleConnected,
    handleDisconnected,
    enabled && Boolean(profileId)
  );

  useEffect(() => {
    if (connection) {
      connection.on(
        SIGNALR_CONFIG.EVENTS.RECEIVE_NOTIFICATION,
        (user: any, message: any) => {
          console.log("New notification received:", user, message);
          if (onNewNotification) {
            onNewNotification(message);
          }
          if (onRefreshNotifications) {
            onRefreshNotifications();
          }
        }
      );

      return () => {
        connection.off(SIGNALR_CONFIG.EVENTS.RECEIVE_NOTIFICATION);
      };
    }
  }, [connection, onNewNotification, onRefreshNotifications]);

  return {
    isConnected,
    error,
  };
};
