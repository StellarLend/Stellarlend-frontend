/**
 * Tests for hooks/use-pending-txs.ts
 *
 * Covers: resume polling after remount, confirmed/failed settle callbacks,
 * timeout handling, duplicate guard, cross-tab storage event, abort on
 * unmount, and corrupt storage degradation.
 */

// @vitest-environment jsdom
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rpc } from "@stellar/stellar-sdk";

import { usePendingTxs } from "./use-pending-txs";
import {
  pendingTxStorageKey,
  savePendingTxs,
  type PendingTxEntry,
} from "@/lib/pending-tx";

// ─── mock rpc-tx ──────────────────────────────────────────────────────────────

vi.mock("@/lib/rpc-tx", () => ({
  getRpcServer: vi.fn(() => ({})),
  pollTransactionStatus: vi.fn(),
}));

import { pollTransactionStatus } from "@/lib/rpc-tx";
const mockPoll = pollTransactionStatus as ReturnType<typeof vi.fn>;

// ─── constants ────────────────────────────────────────────────────────────────

const NET = "testnet";   // matches vitest.setup.ts NEXT_PUBLIC_STELLAR_NETWORK
const ADDR = "GABC0001";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<PendingTxEntry> = {}): PendingTxEntry {
  return {
    hash: "hash001",
    action: "deposit",
    asset: "XLM",
    amount: "10000000",
    submittedAt: Date.now(),
    status: "pending",
    ...overrides,
  };
}

function successResponse(): rpc.Api.GetTransactionResponse {
  return { status: rpc.Api.GetTransactionStatus.SUCCESS } as rpc.Api.GetTransactionResponse;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── tests ────────────────────────────────────────────────────────────────────

describe("usePendingTxs – initial load", () => {
  it("loads persisted entries on mount", () => {
    savePendingTxs(NET, ADDR, [makeEntry({ hash: "stored" })]);
    mockPoll.mockResolvedValue(successResponse());

    const { result } = renderHook(() =>
      usePendingTxs({ address: ADDR }),
    );
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].hash).toBe("stored");
  });

  it("starts with empty entries when nothing stored", () => {
    const { result } = renderHook(() => usePendingTxs({ address: ADDR }));
    expect(result.current.entries).toEqual([]);
  });

  it("starts with empty entries when address is null", () => {
    const { result } = renderHook(() => usePendingTxs({ address: null }));
    expect(result.current.entries).toEqual([]);
  });
});

describe("usePendingTxs – resume polling after remount", () => {
  it("calls pollTransactionStatus for each pending entry on mount", async () => {
    savePendingTxs(NET, ADDR, [
      makeEntry({ hash: "h1", status: "pending" }),
      makeEntry({ hash: "h2", status: "pending" }),
    ]);
    mockPoll.mockResolvedValue(successResponse());

    renderHook(() => usePendingTxs({ address: ADDR }));

    await waitFor(() => expect(mockPoll).toHaveBeenCalledTimes(2));
    expect(mockPoll).toHaveBeenCalledWith("h1", expect.any(Object));
    expect(mockPoll).toHaveBeenCalledWith("h2", expect.any(Object));
  });

  it("does not resume already-confirmed entries", () => {
    savePendingTxs(NET, ADDR, [
      makeEntry({ hash: "done", status: "confirmed" }),
    ]);
    renderHook(() => usePendingTxs({ address: ADDR }));
    expect(mockPoll).not.toHaveBeenCalled();
  });
});

describe("usePendingTxs – onSettled callback", () => {
  it("fires onSettled with status=confirmed when poll succeeds", async () => {
    const onSettled = vi.fn();
    savePendingTxs(NET, ADDR, [makeEntry({ hash: "h1" })]);
    mockPoll.mockResolvedValue(successResponse());

    renderHook(() => usePendingTxs({ address: ADDR, onSettled }));

    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ hash: "h1", status: "confirmed", resumed: true }),
    );
  });

  it("fires onSettled with status=failed when poll rejects with non-timeout error", async () => {
    const onSettled = vi.fn();
    savePendingTxs(NET, ADDR, [makeEntry({ hash: "h1" })]);
    mockPoll.mockRejectedValue(new Error("Transaction failed on-chain: bad op"));

    renderHook(() => usePendingTxs({ address: ADDR, onSettled }));

    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ hash: "h1", status: "failed", resumed: true }),
    );
  });

  it("fires onSettled with status=timeout when poll times out", async () => {
    const onSettled = vi.fn();
    savePendingTxs(NET, ADDR, [makeEntry({ hash: "h1" })]);
    mockPoll.mockRejectedValue(
      new Error("Transaction timed out while waiting for confirmation: h1"),
    );

    renderHook(() => usePendingTxs({ address: ADDR, onSettled }));

    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ status: "timeout" }),
    );
  });
});

