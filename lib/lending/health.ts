export type HealthBand = "healthy" | "at-risk" | "critical" | "cleared";

export const HEALTHY_HEALTH_FACTOR_THRESHOLD = 2;
export const CRITICAL_HEALTH_FACTOR_THRESHOLD = 1;

export type PriceMap = Record<string, number>;

export const LIQUIDATION_THRESHOLD_RATIO = 1.2;
export const MINIMUM_COLLATERAL_RATIO = 1.5;

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

export type BorrowCollateralRequirementInput = Omit<
  BorrowHealthInput,
  "collateralAmount"
>;

function getPositivePrice(prices: PriceMap, asset: string): number | null {
  const price = prices[asset];
  return Number.isFinite(price) && price > 0 ? price : null;
}

/**
 * Returns the collateral-asset units needed to satisfy the initial 150% ratio.
 * Both sides are converted through the same USD price map so cross-asset
 * positions are compared by value rather than by token quantity.
 */
export function calculateRequiredCollateralAmount({
  loanAmount,
  borrowAsset,
  collateralAsset,
  prices,
}: BorrowCollateralRequirementInput): number | null {
  const borrowPrice = getPositivePrice(prices, borrowAsset);
  const collateralPrice = getPositivePrice(prices, collateralAsset);

  if (loanAmount <= 0 || !borrowPrice || !collateralPrice) {
    return null;
  }

  return (
    (loanAmount * borrowPrice * MINIMUM_COLLATERAL_RATIO) / collateralPrice
  );
}

export function isProjectedBorrowCollateralized(
  input: BorrowHealthInput,
): boolean {
  const preview = calculateProjectedBorrowHealth(input);

  return Boolean(
    preview &&
      preview.collateralValueUsd >=
        preview.loanValueUsd * MINIMUM_COLLATERAL_RATIO,
  );
}

export function getHealthBand(healthFactor: number): HealthBand {
  if (!Number.isFinite(healthFactor)) {
    return "cleared";
  }

  if (healthFactor >= HEALTHY_HEALTH_FACTOR_THRESHOLD) {
    return "healthy";
  }

  if (healthFactor >= CRITICAL_HEALTH_FACTOR_THRESHOLD) {
    return "at-risk";
  }

  return "critical";
}

export function getHealthLabel(healthFactor: number): string {
  switch (getHealthBand(healthFactor)) {
    case "healthy":
      return "Healthy";
    case "at-risk":
      return "At Risk";
    case "critical":
      return "Critical";
    case "cleared":
      return "Debt cleared";
  }
}

export function calculateProjectedBorrowHealth({
  loanAmount,
  borrowAsset,
  collateralAmount,
  collateralAsset,
  prices,
}: BorrowHealthInput): BorrowHealthPreview | null {
  const borrowPrice = getPositivePrice(prices, borrowAsset);
  const collateralPrice = getPositivePrice(prices, collateralAsset);

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
