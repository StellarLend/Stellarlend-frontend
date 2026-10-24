"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MARKETS, formatCurrency, formatNumber, formatPercent, type Locale, type Market } from "@/lib/markets";
import { useWallet } from "./wallet";
import { config, explorer } from "@/lib/config";
import { normaliseAmountInput } from "@/lib/amount-input";
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
import {
  buildDemoRateModelSnapshot,
  fetchRateModelSnapshot,
  type RateModelSnapshot,
} from "@/lib/rate-model";
import { RateChart, defaultRateChartLabels, type RateChartLabels } from "./rate-chart";

import MarketCard from "./markets/market-card";
import TradeSheet from "./markets/trade-sheet";

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
  const [rateSnapshot, setRateSnapshot] = useState<RateModelSnapshot>(() =>
    buildDemoRateModelSnapshot()
  );

  const panelRef = useRef<HTMLDivElement | null>(null);

  // Load positions from storage (per-wallet key)
  useEffect(() => {
    const { ledger: loaded, reset } = loadLedger(address);
    // Syncing from localStorage (an external store) when the wallet changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLedger(loaded);
    if (reset) setResetNotice(true);
  }, [address]);

  // Load on-chain rate model params, diagnostics, and utilization history
  useEffect(() => {
    if (!config.lendingId) return;
    let active = true;
    fetchRateModelSnapshot()
      .then((snapshot) => {
        if (active) setRateSnapshot(snapshot);
      })
      .catch(() => {
        if (active) setRateSnapshot(buildDemoRateModelSnapshot());
      });
    return () => {
      active = false;
    };
  }, []);

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

  // Scroll the inline (sm+) panel into view when a market is selected.
  useEffect(() => {
    if (!sel) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 640px)").matches) {
      panelRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [sel]);

  function closeSheet() {
    setSel(null);
    setAmt("");
    setMsg("");
  }

  const { collateralUsd, borrowUsd, health } = useMemo(
    () => computeRisk(ledger, MARKETS),
    [ledger]
  );

  const rateChartLabels = useMemo<Partial<RateChartLabels>>(() => {
    const keys = Object.keys(defaultRateChartLabels) as Array<keyof RateChartLabels>;
    const resolved: Partial<RateChartLabels> = {};
    for (const key of keys) {
      const messageKey = `rateModel.${key}`;
      if (typeof t.has === "function" && t.has(messageKey)) {
        // Do not interpolate template placeholders in RateChartLabels here;
        // RateChart interpolates dynamic values itself via t.raw or defaults.
        const rawVal = typeof t.raw === "function" ? t.raw(messageKey) : undefined;
        if (typeof rawVal === "string") {
          resolved[key] = rawVal;
        }
      }
    }
    return resolved;
  }, [t]);

  function submit() {
    if (!sel) return;
    // Accept locale-formatted input (e.g. "1.234,5" in Spanish), then parse
    // strictly into base units for the BigInt demo ledger.
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
      setMsg({ text: msgs[parsed.error], isError: true });
      return;
    }
    const n = parsed.value;
    if (n <= BigInt(0)) {
      setMsg({ text: t("status.positiveAmount"), isError: true });
      return;
    }
    const rawCur = ledger && typeof ledger === "object" ? ledger[sel.symbol] : undefined;
    const cur =
      rawCur && typeof rawCur === "object" && typeof rawCur.supplied === "bigint" && typeof rawCur.borrowed === "bigint"
        ? rawCur
        : { supplied: BigInt(0), borrowed: BigInt(0) };
    const next = { ...cur };

    if (mode === "supply") {
      next.supplied = cur.supplied + n;
    } else if (mode === "withdraw") {
      if (n > cur.supplied) {
        setMsg({ text: t("status.exceedsSupply"), isError: true });
        return;
      }
      if (!canWithdraw(ledger, sel.symbol, n, MARKETS)) {
        setMsg({ text: t("status.underCollateralised"), isError: true });
        return;
      }
      next.supplied = cur.supplied - n;
    } else if (mode === "borrow") {
      if (!canBorrow(ledger, sel.symbol, n, MARKETS)) {
        setMsg({ text: t("status.exceedsBorrowLimit"), isError: true });
        return;
      }
      next.borrowed = cur.borrowed + n;
    } else if (mode === "repay") {
      if (n > cur.borrowed) {
        setMsg({ text: t("status.exceedsBorrowed"), isError: true });
        return;
      }
      next.borrowed = cur.borrowed - n;
    }

    save({ ...ledger, [sel.symbol]: next });
    setMsg({
      text: t("status.recorded", {
        action: t(mode),
        amount: formatNumber(toFloat(n, sel.decimals), locale, sel.decimals),
        symbol: sel.symbol,
      }),
      isError: false,
    });
    setAmt("");
  }

  function resetDemo() {
    save({});
    setMsg({ text: t("status.demoReset"), isError: false });
    setResetNotice(false);
  }

  function openTrade(m: Market) {
    setSel(m);
    setMsg("");
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

      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm">
          <div className="mut">{t("wallet")}</div>
          {address ? (
            <div className="min-w-0">
              <span className="block truncate font-mono">
                {address.slice(0, 8)}...{address.slice(-6)}
              </span>
              <span className="mut"> - {balance ?? "..."} XLM</span>
            </div>
          ) : (
            <div>{t("demoMode")}</div>
          )}
          {error && <div className="mt-1 text-amber-400">{error}</div>}
        </div>
        {!address && (
          <button className="btn w-full sm:w-auto" onClick={connect}>
            {t("connectFreighter")}
          </button>
        )}
        <div className="grid w-full grid-cols-3 gap-3 text-sm sm:w-auto sm:gap-6">
          <Stat k={t("collateral")} v={formatCurrency(collateralUsd, locale)} />
          <Stat k={t("borrowed")} v={formatCurrency(borrowUsd, locale)} />
          <div>
            <div className="mut">{t("health")}</div>
            <div className={`text-lg font-semibold flex items-center gap-1.5 ${healthData.tone}`}>
              <span>{healthData.label}</span>
              {healthData.badge && (
                <span className="text-xs font-medium inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-current">
                  <span aria-hidden="true">{healthData.icon}</span>
                  <span>{healthData.badge}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 sm:hidden">
        {MARKETS.map((m) => {
          const p = ledger[m.symbol];
          const suppliedFloat = p ? toFloat(p.supplied, m.decimals) : 0;
          const borrowedFloat = p ? toFloat(p.borrowed, m.decimals) : 0;
          return (
            <MarketCard
              key={m.symbol}
              market={m}
              locale={locale}
              supplied={p ? suppliedFloat : null}
              borrowed={p ? borrowedFloat : null}
              onTrade={() => openTrade(m)}
            />
          );
        })}
      </div>

      {/* sm+: table */}
      <div className="card hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="mut">
            <tr className="border-b border-[var(--line)]">
              <th scope="col" className="p-4 font-medium">{t("asset")}</th>
              <th scope="col" className="p-4 font-medium">{t("price")}</th>
              <th scope="col" className="p-4 font-medium">{t("supplyApy")}</th>
              <th scope="col" className="p-4 font-medium">{t("borrowApy")}</th>
              <th scope="col" className="p-4 font-medium">{t("totalSupplied")}</th>
              <th scope="col" className="p-4 font-medium">{t("yourPosition")}</th>
              <th scope="col" className="p-4 font-medium text-right">
                <span className="sr-only">{t("actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {MARKETS.map((m) => {
              const rawP = ledger && typeof ledger === "object" ? ledger[m.symbol] : undefined;
              const p =
                rawP && typeof rawP === "object" && typeof rawP.supplied === "bigint" && typeof rawP.borrowed === "bigint"
                  ? rawP
                  : null;
              const suppliedFloat = p ? toFloat(p.supplied, m.decimals) : 0;
              const borrowedFloat = p ? toFloat(p.borrowed, m.decimals) : 0;
              return (
                <tr key={m.symbol} className="border-b border-[var(--line)] last:border-0">
                  <td className="p-4">
                    <b>{m.symbol}</b> <span className="mut">{m.name}</span>
                  </td>
                  <td className="p-4">{formatCurrency(m.price, locale)}</td>
                  <td className="p-4 text-emerald-400">{formatPercent(m.supplyApy, locale)}</td>
                  <td className="p-4">{formatPercent(m.borrowApy, locale)}</td>
                  <td className="p-4">{formatNumber(m.totalSupply, locale, 0)}</td>
                  <td className="p-4 mut">
                    {p
                      ? `+${formatNumber(suppliedFloat, locale, 4)} / -${formatNumber(borrowedFloat, locale, 4)}`
                      : "-"}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      className="btn-ghost"
                      onClick={() => openTrade(m)}
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

      <TradeSheet
        market={sel}
        mode={mode}
        onModeChange={(x) => {
          setMode(x);
          setMsg("");
        }}
        amount={amt}
        onAmountChange={setAmt}
        onSubmit={submit}
        message={msg}
        onClose={closeSheet}
        panelRef={panelRef}
      />

      <RateChart
        params={rateSnapshot.params}
        diagnostics={rateSnapshot.diagnostics}
        history={rateSnapshot.history}
        source={rateSnapshot.source}
        labels={rateChartLabels}
      />

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

function Stat({ k, v, tone = "" }: { k: string; v: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="mut">{k}</div>
      <div className={`truncate text-base font-semibold sm:text-lg ${tone}`}>{v}</div>
    </div>
  );
}
