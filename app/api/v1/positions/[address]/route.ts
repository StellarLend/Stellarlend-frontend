import { isValidGAddress } from "@/lib/api/address";
import { positionCache, POSITION_TTL } from "@/lib/api/cache";
import { fetchPosition } from "@/lib/api/lending";
import { checkApiRateLimit } from "@/lib/api/rate-limit";
import { errorResponse, jsonResponse, mapApiError, withRequestId } from "@/lib/api/response";
import {
  POSITION_CACHE_CONTROL,
  type PositionResponse,
} from "@/lib/api/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ address: string }>;
}

export const GET = withRequestId(async (
  request: Request,
  context: RouteContext,
  requestId: string,
): Promise<Response> => {
  const rate = checkApiRateLimit(request);
  if (!rate.allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests", 429, {
      "Retry-After": String(rate.retryAfterSec),
    }, requestId);
  }

  const { address } = await context.params;
  if (!isValidGAddress(address)) {
    return errorResponse("INVALID_ADDRESS", "Invalid Stellar address", 400, {}, requestId);
  }

  try {
    const { value: position, isStale } = await positionCache.getOrLoadWithMeta(
      address,
      POSITION_TTL,
      () => fetchPosition(address),
    );

    const body: PositionResponse = {
      address,
      collateral: position.collateral.toString(),
      debt: position.debt.toString(),
      healthFactor: position.healthFactor.toString(),
      fetchedAt: position.fetchedAt,
    };

    return jsonResponse(
      body,
      200,
      POSITION_CACHE_CONTROL,
      request,
      requestId,
      isStale ? { "X-Cache": "stale" } : undefined,
    );
  } catch (error) {
    return mapApiError(error, requestId);
  }
});
