"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Proposal } from "@/lib/multisig/types";
import { getProposals, saveProposals, INITIAL_PROPOSALS } from "@/lib/multisig/data";
import { BatchProposalActions } from "./proposal-actions";
import { config, explorer } from "@/lib/config";

export function MultisigApp() {
  const [proposals, setProposals] = useState<Proposal[]>(INITIAL_PROPOSALS);
  const [filter, setFilter] = useState<string>("All");

  const loadData = () => {
    const list = getProposals();
    setProposals(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = proposals.filter((p) => {
    if (filter === "All") return true;
    return p.status === filter;
  });

  const statusColor: Record<string, string> = {
    Active: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    Passed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    Executed: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    Cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
    Expired: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  };

  return (
    <div className="space-y-8" data-testid="multisig-governance-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Multisig Governance</h1>
          <p className="mut mt-1 text-sm">
            Approve, execute, batch-execute and cancel governance proposals with Freighter signer keys.
          </p>
        </div>
        <div className="text-xs mut">
          Multisig Contract:{" "}
          {config.multisigId ? (
            <a href={explorer(config.multisigId)} target="_blank" rel="noreferrer" className="underline font-mono">
              {config.multisigId}
            </a>
          ) : (
            <span className="font-mono">Demo Mode</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {["All", "Active", "Passed", "Executed", "Cancelled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg border font-medium ${
              filter === f ? "border-[var(--acc)] text-white bg-[var(--acc)]/10" : "border-[var(--line)] text-gray-400 hover:text-white"
            }`}
          >
            {f} ({f === "All" ? proposals.length : proposals.filter((x) => x.status === f).length})
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[650px]">
          <thead className="mut border-b border-[var(--line)]">
            <tr>
              <th className="p-4">Proposal</th>
              <th className="p-4">Action Summary</th>
              <th className="p-4">Status</th>
              <th className="p-4">Approvals</th>
              <th className="p-4">Payload Hash</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--line)]/20">
                <td className="p-4 font-bold">#{p.id}</td>
                <td className="p-4 text-xs font-mono max-w-xs truncate">
                  {typeof p.action === "string" ? p.action : JSON.stringify(p.action)}
                </td>
                <td className="p-4">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColor[p.status] || ""}`}>
                    {p.status}
                  </span>
                </td>
                <td className="p-4 text-xs">
                  {p.approvals.length} / {p.threshold || 2} signers
                </td>
                <td className="p-4 font-mono text-xs text-gray-400">
                  {p.payloadHash.slice(0, 10)}...
                </td>
                <td className="p-4 text-right">
                  <Link href={`/multisig/${p.id}`} className="btn-ghost text-xs">
                    View & Sign →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-6">
        <BatchProposalActions proposals={proposals} onRefresh={loadData} />
      </div>
    </div>
  );
}
