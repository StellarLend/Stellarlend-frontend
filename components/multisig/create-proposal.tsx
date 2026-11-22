"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/wallet";
import { config } from "@/lib/config";
import {
  isSigner,
  buildProposalArgs,
  createProposal,
  ProposalActionType,
  ProposalActionParams,
  InvokeContractArgInput,
} from "@/lib/multisig/actions";
import { decodeScVal, decodeProposalAction } from "@/lib/multisig/decode";
import { parseMultisigError, MultisigActionStatus } from "@/lib/multisig/types";

export interface CreateProposalProps {
  contractId?: string;
  onRefresh?: () => void | Promise<void>;
  onCreated?: (proposalId: number | null) => void;
  isSignerOverride?: boolean;
  className?: string;
}

type ArgType = InvokeContractArgInput["type"];

interface ArgRow {
  id: number;
  type: ArgType;
  value: string;
  boolValue: boolean;
}

const ACTION_TYPES: { value: ProposalActionType; label: string; description: string }[] = [
  {
    value: "InvokeContract",
    label: "Invoke Contract",
    description: "Call a function on a target Soroban contract with typed arguments.",
  },
  {
    value: "SetThreshold",
    label: "Set Threshold",
    description: "Change the required number of signer approvals for quorum.",
  },
  {
    value: "RotateSigners",
    label: "Rotate Signers",
    description: "Replace the active multisig signer set with a new list of G-addresses.",
  },
];

