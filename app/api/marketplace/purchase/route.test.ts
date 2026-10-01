import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { resetMarketplaceStore, getListing } from "@/lib/marketplace/listingStore";

const BUYER = "GBUYER00000000000000000000000000000000000000000000000000001";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://test.local/api/marketplace/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }),
  );
}

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    listingId: "lst_collateral_usdc",
    quantity: "10",
    unitPrice: getListing("lst_collateral_usdc")!.unitPrice,
    idempotencyKey: "p_route_key_0001abcd",
    expectedVersion: getListing("lst_collateral_usdc")!.version,
    walletAddress: BUYER,
    ...overrides,
  };
}

async function purchaseUrl(listingId: string): Promise<string> {
  const body = baseRequest({ listingId });
  const res = await post(body);
  const data = (await res.json()) as { success?: boolean; data?: { purchaseId: string } };
  return data.success ? (data.data! as { purchaseId: string }).purchaseId : "";
}

describe("POST /api/marketplace/purchase", () => {
  beforeEach(() => resetMarketplaceStore());

  it("succeeds and returns the fresh listing state", async () => {
    const response = await post(baseRequest());
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      data: { purchaseId: string; quantityFilled: string; quantityRemaining: string; listingVersion: number };
    };
    expect(body.success).toBe(true);
    expect(body.data.quantityFilled).toBe("10");
    expect(body.data.quantityRemaining).toBe("990");
    expect(body.data.listingVersion).toBe(2);
  });

  it("is idempotent across retries of the same key", async () => {
    const id = await purchaseUrl("lst_collateral_usdc");
    const id2 = await purchaseUrl("lst_collateral_usdc");
    // still exactly one purchase, no double decrement
    expect(id).toBe(id2);
    expect(getListing("lst_collateral_usdc")!.quantityAvailable).toBe("990");
  });

  it("rejects a stale version with 409 and a fresh listing", async () => {
    // Burn version 1 with another buyer's, distinct purchase.
    await purchaseUrl("lst_collateral_usdc");

    // A *different* idempotency key retrying with the stale version 1.
    const response = await post(
      baseRequest({ idempotencyKey: "p_route_key2_0002efgh", expectedVersion: 1 }),
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      code: string;
      error: { code: string; freshListing: { version: number } };
    };
    expect(body.code).toBe("inventory_changed");
    expect(body.error.freshListing.version).toBe(2);
  });

  it("returns 409 when inventory runs out", async () => {
    const response = await post(baseRequest({ quantity: "50000" }));
    expect(response.status).toBe(409);
    expect(((await response.json()) as { code: string }).code).toBe("no_inventory");
  });

  it("returns 403 when a seller tries to buy their own listing", async () => {
    const response = await post(
      baseRequest({ walletAddress: getListing("lst_collateral_usdc")!.owner }),
    );
    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("unauthorized");
  });

  it("returns 422 for an out-of-bounds purchase quantity", async () => {
    const response = await post(baseRequest({ quantity: "0" }));
    expect(response.status).toBe(422);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("below_min");
  });

  it("returns 400 for a malformed body", async () => {
    const response = await post({ listingId: "" });
    expect(response.status).toBe(400);
  });
});