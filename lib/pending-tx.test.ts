/**
 * Tests for lib/pending-tx.ts
 *
 * Covers: load/save round-trip, schema validation, pruning, upsert,
 * status update, duplicate detection, corrupt JSON, storage unavailable,
 * network+address isolation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRUNE_AGE_MS,
  hasDuplicatePending,
  loadPendingTxs,
  pendingTxStorageKey,
  removePendingTx,
  savePendingTxs,
  updatePendingTxStatus,
  upsertPendingTx,
  type PendingTxEntry,
} from "./pending-tx";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<PendingTxEntry> = {}): PendingTxEntry {
  return {
    hash: "abc123",
    action: "deposit",
    asset: "XLM",
    amount: "10000000",
    submittedAt: Date.now(),
    status: "pending",
    ...overrides,
  };
}

const NET = "testnet";
const ADDR = "GABC1234";

beforeEach(() => {
  localStorage.clear();
});

// ─── storage key ──────────────────────────────────────────────────────────────

describe("pendingTxStorageKey", () => {
  it("includes network and address", () => {
    const key = pendingTxStorageKey("testnet", "GABC");
    expect(key).toBe("stellarlend-pending-tx:v1:testnet:GABC");
  });
});

// ─── load/save round-trip ─────────────────────────────────────────────────────

describe("savePendingTxs / loadPendingTxs", () => {
  it("saves and reloads entries", () => {
    const entry = makeEntry();
    savePendingTxs(NET, ADDR, [entry]);
    const loaded = loadPendingTxs(NET, ADDR);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].hash).toBe("abc123");
    expect(loaded[0].action).toBe("deposit");
  });

  it("returns empty array when nothing stored", () => {
    expect(loadPendingTxs(NET, ADDR)).toEqual([]);
  });

  it("removes the key when saving an empty array", () => {
    savePendingTxs(NET, ADDR, [makeEntry()]);
    savePendingTxs(NET, ADDR, []);
    expect(localStorage.getItem(pendingTxStorageKey(NET, ADDR))).toBeNull();
  });

  it("isolates different networks", () => {
    savePendingTxs("testnet", ADDR, [makeEntry({ hash: "h1" })]);
    savePendingTxs("mainnet", ADDR, [makeEntry({ hash: "h2" })]);
    expect(loadPendingTxs("testnet", ADDR)[0].hash).toBe("h1");
    expect(loadPendingTxs("mainnet", ADDR)[0].hash).toBe("h2");
  });

  it("isolates different addresses", () => {
    savePendingTxs(NET, "ADDR_A", [makeEntry({ hash: "ha" })]);
    savePendingTxs(NET, "ADDR_B", [makeEntry({ hash: "hb" })]);
    expect(loadPendingTxs(NET, "ADDR_A")[0].hash).toBe("ha");
    expect(loadPendingTxs(NET, "ADDR_B")[0].hash).toBe("hb");
  });
});

// ─── pruning ──────────────────────────────────────────────────────────────────

describe("pruning", () => {
  it("prunes entries older than 24 h on save", () => {
    const old = makeEntry({ hash: "old", submittedAt: Date.now() - PRUNE_AGE_MS - 1 });
    const fresh = makeEntry({ hash: "fresh", submittedAt: Date.now() });
    savePendingTxs(NET, ADDR, [old, fresh]);
    const loaded = loadPendingTxs(NET, ADDR);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].hash).toBe("fresh");
  });

  it("prunes entries older than 24 h on load", () => {
    // Write without pruning by injecting raw JSON.
    const key = pendingTxStorageKey(NET, ADDR);
    const old = makeEntry({ hash: "stale", submittedAt: Date.now() - PRUNE_AGE_MS - 1 });
    localStorage.setItem(key, JSON.stringify({ v: 1, txs: [old] }));
    const loaded = loadPendingTxs(NET, ADDR);
    expect(loaded).toHaveLength(0);
  });

  it("keeps entries exactly at the boundary (not yet expired)", () => {
    const now = Date.now();
    // submittedAt = now - PRUNE_AGE_MS + 1ms → still within window
    const borderEntry = makeEntry({
      hash: "border",
      submittedAt: now - PRUNE_AGE_MS + 1,
    });
    savePendingTxs(NET, ADDR, [borderEntry], now);
    const loaded = loadPendingTxs(NET, ADDR, now);
    expect(loaded).toHaveLength(1);
  });
});

// ─── corrupt / invalid storage ────────────────────────────────────────────────

describe("corrupt storage", () => {
  it("returns empty array for corrupt JSON without crashing", () => {
    const key = pendingTxStorageKey(NET, ADDR);
    localStorage.setItem(key, "{ not valid json }}");
    expect(() => loadPendingTxs(NET, ADDR)).not.toThrow();
    expect(loadPendingTxs(NET, ADDR)).toEqual([]);
  });

  it("returns empty array when version is wrong", () => {
    const key = pendingTxStorageKey(NET, ADDR);
    localStorage.setItem(key, JSON.stringify({ v: 99, txs: [] }));
    expect(loadPendingTxs(NET, ADDR)).toEqual([]);
  });

  it("drops malformed individual entries silently", () => {
    const key = pendingTxStorageKey(NET, ADDR);
    // txs contains one valid entry and one malformed one (missing hash)
    localStorage.setItem(
      key,
      JSON.stringify({
        v: 1,
        txs: [
          makeEntry({ hash: "good" }),
          { action: "deposit", asset: "XLM" }, // missing hash/amount/submittedAt
        ],
      }),
    );
    const loaded = loadPendingTxs(NET, ADDR);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].hash).toBe("good");
  });

  it("does not crash when localStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    expect(() => loadPendingTxs(NET, ADDR)).not.toThrow();
    expect(loadPendingTxs(NET, ADDR)).toEqual([]);
    vi.restoreAllMocks();
  });

  it("does not crash when localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => savePendingTxs(NET, ADDR, [makeEntry()])).not.toThrow();
    vi.restoreAllMocks();
  });
});

// ─── upsertPendingTx ─────────────────────────────────────────────────────────

describe("upsertPendingTx", () => {
  it("adds a new entry", () => {
    upsertPendingTx(NET, ADDR, makeEntry({ hash: "h1" }));
    expect(loadPendingTxs(NET, ADDR)).toHaveLength(1);
  });

  it("replaces an existing entry with the same hash", () => {
    upsertPendingTx(NET, ADDR, makeEntry({ hash: "h1", status: "pending" }));
    upsertPendingTx(NET, ADDR, makeEntry({ hash: "h1", status: "confirmed" }));
    const loaded = loadPendingTxs(NET, ADDR);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].status).toBe("confirmed");
  });
});

// ─── updatePendingTxStatus ────────────────────────────────────────────────────

describe("updatePendingTxStatus", () => {
  it("updates status to confirmed", () => {
    savePendingTxs(NET, ADDR, [makeEntry({ hash: "h1", status: "pending" })]);
    updatePendingTxStatus(NET, ADDR, "h1", "confirmed");
    const loaded = loadPendingTxs(NET, ADDR);
    expect(loaded[0].status).toBe("confirmed");
  });

  it("stores errorMessage on failure", () => {
    savePendingTxs(NET, ADDR, [makeEntry({ hash: "h1", status: "pending" })]);
    updatePendingTxStatus(NET, ADDR, "h1", "failed", "insufficient funds");
    const loaded = loadPendingTxs(NET, ADDR);
    expect(loaded[0].status).toBe("failed");
    expect(loaded[0].errorMessage).toBe("insufficient funds");
  });

  it("is a no-op for an unknown hash", () => {
    savePendingTxs(NET, ADDR, [makeEntry({ hash: "h1" })]);
    updatePendingTxStatus(NET, ADDR, "unknown-hash", "confirmed");
    expect(loadPendingTxs(NET, ADDR)[0].hash).toBe("h1");
  });
});

// ─── removePendingTx ─────────────────────────────────────────────────────────

describe("removePendingTx", () => {
  it("removes the entry by hash", () => {
    savePendingTxs(NET, ADDR, [makeEntry({ hash: "h1" }), makeEntry({ hash: "h2" })]);
    removePendingTx(NET, ADDR, "h1");
    const loaded = loadPendingTxs(NET, ADDR);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].hash).toBe("h2");
  });

  it("is a no-op for an unknown hash", () => {
    savePendingTxs(NET, ADDR, [makeEntry({ hash: "h1" })]);
    removePendingTx(NET, ADDR, "not-there");
    expect(loadPendingTxs(NET, ADDR)).toHaveLength(1);
  });
});

// ─── hasDuplicatePending ─────────────────────────────────────────────────────

describe("hasDuplicatePending", () => {
  it("returns true when a pending entry with same action+asset exists", () => {
    savePendingTxs(NET, ADDR, [
      makeEntry({ hash: "h1", action: "deposit", asset: "XLM", status: "pending" }),
    ]);
    expect(hasDuplicatePending(NET, ADDR, "deposit", "XLM")).toBe(true);
  });

  it("returns false when the matching entry is confirmed (not pending)", () => {
    savePendingTxs(NET, ADDR, [
      makeEntry({ hash: "h1", action: "deposit", asset: "XLM", status: "confirmed" }),
    ]);
    expect(hasDuplicatePending(NET, ADDR, "deposit", "XLM")).toBe(false);
  });

  it("returns false when the action differs", () => {
    savePendingTxs(NET, ADDR, [
      makeEntry({ hash: "h1", action: "borrow", asset: "XLM", status: "pending" }),
    ]);
    expect(hasDuplicatePending(NET, ADDR, "deposit", "XLM")).toBe(false);
  });

  it("returns false when the asset differs", () => {
    savePendingTxs(NET, ADDR, [
      makeEntry({ hash: "h1", action: "deposit", asset: "USDC", status: "pending" }),
    ]);
    expect(hasDuplicatePending(NET, ADDR, "deposit", "XLM")).toBe(false);
  });

  it("returns false when nothing is stored", () => {
    expect(hasDuplicatePending(NET, ADDR, "deposit", "XLM")).toBe(false);
  });
});
