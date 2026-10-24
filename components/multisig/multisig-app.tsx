"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Proposal, ProposalStatus } from "@/lib/multisig/types";
import {
  listProposals,
  MultisigOverview,
} from "@/lib/multisig/reads";
import { shortenAddress } from "@/lib/multisig/decode";
import { getStatusDisplay } from "@/lib/multisig/status";
import { BatchProposalActions } from "./proposal-actions";
import { config, explorer, accountExplorer } from "@/lib/config";

export function MultisigApp() {
  const isConfigured = Boolean(config.multisigId);

  const [overview, setOverview] = useState<MultisigOverview | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState<boolean>(isConfigured);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const [showAllSigners, setShowAllSigners] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await listProposals({ contractId: config.multisigId });
      setOverview(res.overview);
      setProposals(res.proposals);
    } catch (err: any) {
      setError(err?.message || "Failed to load multisig governance state from RPC.");
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    if (isConfigured) {
      loadData();
    }
  }, [isConfigured, loadData]);

  // Compute effective status for each proposal
  const enrichedProposals = useMemo(() => {
    return proposals.map((p) => {
      const currentLedger = overview?.currentLedger;
      const display = getStatusDisplay(p, currentLedger);
      return {
        ...p,
        effectiveStatus: display.effectiveStatus,
        statusDisplay: display,
      };
    });
  }, [proposals, overview?.currentLedger]);

  const filtered = useMemo(() => {
    return enrichedProposals.filter((p) => {
      if (filter === "All") return true;
      return p.effectiveStatus === filter || p.status === filter;
    });
  }, [enrichedProposals, filter]);

  // Status badge styling
  const statusBadgeClass = (status: ProposalStatus) => {
    switch (status) {
      case "Active":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "Passed":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "Executed":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "Cancelled":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      case "Expired":
        return "bg-gray-500/10 text-gray-400 border-gray-500/30";
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/30";
    }
  };

  // 1. Not-configured state: displays clear instructions and makes ZERO RPC calls
  if (!isConfigured) {
    return (
      <div className="space-y-8" data-testid="multisig-not-configured">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Multisig Governance Explorer</h1>
          <p className="mut mt-1 text-sm">
            Inspect on-chain proposals, decoded contract calls, quorum threshold progress, and signers.
          </p>
        </div>

        <div className="card p-8 text-center space-y-4 max-w-2xl mx-auto border-dashed">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 text-2xl mb-2">
            ⚙️
          </div>
          <h2 className="text-xl font-bold">Multisig Contract Not Configured</h2>
          <p className="text-sm mut max-w-lg mx-auto">
            The multisig explorer requires a valid Stellar/Soroban multisig contract ID.
            Configure <code className="px-1.5 py-0.5 rounded bg-[var(--line)] text-amber-300 font-mono text-xs">NEXT_PUBLIC_MULTISIG_CONTRACT_ID</code> in
            your <code className="px-1.5 py-0.5 rounded bg-[var(--line)] text-xs">.env.local</code> to enable on-chain proposal discovery and quorum tracking.
          </p>
          <div className="pt-2 text-xs font-mono text-gray-400 bg-[var(--bg)] p-3 rounded-lg border border-[var(--line)] text-left">
            # .env.local<br />
            NEXT_PUBLIC_MULTISIG_CONTRACT_ID=CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6
          </div>
        </div>
      </div>
    );
  }

  const signers = overview?.signers || [];
  const visibleSigners = showAllSigners ? signers : signers.slice(0, 3);

  return (
    <div className="space-y-8" data-testid="multisig-governance-page">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Multisig Governance Explorer</h1>
          <p className="mut mt-1 text-sm">
            Real-time explorer for StellarLend multisig signers, quorum threshold, and decoded proposals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="btn-ghost text-xs px-3 py-1.5 rounded-lg border border-[var(--line)]"
            title="Refresh on-chain state"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
          <div className="text-xs mut">
            Multisig Contract:{" "}
            <a
              href={explorer(config.multisigId)}
              target="_blank"
              rel="noreferrer"
              className="underline font-mono text-blue-400 hover:text-blue-300"
            >
              {shortenAddress(config.multisigId, 6, 6)}
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={loadData} className="underline text-xs">
            Retry
          </button>
        </div>
      )}

      {/* Multisig Contract Overview Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm uppercase tracking-wider font-semibold mut">Contract Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--line)] space-y-1">
            <span className="text-xs mut">Quorum Threshold</span>
            <p className="text-xl font-bold">
              {overview ? `${overview.threshold} of ${signers.length}` : "—"}{" "}
              <span className="text-xs font-normal mut">signers required</span>
            </p>
          </div>

          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--line)] space-y-1">
            <span className="text-xs mut">Active Signers</span>
            <p className="text-xl font-bold">{overview ? signers.length : "—"}</p>
          </div>

          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--line)] space-y-1">
            <span className="text-xs mut">Current Ledger</span>
            <p className="text-xl font-bold font-mono">
              {overview?.currentLedger ? `#${overview.currentLedger.toLocaleString()}` : "—"}
            </p>
          </div>

          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--line)] space-y-1">
            <span className="text-xs mut">Signer Set Hash</span>
            <p className="text-xs font-mono break-all text-slate-300">
              {overview?.signerSetHash ? shortenAddress(overview.signerSetHash, 8, 8) : "—"}
            </p>
          </div>
        </div>

        {/* Signers List */}
        {signers.length > 0 && (
          <div className="pt-2 border-t border-[var(--line)]">
            <div className="flex items-center justify-between text-xs mut mb-2">
              <span>Registered Signers ({signers.length})</span>
              {signers.length > 3 && (
                <button
                  onClick={() => setShowAllSigners(!showAllSigners)}
                  className="text-blue-400 hover:underline"
                >
                  {showAllSigners ? "Show less" : `Show all (${signers.length})`}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleSigners.map((s) => (
                <a
                  key={s}
                  href={accountExplorer(s)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-mono px-2 py-1 rounded bg-[var(--bg)] border border-[var(--line)] text-slate-300 hover:text-white hover:border-[var(--line-focus)]"
                >
                  {shortenAddress(s, 6, 6)} ↗
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Proposal Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 text-xs">
          {["All", "Active", "Passed", "Executed", "Expired", "Cancelled"].map((f) => {
            const count =
              f === "All"
                ? enrichedProposals.length
                : enrichedProposals.filter((x) => x.effectiveStatus === f || x.status === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  filter === f
                    ? "border-[var(--acc)] text-white bg-[var(--acc)]/10"
                    : "border-[var(--line)] text-gray-400 hover:text-white"
                }`}
              >
                {f} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Proposals List Table */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center mut">Loading multisig proposals from Soroban RPC...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center mut space-y-2">
            <p className="text-base font-semibold">No proposals found</p>
            <p className="text-xs">
              {filter === "All"
                ? "No multisig proposals have been created yet on this contract."
                : `No proposals found with status ${filter}.`}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm min-w-[750px]">
            <thead className="mut border-b border-[var(--line)] text-xs">
              <tr>
                <th className="p-4">Proposal</th>
                <th className="p-4">Decoded Action</th>
                <th className="p-4">Status</th>
                <th className="p-4">Quorum Progress</th>
                <th className="p-4">Expiry (Ledgers & Est. Time)</th>
                <th className="p-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const threshold = p.threshold || overview?.threshold || 1;
                const progressPct = Math.min(100, Math.round((p.approvals.length / threshold) * 100));
                const isOverridden = p.statusDisplay?.isOverridden;

                return (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--line)]/20 transition-colors"
                  >
                    <td className="p-4 font-bold whitespace-nowrap">
                      #{p.id}
                    </td>

                    <td className="p-4 text-xs font-mono max-w-sm">
                      <div className="truncate font-semibold text-slate-200">
                        {p.decodedAction?.summary || (typeof p.action === "string" ? p.action : JSON.stringify(p.action))}
                      </div>
                      {p.signerSetChanged && (
                        <span className="inline-block mt-1 text-[11px] font-sans px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          ⚠️ signer set changed; approvals invalid
                        </span>
                      )}
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      {isOverridden ? (
                        <div className="space-y-0.5">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                              p.effectiveStatus || "Expired"
                            )}`}
                          >
                            stored: {p.status} · effective: {p.effectiveStatus}
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                            p.status
                          )}`}
                        >
                          {p.status}
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-xs min-w-[140px]">
                      <div className="flex items-center justify-between mb-1 text-[11px] font-medium">
                        <span>{p.approvals.length} / {threshold} signers</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[var(--bg)] rounded-full overflow-hidden border border-[var(--line)]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            progressPct >= 100 ? "bg-emerald-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </td>

                    <td className="p-4 text-xs whitespace-nowrap">
                      <div className="font-mono">#{p.expiresAtLedger.toLocaleString()}</div>
                      <div className="text-[11px] mut mt-0.5">
                        {p.timeToExpiry || "—"}
                      </div>
                    </td>

                    <td className="p-4 text-right whitespace-nowrap">
                      <Link href={`/multisig/${p.id}`} className="btn-ghost text-xs">
                        View Details →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Batch Proposal Actions for Signers */}
      {proposals.length > 0 && (
        <div className="card p-6">
          <BatchProposalActions proposals={proposals} onRefresh={loadData} />
        </div>
      )}
    </div>
  );
}
