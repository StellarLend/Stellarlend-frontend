"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchFlashEvents,
  fetchFlashLoanParams,
  formatTokenAmount,
  formatUtilization,
  summarizeFees,
  type FlashActivity,
} from "@/lib/flash-events";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { config, explorer, txExplorer } from "@/lib/config";

const compactAddress = (value: string) => `${value.slice(0, 6)}...${value.slice(-5)}`;

type KindFilter = "all" | "loans" | "repayments";

function normalizeFilter(value: string | null): KindFilter {
  if (value === "loan" || value === "loans") return "loans";
  if (value === "repayment" || value === "repayments") return "repayments";
  return "all";
}

export default function FlashLoans() {
  const t = useTranslations("flashLoans");
  const locale = useLocale();

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

  const readFilterParam = (): string => {
    const fromHook = searchParams?.get("kind");
    if (fromHook !== undefined && fromHook !== null) return fromHook;
    return typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("kind") ?? "";
  };

  const [kindFilter, setKindFilter] = useState<KindFilter>(() => normalizeFilter(readFilterParam()));
  const [events, setEvents] = useState<FlashActivity[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [params, setParams] = useState<{ maxFlashBps: bigint; paused: boolean } | null>(null);
  const [paramsError, setParamsError] = useState<string | null>(null);

  const searchString = searchParams?.toString();
  useEffect(() => {
    if (searchString === undefined) return;
    setKindFilter(normalizeFilter(new URLSearchParams(searchString).get("kind")));
  }, [searchString]);

  const handleFilterChange = (next: KindFilter) => {
    setKindFilter(next);
    const baseSearch =
      searchParams?.toString() ??
      (typeof window === "undefined" ? "" : window.location.search.replace(/^\?/, ""));
    const urlParams = new URLSearchParams(baseSearch);
    if (next === "all") urlParams.delete("kind");
    else urlParams.set("kind", next);

    const basePath = pathname ?? (typeof window === "undefined" ? "/flash-loans" : window.location.pathname);
    const query = urlParams.toString();
    const nextUrl = `${basePath}${query ? `?${query}` : ""}`;

    if (typeof window !== "undefined" && typeof window.history?.replaceState === "function") {
      window.history.replaceState(null, "", nextUrl);
    }
    if (router && typeof router.replace === "function") {
      router.replace(nextUrl, { scroll: false });
    }
  };

  const loadEvents = useCallback(async (nextCursor?: string) => {
    setEventError(null);
    if (nextCursor) setLoadingMore(true);
    else setLoadingEvents(true);
    try {
      const page = await fetchFlashEvents(nextCursor);
      setEvents((current) => {
        const unique = new Map(current.map((event) => [event.id, event]));
        for (const event of page.events) unique.set(event.id, event);
        return [...unique.values()].sort(
          (left, right) =>
            right.ledger - left.ledger ||
            right.transactionIndex - left.transactionIndex ||
            right.operationIndex - left.operationIndex,
        );
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (error) {
      setEventError(error instanceof Error ? error.message : t("errors.events"));
    } finally {
      setLoadingEvents(false);
      setLoadingMore(false);
    }
  }, [t]);

  const loadParams = useCallback(async () => {
    setParamsError(null);
    try {
      setParams(await fetchFlashLoanParams());
    } catch (error) {
      setParamsError(error instanceof Error ? error.message : t("errors.params"));
    }
  }, [t]);

  useEffect(() => {
    // Initial fetch of on-chain data; the loaders set loading/error state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvents();
    void loadParams();
  }, [loadEvents, loadParams]);

  const latestFee = useMemo(
    () => events.find((event): event is Extract<FlashActivity, { kind: "loan" }> => event.kind === "loan"),
    [events],
  );
  const summary = useMemo(() => summarizeFees(events), [events]);
  const filteredEvents = useMemo(
    () =>
      kindFilter === "all"
        ? events
        : events.filter((event) => (kindFilter === "loans" ? event.kind === "loan" : event.kind === "repayment")),
    [events, kindFilter],
  );
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const formatBps = (bps: string) => numberFormat.format(Number(bps));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mut mt-1 text-sm">{t("subtitle")}</p>
      </header>

      <section className="card p-5" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="text-xl font-semibold">{t("summary.title")}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-4">
          <div>
            <dt className="mut text-sm">{t("summary.count")}</dt>
            <dd className="mt-1 text-2xl font-semibold">{numberFormat.format(summary.count)}</dd>
          </div>
          <div>
            <dt className="mut text-sm">{t("summary.median")}</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {summary.median === null ? t("summary.noData") : formatBps(summary.median)}
            </dd>
          </div>
          <div>
            <dt className="mut text-sm">{t("summary.max")}</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {summary.max === null ? t("summary.noData") : formatBps(summary.max)}
            </dd>
          </div>
          <div>
            <dt className="mut text-sm">{t("summary.utilization")}</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {params ? formatUtilization(params.maxFlashBps) : paramsError ? t("unavailable") : t("loading")}
            </dd>
            <p className="mut mt-1 text-xs">{t("maxUtilizationHint")}</p>
          </div>
        </dl>
      </section>

      <section className="grid gap-4 sm:grid-cols-2" aria-label={t("paramsLabel")}>
        <div className="card p-5">
          <div className="mut text-sm">{t("title")}</div>
          <div className={`mt-1 text-2xl font-semibold ${params?.paused ? "text-amber-400" : "text-emerald-400"}`}>
            {params ? (params.paused ? t("paused") : t("active")) : paramsError ? t("unavailable") : t("loading")}
          </div>
          <p className="mut mt-1 text-xs">{t("pauseHint")}</p>
        </div>
        <div className="card p-5">
          <div className="mut text-sm">{t("currentFee")}</div>
          <div className="mt-1 text-2xl font-semibold">
            {latestFee ? t("bps", { bps: latestFee.feeBps ?? t("nA") }) : loadingEvents ? t("loading") : t("noObservations")}
          </div>
          <p className="mut mt-1 text-xs">
            {latestFee
              ? t("feeHint", { amount: formatTokenAmount(latestFee.fee) })
              : t("feeHintEmpty")}
          </p>
        </div>
      </section>

      {paramsError && (
        <p className="text-sm text-amber-300" role="alert">
          {paramsError} <button className="underline" onClick={() => void loadParams()}>{t("retry")}</button>
        </p>
      )}

      <section className="card overflow-hidden" aria-labelledby="activity-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-5">
          <div>
            <h2 id="activity-heading" className="text-xl font-semibold">{t("activity")}</h2>
            <p className="mut mt-1 text-xs">{t("precisionHint")}</p>
          </div>
          <label className="flex flex-col gap-1 text-xs mut">
            <span>{t("filter.label")}</span>
            <select
              aria-label={t("filter.label")}
              data-testid="flash-loans-kind-filter"
              value={kindFilter}
              onChange={(event) => handleFilterChange(event.target.value as KindFilter)}
              className="rounded-lg border border-[var(--line)] bg-[#0a1020] px-3 py-2 text-sm text-[var(--fg)]"
            >
              <option value="all">{t("filter.all")}</option>
              <option value="loans">{t("filter.loans")}</option>
              <option value="repayments">{t("filter.repayments")}</option>
            </select>
          </label>
          {config.lendingId && (
            <a className="btn-ghost text-sm" href={explorer(config.lendingId)} target="_blank" rel="noreferrer">
              {t("lendingContract")}
            </a>
          )}
        </div>

        {eventError && (
          <div className="p-5 text-sm text-amber-300" role="alert">
            {eventError} <button className="ml-2 underline" onClick={() => void loadEvents()}>{t("retry")}</button>
          </div>
        )}

        {loadingEvents && events.length === 0 ? (
          <p className="mut p-6 text-sm" role="status">{t("loadingActivity")}</p>
        ) : events.length === 0 && !eventError ? (
          <div className="space-y-2 p-8 text-center">
            <h3 className="font-semibold">{t("empty.title")}</h3>
            <p className="mut mx-auto max-w-lg text-sm">{t("empty.body")}</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <p className="mut p-8 text-center text-sm">{t("empty.filtered")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="mut">
                  <tr className="border-b border-[var(--line)]">
                    {[t("columns.activity"), t("columns.actor"), t("columns.receiver"), t("columns.asset"), t("columns.amount"), t("columns.fee"), t("columns.ledger"), t("columns.tx"), t("columns.time")].map((heading) => (
                      <th key={heading} className="p-4 font-medium">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => {
                    const actor = event.kind === "loan" ? event.initiator : event.payer;
                    const receiver = event.kind === "loan" ? event.receiver : null;
                    const date = new Date(event.timestamp);
                    return (
                      <tr key={event.id} className="border-b border-[var(--line)] last:border-0">
                        <td className="p-4 font-medium">{event.kind === "loan" ? t("kind.loan") : t("kind.repayment")}</td>
                        <td className="p-4 font-mono" title={actor}>{compactAddress(actor)}</td>
                        <td className="p-4 font-mono" title={receiver ?? undefined}>
                          {receiver ? compactAddress(receiver) : "-"}
                        </td>
                        <td className="p-4 font-mono" title={event.asset}>{compactAddress(event.asset)}</td>
                        <td className="p-4">{formatTokenAmount(event.amount)}</td>
                        <td className="p-4">
                          {event.kind === "loan" ? `${formatTokenAmount(event.fee)} (${t("bps", { bps: event.feeBps ?? t("nA") })})` : "-"}
                        </td>
                        <td className="p-4">
                          <a
                            className="underline"
                            href={txExplorer(event.txHash)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {event.ledger}
                          </a>
                        </td>
                        <td className="p-4">
                          <a
                            className="underline"
                            href={txExplorer(event.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            title={event.txHash}
                          >
                            <span className="block max-w-[8rem] truncate font-mono">{event.txHash}</span>
                          </a>
                        </td>
                        <td className="p-4 whitespace-nowrap" title={date.toISOString()}>
                          {date.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="border-t border-[var(--line)] p-4 text-center">
                <button
                  className="btn-ghost text-sm"
                  disabled={loadingMore || !cursor}
                  onClick={() => void loadEvents(cursor)}
                >
                  {loadingMore ? t("loading") : t("loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-xl font-semibold">{t("callback.title")}</h2>
          <p className="mut mt-1 text-sm">{t("callback.body")}</p>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[#0a1020] p-4 text-xs leading-relaxed text-[var(--fg)]">
          <code>{`pub fn on_flash_loan(
    env: Env,
    initiator: Address,
    asset: Address,
    amount: i128,
    fee: i128,
    params: Bytes,
)`}</code>
        </pre>
        <a
          className="text-sm underline"
          href="https://github.com/StellarLend/stellarlend-contracts/blob/44c8564/stellar-lend/contracts/lending/src/lib.rs"
          target="_blank"
          rel="noreferrer"
        >
          {t("callback.link")}
        </a>
      </section>
    </div>
  );
}
