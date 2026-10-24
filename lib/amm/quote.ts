export const I128_MIN = -(1n << 127n);
export const I128_MAX = (1n << 127n) - 1n;
export const IMPACT_GUARD_DISABLED = 0xffff_ffff; // u32::MAX

export type QuoteExactInParams = {
  amountIn: bigint;
  reserveIn: bigint;
  reserveOut: bigint;
  feeBps: bigint;
};

export type SwapQuoteResult = {
  amountOut: bigint;
  fee: bigint;
  reserveInAfter: bigint;
  reserveOutAfter: bigint;
};

export type QuoteError = "NonPositiveAmount" | "EmptyPool" | "Overflow";

export type QuoteExactInResult =
  | { ok: true; value: SwapQuoteResult }
  | { ok: false; error: QuoteError };

function checkedMul(a: bigint, b: bigint): bigint | null {
  const prod = a * b;
  return prod < I128_MIN || prod > I128_MAX ? null : prod;
}

function checkedAdd(a: bigint, b: bigint): bigint | null {
  const sum = a + b;
  return sum < I128_MIN || sum > I128_MAX ? null : sum;
}

function checkedSub(a: bigint, b: bigint): bigint | null {
  const diff = a - b;
  return diff < I128_MIN || diff > I128_MAX ? null : diff;
}

/**
 * Uniswap-v2 constant-product exact input quote calculation.
 *
 * Direct BigInt port of the contract's `compute_swap_out` and `get_swap_quote` in `lib.rs`:
 * ```text
 * fee = amount_in * fee_bps / 10_000
 * fee_adj = 10_000 - fee_bps
 * amount_in_with_fee = amount_in * fee_adj
 * numerator = amount_in_with_fee * reserve_out
 * denominator = reserve_in * 10_000 + amount_in_with_fee
 * amount_out = numerator / denominator [floor division]
 * reserve_in_after = reserve_in + amount_in
 * reserve_out_after = reserve_out - amount_out
 * ```
 * Checked arithmetic strictly mirrors Rust `checked_add`, `checked_sub`, `checked_mul` bounds for i128.
 */
export function quoteExactIn({
  amountIn,
  reserveIn,
  reserveOut,
  feeBps,
}: QuoteExactInParams): QuoteExactInResult {
  if (amountIn <= 0n) {
    return { ok: false, error: "NonPositiveAmount" };
  }
  if (reserveIn <= 0n || reserveOut <= 0n) {
    return { ok: false, error: "EmptyPool" };
  }
  if (feeBps < 0n || feeBps > 10_000n) {
    return { ok: false, error: "Overflow" };
  }

  // fee = amount_in * fee_bps / 10_000
  const feeMul = checkedMul(amountIn, feeBps);
  if (feeMul === null) return { ok: false, error: "Overflow" };
  const fee = feeMul / 10_000n;

  // fee_adj = 10_000 - fee_bps
  const feeAdj = 10_000n - feeBps;

  // amount_in_with_fee = amount_in * (10_000 - fee_bps)
  const amountInWithFee = checkedMul(amountIn, feeAdj);
  if (amountInWithFee === null) return { ok: false, error: "Overflow" };

  // numerator = amount_in_with_fee * reserve_out
  const numerator = checkedMul(amountInWithFee, reserveOut);
  if (numerator === null) return { ok: false, error: "Overflow" };

  // denom_part = reserve_in * 10_000
  const denomPart = checkedMul(reserveIn, 10_000n);
  if (denomPart === null) return { ok: false, error: "Overflow" };

  // denominator = denom_part + amount_in_with_fee
  const denominator = checkedAdd(denomPart, amountInWithFee);
  if (denominator === null || denominator === 0n) return { ok: false, error: "Overflow" };

  // amount_out = numerator / denominator (floor division)
  const amountOut = numerator / denominator;

  // reserve_in_after = reserve_in + amount_in
  const reserveInAfter = checkedAdd(reserveIn, amountIn);
  if (reserveInAfter === null) return { ok: false, error: "Overflow" };

  // reserve_out_after = reserve_out - amount_out
  const reserveOutAfter = checkedSub(reserveOut, amountOut);
  if (reserveOutAfter === null) return { ok: false, error: "Overflow" };

  return {
    ok: true,
    value: {
      amountOut,
      fee,
      reserveInAfter,
      reserveOutAfter,
    },
  };
}

export type PriceImpactParams = {
  reserveIn: bigint;
  reserveOut: bigint;
  reserveInAfter: bigint;
  reserveOutAfter: bigint;
};

/**
 * Calculates price impact in basis points.
 *
 * Citing PRICE_IMPACT_GUARD.md and `swap_internal` in `lib.rs`:
 * ```text
 * Spot price (out per in) before = res_out / res_in, after = new_out / new_in.
 * relative impact = (P_before - P_after) / P_before * 10_000
 *                 = (1 - new_out * res_in / (res_out * new_in)) * 10_000
 *                 = (ratio_den - ratio_num) * 10_000 / ratio_den
 * where:
 * ratio_num = new_out * res_in
 * ratio_den = res_out * new_in
 * ```
 * Note: Integer floor division is used, exactly as in contract `lib.rs` L1058-L1062.
 * Returns null if intermediate calculation overflows i128 or ratio_den is 0.
 */
export function priceImpactBps({
  reserveIn,
  reserveOut,
  reserveInAfter,
  reserveOutAfter,
}: PriceImpactParams): bigint | null {
  if (
    reserveIn <= 0n ||
    reserveOut <= 0n ||
    reserveInAfter <= 0n ||
    reserveOutAfter < 0n
  ) {
    return null;
  }

  // ratio_num = new_out * res_in
  const ratioNum = checkedMul(reserveOutAfter, reserveIn);
  if (ratioNum === null) return null;

  // ratio_den = res_out * new_in
  const ratioDen = checkedMul(reserveOut, reserveInAfter);
  if (ratioDen === null || ratioDen === 0n) return null;

  // difference = ratio_den - ratio_num
  const diff = checkedSub(ratioDen, ratioNum);
  if (diff === null) return null;

  // If pool shifted favorably or stayed identical, floor to 0 bps
  if (diff <= 0n) return 0n;

  const diffTimes10k = checkedMul(diff, 10_000n);
  if (diffTimes10k === null) return null;

  return diffTimes10k / ratioDen;
}

/**
 * Formats effective price: (amountOut / 10^decimalsOut) / (amountIn / 10^decimalsIn)
 * Computes with BigInt scaling to avoid floating point inaccuracies on raw token units.
 */
export function calculateEffectivePrice(
  amountIn: bigint,
  amountOut: bigint,
  decimalsIn: number,
  decimalsOut: number,
  precision = 6,
): string {
  if (amountIn <= 0n || amountOut <= 0n) return "0";

  const scaleDecimals = 18;
  const scale = 10n ** BigInt(scaleDecimals);
  const factorIn = 10n ** BigInt(decimalsIn);
  const factorOut = 10n ** BigInt(decimalsOut);

  const num = amountOut * factorIn * scale;
  const den = amountIn * factorOut;
  if (den === 0n) return "0";

  const scaledPrice = num / den;
  const whole = scaledPrice / scale;
  const fraction = (scaledPrice % scale)
    .toString()
    .padStart(scaleDecimals, "0")
    .slice(0, precision)
    .replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole.toString();
}
