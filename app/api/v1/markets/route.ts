import { marketsCache, MARKETS_TTL } from "@/lib/api/cache";
import { fetchMarkets } from "@/lib/api/lending";
import { apiRateLimiter, getClientIp } from "@/lib/api/rate-limit";
import { errorResponse, jsonResponse, mapApiError } from "@/lib/api/response";
import {
  MARKETS_CACHE_CONTROL,
  type MarketsResponse,
} from "@/lib/api/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const rate = apiRateLimiter.check(getClientIp(request));
  if (!rate.allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests", 429, {
      "Retry-After": String(rate.retryAfterSec),
    });
  }

  try {
    const snapshot = await marketsCache.getOrLoad(
      "markets",
      MARKETS_TTL,
      fetchMarkets,
    );

    const body: MarketsResponse = {
      markets: snapshot.markets.map((market) => ({
        symbol: market.symbol,
        name: market.name,
        supplyApy: market.supplyApy,
        borrowApy: market.borrowApy,
        utilizationBps: market.utilizationBps.toString(),
        supplyCap: market.supplyCap.toString(),
        borrowCap: market.borrowCap.toString(),
        oraclePrice: market.oraclePrice.toString(),
        ltvBps: market.ltvBps,
        liqThresholdBps: market.liqThresholdBps,
        active: market.active,
      })),
      fetchedAt: snapshot.fetchedAt,
    };

    return jsonResponse(body, 200, MARKETS_CACHE_CONTROL);
  } catch (error) {
    return mapApiError(error);
  }
}
