"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import {
  MARKETS,
  buildMarketQueryString,
  filterAndSortMarkets,
  formatCurrency,
  formatNumber,
  formatPercent,
  parseMarketQueryParams,
  parseMarketSort,
  type Locale,
  type Market,
  type MarketPositionMap,
  type MarketSortKey,
} from "@/lib/markets";
import { Button, Card, Stat } from "@/components/ui";
import { useWallet } from "./wallet";
import { config, explorer, txExplorer } from "@/lib/config";
import {
  calculateMinReserve,
  needsTrustline,
  classifyTrustlineError,
  type TrustlineErrorKind,
} from "@/lib/horizon";
import { normaliseAmountInput } from "@/lib/amount-input";
import { fetchLiveMarketParams, bpsToPercent } from "@/lib/market-params";
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
import { PortfolioRisk } from "./portfolio-risk";
import { useOracleGuard } from "@/hooks/use-oracle-guard";
import { TradePreview } from "./trade-preview";
import {
  buildDemoRateModelSnapshot,
  fetchRateModelSnapshot,
  type RateModelSnapshot,
} from "@/lib/rate-model";
import {
  RateChart,
  defaultRateChartLabels,
  type RateChartLabels,
  type RateChartOverlay,
} from "./rate-chart";
import { RateSimulator } from "./rate-simulator";

import MarketCard from "./markets/market-card";
import TradeSheet from "./markets/trade-sheet";
import TrustlinePrompt, { TRUSTLINE_ERROR_MESSAGE_KEYS } from "./trustline-prompt";
import { useProtocolStatus } from "./protocol-status";
import { HealthIndicator } from "./health-indicator";
import { TxToastsProvider, TxToastRegion, useTxToasts } from "./tx-toasts";
import { usePendingTxs } from "@/hooks/use-pending-txs";

export default function MarketsApp() {
  return (
    <TxToastsProvider>
      <MarketsAppInner />
      <TxToastRegion />
    </TxToastsProvider>
  );
}

