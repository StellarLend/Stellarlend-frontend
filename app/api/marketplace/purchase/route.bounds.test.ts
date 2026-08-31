/**
 * Focused acceptance-criteria tests for bounded purchase behavior:
 *  - stale-data / optimistic-concurrency protection
 *  - inventory edge cases (exactly enough, one over)
 *  - permission invariant (owner cannot buy their own listing)
 *  - idempotency across concurrent retries
 *  - freshListing is always returned in 409 bodies for client recovery
 *  - response never leaks internal structure beyond the documented schema
 *  - Cache-Control prevents stale responses in proxies and browsers
 *
 * These extend (not replace) the existing route.test.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { resetMarketplaceStore, getListing } from "@/lib/marketplace/listingStore";
import { MARKETPLACE_BOUNDS } from "@/types/marketplace";

const BUYER = "GBUYER00000000000000000000000000000000000000000000000000002";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://test.local/api/marketplace/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function base(overrides: Record<string, unknown> = {}) {
  const listing = getListing("lst_collateral_usdc")!;
  return {
    listingId: listing.id,
    quantity: "1",
    unitPrice: listing.unitPrice,
    idempotencyKey: "p_bounds_test_0001ab",
    expectedVersion: listing.version,
    walletAddress: BUYER,
    ...overrides,
  };
}

describe("POST /api/marketplace/purchase — stale-data protection", () => {
  beforeEach(() => resetMarketplaceStore());

  it("succeeds when expectedVersion matches current version", async () => {
    const listing = getListing("lst_collateral_usdc")!;
    const res = await post(base({ expectedVersion: listing.version }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("returns 409 inventory_changed when expectedVersion is stale", async () => {
    // Advance the listing to version 2 by purchasing with a different key.
    await post(base({ idempotencyKey: "p_bounds_advance_0001" }));

    const listing = getListing("lst_collateral_usdc")!;
    expect(listing.version).toBe(2); // confirm store advanced

    // Now attempt with the stale version 1.
    const res = await post(base({ expectedVersion: 1, idempotencyKey: "p_bounds_stale_0001" }));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string; error: { code: string; freshListing: { version: number } } };
    expect(body.code).toBe("inventory_changed");
    expect(body.error.freshListing.version).toBe(2);
  });

  it("includes freshListing in 409 so the client can recover without a second round-trip", async () => {
    await post(base({ idempotencyKey: "p_bounds_prime_00001" }));

    const res = await post(base({ expectedVersion: 1, idempotencyKey: "p_bounds_stale_0002" }));
    const body = (await res.json()) as {
      error: {
        freshListing: {
          id: string;
          version: number;
          unitPrice: string;
          quantityAvailable: string;
          inventoryHash: string;
        };
      };
    };
    const fl = body.error.freshListing;
    expect(fl.id).toBe("lst_collateral_usdc");
    expect(fl.version).toBeGreaterThan(1);
    expect(typeof fl.unitPrice).toBe("string");
    expect(typeof fl.quantityAvailable).toBe("string");
    // inventoryHash must be present for client stale-detection.
    expect(typeof fl.inventoryHash).toBe("string");
    expect(fl.inventoryHash.length).toBeGreaterThan(0);
  });
});

describe("POST /api/marketplace/purchase — inventory edge cases", () => {
  beforeEach(() => resetMarketplaceStore());

  it("succeeds when quantity equals available inventory exactly", async () => {
    // lst_collateral_usdc seeds with 1000 units.
    const res = await post(base({ quantity: "1000", idempotencyKey: "p_bounds_exact_0001" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { quantityRemaining: string } };
    expect(body.data.quantityRemaining).toBe("0");
  });

  it("returns 409 no_inventory when quantity exceeds available by 1", async () => {
    const res = await post(base({ quantity: "1001", idempotencyKey: "p_bounds_over_00001" }));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("no_inventory");
  });

  it("returns 409 listing_unavailable for a sold-out listing", async () => {
    // lst_claim_usdc seeds as sold_out.
    const sold = getListing("lst_claim_usdc")!;
    const res = await post(
      base({
        listingId: sold.id,
        unitPrice: sold.unitPrice,
        expectedVersion: sold.version,
        idempotencyKey: "p_bounds_soldout_001",
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("listing_unavailable");
  });

  it("returns 409 listing_unavailable for a paused listing", async () => {
    const paused = getListing("lst_collateral_xlm")!;
    const res = await post(
      base({
        listingId: paused.id,
        unitPrice: paused.unitPrice,
        expectedVersion: paused.version,
        idempotencyKey: "p_bounds_paused_0001",
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("listing_unavailable");
  });
});

describe("POST /api/marketplace/purchase — permission invariant", () => {
  beforeEach(() => resetMarketplaceStore());

  it("returns 403 when the seller tries to buy their own listing", async () => {
    const listing = getListing("lst_collateral_usdc")!;
    const res = await post(
      base({ walletAddress: listing.owner, idempotencyKey: "p_bounds_selfbuy_001" }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("unauthorized");
  });

  it("succeeds for a different wallet (not the owner)", async () => {
    const res = await post(base());
    expect(res.status).toBe(200);
  });
});

describe("POST /api/marketplace/purchase — idempotency under concurrent retries", () => {
  beforeEach(() => resetMarketplaceStore());

  it("applies the purchase exactly once when the same key is submitted concurrently", async () => {
    const key = "p_bounds_concurrent001";
    // Fire two requests with the same idempotency key at the same time.
    const [r1, r2] = await Promise.all([post(base({ idempotencyKey: key })), post(base({ idempotencyKey: key }))]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const b1 = (await r1.json()) as { data: { purchaseId: string } };
    const b2 = (await r2.json()) as { data: { purchaseId: string } };
    // Both responses carry the same purchaseId — only one write happened.
    expect(b1.data.purchaseId).toBe(b2.data.purchaseId);

    // Inventory decremented exactly once.
    expect(getListing("lst_collateral_usdc")!.quantityAvailable).toBe("999");
  });

  it("returns the original outcome for a key that previously conflicted", async () => {
    // Advance version.
    await post(base({ idempotencyKey: "p_bounds_prime_00002" }));

    // A conflicting request is stored.
    const conflictKey = "p_bounds_conflict_001";
    const first = await post(base({ idempotencyKey: conflictKey, expectedVersion: 1 }));
    expect(first.status).toBe(409);

    // A retry of the same key returns the same stored conflict, not a fresh check.
    const retry = await post(base({ idempotencyKey: conflictKey, expectedVersion: 1 }));
    expect(retry.status).toBe(409);
    const b1 = (await first.json()) as { code: string };
    const b2 = (await retry.json()) as { code: string };
    expect(b1.code).toBe(b2.code);
  });
});

describe("POST /api/marketplace/purchase — request body boundary values", () => {
  beforeEach(() => resetMarketplaceStore());

  it("returns 422 for quantity below MIN_QUANTITY", async () => {
    const res = await post(base({ quantity: "0" }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("below_min");
  });

  it("returns 422 for quantity above MAX_QUANTITY", async () => {
    const over = (BigInt(MARKETPLACE_BOUNDS.MAX_QUANTITY) + 1n).toString();
    const res = await post(base({ quantity: over }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("below_min");
  });

  it("returns 400 for a missing idempotencyKey", async () => {
    const res = await post(base({ idempotencyKey: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an idempotencyKey that is too short", async () => {
    const res = await post(base({ idempotencyKey: "ab" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a negative expectedVersion", async () => {
    const res = await post(base({ expectedVersion: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a float expectedVersion", async () => {
    const res = await post(base({ expectedVersion: 1.5 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an over-long walletAddress", async () => {
    const res = await post(
      base({ walletAddress: "G".repeat(MARKETPLACE_BOUNDS.STELLAR_ADDRESS_MAX_LEN + 1) }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-JSON body", async () => {
    const res = await POST(
      new Request("http://test.local/api/marketplace/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json {{",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_request");
  });
});

describe("POST /api/marketplace/purchase — response hygiene", () => {
  beforeEach(() => resetMarketplaceStore());

  it("never caches purchase responses", async () => {
    const res = await post(base());
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/i);
  });

  it("does not leak a stack trace or internal path in error responses", async () => {
    const res = await post(base({ quantity: "0" }));
    const text = await res.text();
    expect(text).not.toMatch(/at Object\.|\.ts:\d+|node_modules/);
  });

  it("success body contains only the documented fields", async () => {
    const res = await post(base());
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    const keys = Object.keys(body.data).sort();
    expect(keys).toEqual(
      [
        "listingVersion",
        "purchaseId",
        "quantityFilled",
        "quantityRemaining",
        "transactionHash",
      ].sort(),
    );
  });
});
