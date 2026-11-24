/**
 * Focused tests for useWalletBalances.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWalletBalances } from "./use-wallet-balances";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      unfunded: "Unfunded",
    };
    return map[key] ?? key;
  },
}));

const TEST_ADDRESS = "GBZXN7PIRZGNMHGA728R4EUCHPT3LFQPUVAHEUMCM46U223EDPHIFDDD";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    client,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

describe("useWalletBalances", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns null balance and unknown status when address is null", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWalletBalances(null), { wrapper });
    expect(result.current.balance).toBeNull();
    expect(result.current.accountStatus).toBe("unknown");
    expect(result.current.balances).toEqual({});
    expect(result.current.isUnfunded).toBe(false);
  });

  it("returns funded status and formatted balance from Horizon", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        balances: [{ asset_type: "native", balance: "75.5000000" }],
      }),
    }) as unknown as typeof fetch;

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWalletBalances(TEST_ADDRESS), { wrapper });

    await waitFor(() => expect(result.current.balance).toBe("75.50"));
    expect(result.current.accountStatus).toBe("funded");
    expect(result.current.isUnfunded).toBe(false);
  });

  it("returns unfunded status when Horizon returns 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch;

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWalletBalances(TEST_ADDRESS), { wrapper });

    await waitFor(() => expect(result.current.accountStatus).toBe("unfunded"));
    expect(result.current.balance).toBe("Unfunded");
    expect(result.current.isUnfunded).toBe(true);
    expect(result.current.balances).toEqual({});
  });

  it("returns error status on network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failed")) as unknown as typeof fetch;

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWalletBalances(TEST_ADDRESS), { wrapper });

    await waitFor(() => expect(result.current.accountStatus).toBe("error"));
    expect(result.current.balance).toBeNull();
  });

  it("re-fetches balance after invalidateBalance is called", async () => {
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      call++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          balances: [{ asset_type: "native", balance: call === 1 ? "10.0000000" : "20.0000000" }],
        }),
      };
    }) as unknown as typeof fetch;

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWalletBalances(TEST_ADDRESS), { wrapper });

    await waitFor(() => expect(result.current.balance).toBe("10.00"));

    await act(async () => {
      await result.current.invalidateBalance();
    });

    await waitFor(() => expect(result.current.balance).toBe("20.00"));
    expect(call).toBe(2);
  });
});
