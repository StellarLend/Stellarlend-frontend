/**
 * POST /api/marketplace/purchase/status
 *
 * Recovery endpoint. Given an `idempotencyKey`, returns the authoritative
 * outcome of a previous submission -- or `{ known: false }` if the server has
 * no record of it. This endpoint NEVER performs or repeats an on-chain action;
 * it exists so a client that lost its response can reconcile intent after an
 * interrupted wallet operation instead of guessing.
 */

import { NextResponse } from "next/server";
import { reconcilePurchase } from "@/lib/marketplace/listingStore";

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

  const raw = (body ?? {}) as Record<string, unknown>;
  const idempotencyKey = raw.idempotencyKey;
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim() === "" ||
    idempotencyKey.length > 512
  ) {
    return NextResponse.json(
      { success: false, error: { code: "invalid_request", message: "idempotencyKey is required." } },
      { status: 400, headers: NO_STORE },
    );
  }

  const result = await reconcilePurchase(idempotencyKey.trim());

  if (!result.known) {
    return NextResponse.json({ known: false }, { headers: NO_STORE });
  }

  const outcome = result.outcome;
  return NextResponse.json(
    {
      known: true,
      status: outcome.status === "succeeded" ? "succeeded" : "failed",
      ...(outcome.status === "succeeded"
        ? {
            data: {
              purchaseId: outcome.purchase.purchaseId,
              transactionHash: outcome.purchase.transactionHash,
              quantityFilled: outcome.purchase.quantity,
              listingVersion: outcome.freshListing.version,
              quantityRemaining: outcome.freshListing.quantityAvailable,
            },
          }
        : { error: { code: outcome.code, message: outcome.message } }),
    },
    { headers: NO_STORE },
  );
}