"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Proposal, ProposalStatus } from "@/lib/multisig/types";
import { listProposals } from "@/lib/multisig/reads";
import { shortenAddress } from "@/lib/multisig/decode";
import { getStatusDisplay } from "@/lib/multisig/status";
import { BatchProposalActions } from "./proposal-actions";
import { CreateProposal } from "./create-proposal";
import { config, explorer, accountExplorer } from "@/lib/config";

const PROPOSALS_PAGE_SIZE = 10;

const STATUS_TAB_KEYS = [
  { value: "all", labelKey: "tabAll" },
  { value: "pending", labelKey: "tabPending" },
  { value: "approved", labelKey: "tabApproved" },
  { value: "executed", labelKey: "tabExecuted" },
  { value: "cancelled", labelKey: "tabCancelled" },
  { value: "expired", labelKey: "tabExpired" },
] as const;

type ProposalFilter = (typeof STATUS_TAB_KEYS)[number]["value"];

function readFilterFromUrl(): ProposalFilter {
  const value = new URLSearchParams(window.location.search).get("filter");
  return STATUS_TAB_KEYS.find((tab) => tab.value === value)?.value ?? "all";
}

function readPageFromUrl(): number {
  const value = Number(new URLSearchParams(window.location.search).get("page"));
  return Number.isInteger(value) && value > 0 ? value : 1;
}

