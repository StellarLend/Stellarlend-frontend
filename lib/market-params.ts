import {
  Address,
  Contract,
  StrKey,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { config } from "./config";
import { MARKETS, type Market, type MarketSources } from "./markets";

export type OnChainAssetParams = {
  asset: string;
  initialMarginRatio: number;
  liquidationThreshold: number;
  liquidationPenalty: number;
  supplyCap: bigint;
  borrowCap: bigint;
  active: boolean;
};

export type ProtocolMetrics = {
  totalDeposited: bigint;
  totalBorrowed: bigint;
  totalReserves: bigint;
};

export type LiveMarketState = {
  assetParams: Record<string, OnChainAssetParams | null>;
  globalDepositCap: bigint | null;
  globalMinBorrow: bigint | null;
  globalLiquidationThresholdBps: number | null;
  protocolMetrics: ProtocolMetrics | null;
};

/** Convert basis points (e.g. 7550) to percentage number (e.g. 75.5) without precision loss */
export function bpsToPercent(bps: number): number {
  return Math.round(bps * 100) / 10000;
}

/** Decode Soroban Option scVal (None -> null, Some(v) -> native v) */
export function decodeOption<T = unknown>(val: xdr.ScVal | undefined | null): T | null {
  if (!val) return null;
  const raw = scValToNative(val);
  if (raw === null || raw === undefined) return null;
  return raw as T;
}

/** Check if string is a valid Stellar contract or account StrKey */
export function isValidAssetAddress(addr: string | undefined | null): boolean {
  if (!addr || typeof addr !== "string") return false;
  const trimmed = addr.trim();
  if (trimmed.length === 0) return false;
  try {
    return StrKey.isValidContract(trimmed) || StrKey.isValidEd25519PublicKey(trimmed);
  } catch {
    return false;
  }
}

/**
 * Calculates remaining deposit capacity:
 * - If cap is 0n or null, it represents uncapped (returns null).
 * - Remaining cannot be negative; clamps to 0n.
 */
export function computeDepositCapRemaining(
  cap: bigint | null | undefined,
  currentTotal: bigint | null | undefined
): bigint | null {
  if (cap === null || cap === undefined || cap === BigInt(0)) {
    return null;
  }
  const current = currentTotal ?? BigInt(0);
  if (current >= cap) {
    return BigInt(0);
  }
  return cap - current;
}

/**
 * Simulates a read-only Soroban contract call using a throwaway keypair.
 * No signing or fees required.
 */
export async function simulateReadCall<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<T | null> {
  if (!contractId || !isValidAssetAddress(contractId)) {
    return null;
  }
  try {
    const server = new rpc.Server(config.rpc);
    const contract = new Contract(contractId);
    const throwawayPublicKey = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const account = new (await import("@stellar/stellar-sdk")).Account(throwawayPublicKey, "0");

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!sim || !rpc.Api.isSimulationSuccess(sim)) {
      return null;
    }
    const resultVal = sim.result?.retval;
    if (!resultVal) return null;
    return scValToNative(resultVal) as T;
  } catch {
    return null;
  }
}

/**
 * Merges on-chain state into a base Market model.
 * Chain-sourced parameters override demo parameters.
 */
export function mergeMarketParams(
  base: Market,
  chainParams: OnChainAssetParams | null | undefined,
  globalDepositCap: bigint | null | undefined,
  globalMinBorrow: bigint | null | undefined,
  globalLiqThresholdBps: number | null | undefined,
  currentDepositBaseUnits?: bigint | null
): Market {
  const sources: MarketSources = {
    ltv: "demo",
    liqThreshold: "demo",
    supplyCap: "demo",
    borrowCap: "demo",
    depositCapRemaining: "demo",
    minBorrow: "demo",
    totalSupply: "demo",
    totalBorrow: "demo",
  };

  const ltvBps = chainParams ? chainParams.initialMarginRatio : Math.round(base.ltv * 10000);
  if (chainParams) sources.ltv = "chain";

  const liqThresholdBps = chainParams
    ? chainParams.liquidationThreshold
    : globalLiqThresholdBps ?? 8000;
  if (chainParams || (globalLiqThresholdBps !== null && globalLiqThresholdBps !== undefined)) {
    sources.liqThreshold = "chain";
  }

  const supplyCap = chainParams ? chainParams.supplyCap : (globalDepositCap ?? BigInt(0));
  if (chainParams || (globalDepositCap !== null && globalDepositCap !== undefined)) {
    sources.supplyCap = "chain";
  }

  const borrowCap = chainParams ? chainParams.borrowCap : BigInt(0);
  if (chainParams) sources.borrowCap = "chain";

  const minBorrow = globalMinBorrow ?? BigInt(10_000_000); // 1.0 unit default
  if (globalMinBorrow !== null && globalMinBorrow !== undefined) {
    sources.minBorrow = "chain";
  }

  const effectiveCap = supplyCap > BigInt(0) ? supplyCap : globalDepositCap;
  const depositCapRemaining = computeDepositCapRemaining(
    effectiveCap,
    currentDepositBaseUnits ?? BigInt(Math.round(base.totalSupply * 10 ** base.decimals))
  );
  if (chainParams || (globalDepositCap !== null && globalDepositCap !== undefined)) {
    sources.depositCapRemaining = "chain";
  }

  return {
    ...base,
    ltv: bpsToPercent(ltvBps) / 100,
    ltvBps,
    liqThresholdBps,
    supplyCap,
    borrowCap,
    depositCapRemaining,
    minBorrow,
    sources,
  };
}

