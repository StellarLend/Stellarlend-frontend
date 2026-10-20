/**
 * Demo-ledger: pure storage layer for simulated positions.
 *
 * All amounts are stored as integer base units (7 decimal places by default,
 * matching Stellar's stroop/xlm convention). BigInt is used for all balance
 * arithmetic so that float drift is impossible.
 *
 * Storage layout (v2):
 *   Key:   stellarlend-demo:v2:<address|anon>
 *   Value: { v: 2, positions: { [symbol]: { supplied: "bigint-string", borrowed: "bigint-string" } } }
 *
 * Migration: v1 data (raw floats) is converted to base units on first read.
 */

export const DECIMALS = 7; // base-unit decimals (matches Stellar XLM decimals)
const SCALE = BigInt(10 ** DECIMALS);
/** Maximum storable whole units: 10^15 (keeps USD display inside Number.MAX_SAFE_INTEGER) */
const MAX_WHOLE_UNITS = BigInt("1000000000000000");
const MAX_BASE_UNITS = MAX_WHOLE_UNITS * SCALE;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ParseError =
  | "empty"
  | "invalid-format"
  | "negative"
  | "too-many-decimals"
  | "too-large"
  | "not-finite";

export type ParseResult =
  | { ok: true; value: bigint }
  | { ok: false; error: ParseError };

export type Position = {
  supplied: bigint;
  borrowed: bigint;
};

export type Ledger = Record<string, Position>;

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Strictly parse a user-supplied amount string into integer base units.
 *
 * Accepts:  "0", "1", "0.5", "100.0000001"
 * Rejects:  "", "1e3", "0x10", "Infinity", "NaN", "-1", " 5 ", "1.12345678"
 */
export function parseAmount(input: string, decimals: number = DECIMALS): ParseResult {
  if (input === "") return { ok: false, error: "empty" };
  const trimmed = input.trim();
  if (trimmed !== input) return { ok: false, error: "invalid-format" };

  // Only allow: optional digits, optional dot, optional digits after dot — no
  // signs, exponents, hex prefixes, or whitespace.
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    // Detect specific bad cases for better error messages
    if (trimmed === "Infinity" || trimmed === "NaN" || !isFinite(Number(trimmed))) {
      return { ok: false, error: "not-finite" };
    }
    return { ok: false, error: "invalid-format" };
  }

  const [whole, frac = ""] = trimmed.split(".");

  if (frac.length > decimals) {
    return { ok: false, error: "too-many-decimals" };
  }

  // Pad the fractional part to exactly `decimals` digits
  const paddedFrac = frac.padEnd(decimals, "0");

  // Combine whole + fractional into a single bigint
  const baseUnits = BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFrac);

  if (baseUnits === BigInt(0)) {
    // "0" or "0.0000000" — still technically valid input but guard callers
    return { ok: true, value: BigInt(0) };
  }

  if (baseUnits > MAX_BASE_UNITS) {
    return { ok: false, error: "too-large" };
  }

  return { ok: true, value: baseUnits };
}

/**
 * Convert a BigInt base unit amount to a human-readable decimal string.
 * e.g. 1_5000000n (7 decimals) -> "1.5"
 */
export function formatAmount(baseUnits: bigint, decimals: number = DECIMALS): string {
  const scale = BigInt(10 ** decimals);
  const whole = baseUnits / scale;
  const frac = baseUnits % scale;
  if (frac === BigInt(0)) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/**
 * Convert a BigInt base unit amount to a floating-point number for USD
 * display purposes only. Do not use for balance comparisons.
 */
export function toFloat(baseUnits: bigint, decimals: number = DECIMALS): number {
  return Number(baseUnits) / 10 ** decimals;
}

// ─── Storage key ─────────────────────────────────────────────────────────────

export function storageKey(address: string | null): string {
  return `stellarlend-demo:v2:${address ?? "anon"}`;
}

// ─── Schema validation ────────────────────────────────────────────────────────

type RawV2Position = { supplied: string; borrowed: string };
type RawV2 = { v: 2; positions: Record<string, RawV2Position> };
type RawV1 = Record<string, { supplied: number; borrowed: number }>;

function isRawV2(data: unknown): data is RawV2 {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d.v !== 2) return false;
  if (typeof d.positions !== "object" || d.positions === null) return false;
  for (const [, pos] of Object.entries(d.positions as Record<string, unknown>)) {
    if (typeof pos !== "object" || pos === null) return false;
    const p = pos as Record<string, unknown>;
    if (typeof p.supplied !== "string" || typeof p.borrowed !== "string") return false;
    // Must be valid non-negative integer strings
    if (!/^\d+$/.test(p.supplied) || !/^\d+$/.test(p.borrowed)) return false;
  }
  return true;
}

function deserializePosition(raw: RawV2Position): Position | null {
  try {
    const supplied = BigInt(raw.supplied);
    const borrowed = BigInt(raw.borrowed);
    if (supplied < BigInt(0) || borrowed < BigInt(0)) return null;
    return { supplied, borrowed };
  } catch {
    return null;
  }
}

// ─── Migration from v1 ───────────────────────────────────────────────────────

