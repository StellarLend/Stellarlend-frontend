import { createHash } from 'crypto';
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

const POOL_ASSETS: AssetSymbol[] = ['XLM', 'USDC', 'BTC', 'ETH'];

export function generateMockPositions(walletAddress: string): RawPosition[] {
  const seed = createHash('sha256').update(walletAddress).digest();

  const readUint16 = (offset: number) =>
    (seed[offset]! << 8) | seed[offset + 1]!;

  const pickAsset = (offset: number): AssetSymbol =>
    POOL_ASSETS[readUint16(offset) % POOL_ASSETS.length]!;

  const pickAmount = (offset: number, min: number, max: number): number => {
    const ratio = readUint16(offset) / 0xffff;
    return Math.round((min + ratio * (max - min)) * 100) / 100;
  };

  const numPositions = 1 + (seed[32]! % 3);
  const positions: RawPosition[] = [];

  for (let i = 0; i < numPositions; i++) {
    const offset = 33 + i * 6;
    positions.push({
      asset: pickAsset(offset),
      collateralAsset: pickAsset(offset + 2),
      borrowedAmount: pickAmount(offset + 4, 100, 10_000),
      collateralAmount: pickAmount(offset + 4, 500, 20_000),
    });
  }

  return positions;
}
