import { NextRequest, NextResponse } from "next/server";
import { isTransactionStatus, TRANSACTION_STATUSES } from "@/types/enums";
import {
  verifyWebhookSignature,
  validateTimestamp,
  NonceStore,
} from "@/lib/webhooks/verify";
import { SIGNATURE_HEADER } from "@/lib/webhooks/types";
import type { WebhookPayload } from "@/lib/webhooks/types";
import { updateTransactionStatus } from "@/lib/transactions/store";

export const runtime = "nodejs";

/** Module-level nonce store for replay protection. */
const nonceStore = new NonceStore();

/**
 * POST /api/webhooks/transactions
 *
 * Signed webhook receiver for transaction status updates.
 * Verifies HMAC-SHA256 signature, validates timestamp + nonce to prevent
 * replays, and updates the transaction status in the data layer.
 *
 * @see WEBHOOKS.md for the full contract documentation.
 */
export async function POST(req: NextRequest) {
  // ── 1. Ensure the signing secret is configured ──────────────────────────
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  // ── 2. Read raw body (required for HMAC verification) ───────────────────
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json(
      { error: "Unable to read request body" },
      { status: 400 },
    );
  }

  // ── 3. Verify signature ─────────────────────────────────────────────────
  const signature = req.headers.get(SIGNATURE_HEADER);
  if (!signature || !verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json(
      { error: "Invalid or missing webhook signature" },
      { status: 401 },
    );
  }

  // ── 4. Parse & validate payload ─────────────────────────────────────────
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (payload.event !== "transaction.status_updated") {
    return NextResponse.json(
      { error: `Unsupported event type "${payload.event}"` },
      { status: 400 },
    );
  }

  if (
    typeof payload.timestamp !== "number" ||
    typeof payload.nonce !== "string" ||
    !payload.nonce
  ) {
    return NextResponse.json(
      { error: "Missing required fields: timestamp, nonce" },
      { status: 400 },
    );
  }

  if (!payload.data || typeof payload.data.transaction_id !== "string") {
    return NextResponse.json(
      { error: "Missing required field: data.transaction_id" },
      { status: 400 },
    );
  }

  // ── 5. Validate timestamp ───────────────────────────────────────────────
  if (!validateTimestamp(payload.timestamp)) {
    return NextResponse.json(
      { error: "Timestamp outside tolerance window" },
      { status: 403 },
    );
  }

  // ── 6. Check nonce for replay ───────────────────────────────────────────
  if (nonceStore.has(payload.nonce)) {
    return NextResponse.json(
      { error: "Event already processed" },
      { status: 409 },
    );
  }
  nonceStore.add(payload.nonce, payload.timestamp);

  // ── 7. Validate status ──────────────────────────────────────────────────
  if (!isTransactionStatus(payload.data.status)) {
    return NextResponse.json(
      {
        error: `Unknown status "${payload.data.status}". Supported: ${TRANSACTION_STATUSES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // ── 8. Update transaction ───────────────────────────────────────────────
  const updated = await updateTransactionStatus(
    payload.data.transaction_id,
    payload.data.status,
  );

  if (!updated) {
    return NextResponse.json(
      { error: `Transaction "${payload.data.transaction_id}" not found` },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, transaction: updated });
}
