/**
 * POST /api/marketplace/purchase
 *
 * Executes a purchase atomically and idempotently.
 *
 *  - Requests carry an `idempotencyKey` so a retried submission never runs the
 *    on-chain action twice (the store returns the original outcome).
 *  - Requests carry the `expectedVersion` the client loaded; if inventory
 *    changed underneath, the server answers 409 with the fresh listing so the
 *    client can recover without silently over-committing user intent.
 */

import { NextResponse } from "next/server";
import { validatePurchaseRequest } from "@/lib/marketplace/invariants";
import { purchaseListing } from "@/lib/marketplace/listingStore";

const NO_STORE: Record<string, string> = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "invalid_request", message: "Malformed JSON body." } },
      { status: 400, headers: NO_STORE },
    );
  }

  const validation = validatePurchaseRequest(
    (body ?? {}) as Record<string, unknown>,
  );
  if (!validation.ok) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: validation.code,
          message: validation.message,
        },
      },
      { status: validation.code === "invalid_request" ? 400 : 422, headers: NO_STORE },
    );
  }

  const outcome = await purchaseListing(validation.value);

  if (outcome.status === "succeeded") {
    return NextResponse.json(
      {
        success: true,
        data: {
          purchaseId: outcome.purchase.purchaseId,
          transactionHash: outcome.purchase.transactionHash,
          quantityFilled: outcome.purchase.quantity,
          listingVersion: outcome.freshListing.version,
          quantityRemaining: outcome.freshListing.quantityAvailable,
        },
      },
      { headers: NO_STORE },
    );
  }

  const statusCode =
    outcome.code === "unauthorized"
      ? 403
      : outcome.code === "listing_unavailable"
        ? 410
        : 409;

  return NextResponse.json(
    {
      success: false,
      code: outcome.code,
      error: {
        code: outcome.code,
        message: outcome.message,
        ...(outcome.freshListing ? { freshListing: outcome.freshListing } : {}),
      },
    },
    { status: statusCode, headers: NO_STORE },
  );
}