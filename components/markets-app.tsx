"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  buildMarketQueryString, filterAndSortMarkets, formatCurrency, formatNumber,
  parseMarketQueryParams, type Locale, type Market, type MarketSortKey,
} from "@/lib/markets";
import { Card } from "@/components/ui";
import { useWallet } from "./wallet";
import { calculateMinReserve, needsTrustline, classifyTrustlineError, type TrustlineErrorKind } from "@/lib/horizon";
import { isOnChainConfigured, normaliseHealthFactor } from "@/lib/lending-client";
import { OnboardingChecklist } from "./onboarding-checklist";
import { toFloat, computeRisk, DECIMALS, type Ledger } from "@/lib/demo-ledger";
import OraclePanel from "./oracle-panel";
import { PortfolioRisk } from "./portfolio-risk";
import { useOracleGuard } from "@/hooks/use-oracle-guard";
import { buildDemoRateModelSnapshot, fetchRateModelSnapshot, type RateModelSnapshot } from "@/lib/rate-model";
import { RateChart, defaultRateChartLabels, type RateChartLabels, type RateChartOverlay } from "./rate-chart";
import { RateSimulator } from "./rate-simulator";
import MarketCard from "./markets/market-card";
import TradeSheet from "./markets/trade-sheet";
import TrustlinePrompt, { TRUSTLINE_ERROR_MESSAGE_KEYS } from "./trustline-prompt";
import { useProtocolStatus } from "./protocol-status";
import { TxToastsProvider, TxToastRegion, useTxToasts } from "./tx-toasts";
import { usePendingTxs } from "@/hooks/use-pending-txs";
import { config, explorer } from "@/lib/config";
import { useMarketParams } from "@/hooks/use-market-params";
import { usePositions } from "@/hooks/use-positions";
import { useTradeSubmit } from "@/hooks/use-trade-submit";
import { MarketsSummary } from "./markets/markets-summary";
import { MarketsTable } from "./markets/markets-table";
import { MarketsControls } from "./markets/markets-controls";
import { TradePanel } from "./markets/trade-panel";

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
  const { address, balance, balances, rawAccount, isUnfunded, error, openPicker, addTrustline, accountStatus, isFunding, fundError, fundAccount } = useWallet();
  const locale = useLocale() as Locale;
  const t = useTranslations("market");
  const tStatus = useTranslations("protocolStatus");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQuery = parseMarketQueryParams(searchParams);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState(initialQuery.q);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery.q);
  const [sortBy, setSortBy] = useState<MarketSortKey>(initialQuery.sort);
  const [mineOnly, setMineOnly] = useState(initialQuery.mine);
  const [sel, setSel] = useState<Market | null>(null);
  const [mode, setMode] = useState<"supply" | "borrow" | "withdraw" | "repay">("supply");
  const [amt, setAmt] = useState("");
  const [trustlineLoading, setTrustlineLoading] = useState<string | null>(null);
  const [trustlineMsg, setTrustlineMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [trustlineError, setTrustlineError] = useState<{ symbol: string; kind: TrustlineErrorKind } | null>(null);
  const [rateSnapshot, setRateSnapshot] = useState<RateModelSnapshot>(() => buildDemoRateModelSnapshot());
  const [rateOverlay, setRateOverlay] = useState<{ snapshotKey: string; overlay: RateChartOverlay } | null>(null);

  // ── Data hooks ───────────────────────────────────────────────────────────
  const { markets: baseMarkets, isLoading: loadingParams } = useMarketParams();
  const { prices: oraclePrices, timeSource, isLoading: isLoadingOracle, evaluate: evaluateOracle } = useOracleGuard();
  const { status: protocolStatus, isActionAllowed } = useProtocolStatus();

  const activeMarkets = useMemo<Market[]>(() => baseMarkets.map((m) => {
    const rec = (m.contractId && oraclePrices[m.contractId]) || (m.symbol === "USDC" && config.tokenId && oraclePrices[config.tokenId]) || Object.values(oraclePrices).find((op) => op.symbol.toLowerCase() === m.symbol.toLowerCase());
    return rec && rec.priceNumber !== null ? { ...m, price: rec.priceNumber, priceSource: "oracle" as const } : { ...m, priceSource: "demo" as const };
  }), [oraclePrices, baseMarkets]);

  const { position, isLoadingPosition, positionError, ledger, saveLedgerEntry: save, resetNotice, dismissResetNotice, marketPositions, refreshPosition } = usePositions(address, activeMarkets, t("status.positionError"));
  const configured = isOnChainConfigured();
  const onChainMode = Boolean(address && configured);
  const pendingTxs = usePendingTxs({ address, onSettled: (e) => { if (e.status === "confirmed") void refreshPosition(); } });
  const oracleGuard = evaluateOracle(mode);
  const missingTrustline = Boolean(address) && needsTrustline(sel, balances);
  const { tx, msg, busy, setMsg, setTx, submit } = useTradeSubmit({ sel, mode, amt, ledger, activeMarkets, address, missingTrustline, oracleGuard, pendingTxs, addToast, onConfirmed: () => { void refreshPosition(); }, onLedgerUpdate: save, onAmtClear: () => setAmt("") });

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!config.lendingId) return;
    let active = true;
    fetchRateModelSnapshot().then((s) => { if (active) setRateSnapshot(s); }).catch(() => { if (active) setRateSnapshot(buildDemoRateModelSnapshot()); });
    return () => { active = false; };
  }, []);
  useEffect(() => { const id = setTimeout(() => setDebouncedSearch(searchInput), 150); return () => clearTimeout(id); }, [searchInput]);
  useEffect(() => {
    const nextQs = buildMarketQueryString({ q: debouncedSearch, sort: sortBy, mine: mineOnly }, searchParams);
    if (nextQs !== searchParams.toString()) router.replace(nextQs ? `${pathname}?${nextQs}` : pathname, { scroll: false });
  }, [debouncedSearch, sortBy, mineOnly, pathname, router, searchParams]);
  useEffect(() => { if (!sel) return; const u = activeMarkets.find((m) => m.symbol === sel.symbol); if (u && u !== sel) setSel(u); }, [activeMarkets, sel]);

  // Panel scroll/focus
  const panelRef = useRef<HTMLElement | null>(null);
  const selectedSymbol = sel?.symbol;
  useEffect(() => {
    if (!selectedSymbol || typeof window === "undefined") return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(min-width: 640px)").matches) { panelRef.current?.scrollIntoView({ block: "nearest" }); panelRef.current?.querySelector("h2")?.focus(); }
  }, [selectedSymbol]);

  // ── Derived display values ───────────────────────────────────────────────
  const risk = useMemo(() => computeRisk(ledger, activeMarkets), [ledger, activeMarkets]);
  const health = onChainMode ? (position ? normaliseHealthFactor(position.healthFactor) : null) : risk.health;
  const collateralText = onChainMode ? (position ? t("xlmAmount", { amount: formatNumber(toFloat(position.collateral, DECIMALS), locale, 4) }) : "-") : formatCurrency(risk.collateralUsd, locale);
  const borrowedText = onChainMode ? (position ? t("xlmAmount", { amount: formatNumber(toFloat(position.debt, DECIMALS), locale, 4) }) : "-") : formatCurrency(risk.borrowUsd, locale);
  const hasSupplied = useMemo(() => Object.values(ledger).some((e) => e && e.supplied > BigInt(0)), [ledger]);
  const visibleMarkets = useMemo(() => filterAndSortMarkets(activeMarkets, { q: debouncedSearch, sort: sortBy, mine: mineOnly }, marketPositions), [activeMarkets, debouncedSearch, sortBy, mineOnly, marketPositions]);
  const nativeDetail = balances["native"];
  const nativeXlm = nativeDetail ? Number(nativeDetail.balance) : 0;
  const sellingXlm = nativeDetail ? Number(nativeDetail.sellingLiabilities ?? "0") : 0;
  const minReserveXlm = rawAccount ? calculateMinReserve(rawAccount) : Math.max(0, nativeXlm - sellingXlm - (nativeDetail ? Number(nativeDetail.available) : 0));
  const spendableXlm = nativeXlm - sellingXlm - minReserveXlm;

  // ── Protocol status helpers ──────────────────────────────────────────────
  const getBlockedReason = useCallback((action: "supply" | "borrow" | "withdraw" | "repay") => {
    if (!protocolStatus || protocolStatus.kind === "unknown") return null;
    if (protocolStatus.emergency === "Shutdown") return tStatus("reasonShutdown");
    if (protocolStatus.emergency === "Recovery" && (action === "supply" || action === "borrow")) return tStatus("reasonRecovery");
    if (protocolStatus.paused.All) return tStatus("reasonPaused");
    const pk = { supply: "Supply", borrow: "Borrow", withdraw: "Withdraw", repay: "Repay" }[action];
    if (pk && protocolStatus.paused[pk]) return tStatus("reasonPaused");
    return null;
  }, [protocolStatus, tStatus]);

  const isDemoMode = !address;
  const currentBlocked = !isDemoMode && !isActionAllowed(mode);
  const currentBlockedReason = !isDemoMode ? getBlockedReason(mode) : null;
  const lendingAction = mode === "supply" ? "deposit" : mode;
  const duplicatePending = onChainMode && Boolean(sel) && pendingTxs.isDuplicate(lendingAction, sel?.symbol ?? "");

  // ── Trustline ────────────────────────────────────────────────────────────
  async function handleAddTrustline(market: Market) {
    if (market.asset === "native") return;
    setTrustlineLoading(market.symbol); setTrustlineMsg(null); setTrustlineError(null);
    try {
      await addTrustline(market.asset);
      setTrustlineMsg({ type: "success", text: t("trustlineAdded") });
    } catch (err) {
      const kind = classifyTrustlineError(err);
      setTrustlineError({ symbol: market.symbol, kind });
      setTrustlineMsg({ type: "error", text: t(TRUSTLINE_ERROR_MESSAGE_KEYS[kind]) });
    } finally { setTrustlineLoading(null); }
  }

  // ── Rate chart ───────────────────────────────────────────────────────────
  const rateChartLabels = useMemo<Partial<RateChartLabels>>(() => {
    const out: Partial<RateChartLabels> = {};
    for (const k of Object.keys(defaultRateChartLabels) as Array<keyof RateChartLabels>) {
      const mk = `rateModel.${k}`;
      if (typeof t.has === "function" && t.has(mk)) { const v = typeof t.raw === "function" ? t.raw(mk) : undefined; if (typeof v === "string") out[k] = v; }
    }
    return out;
  }, [t]);
  const rateSnapshotKey = [rateSnapshot.source, ...Object.values(rateSnapshot.params).map((v) => v.toString()), rateSnapshot.diagnostics.utilization_bps.toString()].join(":");

  function openTrade(m: Market) { setSel(m); setMsg(null); setTx(null); }
  function closeSheet() { setSel(null); setAmt(""); setMsg(null); }
  function resetDemo() { save({}); setMsg({ text: t("status.demoReset"), isError: false }); dismissResetNotice(); }
  function changeMode(next: "supply" | "borrow" | "withdraw" | "repay") { setMode(next); setMsg(null); setTx(null); }

  const tradePanelNode = sel ? (
    <TradePanel sel={sel} mode={mode} amt={amt} busy={busy} tx={tx} msg={msg} oracleGuard={oracleGuard} risk={risk}
      currentBlocked={currentBlocked} currentBlockedReason={currentBlockedReason} duplicatePending={duplicatePending}
      missingTrustline={missingTrustline} trustlineLoading={trustlineLoading} trustlineError={trustlineError}
      spendableXlm={spendableXlm} isDemoMode={isDemoMode} getBlockedReason={getBlockedReason}
      isActionAllowed={isActionAllowed} onModeChange={changeMode} onAmtChange={setAmt} onConfirm={submit}
      onAddTrustline={handleAddTrustline} />
  ) : null;

  return (
    <div className="space-y-8">
      <div><h1 className="text-3xl font-bold">{t("title")}</h1><p className="mut mt-1 text-sm">{t("subtitle")}</p></div>
      <OnboardingChecklist hasSupplied={hasSupplied} />
      {resetNotice && <Card className="p-4 text-sm text-amber-400" role="alert">{t("status.storageReset")}</Card>}
      <MarketsSummary address={address} balance={balance} isUnfunded={isUnfunded} error={error} positionError={positionError} isLoadingPosition={isLoadingPosition} isFunding={isFunding} fundError={fundError} accountStatus={accountStatus} onChainMode={onChainMode} collateralText={collateralText} borrowedText={borrowedText} health={health} onConnect={openPicker} onFund={fundAccount} />
      <PortfolioRisk ledger={marketPositions as Ledger} markets={activeMarkets} />
      <MarketsControls searchInput={searchInput} sortBy={sortBy} mineOnly={mineOnly} onSearchChange={setSearchInput} onSortChange={setSortBy} onMineChange={setMineOnly} />
      <div className="space-y-3 sm:hidden">
        {visibleMarkets.length === 0
          ? <Card className="p-6 text-center text-sm mut" role="status">{t("controls.noResults")}</Card>
          : visibleMarkets.map((m) => { const p = ledger[m.symbol]; return <MarketCard key={m.symbol} market={m} locale={locale} supplied={p ? toFloat(p.supplied, m.decimals) : null} borrowed={p ? toFloat(p.borrowed, m.decimals) : null} onTrade={() => openTrade(m)} />; })}
      </div>
      {trustlineMsg && <Card className={`p-4 text-sm ${trustlineMsg.type === "error" ? "text-red-400" : "text-emerald-400"}`} role="alert">{trustlineMsg.text}</Card>}
      <MarketsTable markets={visibleMarkets} ledger={ledger} position={position} address={address} isUnfunded={isUnfunded} onChainMode={onChainMode} loadingParams={loadingParams} balances={balances as Record<string, { available: string; balance: string; assetType?: string }>} trustlineLoading={trustlineLoading} onTrade={openTrade} onAddTrustline={handleAddTrustline} />
      <OraclePanel prices={oraclePrices} timeSource={timeSource} isLoading={isLoadingOracle} />
      {sel && (
        <>
          <section ref={panelRef} aria-labelledby={`trade-heading-${sel.symbol}`} className="card hidden max-w-md space-y-4 p-6 sm:block">
            <div className="flex items-center justify-between">
              <h2 id={`trade-heading-${sel.symbol}`} tabIndex={-1} className="text-xl font-semibold">{sel.symbol}</h2>
              {sel.depositCapRemaining != null && <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">{t("remainingCapacity", { amount: formatNumber(toFloat(sel.depositCapRemaining, sel.decimals), locale, 2), symbol: sel.symbol })}</span>}
            </div>
            {tradePanelNode}
          </section>
          <TradeSheet open={Boolean(sel)} onClose={closeSheet} title={sel.symbol} subtitle={sel.name}>{tradePanelNode}</TradeSheet>
        </>
      )}
      <RateChart params={rateSnapshot.params} diagnostics={rateSnapshot.diagnostics} history={rateSnapshot.history} source={rateSnapshot.source} labels={rateChartLabels} overlay={rateOverlay?.snapshotKey === rateSnapshotKey ? rateOverlay.overlay : undefined} />
      <RateSimulator key={rateSnapshotKey} params={rateSnapshot.params} utilizationBps={rateSnapshot.diagnostics.utilization_bps} onOverlayChange={(ov) => setRateOverlay(ov ? { snapshotKey: rateSnapshotKey, overlay: ov } : null)} />
      <div className="flex items-center justify-between text-xs mut">
        <p>{t("contract")}:{" "}{config.lendingId ? <a className="break-all underline" href={explorer(config.lendingId)} target="_blank" rel="noreferrer">{config.lendingId}</a> : t("notDeployed")}</p>
        <button className="btn-ghost text-xs" onClick={resetDemo}>{t("resetDemo")}</button>
      </div>
    </div>
  );
}
