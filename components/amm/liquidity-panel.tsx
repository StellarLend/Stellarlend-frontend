"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/components/wallet";
import { MatchPoolRatioButton, SharePresets } from "@/components/amm/liquidity-controls";
import {
  contractErrorMessage,
  readPool,
  submitLiquidityAction,
  type PoolSnapshot,
} from "@/lib/amm/liquidity-client";
import {
  calculateBurnAmounts,
  calculateMintShares,
  formatTokenAmount,
  parseTokenAmount,
} from "@/lib/amm/liquidity-math";
import { config, explorer } from "@/lib/config";

type Tab = "add" | "remove";

export default function LiquidityPanel() {
  const { address, connect } = useWallet();
  const [snapshot, setSnapshot] = useState<PoolSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>("add");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [shares, setShares] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    try {
      setSnapshot(await readPool(address));
    } catch (error) {
      setSnapshot(null);
      setMessage(contractErrorMessage(error instanceof Error ? error.message : String(error)));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { void refresh(); }, [refresh]);

  const amountABase = useMemo(
    () => snapshot ? parseTokenAmount(amountA, snapshot.tokenA.decimals) : null,
    [amountA, snapshot],
  );
  const amountBBase = useMemo(
    () => snapshot ? parseTokenAmount(amountB, snapshot.tokenB.decimals) : null,
    [amountB, snapshot],
  );
  const sharesBase = useMemo(() => /^\d+$/.test(shares) ? BigInt(shares) : null, [shares]);
  const addPreview = useMemo(() => snapshot && amountABase !== null && amountBBase !== null
    ? calculateMintShares(snapshot.totalSupply, amountABase, amountBBase, snapshot.reserveA, snapshot.reserveB)
    : null, [snapshot, amountABase, amountBBase]);
  const removePreview = useMemo(() => snapshot && sharesBase !== null
    ? calculateBurnAmounts(sharesBase, snapshot.totalSupply, snapshot.reserveA, snapshot.reserveB)
    : null, [snapshot, sharesBase]);
  const unusedExcess = useMemo(() => {
    if (!snapshot || !addPreview?.ok || snapshot.totalSupply === 0n) return { a: 0n, b: 0n };
    const requiredForShares = (minted: bigint, reserve: bigint) =>
      (minted * reserve + snapshot.totalSupply - 1n) / snapshot.totalSupply;
    return {
      a: amountABase! - requiredForShares(addPreview.value.shares, snapshot.reserveA),
      b: amountBBase! - requiredForShares(addPreview.value.shares, snapshot.reserveB),
    };
  }, [snapshot, addPreview, amountABase, amountBBase]);
  const resultingSharePercent = useMemo(() => {
    if (!snapshot || !addPreview?.ok) return null;
    const resultingSupply = snapshot.totalSupply + addPreview.value.shares + addPreview.value.lockedShares;
    return resultingSupply === 0n
      ? 0
      : Number((snapshot.userShares + addPreview.value.shares) * 1_000_000n / resultingSupply) / 10_000;
  }, [snapshot, addPreview]);
  const sufficientBalances = Boolean(snapshot && amountABase !== null && amountBBase !== null
    && amountABase > 0n && amountBBase > 0n
    && snapshot.tokenA.balance >= amountABase && snapshot.tokenB.balance >= amountBBase);
  const sufficientLpBalance = Boolean(snapshot && sharesBase !== null && sharesBase > 0n && sharesBase <= snapshot.userShares);
  const aboveMinimumFloor = Boolean(snapshot && sharesBase !== null && removePreview?.ok
    && snapshot.reserveA - removePreview.value.amountA >= snapshot.minimumReserve
    && snapshot.reserveB - removePreview.value.amountB >= snapshot.minimumReserve);
  const configured = Boolean(config.ammId && config.ammTokenAId && config.ammTokenBId);

  function showMessage(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function act() {
    if (!snapshot || !address || pending) return;
    setPending(true);
    showMessage("Preparing and submitting transaction…");
    try {
      const action = tab === "add"
        ? { kind: "add" as const, amountA: amountABase!, amountB: amountBBase! }
        : { kind: "remove" as const, shares: sharesBase! };
      const hash = await submitLiquidityAction(address, action, snapshot, (difference) =>
        window.confirm(`Pool conditions changed and your preview moved by ${difference.toFixed(2)}%. Continue with the refreshed quote?`));
      showMessage(`Transaction confirmed: ${hash}`);
      await refresh();
      setAmountA("");
      setAmountB("");
      setShares("");
    } catch (error) {
      const text = contractErrorMessage(error instanceof Error ? error.message : String(error));
      showMessage(text, !text.toLowerCase().includes("cancel"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[.2em] text-[var(--acc)]">StellarLend AMM</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Liquidity</h1>
        <p className="mut mt-2 max-w-2xl">Provide both pool tokens and receive LP shares, or redeem shares for the pool’s underlying tokens. Previews use the contract’s integer math.</p>
      </div>

      {!configured && (
        <div className="card border-amber-500/40 p-4 text-sm text-amber-200" role="status">
          AMM is not configured for this deployment. Set the AMM and both token contract IDs in the public environment before using liquidity actions.
        </div>
      )}

      <div className="card grid gap-5 p-5 sm:grid-cols-2">
        <div>
          <div className="mut text-sm">Connected wallet</div>
          {address
            ? <div className="mt-1 break-all font-mono text-sm">{address}</div>
            : <button className="btn mt-3" onClick={connect}>Connect Freighter</button>}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <PoolStat label="Reserve A" value={snapshot ? formatTokenAmount(snapshot.reserveA, snapshot.tokenA.decimals) : "—"} />
          <PoolStat label="Reserve B" value={snapshot ? formatTokenAmount(snapshot.reserveB, snapshot.tokenB.decimals) : "—"} />
          <PoolStat label="LP total supply" value={snapshot?.totalSupply.toString() ?? "—"} />
          <PoolStat label="Your LP balance" value={snapshot?.userShares.toString() ?? "—"} />
        </div>
      </div>

      {snapshot && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TokenBalance label="Token A" token={snapshot.tokenA} />
          <TokenBalance label="Token B" token={snapshot.tokenB} />
        </div>
      )}

      <div className="card max-w-3xl overflow-hidden">
        <div className="grid grid-cols-2 border-b border-[var(--line)]">
          {(["add", "remove"] as const).map((nextTab) => (
            <button
              key={nextTab}
              className={`py-4 font-semibold capitalize ${tab === nextTab ? "bg-white/5 text-[var(--acc)]" : "mut"}`}
              aria-pressed={tab === nextTab}
              onClick={() => { setTab(nextTab); showMessage(""); }}
            >
              {nextTab} liquidity
            </button>
          ))}
        </div>
        <div className="space-y-5 p-5 sm:p-7">
          {tab === "add" ? (
            <>
              <AmountInput label="Token A amount" value={amountA} decimals={snapshot?.tokenA.decimals} onChange={setAmountA} />
              <AmountInput label="Token B amount" value={amountB} decimals={snapshot?.tokenB.decimals} onChange={setAmountB} />
              {snapshot && (
                <MatchPoolRatioButton
                  amountA={amountA}
                  decimalsA={snapshot.tokenA.decimals}
                  decimalsB={snapshot.tokenB.decimals}
                  reserveA={snapshot.reserveA}
                  reserveB={snapshot.reserveB}
                  onMatch={setAmountB}
                />
              )}
              {snapshot?.totalSupply === 0n && (
                <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-200">
                  First depositor: 1,000 LP shares are permanently locked by the contract.
                </p>
              )}
              {snapshot && amountABase !== null && amountABase > snapshot.tokenA.balance
                && <p className="text-sm text-amber-200">Insufficient Token A balance for this deposit.</p>}
              {snapshot && amountBBase !== null && amountBBase > snapshot.tokenB.balance
                && <p className="text-sm text-amber-200">Insufficient Token B balance for this deposit.</p>}
              {addPreview && !addPreview.ok && <p className="text-sm text-amber-200">{contractErrorMessage(addPreview.error)}</p>}
              {addPreview?.ok && snapshot && (
                <div className="rounded-xl bg-white/[.03] p-4 text-sm">
                  <PreviewRow label="LP shares minted" value={addPreview.value.shares.toString()} />
                  <PreviewRow label="Your pool share after deposit" value={`${resultingSharePercent?.toFixed(4) ?? "0"}%`} />
                  {snapshot.totalSupply > 0n && <>
                    <PreviewRow label="Token A excess deposited" value={formatTokenAmount(unusedExcess.a, snapshot.tokenA.decimals)} />
                    <PreviewRow label="Token B excess deposited" value={formatTokenAmount(unusedExcess.b, snapshot.tokenB.decimals)} />
                  </>}
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="lp-shares">LP shares to burn</label>
                <input id="lp-shares" inputMode="numeric" placeholder="0" value={shares} onChange={(event) => setShares(event.target.value)} />
              </div>
              <SharePresets balance={snapshot?.userShares ?? 0n} onSelect={setShares} />
              {removePreview && !removePreview.ok && <p className="text-sm text-amber-200">{contractErrorMessage(removePreview.error)}</p>}
              {removePreview?.ok && snapshot && (
                <div className="rounded-xl bg-white/[.03] p-4 text-sm">
                  <PreviewRow label="Token A returned" value={formatTokenAmount(removePreview.value.amountA, snapshot.tokenA.decimals)} />
                  <PreviewRow label="Token B returned" value={formatTokenAmount(removePreview.value.amountB, snapshot.tokenB.decimals)} />
                  {sharesBase !== null && !sufficientLpBalance && <p className="mt-3 text-amber-200">Your LP balance is lower than the requested shares.</p>}
                  {sharesBase !== null && sufficientLpBalance && !aboveMinimumFloor && <p className="mt-3 text-amber-200">This withdrawal would put a pool reserve below its minimum liquidity floor.</p>}
                </div>
              )}
            </>
          )}

          <button
            className="btn w-full"
            disabled={pending || loading || !address || !snapshot || !configured
              || (tab === "add" ? !addPreview?.ok || !sufficientBalances : !removePreview?.ok || !sufficientLpBalance || !aboveMinimumFloor)}
            onClick={() => void act()}
          >
            {pending ? "Transaction pending…" : `Confirm ${tab === "add" ? "deposit" : "withdrawal"}`}
          </button>
          {(loading || !address) && (
            <p className="mut text-center text-sm">
              {loading ? "Loading pool and token balances…" : "Connect Freighter to load pool state."}
            </p>
          )}
          {message && <p className={`break-all text-sm ${isError ? "text-red-300" : "mut"}`} role="status">{message}</p>}
          {config.ammId && (
            <p className="mut break-all text-xs">
              AMM contract: <a className="underline" target="_blank" rel="noreferrer" href={explorer(config.ammId)}>{config.ammId}</a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function AmountInput({ label, value, decimals, onChange }: {
  label: string;
  value: string;
  decimals?: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <input
        inputMode="decimal"
        placeholder={decimals === undefined ? "0" : `Up to ${decimals} decimal places`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      />
    </div>
  );
}

function TokenBalance({ label, token }: { label: string; token: PoolSnapshot["tokenA"] }) {
  const trustlineLabel = token.trustline === "active"
    ? "Active"
    : token.trustline === "missing" ? "Missing" : "Not applicable / unavailable";
  return (
    <div className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
      <div><b>{label}</b><div className="mut mt-1">Soroban balance: {formatTokenAmount(token.balance, token.decimals)}</div></div>
      <div className="text-right"><div className="mut">Horizon trustline</div><div>{trustlineLabel}</div></div>
    </div>
  );
}

function PoolStat({ label, value }: { label: string; value: string }) {
  return <div><div className="mut">{label}</div><div className="mt-1 break-all font-semibold">{value}</div></div>;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 py-1"><span className="mut">{label}</span><b className="text-right">{value}</b></div>;
}
