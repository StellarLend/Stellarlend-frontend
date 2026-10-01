import { describe, it, expect, beforeEach } from "vitest";
import {
  listListings,
  purchaseListing,
  reconcilePurchase,
  resetMarketplaceStore,
  getListing,
} from "./listingStore";

const BUYER = "GBUYER00000000000000000000000000000000000000000000000000001";
const SELLER_ONE = "GSELLER00000000000000000000000000000000000000000000000001";

function purchaseInput(listingId: string, overrides: Partial<Parameters<typeof purchaseListing>[0]> = {}) {
  return {
    listingId,
    quantity: "10",
    unitPrice: getListing(listingId)!.unitPrice,
    idempotencyKey: "p_testkey_" + Math.random().toString(36).slice(2, 16),
    walletAddress: BUYER,
    expectedVersion: getListing(listingId)!.version,
    ...overrides,
  };
}

describe("listing store filtering and pagination", () => {
  beforeEach(() => resetMarketplaceStore());

  it("lists only available (listed) listings by default", () => {
    const res = listListings({ availability: "available", sort: "newest" });
    expect(res.total).toBe(4);
    expect(res.listings.every((l) => l.status === "listed")).toBe(true);
  });

  it("filters by asset, category and price bounds", () => {
    const usdc = listListings({ availability: "all", asset: "USDC", sort: "newest" });
    expect(usdc.listings.every((l) => l.asset === "USDC")).toBe(true);

    const claim = listListings({ availability: "all", category: "claim", sort: "newest" });
    expect(claim.listings.every((l) => l.category === "claim")).toBe(true);

    // Low-priced XLM listings only (0.02 and 0.05).
    const cheap = listListings({
      availability: "all",
      maxPrice: "0.05",
      sort: "price_asc",
    });
    expect(cheap.listings.map((l) => l.id).sort()).toEqual(
      ["lst_claim_xlm", "lst_receivable_xlm"].sort(),
    );
  });

  it("sorts by price ascending", () => {
    const res = listListings({ availability: "all", sort: "price_asc" });
    const prices = res.listings.map((l) => BigInt(l.unitPrice));
    const sorted = [...prices].sort((a, b) => Number(a - b));
    expect(prices).toEqual(sorted);
  });

  it("paginates with an opaque cursor", () => {
    const page1 = listListings({ availability: "all", sort: "newest", pageSize: 2 });
    expect(page1.listings).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();
    expect(page1.total).toBe(6);

    const page2 = listListings({ availability: "all", sort: "newest", pageSize: 2, cursor: page1.nextCursor });
    expect(page2.listings).toHaveLength(2);
    expect(page2.nextCursor).toBeTruthy();

    const ids = new Set([...page1.listings, ...page2.listings].map((l) => l.id));
    expect(ids.size).toBe(4);
  });
});

