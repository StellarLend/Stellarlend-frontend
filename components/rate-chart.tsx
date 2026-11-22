"use client";

import React, { useMemo } from "react";
import {
  BPS_DENOM,
  DEFAULT_APR_BPS,
  DEFAULT_RATE_PARAMS,
  borrowRateBps,
  formatBpsPercent,
  sampleBorrowRateCurve,
  type RateModelDiagnostics,
  type RateParams,
  type UtilizationSample,
} from "@/lib/rate-model";

export type RateChartLabels = {
  eyebrow: string;
  title: string;
  subtitle: string;
  chartAriaLabel: string;
  sparklineAriaLabel: string;
  inactiveBannerTitle: string;
  inactiveBannerBody: string;
  demoBadge: string;
  liveBadge: string;
  currentUtilization: string;
  appliedRate: string;
  targetRate: string;
  kink: string;
  floorCeiling: string;
  surchargeBand: string;
  surchargeDisabled: string;
  lastUpdateLedger: string;
  elapsedLedgers: string;
  summaryActive: string;
  summaryInactive: string;
  legendCurve: string;
  legendCurrentUtil: string;
  legendAppliedRate: string;
  legendTargetRate: string;
  axisUtilization: string;
  axisBorrowRate: string;
  historyTitle: string;
  historySubtitle: string;
  historyEmptyTitle: string;
  historyEmptyBody: string;
  historyLedgerRange: string;
  historyLatestSample: string;
  tableToggle: string;
  curveTableCaption: string;
  colUtilization: string;
  colUtilizationBps: string;
  colBorrowApr: string;
  colBorrowBps: string;
  colNote: string;
  markerKink: string;
  markerCurrent: string;
  markerSurcharge: string;
  historyTableCaption: string;
  colLedger: string;
};

export const defaultRateChartLabels: RateChartLabels = {
  eyebrow: "Interest-rate model",
  title: "Two-slope borrow rate curve",
  subtitle:
    "Live parameters from get_rate_params, current utilization and smoothed rate from get_rate_model_diagnostics, and recent utilization samples from get_utilization_history.",
  chartAriaLabel: "Two-slope borrow rate curve chart",
  sparklineAriaLabel: "Protocol utilization history sparkline",
  inactiveBannerTitle: "Rate model inactive — default APR applies",
  inactiveBannerBody:
    "rate_model_active is false on the contract. Borrow positions accrue at the fixed default rate of 5.00% APR (500 bps) instead of the two-slope curve.",
  demoBadge: "Demo curve",
  liveBadge: "On-chain",
  currentUtilization: "Current utilization",
  appliedRate: "Applied rate (smoothed)",
  targetRate: "Target rate (raw)",
  kink: "Kink threshold",
  floorCeiling: "Floor / ceiling",
  surchargeBand: "Surcharge band",
  surchargeDisabled: "Disabled",
  lastUpdateLedger: "Last update ledger",
  elapsedLedgers: "{count} ledgers ago",
  summaryActive:
    "At {utilization} utilization, the target borrow rate is {targetRate} ({targetBps} bps) and the applied smoothed rate is {appliedRate} ({appliedBps} bps). The kink is at {kink} utilization.",
  summaryInactive:
    "The dynamic rate model is currently inactive. The protocol applies the default borrow rate of {defaultRate} ({defaultBps} bps) regardless of utilization ({utilization}).",
  legendCurve: "Borrow rate curve",
  legendCurrentUtil: "Current utilization",
  legendAppliedRate: "Applied rate",
  legendTargetRate: "Target rate",
  axisUtilization: "Utilization (%)",
  axisBorrowRate: "Borrow APR (%)",
  historyTitle: "Utilization history",
  historySubtitle: "Newest-first ring buffer (up to 256 ledger samples)",
  historyEmptyTitle: "No utilization history recorded yet",
  historyEmptyBody:
    "The contract returns an empty ring buffer until a borrow-rate update writes the first utilization sample on-chain.",
  historyLedgerRange: "Ledger {oldest} to {newest}",
  historyLatestSample: "Latest sample: {utilization} at ledger {ledger}",
  tableToggle: "Accessible data tables",
  curveTableCaption: "Sampled borrow-rate curve points",
  colUtilization: "Utilization",
  colUtilizationBps: "Utilization (bps)",
  colBorrowApr: "Borrow APR",
  colBorrowBps: "Borrow rate (bps)",
  colNote: "Marker",
  markerKink: "Kink",
  markerCurrent: "Current",
  markerSurcharge: "Surcharge kink",
  historyTableCaption: "Utilization history samples",
  colLedger: "Ledger",
};

