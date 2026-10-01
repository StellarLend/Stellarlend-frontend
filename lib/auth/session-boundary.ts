import { isAccountId } from "@/lib/validation/stellar";
import type { StellarNetwork } from "@/lib/wallet/connectHandshake";

export interface ProtectedSessionUser {
  id: string;
  email?: string;
  name?: string;
  walletAddress: string;
}

export interface ProtectedSession {
  user: ProtectedSessionUser;
  issuedAt: Date | null;
  expiresAt: Date | null;
}

export interface ClientSessionBoundary {
  walletAddress: string;
  network: StellarNetwork;
  issuedAt: Date | null;
  expiresAt: Date | null;
}

export type SessionBoundaryFailure =
  | "missing-session"
  | "inactive-session"
  | "missing-user"
  | "missing-user-id"
  | "invalid-wallet"
  | "invalid-network"
  | "wrong-network"
  | "expired-session"
  | "invalid-issued-at"
  | "invalid-expires-at"
  | "wallet-mismatch";

export class SessionBoundaryError extends Error {
  constructor(public readonly reason: SessionBoundaryFailure) {
    super(reason);
    this.name = "SessionBoundaryError";
  }
}

const FUTURE_CLOCK_SKEW_MS = 60_000;

export function normalizeStellarNetwork(value: unknown): StellarNetwork | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "MAINNET" || normalized === "PUBLIC") return "PUBLIC";
  if (normalized === "TESTNET") return "TESTNET";
  return null;
}

export function parseBoundaryDate(
  value: unknown,
  missingIsAllowed = true,
): Date | null {
  if (value == null && missingIsAllowed) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function assertUnexpired(expiresAt: Date | null): void {
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new SessionBoundaryError("expired-session");
  }
}

function assertNotFromFuture(issuedAt: Date | null): void {
  if (issuedAt && issuedAt.getTime() > Date.now() + FUTURE_CLOCK_SKEW_MS) {
    throw new SessionBoundaryError("invalid-issued-at");
  }
}

export function assertWalletMatchesSession(
  storedWalletAddress: string | null | undefined,
  sessionWalletAddress: string,
): void {
  if (!storedWalletAddress) return;
  if (!isAccountId(storedWalletAddress)) {
    throw new SessionBoundaryError("invalid-wallet");
  }
  if (storedWalletAddress !== sessionWalletAddress) {
    throw new SessionBoundaryError("wallet-mismatch");
  }
}

export function validateServerProtectedSession(session: unknown): ProtectedSession {
  if (!session || typeof session !== "object") {
    throw new SessionBoundaryError("missing-session");
  }

  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") {
    throw new SessionBoundaryError("missing-user");
  }

  const id = (user as { id?: unknown }).id;
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new SessionBoundaryError("missing-user-id");
  }

  const walletAddress = (user as { walletAddress?: unknown }).walletAddress;
  if (typeof walletAddress !== "string" || !isAccountId(walletAddress)) {
    throw new SessionBoundaryError("invalid-wallet");
  }

  const issuedAt = parseBoundaryDate((session as { issuedAt?: unknown }).issuedAt);
  const expiresAt = parseBoundaryDate((session as { expiresAt?: unknown }).expiresAt);

  if ((session as { issuedAt?: unknown }).issuedAt != null && !issuedAt) {
    throw new SessionBoundaryError("invalid-issued-at");
  }
  if ((session as { expiresAt?: unknown }).expiresAt != null && !expiresAt) {
    throw new SessionBoundaryError("invalid-expires-at");
  }

  assertNotFromFuture(issuedAt);
  assertUnexpired(expiresAt);

  return {
    user: {
      id,
      email: typeof (user as { email?: unknown }).email === "string" ? (user as { email: string }).email : undefined,
      name: typeof (user as { name?: unknown }).name === "string" ? (user as { name: string }).name : undefined,
      walletAddress,
    },
    issuedAt,
    expiresAt,
  };
}

export function validateClientSessionResponse(
  payload: unknown,
  expectedNetwork: StellarNetwork,
): ClientSessionBoundary {
  if (!payload || typeof payload !== "object") {
    throw new SessionBoundaryError("missing-session");
  }

  const session = (payload as { session?: unknown }).session;
  if (!session || typeof session !== "object") {
    throw new SessionBoundaryError("missing-session");
  }

  if ((session as { active?: unknown }).active !== true) {
    throw new SessionBoundaryError("inactive-session");
  }

  const network = normalizeStellarNetwork((session as { network?: unknown }).network);
  if (!network) {
    throw new SessionBoundaryError("invalid-network");
  }
  if (network !== expectedNetwork) {
    throw new SessionBoundaryError("wrong-network");
  }

  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") {
    throw new SessionBoundaryError("missing-user");
  }

  const walletAddress = (user as { walletAddress?: unknown }).walletAddress;
  if (typeof walletAddress !== "string" || !isAccountId(walletAddress)) {
    throw new SessionBoundaryError("invalid-wallet");
  }

  const issuedAtValue = (session as { issuedAt?: unknown }).issuedAt;
  const expiresAtValue = (session as { expiresAt?: unknown }).expiresAt;
  const issuedAt = parseBoundaryDate(issuedAtValue);
  const expiresAt = parseBoundaryDate(expiresAtValue);

  if (issuedAtValue != null && !issuedAt) {
    throw new SessionBoundaryError("invalid-issued-at");
  }
  if (expiresAtValue != null && !expiresAt) {
    throw new SessionBoundaryError("invalid-expires-at");
  }

  assertNotFromFuture(issuedAt);
  assertUnexpired(expiresAt);

  return {
    walletAddress,
    network,
    issuedAt,
    expiresAt,
  };
}
