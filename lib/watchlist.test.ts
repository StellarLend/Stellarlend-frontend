/**
 * Tests for lib/watchlist.ts
 *
 * Test plan from issue #1854:
 *   - toggles symbol
 *   - ignores unknown symbols
 *   - survives corrupt storage
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadWatchlist, saveWatchlist, toggleWatchlist, watchlistKey } from "./watchlist";

// ─── localStorage mock ────────────────────────────────────────────────────────

function makeStorage(): Record<string, string> {
  return {};
}

function mockLocalStorage(store: Record<string, string>) {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  });
}

// ─── watchlistKey ─────────────────────────────────────────────────────────────

describe("watchlistKey", () => {
  it("namespaces with address when connected", () => {
    expect(watchlistKey("GABC123")).toBe("stellarlend-watchlist:v1:GABC123");
  });

  it("falls back to anon when address is null", () => {
    expect(watchlistKey(null)).toBe("stellarlend-watchlist:v1:anon");
  });
});

// ─── loadWatchlist ────────────────────────────────────────────────────────────

describe("loadWatchlist", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = makeStorage();
    mockLocalStorage(store);
  });

  it("returns empty array when nothing is stored", () => {
    expect(loadWatchlist(null)).toEqual([]);
  });

  it("returns stored known symbols", () => {
    store["stellarlend-watchlist:v1:anon"] = JSON.stringify(["XLM", "USDC"]);
    expect(loadWatchlist(null)).toEqual(["XLM", "USDC"]);
  });

  it("filters out unknown symbols", () => {
    store["stellarlend-watchlist:v1:anon"] = JSON.stringify(["XLM", "UNKNOWN_TOKEN"]);
    expect(loadWatchlist(null)).toEqual(["XLM"]);
  });

  it("survives corrupt storage (non-JSON)", () => {
    store["stellarlend-watchlist:v1:anon"] = "{not valid json[[[";
    expect(loadWatchlist(null)).toEqual([]);
  });

  it("survives corrupt storage (non-array JSON)", () => {
    store["stellarlend-watchlist:v1:anon"] = JSON.stringify({ symbols: ["XLM"] });
    expect(loadWatchlist(null)).toEqual([]);
  });

  it("survives corrupt storage (array with non-string entries)", () => {
    store["stellarlend-watchlist:v1:anon"] = JSON.stringify([1, null, true, "XLM"]);
    expect(loadWatchlist(null)).toEqual(["XLM"]);
  });

  it("returns empty array when localStorage throws on getItem", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("unavailable"); },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
    expect(loadWatchlist(null)).toEqual([]);
  });

  it("uses per-address key", () => {
    store["stellarlend-watchlist:v1:GADDR"] = JSON.stringify(["BTC"]);
    expect(loadWatchlist("GADDR")).toEqual(["BTC"]);
    expect(loadWatchlist(null)).toEqual([]);
  });
});

// ─── saveWatchlist ────────────────────────────────────────────────────────────

describe("saveWatchlist", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = makeStorage();
    mockLocalStorage(store);
  });

  it("persists known symbols", () => {
    saveWatchlist(null, ["XLM", "USDC"]);
    expect(JSON.parse(store["stellarlend-watchlist:v1:anon"])).toEqual(["XLM", "USDC"]);
  });

  it("drops unknown symbols before persisting", () => {
    saveWatchlist(null, ["XLM", "FAKE"]);
    expect(JSON.parse(store["stellarlend-watchlist:v1:anon"])).toEqual(["XLM"]);
  });

  it("does not throw when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => { throw new Error("quota exceeded"); },
      removeItem: () => {},
      clear: () => {},
    });
    expect(() => saveWatchlist(null, ["XLM"])).not.toThrow();
  });
});

// ─── toggleWatchlist ──────────────────────────────────────────────────────────

describe("toggleWatchlist", () => {
  it("adds a known symbol that is not present", () => {
    const result = toggleWatchlist([], "XLM");
    expect(result).toContain("XLM");
  });

  it("removes a symbol that is already present", () => {
    const result = toggleWatchlist(["XLM", "USDC"], "XLM");
    expect(result).not.toContain("XLM");
    expect(result).toContain("USDC");
  });

  it("ignores unknown symbols", () => {
    const result = toggleWatchlist(["XLM"], "UNKNOWN_TOKEN");
    expect(result).toEqual(["XLM"]);
  });

  it("returns a new array (immutable)", () => {
    const original = ["XLM"];
    const result = toggleWatchlist(original, "USDC");
    expect(result).not.toBe(original);
  });

  it("toggle twice is idempotent (add then remove)", () => {
    const after1 = toggleWatchlist([], "USDC");
    const after2 = toggleWatchlist(after1, "USDC");
    expect(after2).not.toContain("USDC");
  });
});
