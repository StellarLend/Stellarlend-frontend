export type TwapObservation = {
  timestamp: bigint;
  cumNum: bigint;
  cumDenom: bigint;
};

export type TwapPoint = {
  timestamp: number;
  price: string;
};

/**
 * Calculates TWAP price between two observations:
 * TWAP = (cumNum_B - cumNum_A) / (cumDenom_B - cumDenom_A)
 *
 * Uses BigInt arithmetic to avoid losing precision on large cumulative sums,
 * scaling by 10^decimals for fixed-point decimal string formatting.
 */
export function twapBetween(
  obsA: TwapObservation,
  obsB: TwapObservation,
  decimals = 6
): string | null {
  const dDenom = obsB.cumDenom - obsA.cumDenom;
  if (dDenom === 0n) {
    return null;
  }
  const dNum = obsB.cumNum - obsA.cumNum;

  // Sign handling
  const isNegative = (dNum < 0n && dDenom > 0n) || (dNum > 0n && dDenom < 0n);
  const absNum = dNum < 0n ? -dNum : dNum;
  const absDenom = dDenom < 0n ? -dDenom : dDenom;

  const scale = 10n ** BigInt(decimals);
  const scaledNum = absNum * scale;
  const quotient = scaledNum / absDenom;

  const whole = quotient / scale;
  const frac = (quotient % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  const formatted = frac ? `${whole}.${frac}` : whole.toString();

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Constructs a TWAP time series from consecutive observations within a time window.
 * Skips observation pairs where delta denominator is 0.
 *
 * @param observations Chronologically ordered (or will be sorted) observations
 * @param windowSecs Time window in seconds relative to the latest observation (e.g. 3600 for 1h, 86400 for 24h, or 0/undefined for all)
 * @param maxPoints Maximum number of points to return (downsampling if needed)
 */
export function twapSeries(
  observations: TwapObservation[],
  windowSecs?: number,
  maxPoints = 100
): TwapPoint[] {
  if (!observations || observations.length < 2) {
    return [];
  }

  // Ensure chronologically sorted by timestamp ascending
  const sorted = [...observations].sort((a, b) => {
    if (a.timestamp < b.timestamp) return -1;
    if (a.timestamp > b.timestamp) return 1;
    return 0;
  });

  const latestTime = sorted[sorted.length - 1].timestamp;
  const cutoffTime = windowSecs && windowSecs > 0 ? latestTime - BigInt(windowSecs) : 0n;

  const points: TwapPoint[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (curr.timestamp < cutoffTime) {
      continue;
    }

    const price = twapBetween(prev, curr);
    if (price !== null) {
      points.push({
        timestamp: Number(curr.timestamp),
        price,
      });
    }
  }

  if (points.length <= maxPoints) {
    return points;
  }

  // Downsample evenly to keep rendering fast and bounded
  const downsampled: TwapPoint[] = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const index = Math.round(i * step);
    downsampled.push(points[index]);
  }
  return downsampled;
}
