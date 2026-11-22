import { TESTNET_ISSUERS } from "./config";

export type ParamSource = "chain" | "demo";

export type MarketSources = {
  ltv: ParamSource;
  liqThreshold: ParamSource;
  supplyCap: ParamSource;
  borrowCap: ParamSource;
  depositCapRemaining: ParamSource;
  minBorrow: ParamSource;
  totalSupply: ParamSource;
  totalBorrow: ParamSource;
};

export type AssetIdentity =
  | "native"
  | {
      code: string;
      issuer: string;
    };

export type Market = {
  symbol: string;
  name: string;
  price: number;
  supplyApy: number;
  borrowApy: number;
  totalSupply: number;
  totalBorrow: number;
  ltv: number;
  /** Number of decimal places for base-unit representation (default 7) */
  decimals: number;
  asset: AssetIdentity;
  sacId?: string;
  /** Whether this market is wired to the live on-chain lending contract */
  live?: boolean;
  /** Optional token contract ID for on-chain oracle lookups */
  contractId?: string;
  /** Source of price data (defaults to "demo") */
  priceSource?: "oracle" | "demo";
  /** On-chain contract address / contract ID for the asset */
  address?: string;
  /** Loan-to-value ratio in basis points (e.g. 7500 = 75%) */
  ltvBps?: number;
  /** Liquidation threshold in basis points (e.g. 8000 = 80%) */
  liqThresholdBps?: number;
  /** Supply cap in base units (0 = uncapped) */
  supplyCap?: bigint;
  /** Borrow cap in base units (0 = uncapped) */
  borrowCap?: bigint;
  /** Remaining deposit capacity in base units (null = uncapped / unknown) */
  depositCapRemaining?: bigint | null;
  /** Minimum borrow amount in base units */
  minBorrow?: bigint;
  /** Provenance of individual market parameter fields */
  sources?: MarketSources;
};

export const MARKETS: Market[] = [
  { symbol: "XLM",  name: "Stellar Lumens",   price: 0.12,   supplyApy: 3.4, borrowApy: 6.1, totalSupply: 48_200_000, totalBorrow: 21_400_000, ltv: 0.7,  decimals: 7, asset: "native", live: true },
  { symbol: "USDC", name: "USD Coin",          price: 1,      supplyApy: 5.2, borrowApy: 7.8, totalSupply: 12_600_000, totalBorrow:  8_900_000, ltv: 0.85, decimals: 7, asset: { code: "USDC", issuer: TESTNET_ISSUERS.USDC } },
  { symbol: "EURC", name: "Euro Coin",         price: 1.08,   supplyApy: 4.1, borrowApy: 6.9, totalSupply:  3_100_000, totalBorrow:  1_700_000, ltv: 0.8,  decimals: 7, asset: { code: "EURC", issuer: TESTNET_ISSUERS.EURC } },
  { symbol: "BTC",  name: "Wrapped Bitcoin",   price: 67000,  supplyApy: 1.2, borrowApy: 3.5, totalSupply:        420, totalBorrow:         96, ltv: 0.75, decimals: 8, asset: { code: "BTC", issuer: TESTNET_ISSUERS.BTC } },
];

const DEFAULT_LOCALE = "en";

export type Locale = "en" | "es";

export const formatNumber = (value: number, locale: Locale = DEFAULT_LOCALE, digits = 2) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);

export const formatCurrency = (value: number, locale: Locale = DEFAULT_LOCALE, digits = 2) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(value);

export const formatPercent = (value: number, locale: Locale = DEFAULT_LOCALE, digits = 2) =>
  new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: digits }).format(value / 100);

export const formatCompactCurrency = (value: number, locale: Locale = DEFAULT_LOCALE) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);

export const fmt = (n: number, d = 2) => formatNumber(n, DEFAULT_LOCALE, d);

export type MarketSortKey = "default" | "supplyApy" | "borrowApy" | "utilization";

export type MarketFilterParams = {
  q?: string | null;
  sort?: string | null;
  mine?: boolean | string | null;
};

export type MarketPositionMap = Record<
  string,
  { supplied: bigint | number; borrowed: bigint | number } | undefined
>;

const VALID_SORT_KEYS = new Set<MarketSortKey>(["supplyApy", "borrowApy", "utilization"]);

export function parseMarketSort(sort?: string | null): MarketSortKey {
  if (sort && VALID_SORT_KEYS.has(sort as MarketSortKey)) {
    return sort as MarketSortKey;
  }
  return "default";
}

export function parseMarketQueryParams(
  searchParams: { get(name: string): string | null }
): { q: string; sort: MarketSortKey; mine: boolean } {
  return {
    q: searchParams.get("q") ?? "",
    sort: parseMarketSort(searchParams.get("sort")),
    mine: searchParams.get("mine") === "1",
  };
}

export function buildMarketQueryString(
  params: { q: string; sort: MarketSortKey; mine: boolean },
  currentParams?: { toString(): string } | null
): string {
  const next = new URLSearchParams(currentParams ? currentParams.toString() : "");
  const trimmedQ = params.q.trim();
  if (trimmedQ) {
    next.set("q", trimmedQ);
  } else {
    next.delete("q");
  }
  const safeSort = parseMarketSort(params.sort);
  if (safeSort !== "default") {
    next.set("sort", safeSort);
  } else {
    next.delete("sort");
  }
  if (params.mine) {
    next.set("mine", "1");
  } else {
    next.delete("mine");
  }
  return next.toString();
}

export function getMarketUtilization(market: Pick<Market, "totalSupply" | "totalBorrow">): number {
  if (market.totalSupply <= 0) return 0;
  return market.totalBorrow / market.totalSupply;
}

function hasOpenPosition(
  pos: { supplied: bigint | number; borrowed: bigint | number } | undefined
): boolean {
  if (!pos) return false;
  const suppliedPositive =
    typeof pos.supplied === "bigint" ? pos.supplied > BigInt(0) : pos.supplied > 0;
  const borrowedPositive =
    typeof pos.borrowed === "bigint" ? pos.borrowed > BigInt(0) : pos.borrowed > 0;
  return suppliedPositive || borrowedPositive;
}

/**
 * Pure filter and stable sort for the markets list.
 * - Case-insensitive substring match on symbol and name
 * - Optional "my positions only" filter
 * - Stable descending sort by supplyApy, borrowApy, or utilization (unknown sort ignored)
 */
export function filterAndSortMarkets(
  markets: readonly Market[],
  params: MarketFilterParams,
  positions?: MarketPositionMap
): Market[] {
  const query = (params.q ?? "").trim().toLowerCase();
  const mineOnly = params.mine === true || params.mine === "1" || params.mine === "true";
  const sortKey = parseMarketSort(params.sort);

  const filtered = markets.filter((market) => {
    if (query) {
      const matchesSymbol = market.symbol.toLowerCase().includes(query);
      const matchesName = market.name.toLowerCase().includes(query);
      if (!matchesSymbol && !matchesName) return false;
    }
    if (mineOnly) {
      if (!hasOpenPosition(positions?.[market.symbol])) return false;
    }
    return true;
  });

  if (sortKey === "default") {
    return filtered;
  }

  return filtered
    .map((market, index) => ({ market, index }))
    .sort((a, b) => {
      let diff = 0;
      if (sortKey === "supplyApy") {
        diff = b.market.supplyApy - a.market.supplyApy;
      } else if (sortKey === "borrowApy") {
        diff = b.market.borrowApy - a.market.borrowApy;
      } else if (sortKey === "utilization") {
        diff = getMarketUtilization(b.market) - getMarketUtilization(a.market);
      }
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map(({ market }) => market);
}