describe("purchase invariants", () => {
  beforeEach(() => resetMarketplaceStore());

  it("consumes inventory atomically and bumps the version + inventory hash", async () => {
    const before = getListing("lst_collateral_usdc")!;
    const outcome = await purchaseListing(purchaseInput("lst_collateral_usdc", { quantity: "100" }));

    expect(outcome.status).toBe("succeeded");
    if (outcome.status === "succeeded") {
      const after = getListing("lst_collateral_usdc")!;
      expect(after.quantityAvailable).toBe("900");
      expect(after.version).toBe(before.version + 1);
      expect(after.inventoryHash).not.toBe(before.inventoryHash);
    }
  });

  it("is idempotent: a retry with the same key never double-consumes", async () => {
    const key = "p_fixed_key_1234567890";
    const input = { ...purchaseInput("lst_collateral_usdc"), idempotencyKey: key };
    const first = await purchaseListing(input);
    const second = await purchaseListing(input);

    expect(first.status).toBe("succeeded");
    expect(second.status).toBe("succeeded");
    if (first.status === "succeeded" && second.status === "succeeded") {
      expect(second.purchase.purchaseId).toBe(first.purchase.purchaseId);
    }
    expect(getListing("lst_collateral_usdc")!.quantityAvailable).toBe("990");
  });

  it("rejects insufficient inventory", async () => {
    const outcome = await purchaseListing(
      purchaseInput("lst_claim_usdc", { quantity: "1" }), // sold_out listing
    );
    expect(outcome.status).toBe("conflict");
    if (outcome.status === "conflict") expect(outcome.code).toBe("listing_unavailable");

    const over = await purchaseListing(
      purchaseInput("lst_collateral_usdc", { quantity: "5000" }),
    );
    expect(over.status).toBe("conflict");
    if (over.status === "conflict") expect(over.code).toBe("no_inventory");
  });

  it("rejects a stale version with inventory_changed and the fresh listing", async () => {
    // Load version 1, consume once (version 2), then retry with the stale
    // version 1 the client actually captured.
    const listing = getListing("lst_collateral_usdc")!;
    await purchaseListing(
      purchaseInput("lst_collateral_usdc", {
        quantity: "100",
        idempotencyKey: "p_key_a_111",
        expectedVersion: listing.version,
      }),
    );
    const outcome = await purchaseListing(
      purchaseInput("lst_collateral_usdc", {
        quantity: "100",
        idempotencyKey: "p_key_b_222",
        expectedVersion: listing.version, // stale now
      }),
    );
    expect(outcome.status).toBe("conflict");
    if (outcome.status === "conflict") {
      expect(outcome.code).toBe("inventory_changed");
      expect(outcome.freshListing?.version).toBe(2);
    }
  });

  it("rejects a price mismatch", async () => {
    const outcome = await purchaseListing(
      purchaseInput("lst_collateral_usdc", {
        unitPrice: "1",
        idempotencyKey: "p_key_c_333",
      }),
    );
    expect(outcome.status).toBe("conflict");
    if (outcome.status === "conflict") expect(outcome.code).toBe("price_changed");
  });

  it("forbids a seller purchasing their own listing", async () => {
    const outcome = await purchaseListing(
      purchaseInput("lst_collateral_usdc", {
        quantity: "1",
        walletAddress: SELLER_ONE,
        idempotencyKey: "p_key_d_444",
      }),
    );
    expect(outcome.status).toBe("conflict");
    if (outcome.status === "conflict") expect(outcome.code).toBe("unauthorized");
  });

  it("serialises concurrent purchases so inventory is never over-sold", async () => {
    // Both start from version 1 and demand more stock than exists combined.
    const a = purchaseListing(
      purchaseInput("lst_collateral_usdc", { quantity: "600", idempotencyKey: "p_con_a_1" }),
    );
    const b = purchaseListing(
      purchaseInput("lst_collateral_usdc", { quantity: "600", idempotencyKey: "p_con_b_2" }),
    );

    const [ra, rb] = await Promise.all([a, b]);
    const succeeded = [ra, rb].filter((r) => r.status === "succeeded").length;
    expect(succeeded).toBe(1);

    // Exactly one full 60% was consumed; the loser got an inventory conflict.
    const remaining = BigInt(getListing("lst_collateral_usdc")!.quantityAvailable);
    expect(remaining).toBe(400n);
  });
});

describe("reconcile (recovery)", () => {
  beforeEach(() => resetMarketplaceStore());

  it("reports unknown for a key the server never processed", async () => {
    const res = await reconcilePurchase("p_never_used_000000");
    expect(res.known).toBe(false);
  });

  it("returns the authoritative outcome for a processed key", async () => {
    const key = "p_reconcile_unique_key1";
    await purchaseListing(purchaseInput("lst_receivable_xlm", { idempotencyKey: key }));
    const res = await reconcilePurchase(key);
    expect(res.known).toBe(true);
    if (res.known) expect(res.outcome.status).toBe("succeeded");
  });

  it("returns the stored conflict for a processed-but-rejected key", async () => {
    const key = "p_reconcile_rejected1";
    const listing = getListing("lst_collateral_usdc")!;
    await purchaseListing({
      listingId: listing.id,
      quantity: "10",
      unitPrice: listing.unitPrice,
      idempotencyKey: key,
      walletAddress: BUYER,
      expectedVersion: listing.version + 99, // force stale
    });
    const res = await reconcilePurchase(key);
    expect(res.known).toBe(true);
    if (res.known) {
      expect(res.outcome.status).toBe("conflict");
      if (res.outcome.status === "conflict") expect(res.outcome.code).toBe("inventory_changed");
    }
  });
});