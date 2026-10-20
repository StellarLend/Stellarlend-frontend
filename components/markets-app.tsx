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

export default function MarketsApp() {
  const { address, balance, error, connect } = useWallet();
  const locale = useLocale() as Locale;
  const t = useTranslations("market");
  const [ledger, setLedger] = useState<Ledger>({});
  const [resetNotice, setResetNotice] = useState(false);
  const [sel, setSel] = useState<Market | null>(null);
  const [mode, setMode] = useState<"supply" | "borrow" | "withdraw" | "repay">("supply");
  const [amt, setAmt] = useState("");
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const prevSelSymbolRef = useRef<string | null>(null);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const modes = useMemo<("supply" | "borrow" | "withdraw" | "repay")[]>(
    () => ["supply", "borrow", "withdraw", "repay"],
    []
  );

  useEffect(() => {
    if (sel && sel.symbol !== prevSelSymbolRef.current) {
      prevSelSymbolRef.current = sel.symbol;
      headingRef.current?.focus();
    } else if (!sel) {
      prevSelSymbolRef.current = null;
    }
  }, [sel]);

  // Load positions from storage (per-wallet key)
  useEffect(() => {
    const { ledger: loaded, reset } = loadLedger(address);
    // Syncing from localStorage (an external store) when the wallet changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    () => computeRisk(ledger, MARKETS),
    [ledger]
  );

  const healthData = useMemo(() => {
    if (health === Infinity) {
      return {
        label: t("nA"),
        badge: null,
        tone: "",
      };
    }
    const formatted = formatNumber(health, locale);
    if (health < 1.0) {
      return {
        label: formatted,
        badge: t("healthStatus.liquidatable"),
        tone: "text-red-400",
        icon: "⚠️",
      };
    }
    if (health < 1.2) {
      return {
        label: formatted,
        badge: t("healthStatus.atRisk"),
        tone: "text-amber-400",
        icon: "⚡",
      };
    }
    return {
      label: formatted,
      badge: t("healthStatus.healthy"),
      tone: "text-emerald-400",
      icon: "✓",
    };
  }, [health, locale, t]);

  function handleTabKeyDown(e: React.KeyboardEvent, index: number) {
    let nextIndex = index;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % modes.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + modes.length) % modes.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = modes.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const nextMode = modes[nextIndex];
    setMode(nextMode);
    setMsg(null);
    tabsRef.current[nextIndex]?.focus();
  }

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
    const cur = ledger[sel.symbol] ?? { supplied: BigInt(0), borrowed: BigInt(0) };
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
          {error && <div className="mt-1 text-amber-400">{error}</div>}
        </div>
        {!address && (
          <button className="btn" onClick={connect}>
            {t("connectFreighter")}
          </button>
        )}
        <div className="grid grid-cols-3 gap-6 text-sm">
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

      <div className="card overflow-x-auto">
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
              const p = ledger[m.symbol];
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
                      aria-label={`${t("trade")} ${m.symbol}`}
                      onClick={() => {
                        setSel(m);
                        setMsg(null);
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
        <section
          aria-labelledby={`trade-heading-${sel.symbol}`}
          className="card max-w-md space-y-4 p-6"
        >
          <h2
            id={`trade-heading-${sel.symbol}`}
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold outline-none"
          >
            {sel.symbol}
          </h2>
          <div
            role="tablist"
            aria-label={`${sel.symbol} actions`}
            className="grid grid-cols-4 gap-1 text-sm"
          >
            {modes.map((x, index) => {
              const isSelected = mode === x;
              return (
                <button
                  key={x}
                  ref={(el) => {
                    tabsRef.current[index] = el;
                  }}
                  id={`tab-${x}`}
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`panel-${x}`}
                  tabIndex={isSelected ? 0 : -1}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  onClick={() => {
                    setMode(x);
                    setMsg(null);
                  }}
                  className={`rounded-lg py-2 ${isSelected ? "btn" : "btn-ghost"}`}
                >
                  {t(x)}
                </button>
              );
            })}
          </div>
          <div
            id={`panel-${mode}`}
            role="tabpanel"
            aria-labelledby={`tab-${mode}`}
            tabIndex={0}
            className="space-y-4 outline-none"
          >
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
              <p
                className={msg.isError ? "text-amber-400 text-sm" : "mut text-sm"}
                role={msg.isError ? "alert" : "status"}
              >
                {msg.text}
              </p>
            )}
          </div>
        </section>
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
