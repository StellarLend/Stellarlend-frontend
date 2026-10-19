import { TESTNET_ISSUERS } from "./config";

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
};

export const MARKETS: Market[] = [
  { symbol: "XLM",  name: "Stellar Lumens",   price: 0.12,   supplyApy: 3.4, borrowApy: 6.1, totalSupply: 48_200_000, totalBorrow: 21_400_000, ltv: 0.7,  decimals: 7, asset: "native" },
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
