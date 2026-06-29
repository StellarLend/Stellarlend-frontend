import { describe, expect, it } from "vitest";
import {
  calculateProjectedBorrowHealth,
  calculateRequiredCollateralAmount,
  CRITICAL_HEALTH_FACTOR_THRESHOLD,
  getHealthLabel,
  getHealthBand,
  HEALTHY_HEALTH_FACTOR_THRESHOLD,
  isProjectedBorrowCollateralized,
} from "@/lib/lending/health";

const prices = {
  USDC: 1,
  XLM: 0.12,
  ETH: 3500,
};

describe("lending health preview", () => {
  it("calculates projected health factor and liquidation price", () => {
    const preview = calculateProjectedBorrowHealth({
      loanAmount: 100,
      borrowAsset: "USDC",
      collateralAmount: 300,
      collateralAsset: "USDC",
      prices,
    });

    expect(preview).toEqual(
      expect.objectContaining({
        healthFactor: 2.5,
        liquidationPrice: 0.4,
        loanValueUsd: 100,
        collateralValueUsd: 300,
      }),
    );
  });

  it("converts the minimum collateral requirement across asset prices", () => {
    expect(
      calculateRequiredCollateralAmount({
        loanAmount: 100,
        borrowAsset: "USDC",
        collateralAsset: "XLM",
        prices,
      }),
    ).toBe(1250);

    expect(
      calculateRequiredCollateralAmount({
        loanAmount: 100,
        borrowAsset: "USDC",
        collateralAsset: "USDC",
        prices,
      }),
    ).toBe(150);
  });

  it("returns no collateral requirement for zero loans or missing prices", () => {
    expect(
      calculateRequiredCollateralAmount({
        loanAmount: 0,
        borrowAsset: "USDC",
        collateralAsset: "XLM",
        prices,
      }),
    ).toBeNull();

    expect(
      calculateRequiredCollateralAmount({
        loanAmount: 100,
        borrowAsset: "USDC",
        collateralAsset: "BTC",
        prices,
      }),
    ).toBeNull();
  });

  it("checks the 150% initial collateral requirement by USD value", () => {
    const input = {
      loanAmount: 100,
      borrowAsset: "USDC",
      collateralAsset: "XLM",
      prices,
    };

    expect(
      isProjectedBorrowCollateralized({ ...input, collateralAmount: 1250 }),
    ).toBe(true);
    expect(
      isProjectedBorrowCollateralized({ ...input, collateralAmount: 1249 }),
    ).toBe(false);
    expect(
      isProjectedBorrowCollateralized({ ...input, collateralAmount: 0 }),
    ).toBe(false);
  });

  it("returns no preview when inputs or prices are missing", () => {
    expect(
      calculateProjectedBorrowHealth({
        loanAmount: 0,
        borrowAsset: "USDC",
        collateralAmount: 300,
        collateralAsset: "USDC",
        prices,
      }),
    ).toBeNull();

    expect(
      calculateProjectedBorrowHealth({
        loanAmount: 100,
        borrowAsset: "BTC",
        collateralAmount: 300,
        collateralAsset: "USDC",
        prices,
      }),
    ).toBeNull();
  });

  it("maps health bands to the PositionSummary thresholds", () => {
    expect(getHealthBand(HEALTHY_HEALTH_FACTOR_THRESHOLD)).toBe("healthy");
    expect(getHealthBand(1.5)).toBe("at-risk");
    expect(getHealthBand(CRITICAL_HEALTH_FACTOR_THRESHOLD)).toBe("at-risk");
    expect(getHealthBand(0.99)).toBe("critical");
    expect(getHealthBand(Infinity)).toBe("cleared");
  });

  it("returns human-friendly health labels", () => {
    expect(getHealthLabel(2.5)).toBe("Healthy");
    expect(getHealthLabel(1.2)).toBe("At Risk");
    expect(getHealthLabel(0.8)).toBe("Critical");
    expect(getHealthLabel(Infinity)).toBe("Debt cleared");
  });
});
