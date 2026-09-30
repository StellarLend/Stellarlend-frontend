import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { resetMarketplaceStore } from "@/lib/marketplace/listingStore";

function get(query: string): Promise<Response> {
  return GET(new Request(`http://test.local/api/marketplace/listings?${query}`));
}

async function json(response: Response): Promise<{ success: boolean; data?: { listings: unknown[]; total: number; nextCursor: string | null }; error?: { code: string; message: string } }> {
  return response.json();
}

describe("GET /api/marketplace/listings", () => {
  beforeEach(() => resetMarketplaceStore());

  it("returns available listings by default with a bounded page size", async () => {
    const response = await get("");
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.success).toBe(true);
    expect(body.data!.listings.length).toBe(4);
    expect(body.data!.total).toBe(4);
    expect(body.data!.nextCursor).toBeNull();
  });

  it("applies price, asset and category filters", async () => {
    const response = await get("asset=USDC&category=collateral&sort=price_desc");
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.data!.listings.map((l) => (l as { id: string }).id)).toEqual(["lst_collateral_usdc"]);
  });

  it("paginates beyond the first page", async () => {
    const page1 = await json(await get("availability=all&pageSize=2"));
    expect(page1.data!.nextCursor).toBeTruthy();
    const page2 = await json(
      await get(`availability=all&pageSize=2&cursor=${encodeURIComponent(page1.data!.nextCursor!)}`),
    );
    expect(page2.data!.listings).toHaveLength(2);
  });

  it("rejects an invalid asset filter", async () => {
    const response = await get("asset=EUR");
    expect(response.status).toBe(400);
    const body = await json(response);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe("invalid_request");
  });

  it("rejects a reversed price range", async () => {
    const response = await get("minPrice=9&maxPrice=1");
    expect(response.status).toBe(400);
  });

  it("never caches listing responses", async () => {
    const response = await get("");
    expect(response.headers.get("Cache-Control")).toMatch(/no-store/i);
  });
});