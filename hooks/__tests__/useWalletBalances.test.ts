import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useWalletBalances } from "../useWalletBalances";
import { ASSETS } from "@/lib/assets";
import { createElement, type ReactNode } from "react";
import { WalletProvider } from "@/context/WalletContext";

const fetchWalletBalancesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/wallet/balances", () => ({
  fetchWalletBalances: fetchWalletBalancesMock,
}));

function wrapper({ children }: { children: ReactNode }) {
  return createElement(WalletProvider, null, children);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  fetchWalletBalancesMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as any).stellar;
});

describe("useWalletBalances", () => {
  it("returns fallback ASSETS when wallet is disconnected", () => {
    const { result } = renderHook(() => useWalletBalances(), { wrapper });

    expect(result.current.assetsWithBalances).toEqual(ASSETS);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns live balances when wallet is connected", async () => {
    const mockBalances = [
      { symbol: "XLM", name: "Stellar Lumens", amount: 100, formatted: "100.0000000", hasMetadata: true },
      { symbol: "USDC", name: "USD Coin", amount: 500, formatted: "500.000000", hasMetadata: true },
    ];
    fetchWalletBalancesMock.mockResolvedValue(mockBalances);

    window.sessionStorage.setItem("walletAddress", "GABCDEF1234567890");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        session: { user: { walletAddress: "GABCDEF1234567890" } },
      }),
    } as Response);

    const { result } = renderHook(() => useWalletBalances(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const xlmAsset = result.current.assetsWithBalances.find((a) => a.symbol === "XLM");
    const usdcAsset = result.current.assetsWithBalances.find((a) => a.symbol === "USDC");
    const btcAsset = result.current.assetsWithBalances.find((a) => a.symbol === "BTC");

    expect(xlmAsset?.balance).toBe(100);
    expect(usdcAsset?.balance).toBe(500);
    expect(btcAsset?.balance).toBe(0);
    expect(fetchWalletBalancesMock).toHaveBeenCalledWith("GABCDEF1234567890");
  });

  it("falls back to ASSETS when wallet disconnects", async () => {
    window.sessionStorage.setItem("walletAddress", "GABCDEF1234567890");
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: { user: { walletAddress: "GABCDEF1234567890" } },
        }),
      } as Response);

    const { result } = renderHook(() => useWalletBalances(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.assetsWithBalances).toEqual(ASSETS);
  });

  it("sets error when fetchWalletBalances fails", async () => {
    fetchWalletBalancesMock.mockRejectedValue(new Error("Horizon unreachable"));

    window.sessionStorage.setItem("walletAddress", "GABCDEF1234567890");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        session: { user: { walletAddress: "GABCDEF1234567890" } },
      }),
    } as Response);

    const { result } = renderHook(() => useWalletBalances(), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBe("Horizon unreachable");
    });
  });

  it("sets assets to zero for connected wallet with no on-chain balances", async () => {
    fetchWalletBalancesMock.mockResolvedValue([]);

    window.sessionStorage.setItem("walletAddress", "GABCDEF1234567890");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        session: { user: { walletAddress: "GABCDEF1234567890" } },
      }),
    } as Response);

    const { result } = renderHook(() => useWalletBalances(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    for (const asset of result.current.assetsWithBalances) {
      expect(asset.balance).toBe(0);
    }
  });
});