export function CreateProposal({
  contractId = config.multisigId || config.lendingId,
  onRefresh,
  onCreated,
  isSignerOverride,
  className = "",
}: CreateProposalProps) {
  const { address } = useWallet();
  const router = useRouter();

  const [signerAuthorized, setSignerAuthorized] = useState<boolean>(
    typeof isSignerOverride === "boolean" ? isSignerOverride : false
  );
  const [actionType, setActionType] = useState<ProposalActionType>("InvokeContract");

  // InvokeContract fields
  const [targetContract, setTargetContract] = useState<string>("");
  const [functionName, setFunctionName] = useState<string>("");
  const [argRows, setArgRows] = useState<ArgRow[]>([]);
  const [nextArgId, setNextArgId] = useState<number>(1);

  // SetThreshold fields
  const [threshold, setThreshold] = useState<string>("2");

  // RotateSigners fields
  const [signersText, setSignersText] = useState<string>("");

  // Submission state
  const [status, setStatus] = useState<MultisigActionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const currentParams: ProposalActionParams = useMemo(() => {
    if (actionType === "SetThreshold") {
      return { threshold };
    }
    if (actionType === "RotateSigners") {
      const signers = signersText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return { signers };
    }
    const args: InvokeContractArgInput[] = argRows.map((row) => {
      if (row.type === "bool") {
        return { type: "bool", value: row.boolValue };
      }
      return { type: row.type, value: row.value } as InvokeContractArgInput;
    });
    return {
      contract: targetContract,
      functionName,
      args,
    };
  }, [actionType, threshold, signersText, targetContract, functionName, argRows]);

  const preview = useMemo(() => {
    try {
      const built = buildProposalArgs(actionType, currentParams);
      const decoded = decodeScVal(built);
      const decodedAction = decodeProposalAction(built);
      return {
        ok: true as const,
        formatted: decoded.formatted,
        summary: decodedAction.summary,
      };
    } catch (err: any) {
      return {
        ok: false as const,
        error: err?.message || "Invalid proposal parameters.",
      };
    }
  }, [actionType, currentParams]);

  // Must: Form rendered only when isSigner(address) is true
  if (!address || !signerAuthorized) {
    return null;
  }

  const addArgRow = () => {
    setArgRows((prev) => [
      ...prev,
      { id: nextArgId, type: "address", value: "", boolValue: true },
    ]);
    setNextArgId((n) => n + 1);
  };

  const updateArgRow = (id: number, patch: Partial<ArgRow>) => {
    setArgRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeArgRow = (id: number) => {
    setArgRows((prev) => prev.filter((r) => r.id !== id));
  };

  const isBusy = status === "simulating" || status === "submitting" || status === "polling";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview.ok || isBusy) return;

    setErrorMessage(null);
    setStatus("submitting");

    try {
      const res = await createProposal(actionType, currentParams, {
        signerAddress: address,
        contractId,
      });

      setStatus("confirmed");

      if (onRefresh) {
        await onRefresh();
      }
      if (onCreated) {
        onCreated(res.proposalId);
      }

      if (res.proposalId !== null) {
        router.push(`/multisig/${res.proposalId}`);
      }
    } catch (err: unknown) {
      setStatus("failed");
      setErrorMessage(parseMultisigError(err));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`card p-6 space-y-5 ${className}`}
      data-testid="create-proposal-form"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
        <div>
          <h2 className="text-lg font-bold">Create Proposal</h2>
          <p className="text-xs mut">
            Build, preview, and sign a new multisig governance proposal.
          </p>
        </div>
      </div>

      {/* Action Type Selector */}
      <div className="space-y-2">
        <label htmlFor="proposal-action-type" className="block text-xs font-semibold uppercase tracking-wider mut">
          Action Type
        </label>
        <select
          id="proposal-action-type"
          data-testid="action-type-select"
          value={actionType}
          onChange={(e) => {
            setActionType(e.target.value as ProposalActionType);
            setErrorMessage(null);
          }}
          disabled={isBusy}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-white focus:border-[var(--acc)] focus:outline-none"
        >
          {ACTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-xs mut">
          {ACTION_TYPES.find((t) => t.value === actionType)?.description}
        </p>
      </div>

      {/* Per-Type Parameter Fields */}
      {actionType === "InvokeContract" && (
        <div className="space-y-4" data-testid="fields-invoke-contract">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="invoke-contract-id" className="block text-xs font-medium mut">
                Target Contract Address (C...)
              </label>
              <input
                id="invoke-contract-id"
                data-testid="input-contract-address"
                type="text"
                value={targetContract}
                onChange={(e) => setTargetContract(e.target.value)}
                placeholder="C..."
                disabled={isBusy}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-white focus:border-[var(--acc)] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="invoke-function-name" className="block text-xs font-medium mut">
                Function Name
              </label>
              <input
                id="invoke-function-name"
                data-testid="input-function-name"
                type="text"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                placeholder="e.g. set_pause"
                disabled={isBusy}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-white focus:border-[var(--acc)] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium mut">Arguments ({argRows.length})</span>
              <button
                type="button"
                onClick={addArgRow}
                disabled={isBusy}
                data-testid="btn-add-arg"
                className="btn-ghost text-xs px-2.5 py-1 rounded border border-[var(--line)]"
              >
                + Add Argument
              </button>
            </div>

            {argRows.map((row, idx) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2.5"
                data-testid={`arg-row-${idx}`}
              >
                <select
                  aria-label={`Argument ${idx + 1} type`}
                  data-testid={`arg-type-${idx}`}
                  value={row.type}
                  onChange={(e) => updateArgRow(row.id, { type: e.target.value as ArgType })}
                  disabled={isBusy}
                  className="rounded border border-[var(--line)] bg-[var(--card)] px-2 py-1.5 text-xs text-white"
                >
                  <option value="address">Address (G.../C...)</option>
                  <option value="amount">Amount (i128 base units)</option>
                  <option value="u32">u32</option>
                  <option value="u64">u64</option>
                  <option value="bool">bool</option>
                  <option value="symbol">Symbol</option>
                  <option value="string">String</option>
                </select>

                {row.type === "bool" ? (
                  <select
                    aria-label={`Argument ${idx + 1} value`}
                    data-testid={`arg-value-${idx}`}
                    value={row.boolValue ? "true" : "false"}
                    onChange={(e) => updateArgRow(row.id, { boolValue: e.target.value === "true" })}
                    disabled={isBusy}
                    className="flex-1 rounded border border-[var(--line)] bg-[var(--card)] px-2.5 py-1.5 font-mono text-xs text-white"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    aria-label={`Argument ${idx + 1} value`}
                    data-testid={`arg-value-${idx}`}
                    type="text"
                    value={row.value}
                    onChange={(e) => updateArgRow(row.id, { value: e.target.value })}
                    placeholder={
                      row.type === "address"
                        ? "G... or C..."
                        : row.type === "amount"
                        ? "e.g. 100.5"
                        : "Value"
                    }
                    disabled={isBusy}
                    className="flex-1 rounded border border-[var(--line)] bg-[var(--card)] px-2.5 py-1.5 font-mono text-xs text-white"
                  />
                )}

                <button
                  type="button"
                  onClick={() => removeArgRow(row.id)}
                  disabled={isBusy}
                  data-testid={`btn-remove-arg-${idx}`}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                  aria-label={`Remove argument ${idx + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {actionType === "SetThreshold" && (
        <div className="space-y-1" data-testid="fields-set-threshold">
          <label htmlFor="proposal-threshold" className="block text-xs font-medium mut">
            New Quorum Threshold (u32 ≥ 1)
          </label>
          <input
            id="proposal-threshold"
            data-testid="input-threshold"
            type="number"
            min={1}
            step={1}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            disabled={isBusy}
            className="w-full max-w-xs rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-white focus:border-[var(--acc)] focus:outline-none"
          />
        </div>
      )}

      {actionType === "RotateSigners" && (
        <div className="space-y-1" data-testid="fields-rotate-signers">
          <label htmlFor="proposal-signers" className="block text-xs font-medium mut">
            New Signer Addresses (one G-address per line)
          </label>
          <textarea
            id="proposal-signers"
            data-testid="input-signers"
            rows={4}
            value={signersText}
            onChange={(e) => setSignersText(e.target.value)}
            placeholder={"G...\nG..."}
            disabled={isBusy}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-white focus:border-[var(--acc)] focus:outline-none"
          />
        </div>
      )}

      {/* Decoded Preview */}
      <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4">
        <span className="block text-xs font-semibold uppercase tracking-wider mut">
          Decoded Payload Preview
        </span>
        {preview.ok ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-200" data-testid="proposal-summary-preview">
              {preview.summary}
            </div>
            <pre
              className="overflow-x-auto rounded-lg border border-[var(--line)] bg-black/30 p-2.5 font-mono text-xs text-teal-300"
              data-testid="proposal-decoded-preview"
            >
              {preview.formatted}
            </pre>
          </div>
        ) : (
          <div className="text-xs text-amber-400" data-testid="proposal-validation-error">
            {preview.error}
          </div>
        )}
      </div>

      {/* Contract / Submission Error */}
      {errorMessage && (
        <div
          className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-xs text-red-300"
          data-testid="create-proposal-error"
        >
          <span className="font-semibold">Error: </span>
          {errorMessage}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          data-testid="btn-submit-proposal"
          disabled={!preview.ok || isBusy}
          className="btn px-5 py-2 text-sm font-semibold"
        >
          {isBusy ? "Signing & Submitting..." : "Sign & Create Proposal"}
        </button>
      </div>
    </form>
  );
}
