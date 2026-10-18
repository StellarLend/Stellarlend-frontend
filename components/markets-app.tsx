"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MARKETS, fmt, type Market } from "@/lib/markets";
import { useWallet } from "./wallet";
import { config, explorer } from "@/lib/config";
import {
  loadLedger,
  saveLedger,
  parseAmount,
  formatAmount,
  toFloat,
  computeRisk,
  canWithdraw,
  canBorrow,
  storageKey,
  type Ledger,
} from "@/lib/demo-ledger";

export default function MarketsApp() {
  const { address, balance, error, connect } = useWallet();
  const [ledger, setLedger] = useState<Ledger>({});
  const [resetNotice, setResetNotice] = useState(false);
  const [sel, setSel] = useState<Market | null>(null);
  const [mode, setMode] = useState<"supply" | "borrow" | "withdraw" | "repay">("supply");
  const [amt, setAmt] = useState("");
  const [msg, setMsg] = useState("");

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

  const { collateralUsd, borrowUsd, limitUsd, health } = useMemo(
    () => computeRisk(ledger, MARKETS),
    [ledger]
  );

  // Track last-good amount for cross-tab guard (don't clobber in-progress input)
  const inputRef = useRef(amt);
  inputRef.current = amt;

  function submit() {
    if (!sel) return;
    const parsed = parseAmount(amt, sel.decimals);
    if (!parsed.ok) {
      const msgs: Record<typeof parsed.error, string> = {
        empty: "Enter an amount greater than zero.",
        "invalid-format": "Invalid amount. Use plain decimal notation (e.g. 1.5).",
        negative: "Amount must be positive.",
        "too-many-decimals": `Too many decimal places. Maximum is ${sel.decimals}.`,
        "too-large": "Amount exceeds the maximum allowed.",
        "not-finite": "Amount must be a finite number (no Infinity, NaN, or exponents).",
      };
      setMsg(msgs[parsed.error]);
      return;
    }
    const n = parsed.value;
    const cur = ledger[sel.symbol] ?? { supplied: BigInt(0), borrowed: BigInt(0) };
    const next = { ...cur };

    if (mode === "supply") {
      next.supplied = cur.supplied + n;
    } else if (mode === "withdraw") {
      if (n > cur.supplied) {
        setMsg("Cannot withdraw more than supplied.");
        return;
      }
      if (!canWithdraw(ledger, sel.symbol, n, MARKETS)) {
        setMsg("Withdrawal would make your position undercollateralised.");
        return;
      }
      next.supplied = cur.supplied - n;
    } else if (mode === "borrow") {
      if (!canBorrow(ledger, sel.symbol, n, MARKETS)) {
        setMsg("Borrow exceeds your borrowing limit. Supply more collateral.");
        return;
      }
      next.borrowed = cur.borrowed + n;
    } else if (mode === "repay") {
      if (n > cur.borrowed) {
        setMsg("Cannot repay more than borrowed.");
        return;
      }
      next.borrowed = cur.borrowed - n;
    }

    save({ ...ledger, [sel.symbol]: next });
    setMsg(
      `${mode[0].toUpperCase() + mode.slice(1)} of ${formatAmount(n, sel.decimals)} ${sel.symbol} recorded (demo ledger).`
    );
    setAmt("");
  }

  function resetDemo() {
    save({});
    setMsg("Demo data reset.");
    setResetNotice(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Markets</h1>
        <p className="mut mt-1 text-sm">
          Supply to earn, borrow against collateral. Positions are simulated locally until contracts
          are wired.
        </p>
      </div>

      {resetNotice && (
        <div className="card p-4 text-sm text-amber-400" role="alert">
          Demo data was reset due to corrupted storage.
        </div>
      )}

      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="text-sm">
          <div className="mut">Wallet</div>
          {address ? (
            <div>
              <span className="font-mono">
                {address.slice(0, 8)}...{address.slice(-6)}
              </span>
              <span className="mut"> - {balance ?? "..."} XLM</span>
            </div>
          ) : (
            <div>Demo mode (no wallet connected)</div>
          )}
          {error && <div className="mt-1 text-amber-400">{error}</div>}
        </div>
        {!address && (
          <button className="btn" onClick={connect}>
            Connect Freighter
          </button>
        )}
        <div className="grid grid-cols-3 gap-6 text-sm">
          <Stat k="Collateral" v={`$${fmt(collateralUsd)}`} />
          <Stat k="Borrowed" v={`$${fmt(borrowUsd)}`} />
          <Stat
            k="Health"
            v={health === Infinity ? "n/a" : fmt(health)}
            tone={health < 1.2 ? "text-red-400" : "text-emerald-400"}
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="mut">
            <tr className="border-b border-[var(--line)]">
              {["Asset", "Price", "Supply APY", "Borrow APY", "Total supplied", "Your position", ""].map(
                (h) => (
                  <th key={h} className="p-4 font-medium">
                    {h}
                  </th>
                )
              )}
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
                  <td className="p-4">${fmt(m.price)}</td>
                  <td className="p-4 text-emerald-400">{m.supplyApy}%</td>
                  <td className="p-4">{m.borrowApy}%</td>
                  <td className="p-4">{fmt(m.totalSupply, 0)}</td>
                  <td className="p-4 mut">
                    {p
                      ? `+${fmt(suppliedFloat, 4)} / -${fmt(borrowedFloat, 4)}`
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
                      Trade
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
          <h2 className="text-xl font-semibold">{sel.symbol}</h2>
          <div className="grid grid-cols-4 gap-1 text-sm">
            {(["supply", "borrow", "withdraw", "repay"] as const).map((x) => (
              <button
                key={x}
                onClick={() => {
                  setMode(x);
                  setMsg("");
                }}
                className={`rounded-lg py-2 capitalize ${mode === x ? "btn" : "btn-ghost"}`}
              >
                {x}
              </button>
            ))}
          </div>
          <input
            inputMode="decimal"
            placeholder={`Amount in ${sel.symbol}`}
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            aria-label="Amount"
          />
          <button className="btn w-full" onClick={submit}>
            Confirm {mode}
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
          Lending contract:{" "}
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
            "not deployed"
          )}
        </p>
        <button className="btn-ghost text-xs" onClick={resetDemo}>
          Reset demo data
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
