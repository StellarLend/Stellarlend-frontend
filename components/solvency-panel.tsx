import React from "react";
import type { BadDebtWriteOffEvent, SolvencyMetrics } from "@/lib/solvency";

export type SolvencyPanelLabels = {
  loading: string;
  title: string;
  insuranceFund: string;
  insuranceShare: string;
  badDebt: string;
  coverage: string;
  coverageHint: string;
  writeOffHistory: string;
  writeOffHistorySubtitle: string;
  noWriteOffHistory: string;
  date: string;
  amount: string;
  insurance: string;
  reserve: string;
  socialized: string;
  socializedHint: string;
  insuranceHint: string;
  insuranceShareHint: string;
  badDebtHint: string;
};

export const defaultSolvencyPanelLabels: SolvencyPanelLabels = {
  loading: "Loading solvency…",
  title: "Protocol solvency",
  insuranceFund: "Insurance fund",
  insuranceShare: "Insurance share",
  badDebt: "Bad debt",
  coverage: "Coverage",
  coverageHint: "Coverage ratio",
  writeOffHistory: "Write-off history",
  writeOffHistorySubtitle: "Recent bad-debt write-offs",
  noWriteOffHistory: "No write-off history",
  date: "Date",
  amount: "Amount",
  insurance: "Insurance",
  reserve: "Reserve",
  socialized: "Socialized",
  socializedHint: "Socialization means the remaining loss after insurance and reserve coverage was spread across depositors as a haircut.",
  insuranceHint: "Liquid reserves available to cover losses.",
  insuranceShareHint: "Share of total supply earmarked for protection.",
  badDebtHint: "Unrecovered principal that remains in the protocol.",
};

type SolvencyPanelProps = {
  metrics: SolvencyMetrics | null;
  writeOffs: BadDebtWriteOffEvent[];
  compact?: boolean;
  detailed?: boolean;
  labels?: Partial<SolvencyPanelLabels>;
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{value}</div>
      {hint ? <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}

export function SolvencyPanel({ metrics, writeOffs, compact = false, detailed = false, labels }: SolvencyPanelProps) {
  const showDetailed = detailed || !compact;
  const copy = { ...defaultSolvencyPanelLabels, ...labels };

  if (!metrics) {
    return <div className="card p-6">{copy.loading}</div>;
  }

  return (
    <section className="card p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">{copy.title}</div>
          <h2 className="mt-1 text-xl font-semibold">{copy.title}</h2>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
          {metrics.coverageLabel}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label={copy.insuranceFund} value={metrics.insuranceFundDisplay} hint={copy.insuranceHint} />
        <Stat label={copy.insuranceShare} value={metrics.insuranceShareDisplay} hint={copy.insuranceShareHint} />
        <Stat label={copy.badDebt} value={metrics.badDebtDisplay} hint={copy.badDebtHint} />
        <Stat label={copy.coverage} value={metrics.coverageLabel} hint={`${copy.coverageHint} ${metrics.coverageLabel}`} />
      </div>

      {showDetailed ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">{copy.writeOffHistory}</h3>
            <span className="text-xs text-[var(--muted)]">{copy.writeOffHistorySubtitle}</span>
          </div>

          {writeOffs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              {copy.noWriteOffHistory}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--line)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--surface-strong)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">{copy.date}</th>
                    <th className="px-3 py-2 font-medium">{copy.amount}</th>
                    <th className="px-3 py-2 font-medium">{copy.insurance}</th>
                    <th className="px-3 py-2 font-medium">{copy.reserve}</th>
                    <th className="px-3 py-2 font-medium">{copy.socialized}</th>
                  </tr>
                </thead>
                <tbody>
                  {writeOffs.map((event, index) => {
                    const hasSocialized = event.socialized > 0n;
                    return (
                      <tr
                        key={`${event.amount.toString()}-${index}`}
                        className={hasSocialized ? "border-t border-[var(--line)] bg-amber-500/5" : "border-t border-[var(--line)] bg-transparent"}
                      >
                        <td className="px-3 py-2 text-[var(--muted)]">{event.timestamp ? new Date(event.timestamp).toLocaleDateString() : "—"}</td>
                        <td className="px-3 py-2">${event.amount.toString()}</td>
                        <td className="px-3 py-2">${event.insuranceUsed.toString()}</td>
                        <td className="px-3 py-2">${event.reserveUsed.toString()}</td>
                        <td className={`px-3 py-2 font-medium ${hasSocialized ? "text-amber-600" : "text-[var(--text)]"}`}>
                          {hasSocialized ? copy.socialized : `$${event.socialized.toString()}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-[var(--muted)]">{copy.socializedHint}</p>
        </div>
      ) : null}
    </section>
  );
}
