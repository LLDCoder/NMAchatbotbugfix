import { useNotificationContext } from '@/hooks/useNotificationContext';

export const useNotifications = () => {
  return useNotificationContext();
};