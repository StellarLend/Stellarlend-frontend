import { LENDING_ERRORS, type LendingErrorCode } from "./lending-errors";

export type DecodedContractError = {
  code?: number;
  name: string;
  message: string;
  hint?: string;
  raw: string;
};

const UNKNOWN_ERROR = {
  name: "UnknownError",
  message: "The request could not be completed.",
  hint: "Refresh the page and try again. Contact support if the problem continues.",
} as const;

const PANIC_ERRORS = {
  OperationPaused: {
    message: "This action is temporarily paused by the protocol.",
    hint: "Wait until the protocol resumes this action.",
  },
  OperationDisabledDuringShutdown: {
    message: "This action is unavailable while the protocol is shutting down.",
    hint: "Wait until the shutdown process is complete.",
  },
  ActionBlockedInRecovery: {
    message: "This action is unavailable while the protocol is in recovery mode.",
    hint: "Wait until recovery is complete.",
  },
  InsufficientLiquidity: {
    message: "The market does not have enough available liquidity for this request.",
    hint: "Request a smaller amount or try again after more funds are supplied.",
  },
  FlashLoanUtilizationExceeded: {
    message: "This flash loan exceeds the market's available limit.",
    hint: "Request a smaller amount.",
  },
  InsufficientRepayment: {
    message: "The flash loan was not repaid in full.",
    hint: "Repay the required amount and try again.",
  },
} as const;

type PanicName = keyof typeof PANIC_ERRORS;

const PANIC_NAMES = Object.keys(PANIC_ERRORS) as PanicName[];
const MAX_RAW_LENGTH = 2_000;
const MAX_DEPTH = 8;

function collectText(value: unknown, seen: WeakSet<object>, depth: number): string[] {
  if (depth > MAX_DEPTH || value === null || value === undefined) return [];
  if (typeof value === "string") return [value.slice(0, MAX_RAW_LENGTH)];
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return [String(value)];
  if (typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  const strings: string[] = [];
  try {
    if (value instanceof Error) {
      strings.push(value.name, value.message);
      const code = (value as Error & { code?: unknown }).code;
      strings.push(...collectText(code, seen, depth + 1));
    }
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 100)) strings.push(...collectText(item, seen, depth + 1));
    } else {
      for (const [key, nested] of Object.entries(value).slice(0, 100)) {
        strings.push(key, ...collectText(nested, seen, depth + 1));
      }
      const toXdr = (value as { toXDR?: unknown }).toXDR;
      if (typeof toXdr === "function") {
        try {
          strings.push(String(toXdr.call(value)).slice(0, MAX_RAW_LENGTH));
        } catch {
          // Invalid XDR objects should not prevent a readable fallback.
        }
      }
    }
  } catch {
    // Untrusted RPC objects may contain getters that throw.
  }
  return strings;
}

function rawText(error: unknown): string {
  return collectText(error, new WeakSet<object>(), 0).join(" ").slice(0, MAX_RAW_LENGTH);
}

function findContractCode(text: string): number | undefined {
  const patterns = [
    /Error\s*\(\s*Contract\s*,\s*#?\s*(\d+)\s*\)/i,
    /ContractError\s*\(\s*#?\s*(\d+)\s*\)/i,
    /\bcontract(?:\s+error)?\s*[:#]\s*(\d+)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function findPanicName(text: string): PanicName | undefined {
  for (const name of PANIC_NAMES) if (text.includes(name)) return name;

  if (typeof atob === "function") {
    const base64Candidates = text.match(/[A-Za-z0-9+/]{12,}={0,2}/g) ?? [];
    for (const candidate of base64Candidates) {
      try {
        const content = candidate.replace(/=+$/, "");
        const decoded = atob(content + "=".repeat((4 - content.length % 4) % 4));
        for (const name of PANIC_NAMES) if (decoded.includes(name)) return name;
      } catch {
        // Not every diagnostic payload is valid base64.
      }
    }
  }
  return undefined;
}

function findStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  try {
    const candidate = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
    const status = candidate.status ?? candidate.statusCode ?? candidate.response?.status;
    return typeof status === "number" ? status : undefined;
  } catch {
    return undefined;
  }
}

function decoded(
  name: string,
  message: string,
  hint: string | undefined,
  raw: string,
  code?: number,
): DecodedContractError {
  return { ...(code === undefined ? {} : { code }), name, message, ...(hint ? { hint } : {}), raw };
}

export function decodeContractError(error: unknown): DecodedContractError {
  try {
    const raw = rawText(error);
    const code = findContractCode(raw);
    if (code !== undefined) {
      const entry = LENDING_ERRORS[code as LendingErrorCode];
      if (entry) return decoded(entry.name, entry.message, entry.hint, raw, code);
    }

    const panicName = findPanicName(raw);
    if (panicName) {
      const panic = PANIC_ERRORS[panicName];
      return decoded(panicName, panic.message, panic.hint, raw);
    }

    if (/user (?:declined|rejected)|rejected the request|request was rejected|user rejected/i.test(raw)) {
      return decoded("UserRejected", "The request was cancelled in your wallet.", "Approve the request in Freighter to continue.", raw);
    }

    const status = findStatus(error);
    if ((status !== undefined && status >= 500) || /failed to fetch|networkerror|fetch failed|econnreset|etimedout|network request failed/i.test(raw)) {
      return decoded("NetworkError", "The network could not complete the request.", "Check your connection and try again.", raw);
    }
    if (/timeout|timed out|deadline exceeded/i.test(raw)) {
      return decoded("Timeout", "The request took too long to complete.", "Check the transaction status before trying again.", raw);
    }

    return decoded(UNKNOWN_ERROR.name, UNKNOWN_ERROR.message, UNKNOWN_ERROR.hint, raw);
  } catch {
    return decoded(UNKNOWN_ERROR.name, UNKNOWN_ERROR.message, UNKNOWN_ERROR.hint, "");
  }
}
