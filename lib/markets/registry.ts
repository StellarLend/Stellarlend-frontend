import type { AssetSymbol } from '@/types/enums';
import { ASSET_SYMBOLS } from '@/types/enums';

export interface CollateralConfig {
  collateralFactor: number;
  liquidationThreshold: number;
}

const COLLATERAL_REGISTRY: Record<AssetSymbol, CollateralConfig> = {
  XLM:  { collateralFactor: 0.75, liquidationThreshold: 0.80 },
  USDC: { collateralFactor: 0.85, liquidationThreshold: 0.90 },
  BTC:  { collateralFactor: 0.80, liquidationThreshold: 0.85 },
  ETH:  { collateralFactor: 0.80, liquidationThreshold: 0.85 },
};

export function getCollateralConfig(asset: AssetSymbol): CollateralConfig {
  return COLLATERAL_REGISTRY[asset];
}

export function getCollateralFactor(asset: AssetSymbol): number {
  return COLLATERAL_REGISTRY[asset].collateralFactor;
}

export function getLiquidationThreshold(asset: AssetSymbol): number {
  return COLLATERAL_REGISTRY[asset].liquidationThreshold;
}

export function isAssetSymbol(v: string): v is AssetSymbol {
  return ASSET_SYMBOLS.includes(v as AssetSymbol);
}
