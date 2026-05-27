import { z } from "zod";

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  account: z.string().min(1).max(56).optional(),
  type: z
    .enum(["send", "receive", "swap", "lend", "borrow", "repay"])
    .optional(),
  status: z.enum(["pending", "completed", "failed"]).optional(),
  from: z.coerce.number().int().positive().optional(),
  to: z.coerce.number().int().positive().optional(),
});

export const transactionBodySchema = z.object({
  amount: z.coerce
    .number()
    .positive("Amount must be positive")
    .max(1000000000, "Amount exceeds maximum"),
  asset: z.string().min(1).max(64, "Asset must be 64 characters or less"),
  recipient: z.string().min(1).max(56, "Invalid recipient address"),
  memo: z.string().max(28, "Memo must be 28 characters or less").optional(),
});

export const transactionResponseSchema = z.object({
  id: z.string(),
  hash: z.string(),
  amount: z.number(),
  asset: z.string(),
  sender: z.string(),
  recipient: z.string(),
  status: z.enum(["pending", "completed", "failed"]),
  type: z.enum(["send", "receive", "swap", "lend", "borrow", "repay"]),
  timestamp: z.number(),
  memo: z.string().optional(),
});

export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
export type TransactionBodyInput = z.infer<typeof transactionBodySchema>;
export type TransactionResponse = z.infer<typeof transactionResponseSchema>;
