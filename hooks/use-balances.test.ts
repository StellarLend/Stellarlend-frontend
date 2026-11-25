import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBalances } from "./use-balances";

// ── mock useWallet ────────────────────────────────────────────────────────────

vi.mock("@/components/wallet", () => ({
  useWallet: vi.fn(),
}));

import { useWallet } from "@/components/wallet";
const mockUseWallet = vi.mocked(useWallet);

// ── helpers ───────────────────────────────────────────────────────────────────

const NATIVE = {
  assetType: "native",
  code: "XLM",
  balance: "150.0000000",
  available: "148.0000000",
  buyingLiabilities: "0",
  sellingLiabilities: "0",
};

const USDC = {
  assetType: "credit_alphanum4",
  code: "USDC",
  balance: "250.0000000",
  available: "250.0000000",
  buyingLiabilities: "0",
  sellingLiabilities: "0",
};

function mockWallet(overrides: Partial<ReturnType<typeof useWallet>> = {}) {
  mockUseWallet.mockReturnValue({
    address: null,
    balance: null,
    balances: {},
    isUnfunded: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshBalances: vi.fn(),
    addTrustline: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useWallet>);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("useBalances", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty maps when wallet is disconnected", () => {
    mockWallet({ address: null, balances: {} });

    const { result } = renderHook(() => useBalances());

    expect(result.current.balances).toEqual({});
    expect(result.current.balancesBySymbol.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("returns balances map keyed by asset and sets isLoading while address is known but balances empty", () => {
    mockWallet({
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      balances: {},
      error: null,
    });

    const { result } = renderHook(() => useBalances());

    expect(result.current.isLoading).toBe(true);
  });

  it("useBalances returns map keyed by asset — native maps to XLM symbol", () => {
    mockWallet({
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      balances: { native: NATIVE },
      error: null,
    });

    const { result } = renderHook(() => useBalances());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.balancesBySymbol.has("XLM")).toBe(true);
    expect(result.current.balancesBySymbol.get("XLM")).toEqual(NATIVE);
  });

  it("maps classic-asset keys (USDC:G…) to their symbol", () => {
    const issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    mockWallet({
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      balances: {
        native: NATIVE,
        [`USDC:${issuer}`]: USDC,
      },
      error: null,
    });

    const { result } = renderHook(() => useBalances());

    expect(result.current.balancesBySymbol.has("USDC")).toBe(true);
    expect(result.current.balancesBySymbol.get("USDC")).toEqual(USDC);
    // Raw balances map still has the full key
    expect(result.current.balances[`USDC:${issuer}`]).toEqual(USDC);
  });

  it("sets isError when wallet reports an error", () => {
    mockWallet({
      address: null,
      balances: {},
      error: "Freighter not installed",
    });

    const { result } = renderHook(() => useBalances());

    expect(result.current.isError).toBe(true);
  });

  it("includes the wallet address in the query key", () => {
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
    mockWallet({ address, balances: { native: NATIVE } });

    const { result } = renderHook(() => useBalances());

    expect(result.current.queryKey).toContain(address);
  });
});
