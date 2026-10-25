/**
 * Structured client error reporting utility.
 *
 * Captures render and async errors with context (route, wallet connected, network)
 * while ensuring no sensitive data or full Stellar addresses/contract IDs are leaked.
 */

export interface ErrorContext {
  route?: string;
  walletConnected?: boolean;
  network?: string;
  [key: string]: unknown;
}

export interface ReportedErrorPayload {
  message: string;
  name: string;
  stack?: string;
  context: Record<string, unknown>;
  timestamp: string;
}

export type ErrorSink = (payload: ReportedErrorPayload) => void | Promise<void>;

// Stellar G... public key (56 uppercase alphanumeric starting with G)
const STELLAR_ADDRESS_REGEX = /\b(G[A-Z2-7]{55})\b/g;
// Stellar C... contract ID (56 uppercase alphanumeric starting with C)
const STELLAR_CONTRACT_REGEX = /\b(C[A-Z2-7]{55})\b/g;

/**
 * Redacts full Stellar public keys and contract IDs into shortened versions
 * (e.g. GABC...WXYZ or CBCD...WXYZ) to prevent leaking raw user identifiers in telemetry.
 */
export function redactStellarIds(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(STELLAR_ADDRESS_REGEX, (match) => `${match.slice(0, 4)}...${match.slice(-4)}`)
    .replace(STELLAR_CONTRACT_REGEX, (match) => `${match.slice(0, 4)}...${match.slice(-4)}`);
}

/**
 * Recursively redacts Stellar IDs from context values and sanitizes keys.
 */
export function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string") {
      result[key] = redactStellarIds(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeContext(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string"
          ? redactStellarIds(item)
          : item && typeof item === "object"
          ? sanitizeContext(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

// In-session deduplication set storing hashes or unique message keys
const reportedHashes = new Set<string>();

/**
 * Resets deduplication cache (useful in tests).
 */
export function resetReportedErrors(): void {
  reportedHashes.clear();
}

/**
 * Default error sink:
 * - If NEXT_PUBLIC_ERROR_ENDPOINT is provided, uses navigator.sendBeacon or fetch.
 * - In development or when no endpoint is configured, logs cleanly to console.
 */
const defaultSink: ErrorSink = (payload: ReportedErrorPayload) => {
  const endpoint = process.env.NEXT_PUBLIC_ERROR_ENDPOINT;
  if (endpoint && typeof window !== "undefined") {
    const data = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const sent = navigator.sendBeacon(endpoint, new Blob([data], { type: "application/json" }));
      if (sent) return;
    }
    if (typeof fetch === "function") {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: data,
        keepalive: true,
      }).catch(() => {
        // Suppress network errors in reporting sink to avoid error loops
      });
      return;
    }
  }

  // Console sink in dev or when no endpoint is configured
  if (process.env.NODE_ENV !== "test" || !endpoint) {
    // eslint-disable-next-line no-console
    console.error("[StellarLend Error Reporter]", payload);
  }
};

let currentSink: ErrorSink = defaultSink;

/**
 * Allows plugging in a custom error sink.
 */
export function setErrorSink(sink: ErrorSink): void {
  currentSink = sink;
}

/**
 * Restores the default sink.
 */
export function restoreDefaultErrorSink(): void {
  currentSink = defaultSink;
}

/**
 * Reports an error with optional context.
 *
 * Guaranteed safe:
 * - Redacts Stellar addresses and contract IDs.
 * - Dedupes identical errors within the current session.
 * - Never throws or causes recursive error loops.
 */
export function reportError(error: unknown, context: ErrorContext = {}): void {
  try {
    let name = "Error";
    let message = "Unknown error";
    let stack: string | undefined;

    if (error instanceof Error) {
      name = error.name || "Error";
      message = error.message || String(error);
      stack = error.stack;
    } else if (typeof error === "string") {
      message = error;
    } else {
      try {
        message = JSON.stringify(error);
      } catch {
        message = String(error);
      }
    }

    // Redact Stellar IDs from message and stack
    const redactedMessage = redactStellarIds(message);
    const redactedStack = stack ? redactStellarIds(stack) : undefined;
    const sanitizedCtx = sanitizeContext(context);

    // Compute simple deduplication key: name + redactedMessage + stack + route
    const dedupeKey = `${name}:${redactedMessage}:${redactedStack?.split("\n")[0] || ""}:${sanitizedCtx.route || ""}`;
    if (reportedHashes.has(dedupeKey)) {
      return;
    }
    reportedHashes.add(dedupeKey);

    const payload: ReportedErrorPayload = {
      name,
      message: redactedMessage,
      stack: redactedStack,
      context: sanitizedCtx,
      timestamp: new Date().toISOString(),
    };

    // Safely execute sink
    const result = currentSink(payload);
    if (result && typeof (result as Promise<void>).catch === "function") {
      (result as Promise<void>).catch(() => {
        // Sink failure must not throw
      });
    }
  } catch {
    // Fallback: reporter must never throw under any circumstances
  }
}
