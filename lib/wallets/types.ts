export interface SignTransactionOptions {
  networkPassphrase?: string;
  accountToSign?: string;
}

export interface WalletAdapter {
  id: string;
  name: string;
  icon: string;
  isAvailable(): Promise<boolean>;
  connect(): Promise<string>;
  signTransaction(xdr: string, options?: SignTransactionOptions): Promise<string>;
  disconnect(): Promise<void>;
}

export type WalletErrorCode =
  | "user_rejected"
  | "not_installed"
  | "locked"
  | "wrong_network"
  | "unknown";

export interface NormalizedWalletError {
  code: WalletErrorCode;
  message: string;
}

export const SIGNING_TIMEOUT_MS = 60_000;

const DEFAULT_ERROR_MESSAGES: Record<WalletErrorCode, string> = {
  user_rejected: "User rejected the wallet request.",
  not_installed: "Wallet extension is not installed.",
  locked: "Wallet is locked.",
  wrong_network: "Wallet is connected to the wrong network.",
  unknown: "An unknown wallet error occurred.",
};

function extractErrorMessage(err: unknown): string | null {
  if (typeof err === "string") {
    const trimmed = err.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (err instanceof Error) {
    const trimmed = err.message.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim().length > 0) {
      return record.message.trim();
    }
    if (typeof record.error === "string" && record.error.trim().length > 0) {
      return record.error.trim();
    }
    if (
      record.error &&
      typeof record.error === "object" &&
      typeof (record.error as Record<string, unknown>).message === "string"
    ) {
      const nested = ((record.error as Record<string, unknown>).message as string).trim();
      if (nested.length > 0) return nested;
    }
    if (typeof record.reason === "string" && record.reason.trim().length > 0) {
      return record.reason.trim();
    }
  }
  return null;
}

function extractErrorCode(err: unknown): string | number | null {
  if (err && typeof err === "object") {
    const code = (err as Record<string, unknown>).code;
    if (typeof code === "number" || typeof code === "string") {
      return code;
    }
  }
  return null;
}

/**
 * Normalizes heterogeneous vendor wallet errors (Freighter, Albedo, xBull,
 * LOBSTR, Rabet, Hana, etc.) into a consistent { code, message } shape.
 * Unknown errors preserve their original message and never expose raw objects.
 */
export function normalizeWalletError(err: unknown): NormalizedWalletError {
  const rawMessage = extractErrorMessage(err);
  const rawCode = extractErrorCode(err);
  const lower = (rawMessage ?? "").toLowerCase();

  // Check explicit vendor error codes first
  if (
    rawCode === 4001 ||
    rawCode === -1 ||
    rawCode === -4 ||
    rawCode === "ACTION_REJECTED" ||
    rawCode === "USER_REJECTED"
  ) {
    return {
      code: "user_rejected",
      message: rawMessage ?? DEFAULT_ERROR_MESSAGES.user_rejected,
    };
  }

  // Check NetworkMismatchError by name to avoid circular dependency with lib/config
  if (err instanceof Error && err.name === "NetworkMismatchError") {
    return {
      code: "wrong_network",
      message: rawMessage ?? DEFAULT_ERROR_MESSAGES.wrong_network,
    };
  }

  if (
    /\b(reject(ed)?|cancel(l?ed)?|declin(ed)?|denied|dismissed|aborted)\b/.test(lower) ||
    /popup\s*closed|window\s*closed|closed\s*(by\s*user|the\s*popup|window)|user[-_\s]rejected/.test(
      lower
    )
  ) {
    return {
      code: "user_rejected",
      message: rawMessage ?? DEFAULT_ERROR_MESSAGES.user_rejected,
    };
  }

  if (
    /not\s*installed|not\s*detected|not\s*available|not\s*found|missing\s*extension|no\s*wallet\s*extension/.test(
      lower
    )
  ) {
    return {
      code: "not_installed",
      message: rawMessage ?? DEFAULT_ERROR_MESSAGES.not_installed,
    };
  }

  if (/\blocked\b|unlock\s*(your\s*)?wallet|not[-_\s]logged[-_\s]in|vault\s*is\s*locked|password\s*required/.test(lower)) {
    return {
      code: "locked",
      message: rawMessage ?? DEFAULT_ERROR_MESSAGES.locked,
    };
  }

  if (
    /wrong\s*network|network\s*mismatch|invalid\s*network|unsupported\s*network|different\s*network|switch\s*(to\s*)?(testnet|mainnet|network)/.test(
      lower
    )
  ) {
    return {
      code: "wrong_network",
      message: rawMessage ?? DEFAULT_ERROR_MESSAGES.wrong_network,
    };
  }

  return {
    code: "unknown",
    message: rawMessage ?? DEFAULT_ERROR_MESSAGES.unknown,
  };
}

/**
 * Wraps a wallet signing promise with a timeout (default 60s) so hung
 * extension popups cannot leave the UI stuck indefinitely.
 */
export async function withSigningTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = SIGNING_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Transaction signing timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
