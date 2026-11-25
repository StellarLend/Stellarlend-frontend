import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { usePositions } from "./use-positions";
import { MARKETS } from "@/lib/markets";

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/lending-client", () => ({
  isOnChainConfigured: vi.fn(() => false),
  readPosition: vi.fn(),
}));

vi.mock("@/lib/demo-ledger", () => ({
  loadLedger: vi.fn(() => ({ ledger: {}, reset: false })),
  saveLedger: vi.fn(),
  storageKey: vi.fn((addr: string | null) => `stellarlend-demo:v2:${addr ?? "anon"}`),
}));

import { isOnChainConfigured, readPosition } from "@/lib/lending-client";
import { loadLedger, saveLedger } from "@/lib/demo-ledger";
const mockIsConfigured = vi.mocked(isOnChainConfigured);
const mockReadPosition = vi.mocked(readPosition);
const mockLoadLedger = vi.mocked(loadLedger);
const mockSaveLedger = vi.mocked(saveLedger);

// ── helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

// ── tests ────────────────────────────────────────────────────────────────────

describe("usePositions — demo mode (isOnChainConfigured = false)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConfigured.mockReturnValue(false);
    mockLoadLedger.mockReturnValue({ ledger: {}, reset: false });
  });

  it("falls back to demo ledger when not configured", () => {
    const { result } = renderHook(() => usePositions(null, MARKETS), {
      wrapper: makeWrapper(),
    });

    expect(result.current.position).toBeNull();
    expect(result.current.isLoadingPosition).toBe(false);
    expect(result.current.positionError).toBe("");
    expect(result.current.ledger).toEqual({});
  });

  it("loads ledger from storage when address is provided in demo mode", () => {
    const demoLedger = {
      XLM: { supplied: BigInt(10_000_000), borrowed: BigInt(0) },
    };
    mockLoadLedger.mockReturnValue({ ledger: demoLedger, reset: false });

    const { result } = renderHook(() => usePositions(ADDRESS, MARKETS), {
      wrapper: makeWrapper(),
    });

    expect(result.current.ledger).toEqual(demoLedger);
    expect(result.current.marketPositions).toMatchObject({ XLM: demoLedger.XLM });
  });

  it("sets resetNotice when storage was corrupted and ledger was reset", () => {
    mockLoadLedger.mockReturnValue({ ledger: {}, reset: true });

    const { result } = renderHook(() => usePositions(ADDRESS, MARKETS), {
      wrapper: makeWrapper(),
    });

    expect(result.current.resetNotice).toBe(true);
  });

  it("saveLedgerEntry persists and updates the in-memory ledger", () => {
    const { result } = renderHook(() => usePositions(ADDRESS, MARKETS), {
      wrapper: makeWrapper(),
    });

    const next = { XLM: { supplied: BigInt(5_000_000), borrowed: BigInt(0) } };
    act(() => result.current.saveLedgerEntry(next));

    expect(mockSaveLedger).toHaveBeenCalledWith(ADDRESS, next);
    expect(result.current.ledger).toEqual(next);
  });

  it("useBalances returns map keyed by asset symbol", () => {
    // This is a cross-check: demo ledger positions are keyed by symbol
    const demoLedger = {
      USDC: { supplied: BigInt(0), borrowed: BigInt(5_000_000) },
    };
    mockLoadLedger.mockReturnValue({ ledger: demoLedger, reset: false });

    const { result } = renderHook(() => usePositions(ADDRESS, MARKETS), {
      wrapper: makeWrapper(),
    });

    // marketPositions is keyed by asset symbol
    expect(Object.keys(result.current.marketPositions)).toContain("USDC");
    expect(result.current.marketPositions["USDC"]?.borrowed).toBe(BigInt(5_000_000));
  });
});

describe("usePositions — on-chain mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConfigured.mockReturnValue(true);
    mockLoadLedger.mockReturnValue({ ledger: {}, reset: false });
  });

  it("loading: isLoadingPosition is true while query is in-flight", () => {
    mockReadPosition.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePositions(ADDRESS, MARKETS), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isLoadingPosition).toBe(true);
    expect(result.current.position).toBeNull();
  });

  it("success: populates position and builds marketPositions for live markets", async () => {
    const onChainPos = {
      collateral: BigInt(50_000_000),
      debt: BigInt(10_000_000),
      healthFactor: BigInt(35_000),
    };
    mockReadPosition.mockResolvedValue(onChainPos);

    const { result } = renderHook(() => usePositions(ADDRESS, MARKETS), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoadingPosition).toBe(false));

    expect(result.current.position).toEqual(onChainPos);
    expect(result.current.positionError).toBe("");

    // Live markets (XLM.live === true) should use on-chain collateral/debt
    const xlmPos = result.current.marketPositions["XLM"];
    expect(xlmPos?.supplied).toBe(onChainPos.collateral);
    expect(xlmPos?.borrowed).toBe(onChainPos.debt);
  });

  it("usePositions falls back to demo ledger when not configured", async () => {
    // Reconfigure to not-configured mid-test
    mockIsConfigured.mockReturnValue(false);
    const demoLedger = { XLM: { supplied: BigInt(1_000_000), borrowed: BigInt(0) } };
    mockLoadLedger.mockReturnValue({ ledger: demoLedger, reset: false });

    const { result } = renderHook(() => usePositions(ADDRESS, MARKETS), {
      wrapper: makeWrapper(),
    });

    // Should not attempt on-chain read
    expect(mockReadPosition).not.toHaveBeenCalled();
    expect(result.current.position).toBeNull();
    expect(result.current.ledger).toEqual(demoLedger);
  });

  it("error: sets positionError when readPosition rejects", async () => {
    mockReadPosition.mockRejectedValue(new Error("Contract not found"));

    const { result } = renderHook(
      () => usePositions(ADDRESS, MARKETS, "Could not load your on-chain position."),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoadingPosition).toBe(false));

    expect(result.current.positionError).toBe("Could not load your on-chain position.");
    expect(result.current.position).toBeNull();
  });
});
