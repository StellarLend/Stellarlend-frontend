import type { RateCurvePoint } from "@/lib/rate-model";

export type PlotPoint = {
  x: number;
  y: number;
};

export function buildCurvePoints(
  curve: RateCurvePoint[],
  x: (utilizationBps: bigint) => number,
  y: (borrowRateBps: bigint) => number
): PlotPoint[] {
  return curve.map((point) => ({
    x: x(point.utilizationBps),
    y: y(point.borrowRateBps),
  }));
}

export function buildPolylinePoints(points: PlotPoint[]): string {
  return points
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
}

export function buildPath(points: PlotPoint[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const pathPoints = buildPolylinePoints(points).replace(/ /g, " L ");
  return `M ${first.x.toFixed(1)},${baselineY.toFixed(1)} L ${pathPoints} L ${last.x.toFixed(1)},${baselineY.toFixed(1)} Z`;
}
