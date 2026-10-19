"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchFlashEvents,
  fetchFlashLoanParams,
  formatTokenAmount,
  formatUtilization,
  type FlashActivity,
} from "@/lib/flash-events";
import { config, explorer } from "@/lib/config";

const compactAddress = (value: string) => `${value.slice(0, 6)}...${value.slice(-5)}`;

export default function FlashLoans() {
  const [events, setEvents] = useState<FlashActivity[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [params, setParams] = useState<{ maxFlashBps: bigint; paused: boolean } | null>(null);
  const [paramsError, setParamsError] = useState<string | null>(null);

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
      setEventError(error instanceof Error ? error.message : "Could not load flash-loan events.");
    } finally {
      setLoadingEvents(false);
      setLoadingMore(false);
    }
  }, []);

  const loadParams = useCallback(async () => {
    setParamsError(null);
    try {
      setParams(await fetchFlashLoanParams());
    } catch (error) {
      setParamsError(error instanceof Error ? error.message : "Could not load flash-loan parameters.");
    }
  }, []);

  useEffect(() => {
    void loadEvents();
    void loadParams();
  }, [loadEvents, loadParams]);

  const latestFee = useMemo(
    () => events.find((event): event is Extract<FlashActivity, { kind: "loan" }> => event.kind === "loan"),
    [events],
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Flash loans</h1>
        <p className="mut mt-1 text-sm">
          Recent callback-based loans and repayments recorded by the StellarLend lending contract.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Flash-loan parameters">
        <div className="card p-5">
          <div className="mut text-sm">Max flash utilization</div>
          <div className="mt-1 text-2xl font-semibold">
            {params ? formatUtilization(params.maxFlashBps) : paramsError ? "Unavailable" : "Loading..."}
          </div>
          <p className="mut mt-1 text-xs">Maximum loan as a share of available treasury liquidity.</p>
        </div>
        <div className="card p-5">
          <div className="mut text-sm">Flash loans</div>
          <div className={`mt-1 text-2xl font-semibold ${params?.paused ? "text-amber-400" : "text-emerald-400"}`}>
            {params ? (params.paused ? "Paused" : "Active") : paramsError ? "Unavailable" : "Loading..."}
          </div>
          <p className="mut mt-1 text-xs">Pause state read from the lending contract.</p>
        </div>
        <div className="card p-5">
          <div className="mut text-sm">Current fee (latest observed)</div>
          <div className="mt-1 text-2xl font-semibold">
            {latestFee ? `${latestFee.feeBps ?? "n/a"} bps` : loadingEvents ? "Loading..." : "No observations"}
          </div>
          <p className="mut mt-1 text-xs">
            {latestFee
              ? `${formatTokenAmount(latestFee.fee)} tokens on the latest loan; derived from its event.`
              : "Fee is calculated from the latest loan event, not a contract getter."}
          </p>
        </div>
      </section>

      {paramsError && (
        <p className="text-sm text-amber-300" role="alert">
          {paramsError} <button className="underline" onClick={() => void loadParams()}>Retry</button>
        </p>
      )}

      <section className="card overflow-hidden" aria-labelledby="activity-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-5">
          <div>
            <h2 id="activity-heading" className="text-xl font-semibold">Activity</h2>
            <p className="mut mt-1 text-xs">Amounts use Stellar token precision (7 decimal places).</p>
          </div>
          {config.lendingId && (
            <a className="btn-ghost text-sm" href={explorer(config.lendingId)} target="_blank" rel="noreferrer">
              Lending contract
            </a>
          )}
        </div>

        {eventError && (
          <div className="p-5 text-sm text-amber-300" role="alert">
            {eventError} <button className="ml-2 underline" onClick={() => void loadEvents()}>Retry</button>
          </div>
        )}

        {loadingEvents && events.length === 0 ? (
          <p className="mut p-6 text-sm" role="status">Loading on-chain activity...</p>
        ) : events.length === 0 && !eventError ? (
          <div className="space-y-2 p-8 text-center">
            <h3 className="font-semibold">No flash-loan activity found</h3>
            <p className="mut mx-auto max-w-lg text-sm">
              The RPC only retains a limited window of contract events. Activity may be unavailable if there are no
              recent flash loans or the relevant ledgers have expired from RPC retention.
            </p>
          </div>
        ) : events.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="mut">
                  <tr className="border-b border-[var(--line)]">
                    {["Activity", "Initiator / payer", "Receiver", "Asset", "Amount", "Fee", "Ledger", "Time"].map((heading) => (
                      <th key={heading} className="p-4 font-medium">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const actor = event.kind === "loan" ? event.initiator : event.payer;
                    const receiver = event.kind === "loan" ? event.receiver : null;
                    const date = new Date(event.timestamp);
                    return (
                      <tr key={event.id} className="border-b border-[var(--line)] last:border-0">
                        <td className="p-4 font-medium">{event.kind === "loan" ? "Flash loan" : "Repayment"}</td>
                        <td className="p-4 font-mono" title={actor}>{compactAddress(actor)}</td>
                        <td className="p-4 font-mono" title={receiver ?? undefined}>
                          {receiver ? compactAddress(receiver) : "-"}
                        </td>
                        <td className="p-4 font-mono" title={event.asset}>{compactAddress(event.asset)}</td>
                        <td className="p-4">{formatTokenAmount(event.amount)}</td>
                        <td className="p-4">
                          {event.kind === "loan" ? `${formatTokenAmount(event.fee)} (${event.feeBps ?? "n/a"} bps)` : "-"}
                        </td>
                        <td className="p-4">
                          <a
                            className="underline"
                            href={`https://stellar.expert/explorer/${config.network === "testnet" ? "testnet" : "public"}/tx/${event.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {event.ledger}
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
                  {loadingMore ? "Loading..." : "Load next events"}
                </button>
              </div>
            )}
          </>
        ) : null}
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-xl font-semibold">Receiver callback</h2>
          <p className="mut mt-1 text-sm">
            The lending contract invokes this method on the receiver during a flash loan. Implement repayment of
            principal plus fee in your receiver contract.
          </p>
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
          Contract callback implementation
        </a>
      </section>
    </div>
  );
}
