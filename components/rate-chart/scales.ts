import { BPS_DENOM } from "@/lib/rate-model";

export const RATE_CHART = {
  width: 640,
  height: 240,
  padLeft: 52,
  padRight: 24,
  padTop: 20,
  padBottom: 38,
} as const;

export const HISTORY_CHART = {
  width: 640,
  height: 120,
  padLeft: 44,
  padRight: 18,
  padTop: 14,
  padBottom: 26,
} as const;

export const UTILIZATION_TICKS = [0n, 2_500n, 5_000n, 7_500n, 10_000n] as const;
export const HISTORY_TICKS = [0n, 5_000n, 10_000n] as const;

export function clampBps(value: bigint): bigint {
  if (value < 0n) return 0n;
  return value > BPS_DENOM ? BPS_DENOM : value;
}

export function xScale(
  value: number,
  min: number,
  max: number,
  rangeStart: number,
  rangeEnd: number
): number {
  if (min === max) return (rangeStart + rangeEnd) / 2;
  const clamped = Math.max(min, Math.min(max, value));
  return rangeStart + ((clamped - min) / (max - min)) * (rangeEnd - rangeStart);
}

export function yScale(
  value: number,
  min: number,
  max: number,
  rangeStart: number,
  rangeEnd: number
): number {
  if (min === max) return (rangeStart + rangeEnd) / 2;
  const clamped = Math.max(min, Math.min(max, value));
  return rangeEnd - ((clamped - min) / (max - min)) * (rangeEnd - rangeStart);
}

export function generateTicks(min: number, max: number, intervals = 4): number[] {
  if (min === max || intervals <= 0) return [min];
  return Array.from({ length: intervals + 1 }, (_, index) =>
    index === intervals ? max : min + ((max - min) * index) / intervals
  );
}