export type RateChartProps = {
  params?: RateParams;
  diagnostics?: RateModelDiagnostics;
  history?: UtilizationSample[];
  source?: "contract" | "demo";
  labels?: Partial<RateChartLabels>;
};

const DEFAULT_DIAGNOSTICS: RateModelDiagnostics = {
  rate_model_active: true,
  utilization_bps: 6_500n,
  target_rate_bps: borrowRateBps(6_500n, DEFAULT_RATE_PARAMS),
  applied_rate_bps: borrowRateBps(6_500n, DEFAULT_RATE_PARAMS),
  last_update_ledger: 0,
  elapsed_ledgers: 0,
};

function interpolate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in values ? String(values[key]) : `{${key}}`
  );
}

function clampBps(bps: bigint): bigint {
  if (bps < 0n) return 0n;
  if (bps > BPS_DENOM) return BPS_DENOM;
  return bps;
}

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

  // Key milestone points for the accessible fallback table
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
      .map((u) => {
        const rate = diagnostics.rate_model_active
          ? borrowRateBps(u, params)
          : DEFAULT_APR_BPS;
        const notes: string[] = [];
        if (u === kinkUtilBps && diagnostics.rate_model_active) {
          notes.push(copy.markerKink);
        }
        if (u === currentUtilBps) {
          notes.push(copy.markerCurrent);
        }
        if (
          surchargeActive &&
          u === clampBps(params.surcharge_kink_bps) &&
          diagnostics.rate_model_active
        ) {
          notes.push(copy.markerSurcharge);
        }
        return {
          utilizationBps: u,
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
    copy.markerKink,
    copy.markerCurrent,
    copy.markerSurcharge,
  ]);

  // SVG coordinate math for the borrow-rate curve
  const chartWidth = 640;
  const chartHeight = 240;
  const padLeft = 52;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 38;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;

  const maxRateBps = useMemo(() => {
    let maxVal = 1_000n;
    for (const pt of sampledCurve) {
      if (maxVal < pt.borrowRateBps) maxVal = pt.borrowRateBps;
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

  const toX = (uBps: bigint) =>
    padLeft + (Number(clampBps(uBps)) / Number(BPS_DENOM)) * plotW;
  const toY = (rBps: bigint) => {
    const maxNum = Math.max(100, Number(maxRateBps));
    const clampedRate = Math.max(0, Math.min(maxNum, Number(rBps)));
    return padTop + plotH - (clampedRate / maxNum) * plotH;
  };

  const polylinePoints = useMemo(
    () =>
      sampledCurve
        .map(
          (pt) =>
            `${toX(pt.utilizationBps).toFixed(1)},${toY(pt.borrowRateBps).toFixed(1)}`
        )
        .join(" "),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sampledCurve, maxRateBps]
  );

  const areaPath = useMemo(() => {
    if (sampledCurve.length === 0) return "";
    const firstX = toX(sampledCurve[0].utilizationBps).toFixed(1);
    const lastX = toX(
      sampledCurve[sampledCurve.length - 1].utilizationBps
    ).toFixed(1);
    const baselineY = (padTop + plotH).toFixed(1);
    return `M ${firstX},${baselineY} L ${polylinePoints.replace(/ /g, " L ")} L ${lastX},${baselineY} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampledCurve, polylinePoints, maxRateBps]);

  const currentX = toX(currentUtilBps);
  const kinkX = toX(kinkUtilBps);
  const targetY = toY(diagnostics.target_rate_bps);
  const appliedY = toY(diagnostics.applied_rate_bps);

  // Chronological (oldest -> newest) ordering for the utilization sparkline
  const chronologicalHistory = useMemo(
    () =>
      [...history]
        .slice(0, 256)
        .sort((a, b) => a.ledger - b.ledger),
    [history]
  );

  const sparkWidth = 640;
  const sparkHeight = 120;
  const sparkPadL = 44;
  const sparkPadR = 18;
  const sparkPadT = 14;
  const sparkPadB = 26;
  const sparkW = sparkWidth - sparkPadL - sparkPadR;
  const sparkH = sparkHeight - sparkPadT - sparkPadB;

  const sparkPoints = useMemo(() => {
    if (chronologicalHistory.length === 0) return "";
    const minLedger = chronologicalHistory[0].ledger;
    const maxLedger =
      chronologicalHistory[chronologicalHistory.length - 1].ledger;
    const ledgerSpan = Math.max(1, maxLedger - minLedger);

    return chronologicalHistory
      .map((sample, idx) => {
        const ratioX =
          chronologicalHistory.length === 1
            ? 0.5
            : maxLedger === minLedger
              ? idx / (chronologicalHistory.length - 1)
              : (sample.ledger - minLedger) / ledgerSpan;
        const x = sparkPadL + ratioX * sparkW;
        const y =
          sparkPadT +
          sparkH -
          (Number(clampBps(sample.utilization_bps)) / Number(BPS_DENOM)) *
            sparkH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [chronologicalHistory, sparkW, sparkH]);

  const summaryText = diagnostics.rate_model_active
    ? interpolate(copy.summaryActive, {
        utilization: formatBpsPercent(currentUtilBps),
        targetRate: formatBpsPercent(diagnostics.target_rate_bps),
        targetBps: diagnostics.target_rate_bps.toString(),
        appliedRate: formatBpsPercent(diagnostics.applied_rate_bps),
        appliedBps: diagnostics.applied_rate_bps.toString(),
        kink: formatBpsPercent(kinkUtilBps),
      })
    : interpolate(copy.summaryInactive, {
        defaultRate: formatBpsPercent(DEFAULT_APR_BPS),
        defaultBps: DEFAULT_APR_BPS.toString(),
        utilization: formatBpsPercent(currentUtilBps),
      });

  const badgeLabel = source === "contract" ? copy.liveBadge : copy.demoBadge;
  const surchargeDisplay = surchargeActive
    ? `>${formatBpsPercent(params.surcharge_kink_bps)} (+${formatBpsPercent(params.surcharge_slope)})`
    : copy.surchargeDisabled;
  const floorCeilingDisplay = `${formatBpsPercent(params.rate_floor_bps)} / ${formatBpsPercent(params.rate_ceiling_bps)}`;

  const oldestSample =
    chronologicalHistory.length > 0 ? chronologicalHistory[0] : null;
  const newestSample =
    chronologicalHistory.length > 0
      ? chronologicalHistory[chronologicalHistory.length - 1]
      : null;

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

      {/* Text summary for screen readers and quick visual inspection */}
      <p className="mut text-sm" data-testid="rate-model-summary">
        {summaryText}
      </p>

      {/* Diagnostics & parameter stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-3">
          <div className="mut text-xs">{copy.currentUtilization}</div>
          <div
            className="mt-1 text-lg font-semibold"
            data-testid="diag-utilization"
          >
            {formatBpsPercent(currentUtilBps)}
          </div>
          <div className="mut text-xs">{`${currentUtilBps.toString()} bps`}</div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-3">
          <div className="mut text-xs">{copy.appliedRate}</div>
          <div
            className="mt-1 text-lg font-semibold text-emerald-400"
            data-testid="diag-applied-rate"
          >
            {formatBpsPercent(diagnostics.applied_rate_bps)}
          </div>
          <div className="mut text-xs">{`${diagnostics.applied_rate_bps.toString()} bps`}</div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-3">
          <div className="mut text-xs">{copy.targetRate}</div>
          <div
            className="mt-1 text-lg font-semibold text-indigo-300"
            data-testid="diag-target-rate"
          >
            {formatBpsPercent(diagnostics.target_rate_bps)}
          </div>
          <div className="mut text-xs">{`${diagnostics.target_rate_bps.toString()} bps`}</div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-3">
          <div className="mut text-xs">{copy.kink}</div>
          <div className="mt-1 text-lg font-semibold">
            {formatBpsPercent(kinkUtilBps)}
          </div>
          <div className="mut text-xs">{`${kinkUtilBps.toString()} bps`}</div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-3">
          <div className="mut text-xs">{copy.floorCeiling}</div>
          <div className="mt-1 text-sm font-semibold">{floorCeilingDisplay}</div>
          <div className="mut text-xs">{`${params.rate_floor_bps.toString()}–${params.rate_ceiling_bps.toString()} bps`}</div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-3">
          <div className="mut text-xs">{copy.surchargeBand}</div>
          <div className="mt-1 text-sm font-semibold">{surchargeDisplay}</div>
          <div className="mut text-xs">
            {interpolate(copy.elapsedLedgers, {
              count: diagnostics.elapsed_ledgers,
            })}
          </div>
        </div>
      </div>

      {/* Two-slope borrow rate curve SVG */}
      <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium">{copy.axisBorrowRate}</span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-4 rounded bg-[var(--acc)]"
                aria-hidden="true"
              />
              <span>{copy.legendCurve}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400"
                aria-hidden="true"
              />
              <span>{copy.legendAppliedRate}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full border-2 border-indigo-400"
                aria-hidden="true"
              />
              <span>{copy.legendTargetRate}</span>
            </span>
          </div>
        </div>

        <svg
          role="img"
          aria-label={copy.chartAriaLabel}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-auto w-full overflow-visible"
          data-testid="borrow-rate-curve-svg"
        >
          <title>{copy.chartAriaLabel}</title>
          <desc>{summaryText}</desc>

          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const rateAtTick = BigInt(
              Math.round(Number(maxRateBps) * fraction)
            );
            const y = toY(rateAtTick);
            return (
              <g key={fraction}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={chartWidth - padRight}
                  y2={y}
                  stroke="#1d2840"
                  strokeDasharray={fraction === 0 ? undefined : "3 3"}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#8b97b2"
                  fontSize="10"
                >
                  {formatBpsPercent(rateAtTick, 1)}
                </text>
              </g>
            );
          })}

          {/* X-axis ticks (0%, 25%, 50%, 75%, 100%) */}
          {[0n, 2_500n, 5_000n, 7_500n, 10_000n].map((uTick) => {
            const x = toX(uTick);
            return (
              <g key={uTick.toString()}>
                <line
                  x1={x}
                  y1={padTop + plotH}
                  x2={x}
                  y2={padTop + plotH + 4}
                  stroke="#8b97b2"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  fill="#8b97b2"
                  fontSize="10"
                >
                  {formatBpsPercent(uTick, 0)}
                </text>
              </g>
            );
          })}

          {/* Kink vertical reference line */}
          <line
            x1={kinkX}
            y1={padTop}
            x2={kinkX}
            y2={padTop + plotH}
            stroke="#818cf8"
            strokeDasharray="4 4"
            strokeWidth="1"
            data-testid="kink-marker-line"
          />

          {/* Shaded area under curve */}
          {areaPath && (
            <path d={areaPath} fill="#5eead4" fillOpacity="0.08" />
          )}

          {/* Two-slope borrow rate curve */}
          <polyline
            fill="none"
            stroke="#5eead4"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polylinePoints}
            opacity={diagnostics.rate_model_active ? 1 : 0.35}
          />

          {/* Vertical marker at current utilization */}
          <line
            x1={currentX}
            y1={padTop}
            x2={currentX}
            y2={padTop + plotH}
            stroke="#34d399"
            strokeDasharray="2 2"
            strokeWidth="1.5"
            data-testid="current-utilization-marker"
          />

          {/* Target rate dot (raw curve rate) */}
          <circle
            cx={currentX}
            cy={targetY}
            r="6"
            fill="#0a1020"
            stroke="#818cf8"
            strokeWidth="2"
            data-testid="target-rate-dot"
          />

          {/* Applied rate dot (smoothed/clamped rate) */}
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
          {copy.axisUtilization}
        </div>
      </div>

      {/* Utilization history sparkline */}
      <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{copy.historyTitle}</h3>
            <p className="mut text-xs">{copy.historySubtitle}</p>
          </div>
          {oldestSample && newestSample && (
            <div className="mut text-right text-xs">
              <div>
                {interpolate(copy.historyLedgerRange, {
                  oldest: oldestSample.ledger,
                  newest: newestSample.ledger,
                })}
              </div>
              <div className="text-[var(--fg)]">
                {interpolate(copy.historyLatestSample, {
                  utilization: formatBpsPercent(newestSample.utilization_bps),
                  ledger: newestSample.ledger,
                })}
              </div>
            </div>
          )}
        </div>

        {chronologicalHistory.length === 0 ? (
          <div
            className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center"
            data-testid="utilization-history-empty"
          >
            <div className="text-sm font-semibold">
              {copy.historyEmptyTitle}
            </div>
            <p className="mut mx-auto mt-1 max-w-lg text-xs">
              {copy.historyEmptyBody}
            </p>
          </div>
        ) : (
          <svg
            role="img"
            aria-label={copy.sparklineAriaLabel}
            viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
            className="h-auto w-full overflow-visible"
            data-testid="utilization-sparkline-svg"
          >
            <title>{copy.sparklineAriaLabel}</title>
            {[0n, 5_000n, 10_000n].map((uTick) => {
              const y =
                sparkPadT +
                sparkH -
                (Number(uTick) / Number(BPS_DENOM)) * sparkH;
              return (
                <g key={uTick.toString()}>
                  <line
                    x1={sparkPadL}
                    y1={y}
                    x2={sparkWidth - sparkPadR}
                    y2={y}
                    stroke="#1d2840"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                  />
                  <text
                    x={sparkPadL - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="#8b97b2"
                    fontSize="9"
                  >
                    {formatBpsPercent(uTick, 0)}
                  </text>
                </g>
              );
            })}

            <polyline
              fill="none"
              stroke="#818cf8"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={sparkPoints}
            />

            {oldestSample && newestSample && (
              <>
                <text
                  x={sparkPadL}
                  y={sparkHeight - 6}
                  textAnchor="start"
                  fill="#8b97b2"
                  fontSize="9"
                >
                  {`#${oldestSample.ledger}`}
                </text>
                <text
                  x={sparkWidth - sparkPadR}
                  y={sparkHeight - 6}
                  textAnchor="end"
                  fill="#8b97b2"
                  fontSize="9"
                >
                  {`#${newestSample.ledger}`}
                </text>
              </>
            )}
          </svg>
        )}
      </div>

      {/* Accessible data table fallback */}
      <details className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-4">
        <summary className="cursor-pointer text-sm font-medium">
          {copy.tableToggle}
        </summary>
        <div className="mt-4 space-y-6 overflow-x-auto">
          <table
            className="w-full min-w-[480px] text-left text-xs"
            aria-label={copy.curveTableCaption}
            data-testid="rate-curve-fallback-table"
          >
            <caption className="mut mb-2 text-left font-medium">
              {copy.curveTableCaption}
            </caption>
            <thead className="mut border-b border-[var(--line)]">
              <tr>
                <th className="py-2 pr-4">{copy.colUtilization}</th>
                <th className="py-2 pr-4">{copy.colUtilizationBps}</th>
                <th className="py-2 pr-4">{copy.colBorrowApr}</th>
                <th className="py-2 pr-4">{copy.colBorrowBps}</th>
                <th className="py-2">{copy.colNote}</th>
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
              aria-label={copy.historyTableCaption}
              data-testid="utilization-history-fallback-table"
            >
              <caption className="mut mb-2 text-left font-medium">
                {copy.historyTableCaption}
              </caption>
              <thead className="mut border-b border-[var(--line)]">
                <tr>
                  <th className="py-2 pr-4">{copy.colLedger}</th>
                  <th className="py-2 pr-4">{copy.colUtilization}</th>
                  <th className="py-2">{copy.colUtilizationBps}</th>
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
    </section>
  );
}

export default RateChart;
