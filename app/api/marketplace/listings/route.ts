/**
 * GET /api/marketplace/listings
 *
 * Lists marketplace listings with bounded filters, strict input validation and
 * cursor pagination. Every listing carries `version` and `inventoryHash` so the
 * client can detect stale data before acting on it.
 */

import { NextResponse } from "next/server";
import { normalizeAndValidateFilters } from "@/lib/marketplace/invariants";
import { listListings } from "@/lib/marketplace/listingStore";
import type { MarketplaceFilters } from "@/types/marketplace";

const NO_STORE: Record<string, string> = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const params = {
    minPrice: url.searchParams.get("minPrice") ?? undefined,
    maxPrice: url.searchParams.get("maxPrice") ?? undefined,
    asset: url.searchParams.get("asset") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    availability: url.searchParams.get("availability") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  };

  const validation = normalizeAndValidateFilters(params);
  if (!validation.ok) {
    return NextResponse.json(
      { success: false, error: { code: validation.code, message: validation.message } },
      { status: 400, headers: NO_STORE },
    );
  }

  const filters: MarketplaceFilters = validation.value;
  const result = listListings(filters);

  return NextResponse.json(
    {
      success: true,
      data: {
        listings: result.listings,
        nextCursor: result.nextCursor ?? null,
        total: result.total,
        filters: {
          availability: filters.availability,
          sort: filters.sort,
          pageSize: filters.pageSize,
        },
      },
    },
    { headers: NO_STORE },
  );
}