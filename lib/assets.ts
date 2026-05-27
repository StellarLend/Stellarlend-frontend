import type { AssetSymbol } from "@/types/enums";

export interface AssetInfo {
  symbol: AssetSymbol;
  name: string;
  balance: number;
}

/** Canonical asset list for UI forms. Symbols are derived from the shared AssetSymbol enum. */
export const ASSETS: AssetInfo[] = [
  { symbol: "XLM", name: "Stellar Lumens", balance: 3750.0 },
  { symbol: "USDC", name: "USD Coin", balance: 1250.0 },
  { symbol: "BTC", name: "Bitcoin", balance: 0.15 },
  { symbol: "ETH", name: "Ethereum", balance: 2.5 },
];
