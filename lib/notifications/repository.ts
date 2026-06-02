import type { Notification } from './types';
import { notificationHub } from '@/lib/streams/notification-hub';

// Seeded demo notifications used to populate new users' inboxes.
const SEED_NOTIFICATIONS: Omit<Notification, 'userId'>[] = [
  {
    id: 'notif-1',
    title: 'Deposit Confirmed',
    message: 'Your XLM deposit of 500 XLM has been confirmed on-chain.',
    read: false,
    createdAt: '2026-05-26T10:00:00Z',
    type: 'success',
  },
  {
    id: 'notif-2',
    title: 'Loan Payment Due',
    message: 'Your USDC loan payment of $150 is due in 3 days.',
    read: false,
    createdAt: '2026-05-25T08:00:00Z',
    type: 'warning',
  },
  {
    id: 'notif-3',
    title: 'Interest Earned',
    message: 'You earned 2.5 XLM in lending interest this week.',
    read: true,
    createdAt: '2026-05-24T12:00:00Z',
    type: 'info',
  },
];

// In-process store keyed by userId.
// Replace with a database-backed repository (e.g. Prisma, Supabase) in production.
const store = new Map<string, Notification[]>();

function seedUser(userId: string): Notification[] {
  const notifications = SEED_NOTIFICATIONS.map((n) => ({ ...n, userId }));
  store.set(userId, notifications);
  return notifications;
}

/** Returns all notifications for `userId`, seeding demo data on first access. */
export function getNotifications(userId: string): Notification[] {
  if (!store.has(userId)) seedUser(userId);
  return store.get(userId)!;
}

/** Adds a new notification for userId, emits hub events, and returns it. */
export function addNotification(userId: string, n: Omit<Notification, 'userId'>): Notification {
  const notifications = getNotifications(userId);
  const notification: Notification = { ...n, userId };
  notifications.unshift(notification);

  // Emit the raw notification event
  try {
    notificationHub.publish(userId, { type: 'notification', notification });
  } catch (e) {
    // Swallow errors from the hub to avoid breaking producers
  }

  // Emit updated unread count
  const unreadCount = notifications.filter((x) => !x.read).length;
  try {
    notificationHub.publish(userId, { type: 'unreadCount', unreadCount });
  } catch (e) {
    // noop
  }

  return notification;
}

/**
 * Marks notification `id` as read for `userId`.
 * Returns the updated notification, or null if not found.
 */
export function markNotificationRead(userId: string, id: string): Notification | null {
  const notifications = getNotifications(userId);
  const notif = notifications.find((n) => n.id === id);
  if (!notif) return null;
  notif.read = true;
  return notif;
}

/** Clears all stored notifications (used in tests). */
export function clearStore(): void {
  store.clear();
}
