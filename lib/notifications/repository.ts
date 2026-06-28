import type { Notification } from './types';
import { enqueue, type NotificationsJobPayload } from '@/lib/queue';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { notifications as notificationsTable } from '@/lib/db/schema/notifications';
import { eq, desc, and, sql } from 'drizzle-orm';
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
const ROUTE = 'lib/notifications/repository';

async function seedUser(userId: string): Promise<Notification[]> {
  const seeded = SEED_NOTIFICATIONS.map((n) => ({
    id: `${userId}-${n.id}`,
    userId,
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: new Date(n.createdAt),
    type: n.type,
  }));

  for (const item of seeded) {
    await db.insert(notificationsTable).values(item).onConflictDoNothing();
  }

  return seeded.map((x) => ({
    id: x.id.replace(`${userId}-`, ''),
    userId: x.userId,
    title: x.title,
    message: x.message,
    read: x.read,
    createdAt: x.createdAt.toISOString(),
    type: x.type as any,
  }));
}

/** Returns all notifications for `userId`, seeding demo data on first access. */
export async function getNotifications(userId: string): Promise<Notification[]> {
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt));

  if (rows.length === 0) {
    return await seedUser(userId);
  }

  return rows.map((r) => ({
    id: r.id.replace(`${userId}-`, ''),
    userId: r.userId,
    title: r.title,
    message: r.message,
    read: r.read,
    createdAt: r.createdAt.toISOString(),
    type: r.type as any,
  }));
}

/** Adds a new notification for userId, emits hub events, and returns it. */
export async function addNotification(
  userId: string,
  n: Omit<Notification, 'userId'>,
): Promise<Notification> {
  const dbId = `${userId}-${n.id}`;
  const record = {
    id: dbId,
    userId,
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: new Date(n.createdAt || new Date().toISOString()),
    type: n.type,
  };

  await db
    .insert(notificationsTable)
    .values(record)
    .onConflictDoUpdate({
      target: notificationsTable.id,
      set: {
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: record.createdAt,
        type: n.type,
      },
    });

  const notification: Notification = {
    ...n,
    userId,
  };

  // Emit the raw notification event
  try {
    notificationHub.publish(userId, { type: 'notification', notification });
  } catch (e) {
    // Swallow errors from the hub to avoid breaking producers
  }

  // Emit updated unread count
  try {
    const list = await getNotifications(userId);
    const unreadCount = list.filter((x) => !x.read).length;
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
export async function markNotificationRead(
  userId: string,
  id: string,
): Promise<Notification | null> {
  const dbId = `${userId}-${id}`;

  const [row] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, dbId), eq(notificationsTable.userId, userId)))
    .returning();

  if (!row) return null;

  return {
    id: row.id.replace(`${userId}-`, ''),
    userId: row.userId,
    title: row.title,
    message: row.message,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
    type: row.type as any,
  };
}

/**
 * Marks all unread notifications as read for `userId`.
 * Returns the count of updated notifications.
 */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const rows = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)))
    .returning({ id: notificationsTable.id });

  const count = rows.length;

  if (count > 0) {
    try {
      notificationHub.publish(userId, { type: 'unreadCount', unreadCount: 0 });
    } catch (e) {
      // noop
    }
  }

  return count;
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
export async function clearStore(): Promise<void> {
  await db.delete(notificationsTable);
}

/** Removes all notifications for a specific user (used during account deletion). */
export function removeNotificationsByUserId(userId: string): number {
  const notifications = store.get(userId);
  if (!notifications) return 0;
  const count = notifications.length;
  store.delete(userId);
  return count;
}
