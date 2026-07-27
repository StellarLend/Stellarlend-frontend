import { doublePrecision, index, pgTable, text } from 'drizzle-orm/pg-core';

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  amount: doublePrecision('amount').notNull(),
  asset: text('asset').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  status: text('status').notNull(),
}, (table) => ({
  dateIdIdx: index('transactions_date_id_idx').on(table.date, table.id),
}));

export type DBTransaction = typeof transactions.$inferSelect;
export type NewDBTransaction = typeof transactions.$inferInsert;
