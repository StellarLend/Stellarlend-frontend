"use client";

import { useMemo } from "react";
import {
  BPS_DENOM,
  sampleBorrowRateCurve,
} from "@/lib/rate-model";
import { RateCurveView } from "./curve-view";
import { UtilizationHistory } from "./history";
import { RateCurveTables } from "./tables";
import { RateModelStats } from "./stats";
import { clampBps } from "./scales";
import { RateSummaryTooltip, buildRateSummary } from "./tooltip";
import {
  DEFAULT_DIAGNOSTICS,
  DEFAULT_RATE_PARAMS,
  defaultRateChartLabels,
  type RateChartProps,
} from "./types";

export {
  defaultRateChartLabels,
} from "./types";
export type {
  RateChartLabels,
  RateChartProps,
} from "./types";

export function RateChart({
  params = DEFAULT_RATE_PARAMS,
  diagnostics = DEFAULT_DIAGNOSTICS,
  history = [],
  source = "demo",
  labels,
}: RateChartProps) {
  const copy = useMemo(
    () => ({ ...defaultRateChartLabels, ...labels }),
    [labels]
  );
  const currentUtilBps = clampBps(diagnostics.utilization_bps);
  const kinkUtilBps = clampBps(params.kink_utilization_bps);
  const surchargeActive =
    0n < params.surcharge_slope && params.surcharge_kink_bps < BPS_DENOM;
  const sampledCurve = useMemo(
    () => sampleBorrowRateCurve(params, 250n),
    [params]
  );

  const maxRateBps = useMemo(() => {
    let maxVal = 1_000n;
    for (const point of sampledCurve) {
      if (maxVal < point.borrowRateBps) maxVal = point.borrowRateBps;
    }
    if (maxVal < diagnostics.applied_rate_bps) {
      maxVal = diagnostics.applied_rate_bps;
    }
    if (maxVal < diagnostics.target_rate_bps) {
      maxVal = diagnostics.target_rate_bps;
    }
    return maxVal;
  }, [
    sampledCurve,
    diagnostics.applied_rate_bps,
    diagnostics.target_rate_bps,
  ]);

  const summary = buildRateSummary(
    copy,
    diagnostics,
    currentUtilBps,
    kinkUtilBps
  );
  const badgeLabel = source === "contract" ? copy.liveBadge : copy.demoBadge;

  return (
    <section
      className="card space-y-6 p-6"
      aria-labelledby="rate-model-heading"
      data-testid="rate-model-section"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mut text-xs uppercase tracking-[0.08em]">
            {copy.eyebrow}
          </div>
          <h2 id="rate-model-heading" className="mt-1 text-xl font-semibold">
            {copy.title}
          </h2>
          <p className="mut mt-1 max-w-3xl text-sm">{copy.subtitle}</p>
        </div>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--acc)]">
          {badgeLabel}
        </span>
      </div>

      {!diagnostics.rate_model_active && (
        <div
          className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-300"
          role="status"
          data-testid="rate-model-inactive-banner"
        >
          <div className="font-semibold">{copy.inactiveBannerTitle}</div>
          <p className="mt-1 text-xs text-amber-200/90">
            {copy.inactiveBannerBody}
          </p>
        </div>
      )}

      <RateSummaryTooltip summary={summary} />
      <RateModelStats
        labels={copy}
        params={params}
        diagnostics={diagnostics}
        currentUtilBps={currentUtilBps}
        kinkUtilBps={kinkUtilBps}
        surchargeActive={surchargeActive}
      />
      <RateCurveView
        curve={sampledCurve}
        params={params}
        diagnostics={diagnostics}
        currentUtilBps={currentUtilBps}
        maxRateBps={maxRateBps}
        labels={copy}
        summary={summary}
      />
      <UtilizationHistory history={history} labels={copy} />
      <RateCurveTables
        params={params}
        diagnostics={diagnostics}
        history={history}
        currentUtilBps={currentUtilBps}
        kinkUtilBps={kinkUtilBps}
        surchargeActive={surchargeActive}
        labels={copy}
      />
    </section>
  );
}

export default RateChart;
