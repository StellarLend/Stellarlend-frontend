import { createHash, randomUUID } from "node:crypto";
import { ContractNotConfiguredError, UpstreamRpcError } from "./errors";
import {
  ERROR_CACHE_CONTROL,
  type ApiErrorBody,
  type ApiErrorCode,
} from "./schema";
import { redactStellarIds } from "@/lib/report-error";

const REQUEST_ID_REGEX = /^[A-Za-z0-9-]{8,64}$/;

export function normalizeRequestId(incoming?: string | null): string {
  if (incoming && REQUEST_ID_REGEX.test(incoming)) {
    return incoming;
  }
  return randomUUID();
}

export function etagFor(payload: unknown): string {
  const str = typeof payload === "string" ? payload : JSON.stringify(payload);
  const hash = createHash("sha256").update(str).digest("hex").slice(0, 16);
  return `W/"${hash}"`;
}

export function jsonResponse<T>(
  body: T,
  status: number,
  cacheControl: string,
  requestOrExtraHeaders?: Request | Record<string, string>,
  requestId?: string,
  extraHeaders: Record<string, string> = {},
): Response {
  let request: Request | undefined;
  let mergedExtra: Record<string, string> = { ...extraHeaders };

  if (requestOrExtraHeaders) {
    if (
      "headers" in requestOrExtraHeaders &&
      typeof (requestOrExtraHeaders as Request).headers?.get === "function"
    ) {
      request = requestOrExtraHeaders as Request;
    } else {
      mergedExtra = {
        ...(requestOrExtraHeaders as Record<string, string>),
        ...mergedExtra,
      };
    }
  }

  const etag = etagFor(body);
  const headers: Record<string, string> = {
    "Cache-Control": cacheControl,
    ETag: etag,
    ...mergedExtra,
  };
  if (requestId) {
    headers["x-request-id"] = requestId;
  }

  const ifNoneMatch = request?.headers.get("if-none-match");
  if (
    ifNoneMatch &&
    (ifNoneMatch === etag || ifNoneMatch === "*" || ifNoneMatch.includes(etag))
  ) {
    return new Response(null, {
      status: 304,
      headers,
    });
  }

  return Response.json(body, {
    status,
    headers,
  });
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  extraHeaders: Record<string, string> = {},
  requestId?: string,
): Response {
  const errorObj: { code: ApiErrorCode; message: string; requestId?: string } = {
    code,
    message,
  };
  if (requestId) {
    errorObj.requestId = requestId;
  }
  const body: ApiErrorBody = { error: errorObj };
  const headers: Record<string, string> = {
    "Cache-Control": ERROR_CACHE_CONTROL,
    ...extraHeaders,
  };
  if (requestId) {
    headers["x-request-id"] = requestId;
  }
  return Response.json(body, {
    status,
    headers,
  });
}

/** Maps known upstream/config errors to the public error envelope. */
export function mapApiError(error: unknown, requestId?: string): Response {
  if (error instanceof ContractNotConfiguredError) {
    return errorResponse(
      "CONTRACT_NOT_CONFIGURED",
      "Lending contract is not configured",
      503,
      {},
      requestId,
    );
  }
  if (error instanceof UpstreamRpcError) {
    return errorResponse(
      "UPSTREAM_RPC_ERROR",
      "Failed to read from Soroban RPC",
      502,
      {},
      requestId,
    );
  }
  return errorResponse("INTERNAL_ERROR", "Unexpected server error", 500, {}, requestId);
}

export function log5xxError({
  route,
  status,
  code,
  requestId,
  errorName,
}: {
  route?: string;
  status: number;
  code?: string;
  requestId: string;
  errorName?: string;
}) {
  const logEntry = {
    route: route ? redactStellarIds(route) : undefined,
    status,
    code,
    requestId,
    errorName,
  };
  console.error(JSON.stringify(logEntry));
}

export function withRequestId<TContext = unknown>(
  handler: (request: Request, context: TContext, requestId: string) => Promise<Response>,
) {
  return async (request: Request, context: TContext): Promise<Response> => {
    const rawId = request.headers.get("x-request-id");
    const requestId = normalizeRequestId(rawId);
    let response: Response;
    let caughtError: unknown = null;
    try {
      response = await handler(request, context, requestId);
    } catch (err) {
      caughtError = err;
      response = mapApiError(err, requestId);
    }

    if (!response.headers.has("x-request-id")) {
      response.headers.set("x-request-id", requestId);
    }

    if (response.status >= 500) {
      let code = "INTERNAL_ERROR";
      try {
        const clone = response.clone();
        const json = await clone.json();
        if (json?.error?.code) code = json.error.code;
      } catch {
        // ignore json parse error
      }
      const errorName =
        caughtError instanceof Error
          ? caughtError.name
          : code === "UPSTREAM_RPC_ERROR"
          ? "UpstreamRpcError"
          : code === "CONTRACT_NOT_CONFIGURED"
          ? "ContractNotConfiguredError"
          : "Error";
      let urlPath = "";
      try {
        urlPath = new URL(request.url).pathname;
      } catch {
        urlPath = request.url || "";
      }
      log5xxError({
        route: urlPath,
        status: response.status,
        code,
        requestId,
        errorName,
      });
    }

    return response;
  };
}
