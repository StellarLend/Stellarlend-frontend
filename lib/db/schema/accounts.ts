import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
  userId: text('user_id').primaryKey(),
  displayName: text('display_name').notNull(),
  bio: text('bio').notNull().default(''),
  website: text('website').notNull().default(''),
  timezone: text('timezone').notNull().default('UTC'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
