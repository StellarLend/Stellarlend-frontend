"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useWallet } from "@/components/wallet";
import { Proposal, parseMultisigError, MultisigActionStatus } from "@/lib/multisig/types";
import {
  isSigner,
  approveProposal,
  executeProposal,
  batchExecuteProposals,
  cancelProposal,
} from "@/lib/multisig/actions";
import { config, txExplorer } from "@/lib/config";

export interface ProposalActionsProps {
  proposal: Proposal;
  onRefresh?: () => void | Promise<void>;
  contractId?: string;
  className?: string;
  isSignerOverride?: boolean;
}

export function ProposalActions({
  proposal,
  onRefresh,
  contractId = config.multisigId || config.lendingId,
  className = "",
  isSignerOverride,
}: ProposalActionsProps) {
  const { address } = useWallet();
  const [signerAuthorized, setSignerAuthorized] = useState<boolean>(false);
  const [checkingRole, setCheckingRole] = useState<boolean>(false);

  // Modal & execution state
  const [activeModalAction, setActiveModalAction] = useState<"approve" | "execute" | "cancel" | null>(null);
  const [status, setStatus] = useState<MultisigActionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check signer role whenever address or contractId changes
  useEffect(() => {
    if (typeof isSignerOverride === "boolean") {
      setSignerAuthorized(isSignerOverride);
      return;
    }

    if (!address) {
      setSignerAuthorized(false);
      return;
    }

    let isMounted = true;
    setCheckingRole(true);

    isSigner(address, contractId)
      .then((authorized) => {
        if (isMounted) setSignerAuthorized(authorized);
      })
      .catch(() => {
        if (isMounted) setSignerAuthorized(false);
      })
      .finally(() => {
        if (isMounted) setCheckingRole(false);
      });

    return () => {
      isMounted = false;
    };
  }, [address, contractId, isSignerOverride]);

  const hasAlreadyApproved = useMemo(() => {
    if (!address) return false;
    return proposal.approvals.some((a) => a.toLowerCase() === address.toLowerCase());
  }, [address, proposal.approvals]);

  const canApprove =
    signerAuthorized &&
    proposal.status === "Active" &&
    !hasAlreadyApproved &&
    status !== "submitting" &&
    status !== "polling";

  const canExecute =
    signerAuthorized &&
    proposal.status === "Passed" &&
    status !== "submitting" &&
    status !== "polling";

  const canCancel =
    signerAuthorized &&
    (proposal.status === "Active" || proposal.status === "Passed") &&
    status !== "submitting" &&
    status !== "polling";

  const handleAction = async () => {
    if (!activeModalAction || !address) return;

    setErrorMessage(null);
    setTxHash(null);

    try {
      if (activeModalAction === "approve") {
        setStatus("simulating");
        setStatusMessage("Simulating transaction and cross-checking domain binding...");
        const res = await approveProposal(proposal.id, {
          signerAddress: address,
          contractId,
          signerSetHash: proposal.signerSetHash,
        });
        setTxHash(res.txHash);
        setStatus("confirmed");
        setStatusMessage("Proposal approval confirmed on Stellar!");
      } else if (activeModalAction === "execute") {
        setStatus("submitting");
        setStatusMessage("Executing proposal on Soroban...");
        const res = await executeProposal(proposal.id, proposal.payloadHash, {
          signerAddress: address,
          contractId,
        });
        setTxHash(res.txHash);
        setStatus("confirmed");
        setStatusMessage("Proposal successfully executed!");
      } else if (activeModalAction === "cancel") {
        setStatus("submitting");
        setStatusMessage("Cancelling proposal on Soroban...");
        const res = await cancelProposal(proposal.id, {
          signerAddress: address,
          contractId,
        });
        setTxHash(res.txHash);
        setStatus("confirmed");
        setStatusMessage("Proposal cancelled.");
      }

      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      setStatus("failed");
      const mapped = parseMultisigError(err);
      setErrorMessage(mapped);
    }
  };

  const closeModal = () => {
    if (status === "submitting" || status === "polling") return;
    setActiveModalAction(null);
    setStatus("idle");
    setStatusMessage("");
  };

  return (
    <div className={`space-y-4 ${className}`} data-testid="proposal-actions">
      {!address && (
        <div className="card p-3 text-xs mut flex items-center justify-between" data-testid="wallet-notice">
          <span>Connect Freighter wallet to sign governance proposals</span>
        </div>
      )}

      {address && !checkingRole && !signerAuthorized && (
        <div
          className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-300"
          data-testid="unauthorized-signer-notice"
        >
          Connected address ({address.slice(0, 4)}...{address.slice(-4)}) is not an authorized multisig signer.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="btn-approve"
          disabled={!canApprove}
          onClick={() => {
            setActiveModalAction("approve");
            setStatus("idle");
            setErrorMessage(null);
          }}
          className="btn text-sm px-4 py-2"
          title={hasAlreadyApproved ? "Connected wallet already approved this proposal" : "Approve proposal"}
        >
          {hasAlreadyApproved ? "Approved ✓" : "Approve"}
        </button>

        <button
          type="button"
          data-testid="btn-execute"
          disabled={!canExecute}
          onClick={() => {
            setActiveModalAction("execute");
            setStatus("idle");
            setErrorMessage(null);
          }}
          className="btn text-sm px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold"
          title={proposal.status !== "Passed" ? "Proposal must reach quorum before execution" : "Execute proposal"}
        >
          Execute
        </button>

        <button
          type="button"
          data-testid="btn-cancel"
          disabled={!canCancel}
          onClick={() => {
            setActiveModalAction("cancel");
            setStatus("idle");
            setErrorMessage(null);
          }}
          className="btn-ghost text-sm px-4 py-2 text-red-400 hover:border-red-400"
          title="Cancel proposal"
        >
          Cancel
        </button>
      </div>

      {/* Confirmation Modal */}
      {activeModalAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          data-testid="action-confirmation-modal"
        >
          <div className="card max-w-lg w-full p-6 space-y-4 border border-[var(--line)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="text-lg font-bold capitalize">
                Confirm {activeModalAction} Proposal #{proposal.id}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                disabled={status === "submitting" || status === "polling"}
                className="text-gray-400 hover:text-white"
                data-testid="modal-close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-[var(--bg)] p-3 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="mut">Proposer:</span>
                  <span className="font-mono text-xs">{proposal.proposer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="mut">Current Status:</span>
                  <span className="font-semibold">{proposal.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="mut">Approvals:</span>
                  <span>{proposal.approvals.length} registered</span>
                </div>
                {activeModalAction === "execute" && (
                  <div className="flex justify-between">
                    <span className="mut">Payload Hash:</span>
                    <span className="font-mono text-xs break-all">{proposal.payloadHash}</span>
                  </div>
                )}
              </div>

              {activeModalAction === "approve" && (
                <div className="rounded border border-teal-900/40 bg-teal-950/20 p-3 text-xs text-teal-300">
                  <p className="font-semibold mb-1">Domain-bound Authorization Security:</p>
                  <p className="mut">
                    The transaction simulation will produce a domain-bound authorization entry. StellarLend cross-checks
                    the canonical preimage hash (<code>STELLARLEND_MULTISIG_APPROVAL_V1</code>) locally before opening
                    Freighter to guarantee zero authorization spoofing.
                  </p>
                </div>
              )}

              {activeModalAction === "execute" && (
                <div className="rounded border border-indigo-900/40 bg-indigo-950/20 p-3 text-xs text-indigo-300">
                  <p className="font-semibold mb-1">Execution Notice:</p>
                  <p className="mut">
                    This action dispatches the stored proposal payload to on-chain contracts. Once executed, state changes
                    are final and immutable.
                  </p>
                </div>
              )}

              {activeModalAction === "cancel" && (
                <div className="rounded border border-red-900/40 bg-red-950/20 p-3 text-xs text-red-300">
                  <p className="font-semibold mb-1">Cancellation Warning:</p>
                  <p className="mut">
                    Cancelling this proposal will permanently invalidate all pending approvals and mark it as Cancelled.
                  </p>
                </div>
              )}

              {statusMessage && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium ${
                    status === "confirmed"
                      ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800"
                      : "bg-blue-950/40 text-blue-300 border border-blue-800"
                  }`}
                  data-testid="status-message"
                >
                  {statusMessage}
                  {txHash && (
                    <div className="mt-2">
                      <a
                        href={txExplorer(txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-emerald-400 hover:text-emerald-300"
                      >
                        View confirmed transaction on StellarExpert ↗
                      </a>
                    </div>
                  )}
                </div>
              )}

              {errorMessage && (
                <div
                  className="p-3 rounded-lg text-xs bg-red-950/40 text-red-300 border border-red-800"
                  data-testid="error-message"
                >
                  <span className="font-semibold">Error: </span>
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={closeModal}
                disabled={status === "submitting" || status === "polling"}
                className="btn-ghost text-sm px-4 py-2"
                data-testid="btn-modal-cancel"
              >
                {status === "confirmed" ? "Close" : "Cancel"}
              </button>

              {status !== "confirmed" && (
                <button
                  type="button"
                  onClick={handleAction}
                  disabled={status === "submitting" || status === "polling"}
                  className="btn text-sm px-5 py-2 font-semibold"
                  data-testid="btn-modal-confirm"
                >
                  {status === "submitting" || status === "polling" || status === "simulating"
                    ? "Processing..."
                    : `Confirm & Sign with Freighter`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface BatchProposalActionsProps {
  proposals: Proposal[];
  onRefresh?: () => void | Promise<void>;
  contractId?: string;
  className?: string;
  isSignerOverride?: boolean;
}

export function BatchProposalActions({
  proposals,
  onRefresh,
  contractId = config.multisigId || config.lendingId,
  className = "",
  isSignerOverride,
}: BatchProposalActionsProps) {
  const { address } = useWallet();
  const [signerAuthorized, setSignerAuthorized] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [status, setStatus] = useState<MultisigActionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof isSignerOverride === "boolean") {
      setSignerAuthorized(isSignerOverride);
      return;
    }
    if (!address) {
      setSignerAuthorized(false);
      return;
    }
    let isMounted = true;
    isSigner(address, contractId)
      .then((ok) => {
        if (isMounted) setSignerAuthorized(ok);
      })
      .catch(() => {
        if (isMounted) setSignerAuthorized(false);
      });
    return () => {
      isMounted = false;
    };
  }, [address, contractId, isSignerOverride]);

  const passedProposals = useMemo(() => {
    return proposals.filter((p) => p.status === "Passed");
  }, [proposals]);

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
      setErrorMessage(null);
    } else {
      if (selectedIds.length >= 32) {
        setErrorMessage("Batch size exceeded: maximum 32 proposals per batch execution.");
        return;
      }
      setSelectedIds([...selectedIds, id]);
      setErrorMessage(null);
    }
  };

  const handleBatchExecute = async () => {
    if (!address || selectedIds.length === 0) return;
    if (selectedIds.length > 32) {
      setErrorMessage("Batch size exceeded: maximum 32 proposals per batch execution.");
      return;
    }

    setErrorMessage(null);
    setTxHash(null);
    setStatus("submitting");
    setStatusMessage("Submitting atomic batch execution to Soroban...");

    try {
      const selectedProposals = passedProposals.filter((p) => selectedIds.includes(p.id));
      const hashes = selectedProposals.map((p) => p.payloadHash);

      const res = await batchExecuteProposals(selectedIds, hashes, {
        signerAddress: address,
        contractId,
      });

      setTxHash(res.txHash);
      setStatus("confirmed");
      setStatusMessage(`Successfully executed batch of ${selectedIds.length} proposals atomically!`);
      setSelectedIds([]);

      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      setStatus("failed");
      setErrorMessage(parseMultisigError(err));
    }
  };

  return (
    <div className={`space-y-4 ${className}`} data-testid="batch-proposal-actions">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">Batch Execution (Atomic)</h3>
          <p className="text-xs mut">
            Select up to 32 Passed proposals to execute atomically in a single signature transaction.
          </p>
        </div>

        <button
          type="button"
          data-testid="btn-batch-execute-open"
          disabled={!signerAuthorized || selectedIds.length === 0 || selectedIds.length > 32}
          onClick={() => {
            setIsModalOpen(true);
            setStatus("idle");
            setErrorMessage(null);
          }}
          className="btn text-sm px-4 py-2 font-semibold"
        >
          Execute Selected ({selectedIds.length})
        </button>
      </div>

      {passedProposals.length === 0 ? (
        <div className="card p-4 text-xs mut text-center">No proposals currently in Passed status for batch execution.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[500px]">
            <thead className="mut border-b border-[var(--line)]">
              <tr>
                <th className="p-3 w-10">Select</th>
                <th className="p-3">ID</th>
                <th className="p-3">Proposer</th>
                <th className="p-3">Payload Hash</th>
                <th className="p-3">Approvals</th>
              </tr>
            </thead>
            <tbody>
              {passedProposals.map((p) => {
                const isSelected = selectedIds.includes(p.id);
                const isLimitReached = selectedIds.length >= 32 && !isSelected;
                return (
                  <tr key={p.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--line)]/20">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!signerAuthorized || isLimitReached}
                        onChange={() => toggleSelect(p.id)}
                        className="cursor-pointer"
                        data-testid={`checkbox-proposal-${p.id}`}
                      />
                    </td>
                    <td className="p-3 font-semibold">#{p.id}</td>
                    <td className="p-3 font-mono text-xs">{p.proposer.slice(0, 6)}...{p.proposer.slice(-4)}</td>
                    <td className="p-3 font-mono text-xs">{p.payloadHash.slice(0, 10)}...</td>
                    <td className="p-3 text-xs">{p.approvals.length} signers</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedIds.length >= 32 && (
        <div className="text-xs text-amber-400 p-2" data-testid="batch-limit-warning">
          Maximum batch limit (32 proposals) reached.
        </div>
      )}

      {/* Batch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="card max-w-lg w-full p-6 space-y-4 border border-[var(--line)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="text-lg font-bold">Confirm Atomic Batch Execution</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={status === "submitting" || status === "polling"}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <p className="mut text-xs">
                You are about to execute <b>{selectedIds.length}</b> proposals atomically in a single Soroban transaction:
              </p>
              <div className="bg-[var(--bg)] p-3 rounded-lg max-h-40 overflow-y-auto font-mono text-xs space-y-1">
                {selectedIds.map((id) => (
                  <div key={id} className="flex justify-between">
                    <span>Proposal #{id}</span>
                    <span className="mut">Passed</span>
                  </div>
                ))}
              </div>

              <div className="rounded border border-indigo-900/40 bg-indigo-950/20 p-3 text-xs text-indigo-300">
                <p className="font-semibold mb-1">Atomic All-or-Nothing Guarantee:</p>
                <p className="mut">
                  If any single proposal in this batch fails execution or payload mismatch on-chain, all proposals revert
                  completely without partial state change.
                </p>
              </div>

              {statusMessage && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium ${
                    status === "confirmed"
                      ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800"
                      : "bg-blue-950/40 text-blue-300 border border-blue-800"
                  }`}
                  data-testid="batch-status-message"
                >
                  {statusMessage}
                  {txHash && (
                    <div className="mt-2">
                      <a
                        href={txExplorer(txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-emerald-400 hover:text-emerald-300"
                      >
                        View confirmed transaction on StellarExpert ↗
                      </a>
                    </div>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-lg text-xs bg-red-950/40 text-red-300 border border-red-800">
                  <span className="font-semibold">Error: </span>
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={status === "submitting" || status === "polling"}
                className="btn-ghost text-sm px-4 py-2"
              >
                {status === "confirmed" ? "Close" : "Cancel"}
              </button>

              {status !== "confirmed" && (
                <button
                  type="button"
                  onClick={handleBatchExecute}
                  disabled={status === "submitting" || status === "polling" || selectedIds.length === 0}
                  className="btn text-sm px-5 py-2 font-semibold"
                  data-testid="btn-batch-modal-confirm"
                >
                  {status === "submitting" || status === "polling" ? "Processing..." : `Execute Batch (${selectedIds.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
