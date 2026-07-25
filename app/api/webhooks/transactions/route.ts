import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  validateTimestamp,
  NonceStore,
} from "@/lib/webhooks/verify";
import { SIGNATURE_HEADER } from "@/lib/webhooks/types";
import type { WebhookPayload } from "@/lib/webhooks/types";
import { updateTransactionStatus } from "@/lib/transactions/store";
import { enqueueNotificationInBackground } from "@/lib/notifications/repository";
import { webhookDataSchema } from "@/lib/validation/schemas/webhooks";

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
 * Now enforces and validates Stellar memos for inbound deposits.
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
  const signature = req.headers.get(SIGNATURE_HEADER) || "";
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
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

  // ── 4b. Validate the full `data` payload via Zod ─────────────────────
  // Webhook payloads come from an external service. We refuse to touch any
  // field of `payload.data` until a Zod schema has confirmed that
  // `memo_type` is one of the four valid Stellar memo format identifiers
  // and `status` is one of our canonical statuses. This replaces prior
  // `payload.data as any` / `(memoType || 'MEMO_TEXT') as any` casts with
  // a typed, runtime-validated shape, and returns 400 on malformed input.
  const dataParse = webhookDataSchema.safeParse(payload.data);
  if (!dataParse.success) {
    const issue = dataParse.error.issues[0];
    const path = issue.path.join(".") || "data";
    return NextResponse.json(
      { error: `Malformed webhook payload at ${path}: ${issue.message}` },
      { status: 400 },
    );
  }
  const data = dataParse.data;

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

  // ── 7. Validate & Enforce Stellar Memo ────────────────────────────────
  // Both `memo` and `memo_type` come from the Zod-validated `data` object,
  // so accessing them here requires no `as any` casts.
  // (Note: `data.status` was already narrowed to a valid TransactionStatus
  // by `webhookDataSchema` above so no further status check is required.)
  const { memo, memo_type: memoType } = data;

  if (memo || memoType) {
    const type = memoType ?? 'MEMO_TEXT';
    const value = memo ?? '';

    // Validate format
    if (!validateMemo(value, type)) {
      return NextResponse.json(
        { error: `Invalid memo format: "${value}" for type "${type}"` },
        { status: 400 },
      );
    }

    // Resolve account
    const accountId = resolveAccountByMemo(value, type);
    if (!accountId && isStrictModeEnabled()) {
      return NextResponse.json(
        { error: `Strict Mode Rejection: Unknown or unregistered memo: "${value}"` },
        { status: 400 },
      );
    }
  } else if (isStrictModeEnabled()) {
    // If in strict mode, ensure inbound deposits always specify a memo.
    const existingTx = await getTransaction(data.transaction_id);
    if (existingTx && existingTx.type === 'Deposit') {
      return NextResponse.json(
        { error: `Strict Mode Rejection: Inbound deposits must have a valid memo` },
        { status: 400 },
      );
    }
  }

  // ── 8. Update transaction ───────────────────────────────────────────────
  const updated = await updateTransactionStatus(
    data.transaction_id,
    data.status,
  );

  if (!updated) {
    return NextResponse.json(
      { error: `Transaction "${data.transaction_id}" not found` },
      { status: 404 },
    );
  }

  // Enqueue notification fan-out job (fire-and-forget)
  enqueueNotificationInBackground('demo-user', {
    title: 'Transaction Status Update',
    message: `Your transaction ${data.transaction_id} is now ${data.status}.`,
    type: data.status === 'Completed' ? 'success' : data.status === 'Failed' ? 'error' : 'info',
  });

  return NextResponse.json({ success: true, transaction: updated });
}
