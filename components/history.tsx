"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@/components/wallet";
import {
  formatLendingAmount,
  formatRelativeTime,
  getLendingEvents,
  getTxExplorerUrl,
  type LendingEvent,
  type LendingEventKind,
} from "@/lib/events";
import { downloadHistoryCsv } from "@/lib/history-export";

const VALID_KINDS: readonly LendingEventKind[] = [
  "deposit",
  "withdraw",
  "borrow",
  "repay",
];

function isValidKind(val: string | null): val is LendingEventKind {
  return val !== null && (VALID_KINDS as readonly string[]).includes(val);
}

function mergeAndSortEvents(
  current: readonly LendingEvent[],
  incoming: readonly LendingEvent[]
): LendingEvent[] {
  const map = new Map(current.map((e) => [e.id, e]));
  for (const ev of incoming) {
    map.set(ev.id, ev);
  }
  return [...map.values()].sort(
    (a, b) =>
      b.ledger - a.ledger ||
      (b.transactionIndex ?? 0) - (a.transactionIndex ?? 0) ||
      (b.operationIndex ?? 0) - (a.operationIndex ?? 0)
  );
}

export default function History() {
  const locale = useLocale();
  const t = useTranslations("history");
  const { address, connect } = useWallet();

  let searchParams: ReturnType<typeof useSearchParams> | null = null;
  let router: ReturnType<typeof useRouter> | null = null;
  let pathname: string | null = null;
  try {
    searchParams = useSearchParams();
  } catch {
    searchParams = null;
  }
  try {
    router = useRouter();
  } catch {
    router = null;
  }
  try {
    pathname = usePathname();
  } catch {
    pathname = null;
  }

  const readInitialParam = (key: string): string => {
    const fromHook = searchParams?.get(key);
    if (fromHook !== undefined && fromHook !== null) return fromHook;
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get(key) ?? "";
    }
    return "";
  };

  const [kindFilter, setKindFilter] = useState<"all" | LendingEventKind>(() => {
    const raw = readInitialParam("kind");
    return isValidKind(raw) ? raw : "all";
  });
  const [fromDate, setFromDate] = useState<string>(() => readInitialParam("from"));
  const [toDate, setToDate] = useState<string>(() => readInitialParam("to"));

  const searchString = searchParams?.toString();
  useEffect(() => {
    if (searchString === undefined) return;
    const params = new URLSearchParams(searchString);
    const k = params.get("kind");
    setKindFilter(isValidKind(k) ? k : "all");
    setFromDate(params.get("from") ?? "");
    setToDate(params.get("to") ?? "");
  }, [searchString]);

  const syncUrlParams = useCallback(
    (next: {
      kind: "all" | LendingEventKind;
      from: string;
      to: string;
    }) => {
      const baseSearch =
        searchParams?.toString() ??
        (typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "");
      const params = new URLSearchParams(baseSearch);

      if (next.kind && next.kind !== "all") {
        params.set("kind", next.kind);
      } else {
        params.delete("kind");
      }

      if (next.from) {
        params.set("from", next.from);
      } else {
        params.delete("from");
      }

      if (next.to) {
        params.set("to", next.to);
      } else {
        params.delete("to");
      }

      const qs = params.toString();
      const basePath =
        pathname ??
        (typeof window !== "undefined" ? window.location.pathname : "/history");
      const nextUrl = qs ? `${basePath}?${qs}` : basePath;

      if (typeof window !== "undefined" && typeof window.history?.replaceState === "function") {
        window.history.replaceState(null, "", nextUrl);
      }
      if (router && typeof router.replace === "function") {
        router.replace(nextUrl, { scroll: false });
      }
    },
    [pathname, router, searchParams]
  );

  const handleKindChange = (nextKind: "all" | LendingEventKind) => {
    setKindFilter(nextKind);
    syncUrlParams({ kind: nextKind, from: fromDate, to: toDate });
  };

  const handleFromDateChange = (nextFrom: string) => {
    setFromDate(nextFrom);
    syncUrlParams({ kind: kindFilter, from: nextFrom, to: toDate });
  };

  const handleToDateChange = (nextTo: string) => {
    setToDate(nextTo);
    syncUrlParams({ kind: kindFilter, from: fromDate, to: nextTo });
  };

  const handleClearFilters = () => {
    setKindFilter("all");
    setFromDate("");
    setToDate("");
    syncUrlParams({ kind: "all", from: "", to: "" });
  };

  const [events, setEvents] = useState<LendingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadedPages, setLoadedPages] = useState(0);
  const [cursor, setCursor] = useState<string>("");
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelLoadAll = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoadingAll(false);
  }, []);

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

        setEvents((current) => mergeAndSortEvents(current, page.events));
        setLoadedPages((p) => (nextCursor ? p + 1 : 1));
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

  const loadAllRetentionWindow = useCallback(async () => {
    if (!address || loadingAll) return;
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoadingAll(true);

    let nextCursor: string | undefined = cursor || undefined;
    let shouldContinue = hasMore || events.length === 0;

    try {
      while (shouldContinue && !controller.signal.aborted) {
        const page = await getLendingEvents({
          user: address,
          cursor: nextCursor,
        });

        if (controller.signal.aborted) {
          break;
        }

        setEvents((current) => mergeAndSortEvents(current, page.events));
        setLoadedPages((p) => p + 1);
        setCursor(page.cursor);
        setHasMore(page.hasMore);

        if (!page.hasMore || !page.cursor || page.cursor === nextCursor) {
          shouldContinue = false;
        } else {
          nextCursor = page.cursor;
        }
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setLoadingAll(false);
    }
  }, [address, cursor, events.length, hasMore, loadingAll]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoadingAll(false);

    if (!address) {
      setEvents([]);
      setLoadedPages(0);
      setCursor("");
      setHasMore(false);
      setError(null);
      return;
    }
    void loadEvents();
  }, [address, loadEvents]);

  const filteredEvents = useMemo(() => {
    const fromSeconds = fromDate
      ? Math.floor(new Date(`${fromDate}T00:00:00.000Z`).getTime() / 1000)
      : null;
    const toSeconds = toDate
      ? Math.floor(new Date(`${toDate}T23:59:59.999Z`).getTime() / 1000)
      : null;

    return events.filter((ev) => {
      if (kindFilter !== "all" && ev.kind !== kindFilter) {
        return false;
      }
      if (fromSeconds !== null && !Number.isNaN(fromSeconds)) {
        if (!ev.timestamp || ev.timestamp < fromSeconds) return false;
      }
      if (toSeconds !== null && !Number.isNaN(toSeconds)) {
        if (!ev.timestamp || ev.timestamp > toSeconds) return false;
      }
      return true;
    });
  }, [events, kindFilter, fromDate, toDate]);

  const hasActiveFilters = kindFilter !== "all" || fromDate !== "" || toDate !== "";

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
      ) : error && events.length === 0 ? (
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
          <div
            data-testid="history-controls"
            className="card flex flex-wrap items-end justify-between gap-4 p-4"
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                <span>{t("filterKindLabel")}</span>
                <select
                  aria-label={t("filterKindLabel")}
                  data-testid="history-filter-kind"
                  value={kindFilter}
                  onChange={(e) =>
                    handleKindChange(e.target.value as "all" | LendingEventKind)
                  }
                  className="rounded-lg border border-[var(--line)] bg-[#0a1020] px-3 py-2 text-sm text-[var(--fg)]"
                >
                  <option value="all">{t("filterAllKinds")}</option>
                  <option value="deposit">{t("deposit")}</option>
                  <option value="withdraw">{t("withdraw")}</option>
                  <option value="borrow">{t("borrow")}</option>
                  <option value="repay">{t("repay")}</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                <span>{t("filterFromLabel")}</span>
                <input
                  type="date"
                  aria-label={t("filterFromLabel")}
                  data-testid="history-filter-from"
                  value={fromDate}
                  onChange={(e) => handleFromDateChange(e.target.value)}
                  className="rounded-lg border border-[var(--line)] bg-[#0a1020] px-3 py-1.5 text-sm text-[var(--fg)]"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                <span>{t("filterToLabel")}</span>
                <input
                  type="date"
                  aria-label={t("filterToLabel")}
                  data-testid="history-filter-to"
                  value={toDate}
                  onChange={(e) => handleToDateChange(e.target.value)}
                  className="rounded-lg border border-[var(--line)] bg-[#0a1020] px-3 py-1.5 text-sm text-[var(--fg)]"
                />
              </label>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  data-testid="history-clear-filters"
                  className="btn-ghost text-xs"
                >
                  {t("clearFilters")}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {loadingAll ? (
                <div className="flex items-center gap-2">
                  <span
                    data-testid="history-load-all-progress"
                    className="mut text-xs"
                    role="status"
                  >
                    {t("loadingAllProgress", {
                      pages: loadedPages,
                      rows: events.length,
                    })}
                  </span>
                  <button
                    type="button"
                    data-testid="history-cancel-load-all"
                    onClick={cancelLoadAll}
                    className="btn-ghost text-xs"
                  >
                    {t("cancelLoadAll")}
                  </button>
                </div>
              ) : (
                hasMore && (
                  <button
                    type="button"
                    data-testid="history-load-all"
                    onClick={() => void loadAllRetentionWindow()}
                    disabled={loadingMore}
                    className="btn-ghost text-xs"
                  >
                    {t("loadAll")}
                  </button>
                )
              )}

              <button
                type="button"
                data-testid="history-export-csv"
                onClick={() =>
                  downloadHistoryCsv(filteredEvents, address, {
                    asset: t("asset"),
                  })
                }
                disabled={filteredEvents.length === 0}
                className="btn text-xs"
              >
                {t("exportCsv")}
              </button>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div
              data-testid="history-empty-filtered"
              className="card flex flex-col items-center justify-center p-10 text-center"
            >
              <h2 className="text-base font-semibold">{t("emptyFilteredTitle")}</h2>
              <p className="mut mt-1 max-w-md text-sm">{t("emptyFilteredSubtitle")}</p>
            </div>
          ) : (
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
                  {filteredEvents.map((ev) => {
                    const dateStr =
                      ev.timestamp > 0
                        ? new Date(ev.timestamp * 1000).toLocaleString(locale)
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
          )}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => void loadEvents(cursor)}
                disabled={loadingMore || loadingAll}
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
