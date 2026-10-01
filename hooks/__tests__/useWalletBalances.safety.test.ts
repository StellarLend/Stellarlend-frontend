import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useWalletBalances } from "../useWalletBalances";
import { ASSETS } from "@/lib/assets";

/**
 * Failure-path and boundary coverage for the balances hook.
 *
 * `hooks/__tests__/useWalletBalances.test.ts` covers the happy paths through a
 * real WalletProvider. These tests drive the hook directly so the wallet can be
 * switched mid-flight and the fetcher can be made to hang, reject, or resolve
 * out of order — none of which is expressible through the provider.
 */

const fetchWalletBalancesMock = vi.hoisted(() => vi.fn());
const useWalletMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/wallet/balances", () => ({
  fetchWalletBalances: fetchWalletBalancesMock,
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: useWalletMock,
}));

const ACCOUNT_A = "GAUFVBMULU2CJRE5IGVPEOXRYZGU5YDAOSQ3UQTBM3Y7ARUPFSXZUHN5";
const ACCOUNT_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

function connected(address: string) {
  return { address, status: "connected" };
}

function disconnected() {
  return { address: null, status: "disconnected" };
}

function onChainBalance(symbol: string, amount: number) {
  return {
    symbol,
    name: symbol,
    amount,
    formatted: String(amount),
    hasMetadata: true,
  };
}

function balanceOf(
  result: { current: ReturnType<typeof useWalletBalances> },
  symbol: string,
): number | undefined {
  return result.current.assetsWithBalances.find((a) => a.symbol === symbol)
    ?.balance;
}

beforeEach(() => {
  fetchWalletBalancesMock.mockReset();
  useWalletMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useWalletBalances account switching", () => {
  it("never shows one account's balances while another account is loading", async () => {
    useWalletMock.mockReturnValue(connected(ACCOUNT_A));
    fetchWalletBalancesMock.mockResolvedValueOnce([
      onChainBalance("XLM", 111),
      onChainBalance("USDC", 222),
    ]);

    const { result, rerender } = renderHook(() => useWalletBalances());

    await waitFor(() => expect(balanceOf(result, "XLM")).toBe(111));
    expect(balanceOf(result, "USDC")).toBe(222);

    // Account B's request never settles during this test.
    let resolveB: (value: unknown) => void = () => {};
    fetchWalletBalancesMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveB = resolve;
        }),
    );

    useWalletMock.mockReturnValue(connected(ACCOUNT_B));
    rerender();

    await waitFor(() => expect(result.current.loading).toBe(true));

    // Account A's numbers must not be presented as account B's funds.
    expect(balanceOf(result, "XLM")).toBe(0);
    expect(balanceOf(result, "USDC")).toBe(0);

    await act(async () => {
      resolveB([onChainBalance("XLM", 999)]);
    });

    await waitFor(() => expect(balanceOf(result, "XLM")).toBe(999));
    expect(result.current.loading).toBe(false);
  });

  it("discards a response that arrives after the account changed", async () => {
    useWalletMock.mockReturnValue(connected(ACCOUNT_A));

    let resolveA: (value: unknown) => void = () => {};
    fetchWalletBalancesMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveA = resolve;
        }),
    );

    const { result, rerender } = renderHook(() => useWalletBalances());
    await waitFor(() => expect(result.current.loading).toBe(true));

    fetchWalletBalancesMock.mockResolvedValueOnce([onChainBalance("XLM", 7)]);
    useWalletMock.mockReturnValue(connected(ACCOUNT_B));
    rerender();

    await waitFor(() => expect(balanceOf(result, "XLM")).toBe(7));

    // A's late response lands last but must be ignored.
    await act(async () => {
      resolveA([onChainBalance("XLM", 999)]);
    });

    expect(balanceOf(result, "XLM")).toBe(7);
  });

  it("falls back to the canonical ASSETS list when the wallet disconnects", async () => {
    useWalletMock.mockReturnValue(connected(ACCOUNT_A));
    fetchWalletBalancesMock.mockResolvedValueOnce([
      onChainBalance("XLM", 111),
    ]);

    const { result, rerender } = renderHook(() => useWalletBalances());
    await waitFor(() => expect(balanceOf(result, "XLM")).toBe(111));

    useWalletMock.mockReturnValue(disconnected());
    rerender();

    await waitFor(() =>
      expect(result.current.assetsWithBalances).toEqual(ASSETS),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe("useWalletBalances failure handling", () => {
  it("retains the last known balances when a later fetch fails", async () => {
    useWalletMock.mockReturnValue(connected(ACCOUNT_A));
    fetchWalletBalancesMock.mockResolvedValueOnce([
      onChainBalance("XLM", 111),
    ]);

    const { result } = renderHook(() => useWalletBalances());
    await waitFor(() => expect(balanceOf(result, "XLM")).toBe(111));

    fetchWalletBalancesMock.mockRejectedValueOnce(
      new Error("Horizon unreachable"),
    );

    act(() => {
      result.current.refetch();
    });

    await waitFor(() =>
      expect(result.current.error).toBe("Horizon unreachable"),
    );

    // A transient outage must not zero out a funded wallet, which would block
    // every lending form with a false "insufficient balance".
    expect(balanceOf(result, "XLM")).toBe(111);
  });

  it("reports a safe message for non-Error rejections", async () => {
    useWalletMock.mockReturnValue(connected(ACCOUNT_A));
    fetchWalletBalancesMock.mockRejectedValueOnce("raw internal failure");

    const { result } = renderHook(() => useWalletBalances());

    await waitFor(() =>
      expect(result.current.error).toBe("Unable to load wallet balances."),
    );
    expect(result.current.error).not.toContain("raw internal failure");
  });

  it("recovers on refetch after a failure and clears the error", async () => {
    useWalletMock.mockReturnValue(connected(ACCOUNT_A));
    fetchWalletBalancesMock.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useWalletBalances());

    await waitFor(() => expect(result.current.error).toBe("boom"));
    // Nothing is known about this account yet, so connected-but-unknown => 0.
    expect(balanceOf(result, "XLM")).toBe(0);

    fetchWalletBalancesMock.mockResolvedValueOnce([onChainBalance("XLM", 42)]);

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(balanceOf(result, "XLM")).toBe(42);
    expect(result.current.loading).toBe(false);
  });

  it("does not retry on its own after a failure", async () => {
    useWalletMock.mockReturnValue(connected(ACCOUNT_A));
    fetchWalletBalancesMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useWalletBalances());

    await waitFor(() => expect(result.current.error).toBe("boom"));

    // No hidden retry loop: one effect run, one request.
    expect(fetchWalletBalancesMock).toHaveBeenCalledTimes(1);
  });
});
