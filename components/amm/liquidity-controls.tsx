"use client";

import React from "react";
import { formatTokenAmount, parseTokenAmount, proportionalAmount } from "@/lib/amm/liquidity-math";

export function MatchPoolRatioButton({
  amountA,
  decimalsA,
  decimalsB,
  reserveA,
  reserveB,
  onMatch,
}: {
  amountA: string;
  decimalsA: number;
  decimalsB: number;
  reserveA: bigint;
  reserveB: bigint;
  onMatch: (amountB: string) => void;
}) {
  const parsed = parseTokenAmount(amountA, decimalsA);
  const amount = parsed === null ? null : proportionalAmount(parsed, reserveA, reserveB);
  return (
    <button
      className="btn-ghost w-full sm:w-auto"
      disabled={amount === null}
      onClick={() => {
        if (amount !== null) onMatch(formatTokenAmount(amount, decimalsB, decimalsB));
      }}
    >
      Match pool ratio
    </button>
  );
}

export function SharePresets({ balance, onSelect }: { balance: bigint; onSelect: (shares: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[25, 50, 75, 100].map((percent) => (
        <button
          key={percent}
          className="btn-ghost"
          disabled={balance <= 0n}
          onClick={() => onSelect((balance * BigInt(percent) / 100n).toString())}
        >
          {percent === 100 ? "Max" : `${percent}%`}
        </button>
      ))}
    </div>
  );
}
