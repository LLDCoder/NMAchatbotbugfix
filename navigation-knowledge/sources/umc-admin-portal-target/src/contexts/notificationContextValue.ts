import { createContext } from "react";
import type { NotificationItem } from "@/utils/notificationHelper";

export interface NotificationContextType {
  notifications: NotificationItem[];
  loading: boolean;
  unreadCount: number;
  signalRConnected: boolean;
  fetchNotifications: () => Promise<void>;
  handleMarkAllRead: () => Promise<void>;
  handleMarkSingleRead: (mesgId: number) => Promise<void>;
}

export const NotificationContext = createContext<
  NotificationContextType | undefined
>(undefined);
