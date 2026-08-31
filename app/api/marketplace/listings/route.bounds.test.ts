/**
 * Focused acceptance-criteria tests for bounded listing behavior:
 *  - Stale-data response headers (no caching in proxies / browsers)
 *  - Pagination safety: page size clamping, cursor validation
 *  - Filter boundary values: price floor/ceiling, adversarial enums
 *  - Response carries version and inventoryHash for client stale-detection
 *  - No internal details leak in error responses
 *
 * These extend (not replace) the existing route.test.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { resetMarketplaceStore } from "@/lib/marketplace/listingStore";
import { MARKETPLACE_BOUNDS } from "@/types/marketplace";

function get(query: string): Promise<Response> {
  return GET(new Request(`http://test.local/api/marketplace/listings?${query}`));
}

async function body(
  res: Response,
): Promise<{
  success: boolean;
  data?: { listings: Array<Record<string, unknown>>; total: number; nextCursor: string | null };
  error?: { code: string; message: string };
}> {
  return res.json();
}

describe("GET /api/marketplace/listings — stale-data response headers", () => {
  beforeEach(() => resetMarketplaceStore());

  it("sets Cache-Control: no-store on success", async () => {
    const res = await get("");
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/i);
  });

  it("sets Cache-Control: no-store on validation error", async () => {
    const res = await get("asset=UNKNOWN");
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/i);
  });

  it("every listing carries a version field for optimistic-concurrency", async () => {
    const res = await get("availability=all");
    const b = await body(res);
    for (const listing of b.data!.listings) {
      expect(typeof listing.version).toBe("number");
      expect((listing.version as number)).toBeGreaterThanOrEqual(1);
    }
  });

  it("every listing carries an inventoryHash field for stale-data detection", async () => {
    const res = await get("availability=all");
    const b = await body(res);
    for (const listing of b.data!.listings) {
      expect(typeof listing.inventoryHash).toBe("string");
      expect((listing.inventoryHash as string).length).toBeGreaterThan(0);
    }
  });
});

describe("GET /api/marketplace/listings — pagination safety", () => {
  beforeEach(() => resetMarketplaceStore());

  it("clamps pageSize above MAX_PAGE_SIZE to MAX_PAGE_SIZE", async () => {
    const over = MARKETPLACE_BOUNDS.MAX_PAGE_SIZE + 500;
    const res = await get(`availability=all&pageSize=${over}`);
    expect(res.status).toBe(200);
    const b = await body(res);
    // Should not return more items than MAX_PAGE_SIZE (seed has only 6 listings,
    // but the route must not attempt an unbounded read).
    expect(b.data!.listings.length).toBeLessThanOrEqual(MARKETPLACE_BOUNDS.MAX_PAGE_SIZE);
  });

  it("clamps pageSize of 0 to MIN_PAGE_SIZE", async () => {
    const res = await get("availability=all&pageSize=0");
    expect(res.status).toBe(200);
    const b = await body(res);
    expect(b.data!.listings.length).toBeGreaterThanOrEqual(MARKETPLACE_BOUNDS.MIN_PAGE_SIZE);
  });

  it("returns a nextCursor when more pages exist", async () => {
    const res = await get("availability=all&pageSize=2");
    const b = await body(res);
    expect(b.data!.nextCursor).toBeTruthy();
  });

  it("returns null nextCursor on the last page", async () => {
    // Fetch all 4 available listings in one page.
    const res = await get("availability=available&pageSize=100");
    const b = await body(res);
    expect(b.data!.nextCursor).toBeNull();
  });

  it("returns 400 for a cursor containing non-alphanumeric characters", async () => {
    const res = await get("cursor=abc%3Bdef"); // "abc;def"
    expect(res.status).toBe(400);
    const b = await body(res);
    expect(b.error?.code).toBe("invalid_request");
  });

  it("returns 400 for a cursor above CURSOR_MAX_LEN", async () => {
    const longCursor = "A".repeat(MARKETPLACE_BOUNDS.CURSOR_MAX_LEN + 1);
    const res = await get(`cursor=${longCursor}`);
    expect(res.status).toBe(400);
    const b = await body(res);
    expect(b.error?.code).toBe("invalid_request");
  });

  it("accepts a cursor exactly at CURSOR_MAX_LEN of alphanumeric chars", async () => {
    // A valid cursor at max length with only alphanumeric chars should not be
    // rejected at the validation layer (even if it decodes to an empty page).
    const maxCursor = "A".repeat(MARKETPLACE_BOUNDS.CURSOR_MAX_LEN);
    const res = await get(`cursor=${maxCursor}`);
    // 200 (empty page) — not 400.
    expect(res.status).toBe(200);
  });

  it("cursor-based pagination is consistent: page 1 + page 2 covers all items", async () => {
    const r1 = await body(await get("availability=all&pageSize=3"));
    expect(r1.data!.nextCursor).toBeTruthy();

    const r2 = await body(
      await get(
        `availability=all&pageSize=3&cursor=${encodeURIComponent(r1.data!.nextCursor!)}`,
      ),
    );

    const ids1 = r1.data!.listings.map((l) => l.id as string);
    const ids2 = r2.data!.listings.map((l) => l.id as string);

    // No overlap between pages.
    expect(ids1.filter((id) => ids2.includes(id))).toHaveLength(0);
    // Together they cover all 6 seed listings.
    expect(ids1.length + ids2.length).toBe(6);
  });
});

describe("GET /api/marketplace/listings — filter boundary values", () => {
  beforeEach(() => resetMarketplaceStore());

  it("returns 400 for an asset not in ALLOWED_ASSETS", async () => {
    const res = await get("asset=ETH");
    expect(res.status).toBe(400);
    const b = await body(res);
    expect(b.error?.code).toBe("invalid_request");
  });

  it("returns 400 for a category not in ALLOWED_CATEGORIES", async () => {
    const res = await get("category=options");
    expect(res.status).toBe(400);
    const b = await body(res);
    expect(b.error?.code).toBe("invalid_request");
  });

  it("returns 400 for minPrice > maxPrice", async () => {
    const res = await get("minPrice=10&maxPrice=1");
    expect(res.status).toBe(400);
    const b = await body(res);
    expect(b.error?.code).toBe("invalid_request");
  });

  it("returns 400 for minPrice at the MAX_FILTER_PRICE boundary", () => {
    return get(`minPrice=${MARKETPLACE_BOUNDS.MAX_FILTER_PRICE}`).then(async (res) => {
      expect(res.status).toBe(400);
    });
  });

  it("returns 400 for a negative minPrice", async () => {
    const res = await get("minPrice=-1");
    expect(res.status).toBe(400);
  });

  it("returns 400 for maxPrice of zero", async () => {
    const res = await get("maxPrice=0");
    expect(res.status).toBe(400);
  });

  it("silently resets an unknown sort to newest", async () => {
    const res = await get("sort=trending");
    expect(res.status).toBe(200); // Not a hard rejection — normalised to 'newest'.
  });

  it("returns all 4 available listings for USDC asset with no price filter", async () => {
    const res = await get("asset=USDC");
    const b = await body(res);
    // Seed: lst_collateral_usdc (listed), lst_receivable_usdc (listed) → 2 available.
    expect(b.data!.listings.length).toBe(2);
    for (const l of b.data!.listings) {
      expect(l.asset).toBe("USDC");
      expect(l.status).toBe("listed");
    }
  });

  it("filters by category=collateral and returns only collateral listings", async () => {
    const res = await get("category=collateral&availability=available");
    const b = await body(res);
    for (const l of b.data!.listings) {
      expect(l.category).toBe("collateral");
    }
  });

  it("price_asc sort returns listings in ascending unit price order", async () => {
    const res = await get("sort=price_asc&availability=all");
    const b = await body(res);
    const prices = b.data!.listings.map((l) => BigInt(l.unitPrice as string));
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it("price_desc sort returns listings in descending unit price order", async () => {
    const res = await get("sort=price_desc&availability=all");
    const b = await body(res);
    const prices = b.data!.listings.map((l) => BigInt(l.unitPrice as string));
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
    }
  });
});

describe("GET /api/marketplace/listings — response hygiene", () => {
  beforeEach(() => resetMarketplaceStore());

  it("success body has only documented top-level fields", async () => {
    const res = await get("");
    const b = await body(res);
    const keys = Object.keys(b).sort();
    expect(keys).toEqual(["data", "success"].sort());
    const dataKeys = Object.keys(b.data!).sort();
    expect(dataKeys).toEqual(["filters", "listings", "nextCursor", "total"].sort());
  });

  it("does not leak stack traces in error bodies", async () => {
    const res = await get("asset=UNKNOWN");
    const text = await res.text();
    expect(text).not.toMatch(/at Object\.|\.ts:\d+|node_modules/);
  });

  it("total reflects the unfiltered count before pagination", async () => {
    // All 6 seed listings regardless of availability.
    const res = await get("availability=all&pageSize=2");
    const b = await body(res);
    expect(b.data!.total).toBe(6);
    // Only 2 returned in this page.
    expect(b.data!.listings.length).toBe(2);
  });
});