function MarketsAppInner() {
  const { addToast } = useTxToasts();
  const {
    address,
    balance,
    balances,
    rawAccount,
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
  const tStatus = useTranslations("protocolStatus");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQuery = parseMarketQueryParams(searchParams);
  const [searchInput, setSearchInput] = useState(initialQuery.q);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery.q);
  const [sortBy, setSortBy] = useState<MarketSortKey>(initialQuery.sort);
  const [mineOnly, setMineOnly] = useState(initialQuery.mine);
  const { status: protocolStatus, isActionAllowed } = useProtocolStatus();
  const [ledger, setLedger] = useState<Ledger>({});
  const [resetNotice, setResetNotice] = useState(false);
  const [sel, setSel] = useState<Market | null>(null);
  const [mode, setMode] = useState<"supply" | "borrow" | "withdraw" | "repay">("supply");
  const [amt, setAmt] = useState("");
  const [debouncedAmt, setDebouncedAmt] = useState("");
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [position, setPosition] = useState<LendingPosition | null>(null);
  const [positionError, setPositionError] = useState("");
  const [loadingPosition, setLoadingPosition] = useState(false);
  const [tx, setTx] = useState<LendingTx | null>(null);

  // Persistent pending-tx store: persists hashes to localStorage, resumes
  // polling on reload, and surfaces the duplicate guard.
  const pendingTxs = usePendingTxs({
    address,
    onSettled: (entry) => {
      // Invalidate the position query so the UI reflects the confirmed state.
      if (entry.status === "confirmed") {
        void refreshPosition();
      }
    },
  });

  const configured = isOnChainConfigured();
  const onChainMode = Boolean(address && configured);
  const busy = tx?.status === "pending";

  // Classic assets need a trustline before they can be held, supplied or repaid.
  // The shared pure helper matches the selected asset against the Horizon
  // balances map via getAssetKey.
  const missingTrustline = Boolean(address) && needsTrustline(sel, balances);
  const nativeDetail = balances["native"];
  const nativeBalanceXlm = nativeDetail ? Number(nativeDetail.balance) : 0;
  const nativeSellingXlm = nativeDetail ? Number(nativeDetail.sellingLiabilities ?? "0") : 0;
  // Prefer the exact Horizon reserve; fall back to the reserve already excluded from `available`.
  const minReserveXlm = rawAccount
    ? calculateMinReserve(rawAccount)
    : Math.max(
        0,
        nativeBalanceXlm - nativeSellingXlm - (nativeDetail ? Number(nativeDetail.available) : 0)
      );
  const spendableXlm = nativeBalanceXlm - nativeSellingXlm - minReserveXlm;
  const trustlineBlocksAction = missingTrustline && (mode === "supply" || mode === "repay");

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
  const [markets, setMarkets] = useState<Market[]>(MARKETS);
  const [loadingParams, setLoadingParams] = useState(true);

  // Concurrently fetch live market params (LTV, thresholds, caps) without blocking table rendering
  useEffect(() => {
    let active = true;
    fetchLiveMarketParams(MARKETS)
      .then((live) => {
        if (active) setMarkets(live);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingParams(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const [rateSnapshot, setRateSnapshot] = useState<RateModelSnapshot>(() =>
    buildDemoRateModelSnapshot()
  );
  const [rateOverlay, setRateOverlay] = useState<{
    snapshotKey: string;
    overlay: RateChartOverlay;
  } | null>(null);

  const panelRef = useRef<HTMLElement | null>(null);
  const selectedSymbol = sel?.symbol;

  const { prices: oraclePrices, timeSource, isLoading: isLoadingOracle, evaluate: evaluateOracle } = useOracleGuard();
  // Oracle prices and staleness are managed by useOracleGuard (30s React Query refetch).

  const activeMarkets = useMemo<Market[]>(() => {
    return markets.map((m) => {
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
  }, [oraclePrices, markets]);

  // Debounce search input by 150ms before filtering & syncing URL
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Persist search, sort, and position filter in URL query (?q=&sort=&mine=1)
  useEffect(() => {
    const nextQs = buildMarketQueryString(
      { q: debouncedSearch, sort: sortBy, mine: mineOnly },
      searchParams
    );
    if (nextQs === searchParams.toString()) return;
    router.replace(nextQs ? `${pathname}?${nextQs}` : pathname, { scroll: false });
  }, [debouncedSearch, sortBy, mineOnly, pathname, router, searchParams]);

  const marketPositions = useMemo<MarketPositionMap>(() => {
    const map: MarketPositionMap = { ...ledger };
    if (onChainMode && position) {
      for (const m of activeMarkets) {
        if (m.live) {
          map[m.symbol] = {
            supplied: position.collateral,
            borrowed: position.debt,
          };
        }
      }
    }
    return map;
  }, [ledger, onChainMode, position, activeMarkets]);

  const visibleMarkets = useMemo(
    () =>
      filterAndSortMarkets(
        activeMarkets,
        { q: debouncedSearch, sort: sortBy, mine: mineOnly },
        marketPositions
      ),
    [activeMarkets, debouncedSearch, sortBy, mineOnly, marketPositions]
  );

  // Keep the selected market in sync when live params / prices update
  useEffect(() => {
    if (!sel) return;
    const updated = activeMarkets.find((m) => m.symbol === sel.symbol);
    if (updated && updated !== sel) setSel(updated);
  }, [activeMarkets, sel]);

  const hasSupplied = useMemo(() => {
    return Object.values(ledger).some((entry) => entry && entry.supplied > BigInt(0));
  }, [ledger]);
  const [trustlineLoading, setTrustlineLoading] = useState<string | null>(null);
  const [trustlineMsg, setTrustlineMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [trustlineError, setTrustlineError] = useState<{ symbol: string; kind: TrustlineErrorKind } | null>(null);

  async function handleAddTrustline(market: Market) {
    if (market.asset === "native") return;
    setTrustlineLoading(market.symbol);
    setTrustlineMsg(null);
    setTrustlineError(null);
    try {
      await addTrustline(market.asset);
      setTrustlineMsg({ type: "success", text: t("trustlineAdded") });
    } catch (err) {
      const kind = classifyTrustlineError(err);
      setTrustlineError({ symbol: market.symbol, kind });
      setTrustlineMsg({ type: "error", text: t(TRUSTLINE_ERROR_MESSAGE_KEYS[kind]) });
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
    if (!selectedSymbol) return;
    if (typeof window === "undefined") return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 640px)").matches
    ) {
      panelRef.current?.scrollIntoView({ block: "nearest" });
      panelRef.current?.querySelector("h2")?.focus();
    }
  }, [selectedSymbol]);

  function closeSheet() {
    setSel(null);
    setAmt("");
    setMsg(null);
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
  const rateSnapshotKey = [
    rateSnapshot.source,
    ...Object.values(rateSnapshot.params).map((value) => value.toString()),
    rateSnapshot.diagnostics.utilization_bps.toString(),
  ].join(":");

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
    if (!sel || busy || oracleGuard.blocked) return;
    // A missing classic-asset trustline makes supply/repay fail on-chain; block it.
    if (trustlineBlocksAction) return;
    // Accept locale-formatted input (e.g. "1.234,5" in Spanish), then parse
    // strictly into base units.
    const normalized = normaliseAmountInput(amt, locale);
    const parsed = toBaseUnits(normalized ?? amt.trim(), sel.decimals);
    if (!parsed.ok) {
      setMsg({ text: inputErrorText(parsed.error, sel.decimals), isError: true });
      return;
    }
    const n = parsed.value;
    if (n <= BigInt(0)) {
      setMsg({ text: t("status.positiveAmount"), isError: true });
      return;
    }

    if (onChainMode && sel.live && address) {
      setMsg(null);
      const action = mode === "supply" ? "deposit" : mode;

      // Block duplicate: same action + asset already pending.
      if (pendingTxs.isDuplicate(action, sel.symbol)) {
        setMsg({ text: t("status.duplicatePending"), isError: true });
        return;
      }

      const toastId = addToast({
        action,
        symbol: sel.symbol,
        tx: { status: "pending", hash: null, error: null },
      });
      setTx({ status: "pending", hash: null, error: null });
      const result = await submitLendingAction(address, action, n, (updatedTx) => {
        setTx(updatedTx);
        addToast({ id: toastId, action, symbol: sel.symbol, tx: updatedTx });
        // Persist to localStorage as soon as the hash is available.
        if (updatedTx.hash && updatedTx.status === "pending") {
          pendingTxs.record({
            hash: updatedTx.hash,
            action,
            asset: sel.symbol,
            amount: n.toString(),
            submittedAt: Date.now(),
            status: "pending",
          });
        }
      });
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
      // Validate supply against remaining deposit capacity
      if (sel.depositCapRemaining !== null && sel.depositCapRemaining !== undefined && n > sel.depositCapRemaining) {
        setMsg({ text: t("status.depositCapExceeded"), isError: true });
        return;
      }
      next.supplied = cur.supplied + n;
    } else if (mode === "withdraw") {
      if (n > cur.supplied) {
        setMsg({ text: t("status.exceedsSupply"), isError: true });
        return;
      }
      if (!canWithdraw(ledger, sel.symbol, n, activeMarkets)) {
        setMsg({ text: t("status.underCollateralised"), isError: true });
        return;
      }
      next.supplied = cur.supplied - n;
    } else if (mode === "borrow") {
      // Validate borrow against minimum borrow limit
      if (sel.minBorrow !== null && sel.minBorrow !== undefined && n < sel.minBorrow) {
        setMsg({ text: t("status.belowMinimumBorrow"), isError: true });
        return;
      }
      if (!canBorrow(ledger, sel.symbol, n, activeMarkets)) {
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
    setMsg(null);
    setTx(null);
  }

  const isDemoMode = !address;

  const getBlockedReason = (action: "supply" | "borrow" | "withdraw" | "repay") => {
    if (!protocolStatus || protocolStatus.kind === "unknown") return null;
    if (protocolStatus.emergency === "Shutdown") return tStatus("reasonShutdown");
    if (protocolStatus.emergency === "Recovery" && (action === "supply" || action === "borrow")) {
      return tStatus("reasonRecovery");
    }
    if (protocolStatus.paused.All) return tStatus("reasonPaused");
    const pauseKey = action === "supply" ? "Supply" : action === "borrow" ? "Borrow" : action === "withdraw" ? "Withdraw" : "Repay";
    if (protocolStatus.paused[pauseKey]) return tStatus("reasonPaused");
    return null;
  };
  const currentBlockedReason = !isDemoMode ? getBlockedReason(mode) : null;
  const currentBlocked = !isDemoMode && !isActionAllowed(mode);
  const oracleGuard = evaluateOracle(mode);
  const oracleReasonId = oracleGuard.reason ? "oracle-guard-reason" : undefined;
  const tradeActions = ["supply", "borrow", "withdraw", "repay"] as const;

  // Duplicate guard: block re-submission while the same action+asset is pending.
  const lendingAction = mode === "supply" ? "deposit" : mode;
  const duplicatePending =
    onChainMode && Boolean(sel) && pendingTxs.isDuplicate(lendingAction, sel?.symbol ?? "");

  const tradePanel = sel ? (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-1 text-sm" role="tablist" aria-label={`${sel.symbol} ${t("actions")}`}>
        {tradeActions.map((x) => {
          const blockedReason = !isDemoMode ? getBlockedReason(x) : null;
          const isBlocked = !isDemoMode && !isActionAllowed(x);
          return (
            <button
              key={x}
              role="tab"
              data-action={x}
              aria-selected={mode === x}
              tabIndex={mode === x ? 0 : -1}
              disabled={isBlocked}
              title={blockedReason ? tStatus("actionBlockedTooltip", { reason: blockedReason }) : undefined}
              onKeyDown={(event) => {
                const direction =
                  event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                if (!direction) return;

                const tabs = Array.from(
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]:not(:disabled)'
                  ) ?? []
                );
                const currentIndex = tabs.indexOf(event.currentTarget);
                if (currentIndex < 0 || tabs.length < 2) return;

                event.preventDefault();
                const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
                const nextAction = tradeActions.find(
                  (action) => action === nextTab.dataset.action
                );
                if (!nextAction) return;

                nextTab.focus();
                setMode(nextAction);
                setMsg(null);
                setTx(null);
              }}
              onClick={() => {
                if (isBlocked) return;
                setMode(x);
                setMsg(null);
                setTx(null);
              }}
              className={`rounded-lg py-2 ${
                isBlocked
                  ? "opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border border-slate-700"
                  : mode === x
                  ? "btn"
                  : "btn-ghost"
              }`}
            >
              {t(x)}
            </button>
          );
        })}
      </div>
      {currentBlockedReason && (
        <div className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900/60 p-2.5 rounded-lg">
          {tStatus("actionBlockedTooltip", { reason: currentBlockedReason })}
        </div>
      )}
      {missingTrustline && (
        <TrustlinePrompt
          symbol={sel.symbol}
          spendableXlm={spendableXlm}
          issuer={sel.asset !== "native" ? sel.asset.issuer : undefined}
          isAdding={trustlineLoading === sel.symbol}
          error={trustlineError?.symbol === sel.symbol ? trustlineError.kind : null}
          onAdd={() => handleAddTrustline(sel)}
        />
      )}
      <input
        inputMode="decimal"
        placeholder={t("amountIn", { symbol: sel.symbol })}
        value={amt}
        onChange={(e) => setAmt(e.target.value)}
        disabled={busy}
        aria-label={t("amountIn", { symbol: sel.symbol })}
      />
      <button
        className="btn w-full"
        onClick={submit}
        disabled={busy || currentBlocked || trustlineBlocksAction || duplicatePending}
        title={
          duplicatePending
            ? t("status.duplicatePending")
            : currentBlockedReason
            ? tStatus("actionBlockedTooltip", { reason: currentBlockedReason })
            : undefined
        }
      >
        {busy ? t("status.pending") : t("confirm", { action: t(mode) })}
      </button>
      <TradePreview
        currentCollateralUsd={risk.collateralUsd}
        currentBorrowUsd={risk.borrowUsd}
        currentLimitUsd={risk.limitUsd}
        currentHealth={risk.health}
        projected={null}
        oracleGuard={oracleGuard}
        oracleGuardId={oracleReasonId}
      />
      {msg && (
        <p
          className={msg.isError ? "text-amber-400 text-sm" : "mut text-sm"}
          role={msg.isError ? "alert" : "status"}
        >
          {msg.text}
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
        <HealthIndicator />
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

      <PortfolioRisk ledger={marketPositions as Ledger} markets={activeMarkets} />

      {/* Search, sort, and position filter controls */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 sm:max-w-xs">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("controls.searchPlaceholder")}
            aria-label={t("controls.searchLabel")}
            className="w-full"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="mut whitespace-nowrap">{t("controls.sortLabel")}</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(parseMarketSort(e.target.value))}
              aria-label={t("controls.sortLabel")}
              className="rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-sm"
            >
              <option value="default">{t("controls.sortDefault")}</option>
              <option value="supplyApy">{t("controls.sortSupplyApy")}</option>
              <option value="borrowApy">{t("controls.sortBorrowApy")}</option>
              <option value="utilization">{t("controls.sortUtilization")}</option>
            </select>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
              aria-label={t("controls.myPositionsOnly")}
            />
            <span>{t("controls.myPositionsOnly")}</span>
          </label>
        </div>
      </Card>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 sm:hidden">
        {visibleMarkets.length === 0 ? (
          <Card className="p-6 text-center text-sm mut" role="status">
            {t("controls.noResults")}
          </Card>
        ) : (
          visibleMarkets.map((m) => {
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
          })
        )}
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
        <table aria-label={t("title")} className="w-full min-w-[640px] text-left text-sm">
          <thead className="mut">
            <tr className="border-b border-[var(--line)]">
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
                t("wallet"),
                t("trade"),
              ].map((h) => (
                <th key={String(h)} scope="col" className="p-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleMarkets.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-6 text-center text-sm mut" role="status">
                  {t("controls.noResults")}
                </td>
              </tr>
            ) : (
              visibleMarkets.map((m) => {
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
              const ltvDisplay = m.ltvBps !== undefined ? bpsToPercent(m.ltvBps) : m.ltv * 100;
              const liqThresholdDisplay = m.liqThresholdBps !== undefined ? bpsToPercent(m.liqThresholdBps) : 80;
              const capBigInt = m.supplyCap ?? BigInt(0);
              const isUncapped = capBigInt === BigInt(0);
              const capFloat = isUncapped ? null : toFloat(capBigInt, m.decimals);
              const capacityPercent =
                capFloat && capFloat > 0 ? Math.min(100, Math.round((m.totalSupply / capFloat) * 100)) : 0;
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
                            className={`h-full rounded-full ${capacityPercent > 90 ? "bg-rose-500" : "bg-emerald-500"}`}
                            style={{ width: `${capacityPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
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
                      <Button variant="ghost" aria-label={`${t("trade")} ${m.symbol}`} onClick={() => openTrade(m)}>
                        {t("trade")}
                      </Button>
                    ) : (
                      <span className="mut">{t("comingSoon")}</span>
                    )}
                  </td>
                </tr>
              );
            })
            )}
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
          <section
            ref={panelRef}
            aria-labelledby={`trade-heading-${sel.symbol}`}
            className="card hidden max-w-md space-y-4 p-6 sm:block"
          >
            <div className="flex items-center justify-between">
              <h2 id={`trade-heading-${sel.symbol}`} tabIndex={-1} className="text-xl font-semibold">{sel.symbol}</h2>
              {sel.depositCapRemaining !== null && sel.depositCapRemaining !== undefined && (
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                  {t("remainingCapacity", {
                    amount: formatNumber(toFloat(sel.depositCapRemaining, sel.decimals), locale, 2),
                    symbol: sel.symbol,
                  })}
                </span>
              )}
            </div>
            {tradePanel}
          </section>
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
        overlay={
          rateOverlay?.snapshotKey === rateSnapshotKey
            ? rateOverlay.overlay
            : undefined
        }
      />
      <RateSimulator
        key={rateSnapshotKey}
        params={rateSnapshot.params}
        utilizationBps={rateSnapshot.diagnostics.utilization_bps}
        onOverlayChange={(overlay) =>
          setRateOverlay(overlay ? { snapshotKey: rateSnapshotKey, overlay } : null)
        }
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
