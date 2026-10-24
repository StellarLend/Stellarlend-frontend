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
  { symbol: "XLM",  name: "Stellar Lumens",   price: 0.12,   supplyApy: 3.4, borrowApy: 6.1, totalSupply: 48_200_000, totalBorrow: 21_400_000, ltv: 0.7,  decimals: 7 },
  { symbol: "USDC", name: "USD Coin",          price: 1,      supplyApy: 5.2, borrowApy: 7.8, totalSupply: 12_600_000, totalBorrow:  8_900_000, ltv: 0.85, decimals: 7 },
  { symbol: "EURC", name: "Euro Coin",         price: 1.08,   supplyApy: 4.1, borrowApy: 6.9, totalSupply:  3_100_000, totalBorrow:  1_700_000, ltv: 0.8,  decimals: 7 },
  { symbol: "BTC",  name: "Wrapped Bitcoin",   price: 67000,  supplyApy: 1.2, borrowApy: 3.5, totalSupply:        420, totalBorrow:         96, ltv: 0.75, decimals: 8 },
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
