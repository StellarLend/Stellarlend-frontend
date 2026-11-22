"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/components/wallet";
import { txExplorer } from "@/lib/config";
import {
  calculateEffectivePrice,
  minOutFromSlippage,
  priceImpactBps,
  quoteExactIn,
} from "@/lib/amm/quote";
import {
  GUARD_ERROR_MESSAGES,
  validateQuote,
  type GuardIssue,
} from "@/lib/amm/validate";
import { formatTokenAmount, parseTokenAmount } from "@/lib/amm/liquidity-math";
import {
  contractErrorMessage,
  MAX_SLIPPAGE_BPS,
  MIN_SLIPPAGE_BPS,
  readPool,
  simulateSwapQuote,
  submitSwap,
  type PoolSnapshot,
} from "@/lib/amm/liquidity-client";

const SLIPPAGE_STORAGE_KEY = "stellarlend:amm-slippage-pct";
const DEFAULT_SLIPPAGE_STR = "0.5";
const SLIPPAGE_PRESETS = ["0.1", "0.5", "1"] as const;

function parseSlippageBps(raw: string): { bps: bigint | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { bps: null, error: "Slippage tolerance is required (0.01% - 50%)." };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { bps: null, error: "Enter a valid slippage percentage with up to 2 decimals (0.01% - 50%)." };
  }
  const [whole, frac = ""] = trimmed.split(".");
  const bps = BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
  if (bps < MIN_SLIPPAGE_BPS || bps > MAX_SLIPPAGE_BPS) {
    return { bps: null, error: "Slippage tolerance must be between 0.01% and 50%." };
  }
  return { bps, error: null };
}

function readSessionSlippage(): string {
  try {
    const saved = window.sessionStorage.getItem(SLIPPAGE_STORAGE_KEY);
    if (saved && parseSlippageBps(saved).bps !== null) return saved;
  } catch {
    // Ignore storage access errors in SSR or restricted contexts
  }
  return DEFAULT_SLIPPAGE_STR;
}

export type Direction = "a_to_b" | "b_to_a";

export type SwapQuotePanelProps = {
  initialSnapshot?: PoolSnapshot | null;
  onSimulateQuote?: typeof simulateSwapQuote;
  onSubmitSwap?: typeof submitSwap;
};

