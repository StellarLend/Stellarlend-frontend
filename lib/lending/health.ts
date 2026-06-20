export type HealthBand = "healthy" | "at-risk" | "critical";

export type PriceMap = Record<string, number>;

export const LIQUIDATION_THRESHOLD_RATIO = 1.2;

export const FALLBACK_PRICES: PriceMap = {
  XLM: 0.12,
  USDC: 1,
  BTC: 65000,
  ETH: 3500,
};

export interface BorrowHealthInput {
  loanAmount: number;
  borrowAsset: string;
  collateralAmount: number;
  collateralAsset: string;
  prices: PriceMap;
}

export interface BorrowHealthPreview {
  healthFactor: number;
  liquidationPrice: number;
  loanValueUsd: number;
  collateralValueUsd: number;
}

export function getHealthBand(healthFactor: number): HealthBand {
  if (healthFactor >= 2) {
    return "healthy";
  }

  if (healthFactor >= 1) {
    return "at-risk";
  }

  return "critical";
}

export function calculateProjectedBorrowHealth({
  loanAmount,
  borrowAsset,
  collateralAmount,
  collateralAsset,
  prices,
}: BorrowHealthInput): BorrowHealthPreview | null {
  const borrowPrice = prices[borrowAsset];
  const collateralPrice = prices[collateralAsset];

  if (
    loanAmount <= 0 ||
    collateralAmount <= 0 ||
    !borrowPrice ||
    !collateralPrice
  ) {
    return null;
  }

  const loanValueUsd = loanAmount * borrowPrice;
  const collateralValueUsd = collateralAmount * collateralPrice;

  if (loanValueUsd <= 0) {
    return null;
  }

  return {
    healthFactor:
      collateralValueUsd / (loanValueUsd * LIQUIDATION_THRESHOLD_RATIO),
    liquidationPrice:
      (loanValueUsd * LIQUIDATION_THRESHOLD_RATIO) / collateralAmount,
    loanValueUsd,
    collateralValueUsd,
  };
}
