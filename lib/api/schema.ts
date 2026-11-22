/**
 * Shared, versioned response contract for the read-only public API.
 *
 * All i128 values are serialised as decimal strings so consumers never lose
 * precision through JavaScript's number limits.
 */

export type ApiErrorCode =
  | "INVALID_ADDRESS"
  | "CONTRACT_NOT_CONFIGURED"
  | "UPSTREAM_RPC_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export interface ProtocolResponse {
  /** Total supplied principal, decimal string. */
  totalSupply: string;
  /** Total outstanding borrows, decimal string. */
  totalBorrow: string;
  /** Utilization in basis points, decimal string. */
  utilizationBps: string;
  /** Ledger sequence of the contract read. */
  ledger: number;
  /** ISO-8601 timestamp of the upstream read that populated the cache. */
  fetchedAt: string;
}

export interface PositionResponse {
  /** G-address whose position was requested. */
  address: string;
  /** Collateral, decimal string. */
  collateral: string;
  /** Outstanding debt, decimal string. */
  debt: string;
  /** Health factor scaled by 10_000 (contract sentinel for no debt). */
  healthFactor: string;
  /** ISO-8601 timestamp of the upstream read that populated the cache. */
  fetchedAt: string;
}

export interface MarketSnapshot {
  /** Market ticker symbol sourced from `MARKETS` (e.g. "XLM", "USDC"). */
  symbol: string;
  /** Human-readable asset name. */
  name: string;
  /** Supply APY percentage (e.g. 3.4 for 3.4%). */
  supplyApy: number;
  /** Borrow APY percentage (e.g. 6.1 for 6.1%). */
  borrowApy: number;
  /** Utilization in basis points, decimal string. */
  utilizationBps: string;
  /** Supply cap in base units, decimal string ("0" if uncapped). */
  supplyCap: string;
  /** Borrow cap in base units, decimal string ("0" if uncapped). */
  borrowCap: string;
  /** Oracle price scaled to 7 decimals, decimal string. */
  oraclePrice: string;
  /** Loan-to-value ratio in basis points. */
  ltvBps: number;
  /** Liquidation threshold in basis points. */
  liqThresholdBps: number;
  /** Whether the market is active on-chain. */
  active: boolean;
}

export interface MarketsResponse {
  markets: MarketSnapshot[];
  /** ISO-8601 timestamp of the upstream read that populated the cache. */
  fetchedAt: string;
}

export const PROTOCOL_CACHE_CONTROL =
  "public, s-maxage=15, stale-while-revalidate=60";
export const POSITION_CACHE_CONTROL =
  "public, s-maxage=10, stale-while-revalidate=30";
export const MARKETS_CACHE_CONTROL =
  "public, s-maxage=15, stale-while-revalidate=60";
export const ERROR_CACHE_CONTROL = "no-store";
