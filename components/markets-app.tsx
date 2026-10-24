"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MARKETS, formatCurrency, formatNumber, formatPercent, type Locale, type Market } from "@/lib/markets";
import { Button, Card, Stat } from "@/components/ui";
import { useWallet } from "./wallet";
import { config, explorer, txExplorer } from "@/lib/config";
import { normaliseAmountInput } from "@/lib/amount-input";
import { toBaseUnits, DECIMALS, type AmountError } from "@/lib/amount";
import {
  isOnChainConfigured,
  normaliseHealthFactor,
  readPosition,
  submitLendingAction,
  type LendingPosition,
  type LendingTx,
} from "@/lib/lending-client";
import { OnboardingChecklist } from "./onboarding-checklist";
import {
  loadLedger,
  saveLedger,
  toFloat,
  computeRisk,
  canWithdraw,
  canBorrow,
  storageKey,
  type Ledger,
} from "@/lib/demo-ledger";
import OraclePanel from "./oracle-panel";
import { fetchOracleAssetPrices, type OracleAssetPrice } from "@/lib/oracle";
import {
  buildDemoRateModelSnapshot,
  fetchRateModelSnapshot,
  type RateModelSnapshot,
} from "@/lib/rate-model";
import { RateChart, defaultRateChartLabels, type RateChartLabels } from "./rate-chart";

import MarketCard from "./markets/market-card";
import TradeSheet from "./markets/trade-sheet";

