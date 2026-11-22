"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { config, explorer } from "@/lib/config";
import { getPoolSnapshot, type PoolSnapshot, type ReadResult } from "@/lib/amm/reads";
import { twapSeries, type TwapPoint } from "@/lib/amm/twap";
import { TwapChart } from "./twap-chart";
import { formatTokenAmount } from "@/lib/amm/liquidity-math";

export function PoolOverview() {
  const [snapshot, setSnapshot] = useState<PoolSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<number | undefined>(undefined);

  const isConfigured = Boolean(config.ammId);

  const fetchSnapshot = useCallback(async () => {
    if (!isConfigured) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getPoolSnapshot();
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pool state");
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured) return;
    fetchSnapshot();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchSnapshot();
      }
    }, 30_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchSnapshot();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isConfigured, fetchSnapshot]);

  const twapPoints: TwapPoint[] = useMemo(() => {
    if (!snapshot || !snapshot.twapObservations.ok) return [];
    return twapSeries(snapshot.twapObservations.value, timeWindow);
  }, [snapshot, timeWindow]);

  if (!isConfigured) {
    return (
      <div className="card border-amber-500/30 bg-amber-500/5 p-6 text-center sm:p-8" role="status">
        <h2 className="text-xl font-bold text-amber-200">AMM Not Configured</h2>
        <p className="mut mt-2 max-w-md mx-auto text-sm">
          The AMM contract ID is not configured for this environment. Set <code className="text-amber-300">NEXT_PUBLIC_AMM_CONTRACT_ID</code> in your environment variables to view live pool metrics and TWAP prices.
        </p>
      </div>
    );
  }

  const decA = snapshot?.tokenAInfo.ok ? snapshot.tokenAInfo.value.decimals : 7;
  const decB = snapshot?.tokenBInfo.ok ? snapshot.tokenBInfo.value.decimals : 7;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold sm:text-3xl">AMM Pool Overview</h1>
            {snapshot?.isFlashActive.ok && snapshot.isFlashActive.value && (
              <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-400 border border-red-500/40 animate-pulse">
                Flash Swap In Progress
              </span>
            )}
          </div>
          <p className="mut mt-1 text-sm">
            Read-only pool state: reserves, spot prices, fee parameters, and TWAP buffer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost text-xs px-3 py-1.5"
            onClick={() => fetchSnapshot()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="card border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Reserve Token A"
          result={snapshot?.reserves}
          render={(res) => formatTokenAmount(res[0], decA)}
        />
        <StatCard
          label="Reserve Token B"
          result={snapshot?.reserves}
          render={(res) => formatTokenAmount(res[1], decB)}
        />
        <StatCard
          label="Spot Price (A → B)"
          result={snapshot?.spotPriceAB}
          render={(val) => (val === "-" ? "-" : `1 A = ${val} B`)}
        />
        <StatCard
          label="Spot Price (B → A)"
          result={snapshot?.spotPriceBA}
          render={(val) => (val === "-" ? "-" : `1 B = ${val} A`)}
        />
        <StatCard
          label="Fee Rate"
          result={snapshot?.feeBps}
          render={(bps) => `${(bps / 100).toFixed(2)}% (${bps} bps)`}
        />
        <StatCard
          label="Impact Guard"
          result={snapshot?.maxImpactBps}
          render={(impact) =>
            impact === "disabled" ? "Disabled" : `${(impact / 100).toFixed(2)}% max impact`
          }
        />
        <StatCard
          label="Min-Liquidity Floor"
          result={snapshot?.minLiquidity}
          render={(val) => val.toString()}
        />
        <StatCard
          label="Total LP Supply"
          result={snapshot?.totalSupply}
          render={(val) => val.toString()}
        />
        <StatCard
          label="Accrued Fees (Token A)"
          result={snapshot?.accruedFees}
          render={(fees) => formatTokenAmount(fees[0], decA)}
        />
        <StatCard
          label="Accrued Fees (Token B)"
          result={snapshot?.accruedFees}
          render={(fees) => formatTokenAmount(fees[1], decB)}
        />
        <StatCard
          label="Min Swap In"
          result={snapshot?.minSwapIn}
          render={(minIn) => minIn.toString()}
        />
        <StatCard
          label="Flash Swap Lock"
          result={snapshot?.isFlashActive}
          render={(active) => (active ? "Active (Locked)" : "Inactive")}
        />
      </div>

      <TwapChart
        points={twapPoints}
        windowSecs={timeWindow}
        onWindowChange={setTimeWindow}
      />

      {config.ammId && (
        <div className="text-xs mut break-all">
          AMM Contract:{" "}
          <a
            href={explorer(config.ammId)}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-white"
          >
            {config.ammId}
          </a>
        </div>
      )}
    </div>
  );
}

function StatCard<T>({
  label,
  result,
  render,
}: {
  label: string;
  result?: ReadResult<T>;
  render: (val: T) => React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="mut text-xs font-medium uppercase tracking-wider">{label}</div>
      <div className="mt-2 text-lg font-bold">
        {!result ? (
          <span className="mut text-sm">Loading...</span>
        ) : result.ok ? (
          render(result.value)
        ) : (
          <span className="text-xs text-amber-300 font-normal">unavailable</span>
        )}
      </div>
    </div>
  );
}