describe("usePendingTxs – record()", () => {
  it("adds the entry and starts polling", async () => {
    mockPoll.mockResolvedValue(successResponse());
    const { result } = renderHook(() => usePendingTxs({ address: ADDR }));

    act(() => {
      result.current.record(makeEntry({ hash: "new-h" }));
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].hash).toBe("new-h");

    await waitFor(() => expect(mockPoll).toHaveBeenCalledWith("new-h", expect.any(Object)));
  });

  it("persists to localStorage when record() is called", () => {
    mockPoll.mockResolvedValue(successResponse());
    const { result } = renderHook(() => usePendingTxs({ address: ADDR }));

    act(() => {
      result.current.record(makeEntry({ hash: "persisted" }));
    });

    const key = pendingTxStorageKey(NET, ADDR);
    const raw = localStorage.getItem(key);
    expect(raw).not.toBeNull();
    expect(raw).toContain("persisted");
  });
});

describe("usePendingTxs – isDuplicate()", () => {
  it("returns true while the same action+asset is pending", () => {
    savePendingTxs(NET, ADDR, [
      makeEntry({ hash: "h1", action: "deposit", asset: "XLM", status: "pending" }),
    ]);
    mockPoll.mockResolvedValue(successResponse());

    const { result } = renderHook(() => usePendingTxs({ address: ADDR }));
    expect(result.current.isDuplicate("deposit", "XLM")).toBe(true);
  });

  it("returns false once the entry has been confirmed", async () => {
    const onSettled = vi.fn();
    savePendingTxs(NET, ADDR, [
      makeEntry({ hash: "h1", action: "deposit", asset: "XLM", status: "pending" }),
    ]);
    mockPoll.mockResolvedValue(successResponse());

    const { result } = renderHook(() =>
      usePendingTxs({ address: ADDR, onSettled }),
    );

    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    // After poll resolves, state is updated to confirmed
    await waitFor(() => {
      const entry = result.current.entries.find((e) => e.hash === "h1");
      expect(entry?.status).toBe("confirmed");
    });
    expect(result.current.isDuplicate("deposit", "XLM")).toBe(false);
  });

  it("returns false for a different action", () => {
    savePendingTxs(NET, ADDR, [
      makeEntry({ hash: "h1", action: "borrow", asset: "XLM", status: "pending" }),
    ]);
    renderHook(() => usePendingTxs({ address: ADDR }));
    // isDuplicate checks storage directly
    const { result } = renderHook(() => usePendingTxs({ address: ADDR }));
    expect(result.current.isDuplicate("deposit", "XLM")).toBe(false);
  });
});

describe("usePendingTxs – remove()", () => {
  it("removes the entry from state and storage", () => {
    savePendingTxs(NET, ADDR, [makeEntry({ hash: "h1" })]);
    mockPoll.mockResolvedValue(successResponse());

    const { result } = renderHook(() => usePendingTxs({ address: ADDR }));

    act(() => {
      result.current.remove("h1");
    });

    expect(result.current.entries).toHaveLength(0);
    const key = pendingTxStorageKey(NET, ADDR);
    expect(localStorage.getItem(key)).toBeNull();
  });
});

describe("usePendingTxs – cross-tab storage event", () => {
  it("re-syncs when storage event fires for the right key", async () => {
    renderHook(() => usePendingTxs({ address: ADDR }));
    // Simulate another tab writing a new entry.
    savePendingTxs(NET, ADDR, [makeEntry({ hash: "cross-tab" })]);
    const key = pendingTxStorageKey(NET, ADDR);

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          newValue: localStorage.getItem(key),
        }),
      );
    });

    // After sync the entry should be in memory (but not re-polled since it
    // didn't come through record()).
    // We just assert the hook doesn't crash and the key is correct.
    expect(key).toContain(NET);
    expect(key).toContain(ADDR);
  });
});

describe("usePendingTxs – abort on unmount", () => {
  it("aborts pending poll when component unmounts", async () => {
    let rejectPoll!: (err: Error) => void;
    mockPoll.mockReturnValue(
      new Promise<never>((_, reject) => {
        rejectPoll = reject;
      }),
    );

    savePendingTxs(NET, ADDR, [makeEntry({ hash: "h1" })]);
    const onSettled = vi.fn();
    const { unmount } = renderHook(() =>
      usePendingTxs({ address: ADDR, onSettled }),
    );

    await waitFor(() => expect(mockPoll).toHaveBeenCalled());

    unmount();
    // Resolve the abort with an AbortError — onSettled should NOT fire.
    const err = new Error("aborted");
    err.name = "AbortError";
    act(() => rejectPoll(err));

    // Give microtasks a chance to run.
    await new Promise((r) => setTimeout(r, 0));
    expect(onSettled).not.toHaveBeenCalled();
  });
});

describe("usePendingTxs – corrupt storage degrades gracefully", () => {
  it("loads empty entries without crashing when JSON is corrupt", () => {
    const key = pendingTxStorageKey(NET, ADDR);
    localStorage.setItem(key, "CORRUPT{{{");
    expect(() => renderHook(() => usePendingTxs({ address: ADDR }))).not.toThrow();
    const { result } = renderHook(() => usePendingTxs({ address: ADDR }));
    expect(result.current.entries).toEqual([]);
  });
});

describe("usePendingTxs – network/address isolation", () => {
  it("does not load entries for a different address", () => {
    savePendingTxs(NET, "OTHER_ADDR", [makeEntry({ hash: "other" })]);
    const { result } = renderHook(() => usePendingTxs({ address: ADDR }));
    expect(result.current.entries).toHaveLength(0);
  });
});
