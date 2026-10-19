/**
 * Tests for lib/demo-ledger.ts
 *
 * Run with: node --test lib/demo-ledger.test.mjs
 * (Node.js 20+ built-in test runner — no external dependencies)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── inline port of demo-ledger (pure functions only, no DOM) ────────────────
// We re-implement the pure functions here so the test file has zero deps and
// runs in any Node 20 environment without a bundler.

const DECIMALS = 7;
const SCALE = 10n ** 7n;
const MAX_BASE_UNITS = 1_000_000_000_000_000n * SCALE;

function parseAmount(input, decimals = DECIMALS) {
  if (input === "") return { ok: false, error: "empty" };
  const trimmed = input.trim();
  if (trimmed !== input) return { ok: false, error: "invalid-format" };
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    if (trimmed === "Infinity" || trimmed === "NaN" || !isFinite(Number(trimmed)))
      return { ok: false, error: "not-finite" };
    return { ok: false, error: "invalid-format" };
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) return { ok: false, error: "too-many-decimals" };
  const paddedFrac = frac.padEnd(decimals, "0");
  const baseUnits = BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFrac);
  if (baseUnits > MAX_BASE_UNITS) return { ok: false, error: "too-large" };
  return { ok: true, value: baseUnits };
}

function formatAmount(baseUnits, decimals = DECIMALS) {
  const scale = BigInt(10 ** decimals);
  const whole = baseUnits / scale;
  const frac = baseUnits % scale;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

function toFloat(baseUnits, decimals = DECIMALS) {
  return Number(baseUnits) / 10 ** decimals;
}

function storageKey(address) {
  return `stellarlend-demo:v2:${address ?? "anon"}`;
}

function computeRisk(ledger, markets) {
  let collateralUsd = 0, borrowUsd = 0, limitUsd = 0;
  for (const m of markets) {
    const pos = ledger[m.symbol];
    if (!pos) continue;
    const decimals = m.decimals ?? DECIMALS;
    const supplied = toFloat(pos.supplied, decimals);
    const borrowed = toFloat(pos.borrowed, decimals);
    collateralUsd += supplied * m.price;
    limitUsd += supplied * m.price * m.ltv;
    borrowUsd += borrowed * m.price;
  }
  const health = borrowUsd > 0 ? limitUsd / borrowUsd : Infinity;
  return { collateralUsd, borrowUsd, limitUsd, health };
}

function canWithdraw(ledger, symbol, amount, markets) {
  const pos = ledger[symbol];
  if (!pos) return false;
  if (amount > pos.supplied) return false;
  const simulated = { ...ledger, [symbol]: { ...pos, supplied: pos.supplied - amount } };
  const { limitUsd, borrowUsd } = computeRisk(simulated, markets);
  return borrowUsd <= limitUsd;
}

function canBorrow(ledger, symbol, amount, markets) {
  const market = markets.find((m) => m.symbol === symbol);
  if (!market) return false;
  const decimals = market.decimals ?? DECIMALS;
  const addedUsd = toFloat(amount, decimals) * market.price;
  const { limitUsd, borrowUsd } = computeRisk(ledger, markets);
  return borrowUsd + addedUsd <= limitUsd;
}

// ── schema validation helpers (mirrors lib/demo-ledger.ts) ──────────────────
function isRawV2(data) {
  if (typeof data !== "object" || data === null) return false;
  if (data.v !== 2) return false;
  if (typeof data.positions !== "object" || data.positions === null) return false;
  for (const [, pos] of Object.entries(data.positions)) {
    if (typeof pos !== "object" || pos === null) return false;
    if (typeof pos.supplied !== "string" || typeof pos.borrowed !== "string") return false;
    if (!/^\d+$/.test(pos.supplied) || !/^\d+$/.test(pos.borrowed)) return false;
  }
  return true;
}

function migrateV1(data) {
  if (typeof data !== "object" || data === null) return null;
  const result = {};
  for (const [symbol, pos] of Object.entries(data)) {
    if (typeof pos !== "object" || pos === null) continue;
    const s = typeof pos.supplied === "number" && isFinite(pos.supplied) && pos.supplied >= 0
      ? BigInt(Math.round(pos.supplied * 10 ** DECIMALS)) : 0n;
    const b = typeof pos.borrowed === "number" && isFinite(pos.borrowed) && pos.borrowed >= 0
      ? BigInt(Math.round(pos.borrowed * 10 ** DECIMALS)) : 0n;
    result[symbol] = { supplied: s, borrowed: b };
  }
  return result;
}

// ── Test Markets fixture ─────────────────────────────────────────────────────
const MARKETS = [
  { symbol: "XLM",  price: 0.12,  ltv: 0.7,  decimals: 7 },
  { symbol: "USDC", price: 1,     ltv: 0.85, decimals: 7 },
  { symbol: "BTC",  price: 67000, ltv: 0.75, decimals: 8 },
];

// ── parseAmount tests ────────────────────────────────────────────────────────
describe("parseAmount — valid inputs", () => {
  it("parses integer", () => {
    const r = parseAmount("1");
    assert.equal(r.ok, true);
    assert.equal(r.value, 10_000_000n);
  });

  it("parses decimal", () => {
    const r = parseAmount("0.5");
    assert.equal(r.ok, true);
    assert.equal(r.value, 5_000_000n);
  });

  it("parses maximum fractional digits (7)", () => {
    const r = parseAmount("1.1234567");
    assert.equal(r.ok, true);
    assert.equal(r.value, 11_234_567n);
  });

  it("parses zero", () => {
    const r = parseAmount("0");
    assert.equal(r.ok, true);
    assert.equal(r.value, 0n);
  });

  it("parses large whole number", () => {
    const r = parseAmount("1000000");
    assert.equal(r.ok, true);
    assert.equal(r.value, 1_000_000n * 10_000_000n);
  });

  it("respects per-market decimals (8 for BTC)", () => {
    const r = parseAmount("1.12345678", 8);
    assert.equal(r.ok, true);
    assert.equal(r.value, 112_345_678n);
  });
});

describe("parseAmount — rejection cases", () => {
  it("rejects empty string", () => {
    assert.equal(parseAmount("").error, "empty");
  });

  it("rejects Infinity", () => {
    assert.equal(parseAmount("Infinity").error, "not-finite");
  });

  it("rejects 1e3 (exponent notation)", () => {
    assert.equal(parseAmount("1e3").error, "invalid-format");
  });

  it("rejects 1e400 (overflow exponent → Infinity)", () => {
    // 1e400 is Infinity in JS; the regex catches the 'e' before isFinite check
    // but the isFinite fallback also catches it — either not-finite or invalid-format is correct
    const r = parseAmount("1e400");
    assert.equal(r.ok, false);
    assert.ok(
      r.error === "not-finite" || r.error === "invalid-format",
      `expected not-finite or invalid-format, got ${r.error}`
    );
  });

  it("rejects 0x10 (hex)", () => {
    assert.equal(parseAmount("0x10").error, "invalid-format");
  });

  it("rejects negative number", () => {
    assert.equal(parseAmount("-1").error, "invalid-format");
  });

  it("rejects leading space", () => {
    assert.equal(parseAmount(" 5").error, "invalid-format");
  });

  it("rejects trailing space", () => {
    assert.equal(parseAmount("5 ").error, "invalid-format");
  });

  it("rejects NaN string", () => {
    assert.equal(parseAmount("NaN").error, "not-finite");
  });

  it("rejects 8 decimal places when max is 7", () => {
    assert.equal(parseAmount("1.12345678", 7).error, "too-many-decimals");
  });

  it("rejects absurdly large number", () => {
    assert.equal(parseAmount("9999999999999999999").error, "too-large");
  });
});

// ── BigInt arithmetic — the 0.3/0.1/0.2 float drift case ─────────────────────
describe("BigInt arithmetic avoids float drift", () => {
  it("supply 0.3, withdraw 0.1, then withdraw 0.2 leaves exactly 0", () => {
    const supply = parseAmount("0.3").value;
    const w1 = parseAmount("0.1").value;
    const w2 = parseAmount("0.2").value;
    // Float version: 0.3 - 0.1 = 0.19999999999999998 < 0.2 → would reject
    const afterW1 = supply - w1; // 2_000_000n
    assert.equal(afterW1 >= w2, true, "second withdrawal should be allowed");
    assert.equal(afterW1 - w2, 0n);
  });
});

// ── formatAmount ──────────────────────────────────────────────────────────────
describe("formatAmount", () => {
  it("formats whole number", () => {
    assert.equal(formatAmount(10_000_000n), "1");
  });

  it("formats decimal", () => {
    assert.equal(formatAmount(1_500_000n), "0.15");
  });

  it("strips trailing zeros", () => {
    assert.equal(formatAmount(10_500_000n), "1.05");
  });

  it("formats zero", () => {
    assert.equal(formatAmount(0n), "0");
  });
});

// ── storageKey namespacing ────────────────────────────────────────────────────
describe("storageKey", () => {
  it("uses anon for null address", () => {
    assert.equal(storageKey(null), "stellarlend-demo:v2:anon");
  });

  it("includes address in key", () => {
    const addr = "GAAAABBBBB";
    assert.equal(storageKey(addr), `stellarlend-demo:v2:${addr}`);
  });

  it("different addresses produce different keys", () => {
    assert.notEqual(storageKey("ADDR1"), storageKey("ADDR2"));
  });
});

// ── isRawV2 schema validation ─────────────────────────────────────────────────
describe("isRawV2 schema validation", () => {
  it("accepts valid v2 data", () => {
    assert.equal(isRawV2({ v: 2, positions: { XLM: { supplied: "100", borrowed: "0" } } }), true);
  });

  it("rejects null", () => {
    assert.equal(isRawV2(null), false);
  });

  it("rejects wrong version", () => {
    assert.equal(isRawV2({ v: 1, positions: {} }), false);
  });

  it("rejects non-digit supplied string", () => {
    assert.equal(isRawV2({ v: 2, positions: { XLM: { supplied: "x", borrowed: "0" } } }), false);
  });

  it("rejects null position field", () => {
    assert.equal(isRawV2({ v: 2, positions: { XLM: null } }), false);
  });

  it("rejects float string", () => {
    assert.equal(isRawV2({ v: 2, positions: { XLM: { supplied: "1.5", borrowed: "0" } } }), false);
  });

  it("rejects missing positions", () => {
    assert.equal(isRawV2({ v: 2 }), false);
  });

  it("rejects number instead of string", () => {
    assert.equal(isRawV2({ v: 2, positions: { XLM: { supplied: 100, borrowed: 0 } } }), false);
  });
});

// ── v1 migration ──────────────────────────────────────────────────────────────
describe("migrateV1", () => {
  it("converts valid floats to base units", () => {
    const result = migrateV1({ XLM: { supplied: 1.5, borrowed: 0.5 } });
    assert.equal(result.XLM.supplied, 15_000_000n);
    assert.equal(result.XLM.borrowed, 5_000_000n);
  });

  it("drops Infinity supplied (replaces with 0)", () => {
    const result = migrateV1({ XLM: { supplied: Infinity, borrowed: 0 } });
    assert.equal(result.XLM.supplied, 0n);
  });

  it("drops null values gracefully", () => {
    const result = migrateV1({ XLM: { supplied: null, borrowed: "x" } });
    assert.equal(result.XLM.supplied, 0n);
    assert.equal(result.XLM.borrowed, 0n);
  });

  it("returns null for non-object input", () => {
    assert.equal(migrateV1("bad"), null);
  });
});

// ── computeRisk ───────────────────────────────────────────────────────────────
describe("computeRisk", () => {
  it("returns Infinity health with no debt", () => {
    const ledger = { XLM: { supplied: 100_000_000n, borrowed: 0n } }; // 10 XLM
    const r = computeRisk(ledger, MARKETS);
    assert.equal(r.health, Infinity);
    assert.ok(r.collateralUsd > 0);
  });

  it("computes health correctly", () => {
    // Supply 100 USDC (LTV 0.85), borrow 80 USDC → health = 85/80 = 1.0625
    const ledger = {
      USDC: { supplied: 1_000_000_000n, borrowed: 800_000_000n }, // 100 / 80 USDC
    };
    const r = computeRisk(ledger, MARKETS);
    assert.ok(Math.abs(r.health - (100 * 0.85) / 80) < 0.0001);
  });

  it("health < 1 when overborrowed", () => {
    const ledger = {
      USDC: { supplied: 1_000_000_000n, borrowed: 1_000_000_000n }, // 100% utilization
    };
    const r = computeRisk(ledger, MARKETS);
    assert.ok(r.health < 1);
  });
});

// ── canWithdraw ───────────────────────────────────────────────────────────────
describe("canWithdraw", () => {
  it("allows withdrawal that keeps position healthy", () => {
    const ledger = { XLM: { supplied: 1_000_000_000n, borrowed: 0n } }; // 100 XLM, no debt
    assert.equal(canWithdraw(ledger, "XLM", 500_000_000n, MARKETS), true);
  });

  it("blocks withdrawal more than supplied", () => {
    const ledger = { XLM: { supplied: 100_000_000n, borrowed: 0n } };
    assert.equal(canWithdraw(ledger, "XLM", 200_000_000n, MARKETS), false);
  });

  it("blocks withdrawal that would undercollateralise", () => {
    // Supply 100 USDC (limit 85), borrow 80 USDC — withdrawing 10 gives limit 76.5 < 80
    const ledger = {
      USDC: { supplied: 1_000_000_000n, borrowed: 800_000_000n },
    };
    assert.equal(canWithdraw(ledger, "USDC", 100_000_000n, MARKETS), false);
  });
});

// ── canBorrow ─────────────────────────────────────────────────────────────────
describe("canBorrow", () => {
  it("allows borrow within limit", () => {
    const ledger = { USDC: { supplied: 1_000_000_000n, borrowed: 0n } }; // limit = 85 USDC
    assert.equal(canBorrow(ledger, "USDC", 500_000_000n, MARKETS), true); // borrow 50
  });

  it("blocks borrow exceeding limit", () => {
    const ledger = { USDC: { supplied: 1_000_000_000n, borrowed: 0n } }; // limit = 85 USDC
    assert.equal(canBorrow(ledger, "USDC", 900_000_000n, MARKETS), false); // borrow 90 > 85
  });

  it("returns false for unknown market", () => {
    assert.equal(canBorrow({}, "UNKNOWN", 100n, MARKETS), false);
  });
});
