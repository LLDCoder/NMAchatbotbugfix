import request from '@/utils/request';

// Message type returned by API
export interface MessageResponse {
  id: number;
  messageType: number;
  title: string;
  content: string;
  userId: number;
  senderId: number;
  senderName: string;
  receiverType: number;
  priority: number;
  expireTime: string;
  relatedId: string | null;
  linkUrl?: string | null;
  linkVariableValues: string | null;
  pushStatus: number;
  isDeleted: boolean;
  isRead: boolean;
  readTime: string;
  pushTime: string;
  createdAt: string;
  updateAt: string;
  inAppTitleEn: string;
  inAppTitleAr: string;
  inAppMessageEn: string;
  inAppMessageAr: string;
}

// Parameters for getting message list
export interface GetMessageListParams {
  pageSize?: number;
  pageIndex?: number;
  profileId?: string | number;
}

// Get message list
export const getMessageList = (params: GetMessageListParams = { pageSize: 5 }) => {
  return request.get<{ data: MessageResponse[] }>('/api/SignalR/GetNotificationInfoList', params);
};

// Get message list that should be shown in popup box
export const getMessageListShowBox = (profileId: string | number) => {
  return request.get<{ data: MessageResponse[] }>(
    '/api/SignalR/GetNotificationInfoListShowBox',
    { profileId }
  );
};

// Mark all messages as read
export const markAllMessagesAsRead = (userId: string | number) => {
  return request.get('/api/SignalR/ReadAllNotificationInfo', { userId });
};

// Mark single message as read (by getting message details to mark as read)
export const markMessageAsRead = (mesgId: number) => {
  return request.get('/api/SignalR/ReadNotificationInfo', { id: mesgId });
};
