import { formatBpsPercent, type RateModelDiagnostics, type RateParams } from "@/lib/rate-model";
import { interpolate } from "./tooltip";
import type { RateChartLabels } from "./types";

type RateModelStatsProps = {
  labels: RateChartLabels;
  params: RateParams;
  diagnostics: RateModelDiagnostics;
  currentUtilBps: bigint;
  kinkUtilBps: bigint;
  surchargeActive: boolean;
};

export function RateModelStats({
  labels,
  params,
  diagnostics,
  currentUtilBps,
  kinkUtilBps,
  surchargeActive,
}: RateModelStatsProps) {
  const surchargeDisplay = surchargeActive
    ? `>${formatBpsPercent(params.surcharge_kink_bps)} (+${formatBpsPercent(params.surcharge_slope)})`
    : labels.surchargeDisabled;
  const floorCeilingDisplay = `${formatBpsPercent(params.rate_floor_bps)} / ${formatBpsPercent(params.rate_ceiling_bps)}`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-3">
        <div className="mut text-xs">{labels.currentUtilization}</div>
        <div className="mt-1 text-lg font-semibold" data-testid="diag-utilization">
          {formatBpsPercent(currentUtilBps)}
        </div>
        <div className="mut text-xs">{`${currentUtilBps.toString()} bps`}</div>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-3">
        <div className="mut text-xs">{labels.appliedRate}</div>
        <div
          className="mt-1 text-lg font-semibold text-emerald-400"
          data-testid="diag-applied-rate"
        >
          {formatBpsPercent(diagnostics.applied_rate_bps)}
        </div>
        <div className="mut text-xs">
          {`${diagnostics.applied_rate_bps.toString()} bps`}
        </div>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-3">
        <div className="mut text-xs">{labels.targetRate}</div>
        <div
          className="mt-1 text-lg font-semibold text-indigo-300"
          data-testid="diag-target-rate"
        >
          {formatBpsPercent(diagnostics.target_rate_bps)}
        </div>
        <div className="mut text-xs">
          {`${diagnostics.target_rate_bps.toString()} bps`}
        </div>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-3">
        <div className="mut text-xs">{labels.kink}</div>
        <div className="mt-1 text-lg font-semibold">
          {formatBpsPercent(kinkUtilBps)}
        </div>
        <div className="mut text-xs">{`${kinkUtilBps.toString()} bps`}</div>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-3">
        <div className="mut text-xs">{labels.floorCeiling}</div>
        <div className="mt-1 text-sm font-semibold">{floorCeilingDisplay}</div>
        <div className="mut text-xs">
          {`${params.rate_floor_bps.toString()}–${params.rate_ceiling_bps.toString()} bps`}
        </div>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-3">
        <div className="mut text-xs">{labels.surchargeBand}</div>
        <div className="mt-1 text-sm font-semibold">{surchargeDisplay}</div>
        <div className="mut text-xs">
          {interpolate(labels.elapsedLedgers, {
            count: diagnostics.elapsed_ledgers,
          })}
        </div>
      </div>
    </div>
  );
}
