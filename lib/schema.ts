import { pgTable, text, boolean, timestamp, primaryKey } from 'drizzle-orm/pg-core';

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: text('user_id').notNull(),
    channel: text('channel').notNull(),
    eventType: text('event_type').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.userId, table.channel, table.eventType] }),
    };
  }
);