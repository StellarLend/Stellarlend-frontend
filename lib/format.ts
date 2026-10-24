/**
 * Formatting utilities for base-unit token amounts and percentages.
 */

/**
 * Format a base-unit bigint amount into a human-readable decimal string with specified decimals.
 * Does not use Number() on the raw amount to avoid float overflow/precision loss on large values.
 *
 * Example: formatUnits(10_000_000n, 7) => "1"
 * Example: formatUnits(12_345_678n, 7) => "1.2345678"
 */
export function formatUnits(amount: bigint, decimals = 7): string {
  const isNegative = amount < 0n;
  const absAmount = isNegative ? -amount : amount;
  const divisor = 10n ** BigInt(decimals);

  const integerPart = absAmount / divisor;
  const fractionalPart = absAmount % divisor;

  let formatted = integerPart.toString();

  if (fractionalPart > 0n && decimals > 0) {
    const fractionStr = fractionalPart.toString().padStart(decimals, "0").replace(/0+$/, "");
    formatted += `.${fractionStr}`;
  }

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format a base-unit bigint amount with thousands separators and optional symbol.
 * Example: formatTokenDisplay(12_345_678_0000000n, 7, "XLM") => "12,345,678 XLM"
 */
export function formatTokenDisplay(
  amount: bigint,
  decimals = 7,
  symbol?: string,
  maxFractionDigits = 2
): string {
  const isNegative = amount < 0n;
  const absAmount = isNegative ? -amount : amount;
  const divisor = 10n ** BigInt(decimals);

  const integerPart = absAmount / divisor;
  const fractionalPart = absAmount % divisor;

  // Format integer part with comma thousands separators
  const intStr = integerPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  let result = intStr;

  if (maxFractionDigits > 0) {
    const fullFractionStr = fractionalPart.toString().padStart(decimals, "0");
    const roundedFraction = fullFractionStr.slice(0, maxFractionDigits).replace(/0+$/, "");
    if (roundedFraction.length > 0) {
      result += `.${roundedFraction}`;
    }
  }

  if (isNegative) {
    result = `-${result}`;
  }

  if (symbol) {
    result = `${result} ${symbol}`;
  }

  return result;
}

/**
 * Formats basis points (e.g. 2000 bps -> "20.00%")
 */
export function formatPercentFromBps(bps: number | bigint): string {
  const numericBps = typeof bps === "bigint" ? Number(bps) : bps;
  const percent = numericBps / 100;
  return `${percent.toFixed(2)}%`;
}
