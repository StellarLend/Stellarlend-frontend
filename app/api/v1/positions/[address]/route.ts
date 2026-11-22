import { isValidGAddress } from "@/lib/api/address";
import { positionCache, POSITION_TTL } from "@/lib/api/cache";
import { fetchPosition } from "@/lib/api/lending";
import { apiRateLimiter, getClientIp } from "@/lib/api/rate-limit";
import { errorResponse, jsonResponse, mapApiError } from "@/lib/api/response";
import {
  POSITION_CACHE_CONTROL,
  type PositionResponse,
} from "@/lib/api/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ address: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const rate = apiRateLimiter.check(getClientIp(request));
  if (!rate.allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests", 429, {
      "Retry-After": String(rate.retryAfterSec),
    });
  }

  const { address } = await context.params;
  if (!isValidGAddress(address)) {
    return errorResponse("INVALID_ADDRESS", "Invalid Stellar address", 400);
  }

  try {
    const position = await positionCache.getOrLoad(
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

    return jsonResponse(body, 200, POSITION_CACHE_CONTROL);
  } catch (error) {
    return mapApiError(error);
  }
}
