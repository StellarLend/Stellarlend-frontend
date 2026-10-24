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

/** Formats basis points as a percentage string, e.g. 7500 -> "75%". */
export function formatBps(bps: number | bigint): string {
  const value = Number(bps) / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

/** Formats a duration in seconds as a human string, e.g. 90061 -> "1d 1h 1m 1s". */
export function formatDuration(totalSeconds: number | bigint): string {
  let remaining = Number(totalSeconds);
  if (!Number.isFinite(remaining) || remaining < 0) return "unavailable";
  if (remaining === 0) return "0s";
  const parts: string[] = [];
  for (const [unit, size] of [["d", 86400], ["h", 3600], ["m", 60], ["s", 1]] as const) {
    const amount = Math.floor(remaining / size);
    if (amount > 0) parts.push(`${amount}${unit}`);
    remaining -= amount * size;
  }
  return parts.join(" ");
}

/** Formats a raw token amount (default 7 decimals) as a decimal string with grouping. */
export function formatTokenAmount(raw: bigint, decimals = 7): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = (abs / base).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** Shortens an address, e.g. GABCDE...WXYZ. */
export function shortenAddress(address: string, head = 6, tail = 4): string {
  return address.length <= head + tail + 3 ? address : `${address.slice(0, head)}...${address.slice(-tail)}`;
}
