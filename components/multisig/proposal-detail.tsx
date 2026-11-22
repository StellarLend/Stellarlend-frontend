"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Proposal, ProposalStatus } from "@/lib/multisig/types";
import { getProposalDetail } from "@/lib/multisig/reads";
import { shortenAddress, DecodedVal } from "@/lib/multisig/decode";
import { getStatusDisplay } from "@/lib/multisig/status";
import { ProposalActions } from "./proposal-actions";
import { explorer, accountExplorer, config } from "@/lib/config";

export function ProposalDetail({ id }: { id: number }) {
  const isConfigured = Boolean(config.multisigId);

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState<boolean>(isConfigured);
  const [error, setError] = useState<string | null>(null);

  const loadProposal = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const found = await getProposalDetail(id, config.multisigId);
      setProposal(found);
    } catch (err: any) {
      setError(err?.message || "Failed to load proposal details from Soroban RPC.");
    } finally {
      setLoading(false);
    }
  }, [id, isConfigured]);

  useEffect(() => {
    if (isConfigured) {
      loadProposal();
    }
  }, [isConfigured, loadProposal]);

  const handleRefresh = async () => {
    await loadProposal();
  };

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
      <div className="space-y-4 max-w-4xl mx-auto" data-testid="multisig-detail-not-configured">
        <Link href="/multisig" className="btn-ghost text-xs">
          ← Back to Multisig Proposals
        </Link>
        <div className="card p-8 text-center space-y-4 border-dashed">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 text-2xl mb-2">
            ⚙️
          </div>
          <h2 className="text-xl font-bold">Multisig Contract Not Configured</h2>
          <p className="text-sm mut max-w-md mx-auto">
            Configure <code className="px-1.5 py-0.5 rounded bg-[var(--line)] text-amber-300 font-mono text-xs">NEXT_PUBLIC_MULTISIG_CONTRACT_ID</code> in
            your environment to view on-chain proposal details and quorum state.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card p-12 text-center mut max-w-4xl mx-auto">
        Loading multisig proposal #{id} from Soroban RPC...
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Link href="/multisig" className="btn-ghost text-xs">
          ← Back to Multisig Governance
        </Link>
        <div className="card p-8 text-center space-y-3">
          <h2 className="text-xl font-bold">Proposal #{id} Not Found</h2>
          <p className="text-sm mut">
            {error || "The requested proposal could not be retrieved from the multisig contract."}
          </p>
          <button onClick={loadProposal} className="btn-ghost text-xs mt-2">
            Retry ↻
          </button>
        </div>
      </div>
    );
  }

  const threshold = proposal.threshold || 1;
  const progressPct = Math.min(100, Math.round((proposal.approvals.length / threshold) * 100));
  const statusDisplay = getStatusDisplay(proposal, undefined);
  const isOverridden = proposal.effectiveStatus && proposal.effectiveStatus !== proposal.status;
  const decodedAction = proposal.decodedAction;

  return (
    <div className="space-y-8 max-w-4xl mx-auto" data-testid="proposal-detail-page">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between">
        <Link href="/multisig" className="btn-ghost text-xs">
          ← Back to Multisig Proposals
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="btn-ghost text-xs px-2.5 py-1 rounded border border-[var(--line)]"
          >
            ↻ Refresh
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

      {/* Main Proposal Card */}
      <div className="card p-6 sm:p-8 space-y-6">
        {/* Title and Badges */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Proposal #{proposal.id}
              </h1>
              {isOverridden ? (
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                    proposal.effectiveStatus || "Expired"
                  )}`}
                  data-testid="proposal-status-badge"
                >
                  stored: {proposal.status} · effective: {proposal.effectiveStatus}
                </span>
              ) : (
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                    proposal.status
                  )}`}
                  data-testid="proposal-status-badge"
                >
                  {proposal.status}
                </span>
              )}
            </div>
            <p className="mut mt-2 text-sm">
              Proposed by{" "}
              <a
                href={accountExplorer(proposal.proposer)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-[var(--fg)] underline hover:text-blue-400"
              >
                {proposal.proposer}
              </a>
            </p>
          </div>
        </div>

        {/* Signer Set Changed Warning Banner */}
        {proposal.signerSetChanged && (
          <div
            className="card p-4 border-amber-500/40 bg-amber-500/10 text-amber-300 text-sm space-y-1"
            data-testid="signer-set-changed-warning"
          >
            <div className="font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>signer set changed; approvals invalid</span>
            </div>
            <p className="text-xs text-amber-200/80">
              The contract signers were rotated since this proposal was created.
              Existing approvals are no longer valid under the updated signer set hash.
            </p>
          </div>
        )}

        {/* Proposed Action Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Proposed Action</h3>
            {decodedAction?.kind && (
              <span className="text-xs px-2.5 py-0.5 rounded-full border border-[var(--line)] bg-[var(--bg)] font-mono text-blue-400">
                {decodedAction.kind}
              </span>
            )}
          </div>

          {/* Action Human Summary */}
          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--line)] text-sm space-y-2">
            <div className="font-mono text-slate-200 font-medium">
              {decodedAction?.summary || (typeof proposal.action === "string" ? proposal.action : JSON.stringify(proposal.action))}
            </div>
          </div>

          {/* Decoded InvokeContract Arguments Detail */}
          {decodedAction?.kind === "InvokeContract" && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider mut">Contract Call Details</h4>
              <div className="grid gap-3 sm:grid-cols-2 text-xs font-mono">
                <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--line)]">
                  <span className="mut block mb-1 text-[11px] uppercase font-sans">Target Contract</span>
                  <a
                    href={explorer(decodedAction.contract)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 underline break-all"
                  >
                    {decodedAction.contract} ↗
                  </a>
                </div>
                <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--line)]">
                  <span className="mut block mb-1 text-[11px] uppercase font-sans">Method</span>
                  <span className="text-slate-200 font-bold">{decodedAction.functionName}</span>
                </div>
              </div>

              {decodedAction.args && decodedAction.args.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs mut font-medium">Arguments ({decodedAction.args.length}):</span>
                  <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--bg)] border-b border-[var(--line)] text-[11px] mut">
                        <tr>
                          <th className="p-2.5 w-12">#</th>
                          <th className="p-2.5 w-24">ScVal Type</th>
                          <th className="p-2.5">Decoded Value</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {decodedAction.args.map((arg: DecodedVal, idx: number) => (
                          <tr key={idx} className="border-b border-[var(--line)] last:border-0">
                            <td className="p-2.5 mut">{idx}</td>
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 rounded bg-[var(--line)] text-[10px] text-blue-300 font-sans">
                                {arg.type}
                              </span>
                            </td>
                            <td className="p-2.5 break-all text-slate-200">
                              {arg.isAddress && arg.address ? (
                                <a
                                  href={accountExplorer(arg.address)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-400 underline"
                                >
                                  {arg.address} ↗
                                </a>
                              ) : (
                                <span>{arg.formatted}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Decoded RotateSigners Detail */}
          {decodedAction?.kind === "RotateSigners" && decodedAction.signers && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider mut">New Signer Set</h4>
              <div className="space-y-1">
                {decodedAction.signers.map((addr: string) => (
                  <div key={addr} className="bg-[var(--bg)] p-2.5 rounded-lg border border-[var(--line)] text-xs font-mono flex items-center justify-between">
                    <a
                      href={accountExplorer(addr)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 underline"
                    >
                      {addr} ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quorum Progress & Expiry Info Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-4 space-y-2">
            <span className="mut text-xs uppercase tracking-wide">Quorum Approvals</span>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">
                {proposal.approvals.length} / {threshold}{" "}
                <span className="text-xs mut font-normal">signers approved</span>
              </p>
              <span className="text-xs font-mono font-medium">{progressPct}%</span>
            </div>
            <div className="h-2 w-full bg-[var(--bg)] rounded-full overflow-hidden border border-[var(--line)]">
              <div
                className={`h-full rounded-full transition-all ${
                  progressPct >= 100 ? "bg-emerald-500" : "bg-blue-500"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="card p-4 space-y-2">
            <span className="mut text-xs uppercase tracking-wide">Expiry</span>
            <p className="font-semibold text-lg font-mono">
              #{proposal.expiresAtLedger.toLocaleString()}
            </p>
            <p className="text-xs mut">
              Wall-clock estimate:{" "}
              <span className="font-medium text-slate-200">
                {proposal.timeToExpiry || "—"}
              </span>
            </p>
          </div>

          <div className="card p-4 space-y-2">
            <span className="mut text-xs uppercase tracking-wide">Payload Hash</span>
            <p className="font-mono text-xs break-all text-slate-300">
              {proposal.payloadHash || "—"}
            </p>
          </div>

          <div className="card p-4 space-y-2">
            <span className="mut text-xs uppercase tracking-wide">Proposal Nonce</span>
            <p className="font-mono text-base font-bold text-slate-300">
              {proposal.nonce !== undefined ? String(proposal.nonce) : "—"}
            </p>
          </div>

          <div className="card p-4 space-y-2">
            <span className="mut text-xs uppercase tracking-wide">Creation Signer Set Hash</span>
            <p className="font-mono text-xs break-all text-slate-300">
              {proposal.proposalSignerSetHash || proposal.signerSetHash || "—"}
            </p>
          </div>

          <div className="card p-4 space-y-2">
            <span className="mut text-xs uppercase tracking-wide">Current Multisig Signer Set Hash</span>
            <p className="font-mono text-xs break-all text-slate-300">
              {proposal.currentSignerSetHash || "—"}
            </p>
          </div>
        </div>

        {/* Approvers List */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold mut">Current Approvers ({proposal.approvals.length})</h4>
          {proposal.approvals.length === 0 ? (
            <p className="text-xs mut">No approvals registered yet for this proposal.</p>
          ) : (
            <div className="space-y-1">
              {proposal.approvals.map((addr) => (
                <div
                  key={addr}
                  className="bg-[var(--bg)] p-2.5 rounded-lg border border-[var(--line)] text-xs font-mono flex items-center justify-between"
                >
                  <a
                    href={accountExplorer(addr)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 underline hover:text-blue-300"
                  >
                    {addr} ↗
                  </a>
                  <span className="text-emerald-400 font-sans font-medium text-xs">
                    Approved ✓
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Signer Actions Section */}
        <div className="pt-6 border-t border-[var(--line)] space-y-4">
          <h3 className="font-semibold text-lg">Signer Actions</h3>
          <p className="text-xs mut">
            Signers can approve, execute (when quorum reached), or cancel this proposal using connected Freighter wallet.
          </p>
          <ProposalActions proposal={proposal} onRefresh={handleRefresh} />
        </div>
      </div>
    </div>
  );
}
