import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  type: text('type').notNull().default('info'), // 'info' | 'success' | 'warning' | 'error'
});

export type DBNotification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
