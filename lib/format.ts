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
