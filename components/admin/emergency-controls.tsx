"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useWallet } from "@/components/wallet";
import { config, txExplorer } from "@/lib/config";
import {
  type AdminRole,
  type PauseType,
  type EmergencyState,
  PAUSE_TYPES,
  getAllowedTransitions,
  computeRole,
  hoursToLedgers,
  computeExpiresAtLedger,
  getAdmin,
  getGuardian,
  getContractEmergencyData,
  setPause,
  setEmergencyState,
} from "@/lib/admin";
import { getRpcServer } from "@/lib/tx";
import type { rpc } from "@stellar/stellar-sdk";

export interface EmergencyControlsProps {
  initialAdmin?: string | null;
  initialGuardian?: string | null;
  connectedAddress?: string | null;
  customRpcServer?: rpc.Server;
  freighterSigner?: any;
}

export function EmergencyControls({
  initialAdmin,
  initialGuardian,
  connectedAddress,
  customRpcServer,
  freighterSigner,
}: EmergencyControlsProps = {}) {
  const t = useTranslations("adminEmergency");
  const wallet = useWallet();
  const address = connectedAddress !== undefined ? connectedAddress : wallet.address;

  const [loadingCredentials, setLoadingCredentials] = useState(true);
  const [adminAddress, setAdminAddress] = useState<string | null>(initialAdmin ?? null);
  const [guardianAddress, setGuardianAddress] = useState<string | null>(initialGuardian ?? null);

  const [emergencyState, setEmergencyStateVal] = useState<EmergencyState>("Normal");
  const [pauseStates, setPauseStates] = useState<
    Record<PauseType, { paused: boolean; expiresAtLedger?: number }>
  >({
    All: { paused: false },
    Deposit: { paused: false },
    Withdraw: { paused: false },
    Borrow: { paused: false },
    Repay: { paused: false },
    Liquidation: { paused: false },
    FlashLoan: { paused: false },
  });
  const [currentLedger, setCurrentLedger] = useState<number>(0);

  // Pause Form State
  const [selectedPauseType, setSelectedPauseType] = useState<PauseType>("All");
  const [isPauseEnabled, setIsPauseEnabled] = useState<boolean>(true);
  const [ttlHours, setTtlHours] = useState<number>(24);

  // Emergency Form State
  const [selectedEmergencyState, setSelectedEmergencyState] = useState<EmergencyState>("Shutdown");

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: "pause" | "emergency";
    target: string;
    args: Record<string, any>;
    phraseToMatch?: string;
  }>({
    open: false,
    type: "pause",
    target: "",
    args: {},
  });
  const [confirmInput, setConfirmInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const rpcServer = getRpcServer(customRpcServer);

  // Compute on-chain authorized role
  const role: AdminRole = computeRole(address, adminAddress, guardianAddress);
  const allowedTransitions = getAllowedTransitions(role);

  // Re-fetch credentials & on-chain state
  const refreshOnChainState = useCallback(async () => {
    try {
      const [admin, guardian, latestLedgerRes, emergencyData] = await Promise.all([
        getAdmin(config.lendingId, rpcServer),
        getGuardian(config.lendingId, rpcServer),
        rpcServer.getLatestLedger().catch(() => null),
        getContractEmergencyData(config.lendingId, rpcServer),
      ]);

      if (admin !== null) setAdminAddress(admin);
      if (guardian !== null) setGuardianAddress(guardian);
      if (latestLedgerRes?.sequence) setCurrentLedger(latestLedgerRes.sequence);

      setEmergencyStateVal(emergencyData.emergencyState);
      setPauseStates(emergencyData.pauseStates);
    } catch {
      // keep prior state
    } finally {
      setLoadingCredentials(false);
    }
  }, [rpcServer]);

  useEffect(() => {
    refreshOnChainState();
  }, [refreshOnChainState]);

  // Adjust default selectedEmergencyState when role changes
  useEffect(() => {
    if (allowedTransitions.length > 0 && !allowedTransitions.includes(selectedEmergencyState)) {
      setSelectedEmergencyState(allowedTransitions[0]);
    }
  }, [allowedTransitions, selectedEmergencyState]);

  // Derived pause TTL ledgers and expiry
  const computedTtlLedgers = isPauseEnabled ? hoursToLedgers(ttlHours) : 0;
  const computedExpiryLedger = computeExpiresAtLedger(currentLedger, computedTtlLedgers);

  // Handling Pause submission click
  const handleOpenPauseConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setLastTxHash(null);
    setConfirmInput("");

    const requiresTyped = selectedPauseType === "All" && isPauseEnabled;
    setConfirmModal({
      open: true,
      type: "pause",
      target: selectedPauseType,
      args: {
        pause_type: selectedPauseType,
        paused: isPauseEnabled,
        ttl_ledgers: computedTtlLedgers,
        estimated_expiry_ledger: computedExpiryLedger,
      },
      phraseToMatch: requiresTyped ? t("confirmPhraseAll") : undefined,
    });
  };

  // Handling Emergency transition submission click
  const handleOpenEmergencyConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setLastTxHash(null);
    setConfirmInput("");

    const requiresTyped = selectedEmergencyState === "Shutdown";
    setConfirmModal({
      open: true,
      type: "emergency",
      target: selectedEmergencyState,
      args: {
        state: selectedEmergencyState,
      },
      phraseToMatch: requiresTyped ? t("confirmPhraseShutdown") : undefined,
    });
  };

  // Pre-signing role guard: re-verifies address role against on-chain authority
  const verifyCallerRole = async () => {
    const [latestAdmin, latestGuardian] = await Promise.all([
      getAdmin(config.lendingId, rpcServer),
      getGuardian(config.lendingId, rpcServer),
    ]);

    const activeRole = computeRole(address, latestAdmin, latestGuardian);
    if (activeRole === "none") {
      throw new Error(t("accessDeniedSubtitle"));
    }
    if (confirmModal.type === "emergency" && activeRole === "guardian" && selectedEmergencyState !== "Shutdown") {
      throw new Error(t("guardianRestrictionNote"));
    }
  };

  // Confirm and Execute Tx
  const handleExecuteConfirmedAction = async () => {
    if (confirmModal.phraseToMatch && confirmInput.trim() !== confirmModal.phraseToMatch) {
      return;
    }

    if (!address) {
      setActionError(t("connectPrompt"));
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    const txOptions = {
      signerAddress: address,
      contractId: config.lendingId,
      customRpcServer: rpcServer,
      freighterSigner,
      verifyCallerRole,
    };

    try {
      let res: { txHash: string };
      if (confirmModal.type === "pause") {
        res = await setPause(
          selectedPauseType,
          isPauseEnabled,
          computedTtlLedgers,
          txOptions
        );
      } else {
        res = await setEmergencyState(selectedEmergencyState, txOptions);
      }

      setLastTxHash(res.txHash);
      setConfirmModal((prev) => ({ ...prev, open: false }));
      await refreshOnChainState();
    } catch (err: any) {
      setActionError(err?.message || "Transaction execution failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingCredentials) {
    return (
      <div className="card max-w-4xl mx-auto p-8 text-center space-y-4">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full mx-auto" />
        <p className="text-zinc-400 text-sm">{t("checkingPermissions")}</p>
      </div>
    );
  }

  // 403 Access Denied view for non-admin / non-guardian
  if (role === "none") {
    return (
      <div className="card max-w-2xl mx-auto p-8 border border-red-500/30 bg-red-950/20 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 text-red-400 text-2xl font-bold">
          !
        </div>
        <h1 className="text-2xl font-bold text-red-400">{t("accessDeniedTitle")}</h1>
        <p className="text-zinc-300 text-sm">{t("accessDeniedSubtitle")}</p>
        {!address && <p className="text-xs text-zinc-400">{t("connectPrompt")}</p>}
        {address && (
          <p className="text-xs font-mono bg-black/40 py-2 px-3 rounded inline-block text-zinc-400">
            {address}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header with verified role badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--line)] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {t("title")}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{t("roleLabel")}:</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${
              role === "admin"
                ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
            }`}
          >
            {role === "admin" ? t("adminRole") : t("guardianRole")}
          </span>
        </div>
      </div>

      {/* Global Status Banner & Refresh result */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 space-y-2">
          <span className="text-xs text-zinc-400 font-medium">{t("emergencyStateLabel")}</span>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                emergencyState === "Normal"
                  ? "bg-emerald-400 animate-pulse"
                  : emergencyState === "Recovery"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-red-500 animate-pulse"
              }`}
            />
            <span className="text-xl font-bold text-white">{emergencyState}</span>
          </div>
        </div>

        <div className="card p-5 space-y-2">
          <span className="text-xs text-zinc-400 font-medium">{t("currentLedgerLabel")}</span>
          <div className="text-xl font-mono font-bold text-white">
            {currentLedger > 0 ? currentLedger.toLocaleString() : "..."}
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {actionError && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-sm flex items-start gap-3">
          <span className="font-bold">{"Error:"}</span>
          <span>{actionError}</span>
        </div>
      )}

      {lastTxHash && (
        <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-sm space-y-2">
          <div className="font-semibold">{t("txSuccessTitle")}</div>
          <div className="text-xs font-mono break-all">
            {t("txHashLabel")}: {lastTxHash}
          </div>
          <div>
            <a
              href={txExplorer(lastTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
            >
              {t("viewExplorer")} &rarr;
            </a>
          </div>
        </div>
      )}

      {/* Active Pause States Overview */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">{t("pauseStatusTitle")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {PAUSE_TYPES.map((type) => {
            const isPaused = pauseStates[type]?.paused;
            return (
              <div
                key={type}
                className={`p-3 rounded border text-center space-y-1 ${
                  isPaused
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400"
                }`}
              >
                <div className="text-xs font-bold">{type}</div>
                <div className="text-[10px] font-medium">
                  {isPaused ? "PAUSED" : "ACTIVE"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Granular Pause Form */}
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white">{t("pauseControlsTitle")}</h2>
            <p className="text-xs text-zinc-400 mt-1">{t("pauseControlsSubtitle")}</p>
          </div>

          <form onSubmit={handleOpenPauseConfirm} className="space-y-4">
            <div>
              <label htmlFor="select-operation" className="block text-xs font-medium text-zinc-300 mb-1">
                {t("selectOperation")}
              </label>
              <select
                id="select-operation"
                value={selectedPauseType}
                onChange={(e) => setSelectedPauseType(e.target.value as PauseType)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {PAUSE_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {t("pauseAction")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPauseEnabled(true)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                    isPauseEnabled
                      ? "bg-red-500/20 text-red-300 border-red-500/50"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                  }`}
                >
                  {t("pauseActionPause")}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPauseEnabled(false)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                    !isPauseEnabled
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                  }`}
                >
                  {t("pauseActionResume")}
                </button>
              </div>
            </div>

            {isPauseEnabled ? (
              <div className="space-y-2">
                <label htmlFor="ttl-hours" className="block text-xs font-medium text-zinc-300">
                  {t("ttlHoursLabel")}
                </label>
                <input
                  id="ttl-hours"
                  type="number"
                  min="0"
                  max="100000"
                  step="0.5"
                  value={ttlHours}
                  onChange={(e) => setTtlHours(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <div className="text-xs text-zinc-400 space-y-1 bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                  <div>{t("ttlCalculatedLedgers", { ledgers: computedTtlLedgers.toLocaleString() })}</div>
                  <div>{t("ttlCalculatedExpiry", { ledger: computedExpiryLedger.toLocaleString() })}</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-400 bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                {t("ttlZeroNotice")}
              </div>
            )}

            <button
              type="submit"
              className="btn w-full py-2.5 font-semibold text-sm"
              disabled={isSubmitting}
            >
              {t("executePauseBtn")}
            </button>
          </form>
        </div>

        {/* Emergency State Transition Form */}
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white">{t("emergencyStateTitle")}</h2>
            <p className="text-xs text-zinc-400 mt-1">{t("emergencyStateSubtitle")}</p>
          </div>

          <form onSubmit={handleOpenEmergencyConfirm} className="space-y-4">
            <div>
              <label htmlFor="select-state" className="block text-xs font-medium text-zinc-300 mb-1">
                {t("selectState")}
              </label>
              <select
                id="select-state"
                value={selectedEmergencyState}
                onChange={(e) => setSelectedEmergencyState(e.target.value as EmergencyState)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {allowedTransitions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {role === "guardian" && (
              <div className="text-xs text-amber-300/90 bg-amber-950/30 p-3 rounded border border-amber-500/30">
                {t("guardianRestrictionNote")}
              </div>
            )}

            <button
              type="submit"
              className="btn w-full py-2.5 font-semibold text-sm"
              disabled={isSubmitting || allowedTransitions.length === 0}
            >
              {t("executeTransitionBtn")}
            </button>
          </form>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="card max-w-lg w-full p-6 space-y-5 border border-zinc-700 shadow-2xl">
            <h3 className="text-lg font-bold text-white">{t("modalConfirmTitle")}</h3>

            <div className="space-y-3 text-xs bg-zinc-900 p-4 rounded-lg border border-zinc-800">
              <div className="flex justify-between">
                <span className="text-zinc-400">{t("modalActionSummary")}:</span>
                <span className="font-mono font-bold text-white">
                  {confirmModal.type === "pause" ? "set_pause" : "set_emergency_state"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">{t("modalTarget")}:</span>
                <span className="font-mono text-emerald-400">{confirmModal.target}</span>
              </div>
              <div className="pt-2 border-t border-zinc-800">
                <span className="text-zinc-400 block mb-1">{t("modalArguments")}:</span>
                <pre className="text-[11px] font-mono text-zinc-300 overflow-x-auto bg-black/40 p-2 rounded">
                  {JSON.stringify(confirmModal.args, null, 2)}
                </pre>
              </div>
            </div>

            {confirmModal.phraseToMatch && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-amber-300">
                  {t("modalTypeToConfirmPrompt", { phrase: confirmModal.phraseToMatch })}
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={confirmModal.phraseToMatch}
                  className="w-full bg-zinc-900 border border-amber-500/50 rounded p-2 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
                className="btn-ghost text-xs sm:text-sm px-4 py-2"
                disabled={isSubmitting}
              >
                {t("cancelBtn")}
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedAction}
                disabled={
                  isSubmitting ||
                  Boolean(
                    confirmModal.phraseToMatch &&
                      confirmInput.trim() !== confirmModal.phraseToMatch
                  )
                }
                className={`py-2 px-4 rounded-lg font-semibold text-xs sm:text-sm ${
                  confirmModal.phraseToMatch
                    ? "bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                    : "btn disabled:opacity-50"
                }`}
              >
                {isSubmitting ? t("submitting") : t("confirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
