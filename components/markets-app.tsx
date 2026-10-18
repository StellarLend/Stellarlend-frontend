"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MARKETS, formatCurrency, formatNumber, formatPercent, type Locale, type Market } from "@/lib/markets";
import { useWallet } from "./wallet";
import { config, explorer } from "@/lib/config";
import { normaliseAmountInput } from "@/lib/amount-input";

type Pos = Record<string, { supplied: number; borrowed: number }>;
const KEY = "stellarlend-demo-positions";

export default function MarketsApp() {
  const { address, balance, error, connect } = useWallet();
  const locale = useLocale() as Locale;
  const t = useTranslations("market");
  const [pos, setPos] = useState<Pos>({});
  const [sel, setSel] = useState<Market | null>(null);
  const [mode, setMode] = useState<"supply" | "borrow" | "withdraw" | "repay">("supply");
  const [amt, setAmt] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) setPos(JSON.parse(s)); } catch {} }, []);
  const save = (p: Pos) => { setPos(p); try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} };

  const { collateralUsd, borrowUsd, limitUsd } = useMemo(() => {
    let c = 0, b = 0, l = 0;
    for (const m of MARKETS) {
      const p = pos[m.symbol]; if (!p) continue;
      c += p.supplied * m.price; l += p.supplied * m.price * m.ltv; b += p.borrowed * m.price;
    }
    return { collateralUsd: c, borrowUsd: b, limitUsd: l };
  }, [pos]);
  const health = borrowUsd > 0 ? limitUsd / borrowUsd : Infinity;

  function submit() {
    if (!sel) return;
    const normalized = normaliseAmountInput(amt, locale);
    if (!normalized) {
      setMsg(t("status.positiveAmount"));
      return;
    }
    const n = Number(normalized);
    if (!(n > 0)) {
      setMsg(t("status.positiveAmount"));
      return;
    }
    const cur = pos[sel.symbol] ?? { supplied: 0, borrowed: 0 };
    const next = { ...cur };
    if (mode === "supply") next.supplied += n;
    if (mode === "withdraw") {
      if (n > cur.supplied) { setMsg(t("status.exceedsSupply")); return; }
      next.supplied -= n;
    }
    if (mode === "borrow") {
      if (borrowUsd + n * sel.price > limitUsd) { setMsg(t("status.exceedsBorrowLimit")); return; }
      next.borrowed += n;
    }
    if (mode === "repay") {
      if (n > cur.borrowed) { setMsg(t("status.exceedsBorrowed")); return; }
      next.borrowed -= n;
    }
    if (mode === "withdraw") {
      const p2 = { ...pos, [sel.symbol]: next };
      let l = 0, b = 0;
      for (const m of MARKETS) { const q = p2[m.symbol]; if (q) { l += q.supplied * m.price * m.ltv; b += q.borrowed * m.price; } }
      if (b > l) { setMsg(t("status.underCollateralised")); return; }
    }
    save({ ...pos, [sel.symbol]: next });
    setMsg(t("status.recorded", { action: t(mode), amount: formatNumber(n, locale, 4), symbol: sel.symbol }));
    setAmt("");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mut mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="text-sm">
          <div className="mut">{t("wallet")}</div>
          {address ? (
            <div>
              <span className="font-mono">{address.slice(0, 8)}...{address.slice(-6)}</span>
              <span className="mut"> - {balance ?? "..."} XLM</span>
            </div>
          ) : (
            <div>{t("demoMode")}</div>
          )}
          {error && <div className="mt-1 text-amber-400">{error}</div>}
        </div>
        {!address && <button className="btn" onClick={connect}>{t("connectFreighter")}</button>}
        <div className="grid grid-cols-3 gap-6 text-sm">
          <Stat k={t("collateral")} v={formatCurrency(collateralUsd, locale)} />
          <Stat k={t("borrowed")} v={formatCurrency(borrowUsd, locale)} />
          <Stat k={t("health")} v={health === Infinity ? t("nA") : formatNumber(health, locale)} tone={health < 1.2 ? "text-red-400" : "text-emerald-400"} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="mut">
            <tr className="border-b border-[var(--line)]">
              {[t("asset"), t("price"), t("supplyApy"), t("borrowApy"), t("totalSupplied"), t("yourPosition"), ""].map((h) => (
                <th key={String(h)} className="p-4 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MARKETS.map((m) => {
              const p = pos[m.symbol];
              return (
                <tr key={m.symbol} className="border-b border-[var(--line)] last:border-0">
                  <td className="p-4"><b>{m.symbol}</b> <span className="mut">{m.name}</span></td>
                  <td className="p-4">{formatCurrency(m.price, locale)}</td>
                  <td className="p-4 text-emerald-400">{formatPercent(m.supplyApy, locale)}</td>
                  <td className="p-4">{formatPercent(m.borrowApy, locale)}</td>
                  <td className="p-4">{formatNumber(m.totalSupply, locale, 0)}</td>
                  <td className="p-4 mut">{p ? `+${formatNumber(p.supplied, locale, 4)} / -${formatNumber(p.borrowed, locale, 4)}` : "-"}</td>
                  <td className="p-4 text-right"><button className="btn-ghost" onClick={() => { setSel(m); setMsg(""); }}>{t("trade")}</button></td>
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
              <button key={x} onClick={() => { setMode(x); setMsg(""); }} className={`rounded-lg py-2 ${mode === x ? "btn" : "btn-ghost"}`}>
                {t(x)}
              </button>
            ))}
          </div>
          <input inputMode="decimal" placeholder={t("amountIn", { symbol: sel.symbol })} value={amt} onChange={(e) => setAmt(e.target.value)} aria-label={t("amountIn", { symbol: sel.symbol })} />
          <button className="btn w-full" onClick={submit}>{t("confirm", { action: t(mode) })}</button>
          {msg && <p className="text-sm mut" role="status">{msg}</p>}
        </div>
      )}

      <p className="text-xs mut">
        {t("contract")}: {config.lendingId ? <a className="break-all underline" href={explorer(config.lendingId)} target="_blank" rel="noreferrer">{config.lendingId}</a> : t("notDeployed")}
      </p>
    </div>
  );
}

function Stat({ k, v, tone = "" }: { k: string; v: string; tone?: string }) {
  return <div><div className="mut">{k}</div><div className={`text-lg font-semibold ${tone}`}>{v}</div></div>;
}
