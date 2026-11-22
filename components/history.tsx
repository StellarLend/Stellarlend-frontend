"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useWallet } from "@/components/wallet";
import {
  formatLendingAmount,
  formatRelativeTime,
  getLendingEvents,
  getTxExplorerUrl,
  type LendingEvent,
} from "@/lib/events";

export default function History() {
  const locale = useLocale();
  const t = useTranslations("history");
  const { address, connect } = useWallet();

  const [events, setEvents] = useState<LendingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string>("");
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(
    async (nextCursor?: string) => {
      if (!address) return;
      setError(null);
      if (nextCursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const page = await getLendingEvents({
          user: address,
          cursor: nextCursor,
        });

        setEvents((current) => {
          const map = new Map(current.map((e) => [e.id, e]));
          for (const ev of page.events) {
            map.set(ev.id, ev);
          }
          return [...map.values()].sort(
            (a, b) =>
              b.ledger - a.ledger ||
              (b.transactionIndex ?? 0) - (a.transactionIndex ?? 0) ||
              (b.operationIndex ?? 0) - (a.operationIndex ?? 0)
          );
        });

        setCursor(page.cursor);
        setHasMore(page.hasMore);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [address]
  );

  useEffect(() => {
    if (!address) {
      setEvents([]);
      setCursor("");
      setHasMore(false);
      setError(null);
      return;
    }
    void loadEvents();
  }, [address, loadEvents]);

  const getKindBadgeClass = (kind: LendingEvent["kind"]) => {
    switch (kind) {
      case "deposit":
        return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
      case "withdraw":
        return "border border-blue-500/20 bg-blue-500/10 text-blue-400";
      case "borrow":
        return "border border-amber-500/20 bg-amber-500/10 text-amber-400";
      case "repay":
        return "border border-purple-500/20 bg-purple-500/10 text-purple-400";
      default:
        return "border border-zinc-500/20 bg-zinc-500/10 text-zinc-300";
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mut text-sm">{t("subtitle")}</p>
        <p className="mut text-xs">{t("retentionNotice")}</p>
      </header>

      {!address ? (
        <div
          data-testid="history-disconnected"
          className="card flex flex-col items-center justify-center p-12 text-center"
        >
          <div className="mb-3 text-4xl">👛</div>
          <h2 className="text-lg font-semibold">{t("notConnectedTitle")}</h2>
          <p className="mut mt-1 max-w-md text-sm">{t("notConnectedSubtitle")}</p>
          <button
            onClick={() => void connect()}
            className="btn mt-6"
            type="button"
          >
            {t("connectWallet")}
          </button>
        </div>
      ) : loading && events.length === 0 ? (
        <div
          data-testid="history-loading"
          className="card flex flex-col items-center justify-center p-12 text-center"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <p className="mut mt-4 text-sm">{t("loading")}</p>
        </div>
      ) : error ? (
        <div
          data-testid="history-error"
          className="card flex flex-col items-center justify-center p-12 text-center"
        >
          <div className="mb-2 text-3xl text-rose-400">⚠️</div>
          <h2 className="text-lg font-semibold">{t("errorTitle")}</h2>
          <p className="mut mt-1 text-sm">{error}</p>
          <button
            onClick={() => void loadEvents()}
            className="btn mt-6"
            type="button"
          >
            {t("retry")}
          </button>
        </div>
      ) : events.length === 0 ? (
        <div
          data-testid="history-empty"
          className="card flex flex-col items-center justify-center p-12 text-center"
        >
          <div className="mb-3 text-3xl">📜</div>
          <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
          <p className="mut mt-1 max-w-md text-sm">{t("emptySubtitle")}</p>
        </div>
      ) : (
        <div data-testid="history-populated" className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--card)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-white/5 text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">{t("type")}</th>
                  <th className="px-4 py-3">{t("amount")}</th>
                  <th className="px-4 py-3">{t("resulting")}</th>
                  <th className="px-4 py-3">{t("time")}</th>
                  <th className="px-4 py-3 text-right">{t("tx")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]/50">
                {events.map((ev) => {
                  const dateStr =
                    ev.timestamp > 0
                      ? new Date(ev.timestamp * 1000).toLocaleString()
                      : "-";
                  return (
                    <tr
                      key={ev.id}
                      className="transition-colors hover:bg-white/5"
                    >
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block rounded px-2.5 py-0.5 text-xs font-semibold capitalize ${getKindBadgeClass(
                            ev.kind
                          )}`}
                        >
                          {t(ev.kind)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium tabular-nums">
                        {`${formatLendingAmount(ev.amount)} ${t("asset")}`}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-[var(--muted)]">
                        {`${formatLendingAmount(ev.after)} ${t("asset")}`}
                      </td>
                      <td
                        className="px-4 py-3.5 whitespace-nowrap text-[var(--muted)]"
                        title={dateStr}
                      >
                        {formatRelativeTime(ev.timestamp, locale)}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <a
                          href={getTxExplorerUrl(ev.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[var(--accent)] hover:underline"
                        >
                          {t("viewTx")}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => void loadEvents(cursor)}
                disabled={loadingMore}
                className="btn text-sm"
                type="button"
              >
                {loadingMore ? t("loadingMore") : t("loadMore")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
