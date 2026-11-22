import { useMemo } from "react";
import { BPS_DENOM, formatBpsPercent, type UtilizationSample } from "@/lib/rate-model";
import { clampBps, HISTORY_CHART, HISTORY_TICKS } from "./scales";
import { interpolate } from "./tooltip";
import type { RateChartLabels } from "./types";

type UtilizationHistoryProps = {
  history: UtilizationSample[];
  labels: RateChartLabels;
};

export function UtilizationHistory({
  history,
  labels,
}: UtilizationHistoryProps) {
  const chronologicalHistory = useMemo(
    () =>
      [...history]
        .slice(0, 256)
        .sort((a, b) => a.ledger - b.ledger),
    [history]
  );
  const sparkW = HISTORY_CHART.width - HISTORY_CHART.padLeft - HISTORY_CHART.padRight;
  const sparkH = HISTORY_CHART.height - HISTORY_CHART.padTop - HISTORY_CHART.padBottom;

  const sparkPoints = useMemo(() => {
    if (chronologicalHistory.length === 0) return "";
    const minLedger = chronologicalHistory[0].ledger;
    const maxLedger = chronologicalHistory[chronologicalHistory.length - 1].ledger;
    const ledgerSpan = Math.max(1, maxLedger - minLedger);

    return chronologicalHistory
      .map((sample, index) => {
        const ratioX =
          chronologicalHistory.length === 1
            ? 0.5
            : maxLedger === minLedger
              ? index / (chronologicalHistory.length - 1)
              : (sample.ledger - minLedger) / ledgerSpan;
        const x = HISTORY_CHART.padLeft + ratioX * sparkW;
        const y =
          HISTORY_CHART.padTop +
          sparkH -
          (Number(clampBps(sample.utilization_bps)) / Number(BPS_DENOM)) *
            sparkH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [chronologicalHistory, sparkW, sparkH]);

  const oldestSample =
    chronologicalHistory.length > 0 ? chronologicalHistory[0] : null;
  const newestSample =
    chronologicalHistory.length > 0
      ? chronologicalHistory[chronologicalHistory.length - 1]
      : null;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{labels.historyTitle}</h3>
          <p className="mut text-xs">{labels.historySubtitle}</p>
        </div>
        {oldestSample && newestSample && (
          <div className="mut text-right text-xs">
            <div>
              {interpolate(labels.historyLedgerRange, {
                oldest: oldestSample.ledger,
                newest: newestSample.ledger,
              })}
            </div>
            <div className="text-[var(--fg)]">
              {interpolate(labels.historyLatestSample, {
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
          <div className="text-sm font-semibold">{labels.historyEmptyTitle}</div>
          <p className="mut mx-auto mt-1 max-w-lg text-xs">
            {labels.historyEmptyBody}
          </p>
        </div>
      ) : (
        <svg
          role="img"
          aria-label={labels.sparklineAriaLabel}
          viewBox={`0 0 ${HISTORY_CHART.width} ${HISTORY_CHART.height}`}
          className="h-auto w-full overflow-visible"
          data-testid="utilization-sparkline-svg"
        >
          <title>{labels.sparklineAriaLabel}</title>
          {HISTORY_TICKS.map((uTick) => {
            const y =
              HISTORY_CHART.padTop +
              sparkH -
              (Number(uTick) / Number(BPS_DENOM)) * sparkH;
            return (
              <g key={uTick.toString()}>
                <line
                  x1={HISTORY_CHART.padLeft}
                  y1={y}
                  x2={HISTORY_CHART.width - HISTORY_CHART.padRight}
                  y2={y}
                  stroke="#1d2840"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
                <text
                  x={HISTORY_CHART.padLeft - 6}
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
                x={HISTORY_CHART.padLeft}
                y={HISTORY_CHART.height - 6}
                textAnchor="start"
                fill="#8b97b2"
                fontSize="9"
              >
                {`#${oldestSample.ledger}`}
              </text>
              <text
                x={HISTORY_CHART.width - HISTORY_CHART.padRight}
                y={HISTORY_CHART.height - 6}
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
  );
}
