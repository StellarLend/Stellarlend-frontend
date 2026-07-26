import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, render, act, waitFor } from "@/test/test-utils";
import { usePendingTransactions, ItemTrackers } from "./usePendingTransactions";
import {
  addInFlightTx,
  clearInFlightTxs,
  removeInFlightTx,
} from "@/lib/tx/inFlightTxStore";
import { TX_API_STATUS } from "@/lib/tx/constants";

const trackerMounts: string[] = [];

vi.mock("@/lib/tx/useTxStatus", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/tx/useTxStatus")>(
      "@/lib/tx/useTxStatus",
    );
  return {
    ...actual,
    default: (hash: string | null) => {
      React.useEffect(() => {
        if (hash) trackerMounts.push(hash);
      }, [hash]);
      return actual.default(hash);
    },
  };
});

describe("usePendingTransactions", () => {
  beforeEach(() => {
    clearInFlightTxs();
    trackerMounts.length = 0;
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
    render(<ItemTrackers />);

    await waitFor(() => {
      expect(result.current.pendingTxs).toHaveLength(0);
    });
  });

  it("does not remount ItemTracker for sibling transactions when one transaction is removed", async () => {
    act(() => {
      addInFlightTx({
        hash: "hash-a",
        type: "Lend Funds",
        amount: 500,
        asset: "XLM",
      });
      addInFlightTx({
        hash: "hash-b",
        type: "Deposit",
        amount: 100,
        asset: "USDC",
      });
    });

    render(<ItemTrackers />);

    await waitFor(() => {
      expect(trackerMounts).toEqual(
        expect.arrayContaining(["hash-a", "hash-b"]),
      );
    });
    expect(trackerMounts.filter((h) => h === "hash-a")).toHaveLength(1);
    expect(trackerMounts.filter((h) => h === "hash-b")).toHaveLength(1);

    act(() => {
      removeInFlightTx("hash-b");
    });

    // hash-a's tracker must still be the original instance: it should not
    // have mounted a second time as a side effect of its sibling being
    // removed from the pending list.
    expect(trackerMounts.filter((h) => h === "hash-a")).toHaveLength(1);
  });
});
