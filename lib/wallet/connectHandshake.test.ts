// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { connectWallet, isValidStellarAddress } from "./connectHandshake";

const VALID_ADDRESS = "GBRPAME4HFAIMDOM4VES2SO24TEY246NNSUHE4WR37GBTT5CXYABXL7R";

function mockResponse(ok: boolean, body: any = {}, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  (window as any).stellar = undefined;
});

describe("isValidStellarAddress", () => {
  it("accepts a well-formed 56-char G-prefixed address", () => {
    expect(isValidStellarAddress(VALID_ADDRESS)).toBe(true);
  });

  it("rejects addresses of the wrong length", () => {
    expect(isValidStellarAddress("GABCDEF1234567890")).toBe(false);
  });

  it("rejects addresses without a G prefix", () => {
    expect(isValidStellarAddress("A".repeat(56))).toBe(false);
  });
});

describe("connectWallet", () => {
  it("returns the verified address on a full successful handshake", async () => {
    (window as any).stellar = {
      getPublicKey: vi.fn().mockResolvedValue(VALID_ADDRESS),
      signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "challenge-xdr" }))
      .mockResolvedValueOnce(mockResponse(true, { walletAddress: VALID_ADDRESS }));

    const result = await connectWallet("TESTNET");

    expect(result).toBe(VALID_ADDRESS);
  });

  it("throws when Freighter is not detected", async () => {
    (window as any).stellar = undefined;
    await expect(connectWallet("TESTNET")).rejects.toThrow(
      "Stellar wallet provider (Freighter) not detected",
    );
  });

  it("throws when no public key is returned", async () => {
    (window as any).stellar = {
      getPublicKey: vi.fn().mockResolvedValue(null),
      signTransaction: vi.fn(),
    };
    await expect(connectWallet("TESTNET")).rejects.toThrow(
      "No public key returned from wallet",
    );
  });

  it("throws when the public key has an invalid length/prefix", async () => {
    (window as any).stellar = {
      getPublicKey: vi.fn().mockResolvedValue("not-a-valid-key"),
      signTransaction: vi.fn(),
    };
    await expect(connectWallet("TESTNET")).rejects.toThrow("Invalid Stellar public key");
  });

  it("throws when the challenge request fails", async () => {
    (window as any).stellar = {
      getPublicKey: vi.fn().mockResolvedValue(VALID_ADDRESS),
      signTransaction: vi.fn(),
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false, { error: "Server error" }, 500));

    await expect(connectWallet("TESTNET")).rejects.toThrow("Server error");
  });

  it("throws when the verify request fails", async () => {
    (window as any).stellar = {
      getPublicKey: vi.fn().mockResolvedValue(VALID_ADDRESS),
      signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "challenge-xdr" }))
      .mockResolvedValueOnce(mockResponse(false, { error: "Invalid signature" }, 400));

    await expect(connectWallet("TESTNET")).rejects.toThrow("Invalid signature");
  });
});