function migrateV1(data: unknown): Ledger | null {
  if (typeof data !== "object" || data === null) return null;
  const v1 = data as RawV1;
  const result: Ledger = {};
  for (const [symbol, pos] of Object.entries(v1)) {
    if (typeof pos !== "object" || pos === null) continue;
    const s = typeof pos.supplied === "number" && isFinite(pos.supplied) && pos.supplied >= 0
      ? BigInt(Math.round(pos.supplied * 10 ** DECIMALS))
      : BigInt(0);
    const b = typeof pos.borrowed === "number" && isFinite(pos.borrowed) && pos.borrowed >= 0
      ? BigInt(Math.round(pos.borrowed * 10 ** DECIMALS))
      : BigInt(0);
    result[symbol] = { supplied: s, borrowed: b };
  }
  return result;
}

// ─── Load / Save ─────────────────────────────────────────────────────────────

type LoadResult = { ledger: Ledger; reset: boolean };

/**
 * Load positions from localStorage. Returns { ledger, reset } where reset is
 * true if the data was invalid and had to be discarded (show a notice).
 * Falls back to empty ledger if storage is unavailable (Safari private mode).
 */
export function loadLedger(address: string | null): LoadResult {
  const key = storageKey(address);
  // Also try v1 key for migration
  const v1Key = "stellarlend-demo-positions";

  let raw: unknown = null;
  try {
    const s = localStorage.getItem(key);
    if (s) raw = JSON.parse(s);
  } catch {
    return { ledger: {}, reset: false };
  }

  // Try v2 format
  if (raw !== null) {
    if (isRawV2(raw)) {
      const ledger: Ledger = {};
      for (const [symbol, pos] of Object.entries(raw.positions)) {
        const p = deserializePosition(pos);
        if (p) ledger[symbol] = p;
      }
      return { ledger, reset: false };
    }

    // Invalid v2 — discard and reset
    try { localStorage.removeItem(key); } catch {}
    return { ledger: {}, reset: true };
  }

  // Try v1 migration (only for "anon" slot to avoid mixing addresses)
  if (address === null) {
    try {
      const v1Raw = localStorage.getItem(v1Key);
      if (v1Raw) {
        const parsed = JSON.parse(v1Raw);
        const migrated = migrateV1(parsed);
        if (migrated) {
          // Save in v2 format and remove the old key
          saveLedger(address, migrated);
          try { localStorage.removeItem(v1Key); } catch {}
          return { ledger: migrated, reset: false };
        }
      }
    } catch {
      // ignore migration errors
    }
  }

  return { ledger: {}, reset: false };
}

/**
 * Persist positions to localStorage.
 */
export function saveLedger(address: string | null, ledger: Ledger): void {
  const key = storageKey(address);
  const positions: Record<string, RawV2Position> = {};
  for (const [symbol, pos] of Object.entries(ledger)) {
    positions[symbol] = {
      supplied: pos.supplied.toString(),
      borrowed: pos.borrowed.toString(),
    };
  }
  const raw: RawV2 = { v: 2, positions };
  try {
    localStorage.setItem(key, JSON.stringify(raw));
  } catch {
    // localStorage unavailable — positions will be lost on reload but we don't crash
  }
}

// ─── Risk math (pure BigInt) ──────────────────────────────────────────────────

export type MarketParams = {
  symbol: string;
  /** USD price as a float — only used for display aggregation */
  price: number;
  /** Loan-to-Value ratio (0–1) */
  ltv: number;
  decimals?: number;
};

export type RiskSummary = {
  /** Total USD value of supplied collateral (float, display only) */
  collateralUsd: number;
  /** Total USD value of borrowed amounts (float, display only) */
  borrowUsd: number;
  /** Maximum USD value that can be borrowed (float, display only) */
  limitUsd: number;
  /** Health factor (limitUsd / borrowUsd); Infinity if no debt */
  health: number;
};

/**
 * Compute risk summary from a ledger and market params. Pure function.
 * USD values are floats for display; the health comparison uses them but
 * individual balance comparisons should use BigInt.
 */
export function computeRisk(ledger: Ledger, markets: MarketParams[]): RiskSummary {
  let collateralUsd = 0;
  let borrowUsd = 0;
  let limitUsd = 0;

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

/**
 * Check whether a withdrawal of `amount` base units would make the position
 * undercollateralised. Returns true if it is safe to proceed.
 */
export function canWithdraw(
  ledger: Ledger,
  symbol: string,
  amount: bigint,
  markets: MarketParams[]
): boolean {
  const pos = ledger[symbol];
  if (!pos) return false;
  if (amount > pos.supplied) return false;

  // Simulate the withdrawal
  const simulated: Ledger = {
    ...ledger,
    [symbol]: { ...pos, supplied: pos.supplied - amount },
  };
  const { limitUsd, borrowUsd } = computeRisk(simulated, markets);
  return borrowUsd <= limitUsd;
}

/**
 * Check whether borrowing `amount` base units of `symbol` would exceed the
 * borrow limit. Returns true if it is safe to proceed.
 */
export function canBorrow(
  ledger: Ledger,
  symbol: string,
  amount: bigint,
  markets: MarketParams[]
): boolean {
  const market = markets.find((m) => m.symbol === symbol);
  if (!market) return false;
  const decimals = market.decimals ?? DECIMALS;
  const addedUsd = toFloat(amount, decimals) * market.price;
  const { limitUsd, borrowUsd } = computeRisk(ledger, markets);
  return borrowUsd + addedUsd <= limitUsd;
}
