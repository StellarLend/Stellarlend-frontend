import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  rpc,
  scValToNative,
  StrKey,
  TransactionBuilder,
  type xdr,
} from "@stellar/stellar-sdk";
import { config } from "@/lib/config";
import { MARKETS } from "@/lib/markets";
import { ContractNotConfiguredError, UpstreamRpcError } from "./errors";

/**
 * Public, read-only source account used to build Soroban simulations.
 *
 * This is intentionally a constant rather than a request parameter: accepting
 * a caller-supplied source or RPC URL would create an SSRF surface.
 */
const SIMULATION_SOURCE =
  "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH";

const SIMULATION_TIMEOUT_SECONDS = 30;

export interface ProtocolMetrics {
  totalSupply: bigint;
  totalBorrow: bigint;
  utilizationBps: bigint;
  ledger: number;
  /** Populated when the value is read from the contract, not when served from cache. */
  fetchedAt: string;
}

export interface PositionSummary {
  collateral: bigint;
  debt: bigint;
  healthFactor: bigint;
  /** Populated when the value is read from the contract, not when served from cache. */
  fetchedAt: string;
}

export interface MarketMetrics {
  symbol: string;
  name: string;
  supplyApy: number;
  borrowApy: number;
  utilizationBps: bigint;
  supplyCap: bigint;
  borrowCap: bigint;
  oraclePrice: bigint;
  ltvBps: number;
  liqThresholdBps: number;
  active: boolean;
}

export interface MarketsSnapshot {
  markets: MarketMetrics[];
  /** Populated when the value is read from the contract, not when served from cache. */
  fetchedAt: string;
}

type RawProtocolMetrics = {
  total_borrow?: unknown;
  total_supply?: unknown;
  utilization_bps?: unknown;
  ledger?: unknown;
};

type RawPositionSummary = {
  collateral?: unknown;
  debt?: unknown;
  health_factor?: unknown;
};

type RawAssetParams = {
  initial_margin_ratio?: unknown;
  initialMarginRatio?: unknown;
  liquidation_threshold?: unknown;
  liquidationThreshold?: unknown;
  supply_cap?: unknown;
  supplyCap?: unknown;
  borrow_cap?: unknown;
  borrowCap?: unknown;
  active?: unknown;
};

function requireLendingContract(): string {
  if (!config.lendingId) {
    throw new ContractNotConfiguredError();
  }
  return config.lendingId;
}

function rpcServer(): rpc.Server {
  return new rpc.Server(config.rpc);
}

