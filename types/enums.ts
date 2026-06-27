/**
 * Canonical vocabulary for Stellarlend transactions.
 * This is the single source of truth used by the API layer and UI.
 * See VOCABULARY.md for the full supported set and migration notes.
 */

export const ASSET_SYMBOLS = ["XLM", "USDC", "BTC", "ETH"] as const;
export type AssetSymbol = (typeof ASSET_SYMBOLS)[number];

export const TRANSACTION_TYPES = [
  "Deposit",
  "Withdrawal",
  "Lend Funds",
  "Loan Payment",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = ["Completed", "Processing", "Failed"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Type-guard: returns true if `v` is a valid AssetSymbol. */
export function isAssetSymbol(v: unknown): v is AssetSymbol {
  return ASSET_SYMBOLS.includes(v as AssetSymbol);
}

/** Type-guard: returns true if `v` is a valid TransactionType. */
export function isTransactionType(v: unknown): v is TransactionType {
  return TRANSACTION_TYPES.includes(v as TransactionType);
}

/** Type-guard: returns true if `v` is a valid TransactionStatus. */
export function isTransactionStatus(v: unknown): v is TransactionStatus {
  return TRANSACTION_STATUSES.includes(v as TransactionStatus);
}