export default function SwapQuotePanel({
  initialSnapshot = null,
  onSimulateQuote = simulateSwapQuote,
  onSubmitSwap = submitSwap,
}: SwapQuotePanelProps) {
  const { address } = useWallet();
  const [snapshot, setSnapshot] = useState<PoolSnapshot | null>(initialSnapshot);
  const [direction, setDirection] = useState<Direction>("a_to_b");
  const [inputStr, setInputStr] = useState<string>("");
  const [debouncedInputStr, setDebouncedInputStr] = useState<string>("");
  const [simulatedOut, setSimulatedOut] = useState<bigint | null>(null);
  const [quoteTimestamp, setQuoteTimestamp] = useState<number | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [slippageStr, setSlippageStr] = useState<string>(readSessionSlippage);
  const [swapStatus, setSwapStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [swapTxHash, setSwapTxHash] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Debounce input by 250ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedInputStr(inputStr);
    }, 250);
    return () => clearTimeout(handler);
  }, [inputStr]);

  // Refresh pool snapshot on mount and on window focus
  const refreshSnapshot = useCallback(async () => {
    if (!address) return;
    try {
      const snap = await readPool(address);
      setSnapshot(snap);
      setLastRefreshedAt(Date.now());
    } catch {
      // Gracefully handle unconfigured / offline
    }
  }, [address]);

  useEffect(() => {
    if (!initialSnapshot) {
      void refreshSnapshot();
    } else {
      setSnapshot(initialSnapshot);
      setLastRefreshedAt(Date.now());
    }
  }, [initialSnapshot, refreshSnapshot]);

  useEffect(() => {
    const onFocus = () => {
      void refreshSnapshot();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshSnapshot]);

  // Token setup based on direction
  const isAtoB = direction === "a_to_b";
  const tokenInSymbol = isAtoB ? "Token A" : "Token B";
  const tokenOutSymbol = isAtoB ? "Token B" : "Token A";
  const decimalsIn = snapshot ? (isAtoB ? snapshot.tokenA.decimals : snapshot.tokenB.decimals) : 7;
  const decimalsOut = snapshot ? (isAtoB ? snapshot.tokenB.decimals : snapshot.tokenA.decimals) : 7;
  const reserveIn = snapshot ? (isAtoB ? snapshot.reserveA : snapshot.reserveB) : 0n;
  const reserveOut = snapshot ? (isAtoB ? snapshot.reserveB : snapshot.reserveA) : 0n;
  const feeBps = snapshot?.feeBps ?? 30n;

  // Validate raw string input: reject negative, exponential (1e5), leading space, invalid decimals
  const parseResult = useMemo(() => {
    if (!debouncedInputStr.trim()) {
      return { amountIn: null, error: null };
    }
    const val = debouncedInputStr;
    if (/[eE]/.test(val)) {
      return { amountIn: null, error: "Scientific exponential notation (e.g. 1e5) is not allowed." };
    }
    if (val.startsWith("-")) {
      return { amountIn: null, error: "Negative amounts are not allowed." };
    }
    if (/^0[0-9]/.test(val)) {
      return { amountIn: null, error: "Invalid number format with leading zeros." };
    }
    const parsed = parseTokenAmount(val, decimalsIn);
    if (parsed === null) {
      if (val.includes(".") && val.split(".")[1]?.length > decimalsIn) {
        return {
          amountIn: null,
          error: `Amount exceeds maximum token decimals (${decimalsIn}). Fractional numbers are not rounded.`,
        };
      }
      return { amountIn: null, error: "Invalid amount entered." };
    }
    if (parsed <= 0n) {
      return { amountIn: null, error: "Amount must be strictly positive." };
    }
    return { amountIn: parsed, error: null };
  }, [debouncedInputStr, decimalsIn]);

  useEffect(() => {
    setInputError(parseResult.error);
  }, [parseResult.error]);

  const amountIn = parseResult.amountIn;

  // Compute exact BigInt quote locally
  const localQuote = useMemo(() => {
    if (!amountIn || reserveIn <= 0n || reserveOut <= 0n) return null;
    const res = quoteExactIn({
      amountIn,
      reserveIn,
      reserveOut,
      feeBps,
    });
    return res.ok ? res.value : null;
  }, [amountIn, reserveIn, reserveOut, feeBps]);

  // Compute price impact
  const impactBps = useMemo(() => {
    if (!localQuote) return null;
    return priceImpactBps({
      reserveIn,
      reserveOut,
      reserveInAfter: localQuote.reserveInAfter,
      reserveOutAfter: localQuote.reserveOutAfter,
    });
  }, [localQuote, reserveIn, reserveOut]);

  // Validate on-chain guards
  const guardIssues: GuardIssue[] = useMemo(() => {
    if (!localQuote || !snapshot || amountIn === null) return [];
    return validateQuote(localQuote, {
      amountIn,
      minSwapIn: snapshot.minSwapIn ?? 0n,
      maxImpactBps: snapshot.maxImpactBps ?? 0xffff_ffff,
      minLiquidity: snapshot.minimumReserve,
      impactBps,
    });
  }, [localQuote, snapshot, amountIn, impactBps]);

  // Persist valid slippage per session
  const slippageParse = useMemo(() => parseSlippageBps(slippageStr), [slippageStr]);
  const slippageBps = slippageParse.bps;
  const slippageError = slippageParse.error;

  useEffect(() => {
    if (slippageBps === null) return;
    try {
      window.sessionStorage.setItem(SLIPPAGE_STORAGE_KEY, slippageStr.trim());
    } catch {
      // Ignore storage access errors
    }
  }, [slippageBps, slippageStr]);

  // Simulate on-chain get_swap_quote
  useEffect(() => {
    let cancelled = false;
    if (!amountIn || !snapshot) {
      setSimulatedOut(null);
      setQuoteTimestamp(null);
      setSimulationError(null);
      return;
    }

    setSimulating(true);
    setSimulationError(null);

    const caller = address || "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    onSimulateQuote(caller, amountIn, feeBps, isAtoB)
      .then((sim) => {
        if (!cancelled) {
          setSimulatedOut(sim.amountOut);
          setQuoteTimestamp(Date.now());
          setSimulating(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSimulatedOut(null);
          setQuoteTimestamp(null);
          setSimulationError(err instanceof Error ? err.message : String(err));
          setSimulating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [amountIn, feeBps, isAtoB, snapshot, address, onSimulateQuote]);

  // Disagreement check
  const hasDisagreement =
    localQuote !== null &&
    simulatedOut !== null &&
    localQuote.amountOut !== simulatedOut;

  const isVerifiedOnChain =
    localQuote !== null &&
    simulatedOut !== null &&
    localQuote.amountOut === simulatedOut;

  // Impact colour & label
  const impactFormatted = useMemo(() => {
    if (impactBps === null) return null;
    const whole = impactBps / 100n;
    const frac = (impactBps % 100n).toString().padStart(2, "0");
    const pct = `${whole}.${frac}%`;
    const num = Number(impactBps);

    let color = "text-emerald-400";
    let badgeBg = "bg-emerald-950/40 border-emerald-800 text-emerald-300";
    let label = "Low";

    if (num > 500) {
      color = "text-rose-400";
      badgeBg = "bg-rose-950/40 border-rose-800 text-rose-300";
      label = "Very High";
    } else if (num > 200) {
      color = "text-amber-400";
      badgeBg = "bg-amber-950/40 border-amber-800 text-amber-300";
      label = "Moderate";
    }

    return { pct, color, badgeBg, label, bps: impactBps.toString() };
  }, [impactBps]);

  const effectivePrice = useMemo(() => {
    if (!amountIn || !localQuote) return null;
    return calculateEffectivePrice(amountIn, localQuote.amountOut, decimalsIn, decimalsOut, 6);
  }, [amountIn, localQuote, decimalsIn, decimalsOut]);

  const minOut = useMemo(() => {
    if (!localQuote || slippageBps === null) return null;
    return minOutFromSlippage(localQuote, slippageBps);
  }, [localQuote, slippageBps]);

  const isPoolEmpty = reserveIn <= 0n || reserveOut <= 0n;

  const toggleDirection = () => {
    setDirection((prev) => (prev === "a_to_b" ? "b_to_a" : "a_to_b"));
    setInputStr("");
    setDebouncedInputStr("");
    setSimulatedOut(null);
    setQuoteTimestamp(null);
    setSwapStatus("idle");
    setSwapTxHash(null);
    setSwapError(null);
  };

  const isSwapDisabled =
    !address ||
    isPoolEmpty ||
    amountIn === null ||
    amountIn <= 0n ||
    localQuote === null ||
    slippageBps === null ||
    guardIssues.length > 0 ||
    hasDisagreement ||
    Boolean(inputError) ||
    simulating ||
    swapStatus === "submitting";

  const handleSwap = async () => {
    if (isSwapDisabled || !address || !amountIn || !localQuote || slippageBps === null) return;
    setSwapStatus("submitting");
    setSwapError(null);
    setSwapTxHash(null);
    try {
      const hash = await onSubmitSwap(address, {
        amountIn,
        aForB: isAtoB,
        slippageBps,
        quotedAmountOut: simulatedOut ?? localQuote.amountOut,
        quoteTimestamp: quoteTimestamp ?? Date.now(),
        feeBps,
      });
      setSwapStatus("success");
      setSwapTxHash(hash);
      setInputStr("");
      setDebouncedInputStr("");
      await refreshSnapshot();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setSwapStatus("error");
      setSwapError(contractErrorMessage(raw));
    }
  };

  return (
    <div
      data-testid="swap-quote-panel"
      className="w-full max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Swap Quote</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Exact constant-product quotation with on-chain verification
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            Fee: {Number(feeBps) / 100}% ({feeBps.toString()} bps)
          </span>
          {snapshot?.ledger && (
            <p className="text-[10px] text-slate-500 mt-1">Ledger #{snapshot.ledger}</p>
          )}
        </div>
      </div>

      {/* Direction Switcher */}
      <div className="my-5 flex items-center justify-between bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2 text-sm font-medium">
          <span className="px-2.5 py-1 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg">
            {tokenInSymbol}
          </span>
          <span className="text-slate-500">→</span>
          <span className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg">
            {tokenOutSymbol}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleDirection}
          aria-label="Reverse swap direction"
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700 active:scale-95 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
            />
          </svg>
          <span>Switch</span>
        </button>
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <label htmlFor="swap-amount-in">You Pay ({tokenInSymbol})</label>
          {snapshot && (
            <span>
              Reserve: {formatTokenAmount(reserveIn, decimalsIn, 4)}
            </span>
          )}
        </div>
        <div className="relative">
          <input
            id="swap-amount-in"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={inputStr}
            onChange={(e) => setInputStr(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-lg font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <div className="absolute right-3 top-3 text-xs text-slate-400 font-medium">
            {decimalsIn} decimals
          </div>
        </div>
        {inputError && (
          <p className="text-xs text-rose-400 mt-1 flex items-center space-x-1" role="alert">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{inputError}</span>
          </p>
        )}
      </div>

      {/* Slippage Tolerance */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <label htmlFor="swap-slippage">Slippage Tolerance (%)</label>
          <div className="flex items-center space-x-1">
            {SLIPPAGE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSlippageStr(preset)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition cursor-pointer ${
                  slippageStr.trim() === preset
                    ? "bg-indigo-600/30 border-indigo-500 text-indigo-300"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <input
            id="swap-slippage"
            type="text"
            inputMode="decimal"
            value={slippageStr}
            onChange={(e) => setSlippageStr(e.target.value)}
            placeholder="0.5"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <span className="absolute right-3 top-2 text-xs text-slate-400">%</span>
        </div>
        {slippageError && (
          <p className="text-xs text-rose-400" role="alert">
            {slippageError}
          </p>
        )}
      </div>

      {/* Quote Details */}
      {localQuote && (
        <div className="mt-5 space-y-3 bg-slate-950/40 border border-slate-800 rounded-xl p-4 text-xs font-mono">
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Expected Output</span>
            <span className="text-base font-bold text-white font-mono">
              {formatTokenAmount(localQuote.amountOut, decimalsOut, 6)} {tokenOutSymbol}
            </span>
          </div>

          {minOut !== null && (
            <div className="flex justify-between items-center text-slate-400">
              <span>Minimum Received ({slippageStr.trim()}% slippage)</span>
              <span data-testid="min-out-value" className="text-slate-200 font-semibold">
                {formatTokenAmount(minOut, decimalsOut, 6)} {tokenOutSymbol}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-slate-400">
            <span>Fee ({Number(feeBps) / 100}%)</span>
            <span className="text-slate-300">
              {formatTokenAmount(localQuote.fee, decimalsIn, 6)} {tokenInSymbol}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-400">
            <span>Effective Price</span>
            <span className="text-slate-300">
              {effectivePrice ? `1 ${tokenInSymbol} ≈ ${effectivePrice} ${tokenOutSymbol}` : "—"}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-400">
            <span>Price Impact</span>
            {impactFormatted ? (
              <span className={`px-2 py-0.5 rounded border text-[11px] ${impactFormatted.badgeBg}`}>
                {impactFormatted.pct} ({impactFormatted.label})
              </span>
            ) : (
              <span>—</span>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Post-Swap {tokenInSymbol} Reserve:</span>
              <span className="text-slate-300">{formatTokenAmount(localQuote.reserveInAfter, decimalsIn, 4)}</span>
            </div>
            <div className="flex justify-between">
              <span>Post-Swap {tokenOutSymbol} Reserve:</span>
              <span className="text-slate-300">{formatTokenAmount(localQuote.reserveOutAfter, decimalsOut, 4)}</span>
            </div>
          </div>
        </div>
      )}

      {/* On-Chain Cross-Check Status */}
      {localQuote && (
        <div className="mt-4">
          {simulating && (
            <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <svg className="animate-spin w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Simulating quote against contract...</span>
            </div>
          )}

          {!simulating && isVerifiedOnChain && (
            <div
              data-testid="quote-verified"
              className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/60 p-3 rounded-xl"
            >
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium">Quote verified on-chain (simulation matches local calculation to the unit).</span>
            </div>
          )}

          {!simulating && hasDisagreement && (
            <div
              data-testid="quote-disagreement"
              className="flex items-start space-x-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/80 p-3 rounded-xl"
              role="alert"
            >
              <svg className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-semibold text-amber-200">Quote Disagreement Warning</p>
                <p className="text-amber-300/90 mt-0.5">
                  Local calculation ({formatTokenAmount(localQuote.amountOut, decimalsOut, 6)}) differs from on-chain simulation ({formatTokenAmount(simulatedOut, decimalsOut, 6)}). Execution is disabled for safety.
                </p>
              </div>
            </div>
          )}

          {!simulating && simulationError && (
            <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-800/80 p-3 rounded-xl">
              <span className="font-medium">Contract Simulation Error: </span>
              <span>{simulationError}</span>
            </div>
          )}
        </div>
      )}

      {/* Guard Violations */}
      {guardIssues.length > 0 && (
        <div data-testid="guard-issues" className="mt-4 space-y-2">
          {guardIssues.map((issue) => (
            <div
              key={issue}
              className="flex items-center space-x-2 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/80 p-2.5 rounded-xl"
              role="alert"
            >
              <svg className="w-4 h-4 shrink-0 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{GUARD_ERROR_MESSAGES[issue]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Swap Action Button */}
      <div className="mt-6">
        <button
          type="button"
          data-testid="swap-submit-button"
          disabled={isSwapDisabled}
          onClick={() => {
            void handleSwap();
          }}
          className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition shadow-lg ${
            isSwapDisabled
              ? "bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-98"
          }`}
        >
          {swapStatus === "submitting"
            ? "Swapping..."
            : !address
            ? "Connect Wallet to Swap"
            : isPoolEmpty
            ? "Pool is Empty"
            : guardIssues.length > 0
            ? GUARD_ERROR_MESSAGES[guardIssues[0]]
            : hasDisagreement
            ? "Quote Disagreement"
            : inputError
            ? "Invalid Input"
            : slippageError
            ? "Invalid Slippage"
            : !amountIn
            ? "Enter an Amount"
            : "Swap"}
        </button>
      </div>

      {/* Swap Status UI */}
      {swapStatus === "success" && swapTxHash && (
        <div
          data-testid="swap-success"
          className="mt-4 flex flex-col space-y-1 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/80 p-3 rounded-xl"
          role="status"
        >
          <span className="font-semibold text-emerald-200">Swap confirmed!</span>
          <a
            href={txExplorer(swapTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-emerald-400 hover:text-emerald-300 break-all"
          >
            View transaction: {swapTxHash}
          </a>
        </div>
      )}

      {swapStatus === "error" && swapError && (
        <div
          data-testid="swap-error"
          className="mt-4 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/80 p-3 rounded-xl"
          role="alert"
        >
          <span className="font-semibold text-rose-200">Swap failed: </span>
          <span>{swapError}</span>
        </div>
      )}

      {lastRefreshedAt && (
        <p className="text-[10px] text-slate-500 text-center mt-3">
          Quote reserves auto-refreshed on focus • Snapshot time: {new Date(lastRefreshedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