export function MultisigApp() {
  const t = useTranslations("multisig");
  const isConfigured = Boolean(config.multisigId);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ProposalFilter>("all");
  const [page, setPage] = useState<number>(1);
  const [urlReady, setUrlReady] = useState(false);
  const [showAllSigners, setShowAllSigners] = useState<boolean>(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const cursor = (page - 1) * PROPOSALS_PAGE_SIZE;
  const {
    data,
    isLoading: queryLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["multisig-proposals", config.multisigId, cursor],
    queryFn: () =>
      listProposals({
        contractId: config.multisigId,
        cursor,
        pageSize: PROPOSALS_PAGE_SIZE,
      }),
    enabled: isConfigured && urlReady,
    staleTime: 30_000,
  });
  const loading = !urlReady || queryLoading;
  const overview = data?.overview ?? null;
  const proposals = data?.proposals ?? [];
  const hasNextPage = data?.nextCursor !== null && data?.nextCursor !== undefined;
  const refreshData = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["multisig-proposals", config.multisigId],
    });
  }, [queryClient]);

  useEffect(() => {
    const syncUrlState = () => {
      setFilter(readFilterFromUrl());
      setPage(readPageFromUrl());
    };
    syncUrlState();
    setUrlReady(true);
    window.addEventListener("popstate", syncUrlState);
    return () => window.removeEventListener("popstate", syncUrlState);
  }, []);

  const navigate = useCallback((nextFilter: ProposalFilter, nextPage: number) => {
    setFilter(nextFilter);
    setPage(nextPage);
    const params = new URLSearchParams(window.location.search);
    params.set("filter", nextFilter);
    params.set("page", String(nextPage));
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}${window.location.hash}`,
    );
  }, []);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = STATUS_TAB_KEYS.findIndex((tab) => tab.value === filter);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % STATUS_TAB_KEYS.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + STATUS_TAB_KEYS.length) % STATUS_TAB_KEYS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = STATUS_TAB_KEYS.length - 1;
    else return;

    event.preventDefault();
    navigate(STATUS_TAB_KEYS[nextIndex].value, 1);
    tabRefs.current[nextIndex]?.focus();
  };

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

  const filtered = useMemo(
    () =>
      enrichedProposals.filter((proposal) => {
        switch (filter) {
          case "pending":
            return proposal.effectiveStatus === "Active";
          case "approved":
            return proposal.effectiveStatus === "Passed";
          case "executed":
            return proposal.effectiveStatus === "Executed";
          case "cancelled":
            return proposal.effectiveStatus === "Cancelled";
          case "expired":
            return proposal.effectiveStatus === "Expired";
          default:
            return true;
        }
      }),
    [enrichedProposals, filter],
  );
  const counts = useMemo(
    () => ({
      all: enrichedProposals.length,
      pending: enrichedProposals.filter((p) => p.effectiveStatus === "Active").length,
      approved: enrichedProposals.filter((p) => p.effectiveStatus === "Passed").length,
      executed: enrichedProposals.filter((p) => p.effectiveStatus === "Executed").length,
      cancelled: enrichedProposals.filter((p) => p.effectiveStatus === "Cancelled").length,
      expired: enrichedProposals.filter((p) => p.effectiveStatus === "Expired").length,
    }),
    [enrichedProposals],
  );

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
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mut mt-1 text-sm">{t("subtitle")}</p>
        </div>

        <div className="card p-8 text-center space-y-4 max-w-2xl mx-auto border-dashed">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 text-2xl mb-2">
            ⚙️
          </div>
          <h2 className="text-xl font-bold">{t("notConfiguredTitle")}</h2>
          <p className="text-sm mut max-w-lg mx-auto">{t("notConfiguredDesc")}</p>
          <div className="pt-2 text-xs font-mono text-gray-400 bg-[var(--bg)] p-3 rounded-lg border border-[var(--line)] text-left">
            <span>{"# .env.local"}</span>
            <br />
            <span>{"NEXT_PUBLIC_MULTISIG_CONTRACT_ID=CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6"}</span>
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
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mut mt-1 text-sm">{t("realtimeSubtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshData}
            disabled={isFetching}
            className="btn-ghost text-xs px-3 py-1.5 rounded-lg border border-[var(--line)]"
            title="Refresh on-chain state"
          >
            {isFetching ? t("refreshing") : t("refresh")}
          </button>
          <div className="text-xs mut">
            <span>{t("multisigContract")}{" "}</span>
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
          <span>⚠️ {error instanceof Error ? error.message : t("loadError")}</span>
          <button onClick={refreshData} className="underline text-xs">
            {t("retry")}
          </button>
        </div>
      )}
      {Boolean(data?.failedProposalIds.length) && (
        <div
          className="card p-4 border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm"
          role="status"
          aria-live="polite"
        >
          {t("failedProposals", {
            plural: String(data!.failedProposalIds.length > 1),
            ids: data!.failedProposalIds.map((id) => `#${id}`).join(", "),
          })}
        </div>
      )}

      {/* Multisig Contract Overview Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm uppercase tracking-wider font-semibold mut">{t("contractOverview")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--line)] space-y-1">
            <span className="text-xs mut">{t("quorumThreshold")}</span>
            <p className="text-xl font-bold">
              {overview ? `${overview.threshold} of ${signers.length}` : "—"}{" "}
              <span className="text-xs font-normal mut">{t("signersRequired")}</span>
            </p>
          </div>

          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--line)] space-y-1">
            <span className="text-xs mut">{t("activeSigners")}</span>
            <p className="text-xl font-bold">{overview ? signers.length : "—"}</p>
          </div>

          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--line)] space-y-1">
            <span className="text-xs mut">{t("currentLedger")}</span>
            <p className="text-xl font-bold font-mono">
              {overview?.currentLedger ? `#${overview.currentLedger.toLocaleString()}` : "—"}
            </p>
          </div>

          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--line)] space-y-1">
            <span className="text-xs mut">{t("signerSetHash")}</span>
            <p className="text-xs font-mono break-all text-slate-300">
              {overview?.signerSetHash ? shortenAddress(overview.signerSetHash, 8, 8) : "—"}
            </p>
          </div>
        </div>

        {/* Signers List */}
        {Boolean(signers.length > 0) && (
          <div className="pt-2 border-t border-[var(--line)]">
            <div className="flex items-center justify-between text-xs mut mb-2">
              <span>{t("registeredSigners", { count: signers.length })}</span>
              {Boolean(signers.length > 3) && (
                <button
                  onClick={() => setShowAllSigners(!showAllSigners)}
                  className="text-blue-400 hover:underline"
                >
                  {showAllSigners ? t("showLess") : t("showAll", { count: signers.length })}
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

      {/* Create Proposal Form (rendered only for authorized signers) */}
      <CreateProposal contractId={config.multisigId} onRefresh={refreshData} />

      {/* Proposal Status Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 text-xs" role="tablist" aria-label={t("filterByStatus")}>
          {STATUS_TAB_KEYS.map((tab, index) => (
            <button
              key={tab.value}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`proposal-tab-${tab.value}`}
              role="tab"
              aria-selected={filter === tab.value}
              aria-controls="multisig-proposals-panel"
              tabIndex={filter === tab.value ? 0 : -1}
              onClick={() => navigate(tab.value, 1)}
              onKeyDown={handleTabKeyDown}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                filter === tab.value
                  ? "border-[var(--acc)] text-white bg-[var(--acc)]/10"
                  : "border-[var(--line)] text-gray-400 hover:text-white"
              }`}
            >
              {t(tab.labelKey)} ({counts[tab.value]})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => navigate(filter, page - 1)}
            disabled={page <= 1 || loading}
            className="btn-ghost px-3 py-1.5 rounded-lg border border-[var(--line)] disabled:opacity-40"
            aria-label={t("prevAriaLabel")}
          >
            {t("previous")}
          </button>
          <span className="mut" aria-live="polite">
            {t("page", { page })}
          </span>
          <button
            type="button"
            onClick={() => navigate(filter, page + 1)}
            disabled={!hasNextPage || loading}
            className="btn-ghost px-3 py-1.5 rounded-lg border border-[var(--line)] disabled:opacity-40"
            aria-label={t("nextAriaLabel")}
          >
            {t("next")}
          </button>
        </div>
      </div>

      {/* Proposals List Table */}
      <div
        className="card overflow-x-auto"
        id="multisig-proposals-panel"
        role="tabpanel"
        aria-labelledby={`proposal-tab-${filter}`}
      >
        {loading ? (
          <div className="p-12 text-center mut">{t("loadingProposals")}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center mut space-y-2">
            <p className="text-base font-semibold">{t("noProposalsFound")}</p>
            <p className="text-xs">
              {filter === "all"
                ? t("noProposalsCreated")
                : t("noProposalsWithStatus", {
                    status: t(STATUS_TAB_KEYS.find((tab) => tab.value === filter)?.labelKey ?? "tabAll"),
                  })}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm min-w-[750px]">
            <thead className="mut border-b border-[var(--line)] text-xs">
              <tr>
                <th className="p-4">{t("thProposal")}</th>
                <th className="p-4">{t("thDecodedAction")}</th>
                <th className="p-4">{t("thStatus")}</th>
                <th className="p-4">{t("thQuorumProgress")}</th>
                <th className="p-4">{t("thExpiry")}</th>
                <th className="p-4 text-right">{t("thDetails")}</th>
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
                    <td className="p-4 font-bold whitespace-nowrap">#{p.id}</td>

                    <td className="p-4 text-xs font-mono max-w-sm">
                      <div className="truncate font-semibold text-slate-200">
                        {p.decodedAction?.summary ||
                          (typeof p.action === "string" ? p.action : JSON.stringify(p.action))}
                      </div>
                      {p.signerSetChanged && (
                        <span className="inline-block mt-1 text-[11px] font-sans px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          {t("signerSetChangedWarning")}
                        </span>
                      )}
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      {isOverridden ? (
                        <div className="space-y-0.5">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                              p.effectiveStatus || "Expired",
                            )}`}
                          >
                            {t("storedVsEffective", { stored: p.status, effective: p.effectiveStatus })}
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                            p.status,
                          )}`}
                        >
                          {p.status}
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-xs min-w-[140px]">
                      <div className="flex items-center justify-between mb-1 text-[11px] font-medium">
                        <span>{t("signersCount", { count: p.approvals.length, total: threshold })}</span>
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
                      <div className="text-[11px] mut mt-0.5">{p.timeToExpiry || "—"}</div>
                    </td>

                    <td className="p-4 text-right whitespace-nowrap">
                      <Link href={`/multisig/${p.id}`} className="btn-ghost text-xs">
                        {t("viewDetails")}
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
      {Boolean(proposals.length > 0) && (
        <div className="card p-6">
          <BatchProposalActions proposals={proposals} onRefresh={refreshData} />
        </div>
      )}
    </div>
  );
}
