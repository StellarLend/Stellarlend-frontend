export type Market = {
  symbol: string; name: string; price: number; supplyApy: number; borrowApy: number;
  totalSupply: number; totalBorrow: number; ltv: number;
};
export const MARKETS: Market[] = [
  { symbol: "XLM", name: "Stellar Lumens", price: 0.12, supplyApy: 3.4, borrowApy: 6.1, totalSupply: 48_200_000, totalBorrow: 21_400_000, ltv: 0.7 },
  { symbol: "USDC", name: "USD Coin", price: 1, supplyApy: 5.2, borrowApy: 7.8, totalSupply: 12_600_000, totalBorrow: 8_900_000, ltv: 0.85 },
  { symbol: "EURC", name: "Euro Coin", price: 1.08, supplyApy: 4.1, borrowApy: 6.9, totalSupply: 3_100_000, totalBorrow: 1_700_000, ltv: 0.8 },
  { symbol: "BTC", name: "Wrapped Bitcoin", price: 67000, supplyApy: 1.2, borrowApy: 3.5, totalSupply: 420, totalBorrow: 96, ltv: 0.75 },
];
export const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { maximumFractionDigits: d });
