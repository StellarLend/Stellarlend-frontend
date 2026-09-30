import { doublePrecision, index, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { TRANSACTION_TYPES, ASSET_SYMBOLS, TRANSACTION_STATUSES } from '@/types/enums';

export const transactionTypeEnum = pgEnum('transaction_type', [...TRANSACTION_TYPES]);
export const assetSymbolEnum = pgEnum('asset_symbol', [...ASSET_SYMBOLS]);
export const transactionStatusEnum = pgEnum('transaction_status', [...TRANSACTION_STATUSES]);

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  type: transactionTypeEnum('type').notNull(),
  amount: doublePrecision('amount').notNull(),
  asset: assetSymbolEnum('asset').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  status: transactionStatusEnum('status').notNull(),
}, (table) => ({
  dateIdIdx: index('transactions_date_id_idx').on(table.date, table.id),
}));

export type DBTransaction = typeof transactions.$inferSelect;
export type NewDBTransaction = typeof transactions.$inferInsert;
