import { describe, expect, it } from "vitest";
import {
  assertWalletMatchesSession,
  normalizeStellarNetwork,
  SessionBoundaryError,
  validateClientSessionResponse,
  validateServerProtectedSession,
} from "./session-boundary";

const VALID_WALLET = "GAUFVBMULU2CJRE5IGVPEOXRYZGU5YDAOSQ3UQTBM3Y7ARUPFSXZUHN5";
const OTHER_WALLET = "GBCKQ7BCF4O7SWKH3GF7G2KRPSURA2HU5WQJRHMIFR3P6DBGVT45XLR3";

function futureIso(minutes = 5) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

describe("session-boundary", () => {
  it("normalizes accepted Stellar network names", () => {
    expect(normalizeStellarNetwork("mainnet")).toBe("PUBLIC");
    expect(normalizeStellarNetwork("PUBLIC")).toBe("PUBLIC");
    expect(normalizeStellarNetwork("testnet")).toBe("TESTNET");
    expect(normalizeStellarNetwork("localnet")).toBeNull();
  });

  it("accepts a valid server protected session", () => {
    const session = validateServerProtectedSession({
      user: { id: "user-1", walletAddress: VALID_WALLET },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(session.user.walletAddress).toBe(VALID_WALLET);
  });

  it("rejects malformed server sessions before protected UI renders", () => {
    expect(() =>
      validateServerProtectedSession({
        user: { id: "user-1", walletAddress: "not-a-wallet" },
      }),
    ).toThrow(new SessionBoundaryError("invalid-wallet"));
  });

  it("rejects expired server sessions", () => {
    expect(() =>
      validateServerProtectedSession({
        user: { id: "user-1", walletAddress: VALID_WALLET },
        expiresAt: new Date(Date.now() - 60_000),
      }),
    ).toThrow(new SessionBoundaryError("expired-session"));
  });

  it("accepts a valid client session response for the expected network", () => {
    const session = validateClientSessionResponse(
      {
        session: {
          active: true,
          network: "TESTNET",
          user: { walletAddress: VALID_WALLET },
          expiresAt: futureIso(),
        },
      },
      "TESTNET",
    );

    expect(session.walletAddress).toBe(VALID_WALLET);
    expect(session.network).toBe("TESTNET");
  });

  it("rejects wrong-network and malformed client session responses", () => {
    expect(() =>
      validateClientSessionResponse(
        {
          session: {
            active: true,
            network: "PUBLIC",
            user: { walletAddress: VALID_WALLET },
            expiresAt: futureIso(),
          },
        },
        "TESTNET",
      ),
    ).toThrow(new SessionBoundaryError("wrong-network"));

    expect(() =>
      validateClientSessionResponse({ session: { active: true, network: "TESTNET" } }, "TESTNET"),
    ).toThrow(new SessionBoundaryError("missing-user"));
  });

  it("rejects replayed or tampered storage that points at a different wallet", () => {
    expect(() => assertWalletMatchesSession(OTHER_WALLET, VALID_WALLET)).toThrow(
      new SessionBoundaryError("wallet-mismatch"),
    );
  });
});
