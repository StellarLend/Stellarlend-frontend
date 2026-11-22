import { useMemo } from "react";
import {
  BPS_DENOM,
  type RateCurvePoint,
  type RateModelDiagnostics,
  type RateParams,
} from "@/lib/rate-model";
import { RateChartAxes } from "./axes";
import { buildCurvePoints, buildPath, buildPolylinePoints } from "./curve";
import {
  clampBps,
  RATE_CHART,
  xScale,
  yScale,
} from "./scales";
import { RateChartLegend } from "./legend";
import type { RateChartLabels } from "./types";

type RateCurveViewProps = {
  curve: RateCurvePoint[];
  params: RateParams;
  diagnostics: RateModelDiagnostics;
  currentUtilBps: bigint;
  maxRateBps: bigint;
  labels: RateChartLabels;
  summary: string;
};

export function RateCurveView({
  curve,
  params,
  diagnostics,
  currentUtilBps,
  maxRateBps,
  labels,
  summary,
}: RateCurveViewProps) {
  const plotWidth = RATE_CHART.width - RATE_CHART.padLeft - RATE_CHART.padRight;
  const plotHeight = RATE_CHART.height - RATE_CHART.padTop - RATE_CHART.padBottom;
  const plotBottom = RATE_CHART.padTop + plotHeight;
  const kinkUtilBps = clampBps(params.kink_utilization_bps);
  const toX = (utilizationBps: bigint) =>
    xScale(
      Number(clampBps(utilizationBps)),
      0,
      Number(BPS_DENOM),
      RATE_CHART.padLeft,
      RATE_CHART.padLeft + plotWidth
    );
  const toY = (rateBps: bigint) =>
    yScale(
      Number(rateBps),
      0,
      Math.max(100, Number(maxRateBps)),
      RATE_CHART.padTop,
      plotBottom
    );

  const points = useMemo(
    () => buildCurvePoints(curve, toX, toY),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curve, maxRateBps]
  );
  const polylinePoints = useMemo(() => buildPolylinePoints(points), [points]);
  const areaPath = useMemo(
    () => buildPath(points, plotBottom),
    [points, plotBottom]
  );

  const currentX = toX(currentUtilBps);
  const targetY = toY(diagnostics.target_rate_bps);
  const appliedY = toY(diagnostics.applied_rate_bps);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium">{labels.axisBorrowRate}</span>
        <div className="flex flex-wrap items-center gap-4">
          <RateChartLegend labels={labels} />
        </div>
      </div>

      <svg
        role="img"
        aria-label={labels.chartAriaLabel}
        viewBox={`0 0 ${RATE_CHART.width} ${RATE_CHART.height}`}
        className="h-auto w-full overflow-visible"
        data-testid="borrow-rate-curve-svg"
      >
        <title>{labels.chartAriaLabel}</title>
        <desc>{summary}</desc>

        <RateChartAxes
          labels={labels}
          maxRateBps={maxRateBps}
          kinkUtilBps={kinkUtilBps}
          toX={toX}
          toY={toY}
        />

        {areaPath && (
          <path d={areaPath} fill="#5eead4" fillOpacity="0.08" />
        )}

        <polyline
          fill="none"
          stroke="#5eead4"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polylinePoints}
          opacity={diagnostics.rate_model_active ? 1 : 0.35}
        />

        <line
          x1={currentX}
          y1={RATE_CHART.padTop}
          x2={currentX}
          y2={plotBottom}
          stroke="#34d399"
          strokeDasharray="2 2"
          strokeWidth="1.5"
          data-testid="current-utilization-marker"
        />

        <circle
          cx={currentX}
          cy={targetY}
          r="6"
          fill="#0a1020"
          stroke="#818cf8"
          strokeWidth="2"
          data-testid="target-rate-dot"
        />

        <circle
          cx={currentX}
          cy={appliedY}
          r="4.5"
          fill="#34d399"
          stroke="#04101c"
          strokeWidth="1.5"
          data-testid="applied-rate-dot"
        />
      </svg>

      <div className="mut mt-1 text-center text-xs">
        {labels.axisUtilization}
      </div>
    </div>
  );
}
