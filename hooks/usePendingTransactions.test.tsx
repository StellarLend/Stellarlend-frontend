import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@/test/test-utils";
import { usePendingTransactions } from "./usePendingTransactions";
import {
  addInFlightTx,
  clearInFlightTxs,
  removeInFlightTx,
} from "@/lib/tx/inFlightTxStore";
import { TX_API_STATUS } from "@/lib/tx/constants";

describe("usePendingTransactions", () => {
  beforeEach(() => {
    clearInFlightTxs();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: TX_API_STATUS.PENDING }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearInFlightTxs();
  });

  it("returns initial empty pending list", () => {
    const { result } = renderHook(() => usePendingTransactions());
    expect(result.current.pendingTxs).toEqual([]);
  });

  it("updates when in-flight transaction is added and removed", () => {
    const { result } = renderHook(() => usePendingTransactions());

    act(() => {
      addInFlightTx({
        hash: "hash-123",
        type: "Lend Funds",
        amount: 500,
        asset: "XLM",
      });
    });

    expect(result.current.pendingTxs).toHaveLength(1);
    expect(result.current.pendingTxs[0].hash).toBe("hash-123");

    act(() => {
      removeInFlightTx("hash-123");
    });

    expect(result.current.pendingTxs).toEqual([]);
  });

  it("removes transaction when terminal status is returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("hash-term")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ status: TX_API_STATUS.SUCCESS }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: TX_API_STATUS.PENDING }),
        });
      }),
    );

    const { result } = renderHook(() => usePendingTransactions());

    act(() => {
      addInFlightTx({
        hash: "hash-term",
        type: "Deposit",
        amount: 100,
        asset: "USDC",
      });
    });

    expect(result.current.pendingTxs).toHaveLength(1);

    // Render ItemTrackers element to trigger polling logic
    renderHook(() => {
      const pending = usePendingTransactions();
      return pending;
    });

    await waitFor(() => {
      expect(result.current.pendingTxs).toHaveLength(0);
    });
  });
});
