import { protocolCache, PROTOCOL_TTL } from "@/lib/api/cache";
import { fetchProtocolMetrics } from "@/lib/api/lending";
import { checkApiRateLimit } from "@/lib/api/rate-limit";
import { errorResponse, jsonResponse, mapApiError, withRequestId } from "@/lib/api/response";
import {
  PROTOCOL_CACHE_CONTROL,
  type ProtocolResponse,
} from "@/lib/api/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRequestId(async (request: Request, _context: unknown, requestId: string): Promise<Response> => {
  const rate = checkApiRateLimit(request);
  if (!rate.allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests", 429, {
      "Retry-After": String(rate.retryAfterSec),
    }, requestId);
  }

  try {
    const { value: metrics, isStale } = await protocolCache.getOrLoadWithMeta(
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

    return jsonResponse(
      body,
      200,
      PROTOCOL_CACHE_CONTROL,
      request,
      requestId,
      isStale ? { "X-Cache": "stale" } : undefined,
    );
  } catch (error) {
    return mapApiError(error, requestId);
  }
});
