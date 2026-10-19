"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MARKETS, formatCurrency, formatNumber, formatPercent, type Locale, type Market } from "@/lib/markets";
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

  const risk = useMemo(() => computeRisk(ledger, MARKETS), [ledger]);

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
    const cur = ledger[sel.symbol] ?? { supplied: BigInt(0), borrowed: BigInt(0) };
    const next = { ...cur };

    if (mode === "supply") {
      next.supplied = cur.supplied + n;
    } else if (mode === "withdraw") {
      if (n > cur.supplied) {
        setMsg(t("status.exceedsSupply"));
        return;
      }
      if (!canWithdraw(ledger, sel.symbol, n, MARKETS)) {
        setMsg(t("status.underCollateralised"));
        return;
      }
      next.supplied = cur.supplied - n;
    } else if (mode === "borrow") {
      if (!canBorrow(ledger, sel.symbol, n, MARKETS)) {
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
          {onChainMode && <div className="mut text-xs">{t("onchainMode")}</div>}
          {address && !onChainMode && <div className="mut text-xs">{t("status.demoFallback")}</div>}
          {error && <div className="mt-1 text-amber-400">{error}</div>}
          {positionError && <div className="mt-1 text-amber-400">{positionError}</div>}
          {loadingPosition && <div className="mut text-xs">{t("status.loadingPosition")}</div>}
        </div>
        {!address && (
          <button className="btn" onClick={connect}>
            {t("connectFreighter")}
          </button>
        )}
        <div className="grid grid-cols-3 gap-6 text-sm">
          <Stat k={t("collateral")} v={collateralText} />
          <Stat k={t("borrowed")} v={borrowedText} />
          <Stat
            k={t("health")}
            v={health === Infinity || health === null ? t("nA") : formatNumber(health, locale)}
            tone={health !== null && health < 1.2 ? "text-red-400" : "text-emerald-400"}
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="mut">
            <tr className="border-b border-[var(--line)]">
              {[t("asset"), t("price"), t("supplyApy"), t("borrowApy"), t("totalSupplied"), t("yourPosition"), ""].map((h) => (
                <th key={String(h)} className="p-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MARKETS.map((m) => {
              const p = ledger[m.symbol];
              const suppliedFloat = p ? toFloat(p.supplied, m.decimals) : 0;
              const borrowedFloat = p ? toFloat(p.borrowed, m.decimals) : 0;
              const live = Boolean(m.live);
              const onchainRow = live && onChainMode && position
                ? `+${formatNumber(toFloat(position.collateral, DECIMALS), locale, 4)} / -${formatNumber(toFloat(position.debt, DECIMALS), locale, 4)}`
                : null;
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
                    {live
                      ? onChainMode
                        ? onchainRow ?? "-"
                        : p
                          ? `+${formatNumber(suppliedFloat, locale, 4)} / -${formatNumber(borrowedFloat, locale, 4)}`
                          : "-"
                      : "-"}
                  </td>
                  <td className="p-4 text-right">
                    {live ? (
                      <button
                        className="btn-ghost"
                        onClick={() => {
                          setSel(m);
                          setMsg("");
                          setTx(null);
                        }}
                      >
                        {t("trade")}
                      </button>
                    ) : (
                      <span className="mut">{t("comingSoon")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="card max-w-md space-y-4 p-6">
          <h2 className="text-xl font-semibold">{sel.symbol}</h2>
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

function Stat({ k, v, tone = "" }: { k: string; v: string; tone?: string }) {
  return (
    <div>
      <div className="mut">{k}</div>
      <div className={`text-lg font-semibold ${tone}`}>{v}</div>
    </div>
  );
}
