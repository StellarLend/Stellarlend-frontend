import type { AssetSymbol } from "@/types/enums";

// Re-export new registry API
export {
  getAssetRegistry,
  getAssetMetadata,
  getAllAssets,
  validateRegistry,
  type AssetMetadata,
  type AssetRegistry,
} from './assets/registry';

export interface AssetInfo {
  symbol: AssetSymbol;
  name: string;
  balance: number;
  precision?: number;
}

/** Canonical asset list for UI forms. Symbols are derived from the shared AssetSymbol enum. */
export const ASSETS: AssetInfo[] = [
  { symbol: "XLM", name: "Stellar Lumens", balance: 3750.0, precision: 7 },
  { symbol: "USDC", name: "USD Coin", balance: 1250.0, precision: 2 },
  { symbol: "BTC", name: "Bitcoin", balance: 0.15, precision: 8 },
  { symbol: "ETH", name: "Ethereum", balance: 2.5, precision: 18 },
];
