import { DEFAULT_APR_BPS, formatBpsPercent, type RateModelDiagnostics } from "@/lib/rate-model";
import type { RateChartLabels } from "./types";

function interpolate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in values ? String(values[key]) : `{${key}}`
  );
}

export function buildRateSummary(
  labels: RateChartLabels,
  diagnostics: RateModelDiagnostics,
  utilizationBps: bigint,
  kinkBps: bigint
): string {
  return diagnostics.rate_model_active
    ? interpolate(labels.summaryActive, {
        utilization: formatBpsPercent(utilizationBps),
        targetRate: formatBpsPercent(diagnostics.target_rate_bps),
        targetBps: diagnostics.target_rate_bps.toString(),
        appliedRate: formatBpsPercent(diagnostics.applied_rate_bps),
        appliedBps: diagnostics.applied_rate_bps.toString(),
        kink: formatBpsPercent(kinkBps),
      })
    : interpolate(labels.summaryInactive, {
        defaultRate: formatBpsPercent(DEFAULT_APR_BPS),
        defaultBps: DEFAULT_APR_BPS.toString(),
        utilization: formatBpsPercent(utilizationBps),
      });
}

export function RateSummaryTooltip({ summary }: { summary: string }) {
  return (
    <p className="mut text-sm" data-testid="rate-model-summary">
      {summary}
    </p>
  );
}

export { interpolate };
