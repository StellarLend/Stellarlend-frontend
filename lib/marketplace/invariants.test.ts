import { describe, it, expect } from "vitest";
import {
  assertListingSellable,
  assertPriceMatches,
  computeInventoryHash,
  formatUnits,
  isStale,
  normalizeAndValidateFilters,
  parseUnits,
  validatePurchaseRequest,
} from "./invariants";
import { MARKETPLACE_BOUNDS } from "@/types/marketplace";
import type { MarketplaceListing } from "@/types/marketplace";

function sampleListing(overrides: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    id: "lst_1",
    owner: "GOWNER",
    title: "t",
    asset: "USDC",
    category: "collateral",
    unitPrice: "10000000",
    quantityAvailable: "500",
    status: "listed",
    version: 1,
    inventoryHash: "abc",
    createdAt: "t0",
    updatedAt: "t0",
    ...overrides,
  };
}

const validRequest = {
  listingId: "lst_1",
  quantity: "10",
  unitPrice: "10000000",
  idempotencyKey: "p_abcdef0123456789",
  expectedVersion: 1,
  walletAddress: "GBUYER00000000000000000000000000000000000000000000000000001",
};

describe("parseUnits / formatUnits", () => {
  it("parses and formats at the configured precision", () => {
    expect(formatUnits(parseUnits("1.25", 7), 7)).toBe("1.25");
    expect(formatUnits(parseUnits("0", 7), 7)).toBe("0");
    expect(formatUnits(parseUnits("100", 7), 7)).toBe("100");
    expect(parseUnits("1.0000000", 7).toString()).toBe(BigInt(10 ** 7).toString());
  });

  it("rejects malformed or negative prices", () => {
    expect(() => parseUnits("abc", 7)).toThrow();
    expect(() => parseUnits("1.2.3", 7)).toThrow();
  });
});

describe("normalizeAndValidateFilters", () => {
  it("keeps valid price bounds and defaults availability/sort", () => {
    const res = normalizeAndValidateFilters({ minPrice: "1.00", maxPrice: "5.00" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.minPrice).toBe("1.00");
      expect(res.value.maxPrice).toBe("5.00");
      expect(res.value.availability).toBe("available");
      expect(res.value.sort).toBe("newest");
    }
  });

  it("clamps pageSize into the allowed range", () => {
    const over = normalizeAndValidateFilters({ pageSize: "1000" });
    expect(over.ok).toBe(true);
    if (over.ok) expect(over.value.pageSize).toBe(MARKETPLACE_BOUNDS.MAX_PAGE_SIZE);

    const under = normalizeAndValidateFilters({ pageSize: "0" });
    expect(under.ok).toBe(true);
    if (under.ok) expect(under.value.pageSize).toBe(MARKETPLACE_BOUNDS.MIN_PAGE_SIZE);
  });

  it("rejects minPrice greater than maxPrice", () => {
    const res = normalizeAndValidateFilters({ minPrice: "9", maxPrice: "1" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid_request");
  });

  it("rejects a non-existent asset", () => {
    const res = normalizeAndValidateFilters({ asset: "EUR" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid_request");
  });

  it("rejects an over-limit price filter", () => {
    const res = normalizeAndValidateFilters({
      minPrice: MARKETPLACE_BOUNDS.MAX_FILTER_PRICE,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects a malformed cursor", () => {
    const res = normalizeAndValidateFilters({ cursor: ";; drop --" });
    expect(res.ok).toBe(false);
  });
});

describe("validatePurchaseRequest", () => {
  it("accepts a valid request and returns a normalized context", () => {
    const res = validatePurchaseRequest(validRequest);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.idempotencyKey).toBe(validRequest.idempotencyKey);
      expect(res.value.quantity).toBe("10");
      expect(res.value.expectedVersion).toBe(1);
    }
  });

  it("rejects missing listingId", () => {
    const res = validatePurchaseRequest({ ...validRequest, listingId: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid_request");
  });

  it("rejects an out-of-bounds quantity as below_min", () => {
    const zero = validatePurchaseRequest({ ...validRequest, quantity: "0" });
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.code).toBe("below_min");

    const huge = validatePurchaseRequest({
      ...validRequest,
      quantity: "9999999999999999999999",
    });
    expect(huge.ok).toBe(false);
    if (!huge.ok) expect(huge.code).toBe("below_min");
  });

  it("treats unitPrice as exact (already-scaled) base units, rejecting decimals", () => {
    // The catalog serves listing.unitPrice in base units; echoing it must stay
    // a plain integer so the client never triggers a phantom price_changed.
    const echoed = validatePurchaseRequest({ ...validRequest, unitPrice: "12500000" });
    expect(echoed.ok).toBe(true);

    const decimal = validatePurchaseRequest({ ...validRequest, unitPrice: "1.25" });
    expect(decimal.ok).toBe(false);
  });

  it("rejects a too-short idempotency key", () => {
    const res = validatePurchaseRequest({ ...validRequest, idempotencyKey: "ab" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid_request");
  });

  it("rejects a non-integer or negative expectedVersion", () => {
    expect(validatePurchaseRequest({ ...validRequest, expectedVersion: 1.5 }).ok).toBe(false);
    expect(validatePurchaseRequest({ ...validRequest, expectedVersion: -1 }).ok).toBe(false);
    expect(validatePurchaseRequest({ ...validRequest, expectedVersion: "1" }).ok).toBe(false);
  });

  it("rejects an over-long wallet address", () => {
    const res = validatePurchaseRequest({
      ...validRequest,
      walletAddress: "G".repeat(200),
    });
    expect(res.ok).toBe(false);
  });
});

describe("assertListingSellable", () => {
  it("rejects a missing listing as unavailable", () => {
    const res = assertListingSellable(undefined, 1n);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("listing_unavailable");
  });

  it("rejects a non-listed listing", () => {
    const res = assertListingSellable(sampleListing({ status: "paused" }), 1n);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("listing_unavailable");
  });

  it("rejects insufficient inventory", () => {
    const res = assertListingSellable(sampleListing({ quantityAvailable: "5" }), 10n);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("no_inventory");
  });

  it("accepts a sellable listing with sufficient inventory", () => {
    const res = assertListingSellable(sampleListing(), 10n);
    expect(res.ok).toBe(true);
  });
});

describe("assertPriceMatches / isStale", () => {
  it("detects a price change", () => {
    const res = assertPriceMatches(sampleListing({ unitPrice: "20000000" }), 10000000n);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("price_changed");
  });

  it("accepts an unchanged price", () => {
    expect(assertPriceMatches(sampleListing({ unitPrice: "10000000" }), 10000000n).ok).toBe(true);
  });

  it("detects staleness by version", () => {
    expect(isStale(sampleListing(), 1)).toBe(false);
    expect(isStale(sampleListing({ version: 3 }), 1)).toBe(true);
  });
});

describe("computeInventoryHash", () => {
  it("is deterministic for an unchanged listing", () => {
    const a = sampleListing();
    expect(computeInventoryHash(a)).toBe(computeInventoryHash(sampleListing()));
  });

  it("changes when quantity, price, version or status change", () => {
    const base = computeInventoryHash(sampleListing());
    expect(computeInventoryHash(sampleListing({ quantityAvailable: "501" }))).not.toBe(base);
    expect(computeInventoryHash(sampleListing({ unitPrice: "9000000" }))).not.toBe(base);
    expect(computeInventoryHash(sampleListing({ version: 2 }))).not.toBe(base);
    expect(computeInventoryHash(sampleListing({ status: "paused" }))).not.toBe(base);
  });
});