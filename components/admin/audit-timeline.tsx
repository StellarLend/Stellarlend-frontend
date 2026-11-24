"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { explorer, txExplorer } from "@/lib/config";
import { shortenAddress, formatDuration } from "@/lib/format";
import { PAUSE_TYPES, type PauseType } from "@/lib/admin";
import {
  getAdminEvents,
  type AdminEvent,
} from "@/lib/admin-events";

export interface AuditTimelineProps {
  currentLedger?: number;
  contractId?: string;
  rpcUrl?: string;
}

export function AuditTimeline({
  currentLedger,
  contractId,
  rpcUrl,
}: AuditTimelineProps) {
  const t = useTranslations("adminEmergency");

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [cursor, setCursor] = useState<string>("");
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("All");

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await getAdminEvents({
        contractId,
        rpcUrl,
        limit: 10,
        currentLedger,
      });
      setEvents(page.events);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorLoading"));
    } finally {
      setLoading(false);
    }
  }, [contractId, rpcUrl, currentLedger, t]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await getAdminEvents({
        contractId,
        rpcUrl,
        cursor,
        limit: 10,
        currentLedger,
      });
      setEvents((prev) => [...prev, ...page.events]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorLoading"));
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (selectedFilter === "All") return true;
    return ev.pauseType === selectedFilter;
  });

  return (
    <section className="space-y-4 rounded-xl border border-[var(--line)] bg-[#0d1527] p-6 text-sm" aria-label={t("timelineTitle")}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("timelineTitle")}</h2>
          <p className="mut text-xs">{t("timelineSubtitle")}</p>
        </div>

        {/* Filter by PauseType */}
        <div className="flex items-center gap-2">
          <label htmlFor="timeline-filter" className="text-xs mut">
            Filter:
          </label>
          <select
            id="timeline-filter"
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[#0a1020] px-2.5 py-1 text-xs text-white focus:outline-none"
          >
            <option value="All">{t("filterAll")}</option>
            {PAUSE_TYPES.map((pt) => (
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-xs mut">{t("loading")}</p>
      ) : error ? (
        <div className="space-y-2 py-6 text-center" role="alert">
          <p className="text-xs text-red-400">{error}</p>
          <button
            type="button"
            onClick={fetchInitial}
            className="rounded border border-[var(--line)] px-3 py-1 text-xs text-white hover:bg-zinc-800"
          >
            {t("retry")}
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <p className="py-6 text-center text-xs mut">{t("noEvents")}</p>
      ) : (
        <div className="space-y-3">
          <div className="divide-y divide-[var(--line)]">
            {filteredEvents.map((ev) => (
              <div key={ev.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{ev.action}</span>
                    {ev.expiresAtLedger !== undefined && (
                      ev.isExpired ? (
                        <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                          {t("expiredBadge")}
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                          {t("expiresIn", {
                            time: formatDuration(ev.remainingSeconds ?? 0),
                            ledger: ev.expiresAtLedger,
                          })}
                        </span>
                      )
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mut">
                    <span>
                      {t("actor")}:{" "}
                      <a
                        href={explorer.account ? explorer.account(ev.actor) : `https://stellar.expert/explorer/testnet/account/${ev.actor}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-white"
                      >
                        {shortenAddress(ev.actor)}
                      </a>
                    </span>
                    <span>
                      {t("ledger")}: {ev.ledger}
                    </span>
                    {ev.txHash && (
                      <a
                        href={txExplorer(ev.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-white"
                      >
                        {t("tx")}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-[var(--line)] bg-[#0a1020] px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {loadingMore ? t("loading") : t("loadMore")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
