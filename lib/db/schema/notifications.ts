/**
 * Canonical Postgres schema file for managing user notification events.
 * Note: Notification preferences (settings) are handled via lib/account/preferences-repository.ts
 * rather than a Postgres schema table.
 */
import { pgEnum, pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const notificationTypeEnum = pgEnum('notification_type', ['info', 'success', 'warning', 'error']);

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  type: notificationTypeEnum('type').notNull().default('info'),
});

export type DBNotification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
