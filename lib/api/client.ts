import { z } from "zod";
import {
  ApiErrorBodySchema,
  PositionResponseSchema,
  ProtocolResponseSchema,
  type ApiErrorCode,
  type PositionResponse,
  type ProtocolResponse,
} from "./schema";

export type ApiClientErrorCode =
  | ApiErrorCode
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "HTTP_ERROR";

export class ApiClientError extends Error {
  readonly code: ApiClientErrorCode;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(
    code: ApiClientErrorCode,
    message: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = options?.status;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 8_000;

async function requestJson<T>(
  path: string,
  schema: z.ZodType<T>,
  options: ApiClientOptions = {},
): Promise<T> {
  const {
    baseUrl = "",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    fetchImpl = fetch,
  } = options;

  const url = baseUrl ? `${baseUrl.replace(/\/+$/, "")}${path}` : path;
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) {
        throw new ApiClientError(
          "TIMEOUT",
          `Request to ${path} timed out after ${timeoutMs}ms`,
          { cause: error },
        );
      }
      throw new ApiClientError(
        "NETWORK_ERROR",
        error instanceof Error ? error.message : "Network request failed",
        { cause: error },
      );
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch (error) {
      if (!response.ok) {
        throw new ApiClientError(
          "HTTP_ERROR",
          `HTTP ${response.status} ${response.statusText}`.trim(),
          { status: response.status, cause: error },
        );
      }
      throw new ApiClientError(
        "INVALID_RESPONSE",
        `Failed to parse JSON response from ${path}`,
        { status: response.status, cause: error },
      );
    }

    if (!response.ok) {
      const parsedError = ApiErrorBodySchema.safeParse(raw);
      if (parsedError.success) {
        throw new ApiClientError(
          parsedError.data.error.code,
          parsedError.data.error.message,
          { status: response.status },
        );
      }
      throw new ApiClientError(
        "HTTP_ERROR",
        `HTTP ${response.status} ${response.statusText}`.trim(),
        { status: response.status },
      );
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ");
      throw new ApiClientError(
        "INVALID_RESPONSE",
        `Invalid response from ${path}: ${details}`,
        { status: response.status, cause: parsed.error },
      );
    }

    return parsed.data;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

export function fetchProtocol(
  options?: ApiClientOptions,
): Promise<ProtocolResponse> {
  return requestJson("/api/v1/protocol", ProtocolResponseSchema, options);
}

export function fetchPosition(
  address: string,
  options?: ApiClientOptions,
): Promise<PositionResponse> {
  return requestJson(
    `/api/v1/positions/${encodeURIComponent(address)}`,
    PositionResponseSchema,
    options,
  );
}
