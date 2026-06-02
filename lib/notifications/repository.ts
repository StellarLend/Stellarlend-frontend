import type { Notification } from './types';
import { enqueue, type NotificationsJobPayload } from '@/lib/queue';
import { logger } from '@/lib/logger';

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
const ROUTE = 'lib/notifications/repository';

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

/**
 * Adds a new notification for a user.
 */
export function addNotification(
  userId: string,
  notification: Omit<Notification, 'userId'>
): Notification {
  const notifications = getNotifications(userId);
  const record: Notification = {
    ...notification,
    userId,
  };
  notifications.unshift(record);
  store.set(userId, notifications);
  return record;
}

/**
 * Enqueues notification fan-out to a BullMQ worker.
 */
export async function enqueueNotification(
  userId: string,
  notification: Omit<NotificationsJobPayload, 'userId'>,
): Promise<void> {
  await enqueue('notifications', {
    userId,
    ...notification,
  });
}

/**
 * Fire-and-forget convenience wrapper for API handlers.
 */
export function enqueueNotificationInBackground(
  userId: string,
  notification: Omit<NotificationsJobPayload, 'userId'>,
): void {
  void enqueueNotification(userId, notification).catch((error) => {
    logger.warn('Failed to enqueue notification', ROUTE, {
      userId,
      error: String(error),
    });
  });
}

/** Clears all stored notifications (used in tests). */
export function clearStore(): void {
  store.clear();
}