export default function MarketsApp() {
  const {
    address,
    balance,
    balances,
    isUnfunded,
    error,
    openPicker,
    addTrustline,
    accountStatus,
    isFunding,
    fundError,
    fundAccount,
  } = useWallet();
  const tw = useTranslations("wallet");
  const locale = useLocale() as Locale;
  const t = useTranslations("market");
  const [ledger, setLedger] = useState<Ledger>({});
  const [resetNotice, setResetNotice] = useState(false);
  const [sel, setSel] = useState<Market | null>(null);
  const [mode, setMode] = useState<"supply" | "borrow" | "withdraw" | "repay">("supply");
  const [amt, setAmt] = useState("");
  const [debouncedAmt, setDebouncedAmt] = useState("");
  const [msg, setMsg] = useState("");
  const [position, setPosition] = useState<LendingPosition | null>(null);
  const [positionError, setPositionError] = useState("");
  const [loadingPosition, setLoadingPosition] = useState(false);
  const [tx, setTx] = useState<LendingTx | null>(null);

  const configured = isOnChainConfigured();
  const onChainMode = Boolean(address && configured);
  const busy = tx?.status === "pending";

  const refreshPosition = useCallback(async () => {
    if (!address || !configured) {
      setPosition(null);
      setPositionError("");
      return;
    }
    setLoadingPosition(true);
    setPositionError("");
    try {
      setPosition(await readPosition(address));
    } catch {
      setPosition(null);
      setPositionError(t("status.positionError"));
    } finally {
      setLoadingPosition(false);
    }
  }, [address, configured, t]);
  const [rateSnapshot, setRateSnapshot] = useState<RateModelSnapshot>(() =>
    buildDemoRateModelSnapshot()
  );

  const panelRef = useRef<HTMLDivElement | null>(null);

  const [oraclePrices, setOraclePrices] = useState<Record<string, OracleAssetPrice>>({});
  const [timeSource, setTimeSource] = useState<"ledger" | "browser">("ledger");
  const [isLoadingOracle, setIsLoadingOracle] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoadingOracle(true);
    fetchOracleAssetPrices()
      .then((res) => {
        if (!active) return;
        setOraclePrices(res.prices);
        setTimeSource(res.timeSource);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingOracle(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeMarkets = useMemo<Market[]>(() => {
    return MARKETS.map((m) => {
      const matchingRecord =
        (m.contractId && oraclePrices[m.contractId]) ||
        (m.symbol === "USDC" && config.tokenId && oraclePrices[config.tokenId]) ||
        Object.values(oraclePrices).find(
          (op) => op.symbol.toLowerCase() === m.symbol.toLowerCase()
        );

      if (matchingRecord && matchingRecord.priceNumber !== null) {
        return {
          ...m,
          price: matchingRecord.priceNumber,
          priceSource: "oracle" as const,
        };
      }

      return {
        ...m,
        priceSource: "demo" as const,
      };
    });
  }, [oraclePrices]);

  const hasSupplied = useMemo(() => {
    return Object.values(ledger).some((entry) => entry && entry.supplied > BigInt(0));
  }, [ledger]);
  const [trustlineLoading, setTrustlineLoading] = useState<string | null>(null);
  const [trustlineMsg, setTrustlineMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleAddTrustline(market: Market) {
    if (market.asset === "native") return;
    setTrustlineLoading(market.symbol);
    setTrustlineMsg(null);
    try {
      await addTrustline(market.asset);
      setTrustlineMsg({ type: "success", text: t("trustlineAdded") });
    } catch (err: any) {
      const errorText = err?.message || t("txCancelled");
      setTrustlineMsg({ type: "error", text: errorText });
    } finally {
      setTrustlineLoading(null);
    }
  }

  // Load positions from storage (per-wallet key)
  useEffect(() => {
    const { ledger: loaded, reset } = loadLedger(address);
    // Syncing from localStorage (an external store) when the wallet changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLedger(loaded);
    if (reset) setResetNotice(true);
  }, [address]);

  // Refresh the on-chain position on connect and wallet reconnection.
  useEffect(() => {
    void refreshPosition();
  }, [refreshPosition]);
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

  const risk = useMemo(() => computeRisk(ledger, activeMarkets), [ledger, activeMarkets]);

  const health = onChainMode
    ? (position ? normaliseHealthFactor(position.healthFactor) : null)
    : risk.health;
  const collateralText = onChainMode
    ? position
      ? t("xlmAmount", { amount: formatNumber(toFloat(position.collateral, DECIMALS), locale, 4) })
      : "-"
    : formatCurrency(risk.collateralUsd, locale);
  const borrowedText = onChainMode
    ? position
      ? t("xlmAmount", { amount: formatNumber(toFloat(position.debt, DECIMALS), locale, 4) })
      : "-"
    : formatCurrency(risk.borrowUsd, locale);

  function inputErrorText(error: AmountError, decimals: number): string {
    const msgs: Record<string, string> = {
      empty: t("status.positiveAmount"),
      "invalid-format": t("status.invalidFormat"),
      negative: t("status.negative"),
      "too-many-decimals": t("status.tooManyDecimals", { decimals }),
      "too-large": t("status.tooLarge"),
    };
    return msgs[error] ?? t("status.invalidFormat");
  }

  async function submit() {
    if (!sel || busy) return;
    // Accept locale-formatted input (e.g. "1.234,5" in Spanish), then parse
    // strictly into base units.
    const normalized = normaliseAmountInput(amt, locale);
    const parsed = toBaseUnits(normalized ?? amt.trim(), sel.decimals);
    if (!parsed.ok) {
      setMsg(inputErrorText(parsed.error, sel.decimals));
      return;
    }
    const n = parsed.value;
    if (n <= BigInt(0)) {
      setMsg(t("status.positiveAmount"));
      return;
    }

    if (onChainMode && sel.live && address) {
      setMsg("");
      setTx({ status: "pending", hash: null, error: null });
      const action = mode === "supply" ? "deposit" : mode;
      const result = await submitLendingAction(address, action, n, setTx);
      if (result.status === "confirmed") {
        setAmt("");
        await refreshPosition();
      }
      return;
    }

    // Demo ledger path (no wallet, or contract not configured).
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
        setMsg(t("status.exceedsSupply"));
        return;
      }
      if (!canWithdraw(ledger, sel.symbol, n, activeMarkets)) {
        setMsg(t("status.underCollateralised"));
        return;
      }
      next.supplied = cur.supplied - n;
    } else if (mode === "borrow") {
      if (!canBorrow(ledger, sel.symbol, n, activeMarkets)) {
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

  function transactionStatus() {
    if (!tx || tx.status === "pending") return null;
    if (tx.status === "confirmed") {
      return t("status.confirmed");
    }
    if (tx.status === "cancelled") {
      return t("status.cancelled");
    }
    if (tx.status === "timeout") {
      return t("status.timedOut");
    }
    const detail = tx.error?.message ?? t("status.failed");
    return tx.error?.hint ? `${detail} ${tx.error.hint}` : detail;
  }

  function openTrade(m: Market) {
    setSel(m);
    setMsg("");
    setTx(null);
  }

  const tradePanel = sel ? (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-1 text-sm">
        {(["supply", "borrow", "withdraw", "repay"] as const).map((x) => (
          <button
            key={x}
            onClick={() => {
              setMode(x);
              setMsg("");
              setTx(null);
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
        disabled={busy}
        aria-label={t("amountIn", { symbol: sel.symbol })}
      />
      <button className="btn w-full" onClick={submit} disabled={busy}>
        {busy ? t("status.pending") : t("confirm", { action: t(mode) })}
      </button>
      {msg && (
        <p className="mut text-sm" role="status">
          {msg}
        </p>
      )}
      {tx && (
        <div className="text-sm" role="status">
          <p className={tx.status === "failed" ? "text-red-300" : tx.status === "confirmed" ? "text-emerald-400" : "mut"}>
            {transactionStatus()}
          </p>
          {tx.hash && (
            <a
              className="break-all underline"
              href={txExplorer(tx.hash)}
              target="_blank"
              rel="noreferrer"
            >
              {t("viewTx")}
            </a>
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mut mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <OnboardingChecklist hasSupplied={hasSupplied} />

      {resetNotice && (
        <Card className="p-4 text-sm text-amber-400" role="alert">
          {t("status.storageReset")}
        </Card>
      )}

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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
          {onChainMode && <div className="mut text-xs">{t("onchainMode")}</div>}
          {address && !onChainMode && <div className="mut text-xs">{t("status.demoFallback")}</div>}
          {error && <div className="mt-1 text-amber-400">{error}</div>}
          {positionError && <div className="mt-1 text-amber-400">{positionError}</div>}
          {loadingPosition && <div className="mut text-xs">{t("status.loadingPosition")}</div>}
          {fundError && <div className="mt-1 text-red-400">{fundError}</div>}
        </div>
        {address && config.network === "testnet" && accountStatus === "unfunded" && (
          <button
            className="btn text-xs py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded"
            onClick={fundAccount}
            disabled={isFunding}
          >
            {isFunding ? tw("funding") : tw("fundWithFriendbot")}
          </button>
        )}
        {!address && (
          <Button variant="primary" className="w-full sm:w-auto" onClick={openPicker}>
            {t("connectFreighter")}
          </Button>
        )}
        <div className="grid w-full grid-cols-3 gap-3 text-sm sm:w-auto sm:gap-6">
          <Stat k={t("collateral")} v={collateralText} />
          <Stat k={t("borrowed")} v={borrowedText} />
          <Stat
            k={t("health")}
            v={health === Infinity || health === null ? t("nA") : formatNumber(health, locale)}
            tone={health !== null && health < 1.2 ? "danger" : "positive"}
          />
        </div>
      </Card>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 sm:hidden">
        {activeMarkets.map((m) => {
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

      {trustlineMsg && (
        <Card
          className={`p-4 text-sm ${trustlineMsg.type === "error" ? "text-red-400" : "text-emerald-400"}`}
          role="alert"
        >
          {trustlineMsg.text}
        </Card>
      )}

      {/* sm+: table */}
      <Card className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="mut">
            <tr className="border-b border-[var(--line)]">
              {[t("asset"), t("price"), t("supplyApy"), t("borrowApy"), t("totalSupplied"), t("yourPosition"), t("wallet"), ""].map((h) => (
                <th key={String(h)} className="p-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeMarkets.map((m) => {
              const rawP = ledger && typeof ledger === "object" ? ledger[m.symbol] : undefined;
              const p =
                rawP && typeof rawP === "object" && typeof rawP.supplied === "bigint" && typeof rawP.borrowed === "bigint"
                  ? rawP
                  : null;
              const suppliedFloat = p ? toFloat(p.supplied, m.decimals) : 0;
              const borrowedFloat = p ? toFloat(p.borrowed, m.decimals) : 0;
              const live = Boolean(m.live);
              const onchainRow = live && onChainMode && position
                ? `+${formatNumber(toFloat(position.collateral, DECIMALS), locale, 4)} / -${formatNumber(toFloat(position.debt, DECIMALS), locale, 4)}`
                : null;
              const isOracle = m.priceSource === "oracle";
              return (
                <tr key={m.symbol} className="border-b border-[var(--line)] last:border-0">
                  <td className="p-4">
                    <b>{m.symbol}</b> <span className="mut">{m.name}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <span>{formatCurrency(m.price, locale)}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-medium border ${
                          isOracle
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                        }`}
                      >
                        {isOracle ? t("oracle.oracleSource") : t("oracle.demoSource")}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-emerald-400">{formatPercent(m.supplyApy, locale)}</td>
                  <td className="p-4">{formatPercent(m.borrowApy, locale)}</td>
                  <td className="p-4">{formatNumber(m.totalSupply, locale, 0)}</td>
                  <td className="p-4 mut">
                    {live
                      ? onChainMode
                        ? onchainRow ?? "-"
                        : p
                          ? `+${formatNumber(suppliedFloat, locale, 4)} / -${formatNumber(borrowedFloat, locale, 4)}`
                          : "-"
                      : "-"}
                  </td>
                  <td className="p-4" data-testid={`wallet-balance-${m.symbol}`}>
                    {!address ? (
                      <span className="mut">-</span>
                    ) : isUnfunded ? (
                      <span className="mut text-xs">{t("unfunded")}</span>
                    ) : m.asset === "native" ? (
                      <span>
                        {balances["native"]
                          ? `${formatNumber(Number(balances["native"].available), locale, 2)} XLM`
                          : "0.00 XLM"}
                      </span>
                    ) : (() => {
                      const key = `${m.asset.code}:${m.asset.issuer}`;
                      const detail = balances[key] || balances[m.asset.code];
                      if (detail) {
                        return (
                          <span>
                            {formatNumber(Number(detail.available), locale, 2)} {m.symbol}
                          </span>
                        );
                      }
                      const isLoading = trustlineLoading === m.symbol;
                      return (
                        <button
                          className="btn-ghost text-xs px-2 py-1 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded"
                          onClick={() => handleAddTrustline(m)}
                          disabled={isLoading}
                          aria-label={t("addTrustline")}
                        >
                          {isLoading ? t("addingTrustline") : t("addTrustline")}
                        </button>
                      );
                    })()}
                  </td>
                  <td className="p-4 text-right">
                    {live ? (
                      <Button variant="ghost" onClick={() => openTrade(m)}>
                        {t("trade")}
                      </Button>
                    ) : (
                      <span className="mut">{t("comingSoon")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <OraclePanel
        prices={oraclePrices}
        timeSource={timeSource}
        isLoading={isLoadingOracle}
      />

      {sel && (
        <>
          {/* sm+: inline trade panel */}
          <div ref={panelRef} className="card hidden max-w-md space-y-4 p-6 sm:block">
            <h2 className="text-xl font-semibold">{sel.symbol}</h2>
            {tradePanel}
          </div>
          {/* Mobile: bottom sheet */}
          <TradeSheet open={Boolean(sel)} onClose={closeSheet} title={sel.symbol} subtitle={sel.name}>
            {tradePanel}
          </TradeSheet>
        </>
      )}

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
        <Button variant="ghost" size="sm" className="text-xs" onClick={resetDemo}>
          {t("resetDemo")}
        </Button>
      </div>
    </div>
  );
}

