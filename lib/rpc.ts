export class RpcError extends Error {
  readonly status?: number;
  readonly code?: number | string;
  readonly isSimulationError: boolean;
  readonly url?: string;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: number | string;
      isSimulationError?: boolean;
      url?: string;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "RpcError";
    this.status = options?.status;
    this.code = options?.code;
    this.isSimulationError = Boolean(options?.isSimulationError);
    this.url = options?.url;
    if (options?.cause) {
      this.cause = options?.cause;
    }
  }
}

export function validateRpcUrl(urlStr: string, isProduction = process.env.NODE_ENV === "production"): string {
  const trimmed = urlStr.trim();
  if (!trimmed) {
    throw new Error("RPC URL must not be empty");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid RPC URL: "${trimmed}"`);
  }

  if (isProduction && parsed.protocol !== "https:") {
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error(`Non-HTTPS RPC URL in production: "${trimmed}"`);
    }
  }

  return trimmed;
}

export interface CreateRpcOptions {
  urls: string[];
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  isProduction?: boolean;
}

export interface JsonRpcRequest {
  jsonrpc?: "2.0";
  id?: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export function createRpc(options: CreateRpcOptions) {
  const isProduction = options.isProduction ?? (process.env.NODE_ENV === "production");
  const timeoutMs = options.timeoutMs ?? 8000;
  const fetchFn = options.fetchFn ?? globalThis.fetch;

  if (!options.urls || options.urls.length === 0) {
    throw new Error("createRpc requires at least one URL");
  }

  // Validate all URLs upfront
  const validatedUrls = options.urls.map((u) => validateRpcUrl(u, isProduction));

  async function request<T = unknown>(
    body: JsonRpcRequest | Record<string, unknown>,
    init?: { signal?: AbortSignal }
  ): Promise<T> {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      ...body,
    });

    const errors: Array<{ url: string; error: unknown }> = [];

    for (let i = 0; i < validatedUrls.length; i++) {
      const currentUrl = validatedUrls[i];
      const isLast = i === validatedUrls.length - 1;

      const timeoutController = new AbortController();
      const timer = setTimeout(() => {
        timeoutController.abort(new Error(`RPC request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Handle external signal cancellation
      const onExternalAbort = () => {
        timeoutController.abort(init?.signal?.reason);
      };
      if (init?.signal) {
        if (init.signal.aborted) {
          clearTimeout(timer);
          throw init.signal.reason || new Error("Request aborted");
        }
        init.signal.addEventListener("abort", onExternalAbort, { once: true });
      }

      try {
        const response = await fetchFn(currentUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: payload,
          signal: timeoutController.signal,
        });

        clearTimeout(timer);
        if (init?.signal) {
          init.signal.removeEventListener("abort", onExternalAbort);
        }

        // 4xx client errors should NOT fail over to next RPC endpoint
        if (response.status >= 400 && response.status < 500) {
          const errorText = await response.text().catch(() => "");
          throw new RpcError(`HTTP ${response.status}: ${errorText || response.statusText}`, {
            status: response.status,
            url: currentUrl,
          });
        }

        // 5xx server error -> fail over to next URL
        if (response.status >= 500) {
          const errorText = await response.text().catch(() => "");
          const serverError = new RpcError(`HTTP ${response.status}: ${errorText || response.statusText}`, {
            status: response.status,
            url: currentUrl,
          });
          errors.push({ url: currentUrl, error: serverError });
          if (!isLast) continue;
          throw serverError;
        }

        const data = (await response.json()) as JsonRpcResponse<T>;

        if (data.error) {
          // JSON-RPC level error (e.g. simulation error, contract execution error)
          // Contract/simulation errors should NOT fail over or retry
          const isSimError =
            data.error.code === -32000 || // common Soroban simulation error code
            (typeof data.error.message === "string" &&
              (data.error.message.includes("simulation") ||
                data.error.message.includes("contract") ||
                data.error.message.includes("TransactionFailed") ||
                data.error.message.includes("HostError")));

          throw new RpcError(data.error.message || "RPC JSON-RPC Error", {
            code: data.error.code,
            isSimulationError: isSimError,
            url: currentUrl,
          });
        }

        return data.result as T;
      } catch (err: unknown) {
        clearTimeout(timer);
        if (init?.signal) {
          init.signal.removeEventListener("abort", onExternalAbort);
        }

        // If explicitly caller-aborted, rethrow immediately
        if (init?.signal?.aborted) {
          throw err;
        }

        // If 4xx or simulation error, do not fail over
        if (err instanceof RpcError && ((err.status && err.status >= 400 && err.status < 500) || err.isSimulationError)) {
          throw err;
        }

        errors.push({ url: currentUrl, error: err });

        if (isLast) {
          // All URLs failed
          const message = `All RPC endpoints failed (${validatedUrls.length} total). Last error: ${
            err instanceof Error ? err.message : String(err)
          }`;
          throw new RpcError(message, {
            url: currentUrl,
            cause: errors,
          });
        }
        // Fail over to next URL
      }
    }

    throw new RpcError("All RPC endpoints failed");
  }

  return {
    urls: validatedUrls,
    request,
  };
}
