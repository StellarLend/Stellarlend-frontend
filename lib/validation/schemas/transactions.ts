import { z } from "zod";
import {
  ASSET_SYMBOLS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  isAssetSymbol,
  isTransactionType,
  isTransactionStatus,
} from "@/types/enums";

/** Defaults shared with `GET /api/transactions`. */
export const TRANSACTION_DEFAULT_PAGE = 1;
export const TRANSACTION_DEFAULT_PAGE_SIZE = 6;
export const TRANSACTION_MAX_PAGE_SIZE = 100;

function softPositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return max !== undefined ? Math.min(parsed, max) : parsed;
}

/**
 * Query-parameter schema for `GET /api/transactions`.
 *
 * Matches the real handler params (page/pageSize/asset/type/status/search/
 * dateFrom/dateTo/sortBy/sortDir). Invalid page/pageSize values fall back to
 * defaults (same soft-parse behavior the route used before).
 */
export const transactionQuerySchema = z
  .object({
    page: z.unknown().optional(),
    pageSize: z.unknown().optional(),
    asset: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.unknown().optional(),
    sortDir: z.unknown().optional(),
    cursor: z.string().optional(),
    limit: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.asset !== undefined && !isAssetSymbol(value.asset)) {
      ctx.addIssue({
        code: "custom",
        path: ["asset"],
        message: `Unknown asset "${value.asset}". Supported: ${ASSET_SYMBOLS.join(", ")}`,
      });
    }
    if (value.type !== undefined && !isTransactionType(value.type)) {
      ctx.addIssue({
        code: "custom",
        path: ["type"],
        message: `Unknown type "${value.type}". Supported: ${TRANSACTION_TYPES.join(", ")}`,
      });
    }
    if (value.status !== undefined && !isTransactionStatus(value.status)) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: `Unknown status "${value.status}". Supported: ${TRANSACTION_STATUSES.join(", ")}`,
      });
    }
  })
  .transform((value) => ({
    page: softPositiveInt(value.page, TRANSACTION_DEFAULT_PAGE),
    pageSize: softPositiveInt(
      value.pageSize,
      TRANSACTION_DEFAULT_PAGE_SIZE,
      TRANSACTION_MAX_PAGE_SIZE,
    ),
    asset: value.asset as (typeof ASSET_SYMBOLS)[number] | undefined,
    type: value.type as (typeof TRANSACTION_TYPES)[number] | undefined,
    status: value.status as (typeof TRANSACTION_STATUSES)[number] | undefined,
    search: value.search,
    dateFrom: value.dateFrom,
    dateTo: value.dateTo,
    sortBy: (value.sortBy === "amount" ? "amount" : "date") as "date" | "amount",
    sortDir: (value.sortDir === "asc" ? "asc" : "desc") as "asc" | "desc",
    cursor: value.cursor,
    limit: value.limit,
  }));

/**
 * Body schema for `POST /api/transactions`.
 * Validates against the canonical transaction vocabulary in `types/enums`.
 */
export const transactionBodySchema = z
  .object({
    asset: z.unknown().optional(),
    type: z.unknown().optional(),
    status: z.unknown().optional(),
    amount: z.unknown().optional(),
    date: z.unknown().optional(),
    time: z.unknown().optional(),
  })
  .superRefine((value, ctx) => {
    if (!isAssetSymbol(value.asset)) {
      ctx.addIssue({
        code: "custom",
        path: ["asset"],
        message: `Unknown asset "${String(value.asset)}". Supported: ${ASSET_SYMBOLS.join(", ")}`,
      });
    }
    if (!isTransactionType(value.type)) {
      ctx.addIssue({
        code: "custom",
        path: ["type"],
        message: `Unknown type "${String(value.type)}". Supported: ${TRANSACTION_TYPES.join(", ")}`,
      });
    }
    if (!isTransactionStatus(value.status)) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: `Unknown status "${String(value.status)}". Supported: ${TRANSACTION_STATUSES.join(", ")}`,
      });
    }
    if (typeof value.amount !== "number") {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "amount must be a number",
      });
    }
    if (!value.date || typeof value.date !== "string") {
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: "date and time are required",
      });
    }
    if (!value.time || typeof value.time !== "string") {
      ctx.addIssue({
        code: "custom",
        path: ["time"],
        message: "date and time are required",
      });
    }
  })
  .transform((value) => ({
    asset: value.asset as (typeof ASSET_SYMBOLS)[number],
    type: value.type as (typeof TRANSACTION_TYPES)[number],
    status: value.status as (typeof TRANSACTION_STATUSES)[number],
    amount: value.amount as number,
    date: value.date as string,
    time: value.time as string,
  }));

export const transactionResponseSchema = z.object({
  id: z.string(),
  asset: z.enum(ASSET_SYMBOLS),
  type: z.enum(TRANSACTION_TYPES),
  status: z.enum(TRANSACTION_STATUSES),
  amount: z.number(),
  date: z.string(),
  time: z.string(),
});

export const transactionIdSchema = z.string().regex(/^(TXN\d+|[0-9a-fA-F]{64})$/, {
  message:
    "Invalid transaction ID format. Must be either a mock ID (TXN followed by digits) or a 64-character hex transaction hash.",
});

export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
export type TransactionBodyInput = z.infer<typeof transactionBodySchema>;
export type TransactionResponse = z.infer<typeof transactionResponseSchema>;
