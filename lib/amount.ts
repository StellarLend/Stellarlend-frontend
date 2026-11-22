/**
 * Exact amount conversion between human-readable XLM strings and the integer
 * base units (stroops) expected by the StellarLend Soroban contract.
 *
 * All arithmetic is performed with `BigInt`; no floating point is involved at
 * any point. The contract stores raw `i128` amounts with seven decimal places
 * (1 XLM = 10,000,000 base units).
 */

export const DECIMALS = 7;

/** 10^DECIMALS */
export const BASE_UNITS_PER_UNIT = 10n ** BigInt(DECIMALS);

/** Largest value accepted by a Soroban `i128` (2^127 - 1). */
export const MAX_I128 = (1n << 127n) - 1n;

export type AmountError =
  | "empty"
  | "invalid-format"
  | "negative"
  | "too-many-decimals"
  | "too-large";

export type AmountResult =
  | { ok: true; value: bigint }
  | { ok: false; error: AmountError };

function scale(decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new RangeError("decimals must be an integer between 0 and 18");
  }
  return 10n ** BigInt(decimals);
}

/**
 * Parse a plain decimal string into integer base units.
 *
 * Accepts: "0", "1", "1.5", "0.0000001"
 * Rejects: "", ".", "1.", "+1", "-1", "1e3", "0x10", " 1", "1 ", "1.12345678"
 *
 * Callers should feed the output of `normaliseAmountInput` here so that
 * locale-formatted input (thousands separators, comma decimals) is already
 * converted to a canonical dot-decimal string.
 */
export function toBaseUnits(input: string, decimals: number = DECIMALS): AmountResult {
  if (input === "" || input === ".") return { ok: false, error: "empty" };
  if (input.trim() !== input) return { ok: false, error: "invalid-format" };
  if (input.startsWith("-")) return { ok: false, error: "negative" };

  const match = /^(\d+)(?:\.(\d+))?$/.exec(input);
  if (!match) return { ok: false, error: "invalid-format" };

  const [, whole, frac = ""] = match;
  if (frac.length > decimals) return { ok: false, error: "too-many-decimals" };

  const factor = scale(decimals);
  const value = BigInt(whole) * factor + BigInt(frac.padEnd(decimals, "0"));
  if (value > MAX_I128) return { ok: false, error: "too-large" };

  return { ok: true, value };
}

/**
 * Convert integer base units back into an exact, unlocalised decimal string.
 * The inverse of `toBaseUnits` for non-negative values.
 */
export function fromBaseUnits(baseUnits: bigint, decimals: number = DECIMALS): string {
  const factor = scale(decimals);
  const negative = baseUnits < 0n;
  const magnitude = negative ? -baseUnits : baseUnits;
  const whole = magnitude / factor;
  const fraction = magnitude % factor;
  const sign = negative ? "-" : "";
  if (fraction === 0n) return `${sign}${whole}`;
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${sign}${whole}.${fractionText}`;
}
