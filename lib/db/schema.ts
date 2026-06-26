import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('profiles', {
  userId: text('userId').primaryKey(),
  displayName: text('displayName').notNull(),
  bio: text('bio').notNull().default(''),
  website: text('website').notNull().default(''),
  timezone: text('timezone').notNull().default('UTC'),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export const outboxEvents = sqliteTable('outbox_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'notification' | 'audit'
  payload: text('payload').notNull(), // JSON string
  status: text('status').notNull().default('PENDING'), // 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  attempts: integer('attempts').notNull().default(0),
  lastError: text('lastError'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  processedAt: integer('processedAt', { mode: 'timestamp' }),
});
