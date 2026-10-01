/**
 * lib/validation/schemas/webhooks.ts
 *
 * Shared Zod validation schemas for the inbound webhook endpoints.
 *
 * Webhook payloads are received from upstream services outside this
 * codebase's control, so the shape of `payload.data` is validated at
 * runtime rather than trusted from the TypeScript type alone. Any
 * malformed payload is rejected with HTTP 400 by the receiving route so
 * downstream code can rely on the parsed type without further casts.
 */

import { z } from "zod";
import { TRANSACTION_STATUSES } from "@/types/enums";

/**
 * The four Stellar memo format identifiers. Kept in sync with
 * `MemoType` in `lib/stellar/memo.ts`.
 */
export const MEMO_TYPES = [
  "MEMO_TEXT",
  "MEMO_ID",
  "MEMO_HASH",
  "MEMO_RETURN",
] as const;
export type MemoTypeInput = (typeof MEMO_TYPES)[number];

/**
 * Schema for the `data` field of a transaction webhook payload.
 *
 * - `transaction_id` is required and must be a non-empty string.
 * - `status` is required and must be one of {@link TRANSACTION_STATUSES}.
 * - `memo` is optional, but if `memo_type` is supplied a memo string should
 *   accompany it (the downstream `validateMemo(value, type)` call enforces
 *   Stellar format rules).
 * - `memo_type`, when present, is restricted to the four valid Stellar
 *   memo format identifiers — any other value is rejected with HTTP 400.
 *
 * Unknown keys on `data` are silently stripped (Zod default behaviour).
 */
export const webhookDataSchema = z.object({
  transaction_id: z.string().min(1, "data.transaction_id is required"),
  status: z.enum(TRANSACTION_STATUSES, {
    error: `data.status must be one of: ${TRANSACTION_STATUSES.join(", ")}`,
  }),
  memo: z
    .string({ error: "data.memo must be a string when provided" })
    .optional(),
  memo_type: z
    .enum(MEMO_TYPES, {
      error: `data.memo_type must be one of: ${MEMO_TYPES.join(", ")}`,
    })
    .optional(),
});

export type WebhookDataInput = z.infer<typeof webhookDataSchema>;