/**
 * Concurrently reads asset params and global protocol parameters for all markets.
 */
export async function fetchLiveMarketParams(markets: Market[] = MARKETS): Promise<Market[]> {
  const lendingId = config.lendingId;
  if (!lendingId || !isValidAssetAddress(lendingId)) {
    return markets.map((m) => mergeMarketParams(m, null, null, null, null, null));
  }

  try {
    const [globalCapRes, globalMinBorrowRes, globalLiqRes, metricsRes] = await Promise.allSettled([
      simulateReadCall<bigint | number | string>(lendingId, "get_deposit_cap"),
      simulateReadCall<bigint | number | string>(lendingId, "get_min_borrow"),
      simulateReadCall<number>(lendingId, "get_liquidation_threshold_bps"),
      simulateReadCall<ProtocolMetrics>(lendingId, "get_protocol_metrics"),
    ]);

    const globalCap =
      globalCapRes.status === "fulfilled" && globalCapRes.value !== null
        ? BigInt(globalCapRes.value.toString())
        : null;

    const globalMinBorrow =
      globalMinBorrowRes.status === "fulfilled" && globalMinBorrowRes.value !== null
        ? BigInt(globalMinBorrowRes.value.toString())
        : null;

    const globalLiq =
      globalLiqRes.status === "fulfilled" && typeof globalLiqRes.value === "number"
        ? globalLiqRes.value
        : null;

    const metrics = metricsRes.status === "fulfilled" ? metricsRes.value : null;

    const assetCalls = await Promise.allSettled(
      markets.map(async (m) => {
        const address = config.marketAssets[m.symbol] || m.address;
        if (!address || !isValidAssetAddress(address)) {
          return { symbol: m.symbol, params: null };
        }
        try {
          const scAddress = Address.fromString(address).toScVal();
          const rawParams = await simulateReadCall<any>(lendingId, "get_asset_params", [scAddress]);
          if (!rawParams) {
            return { symbol: m.symbol, params: null };
          }
          const assetParams: OnChainAssetParams = {
            asset: rawParams.asset ?? address,
            initialMarginRatio: Number(rawParams.initial_margin_ratio ?? rawParams.initialMarginRatio ?? 7500),
            liquidationThreshold: Number(rawParams.liquidation_threshold ?? rawParams.liquidationThreshold ?? 8000),
            liquidationPenalty: Number(rawParams.liquidation_penalty ?? rawParams.liquidationPenalty ?? 500),
            supplyCap: BigInt(rawParams.supply_cap ?? rawParams.supplyCap ?? 0),
            borrowCap: BigInt(rawParams.borrow_cap ?? rawParams.borrowCap ?? 0),
            active: Boolean(rawParams.active ?? true),
          };
          return { symbol: m.symbol, params: assetParams };
        } catch {
          return { symbol: m.symbol, params: null };
        }
      })
    );

    const assetParamsBySymbol = new Map<string, OnChainAssetParams | null>();
    for (const res of assetCalls) {
      if (res.status === "fulfilled") {
        assetParamsBySymbol.set(res.value.symbol, res.value.params);
      }
    }

    return markets.map((m) => {
      const assetParams = assetParamsBySymbol.get(m.symbol) ?? null;
      return mergeMarketParams(m, assetParams, globalCap, globalMinBorrow, globalLiq, null);
    });
  } catch {
    return markets.map((m) => mergeMarketParams(m, null, null, null, null, null));
  }
}
