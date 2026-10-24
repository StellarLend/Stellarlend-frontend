import { protocolCache, PROTOCOL_TTL } from "@/lib/api/cache";
import { fetchProtocolMetrics } from "@/lib/api/lending";
import { apiRateLimiter, getClientIp } from "@/lib/api/rate-limit";
import { errorResponse, jsonResponse, mapApiError } from "@/lib/api/response";
import {
  PROTOCOL_CACHE_CONTROL,
  type ProtocolResponse,
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
    const metrics = await protocolCache.getOrLoad(
      "protocol",
      PROTOCOL_TTL,
      fetchProtocolMetrics,
    );

    const body: ProtocolResponse = {
      totalSupply: metrics.totalSupply.toString(),
      totalBorrow: metrics.totalBorrow.toString(),
      utilizationBps: metrics.utilizationBps.toString(),
      ledger: metrics.ledger,
      fetchedAt: metrics.fetchedAt,
    };

    return jsonResponse(body, 200, PROTOCOL_CACHE_CONTROL);
  } catch (error) {
    return mapApiError(error);
  }
}
