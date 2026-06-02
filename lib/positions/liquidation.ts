import { getCollateralFactor } from '@/lib/markets/registry';
import type { AssetSymbol } from '@/types/enums';

export const SAFE_HEALTH_FACTOR = 2.0;

export interface RawPosition {
  asset: AssetSymbol;
  borrowedAmount: number;
  collateralAsset: AssetSymbol;
  collateralAmount: number;
}

export interface LiquidationPosition {
  asset: AssetSymbol;
  borrowedAmount: number;
  collateralAsset: AssetSymbol;
  collateralAmount: number;
  collateralFactor: number;
  healthFactor: number;
  liquidationPriceFactor: number;
  riskScore: number;
}

export interface LiquidationsResponse {
  positions: LiquidationPosition[];
  totalRiskScore: number;
  timestamp: string;
}

export function computeLiquidationPriceFactor(
  borrowedAmount: number,
  collateralAmount: number,
  collateralFactor: number,
): number | null {
  if (collateralAmount <= 0 || collateralFactor <= 0) {
    return null;
  }
  return borrowedAmount / (collateralAmount * collateralFactor);
}

export function computeHealthFactor(
  collateralAmount: number,
  collateralFactor: number,
  borrowedAmount: number,
): number | null {
  if (borrowedAmount <= 0) {
    return null;
  }
  const denominator = borrowedAmount;
  const effectiveCollateral = collateralAmount * collateralFactor;
  return effectiveCollateral / denominator;
}

export function computeRiskScore(healthFactor: number): number {
  if (healthFactor <= 1) {
    return 1;
  }
  if (healthFactor >= SAFE_HEALTH_FACTOR) {
    return 0;
  }
  return Math.round((1 - (healthFactor - 1) / (SAFE_HEALTH_FACTOR - 1)) * 1e6) / 1e6;
}

export function computeLiquidations(positions: RawPosition[]): LiquidationPosition[] {
  const computed = positions.map((pos) => {
    const cf = getCollateralFactor(pos.collateralAsset);
    const hf = computeHealthFactor(pos.collateralAmount, cf, pos.borrowedAmount);
    const healthFactor = hf ?? Infinity;
    const lpf = computeLiquidationPriceFactor(pos.borrowedAmount, pos.collateralAmount, cf);
    const riskScore = hf !== null ? computeRiskScore(healthFactor) : 0;

    return {
      asset: pos.asset,
      borrowedAmount: pos.borrowedAmount,
      collateralAsset: pos.collateralAsset,
      collateralAmount: pos.collateralAmount,
      collateralFactor: cf,
      healthFactor,
      liquidationPriceFactor: lpf ?? 0,
      riskScore,
    };
  });

  computed.sort((a, b) => b.riskScore - a.riskScore);

  return computed;
}

export function generateMockPositions(walletAddress: string): RawPosition[] {
  return [
    {
      asset: 'XLM',
      borrowedAmount: 1500,
      collateralAsset: 'XLM',
      collateralAmount: 5000,
    },
    {
      asset: 'USDC',
      borrowedAmount: 5000,
      collateralAsset: 'ETH',
      collateralAmount: 8000,
    },
    {
      asset: 'BTC',
      borrowedAmount: 0,
      collateralAsset: 'BTC',
      collateralAmount: 2000,
    },
    {
      asset: 'ETH',
      borrowedAmount: 3000,
      collateralAsset: 'ETH',
      collateralAmount: 3200,
    },
  ];
}
