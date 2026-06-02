export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  type: NotificationType;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}
