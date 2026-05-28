import type { TransactionStatus } from "@/types/enums";

/**
 * Payload sent by the upstream indexer/service to update transaction status.
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
  };
}

/** Supported webhook event types. */
export const WEBHOOK_EVENTS = ["transaction.status_updated"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Header name carrying the HMAC signature. */
export const SIGNATURE_HEADER = "x-webhook-signature";
