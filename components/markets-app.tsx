"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MARKETS, formatCurrency, formatNumber, formatPercent, type Locale, type Market } from "@/lib/markets";
import { useWallet } from "./wallet";
import { config, explorer } from "@/lib/config";
import { normaliseAmountInput } from "@/lib/amount-input";
import { fetchLiveMarketParams, bpsToPercent } from "@/lib/market-params";
import {
  loadLedger,
  saveLedger,
  parseAmount,
  toFloat,
  computeRisk,
  canWithdraw,
  canBorrow,
  storageKey,
  type Ledger,
} from "@/lib/demo-ledger";

export default function MarketsApp() {
  const { address, balance, error, connect } = useWallet();
  const locale = useLocale() as Locale;
  const t = useTranslations("market");
  const [ledger, setLedger] = useState<Ledger>({});
  const [resetNotice, setResetNotice] = useState(false);
  const [sel, setSel] = useState<Market | null>(null);
  const [mode, setMode] = useState<"supply" | "borrow" | "withdraw" | "repay">("supply");
  const [amt, setAmt] = useState("");
  const [msg, setMsg] = useState("");
  const [markets, setMarkets] = useState<Market[]>(MARKETS);
  const [loadingParams, setLoadingParams] = useState(true);

  // Concurrently fetch live market params without blocking table rendering
  useEffect(() => {
    let active = true;
    async function loadParams() {
      try {
        const live = await fetchLiveMarketParams(MARKETS);
        if (active) {
          setMarkets(live);
          setLoadingParams(false);
        }
      } catch {
        if (active) {
          setLoadingParams(false);
        }
      }
    }
    loadParams();
    return () => {
      active = false;
    };
  }, []);

  // Update selected market if markets update
  useEffect(() => {
    if (sel) {
      const updated = markets.find((m) => m.symbol === sel.symbol);
      if (updated) {
        setSel(updated);
      }
    }
  }, [markets, sel]);

  // Load positions from storage (per-wallet key)
  useEffect(() => {
    const { ledger: loaded, reset } = loadLedger(address);
    setLedger(loaded);
    if (reset) setResetNotice(true);
  }, [address]);

  // Cross-tab sync via the storage event
  useEffect(() => {
    const key = storageKey(address);
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return;
      if (e.newValue === null) {
        setLedger({});
        return;
      }
      try {
        const { ledger: reloaded } = loadLedger(address);
        setLedger(reloaded);
      } catch {
        // ignore malformed events from other tabs
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [address]);

  const save = useCallback(
    (next: Ledger) => {
      setLedger(next);
      saveLedger(address, next);
    },
    [address]
  );

  const { collateralUsd, borrowUsd, health } = useMemo(
    () => computeRisk(ledger, markets),
    [ledger, markets]
  );

  function submit() {
    if (!sel) return;
    const normalized = normaliseAmountInput(amt, locale);
    const parsed = parseAmount(normalized ?? amt.trim(), sel.decimals);
    if (!parsed.ok) {
      const msgs: Record<typeof parsed.error, string> = {
        empty: t("status.positiveAmount"),
        "invalid-format": t("status.invalidFormat"),
        negative: t("status.negative"),
        "too-many-decimals": t("status.tooManyDecimals", { decimals: sel.decimals }),
        "too-large": t("status.tooLarge"),
        "not-finite": t("status.notFinite"),
      };
      setMsg(msgs[parsed.error]);
      return;
    }
    const n = parsed.value;
    if (n <= BigInt(0)) {
      setMsg(t("status.positiveAmount"));
      return;
    }
    const cur = ledger[sel.symbol] ?? { supplied: BigInt(0), borrowed: BigInt(0) };
    const next = { ...cur };

    if (mode === "supply") {
      // Validate supply against remaining deposit capacity
      if (sel.depositCapRemaining !== null && sel.depositCapRemaining !== undefined) {
        if (n > sel.depositCapRemaining) {
          setMsg(t("status.depositCapExceeded"));
          return;
        }
      }
      next.supplied = cur.supplied + n;
    } else if (mode === "withdraw") {
      if (n > cur.supplied) {
        setMsg(t("status.exceedsSupply"));
        return;
      }
      if (!canWithdraw(ledger, sel.symbol, n, markets)) {
        setMsg(t("status.underCollateralised"));
        return;
      }
      next.supplied = cur.supplied - n;
    } else if (mode === "borrow") {
      // Validate borrow against minimum borrow limit
      if (sel.minBorrow !== null && sel.minBorrow !== undefined) {
        if (n < sel.minBorrow) {
          setMsg(t("status.belowMinimumBorrow"));
          return;
        }
      }
      if (!canBorrow(ledger, sel.symbol, n, markets)) {
        setMsg(t("status.exceedsBorrowLimit"));
        return;
      }
      next.borrowed = cur.borrowed + n;
    } else if (mode === "repay") {
      if (n > cur.borrowed) {
        setMsg(t("status.exceedsBorrowed"));
        return;
      }
      next.borrowed = cur.borrowed - n;
    }

    save({ ...ledger, [sel.symbol]: next });
    setMsg(
      t("status.recorded", {
        action: t(mode),
        amount: formatNumber(toFloat(n, sel.decimals), locale, sel.decimals),
        symbol: sel.symbol,
      })
    );
    setAmt("");
  }

  function resetDemo() {
    save({});
    setMsg(t("status.demoReset"));
    setResetNotice(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mut mt-1 text-sm">{t("subtitle")}</p>
      </div>

      {resetNotice && (
        <div className="card p-4 text-sm text-amber-400" role="alert">
          {t("status.storageReset")}
        </div>
      )}

      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="text-sm">
          <div className="mut">{t("wallet")}</div>
          {address ? (
            <div>
              <span className="font-mono">
                {address.slice(0, 8)}...{address.slice(-6)}
              </span>
              <span className="mut"> - {balance ?? "..."} XLM</span>
            </div>
          ) : (
            <div>{t("demoMode")}</div>
          )}
          {error && <div className="text-xs text-rose-400">{error}</div>}
        </div>
        <div className="flex gap-2">
          {address ? (
            <button className="btn-ghost" onClick={() => connect()}>
              {t("disconnect")}
            </button>
          ) : (
            <button className="btn" onClick={() => connect()}>
              {t("connectFreighter")}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <Stat k={t("collateral")} v={formatCurrency(collateralUsd, locale)} />
        </div>
        <div className="card p-5">
          <Stat k={t("borrowed")} v={formatCurrency(borrowUsd, locale)} />
        </div>
        <div className="card col-span-2 p-5 md:col-span-1">
          <Stat
            k={t("health")}
            v={health === Infinity ? t("nA") : formatNumber(health, locale, 2)}
            tone={health < 1.2 ? "text-rose-400" : "text-emerald-400"}
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase mut">
            <tr>
              {[
                t("asset"),
                t("price"),
                t("supplyApy"),
                t("borrowApy"),
                t("ltv"),
                t("liquidationThreshold"),
                t("capacity"),
                t("totalSupplied"),
                t("yourPosition"),
                "",
              ].map((h, i) => (
                <th key={String(h) + i} className="p-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => {
              const p = ledger[m.symbol];
              const suppliedFloat = p ? toFloat(p.supplied, m.decimals) : 0;
              const borrowedFloat = p ? toFloat(p.borrowed, m.decimals) : 0;

              const ltvDisplay = m.ltvBps !== undefined ? bpsToPercent(m.ltvBps) : m.ltv * 100;
              const liqThresholdDisplay = m.liqThresholdBps !== undefined ? bpsToPercent(m.liqThresholdBps) : 80;

              const capBigInt = m.supplyCap ?? BigInt(0);
              const isUncapped = capBigInt === BigInt(0);
              const capFloat = isUncapped ? null : toFloat(capBigInt, m.decimals);
              const usedFloat = m.totalSupply;
              const capacityPercent =
                capFloat && capFloat > 0 ? Math.min(100, Math.round((usedFloat / capFloat) * 100)) : 0;

              return (
                <tr key={m.symbol} className="border-b border-[var(--line)] last:border-0">
                  <td className="p-4">
                    <b>{m.symbol}</b> <span className="mut">{m.name}</span>
                  </td>
                  <td className="p-4">{formatCurrency(m.price, locale)}</td>
                  <td className="p-4 text-emerald-400">{formatPercent(m.supplyApy, locale)}</td>
                  <td className="p-4">{formatPercent(m.borrowApy, locale)}</td>
                  <td className="p-4">
                    {loadingParams ? (
                      <span className="inline-block h-4 w-12 animate-pulse rounded bg-zinc-800" />
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{formatPercent(ltvDisplay, locale)}</span>
                        <SourceBadge source={m.sources?.ltv} t={t} />
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {loadingParams ? (
                      <span className="inline-block h-4 w-12 animate-pulse rounded bg-zinc-800" />
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{formatPercent(liqThresholdDisplay, locale)}</span>
                        <SourceBadge source={m.sources?.liqThreshold} t={t} />
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {loadingParams ? (
                      <span className="inline-block h-4 w-24 animate-pulse rounded bg-zinc-800" />
                    ) : isUncapped ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="mut">{t("uncapped")}</span>
                        <SourceBadge source={m.sources?.supplyCap} t={t} />
                      </span>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span>{capacityPercent}%</span>
                          <SourceBadge source={m.sources?.supplyCap} t={t} />
                        </div>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className={`h-full rounded-full ${
                              capacityPercent > 90 ? "bg-rose-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${capacityPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="p-4">{formatNumber(m.totalSupply, locale, 0)}</td>
                  <td className="p-4 mut">
                    {p
                      ? `+${formatNumber(suppliedFloat, locale, 4)} / -${formatNumber(borrowedFloat, locale, 4)}`
                      : "-"}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setSel(m);
                        setMsg("");
                      }}
                    >
                      {t("trade")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="card max-w-md space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{sel.symbol}</h2>
            {sel.depositCapRemaining !== null && sel.depositCapRemaining !== undefined && (
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                {t("remainingCapacity", {
                  amount: formatNumber(toFloat(sel.depositCapRemaining, sel.decimals), locale, 2),
                  symbol: sel.symbol,
                })}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1 text-sm">
            {(["supply", "borrow", "withdraw", "repay"] as const).map((x) => (
              <button
                key={x}
                onClick={() => {
                  setMode(x);
                  setMsg("");
                }}
                className={`rounded-lg py-2 ${mode === x ? "btn" : "btn-ghost"}`}
              >
                {t(x)}
              </button>
            ))}
          </div>
          <input
            inputMode="decimal"
            placeholder={t("amountIn", { symbol: sel.symbol })}
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            aria-label={t("amountIn", { symbol: sel.symbol })}
          />
          <button className="btn w-full" onClick={submit}>
            {t("confirm", { action: t(mode) })}
          </button>
          {msg && (
            <p className="mut text-sm" role="status">
              {msg}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs mut">
        <p>
          {t("contract")}:{" "}
          {config.lendingId ? (
            <a
              className="break-all underline"
              href={explorer(config.lendingId)}
              target="_blank"
              rel="noreferrer"
            >
              {config.lendingId}
            </a>
          ) : (
            t("notDeployed")
          )}
        </p>
        <button className="btn-ghost text-xs" onClick={resetDemo}>
          {t("resetDemo")}
        </button>
      </div>
    </div>
  );
}

function SourceBadge({ source, t }: { source?: "chain" | "demo"; t: (k: string) => string }) {
  if (!source) return null;
  const isChain = source === "chain";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
        isChain ? "bg-emerald-950/70 text-emerald-400 border border-emerald-800/60" : "bg-zinc-800 text-zinc-400"
      }`}
    >
      {t(source)}
    </span>
  );
}

function Stat({ k, v, tone = "" }: { k: string; v: string; tone?: string }) {
  return (
    <div>
      <div className="mut">{k}</div>
      <div className={`text-lg font-semibold ${tone}`}>{v}</div>
    </div>
  );
}
