import { ContractNotConfiguredError, UpstreamRpcError } from "./errors";
import {
  ERROR_CACHE_CONTROL,
  type ApiErrorBody,
  type ApiErrorCode,
} from "./schema";

export function jsonResponse<T>(
  body: T,
  status: number,
  cacheControl: string,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": cacheControl,
    },
  });
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": ERROR_CACHE_CONTROL,
      ...extraHeaders,
    },
  });
}

/** Maps known upstream/config errors to the public error envelope. */
export function mapApiError(error: unknown): Response {
  if (error instanceof ContractNotConfiguredError) {
    return errorResponse(
      "CONTRACT_NOT_CONFIGURED",
      "Lending contract is not configured",
      503,
    );
  }
  if (error instanceof UpstreamRpcError) {
    return errorResponse(
      "UPSTREAM_RPC_ERROR",
      "Failed to read from Soroban RPC",
      502,
    );
  }
  return errorResponse("INTERNAL_ERROR", "Unexpected server error", 500);
}
