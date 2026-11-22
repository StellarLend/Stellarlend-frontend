import { describe, it, expect, beforeEach } from "vitest";
import { loadLedger, saveLedger, storageKey, type Ledger } from "./demo-ledger";

describe("positions-storage hardening", () => {
  const address = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
  const key = storageKey(address);

  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  });

  it("handles valid v2 positions", () => {
    const validLedger: Ledger = {
      XLM: { supplied: 10000000n, borrowed: 5000000n },
      USDC: { supplied: 20000000n, borrowed: 0n },
    };
    saveLedger(address, validLedger);

    const { ledger, reset } = loadLedger(address);
    expect(reset).toBe(false);
    expect(ledger.XLM).toEqual({ supplied: 10000000n, borrowed: 5000000n });
    expect(ledger.USDC).toEqual({ supplied: 20000000n, borrowed: 0n });
  });

  it("drops malformed position entries like {'XLM': null} without crashing", () => {
    const corruptPayload = {
      v: 2,
      positions: {
        XLM: null,
        USDC: { supplied: "10000000", borrowed: "0" },
      },
    };
    localStorage.setItem(key, JSON.stringify(corruptPayload));

    const { ledger, reset } = loadLedger(address);
    expect(reset).toBe(false);
    expect(ledger.XLM).toBeUndefined();
    expect(ledger.USDC).toEqual({ supplied: 10000000n, borrowed: 0n });
  });

  it("gracefully resets when root positions object is an array or string", () => {
    localStorage.setItem(key, JSON.stringify({ v: 2, positions: ["corrupt", "array"] }));
    const result1 = loadLedger(address);
    expect(result1.reset).toBe(true);
    expect(result1.ledger).toEqual({});

    localStorage.setItem(key, JSON.stringify({ v: 2, positions: "corrupt string" }));
    const result2 = loadLedger(address);
    expect(result2.reset).toBe(true);
    expect(result2.ledger).toEqual({});
  });

  it("gracefully resets when stored JSON is a raw primitive or array", () => {
    localStorage.setItem(key, JSON.stringify(["just an array"]));
    const result1 = loadLedger(address);
    expect(result1.reset).toBe(true);
    expect(result1.ledger).toEqual({});

    localStorage.setItem(key, JSON.stringify("a raw string"));
    const result2 = loadLedger(address);
    expect(result2.reset).toBe(true);
    expect(result2.ledger).toEqual({});

    localStorage.setItem(key, JSON.stringify(12345));
    const result3 = loadLedger(address);
    expect(result3.reset).toBe(true);
    expect(result3.ledger).toEqual({});
  });

  it("drops positions with non-numeric or negative strings", () => {
    const payload = {
      v: 2,
      positions: {
        XLM: { supplied: "-100", borrowed: "0" },
        USDC: { supplied: "not-a-number", borrowed: "0" },
        BTC: { supplied: "500", borrowed: "100" },
      },
    };
    localStorage.setItem(key, JSON.stringify(payload));

    const { ledger, reset } = loadLedger(address);
    expect(reset).toBe(false);
    expect(ledger.XLM).toBeUndefined();
    expect(ledger.USDC).toBeUndefined();
    expect(ledger.BTC).toEqual({ supplied: 500n, borrowed: 100n });
  });
});
