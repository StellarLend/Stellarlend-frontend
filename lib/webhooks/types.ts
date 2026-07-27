import type { TransactionStatus } from "@/types/enums";
import type { MemoType } from "@/lib/stellar/memo";

/**
 * Payload sent by the upstream indexer/service to update transaction status.
 *
 * The optional `memo` / `memo_type` fields are populated for inbound deposits
 * so the receiver can resolve the originating Stellar account via memo.
 * They are validated at runtime against {@link webhooks/webhookDataSchema} —
 * see `lib/validation/schemas/webhooks.ts`.
 *
 * @see WEBHOOKS.md for the full contract documentation.
 */
export interface WebhookPayload {
  /** The event type. Currently only "transaction.status_updated". */
  event: "transaction.status_updated";

  /**
   * Unix timestamp (milliseconds since epoch) of when the event was generated.
   * Used for replay-protection: events outside the tolerance window are rejected.
   */
  timestamp: number;

  /** Unique event identifier (UUID recommended) to prevent replay attacks. */
  nonce: string;

  data: {
    /** The Stellarlend transaction ID (e.g. "TXN12345"). */
    transaction_id: string;

    /** The new status to set on the transaction. */
    status: TransactionStatus;

    /** Optional Stellar memo value accompanying the transaction. */
    memo?: string;

    /**
     * Optional Stellar memo type. Must be one of the four memo format
     * identifiers (`MEMO_TEXT`, `MEMO_ID`, `MEMO_HASH`, `MEMO_RETURN`) — any
     * other value is rejected with HTTP 400 by the receiving route.
     */
    memo_type?: MemoType;
  };
}

/** Supported webhook event types. */
export const WEBHOOK_EVENTS = ["transaction.status_updated"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Header name carrying the HMAC signature. */
export const SIGNATURE_HEADER = "x-webhook-signature";