async function simulate(
  server: rpc.Server,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<unknown> {
  const transaction = new TransactionBuilder(
    new Account(SIMULATION_SOURCE, "0"),
    {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    },
  )
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(SIMULATION_TIMEOUT_SECONDS)
    .build();

  let result: Awaited<ReturnType<rpc.Server["simulateTransaction"]>>;
  try {
    result = await server.simulateTransaction(transaction);
  } catch {
    throw new UpstreamRpcError("Soroban RPC request failed");
  }

  if (rpc.Api.isSimulationError(result)) {
    throw new UpstreamRpcError("Soroban RPC returned a simulation error");
  }
  if (!result.result) {
    throw new UpstreamRpcError("Soroban RPC returned no result");
  }

  return scValToNative(result.result.retval);
}

function toBigInt(value: unknown, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  throw new UpstreamRpcError(`Contract returned an invalid ${field}`);
}

function toLedger(value: unknown): number {
  const ledger =
    typeof value === "bigint" ? Number(value) : (value as unknown);
  if (
    typeof ledger !== "number" ||
    !Number.isSafeInteger(ledger) ||
    ledger < 0
  ) {
    throw new UpstreamRpcError("Contract returned an invalid ledger");
  }
  return ledger;
}

function isValidStellarAddress(address: string | undefined): address is string {
  if (!address) return false;
  const trimmed = address.trim();
  if (!trimmed) return false;
  try {
    return (
      StrKey.isValidContract(trimmed) ||
      StrKey.isValidEd25519PublicKey(trimmed)
    );
  } catch {
    return false;
  }
}

function toOptionalBigInt(value: unknown, fallback: bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  return fallback;
}

/** Reads `get_protocol_metrics` from the configured lending contract. */
export async function fetchProtocolMetrics(): Promise<ProtocolMetrics> {
  const contractId = requireLendingContract();
  const raw = (await simulate(
    rpcServer(),
    contractId,
    "get_protocol_metrics",
  )) as RawProtocolMetrics;

  return {
    totalSupply: toBigInt(raw.total_supply, "total_supply"),
    totalBorrow: toBigInt(raw.total_borrow, "total_borrow"),
    utilizationBps: toBigInt(raw.utilization_bps, "utilization_bps"),
    ledger: toLedger(raw.ledger),
    fetchedAt: new Date().toISOString(),
  };
}

/** Reads `get_position` from the configured lending contract for a G-address. */
export async function fetchPosition(address: string): Promise<PositionSummary> {
  const contractId = requireLendingContract();
  const raw = (await simulate(
    rpcServer(),
    contractId,
    "get_position",
    [new Address(address).toScVal()],
  )) as RawPositionSummary;

  return {
    collateral: toBigInt(raw.collateral, "collateral"),
    debt: toBigInt(raw.debt, "debt"),
    healthFactor: toBigInt(raw.health_factor, "health_factor"),
    fetchedAt: new Date().toISOString(),
  };
}

/** Reads per-market parameters, utilization, caps, and oracle prices. */
export async function fetchMarkets(): Promise<MarketsSnapshot> {
  const contractId = requireLendingContract();
  const server = rpcServer();

  const rawProtocol = (await simulate(
    server,
    contractId,
    "get_protocol_metrics",
  )) as RawProtocolMetrics;
  const protocolUtilizationBps = toBigInt(
    rawProtocol.utilization_bps,
    "utilization_bps",
  );

  const markets = await Promise.all(
    MARKETS.map(async (market): Promise<MarketMetrics> => {
      const assetAddress = config.marketAssets[market.symbol] || market.address;
      const defaultLtvBps = Math.round(market.ltv * 10_000);
      const defaultUtilizationBps =
        market.live
          ? protocolUtilizationBps
          : market.totalSupply > 0
            ? BigInt(
                Math.round((market.totalBorrow / market.totalSupply) * 10_000),
              )
            : 0n;
      const defaultOraclePrice = BigInt(Math.round(market.price * 1e7));

      let supplyCap = 0n;
      let borrowCap = 0n;
      let ltvBps = defaultLtvBps;
      let liqThresholdBps = market.liqThresholdBps ?? 8_000;
      let active = true;
      let oraclePrice = defaultOraclePrice;

      if (isValidStellarAddress(assetAddress)) {
        const scAddress = Address.fromString(assetAddress).toScVal();

        try {
          const rawParams = (await simulate(
            server,
            contractId,
            "get_asset_params",
            [scAddress],
          )) as RawAssetParams | null;

          if (rawParams && typeof rawParams === "object") {
            supplyCap = toOptionalBigInt(
              rawParams.supply_cap ?? rawParams.supplyCap,
              0n,
            );
            borrowCap = toOptionalBigInt(
              rawParams.borrow_cap ?? rawParams.borrowCap,
              0n,
            );
            const rawLtv =
              rawParams.initial_margin_ratio ?? rawParams.initialMarginRatio;
            if (rawLtv !== undefined && rawLtv !== null) {
              ltvBps = Number(rawLtv);
            }
            const rawLiq =
              rawParams.liquidation_threshold ?? rawParams.liquidationThreshold;
            if (rawLiq !== undefined && rawLiq !== null) {
              liqThresholdBps = Number(rawLiq);
            }
            if (rawParams.active !== undefined && rawParams.active !== null) {
              active = Boolean(rawParams.active);
            }
          }
        } catch {
          // Fall back to defaults when per-asset params are not configured on-chain.
        }

        if (config.oracleId) {
          try {
            const rawPrice = await simulate(
              server,
              config.oracleId,
              "get_price",
              [scAddress],
            );
            oraclePrice = toOptionalBigInt(rawPrice, defaultOraclePrice);
          } catch {
            // Fall back to market reference price if oracle read is unavailable.
          }
        }
      }

      return {
        symbol: market.symbol,
        name: market.name,
        supplyApy: market.supplyApy,
        borrowApy: market.borrowApy,
        utilizationBps: defaultUtilizationBps,
        supplyCap,
        borrowCap,
        oraclePrice,
        ltvBps,
        liqThresholdBps,
        active,
      };
    }),
  );

  return {
    markets,
    fetchedAt: new Date().toISOString(),
  };
}
