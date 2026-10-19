"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Proposal } from "@/lib/multisig/types";
import { getProposals, saveProposals, INITIAL_PROPOSALS } from "@/lib/multisig/data";
import { ProposalActions } from "./proposal-actions";
import { explorer, config } from "@/lib/config";

export function ProposalDetail({ id }: { id: number }) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadProposal = useCallback(() => {
    const list = getProposals();
    const found = list.find((p) => p.id === id) || INITIAL_PROPOSALS.find((p) => p.id === id) || null;
    setProposal(found);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadProposal();
  }, [loadProposal]);

  const handleRefresh = async () => {
    loadProposal();
  };

  if (loading) {
    return <div className="p-8 text-center mut">Loading proposal #{id}...</div>;
  }

  if (!proposal) {
    return (
      <div className="space-y-4">
        <Link href="/multisig" className="btn-ghost text-xs">
          ← Back to Multisig Governance
        </Link>
        <div className="card p-8 text-center space-y-3">
          <h2 className="text-xl font-bold">Proposal #{id} Not Found</h2>
          <p className="text-sm mut">The requested proposal could not be retrieved.</p>
        </div>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    Active: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    Passed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    Executed: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    Cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
    Expired: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto" data-testid="proposal-detail-page">
      <div className="flex items-center justify-between">
        <Link href="/multisig" className="btn-ghost text-xs">
          ← Back to Multisig Proposals
        </Link>
        <div className="text-xs mut">
          Multisig Contract:{" "}
          {config.multisigId ? (
            <a href={explorer(config.multisigId)} target="_blank" rel="noreferrer" className="underline font-mono">
              {config.multisigId.slice(0, 6)}...{config.multisigId.slice(-4)}
            </a>
          ) : (
            <span className="font-mono">Demo Mode</span>
          )}
        </div>
      </div>

      <div className="card p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold">Proposal #{proposal.id}</h1>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  statusColor[proposal.status] || "bg-gray-500/10 text-gray-400"
                }`}
                data-testid="proposal-status-badge"
              >
                {proposal.status}
              </span>
            </div>
            <p className="mut mt-2 text-sm">
              Proposed by <span className="font-mono text-xs text-[var(--fg)]">{proposal.proposer}</span>
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Proposed Action</h3>
          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--line)] font-mono text-sm">
            {typeof proposal.action === "string" ? proposal.action : JSON.stringify(proposal.action, null, 2)}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-4 space-y-2">
            <span className="mut text-xs uppercase tracking-wide">Payload Hash</span>
            <p className="font-mono text-xs break-all text-slate-300">{proposal.payloadHash}</p>
          </div>

          <div className="card p-4 space-y-2">
            <span className="mut text-xs uppercase tracking-wide">Signer Set Hash</span>
            <p className="font-mono text-xs break-all text-slate-300">{proposal.signerSetHash}</p>
          </div>

          <div className="card p-4 space-y-2">
            <span className="mut text-xs uppercase tracking-wide">Quorum Approvals</span>
            <p className="font-semibold text-lg">
              {proposal.approvals.length} / {proposal.threshold || 2} <span className="text-xs mut font-normal">signers approved</span>
            </p>
          </div>

          <div className="card p-4 space-y-2">
            <span className="mut text-xs uppercase tracking-wide">Expires At Ledger</span>
            <p className="font-semibold text-lg">#{proposal.expiresAtLedger.toLocaleString()}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold mut">Current Approvers</h4>
          {proposal.approvals.length === 0 ? (
            <p className="text-xs mut">No approvals registered yet.</p>
          ) : (
            <div className="space-y-1">
              {proposal.approvals.map((addr) => (
                <div key={addr} className="bg-[var(--bg)] p-2 rounded text-xs font-mono flex items-center justify-between">
                  <span>{addr}</span>
                  <span className="text-emerald-400">Approved ✓</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Signer Actions Section */}
        <div className="pt-6 border-t border-[var(--line)] space-y-4">
          <h3 className="font-semibold text-lg">Signer Actions</h3>
          <p className="text-xs mut">
            Signers can approve, execute (when passed), or cancel this proposal using connected Freighter wallet.
          </p>
          <ProposalActions proposal={proposal} onRefresh={handleRefresh} />
        </div>
      </div>
    </div>
  );
}
