import { fromApi } from '@/utils/gstTime';
import type { MessageResponse } from '@/services/notification';

// Notification item interface for admin portal
export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  time: string;
  isRead: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  inAppTitleAr: string;
  inAppTitleEn: string;
  inAppMessageEn: string;
  relatedId: string | null;
  linkUrl: string | null;
  linkVariableValues: string | null;
  inAppMessageAr: string;
}

// Message type mapping
const messageTypeMap: Record<number, NotificationItem['type']> = {
  0: 'info',
  1: 'success',
  2: 'warning',
  3: 'error',
};

/**
 * Format date as DD/MM/YYYY HH:mm:ss
 */
const formatDate = (dateString: string): string => {
  // Backend sends Dubai wall-clock (no offset) — format without browser-TZ shifting.
  const d = fromApi(dateString);
  return d ? d.format('DD/MM/YYYY HH:mm') : '';
};

/**
 * Transform API message data to notification format used by frontend
 */
export const transformMessageToNotification = (message: MessageResponse): NotificationItem => {
  return {
    id: String(message.id),
    title: message.title,
    content: message.content,
    time: formatDate(message.pushTime),
    isRead: message.isRead,
    type: messageTypeMap[message.messageType] || 'info',
    inAppTitleAr: message.inAppTitleAr,
    inAppTitleEn: message.inAppTitleEn,
    inAppMessageEn: message.inAppMessageEn,
    relatedId: message.relatedId ?? null,
    linkUrl: message.linkUrl ?? null,
    linkVariableValues: message.linkVariableValues ?? null,
    inAppMessageAr: message.inAppMessageAr
  };
};

/**
 * Batch transform message list
 */
export const transformMessagesToNotifications = (messages: unknown): NotificationItem[] => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map(transformMessageToNotification);
};
