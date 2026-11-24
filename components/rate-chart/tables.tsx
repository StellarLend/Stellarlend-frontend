import { useMemo } from "react";
import {
  BPS_DENOM,
  DEFAULT_APR_BPS,
  borrowRateBps,
  formatBpsPercent,
  type RateModelDiagnostics,
  type RateParams,
  type UtilizationSample,
} from "@/lib/rate-model";
import { clampBps } from "./scales";
import type { RateChartLabels } from "./types";

type RateCurveTablesProps = {
  params: RateParams;
  diagnostics: RateModelDiagnostics;
  history: UtilizationSample[];
  currentUtilBps: bigint;
  kinkUtilBps: bigint;
  surchargeActive: boolean;
  labels: RateChartLabels;
};

export function RateCurveTables({
  params,
  diagnostics,
  history,
  currentUtilBps,
  kinkUtilBps,
  surchargeActive,
  labels,
}: RateCurveTablesProps) {
  const tableCurvePoints = useMemo(() => {
    const milestones = new Set<bigint>([
      0n,
      2_500n,
      5_000n,
      kinkUtilBps,
      currentUtilBps,
      9_000n,
      BPS_DENOM,
    ]);
    if (surchargeActive) {
      milestones.add(clampBps(params.surcharge_kink_bps));
    }
    return [...milestones]
      .sort((a, b) => (a < b ? -1 : b < a ? 1 : 0))
      .map((utilizationBps) => {
        const rate = diagnostics.rate_model_active
          ? borrowRateBps(utilizationBps, params)
          : DEFAULT_APR_BPS;
        const notes: string[] = [];
        if (utilizationBps === kinkUtilBps && diagnostics.rate_model_active) {
          notes.push(labels.markerKink);
        }
        if (utilizationBps === currentUtilBps) {
          notes.push(labels.markerCurrent);
        }
        if (
          surchargeActive &&
          utilizationBps === clampBps(params.surcharge_kink_bps) &&
          diagnostics.rate_model_active
        ) {
          notes.push(labels.markerSurcharge);
        }
        return {
          utilizationBps,
          borrowRateBps: rate,
          note: notes.join(", ") || "-",
        };
      });
  }, [
    kinkUtilBps,
    currentUtilBps,
    surchargeActive,
    params,
    diagnostics.rate_model_active,
    labels.markerKink,
    labels.markerCurrent,
    labels.markerSurcharge,
  ]);

  return (
    <details className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-4">
      <summary className="cursor-pointer text-sm font-medium">
        {labels.tableToggle}
      </summary>
      <div className="mt-4 space-y-6 overflow-x-auto">
        <table
          className="w-full min-w-[480px] text-left text-xs"
          aria-label={labels.curveTableCaption}
          data-testid="rate-curve-fallback-table"
        >
          <caption className="mut mb-2 text-left font-medium">
            {labels.curveTableCaption}
          </caption>
          <thead className="mut border-b border-[var(--line)]">
            <tr>
              <th className="py-2 pr-4">{labels.colUtilization}</th>
              <th className="py-2 pr-4">{labels.colUtilizationBps}</th>
              <th className="py-2 pr-4">{labels.colBorrowApr}</th>
              <th className="py-2 pr-4">{labels.colBorrowBps}</th>
              <th className="py-2">{labels.colNote}</th>
            </tr>
          </thead>
          <tbody>
            {tableCurvePoints.map((row) => (
              <tr
                key={row.utilizationBps.toString()}
                className="border-b border-[var(--line)] last:border-0"
              >
                <td className="py-2 pr-4 font-medium">
                  {formatBpsPercent(row.utilizationBps)}
                </td>
                <td className="py-2 pr-4 font-mono">
                  {row.utilizationBps.toString()}
                </td>
                <td className="py-2 pr-4 text-emerald-400">
                  {formatBpsPercent(row.borrowRateBps)}
                </td>
                <td className="py-2 pr-4 font-mono">
                  {row.borrowRateBps.toString()}
                </td>
                <td className="mut py-2">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {history.length > 0 && (
          <table
            className="w-full min-w-[360px] text-left text-xs"
            aria-label={labels.historyTableCaption}
            data-testid="utilization-history-fallback-table"
          >
            <caption className="mut mb-2 text-left font-medium">
              {labels.historyTableCaption}
            </caption>
            <thead className="mut border-b border-[var(--line)]">
              <tr>
                <th className="py-2 pr-4">{labels.colLedger}</th>
                <th className="py-2 pr-4">{labels.colUtilization}</th>
                <th className="py-2">{labels.colUtilizationBps}</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 12).map((sample) => (
                <tr
                  key={`${sample.ledger}-${sample.utilization_bps.toString()}`}
                  className="border-b border-[var(--line)] last:border-0"
                >
                  <td className="py-2 pr-4 font-mono">{sample.ledger}</td>
                  <td className="py-2 pr-4">
                    {formatBpsPercent(sample.utilization_bps)}
                  </td>
                  <td className="py-2 font-mono">
                    {sample.utilization_bps.toString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}
