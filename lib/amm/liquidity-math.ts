export const MINIMUM_LIQUIDITY = 1_000n;
const I128_MIN = -(1n << 127n);
const I128_MAX = (1n << 127n) - 1n;

export type LiquidityMathError =
  | "ZeroReserve"
  | "InsufficientLiquidityMinted"
  | "Overflow"
  | "InvalidBurnAmount"
  | "ZeroSupply"
  | "BurnExceedsSupply";

export type MathResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: LiquidityMathError };

function checkedProduct(a: bigint, b: bigint): bigint | null {
  const product = a * b;
  return product < I128_MIN || product > I128_MAX ? null : product;
}

export function integerSqrt(value: bigint): MathResult<bigint> {
  if (value < 0n) return { ok: false, error: "Overflow" };
  if (value <= 3n) return { ok: true, value: value === 0n ? 0n : 1n };
  let z = value;
  let x = value / 2n + 1n;
  while (x < z) {
    z = x;
    x = (value / x + x) / 2n;
  }
  return { ok: true, value: z };
}

export function calculateMintShares(
  totalSupply: bigint,
  amountA: bigint,
  amountB: bigint,
  reserveA: bigint,
  reserveB: bigint,
): MathResult<{ shares: bigint; lockedShares: bigint }> {
  if (totalSupply === 0n) {
    const product = checkedProduct(amountA, amountB);
    if (product === null) return { ok: false, error: "Overflow" };
    const root = integerSqrt(product);
    if (!root.ok) return root;
    if (root.value <= MINIMUM_LIQUIDITY) return { ok: false, error: "InsufficientLiquidityMinted" };
    return { ok: true, value: { shares: root.value - MINIMUM_LIQUIDITY, lockedShares: MINIMUM_LIQUIDITY } };
  }

  if (reserveA === 0n || reserveB === 0n) return { ok: false, error: "ZeroReserve" };
  const productA = checkedProduct(amountA, totalSupply);
  if (productA === null) return { ok: false, error: "Overflow" };
  const productB = checkedProduct(amountB, totalSupply);
  if (productB === null) return { ok: false, error: "Overflow" };
  const sharesA = productA / reserveA;
  const sharesB = productB / reserveB;
  const shares = sharesA < sharesB ? sharesA : sharesB;
  if (shares === 0n) return { ok: false, error: "InsufficientLiquidityMinted" };
  return { ok: true, value: { shares, lockedShares: 0n } };
}

export function calculateBurnAmounts(
  shares: bigint,
  totalSupply: bigint,
  reserveA: bigint,
  reserveB: bigint,
): MathResult<{ amountA: bigint; amountB: bigint }> {
  if (shares <= 0n) return { ok: false, error: "InvalidBurnAmount" };
  if (totalSupply <= 0n) return { ok: false, error: "ZeroSupply" };
  if (shares > totalSupply) return { ok: false, error: "BurnExceedsSupply" };
  const productA = checkedProduct(reserveA, shares);
  if (productA === null) return { ok: false, error: "Overflow" };
  const productB = checkedProduct(reserveB, shares);
  if (productB === null) return { ok: false, error: "Overflow" };
  return { ok: true, value: { amountA: productA / totalSupply, amountB: productB / totalSupply } };
}

export function proportionalAmount(amount: bigint, reserveFrom: bigint, reserveTo: bigint): bigint | null {
  if (amount <= 0n || reserveFrom <= 0n || reserveTo <= 0n) return null;
  const product = checkedProduct(amount, reserveTo);
  if (product === null) return null;
  return (product + reserveFrom - 1n) / reserveFrom;
}

export function parseTokenAmount(value: string, decimals: number): bigint | null {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || !/^\d+(\.\d*)?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  if (fraction.length > decimals) return null;
  const amount = BigInt(whole) * 10n ** BigInt(decimals)
    + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  return amount <= I128_MAX ? amount : null;
}

export function formatTokenAmount(value: bigint, decimals: number, precision = 6): string {
  if (decimals < 0 || decimals > 18) throw new RangeError("Token decimals must be between 0 and 18.");
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").slice(0, precision).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
