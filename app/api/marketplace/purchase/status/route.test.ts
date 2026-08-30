import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { POST as PurchasePOST } from "../route";
import { resetMarketplaceStore, getListing } from "@/lib/marketplace/listingStore";

const BUYER = "GBUYER00000000000000000000000000000000000000000000000000001";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://test.local/api/marketplace/purchase/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }),
  );
}

function purchaseBody(key: string) {
  const listing = getListing("lst_collateral_usdc")!;
  return {
    listingId: listing.id,
    quantity: "10",
    unitPrice: listing.unitPrice,
    idempotencyKey: key,
    expectedVersion: listing.version,
    walletAddress: BUYER,
  };
}

describe("POST /api/marketplace/purchase/status", () => {
  beforeEach(() => resetMarketplaceStore());

  it("returns known:false for a key the server never processed", async () => {
    const response = await post({ idempotencyKey: "p_never_seen_key_0001" });
    expect(response.status).toBe(200);
    expect((await response.json()) as { known: boolean }).toEqual({ known: false });
  });

  it("returns the authoritative outcome for a processed purchase", async () => {
    const key = "p_status_known_key_0001";
    await PurchasePOST(
      new Request("http://test.local/api/marketplace/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(purchaseBody(key)),
      }),
    );

    const response = await post({ idempotencyKey: key });
    const body = (await response.json()) as { known: boolean; status: string; data: unknown };
    expect(body.known).toBe(true);
    expect(body.status).toBe("succeeded");
    expect(body.data).toBeTruthy();
  });

  it("reports the stored failure for a processed-but-rejected key", async () => {
    const key = "p_status_conflict_key1";
    const conflictBody = { ...purchaseBody(key), expectedVersion: getListing("lst_collateral_usdc")!.version + 99 };
    await PurchasePOST(
      new Request("http://test.local/api/marketplace/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conflictBody),
      }),
    );

    const response = await post({ idempotencyKey: key });
    const body = (await response.json()) as { known: boolean; status: string; error: { code: string } };
    expect(body.known).toBe(true);
    expect(body.status).toBe("failed");
    expect(body.error.code).toBe("inventory_changed");
  });

  it("rejects a missing idempotency key", async () => {
    const response = await post({});
    expect(response.status).toBe(400);
  });

  it("never performs an action during recovery (no purchase recorded)", async () => {
    const key = "p_status_noop_key_0001";
    await post({ idempotencyKey: key });
    // The status route only ever reads; the key is still unknown afterwards.
    const followUp = await post({ idempotencyKey: key });
    expect(((await followUp.json()) as { known: boolean }).known).toBe(false);
  });
});